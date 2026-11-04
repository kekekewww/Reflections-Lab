import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { performance } from "node:perf_hooks";
import type { LabRuntime } from "../../src/app/runtime.js";
import type { PhysicsWorld } from "../../src/physics/index.js";
import type { AcousticMaterial } from "../../src/acoustics/types.js";
import type { SceneSpec } from "../../src/scene/types.js";
import type { SoundBehaviorDocument } from "../../schemas/sound-behavior/types.js";
import type { RecordingArtifact } from "../../src/experiments/types.js";
import { attachAcousticCorpus, exactDataEqual } from "./corpus.js";
import type { RuntimeForCorpus } from "./corpus.js";
import { loadFormal100Scene, qualifyPrimaryInput } from "./fixture.js";

type App = RuntimeForCorpus &
  Pick<
    LabRuntime,
    "dispatch" | "advance" | "exportProject" | "importProject" | "getSnapshot" | "dispose"
  > & {
    world: PhysicsWorld;
    lastSolve: number;
    busy: boolean;
    recorder: {
      getView(): { recording: { state: string }; pending: boolean };
      getArtifact(): RecordingArtifact | null;
    };
  };
export async function sourcePins(root: string) {
  const records: { path: string; sha256: string; bytes: number }[] = [];
  const visit = async (directory: string) => {
    for (const entry of await readdir(path.join(root, directory), { withFileTypes: true })) {
      const relative = path.posix.join(directory.replaceAll("\\", "/"), entry.name);
      if (entry.isDirectory()) await visit(relative);
      else if (entry.isFile()) {
        const bytes = await readFile(path.join(root, relative));
        records.push({
          path: relative,
          bytes: bytes.byteLength,
          sha256: createHash("sha256").update(bytes).digest("hex"),
        });
      }
    }
  };
  await visit("src");
  for (const name of [
    "package.json",
    "package-lock.json",
    "tests/browser/performance-fixture-v3.mjs",
  ]) {
    const bytes = await readFile(path.join(root, name));
    records.push({
      path: name,
      bytes: bytes.byteLength,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    });
  }
  return records.sort((a, b) => a.path.localeCompare(b.path));
}
const turn = () => new Promise<void>((resolve) => setImmediate(resolve));
const head = (root: string) =>
  execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();

