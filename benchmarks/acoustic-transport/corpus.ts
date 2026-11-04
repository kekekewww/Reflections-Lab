import { buildAcousticRequests } from "../../src/app/acoustic-input.js";
import { behaviorAcousticSource } from "../../src/app/behavior-acoustic-source.js";
import type { AcousticInput, AcousticPose } from "../../src/app/acoustic-input.js";
import type { AcousticMaterial, AcousticRequest, Atmosphere } from "../../src/acoustics/types.js";
import type { SceneSpec } from "../../src/scene/types.js";
import type { PhysicsSnapshot } from "../../src/physics/types.js";
import type { SoundBehaviorDocument } from "../../schemas/sound-behavior/types.js";

type Emission = Parameters<typeof behaviorAcousticSource>[1];
type Endpoint = AcousticInput["listener"];
export interface RuntimeForCorpus {
  scene: SceneSpec;
  latest: PhysicsSnapshot;
  document: SoundBehaviorDocument;
  atmosphere: Atmosphere;
  runEpoch: string;
  activeVoices: Map<string, { event: Emission }>;
  listener(): Endpoint;
  requests(
    poses?: readonly AcousticPose[],
    events?: readonly Emission[],
    scene?: SceneSpec,
    listener?: Endpoint,
  ): AcousticRequest[];
  onTick(snapshot: PhysicsSnapshot): void;
  behavior: { step(frame: unknown): { events: unknown[] } };
}
export type ExpectedRequests =
  | { ok: true; requests: AcousticRequest[] }
  | { ok: false; name: string; code: string | null; message: string };
