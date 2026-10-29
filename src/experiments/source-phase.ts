import type { SoundBehaviorDocument, SoundInstance } from "../../schemas/sound-behavior/types.js";
import { createBehaviorRuntime } from "../audio-behavior/index.js";
import type {
  BehaviorAsset,
  BehaviorFrame,
  BehaviorRuntime,
  BehaviorSnapshot,
  VoiceIntent,
} from "../audio-behavior/types.js";
import {
  audioEventValidator,
  contactValidator,
  generatorValidator,
  stateValidator,
} from "../audio-behavior/profile-registry.js";
import { canonicalStringify } from "./hash.js";
import { stableHash } from "../physics/math.js";
import type { RecordingConfiguration, RecordingFrame, SourcePhaseEvidence } from "./types.js";

const NATIVE_MODEL = "AudioEngineEpochMappedSourceCursor; not hardware PCM read pointer";
const LOGICAL_MODEL =
  "NOT_RENDERED: logical behavior state only; no native PCM cursor or audio playback evidence";
const volatileEventFields = new Set([
  "eventId",
  "instanceId",
  "experimentId",
  "runEpoch",
  "sceneRevision",
]);
const discreteEvents = new Set([
  "OnGrab",
  "OnRelease",
  "OnThrow",
  "OnDrop",
  "OnImpact",
  "OnBounce",
  "OnStartMoving",
  "OnStopMoving",
  "OnSleep",
  "OnWake",
  "OnEnterZone",
  "OnExitZone",
]);
const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const integer = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 0;
const finite = (value: unknown, maximum = 1e9): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= maximum;
const id = (value: unknown): value is string =>
  typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(value);
const without = (
  value: Record<string, unknown>,
  excluded: ReadonlySet<string>,
): Record<string, unknown> =>
  Object.fromEntries(Object.entries(value).filter(([key]) => !excluded.has(key)));
const compare = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
class ProofGap extends Error {}
function need(condition: unknown, reason: string): asserts condition {
  if (!condition) throw new ProofGap(reason);
}
interface Identity {
  key: string;
  startedAtTick: number;
  kind: SoundInstance["kind"];
  startEventId: string | null;
}
interface Stage {
  snapshot: BehaviorSnapshot;
  identities: Map<string, Identity>;
  normalized: unknown;
}