/** One corpus is generated once, then reused by every configuration and independent timing run. */
export async function generateOriginalPrefix(runtimeRoot: string) {
  const beganAt = new Date().toISOString(),
    began = performance.now();
  const root = path.resolve(runtimeRoot),
    beforePins = await sourcePins(root),
    beginHead = head(root);
  const runtimeModule = (await import(
    pathToFileURL(path.join(root, "src/app/runtime.ts")).href
  )) as { LabRuntime: { create(options: object): Promise<App> } };
  const defaults = (await import(pathToFileURL(path.join(root, "src/app/defaults.ts")).href)) as {
    createDefaultScene(): SceneSpec;
    createDefaultBehaviors(scene: SceneSpec): SoundBehaviorDocument;
    DEFAULT_MATERIALS: AcousticMaterial[];
  };
  const emitter = await import(
    pathToFileURL(path.join(root, "src/app/behavior-acoustic-source.ts")).href
  );
  const formal = await loadFormal100Scene({ root, defaults: defaults.createDefaultScene });
  const storage = new Map<string, string>();
  const app = await runtimeModule.LabRuntime.create({
    useWorker: false,
    storage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    },
  });
  let collector: ReturnType<typeof attachAcousticCorpus> | null = null;
  const warmupTicks = 600,
    measuredTicks = 720;
  const warmSamples = new Set([0, 1, 15, 30, 60, 299, 300, 301, 315, 330, 599, 600]);
  const measuredSamples = new Set([
    0, 1, 15, 30, 60, 299, 300, 301, 315, 330, 599, 600, 601, 602, 615, 630, 659, 660, 661, 720,
  ]);
  let phase: "warmup" | "measured" = "warmup",
    phaseStartTick = 0,
    sequence = 0,
    lastActionAtMs = -Infinity,
    captureStartedMs: number | null = null,
    captureDone = false;
  const captureWindow: {
    scheduledAtMs: number;
    requestedAtMs: number | null;
    startedTick: number | null;
    stoppedAtMs: number | null;
    stoppedTick: number | null;
    artifact: {
      runId: string;
      status: string;
      frameCount: number;
      startTick: number | null;
      endTick: number | null;
      fixedDtS: number;
      sha256: string;
    } | null;
  } = {
    scheduledAtMs: 10000,
    requestedAtMs: null,
    startedTick: null,
    stoppedAtMs: null,
    stoppedTick: null,
    artifact: null,
  };
  try {
    const project = JSON.parse(app.exportProject()) as {
      scene: SceneSpec;
      soundBehaviors: SoundBehaviorDocument;
    };
    project.scene = formal.scene;
    project.soundBehaviors = defaults.createDefaultBehaviors(formal.scene);
    await app.importProject(JSON.stringify(project));
    if (app.getSnapshot().error) throw new Error("COMPONENT_IMPORT: " + app.getSnapshot().error);
    // This is a fixed-tick physics/behavior prefix, not a realtime/RAF performance run.
    // Disable preview scheduling outside timing; original requests are still called and checked.
    app.lastSolve = Infinity;
    collector = attachAcousticCorpus(app, {
      materials: defaults.DEFAULT_MATERIALS,
      origin: "fixed-tick-original-formal-control-prefix",
      sampleTick: (tick) =>
        (phase === "warmup" ? warmSamples : measuredSamples).has(tick - phaseStartTick),
      maxRows: 96,
      maxEvents: 100000,
      mapper: emitter.behaviorAcousticSource,
    });
    const observe = collector;
    const command = async (value: Parameters<LabRuntime["dispatch"]>[0], elapsedMs: number) => {
      const before = {
        tick: app.world.tick,
        paused: app.world.paused,
        recording: app.recorder.getView().recording.state,
      };
      await app.dispatch(value);
      const error = app.getSnapshot().error;
      observe.noteControl({
        phase,
        elapsedMs,
        method: "LabRuntime.dispatch",
        command: value,
        before,
        after: {
          tick: app.world.tick,
          paused: app.world.paused,
          recording: app.recorder.getView().recording.state,
        },
        error,
      });
      if (error) throw new Error("COMPONENT_CONTROL_REJECTED:" + value.type + ":" + error);
    };
    observe.captureNow("initial");
    for (const currentPhase of ["warmup", "measured"] as const) {
      phase = currentPhase;
      phaseStartTick = app.world.tick;
      lastActionAtMs = -Infinity;
      observe.setPhase(phase);
      if (phase === "warmup") await command({ type: "run" }, 0);
      const count = phase === "warmup" ? warmupTicks : measuredTicks;
      for (let frame = 0; frame <= count; frame++) {
        const elapsedMs = (frame * 1000) / 60,
          world = app.world;
        if (world.heldObjectId === "ball" && !world.paused)
          world.updateGrabTarget([
            -0.8 + Math.sin(elapsedMs / 1500) * 0.8,
            1 + Math.cos(elapsedMs / 2500) * 0.3,
            0,
          ]);
        // Commands are awaited, so scriptBusy is false between frames; retain the original runtime.busy gate.
        if (elapsedMs - lastActionAtMs > 5000 && !app.busy) {
          lastActionAtMs = elapsedMs;
          const action = sequence++;
          await command(
            { type: "selectObject", objectId: action % 2 ? "ball" : "speaker" },
            elapsedMs,
          );
          await command(
            {
              type: "workspace",
              workspace: ["scene", "simulation", "analysis"][action % 3] as
                | "scene"
                | "simulation"
                | "analysis",
            },
            elapsedMs,
          );
          await command(
            { type: "setMonitorMode", mode: action % 2 ? "raw" : "simulated" },
            elapsedMs,
          );
          if (action % 2 === 0 && !world.paused) {
            const impulses = Array.from({ length: 24 }, (_, index) => ({
              id: `profile.body.${index}`,
              impulse: [Math.sin(index) * 0.03, 0.12, Math.cos(index) * 0.03] as [
                number,
                number,
                number,
              ],
            }));
            for (const impulse of impulses) world.applyImpulse(impulse.id, impulse.impulse);
            const held = world.heldObjectId;
            const accepted = held
              ? world.throwHeld([0.2, -0.4, -1], 2, `profile.throw.${action}`)
              : world.grab("ball", world.getPose("ball")!.positionMetres, `profile.grab.${action}`);
            observe.noteControl({
              phase,
              elapsedMs,
              method: "PhysicsWorld public API",
              action: held ? "OnThrow" : "OnGrab",
              sequence: action,
              accepted,
              tick: world.tick,
              impulses,
            });
          }
          if (
            app.getSnapshot().simulationState !== "running" &&
            app.recorder.getView().recording.state !== "recording"
          )
            await command({ type: "run" }, elapsedMs);
        }
        // Preserve the formal600 schedule's first window, not the runner's short-profile 1s substitute.
        if (
          phase === "measured" &&
          !captureDone &&
          captureStartedMs === null &&
          elapsedMs >= 10000 &&
          !app.busy
        ) {
          captureWindow.requestedAtMs = elapsedMs;
          await command({ type: "recordToggle" }, elapsedMs);
          if (app.recorder.getView().recording.state !== "recording")
            throw new Error("COMPONENT_CAPTURE_START_NOT_ACCEPTED");
          captureStartedMs = elapsedMs;
          captureWindow.startedTick = world.tick;
        } else if (
          captureStartedMs !== null &&
          elapsedMs - captureStartedMs >= 1000 &&
          !app.busy &&
          app.recorder.getView().recording.state === "recording"
        ) {
          await command({ type: "recordToggle" }, elapsedMs);
          const artifact = app.recorder.getArtifact();
          if (
            !artifact ||
            artifact.status !== "captured" ||
            artifact.frameCount < 1 ||
            app.recorder.getView().pending ||
            app.recorder.getView().recording.state === "recording"
          )
            throw new Error("COMPONENT_CAPTURE_STOP_NOT_SEALED");
          captureWindow.stoppedAtMs = elapsedMs;
          captureWindow.stoppedTick = world.tick;
          captureWindow.artifact = {
            runId: artifact.runId,
            status: artifact.status,
            frameCount: artifact.frameCount,
            startTick: artifact.startTick,
            endTick: artifact.endTick,
            fixedDtS: artifact.configuration.fixedDtS,
            sha256: artifact.artifactSha256,
          };
          captureStartedMs = null;
          captureDone = true;
        }
        if ((phase === "warmup" ? warmSamples : measuredSamples).has(frame))
          observe.captureNow("moving");
        if (frame === count) break;
        const beforeTick = world.tick;
        app.advance(1 / 60);
        await turn();
        if (world.tick !== beforeTick + 1)
          throw new Error(
            `COMPONENT_FIXED_TICK_PROGRESS:${phase}:${frame}:${beforeTick}->${world.tick}`,
          );
      }
    }
    observe.assertValid();
    const state = observe.snapshot();
    const interactions = state.controls.filter(
      (control) => control !== null && typeof control === "object",
    ) as { action?: string; accepted?: boolean }[];
    if (
      !state.physicsEvents.length ||
      !state.audioEvents.length ||
      !interactions.some((control) => control.action === "OnGrab" && control.accepted) ||
      !interactions.some((control) => control.action === "OnThrow" && control.accepted)
    )
      throw new Error("COMPONENT_EVENT_TRACE_NOT_QUALIFIED");
    if (
      !captureDone ||
      !captureWindow.artifact ||
      captureWindow.requestedAtMs === null ||
      captureWindow.stoppedAtMs === null ||
      captureWindow.stoppedAtMs - captureWindow.requestedAtMs < 1000
    )
      throw new Error("COMPONENT_CAPTURE_WINDOW_NOT_QUALIFIED");
    for (const row of state.rows)
      qualifyPrimaryInput(row.input, formal.scene, defaults.DEFAULT_MATERIALS);
    const afterPins = await sourcePins(root),
      endHead = head(root);
    if (!exactDataEqual(beforePins, afterPins))
      throw new Error("COMPONENT_ROOT_SOURCE_CHANGED_DURING_CAPTURE");
    return {
      state,
      metadata: {
        schemaVersion: "acoustic-component-corpus/1",
        beganAt,
        endedAt: new Date().toISOString(),
        elapsedMs: performance.now() - began,
        runtimeRoot: root,
        runtimeBeginHead: beginHead,
        runtimeEndHead: endHead,
        sourcePins: beforePins,
        fixture: {
          path: formal.fixturePath,
          sha256: formal.fixtureSha256,
          constructionSha256: formal.constructionSha256,
        },
        originalScene: formal.scene,
        originalMaterials: defaults.DEFAULT_MATERIALS,
        method:
          "Fixed1/60 virtual ticks, original100dynamic scene/control formulas; 10s warmup +12s original-formal control prefix; same frozen inputs reused, not actualRAF/formal600 trace",
        warmupTicks,
        measuredTicks,
        captureScheduleMs: [10000, 300000, 580000],
        observedCapturePrefixMs: [captureWindow.scheduledAtMs],
        captureWindow,
        scriptDispatch:
          "Sequential awaited commands between fixed ticks; original runtime.busy gates retained; not original RAF concurrency",
        observer:
          "Reversible instance request/onTick/behavior.step wrappers; original Root runtime.ts never edited",
        livePreviewSchedulingDuringGeneration:
          "disabled outside cost timing; original request method manually sampled and capture lane observed unchanged",
        nativeAudioEnabled: false,
        actualFormalBrowserTrace: false,
        limitations: [
          "Not realtime/UI/native audio or full600s qualification",
          "Fresh corpus generations may differ in UUID-based event/admission identities; each comparison run must reuse this exact persisted corpus",
          "Node runtime/audio-disabled prefix must not be mislabeled as the formal browser event trace",
        ],
      },
    };
  } catch (error) {
    const failure = new Error(error instanceof Error ? error.message : String(error), {
      cause: error,
    });
    Object.assign(failure, {
      partial: {
        state: collector?.snapshot() ?? null,
        phase,
        captureWindow,
        runtimeRoot: root,
        runtimeBeginHead: beginHead,
        sourcePins: beforePins,
        beganAt,
        failedAt: new Date().toISOString(),
      },
    });
    throw failure;
  } finally {
    collector?.dispose();
    app.dispose();
  }
}
