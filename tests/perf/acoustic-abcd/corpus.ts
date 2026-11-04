import { createHash } from "node:crypto";
import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { LabRuntime } from "../../../src/app/runtime.js";
import {
  createDefaultBehaviors,
  createDefaultScene,
  DEFAULT_MATERIALS,
} from "../../../src/app/defaults.js";
import { createScene } from "../../../src/scene/index.js";
import { buildAcousticRequests } from "../../../src/app/acoustic-input.js";
import { solveAcoustics } from "../../../src/acoustics/index.js";
import { encodeExact, decodeExact } from "../../../benchmarks/acoustic-transport/corpus-codec.js";
import {
  errorIdentity,
  exactDataEqual,
  resolvedRuntimeInput,
} from "../../../benchmarks/acoustic-transport/corpus.js";
import type { RuntimeForCorpus } from "../../../benchmarks/acoustic-transport/corpus.js";
import type { SceneSpec } from "../../../src/scene/types.js";
import type { RecordedRow, Outcome } from "./comparison.js";

export const sha256 = (bytes: string | Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");
export async function pins(root: string) {
  const files: { path: string; sha256: string; bytes: number }[] = [];
  async function visit(relative: string) {
    for (const entry of await readdir(path.join(root, relative), { withFileTypes: true })) {
      const name = path.posix.join(relative, entry.name);
      if (entry.isDirectory()) await visit(name);
      else if (entry.isFile()) {
        const bytes = await readFile(path.join(root, name));
        files.push({ path: name, sha256: sha256(bytes), bytes: bytes.length });
      }
    }
  }
  // Superset of the imported source closure, including runtime and schema/type dependencies.
  for (const directory of [
    "src",
    "schemas/sound-behavior",
    "tests/perf/acoustic-abcd",
    "tests/browser/nonadvanced/acoustic-abcd",
    "benchmarks/acoustic-transport",
  ])
    await visit(directory);
  for (const name of [
    "package.json",
    "package-lock.json",
    "tests/browser/performance-fixture-v4.mjs",
  ]) {
    const bytes = await readFile(path.join(root, name));
    files.push({ path: name, sha256: sha256(bytes), bytes: bytes.length });
  }
  return files.sort((a, b) => a.path.localeCompare(b.path));
}
export async function formalScene(root: string) {
  const fixture = await readFile(
    path.join(root, "tests/browser/performance-fixture-v4.mjs"),
    "utf8",
  );
  const begin = fixture.indexOf("const makeBody = "),
    end = fixture.indexOf("\nfunction wrap(", begin);
  if (begin < 0 || end <= begin || end - begin > 16000) throw new Error("V4_CONSTRUCTION_REGION");
  const construction = fixture.slice(begin, end);
  const scene = createScene(
    (
      new Function("createDefaultScene", construction + "\nreturn uiScene();") as (
        defaults: typeof createDefaultScene,
      ) => SceneSpec
    )(createDefaultScene),
  );
  if (
    scene.objects.length !== 105 ||
    scene.objects.filter((object) => object.mode.startsWith("dynamic")).length !== 100
  )
    throw new Error("V4_WORKLOAD_CHANGED");
  return { scene, fixtureSha256: sha256(fixture), constructionSha256: sha256(construction) };
}
export interface CorpusManifest {
  format: "acoustic-abcd/1";
  ticks: number;
  fixedDtS: number;
  objects: number;
  dynamicBodies: number;
  rows: { path: string; sha256: string; bytes: number }[];
  trace: { path: string; sha256: string; bytes: number };
  fixtureSha256: string;
  constructionSha256: string;
  runId: string;
  runEpoch: string;
  physicsEvents: number;
  audioEvents: number;
  captureRows: number;
  controls: unknown[];
  sourcePins: Awaited<ReturnType<typeof pins>>;
  head: string;
  method: string;
  limitations: string[];
}
/** Capture every actual runtime requests() call, including failures; no manual request sampling. */
export async function recordCorpus(root: string, directory: string): Promise<CorpusManifest> {
  await mkdir(directory);
  const sourcePins = await pins(root),
    formal = await formalScene(root);
  const app = await LabRuntime.create({ useWorker: false });
  const runtime = app as unknown as RuntimeForCorpus & {
    runId: string;
    world: LabRuntime["world"];
    busy: boolean;
    recorder: {
      getView(): { pending: boolean; recording: { state: string } };
      getArtifact(): { status: string; frameCount: number } | null;
    };
  };
  const rows: CorpusManifest["rows"] = [],
    controls: unknown[] = [];
  const physicsEvents: unknown[] = [],
    audioEvents: unknown[] = [];
  let originalRequests: RuntimeForCorpus["requests"] | undefined;
  let originalTick: RuntimeForCorpus["onTick"] | undefined;
  let originalBehavior: RuntimeForCorpus["behavior"]["step"] | undefined;
  let invalid: unknown = null,
    captureRows = 0;
  const captureTicks = new Set<number>();
  try {
    const project = JSON.parse(app.exportProject());
    project.scene = formal.scene;
    project.soundBehaviors = createDefaultBehaviors(formal.scene);
    await app.importProject(JSON.stringify(project));
    if (app.getSnapshot().error) throw new Error(app.getSnapshot().error!);
    originalRequests = runtime.requests;
    runtime.requests = function (...args) {
      const input = resolvedRuntimeInput(this, DEFAULT_MATERIALS, ...args);
      let expected: RecordedRow["expected"], reference: Outcome;
      let result: ReturnType<RuntimeForCorpus["requests"]> = [],
        failure: unknown;
      try {
        result = originalRequests!.apply(this, args);
        expected = { ok: true, requests: structuredClone(result) };
      } catch (error) {
        failure = error;
        expected = errorIdentity(error);
      }
      try {
        let rebuilt: RecordedRow["expected"];
        try {
          rebuilt = { ok: true, requests: buildAcousticRequests(input) };
        } catch (error) {
          rebuilt = errorIdentity(error);
        }
        if (!exactDataEqual(rebuilt, expected)) throw new Error("CAPTURE_REQUEST_ORACLE");
        try {
          reference = expected.ok ? { ok: true, solutions: result.map(solveAcoustics) } : expected;
        } catch (error) {
          reference = errorIdentity(error);
        }
        const row: RecordedRow = {
          id: `request.${rows.length}`,
          group: "V4-fixed-prefix",
          phase: "recorded",
          tick: this.latest.tick,
          runEpoch: this.runEpoch,
          runId: runtime.runId,
          callScope: args.length > 1 ? "explicit-event-batch" : "default-live",
          sourceEvents: structuredClone(
            args[1] ?? [...this.activeVoices.values()].map((voice) => voice.event),
          ),
          input,
          expected,
          reference,
        };
        if (row.callScope === "explicit-event-batch") {
          captureRows++;
          captureTicks.add(row.tick);
        }
        const encoded = encodeExact(row),
          name = `row-${String(rows.length).padStart(5, "0")}.json`;
        writeFileSync(path.join(directory, name), encoded);
        rows.push({ path: name, sha256: sha256(encoded), bytes: Buffer.byteLength(encoded) });
        if (rows.length > 4096) throw new Error("CORPUS_ROW_BOUND");
      } catch (error) {
        invalid ??= error;
      }
      if (failure) throw failure;
      return result;
    };
    originalTick = runtime.onTick;
    runtime.onTick = function (snapshot) {
      physicsEvents.push(...structuredClone(snapshot.events));
      return originalTick!.call(this, snapshot);
    };
    originalBehavior = runtime.behavior.step;
    runtime.behavior.step = function (frame) {
      const result = originalBehavior!.call(this, frame);
      audioEvents.push(...structuredClone(result.events));
      return result;
    };
    async function command(value: Parameters<LabRuntime["dispatch"]>[0]) {
      await app.dispatch(value);
      controls.push({ tick: runtime.world.tick, command: value, error: app.getSnapshot().error });
      if (app.getSnapshot().error) throw new Error(app.getSnapshot().error!);
    }
    await command({ type: "run" });
    let lastActionMs = -Infinity,
      sequence = 0,
      captureStarted = false,
      captureStopped = false;
    for (let tick = 0; tick < 720; tick++) {
      const elapsedMs = (tick * 1000) / 60,
        world = runtime.world;
      if (world.heldObjectId === "ball" && !world.paused)
        world.updateGrabTarget([
          -0.8 + Math.sin(elapsedMs / 1500) * 0.8,
          1 + Math.cos(elapsedMs / 2500) * 0.3,
          0,
        ]);
      if (elapsedMs - lastActionMs > 5000 && !runtime.busy) {
        lastActionMs = elapsedMs;
        const action = sequence++;
        await command({ type: "selectObject", objectId: action % 2 ? "ball" : "speaker" });
        await command({
          type: "workspace",
          workspace: ["scene", "simulation", "analysis"][action % 3] as
            | "scene"
            | "simulation"
            | "analysis",
        });
        await command({ type: "setMonitorMode", mode: action % 2 ? "raw" : "simulated" });
        if (action % 2 === 0 && !world.paused) {
          for (let i = 0; i < 24; i++)
            world.applyImpulse(`profile.body.${i}`, [Math.sin(i) * 0.03, 0.12, Math.cos(i) * 0.03]);
          const held = world.heldObjectId;
          const accepted = held
            ? world.throwHeld([0.2, -0.4, -1], 2, `profile.throw.${action}`)
            : world.grab("ball", world.getPose("ball")!.positionMetres, `profile.grab.${action}`);
          controls.push({ tick, action: held ? "OnThrow" : "OnGrab", accepted });
          if (!accepted) throw new Error("FORMAL_INTERACTION_REJECTED");
        }
      }
      if (tick === 600) {
        await command({ type: "recordToggle" });
        captureStarted = runtime.recorder.getView().recording.state === "recording";
      }
      if (tick === 660) {
        await command({ type: "recordToggle" });
        captureStopped = runtime.recorder.getArtifact()?.status === "captured";
      }
      const beforeTick = world.tick;
      app.advance(1 / 60);
      await new Promise<void>((resolve) => setImmediate(resolve));
      if (invalid) throw invalid;
      if (world.tick !== beforeTick + 1)
        throw new Error(`FIXED_TICK_PROGRESS:${tick}:${beforeTick}->${world.tick}`);
    }
    if (
      !rows.length ||
      !physicsEvents.length ||
      !audioEvents.length ||
      !captureRows ||
      !captureStarted ||
      !captureStopped
    )
      throw new Error("CORPUS_PIPELINE_NOT_QUALIFIED");
    if (
      captureTicks.size !== 60 ||
      Array.from({ length: 60 }, (_, i) => 601 + i).some((tick) => !captureTicks.has(tick))
    )
      throw new Error("CAPTURE_TICK_DROPPED");
    const traceText = encodeExact({ physicsEvents, audioEvents, controls });
    await writeFile(path.join(directory, "trace.json"), traceText);
    if (!exactDataEqual(sourcePins, await pins(root)))
      throw new Error("SOURCE_CHANGED_DURING_CAPTURE");
    const manifest: CorpusManifest = {
      format: "acoustic-abcd/1",
      ticks: 720,
      fixedDtS: 1 / 60,
      objects: 105,
      dynamicBodies: 100,
      rows,
      trace: { path: "trace.json", sha256: sha256(traceText), bytes: Buffer.byteLength(traceText) },
      fixtureSha256: formal.fixtureSha256,
      constructionSha256: formal.constructionSha256,
      runId: runtime.runId,
      runEpoch: runtime.runEpoch,
      physicsEvents: physicsEvents.length,
      audioEvents: audioEvents.length,
      captureRows,
      controls,
      sourcePins,
      head: execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(),
      method:
        "Every real LabRuntime.requests call over 720 deterministic Rapier/behavior fixed ticks; V4 105/100 scene and control prefix, original preview cadence, 60-tick capture at 10s; synchronous acoustic generation, audio disabled. Exact graph codec preserves signed zero/undefined/identities. No synthetic corpus requests.",
      limitations: [
        "Virtual fixed ticks, not original RAF concurrency or formal 600s performance",
        "UUID run/epoch/event IDs vary across generation; all arms reuse these exact persisted bytes",
        "Node audio disabled; native onset, hardware sound and AudioEngine consumer cost NOT MEASURED",
        "Recording requests are lossless replayed individually, not replaced by latest preview",
      ],
    };
    await writeFile(path.join(directory, "corpus.json"), JSON.stringify(manifest, null, 2));
    return manifest;
  } catch (error) {
    await writeFile(
      path.join(directory, "capture-failure.json"),
      JSON.stringify(
        {
          error: errorIdentity(error),
          rows,
          controls,
          physicsEvents: physicsEvents.length,
          audioEvents: audioEvents.length,
        },
        null,
        2,
      ),
    );
    throw error;
  } finally {
    if (originalRequests) runtime.requests = originalRequests;
    if (originalTick) runtime.onTick = originalTick;
    if (originalBehavior) runtime.behavior.step = originalBehavior;
    app.dispose();
  }
}
export async function loadRow(
  directory: string,
  entry: CorpusManifest["rows"][number],
): Promise<RecordedRow> {
  if (!/^row-\d{5}\.json$/.test(entry.path)) throw new Error("CORPUS_PATH");
  const bytes = await readFile(path.join(directory, entry.path));
  if (sha256(bytes) !== entry.sha256 || bytes.length !== entry.bytes)
    throw new Error("CORPUS_HASH");
  return decodeExact(bytes.toString("utf8")) as RecordedRow;
}
