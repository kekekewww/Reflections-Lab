import type {
  AudioEvent,
  SoundBehaviorDocument,
  SoundBehaviorRule,
  SoundGenerator,
  SoundInstance,
} from "../../schemas/sound-behavior/types.js";
import { createBehaviorRuntime } from "../audio-behavior/index.js";
import { audioEventValidator, effectiveRule } from "../audio-behavior/profile-registry.js";
import type { BehaviorAsset, BehaviorSnapshot, VoiceIntent } from "../audio-behavior/types.js";
import type { AudioEngine } from "../audio/engine.js";
import type { VoiceCursor, VoiceInput } from "../audio/types.js";
import { canonicalStringify, immutableClone } from "../experiments/hash.js";
import { verifyRecording } from "../experiments/recorder.js";
import { RecordingError } from "../experiments/types.js";
import type { RecordingArtifact, RecordingFrame, ReplayFrame } from "../experiments/types.js";
import { makeBehaviorContext } from "./defaults.js";
import type { RecordedBehaviorSnapshot } from "./recording-processor.js";

/** Source seconds exclude the authored sample offset; elapsed time never includes propagation. */
type CapturedCursor = VoiceCursor;
interface AudioSnapshot extends RecordedBehaviorSnapshot {
  preStepVoiceCursors?: Record<string, CapturedCursor>;
  voiceCursors?: Record<string, CapturedCursor>;
}
export interface ReplayAudioHostOptions {
  getEngine(): AudioEngine | null;
  getAssets(): BehaviorAsset[];
}
const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
function fail(code: string, message: string): never {
  throw new RecordingError(code, message);
}
const same = (a: unknown, b: unknown): boolean => canonicalStringify(a) === canonicalStringify(b);

/** Plays captured decisions through the normal source graph, without running physics or behavior. */
export class ReplayAudioHost {
  private artifact: RecordingArtifact | null = null;
  private document: SoundBehaviorDocument | null = null;
  private frames = new Map<number, RecordingFrame>();
  private latest: RecordingFrame | null = null;
  private emittedTick: number | null = null;
  private restoreOnResume = false;
  private validatedEngine: AudioEngine | null = null;
  private attachedEngine: AudioEngine | null = null;

  constructor(private readonly options: ReplayAudioHostOptions) {}

  /** The live host drains its old epoch first. The first frame's events are applied separately. */
  async begin(artifact: RecordingArtifact): Promise<void> {
    await verifyRecording(artifact);
    if (artifact.status !== "captured" || !artifact.frames.length)
      fail("INCOMPLETE_RECORDING", "只有完整且有 frame 的錄製可以重播音訊。");
    this.artifact = immutableClone(artifact);
    this.frames = new Map(this.artifact.frames.map((frame) => [frame.tick, frame]));
    this.document = null;
    this.validatedEngine = null;
    this.attachedEngine = null;
    this.latest = null;
    this.emittedTick = null;
    this.restoreOnResume = false;
    const engine = this.options.getEngine();
    if (!engine) return;
    this.validate(engine);
    const first = this.artifact.frames[0]!;
    const time = this.time(first);
    await engine.resume(time);
    engine.setEpoch(time);
    this.route(first, engine);
    // A capture may begin after a continuous source or impact has already started.
    // Restore that content before delivering this frame's new update/stop/start intents.
    this.restore(first, this.snapshot(first).preStepSnapshot!, engine, true);
    this.attachedEngine = engine;
  }

  applyFrame(input: RecordingFrame, emitEvents = true): void {
    const frame = this.capturedFrame(input);
    this.latest = frame;
    const engine = this.options.getEngine();
    if (!engine) {
      this.emittedTick = frame.tick;
      this.restoreOnResume = true;
      return;
    }
    this.validate(engine);
    this.route(frame, engine);
    if (!emitEvents || (input as Partial<ReplayFrame>).emitEvents === false) {
      this.restoreOnResume = true;
      return;
    }
    if (this.emittedTick !== null && frame.tick <= this.emittedTick) return;
    if (this.restoreOnResume) fail("REPLAY_PAUSED", "Seek 後請先 Resume，才能繼續排程音訊。");
    for (const intent of this.snapshot(frame).voiceIntents) {
      const event = intent.event;
      if (intent.action === "stop") engine.stopVoice(event.instanceId);
      else if (intent.action === "update")
        engine.updateVoice(event.instanceId, {
          gainLinear: event.gainLinear,
          pitchSemitones: event.pitchSemitones,
          smoothingSeconds: intent.smoothingSeconds,
          ...(intent.filterCutoffHz === undefined ? {} : { filterCutoffHz: intent.filterCutoffHz }),
        });
      else engine.playVoice(this.voiceInput(intent), this.sourceFrame(frame, event.instanceId));
    }
    this.emittedTick = frame.tick;
  }

