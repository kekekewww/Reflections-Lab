import assert from "node:assert/strict";
import { LabRuntime } from "../../../../src/app/runtime.js";
import { AudioEngine } from "../../../../src/audio/engine.js";
import type { ProjectDocument } from "../../../../src/persistence/types.js";
import type { BehaviorRuntime } from "../../../../src/audio-behavior/types.js";
import type { PhysicsSnapshot } from "../../../../src/physics/types.js";
import { FakeAudioContext } from "../../../audio-runtime/fake-context.js";
import { BUDGET, POLICY, type Corpus, type CorpusTick } from "./contracts.js";

/** Test-only instrumentation of the same composition-root seams used in tests/app.
 * Captures actual Rapier -> behavior -> recorder and native AudioEngine calls.
 * Native policy feedback is NOT connected to the behavior evaluator.
 */
export async function captureCorpus(candidate = false, count = 96): Promise<Corpus> {
  const app = await LabRuntime.create({
    useWorker: false,
    audioResourcePolicy: candidate ? POLICY : false,
  });
  const context = new FakeAudioContext();
  Object.defineProperty(context, "renderQuantumSize", { value: 128 });
  const engine = new AudioEngine({
    context: context.asContext(),
    budget: BUDGET,
    oscillatorModel: "nativeReference",
    virtualization: candidate ? POLICY : false,
  });
  // Private seams are test instrumentation only; no product API/default changes.
  const runtime = app as unknown as {
    audio: AudioEngine;
    runId: string;
    runEpoch: string;
    behavior: BehaviorRuntime;
    newBehavior(): BehaviorRuntime;
    onTick(snapshot: PhysicsSnapshot): void;
    latest: PhysicsSnapshot;
    recorder: { appendEvaluationFrame(...args: unknown[]): void };
  };
  const corpus: Corpus = {
    version: "voice-asset-runtime-v1",
    budget: BUDGET,
    method:
      "LabRuntime + real Rapier + behavior + production recorder; FakeAudioContext control scheduling only; 15 continuous emitters plus physical ball impact; engine formal 24 render voices/32 paths per voice/256 total paths unchanged",
    ticks: [],
    recording: [],
  };
  let current: CorpusTick | undefined;
  let capturing = true;
  try {
    const project = JSON.parse(app.exportProject()) as ProjectDocument;
    const speaker = project.scene.objects.find((o) => o.id === "speaker")!;
    const source = project.scene.sources[0]!;
    const binding = project.soundBehaviors.bindings.find((b) => b.objectId === "speaker")!;
    for (let i = 1; i < 15; i++) {
      const objectId = `speaker.${i}`;
      project.scene.objects.push({
        ...speaker,
        id: objectId,
        positionM: [-2 + (i % 5), 1 + Math.floor(i / 5) * 0.4, -2],
      });
      project.scene.sources.push({ ...source, id: `source.${i}`, objectId });
      project.soundBehaviors.bindings.push({ ...binding, bindingId: `binding.${i}`, objectId });
    }
    await app.importProject(JSON.stringify(project));
    runtime.runId = "run.voice-asset";
    runtime.runEpoch = "epoch.voice-asset";
    runtime.behavior = runtime.newBehavior();
    runtime.audio = engine;
    await engine.enable(0);
    const record = runtime.recorder.appendEvaluationFrame.bind(runtime.recorder);
    runtime.recorder.appendEvaluationFrame = (...args) => {
      const frame = args[0] as Record<string, unknown>;
      if (capturing)
        corpus.recording.push(
          structuredClone({
            tick: frame.tick,
            poses: frame.poses,
            physicsEvents: frame.physicsEvents,
            behaviorDecisions: frame.behaviorDecisions,
            audioEvents: frame.audioEvents,
            voiceIntents: (frame.behaviorSnapshot as Record<string, unknown>).voiceIntents,
          }),
        );
      return record(...args);
    };
    const onTick = runtime.onTick.bind(runtime);
    const step = runtime.behavior.step.bind(runtime.behavior);
    runtime.behavior.step = (input) => {
      const result = step(input);
      if (current && capturing)
        Object.assign(
          current,
          structuredClone({
            physicsEvents: input.events,
            decisions: result.decisions,
            audioEvents: result.events,
            voiceIntents: result.voices,
          }),
        );
      return result;
    };
    runtime.onTick = (snapshot) => {
      if (capturing) {
        current = {
          tick: snapshot.tick,
          time: snapshot.simulationTimeSeconds,
          operations: [],
          physicsEvents: [],
          decisions: [],
          audioEvents: [],
          voiceIntents: [],
        };
        corpus.ticks.push(current);
      }
      onTick(snapshot);
    };
    const play = engine.playVoice.bind(engine),
      update = engine.updateVoice.bind(engine),
      frame = engine.updateFrame.bind(engine),
      stop = engine.stopVoice.bind(engine);
    engine.playVoice = (input, acoustic, stale) => {
      assert.ok(acoustic, "runtime must supply its real solver frame");
      if (capturing && current)
        current.operations.push(
          structuredClone({ kind: "start", input, frame: acoustic, stale: stale ?? false }),
        );
      return play(input, acoustic, stale);
    };
    engine.updateVoice = (id, change) => {
      if (capturing && current)
        current.operations.push(structuredClone({ kind: "update", id, update: change }));
      return update(id, change);
    };
    engine.updateFrame = (acoustic) => {
      if (capturing && current)
        current.operations.push(structuredClone({ kind: "frame", frame: acoustic }));
      return frame(acoustic);
    };
    engine.stopVoice = (id, fade) => {
      if (capturing && current)
        current.operations.push({ kind: "stop", id, ...(fade === undefined ? {} : { fade }) });
      return stop(id, fade);
    };
    await app.dispatch({ type: "recordToggle" });
    for (let i = 1; i <= count; i++) {
      context.currentTime = i / 60;
      app.advance(1 / 60);
      // Settle the real async preview solver and recorder between fixed steps.
      await new Promise<void>((resolve) => setImmediate(resolve));
      engine.flushControlUpdates();
    }
    assert.equal(corpus.ticks.length, count, "no physics ticks dropped");
    assert.equal(corpus.recording.length, count, "no recording decisions dropped");
    assert.ok(
      corpus.ticks.some((t) => t.physicsEvents.length),
      "real physics event coverage",
    );
    assert.ok(corpus.ticks.flatMap((t) => t.operations).some((o) => o.kind === "start"));
    capturing = false;
    await app.dispatch({ type: "pause" });
    await app.dispatch({ type: "recordToggle" });
    assert.equal(app.getRecordingArtifact()?.status, "captured");
    return corpus;
  } finally {
    capturing = false;
    app.dispose();
    await engine.disposeAsync();
  }
}