export interface CorpusRow {
  id: string;
  group: string;
  phase: string;
  tick: number;
  runEpoch: string;
  callScope: "default-live" | "explicit-event-batch";
  sourceEvents: readonly Emission[];
  input: AcousticInput;
  expected: ExpectedRequests;
  clearCacheBefore?: boolean;
}
export interface CorpusState {
  schemaVersion: "acoustic-component-corpus/1";
  origin: string;
  phase: string;
  invalid: string | null;
  observedRequestCalls: number;
  diagnosticCallsNotSampled: number;
  rows: CorpusRow[];
  controls: unknown[];
  physicsEvents: unknown[];
  audioEvents: unknown[];
}
export function errorIdentity(error: unknown): Exclude<ExpectedRequests, { ok: true }> {
  const value = error as { name?: unknown; code?: unknown; message?: unknown };
  return {
    ok: false,
    name: typeof value?.name === "string" ? value.name : "Error",
    code: typeof value?.code === "string" ? value.code : null,
    message: typeof value?.message === "string" ? value.message : String(error),
  };
}
/** Compare data and graph aliasing, including signed zero/undefined; do not JSON-normalize the oracle. */
export function exactDataEqual(left: unknown, right: unknown): boolean {
  const forward = new Map<object, object>(),
    reverse = new Map<object, object>();
  const compare = (a: unknown, b: unknown): boolean => {
    if (Object.is(a, b)) return true;
    if (
      a === null ||
      b === null ||
      typeof a !== "object" ||
      typeof b !== "object" ||
      Array.isArray(a) !== Array.isArray(b)
    )
      return false;
    if (forward.has(a)) return forward.get(a) === b;
    if (reverse.has(b)) return false;
    forward.set(a, b);
    reverse.set(b, a);
    if (Array.isArray(a) && Array.isArray(b) && a.length !== b.length) return false;
    const aKeys = Object.keys(a).sort(),
      bKeys = Object.keys(b).sort();
    if (aKeys.length !== bKeys.length || aKeys.some((key, index) => key !== bKeys[index]))
      return false;
    const aRecord = a as Record<string, unknown>,
      bRecord = b as Record<string, unknown>;
    return aKeys.every((key) => compare(aRecord[key], bRecord[key]));
  };
  return compare(left, right);
}
export function resolvedRuntimeInput(
  runtime: RuntimeForCorpus,
  materials: readonly AcousticMaterial[],
  poses = runtime.latest.poses as readonly AcousticPose[],
  events: readonly Emission[] = [...runtime.activeVoices.values()].map((voice) => voice.event),
  scene = runtime.scene,
  listener = runtime.listener(),
  mapper = behaviorAcousticSource,
): AcousticInput {
  const poseMap = new Map(poses.map((pose) => [pose.objectId, pose]));
  const sources = events.length
    ? events.map((event) => mapper(runtime.document, event))
    : scene.sources
        .filter((source) => source.playing)
        .map((source) => {
          const pose = poseMap.get(source.objectId);
          const position = pose
            ? "positionMetres" in pose
              ? pose.positionMetres
              : pose.positionM
            : scene.objects.find((object) => object.id === source.objectId)!.positionM;
          return { id: `preview.${source.id}`, objectId: source.objectId, positionM: position };
        });
  return structuredClone({
    scene,
    poses,
    sources,
    listener,
    tick: runtime.latest.tick,
    materials,
    atmosphere: runtime.atmosphere,
    budget: { maxPaths: 8, maxSurfaces: 256, maxSegmentTests: 10000 },
  });
}
/** Diagnostic sidecar only: original requests/events/return/errors stay authoritative and unchanged. */
export function attachAcousticCorpus(
  runtime: RuntimeForCorpus,
  options: {
    materials: readonly AcousticMaterial[];
    origin: string;
    sampleTick?: (tick: number) => boolean;
    maxRows?: number;
    maxEvents?: number;
    mapper?: typeof behaviorAcousticSource;
    recordEvents?: boolean;
  },
) {
  const state: CorpusState = {
    schemaVersion: "acoustic-component-corpus/1",
    origin: options.origin,
    phase: "initial",
    invalid: null,
    observedRequestCalls: 0,
    diagnosticCallsNotSampled: 0,
    rows: [],
    controls: [],
    physicsEvents: [],
    audioEvents: [],
  };
  const maxRows = options.maxRows ?? 64,
    maxEvents = options.maxEvents ?? 100000;
  let active = true,
    forcedGroup: string | null = null;
  const restores: (() => void)[] = [];
  const install = <T extends object, K extends keyof T>(owner: T, key: K, value: T[K]) => {
    const descriptor = Object.getOwnPropertyDescriptor(owner, key);
    Object.defineProperty(owner, key, { configurable: true, writable: true, value });
    restores.push(() => {
      if (descriptor) Object.defineProperty(owner, key, descriptor);
      else Reflect.deleteProperty(owner, key);
    });
  };
  const noteFailure = (error: unknown) => {
    state.invalid ??= error instanceof Error ? error.message : String(error);
  };
  const appendEvents = (target: unknown[], events: readonly unknown[]) => {
    if (!active || state.invalid) return;
    if (state.physicsEvents.length + state.audioEvents.length + events.length > maxEvents) {
      noteFailure("COMPONENT_CORPUS_EVENT_BUDGET");
      return;
    }
    target.push(...structuredClone(events));
  };
  const originalRequests = runtime.requests;
  install(
    runtime,
    "requests",
    function (
      this: RuntimeForCorpus,
      poses = this.latest.poses,
      events = [...this.activeVoices.values()].map((voice) => voice.event),
      scene = this.scene,
      listener = this.listener(),
    ) {
      state.observedRequestCalls++;
      const selected =
        active && (forcedGroup !== null || (options.sampleTick?.(this.latest.tick) ?? true));
      let captured: AcousticInput | null = null;
      if (selected && !state.invalid) {
        try {
          captured = resolvedRuntimeInput(
            this,
            options.materials,
            poses,
            events,
            scene,
            listener,
            options.mapper,
          );
        } catch (error) {
          noteFailure(error);
        }
      } else state.diagnosticCallsNotSampled++;
      let result: AcousticRequest[] = [],
        failure: unknown,
        failed = false;
      try {
        result = originalRequests.call(this, poses, events, scene, listener);
      } catch (error) {
        failed = true;
        failure = error;
      }
      if (captured && !state.invalid) {
        try {
          if (state.rows.length >= maxRows) throw new Error("COMPONENT_CORPUS_ROW_BUDGET");
          let expected: ExpectedRequests;
          if (failed) expected = errorIdentity(failure);
          else expected = { ok: true, requests: structuredClone(result) };
          let reproduced: ExpectedRequests;
          try {
            reproduced = { ok: true, requests: buildAcousticRequests(captured) };
          } catch (error) {
            reproduced = errorIdentity(error);
          }
          if (!exactDataEqual(expected, reproduced))
            throw new Error("COMPONENT_ROOT_REQUEST_ORACLE_MISMATCH");
          state.rows.push({
            id: `request.${state.observedRequestCalls}`,
            group: forcedGroup ?? "moving",
            phase: state.phase,
            tick: this.latest.tick,
            runEpoch: this.runEpoch,
            callScope: arguments.length > 1 ? "explicit-event-batch" : "default-live",
            sourceEvents: structuredClone(events),
            input: captured,
            expected,
          });
        } catch (error) {
          noteFailure(error);
        }
      }
      if (failed) throw failure;
      return result;
    },
  );
  if (options.recordEvents !== false) {
    const originalTick = runtime.onTick;
    install(runtime, "onTick", function (this: RuntimeForCorpus, snapshot) {
      appendEvents(state.physicsEvents, snapshot.events);
      return originalTick.call(this, snapshot);
    });
    const behavior = runtime.behavior,
      originalStep = behavior.step;
    install(behavior, "step", function (this: typeof behavior, frame) {
      const result = originalStep.call(this, frame);
      appendEvents(state.audioEvents, result.events);
      return result;
    });
  }
  return {
    setPhase(phase: string) {
      state.phase = phase;
    },
    noteControl(control: unknown) {
      state.controls.push(structuredClone(control));
    },
    captureNow(group = "moving") {
      forcedGroup = group;
      try {
        runtime.requests();
      } catch {
        /* Original validation failure is retained as a corpus row. */
      } finally {
        forcedGroup = null;
      }
    },
    snapshot() {
      return structuredClone(state);
    },
    assertValid() {
      if (state.invalid) throw new Error(state.invalid);
      if (!state.rows.length) throw new Error("COMPONENT_CORPUS_EMPTY");
    },
    dispose() {
      if (!active) return;
      active = false;
      for (const restore of restores.reverse()) restore();
    },
  };
}