  /** A preview has no emission. Its currently active content is rehydrated only on Resume. */
  async seek(input: RecordingFrame): Promise<void> {
    const frame = this.capturedFrame(input);
    const engine = this.options.getEngine();
    if (engine) {
      this.validate(engine);
      await engine.drainVoices();
      this.route(frame, engine);
    }
    this.latest = frame;
    this.emittedTick = frame.tick;
    this.restoreOnResume = true;
  }

  async resume(): Promise<void> {
    const engine = this.options.getEngine();
    if (!engine || !this.artifact) return;
    this.validate(engine);
    const frame = this.latest ?? this.artifact.frames[0]!;
    await engine.resume(this.time(frame));
    if (this.restoreOnResume || this.attachedEngine !== engine) {
      engine.setEpoch(this.time(frame));
      this.route(frame, engine);
      const first = this.latest === null;
      this.restore(
        frame,
        first ? this.snapshot(frame).preStepSnapshot! : this.snapshot(frame).runtimeSnapshot,
        engine,
        first,
      );
      if (!first) this.emittedTick = frame.tick;
      this.restoreOnResume = false;
      this.attachedEngine = engine;
    }
  }

  async stop(): Promise<void> {
    if (this.artifact) await this.options.getEngine()?.drainVoices();
    this.artifact = null;
    this.document = null;
    this.frames.clear();
    this.latest = null;
    this.emittedTick = null;
    this.restoreOnResume = false;
    this.validatedEngine = null;
    this.attachedEngine = null;
  }

  private time(frame: RecordingFrame): number {
    return frame.tick * this.artifact!.configuration.fixedDtS;
  }
  private snapshot(frame: RecordingFrame): AudioSnapshot {
    const value = frame.behaviorSnapshot;
    if (
      !record(value) ||
      !record(value.inputFrame) ||
      !record(value.preStepSnapshot) ||
      !record(value.runtimeSnapshot) ||
      !Array.isArray(value.voiceIntents)
    )
      fail("CAPABILITY_UNSUPPORTED", "錄製缺少完整的 Behavior 狀態／VoiceIntent，無法重播聲音。");
    return value as unknown as AudioSnapshot;
  }
  private capturedFrame(input: RecordingFrame): RecordingFrame {
    const frame = this.frames.get(input.tick);
    if (
      !frame ||
      !same(frame, {
        tick: input.tick,
        sceneRevision: input.sceneRevision,
        runEpoch: input.runEpoch,
        poses: input.poses,
        listener: input.listener,
        physicsEvents: input.physicsEvents,
        behaviorDecisions: input.behaviorDecisions,
        audioEvents: input.audioEvents,
        acousticFrames: input.acousticFrames,
        acousticResultRefs: input.acousticResultRefs,
        ...(input.behaviorSnapshot === undefined
          ? {}
          : { behaviorSnapshot: input.behaviorSnapshot }),
      })
    )
      fail("INPUT_PROVENANCE_MISMATCH", "Replay frame 與已驗證的原錄製不同。");
    return frame;
  }