/** Content evidence only. This never derives a native PCM cursor from logical age. */
export function normalizeSourcePhase(
  configuration: RecordingConfiguration,
  frames: readonly RecordingFrame[],
): { evidence: SourcePhaseEvidence; trace: unknown } {
  const history = new Map<string, Identity>();
  const semanticHistory = new Map<string, string>();
  const trace: unknown[] = [];
  let missing: string | null = null;
  let sawSource = false;
  let sawNative = false;
  let nativeComplete = true;
  let frameNewIds: string[] = [];
  let evaluator: { key: string; runtime: BehaviorRuntime } | null = null;
  let previousPost: { tick: number; sources: Set<string> } | null = null;

  const transition = (
    captured: Record<string, unknown>,
    frame: RecordingFrame,
    pre: Stage,
    post: Stage,
  ): void => {
    const document = configuration.behaviorConfig;
    need(record(document) && Array.isArray(document.assets), "SOURCE_BEHAVIOR_DOCUMENT_MISSING");
    const input = captured.inputFrame;
    need(
      record(input) &&
        Array.isArray(input.objects) &&
        input.objects.length === configuration.sceneSnapshot.objects.length &&
        input.objects.length <= 256,
      "SOURCE_INPUT_OBJECTS_MISSING",
    );
    const objects: { objectId: string; generation: number }[] = [];
    const seen = new Set<string>();
    for (const object of input.objects) {
      need(
        record(object) &&
          id(object.objectId) &&
          integer(object.generation) &&
          object.generation >= 1 &&
          !seen.has(object.objectId) &&
          configuration.sceneSnapshot.objects.some((entry) => entry.id === object.objectId),
        "SOURCE_INPUT_GENERATION_INVALID",
      );
      const pose = frame.poses.find((entry) => entry.objectId === object.objectId);
      need(
        pose &&
          canonicalStringify(object.positionMetres) === canonicalStringify(pose.positionM) &&
          (object.rotation === undefined ||
            canonicalStringify(object.rotation) === canonicalStringify(pose.orientationQuaternion)),
        "SOURCE_INPUT_POSE_MISMATCH",
      );
      need(
        object.lifecycle !== "deleted" && object.lifecycle !== "preview",
        "SOURCE_INPUT_PERSISTENCE_MISMATCH",
      );
      if (pose.linearVelocityMps !== undefined)
        need(
          record(object.metrics) &&
            finite(object.metrics.sourceSpeedMetresPerSecond) &&
            Math.abs(
              object.metrics.sourceSpeedMetresPerSecond - Math.hypot(...pose.linearVelocityMps),
            ) <= 1e-9,
          "SOURCE_INPUT_VELOCITY_MISMATCH",
        );
      if (pose.angularVelocityRadps !== undefined)
        need(
          record(object.metrics) &&
            finite(object.metrics.angularSpeedRadiansPerSecond) &&
            Math.abs(
              object.metrics.angularSpeedRadiansPerSecond -
                Math.hypot(...pose.angularVelocityRadps),
            ) <= 1e-9,
          "SOURCE_INPUT_VELOCITY_MISMATCH",
        );
      if (pose.sleeping !== undefined)
        need(
          record(object.states) && object.states.sleeping === pose.sleeping,
          "SOURCE_INPUT_SLEEP_MISMATCH",
        );
      seen.add(object.objectId);
      objects.push({ objectId: object.objectId, generation: object.generation });
    }
    need(
      Array.isArray(input.events) &&
        input.events.length <= 2048 &&
        frame.physicsEvents.length <= 2048,
      "SOURCE_INPUT_EVENTS_MISSING",
    );
    const coreEvent = (event: unknown): Record<string, unknown> => {
      need(
        record(event) &&
          id(event.eventId) &&
          integer(event.tick) &&
          integer(event.sequence) &&
          id(event.objectId) &&
          integer(event.generation) &&
          typeof event.type === "string" &&
          discreteEvents.has(event.type) &&
          typeof event.source === "string" &&
          typeof event.accepted === "boolean",
        "SOURCE_INPUT_EVENT_WITNESS_MISSING",
      );
      return {
        eventId: event.eventId,
        tick: event.tick,
        sequence: event.sequence,
        objectId: event.objectId,
        generation: event.generation,
        type: event.type,
        source: event.source,
        accepted: event.accepted,
        ...(event.commandId === undefined ? {} : { commandId: event.commandId }),
        ...(event.contact === undefined ? {} : { contact: event.contact }),
      };
    };
    const rawEvents = frame.physicsEvents.filter(
      (event) => record(event) && typeof event.type === "string" && discreteEvents.has(event.type),
    );
    need(
      canonicalStringify(rawEvents.map(coreEvent)) ===
        canonicalStringify(input.events.map(coreEvent)),
      "SOURCE_INPUT_EVENTS_MISMATCH",
    );
    for (const event of input.events) {
      need(record(event), "SOURCE_INPUT_EVENTS_MISSING");
      if (event.accepted === true && pre.snapshot.state.tick < frame.tick)
        need(
          !pre.snapshot.state.processedEventIds.includes(event.eventId as string),
          "SOURCE_INPUT_EVENT_ALREADY_PROCESSED",
        );
    }
    const assets: BehaviorAsset[] = [];
    for (const pin of document.assets) {
      need(
        record(pin) && Array.isArray(configuration.assetManifest),
        "SOURCE_ASSET_CONTEXT_UNAVAILABLE",
      );
      const candidates = configuration.assetManifest.filter(
        (entry: unknown) =>
          record(entry) &&
          entry.assetId === pin.assetId &&
          entry.revision === pin.revision &&
          entry.sha256 === pin.sha256 &&
          entry.availability === "READY" &&
          entry.rightsStatus === "APPROVED" &&
          finite(entry.durationSeconds, 600) &&
          entry.durationSeconds > 0,
      );
      need(
        candidates.length === 1 &&
          record(candidates[0]) &&
          id(pin.assetId) &&
          integer(pin.revision) &&
          typeof pin.sha256 === "string",
        "SOURCE_ASSET_CONTEXT_UNAVAILABLE",
      );
      assets.push({
        assetId: pin.assetId,
        revision: pin.revision,
        sha256: pin.sha256,
        availability: "READY",
        rightsStatus: "APPROVED",
        durationSeconds: candidates[0].durationSeconds as number,
      });
    }
    const key = canonicalStringify({
      objects,
      experimentId: pre.snapshot.state.experimentId,
      runEpoch: frame.runEpoch,
      randomSeed: pre.snapshot.state.randomSeed,
    });
    if (!evaluator || evaluator.key !== key) {
      const materialIds = new Set(
        configuration.sceneSnapshot.objects.map((object) => object.physicsMaterialId),
      );
      if (Array.isArray(configuration.materialRegistry)) {
        for (const material of configuration.materialRegistry)
          if (record(material) && id(material.id)) materialIds.add(material.id);
      }
      try {
        evaluator = {
          key,
          runtime: createBehaviorRuntime(
            document as unknown as SoundBehaviorDocument,
            {
              sceneRevision: frame.sceneRevision,
              objects,
              materialIds: [...materialIds],
              colliders: configuration.sceneSnapshot.objects.map((object) => ({
                objectId: object.id,
                colliderId: `col-${stableHash(object.id)}`,
              })),
              zoneIds: [],
              assetRegistry: assets,
              validationMode: "product",
            },
            {
              experimentId: pre.snapshot.state.experimentId,
              runEpoch: frame.runEpoch,
              fixedDtSeconds: configuration.fixedDtS,
              randomSeed: pre.snapshot.state.randomSeed,
              maxVoices: 16,
              maxVoicesPerObject: 8,
            },
          ),
        };
      } catch {
        evaluator = null;
        throw new ProofGap("SOURCE_TRANSITION_CONTEXT_UNAVAILABLE");
      }
    }
    const cooldowns = (snapshot: BehaviorSnapshot): void => {
      need(
        Array.isArray(document.bindings) && Array.isArray(document.profiles),
        "SOURCE_BEHAVIOR_DOCUMENT_MISSING",
      );
      for (const state of snapshot.state.bindings) {
        const binding = document.bindings.find(
          (entry: unknown) => record(entry) && entry.bindingId === state.bindingId,
        );
        need(record(binding), "SOURCE_BINDING_INVALID");
        const profile = document.profiles.find(
          (entry: unknown) => record(entry) && entry.profileId === binding.profileId,
        );
        need(record(profile) && Array.isArray(profile.rules), "SOURCE_BINDING_INVALID");
        const seenRules = new Set<string>();
        for (const cooldown of state.cooldowns) {
          const rule = profile.rules.find(
            (entry: unknown) => record(entry) && entry.ruleId === cooldown.ruleId,
          );
          need(
            record(rule) &&
              finite(rule.cooldownSeconds, 30) &&
              !seenRules.has(cooldown.ruleId) &&
              cooldown.rearmAtTick > snapshot.state.tick &&
              cooldown.rearmAtTick <=
                snapshot.state.tick + Math.ceil(rule.cooldownSeconds / configuration.fixedDtS),
            "SOURCE_COOLDOWN_INVALID",
          );
          seenRules.add(cooldown.ruleId);
        }
      }
    };
    cooldowns(pre.snapshot);
    cooldowns(post.snapshot);
    try {
      evaluator.runtime.restore(structuredClone(pre.snapshot));
      const result = evaluator.runtime.step(structuredClone(input) as unknown as BehaviorFrame);
      need(
        canonicalStringify(evaluator.runtime.snapshot()) === canonicalStringify(post.snapshot) &&
          canonicalStringify(result.voices) === canonicalStringify(captured.voiceIntents) &&
          canonicalStringify(result.events) === canonicalStringify(frame.audioEvents),
        "SOURCE_TRANSITION_MISMATCH",
      );
    } catch (error) {
      evaluator = null;
      if (error instanceof ProofGap) throw error;
      throw new ProofGap("SOURCE_TRANSITION_INVALID");
    }
  };

  const register = (rawId: string, identity: Identity): void => {
    need(history.size < 100000 || history.has(rawId), "SOURCE_IDENTITY_BUDGET");
    const previous = history.get(rawId);
    need(!previous || previous.key === identity.key, "SOURCE_IDENTITY_REUSED");
    need(
      !semanticHistory.has(identity.key) || semanticHistory.get(identity.key) === rawId,
      "SOURCE_IDENTITY_CHANGED",
    );
    if (!previous) {
      history.set(rawId, identity);
      semanticHistory.set(identity.key, rawId);
      frameNewIds.push(rawId);
    }
  };
  const makeIdentity = (
    instance: Pick<
      SoundInstance,
      "bindingId" | "profileId" | "ruleId" | "objectId" | "generation" | "kind" | "startedAtTick"
    >,
    startEventId: string | null,
  ): Identity => ({
    key: canonicalStringify([
      instance.bindingId,
      instance.profileId,
      instance.ruleId,
      instance.objectId,
      instance.generation,
      instance.kind,
      instance.startedAtTick,
      startEventId,
    ]),
    kind: instance.kind,
    startedAtTick: instance.startedAtTick,
    startEventId,
  });
  const stage = (raw: unknown, frame: RecordingFrame, post: boolean): Stage => {
    need(
      record(raw) && raw.schemaVersion === "1.0.0" && record(raw.state),
      "SOURCE_SNAPSHOT_MISSING",
    );
    need(stateValidator(raw.state), "SOURCE_STATE_INVALID");
    const snapshot = raw as unknown as BehaviorSnapshot;
    const state = snapshot.state;
    const initialTickZero =
      state.tick === 0 &&
      frame.tick === 0 &&
      state.sequence === 0 &&
      state.instances.length === 0 &&
      state.processedEventIds.length === 0 &&
      snapshot.inputCursor === null &&
      snapshot.paused === false &&
      snapshot.requiresNewEpoch === false &&
      Array.isArray(snapshot.voiceMetadata) &&
      snapshot.voiceMetadata.length === 0 &&
      state.bindings.every(
        (binding) => binding.activeRuleIds.length === 0 && binding.cooldowns.length === 0,
      );
    need(
      state.instances.length <= 16 &&
        state.bindings.length <= 1024 &&
        state.processedEventIds.length <= 4096,
      "SOURCE_STATE_BUDGET",
    );
    need(
      state.runEpoch === frame.runEpoch &&
        state.sceneRevision === frame.sceneRevision &&
        state.fixedDtSeconds === configuration.fixedDtS &&
        (post ? state.tick === frame.tick : state.tick < frame.tick || initialTickZero),
      "SOURCE_STATE_CLOCK",
    );
    need(
      typeof snapshot.paused === "boolean" && typeof snapshot.requiresNewEpoch === "boolean",
      "SOURCE_STATE_FLAGS",
    );
    need(
      snapshot.inputCursor === null ||
        (record(snapshot.inputCursor) &&
          integer(snapshot.inputCursor.tick) &&
          snapshot.inputCursor.tick <= state.tick &&
          integer(snapshot.inputCursor.sequence) &&
          id(snapshot.inputCursor.eventId)),
      "SOURCE_EVENT_CURSOR",
    );
    need(
      Array.isArray(snapshot.voiceMetadata) &&
        snapshot.voiceMetadata.length === state.instances.length,
      "SOURCE_METADATA_MISSING",
    );
    const metadata = new Map<string, BehaviorSnapshot["voiceMetadata"][number]>();
    for (const entry of snapshot.voiceMetadata) {
      need(
        record(entry) &&
          id(entry.instanceId) &&
          !metadata.has(entry.instanceId) &&
          generatorValidator(entry.generator) &&
          (entry.expiresAtTick === null || integer(entry.expiresAtTick)) &&
          (entry.releaseAtTick === null || integer(entry.releaseAtTick)) &&
          finite(entry.priority, 1000000) &&
          (entry.filterCutoffHz === null ||
            (finite(entry.filterCutoffHz, 20000) && entry.filterCutoffHz >= 20)) &&
          (entry.startEventId === null || id(entry.startEventId)) &&
          (entry.lastContact === null || contactValidator(entry.lastContact)),
        "SOURCE_METADATA_INVALID",
      );
      metadata.set(entry.instanceId, entry);
    }
    const identities = new Map<string, Identity>();
    const semanticKeys = new Set<string>();
    const sources: { identity: string; instance: unknown; metadata: unknown }[] = [];
    for (const instance of state.instances) {
      const entry = metadata.get(instance.instanceId);
      need(
        entry &&
          !identities.has(instance.instanceId) &&
          configuration.sceneSnapshot.objects.some((object) => object.id === instance.objectId),
        "SOURCE_INSTANCE_INVALID",
      );
      need(
        instance.startedAtTick <= state.tick &&
          instance.playheadSeconds <=
            (state.tick - instance.startedAtTick) * state.fixedDtSeconds + 1e-5,
        "SOURCE_LOGICAL_PHASE_INVALID",
      );
      const identity = makeIdentity(instance, entry.startEventId);
      need(!semanticKeys.has(identity.key), "SOURCE_IDENTITY_AMBIGUOUS");
      semanticKeys.add(identity.key);
      identities.set(instance.instanceId, identity);
      register(instance.instanceId, identity);
      sources.push({
        identity: identity.key,
        instance: without(instance as unknown as Record<string, unknown>, new Set(["instanceId"])),
        metadata: without(entry as unknown as Record<string, unknown>, new Set(["instanceId"])),
      });
    }
    const bindingIds = new Set<string>();
    for (const binding of state.bindings) {
      need(!bindingIds.has(binding.bindingId), "SOURCE_BINDING_DUPLICATE");
      bindingIds.add(binding.bindingId);
    }
    return {
      snapshot,
      identities,
      normalized: {
        tick: state.tick,
        fixedDtSeconds: state.fixedDtSeconds,
        sequence: state.sequence,
        documentId: state.documentId,
        documentRevision: state.documentRevision,
        randomSeed: state.randomSeed,
        paused: snapshot.paused,
        requiresNewEpoch: snapshot.requiresNewEpoch,
        inputCursor: snapshot.inputCursor,
        bindings: [...state.bindings].sort((a, b) => compare(a.bindingId, b.bindingId)),
        processedEventIds: state.processedEventIds,
        sources: sources.sort((a, b) => compare(a.identity, b.identity)),
      },
    };
  };
  const kindFor = (intent: VoiceIntent): SoundInstance["kind"] => {
    if (intent.event.trigger.kind === "continuous") return "continuous";
    const document = configuration.behaviorConfig;
    need(record(document) && Array.isArray(document.profiles), "SOURCE_RULE_LIFECYCLE_MISSING");
    const profile = document.profiles.find(
      (entry: unknown) => record(entry) && entry.profileId === intent.event.profileId,
    );
    need(record(profile) && Array.isArray(profile.rules), "SOURCE_RULE_LIFECYCLE_MISSING");
    const rule = profile.rules.find(
      (entry: unknown) => record(entry) && entry.ruleId === intent.event.ruleId,
    );
    need(record(rule), "SOURCE_RULE_LIFECYCLE_MISSING");
    return rule.lifecycle === undefined ? "oneShot" : "continuous";
  };
  const native = (value: unknown, current: Stage): { value: unknown; count: number } => {
    if (value === undefined) return { value: { presence: "missing" }, count: 0 };
    need(record(value) && Object.keys(value).length <= 16, "NATIVE_CURSOR_BUDGET");
    const entries: { identity: string; cursor: unknown }[] = [];
    for (const [rawId, cursor] of Object.entries(value)) {
      const identity = current.identities.get(rawId);
      const instance = current.snapshot.state.instances.find((entry) => entry.instanceId === rawId);
      need(
        identity &&
          instance &&
          record(cursor) &&
          Object.keys(cursor).every((key) =>
            [
              "playheadSeconds",
              "elapsedSinceEmissionSeconds",
              "remainingDurationSeconds",
              "emissionEndElapsedSeconds",
            ].includes(key),
          ) &&
          finite(cursor.playheadSeconds) &&
          finite(cursor.elapsedSinceEmissionSeconds) &&
          (cursor.remainingDurationSeconds === null ||
            finite(cursor.remainingDurationSeconds, 600)) &&
          (instance.kind !== "oneShot" || cursor.remainingDurationSeconds !== null) &&
          cursor.elapsedSinceEmissionSeconds <=
            (current.snapshot.state.tick - instance.startedAtTick) *
              current.snapshot.state.fixedDtSeconds +
              1e-5 &&
          cursor.playheadSeconds <= cursor.elapsedSinceEmissionSeconds * 16 + 1e-5 &&
          (cursor.emissionEndElapsedSeconds === undefined ||
            finite(cursor.emissionEndElapsedSeconds)),
        "NATIVE_CURSOR_INVALID",
      );
      entries.push({ identity: identity.key, cursor });
    }
    entries.sort((a, b) => compare(a.identity, b.identity));
    return { value: { presence: "present", entries }, count: entries.length };
  };

  if (!Array.isArray(frames) || frames.length === 0 || frames.length > 18000) {
    return {
      evidence: { evidenceClass: "missing", reason: "SOURCE_TRACE_MISSING" },
      trace: { model: "content-and-cursors-v2", frames: [] },
    };
  }
  for (const frame of frames) {
    frameNewIds = [];
    try {
      const captured = frame.behaviorSnapshot;
      need(
        record(captured) &&
          record(captured.inputFrame) &&
          captured.inputFrame.tick === frame.tick &&
          captured.inputFrame.runEpoch === frame.runEpoch &&
          captured.inputFrame.sceneRevision === frame.sceneRevision,
        "SOURCE_INPUT_FRAME_MISSING",
      );
      const pre = stage(captured.preStepSnapshot, frame, false);
      const post = stage(captured.runtimeSnapshot, frame, true);
      if (previousPost) {
        need(previousPost.tick + 1 === frame.tick, "SOURCE_TRACE_TICK_GAP");
        need(
          [...pre.identities.values()].every((identity) => previousPost!.sources.has(identity.key)),
          "SOURCE_PRESTATE_CONTINUITY",
        );
      }
      need(
        pre.snapshot.state.documentId === post.snapshot.state.documentId &&
          pre.snapshot.state.documentRevision === post.snapshot.state.documentRevision &&
          pre.snapshot.state.experimentId === post.snapshot.state.experimentId,
        "SOURCE_DOCUMENT_CHANGED",
      );
      need(
        Array.isArray(captured.voiceIntents) &&
          captured.voiceIntents.length <= 2048 &&
          captured.voiceIntents.length === frame.audioEvents.length,
        "SOURCE_INTENTS_MISSING",
      );
      const intents = captured.voiceIntents as VoiceIntent[];
      const union = new Map([...pre.identities, ...post.identities]);
      for (let index = 0; index < intents.length; index++) {
        const intent = intents[index]!;
        need(
          record(intent) &&
            ["start", "update", "stop"].includes(intent.action) &&
            audioEventValidator(intent.event) &&
            intent.action === intent.event.action &&
            intent.event.tick === frame.tick &&
            intent.event.runEpoch === frame.runEpoch &&
            intent.event.sceneRevision === frame.sceneRevision &&
            intent.event.fixedDtSeconds === configuration.fixedDtS &&
            intent.event.simulationTimeSeconds === frame.tick * configuration.fixedDtS &&
            generatorValidator(intent.generator) &&
            finite(intent.fadeInSeconds, 30) &&
            finite(intent.fadeOutSeconds, 30) &&
            finite(intent.smoothingSeconds, 30) &&
            (intent.filterCutoffHz === undefined ||
              (finite(intent.filterCutoffHz, 20000) && intent.filterCutoffHz >= 20)) &&
            (intent.expiresAtTick === undefined || integer(intent.expiresAtTick)) &&
            canonicalStringify(intent.event) === canonicalStringify(frame.audioEvents[index]),
          "SOURCE_INTENT_INVALID",
        );
        if (intent.action === "start") {
          const event = intent.event;
          need(
            configuration.sceneSnapshot.objects.some((object) => object.id === event.objectId),
            "SOURCE_OWNER_MISSING",
          );
          if (event.trigger.kind === "discrete") {
            need(
              Array.isArray(captured.inputFrame.events) &&
                captured.inputFrame.events.some(
                  (input: unknown) =>
                    record(input) &&
                    input.eventId === event.parentPhysicsEventId &&
                    input.tick === frame.tick &&
                    input.objectId === event.objectId &&
                    input.generation === event.generation &&
                    input.type === event.trigger.type &&
                    input.accepted === true,
                ),
              "SOURCE_INPUT_ORIGIN_MISSING",
            );
          }
          const identity = makeIdentity(
            { ...event, kind: kindFor(intent), startedAtTick: event.tick },
            event.parentPhysicsEventId ?? null,
          );
          const known = union.get(event.instanceId);
          need(!known || known.key === identity.key, "SOURCE_START_IDENTITY_INVALID");
          register(event.instanceId, identity);
          union.set(event.instanceId, identity);
        }
      }
      const commands: unknown[] = [];
      const frameSemanticIds = new Map<string, string>();
      for (const [rawId, identity] of union) {
        need(
          !frameSemanticIds.has(identity.key) || frameSemanticIds.get(identity.key) === rawId,
          "SOURCE_IDENTITY_AMBIGUOUS",
        );
        frameSemanticIds.set(identity.key, rawId);
      }
      for (const intent of intents) {
        const identity = union.get(intent.event.instanceId);
        need(identity, "SOURCE_ORIGIN_MISSING");
        const eventIdentity = makeIdentity(
          { ...intent.event, kind: identity.kind, startedAtTick: identity.startedAtTick },
          identity.startEventId,
        );
        need(eventIdentity.key === identity.key, "SOURCE_COMMAND_IDENTITY_INVALID");
        commands.push({
          identity: identity.key,
          ...without(intent as unknown as Record<string, unknown>, new Set(["event"])),
          event: without(intent.event as unknown as Record<string, unknown>, volatileEventFields),
        });
      }
      need(
        frame.acousticFrames.every((acoustic: RecordingFrame["acousticFrames"][number]) =>
          union.has(acoustic.sourceId),
        ),
        "SOURCE_ACOUSTIC_ORIGIN_MISSING",
      );
      transition(captured, frame, pre, post);
      const preCursors = native(captured.preStepVoiceCursors, pre);
      const postCursors = native(captured.voiceCursors, post);
      const hasCursorRecords =
        captured.preStepVoiceCursors !== undefined || captured.voiceCursors !== undefined;
      const count = preCursors.count + postCursors.count;
      need(
        captured.cursorModel === undefined ||
          captured.cursorModel === NATIVE_MODEL ||
          captured.cursorModel === LOGICAL_MODEL,
        "NATIVE_CURSOR_MODEL_UNKNOWN",
      );
      need(
        !hasCursorRecords ||
          captured.cursorModel === NATIVE_MODEL ||
          (captured.cursorModel === LOGICAL_MODEL && count === 0),
        "NATIVE_CURSOR_MODEL_UNKNOWN",
      );
      const hasSources = union.size > 0 || intents.length > 0;
      sawSource ||= hasSources;
      sawNative ||= count > 0;
      nativeComplete &&=
        preCursors.count === pre.identities.size &&
        postCursors.count === post.identities.size &&
        [...union.keys()].every((rawId) => pre.identities.has(rawId) || post.identities.has(rawId));
      nativeComplete &&= intents.every(
        (intent) =>
          pre.identities.has(intent.event.instanceId) ||
          post.identities.has(intent.event.instanceId),
      );
      trace.push({
        tick: frame.tick,
        input: without(captured.inputFrame, new Set(["runEpoch", "sceneRevision"])),
        pre: pre.normalized,
        post: post.normalized,
        commands,
        native: {
          model:
            captured.cursorModel === undefined
              ? { presence: "missing" }
              : { presence: "present", value: captured.cursorModel },
          pre: preCursors.value,
          post: postCursors.value,
        },
      });
      previousPost = {
        tick: frame.tick,
        sources: new Set([...post.identities.values()].map((identity) => identity.key)),
      };
    } catch (error) {
      evaluator = null;
      previousPost = null;
      for (const key of frameNewIds) {
        const identity = history.get(key);
        if (identity) semanticHistory.delete(identity.key);
        history.delete(key);
      }
      const reason = error instanceof ProofGap ? error.message : "SOURCE_PHASE_INVALID";
      missing ??= reason;
      trace.push({
        tick: frame.tick,
        missing: reason,
        captured: frame.behaviorSnapshot ?? null,
        audioEvents: frame.audioEvents,
      });
    }
  }
  const evidence: SourcePhaseEvidence =
    missing !== null
      ? { evidenceClass: "missing", reason: missing }
      : !sawSource
        ? { evidenceClass: "silent", reason: null }
        : sawNative && nativeComplete
          ? { evidenceClass: "nativeEpoch", reason: null }
          : {
              evidenceClass: "logicalIntent",
              reason: sawNative ? "NATIVE_CURSOR_PARTIAL" : "LOGICAL_INTENT_ONLY",
            };
  return { evidence, trace: { model: "content-and-cursors-v2", frames: trace } };
}