  private validate(engine: AudioEngine): void {
    if (this.validatedEngine === engine) return;
    const artifact = this.artifact!;
    const document = artifact.configuration.behaviorConfig as SoundBehaviorDocument;
    const first = artifact.frames[0]!;
    const snapshot = this.snapshot(first);
    const context = makeBehaviorContext(
      artifact.configuration.sceneSnapshot,
      snapshot.inputFrame.objects,
      this.options.getAssets(),
    );
    if (Array.isArray(artifact.configuration.materialRegistry))
      context.materialIds = artifact.configuration.materialRegistry.map(
        (material: { id: string }) => material.id,
      );
    const validator = createBehaviorRuntime(document, context, {
      experimentId: snapshot.runtimeSnapshot.state.experimentId,
      runEpoch: artifact.runEpoch,
      fixedDtSeconds: artifact.configuration.fixedDtS,
      maxVoices: 64,
      maxVoicesPerObject: 64,
    });
    this.document = document;
    for (const frame of artifact.frames) {
      const captured = this.snapshot(frame);
      const { inputFrame, runtimeSnapshot, preStepSnapshot } = captured;
      if (
        inputFrame.tick !== frame.tick ||
        inputFrame.sceneRevision !== frame.sceneRevision ||
        inputFrame.runEpoch !== frame.runEpoch ||
        runtimeSnapshot.state.tick !== frame.tick ||
        preStepSnapshot!.state.tick >= frame.tick ||
        captured.voiceIntents.length !== frame.audioEvents.length ||
        captured.voiceIntents.length > 2048
      )
        fail("INPUT_PROVENANCE_MISMATCH", "Behavior 輸入／狀態／事件與錄製時鐘不同。");
      validator.restore(preStepSnapshot!);
      validator.restore(runtimeSnapshot);
      for (const instance of runtimeSnapshot.state.instances)
        if (instance.playbackState === "playing") this.sourceFrame(frame, instance.instanceId);
      const ids = new Set<string>();
      for (let index = 0; index < captured.voiceIntents.length; index++) {
        const intent = captured.voiceIntents[index]!;
        if (!record(intent) || !audioEventValidator(intent.event))
          fail("INVALID_AUDIO_EVENT", "錄製 AudioEvent schema 無效。");
        const event = intent.event;
        const rule = this.rule(event);
        const profile = document.profiles.find((value) => value.profileId === event.profileId)!;
        const selected = profile.materialPairOverrides.find(
          (override) =>
            override.ruleId === rule.ruleId &&
            event.contact &&
            ((override.materialA === event.contact.materialA &&
              override.materialB === event.contact.materialB) ||
              (override.materialA === event.contact.materialB &&
                override.materialB === event.contact.materialA)),
        );
        const metadata = [
          ...captured.preStepSnapshot!.voiceMetadata,
          ...captured.runtimeSnapshot.voiceMetadata,
        ].find((value) => value.instanceId === event.instanceId);
        if (
          ids.has(event.eventId) ||
          !same(event, frame.audioEvents[index]) ||
          event.tick !== frame.tick ||
          event.runEpoch !== frame.runEpoch ||
          event.experimentId !== runtimeSnapshot.state.experimentId ||
          event.sceneRevision !== frame.sceneRevision ||
          event.fixedDtSeconds !== artifact.configuration.fixedDtS ||
          event.simulationTimeSeconds !== this.time(frame) ||
          intent.action !== event.action ||
          (intent.action === "start" && !rule.enabled) ||
          !same(event.trigger, rule.trigger) ||
          !same(
            intent.generator,
            intent.action === "start"
              ? (selected?.generator ?? rule.generator)
              : metadata?.generator,
          ) ||
          intent.fadeInSeconds !== rule.fadeInSeconds ||
          intent.fadeOutSeconds !== rule.fadeOutSeconds ||
          !Number.isFinite(intent.smoothingSeconds) ||
          intent.smoothingSeconds < 0 ||
          intent.smoothingSeconds > 30 ||
          (intent.filterCutoffHz !== undefined &&
            (!Number.isFinite(intent.filterCutoffHz) ||
              intent.filterCutoffHz < 20 ||
              intent.filterCutoffHz > 20000))
        )
          fail("INPUT_PROVENANCE_MISMATCH", "錄製 VoiceIntent 的來源／參數與原始文件不同。");
        ids.add(event.eventId);
        this.sourceFrame(frame, event.instanceId);
      }
      this.validateCursors(captured.preStepVoiceCursors, preStepSnapshot!);
      this.validateCursors(captured.voiceCursors, runtimeSnapshot);
    }
    this.validatedEngine = engine;
  }

  private validateCursors(cursors: unknown, snapshot: BehaviorSnapshot): void {
    if (cursors === undefined) return;
    if (!record(cursors) || Object.keys(cursors).length > 64)
      fail("INVALID_AUDIO_CURSOR", "錄製音訊 cursor 超出有界來源集合。");
    for (const [id, value] of Object.entries(cursors)) {
      const instance = snapshot.state.instances.find((item) => item.instanceId === id);
      if (
        !instance ||
        !record(value) ||
        ![value.playheadSeconds, value.elapsedSinceEmissionSeconds].every(
          (number) =>
            typeof number === "number" && Number.isFinite(number) && number >= 0 && number <= 1e9,
        ) ||
        (value.remainingDurationSeconds !== null &&
          (typeof value.remainingDurationSeconds !== "number" ||
            !Number.isFinite(value.remainingDurationSeconds) ||
            value.remainingDurationSeconds < 0 ||
            value.remainingDurationSeconds > 600)) ||
        (instance.kind === "oneShot" && value.remainingDurationSeconds === null) ||
        (value.elapsedSinceEmissionSeconds as number) >
          (snapshot.state.tick - instance.startedAtTick) * snapshot.state.fixedDtSeconds + 1e-5 ||
        (value.playheadSeconds as number) >
          (value.elapsedSinceEmissionSeconds as number) * 16 + 1e-5 ||
        (value.emissionEndElapsedSeconds !== undefined &&
          (typeof value.emissionEndElapsedSeconds !== "number" ||
            !Number.isFinite(value.emissionEndElapsedSeconds) ||
            value.emissionEndElapsedSeconds < 0 ||
            value.emissionEndElapsedSeconds > 1e9))
      )
        fail("INVALID_AUDIO_CURSOR", "錄製音訊 cursor 的時鐘或來源無效。");
    }
  }
  private rule(
    value: Pick<
      AudioEvent,
      "bindingId" | "profileId" | "profileRevision" | "ruleId" | "objectId" | "generation"
    >,
  ): SoundBehaviorRule {
    const binding = this.document!.bindings.find((entry) => entry.bindingId === value.bindingId);
    const profile = this.document!.profiles.find((entry) => entry.profileId === value.profileId);
    const rule = profile?.rules.find((entry) => entry.ruleId === value.ruleId);
    if (
      !binding ||
      !profile ||
      !rule ||
      binding.objectId !== value.objectId ||
      binding.objectGeneration !== value.generation ||
      binding.profileId !== value.profileId ||
      binding.profileRevision !== value.profileRevision ||
      profile.revision !== value.profileRevision
    )
      fail("INPUT_PROVENANCE_MISMATCH", "錄製聲源的 binding／profile／物件世代不符。");
    return effectiveRule(binding, rule);
  }
  private voiceInput(intent: VoiceIntent): VoiceInput {
    const rule = this.rule(intent.event);
    return {
      instanceId: intent.event.instanceId,
      sourceId: intent.event.instanceId,
      generator: structuredClone(intent.generator),
      gainLinear: intent.event.gainLinear,
      pitchSemitones: intent.event.pitchSemitones,
      emissionTimeSeconds: intent.event.simulationTimeSeconds,
      continuous: rule.trigger.kind === "continuous" || Boolean(rule.lifecycle),
      fadeInSeconds: intent.fadeInSeconds,
      fadeOutSeconds: intent.fadeOutSeconds,
      priority: rule.priority,
      ...(rule.oneShotDurationSeconds === undefined
        ? {}
        : { durationSeconds: rule.oneShotDurationSeconds }),
      ...(intent.filterCutoffHz === undefined ? {} : { filterCutoffHz: intent.filterCutoffHz }),
    };
  }
  private sourceFrame(frame: RecordingFrame, id: string) {
    const routes = frame.acousticFrames.filter((value) => value.sourceId === id);
    if (routes.length !== 1)
      fail("ACOUSTIC_FRAME_UNAVAILABLE", "錄製聲源必須對應唯一同 tick 的聲學路由。");
    return routes[0]!;
  }
  private route(frame: RecordingFrame, engine: AudioEngine): void {
    for (const acoustic of frame.acousticFrames) engine.updateFrame(acoustic);
    const [x, y, z, w] = frame.listener.orientationQuaternion;
    engine.updateListener({
      positionM: [...frame.listener.positionM],
      forward: [-2 * (x * z + w * y), -2 * (y * z - w * x), 2 * (x * x + y * y) - 1],
      up: [2 * (x * y - w * z), 1 - 2 * (x * x + z * z), 2 * (y * z + w * x)],
    });
  }

  private restore(
    frame: RecordingFrame,
    snapshot: BehaviorSnapshot,
    engine: AudioEngine,
    first = false,
  ): void {
    const captured = this.snapshot(frame);
    const pending: Parameters<AudioEngine["restoreVoiceAtCursor"]>[] = [];
    for (const old of snapshot.state.instances) {
      // Seek cuts old tails. Normal pause uses AudioEngine's frozen-arrival queue.
      if (old.playbackState !== "playing") continue;
      const instance = first
        ? captured.runtimeSnapshot.state.instances.find(
            (value) => value.instanceId === old.instanceId,
          )
        : old;
      if (!instance || instance.playbackState !== "playing") continue;
      const metadata = snapshot.voiceMetadata.find((value) => value.instanceId === old.instanceId)!;
      const rule = this.rule(instance);
      const cursor = this.cursor(frame, instance, metadata.generator, rule);
      pending.push([
        {
          instanceId: instance.instanceId,
          sourceId: instance.instanceId,
          generator: structuredClone(metadata.generator),
          gainLinear: first ? old.gainLinear : instance.gainLinear,
          pitchSemitones: first ? old.pitchSemitones : instance.pitchSemitones,
          emissionTimeSeconds: this.time(frame),
          continuous: instance.kind === "continuous",
          fadeInSeconds: 0,
          fadeOutSeconds: rule.fadeOutSeconds,
          priority: rule.priority,
          ...(rule.oneShotDurationSeconds === undefined
            ? {}
            : { durationSeconds: rule.oneShotDurationSeconds }),
          ...(metadata.filterCutoffHz === null ? {} : { filterCutoffHz: metadata.filterCutoffHz }),
        },
        this.sourceFrame(frame, instance.instanceId),
        {
          ...cursor,
          restorePendingArrivals: true,
        },
      ]);
    }
    for (const arguments_ of pending) engine.restoreVoiceAtCursor(...arguments_);
  }
  private cursor(
    frame: RecordingFrame,
    instance: SoundInstance,
    generator: SoundGenerator,
    rule: SoundBehaviorRule,
  ): CapturedCursor {
    const supplied = this.snapshot(frame).voiceCursors?.[instance.instanceId];
    if (supplied) return supplied;
    // A logical Behavior playhead is not a pitch-integrated source cursor. Without
    // a captured cursor, only constant authored pitch can be reconstructed exactly.
    if (rule.mappings.some((mapping) => mapping.target === "pitchSemitones"))
      fail(
        "AUDIO_CURSOR_UNAVAILABLE",
        "Pitch mapping 的錄製缺少真正 source cursor，無法精確恢復聲音相位。",
      );
    const elapsed = (frame.tick - instance.startedAtTick) * this.artifact!.configuration.fixedDtS;
    const rate = 2 ** (instance.pitchSemitones / 12);
    const sourceElapsed =
      rule.oneShotDurationSeconds === undefined
        ? elapsed
        : Math.min(elapsed, rule.oneShotDurationSeconds);
    let position = sourceElapsed * rate;
    let remaining: number | null = rule.lifecycle
      ? Math.max(0, rule.lifecycle.maxDurationSeconds - elapsed)
      : rule.oneShotDurationSeconds === undefined
        ? null
        : Math.max(0, rule.oneShotDurationSeconds - elapsed);
    if (generator.kind === "sample" && !generator.loop) {
      const asset = this.options
        .getAssets()
        .find(
          (value) =>
            value.assetId === generator.asset.assetId &&
            value.revision === generator.asset.revision,
        )!;
      position = Math.min(position, (asset.durationSeconds ?? 0) - generator.startOffsetSeconds);
      const contentRemaining = Math.max(
        0,
        ((asset.durationSeconds ?? 0) - generator.startOffsetSeconds - position) / rate,
      );
      remaining = remaining === null ? contentRemaining : Math.min(remaining, contentRemaining);
    }
    return {
      playheadSeconds: position,
      elapsedSinceEmissionSeconds: elapsed,
      remainingDurationSeconds: remaining,
    };
  }
}
