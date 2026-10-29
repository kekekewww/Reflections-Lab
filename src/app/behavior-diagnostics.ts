import type {
  BehaviorDecisionView,
  BehaviorRuleView,
  EventView,
  NativeVoiceRejectionView,
  Vector3,
} from "../ui/contracts.js";
import { stableHash } from "../physics/math.js";
import type { VoiceIntent } from "../audio-behavior/types.js";
import type { VoiceAdmission, VoiceInput } from "../audio/types.js";
import type { AcousticFrame } from "../acoustics/types.js";

const record = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
const records = (value: unknown): Record<string, unknown>[] =>
  Array.isArray(value)
    ? value.map(record).filter((item): item is Record<string, unknown> => item !== null)
    : [];
const vector = (value: unknown): Vector3 | undefined =>
  Array.isArray(value) && value.length === 3 && value.every(Number.isFinite)
    ? ([...value] as Vector3)
    : undefined;
const text = (value: unknown): string | undefined =>
  typeof value === "string" ? value : undefined;

export interface DiagnosticProjectionInput {
  runEpoch: string;
  fixedDtSeconds: number;
  document: unknown;
  inputFrame: unknown;
  decisions: readonly unknown[];
  audioEvents: readonly unknown[];
}

/** Presentation only: copies actual decisions and retained evidence, never evaluates a rule. */
export function projectBehaviorDecisions(input: DiagnosticProjectionInput): EventView[] {
  const document = record(input.document);
  const bindings = records(document?.bindings);
  const profiles = records(document?.profiles);
  const frame = record(input.inputFrame);
  const objects = records(frame?.objects);
  const inputs = records(frame?.events);
  const audio = records(input.audioEvents);
  const views = new Map<string, EventView>();
  for (const decision of records(input.decisions)) {
    const { tick, sequence, action, reason } = decision;
    if (
      !Number.isSafeInteger(tick) ||
      (tick as number) < 0 ||
      !Number.isSafeInteger(sequence) ||
      (sequence as number) < 0 ||
      !["start", "update", "stop", "reject"].includes(String(action)) ||
      typeof reason !== "string" ||
      !["bindingId", "ruleId", "inputEventId", "instanceId"].every(
        (key) => decision[key] === null || typeof decision[key] === "string",
      )
    )
      continue;
    const output = audio.find(
      (event) =>
        event.instanceId === decision.instanceId &&
        event.action === action &&
        event.tick === tick &&
        event.sequence === sequence,
    );
    const bindingId = text(decision.bindingId) ?? text(output?.bindingId);
    const ruleId = text(decision.ruleId) ?? text(output?.ruleId);
    const binding = bindings.find((entry) => entry.bindingId === bindingId);
    const profile = profiles.find((entry) => entry.profileId === binding?.profileId);
    const rule = records(profile?.rules).find((entry) => entry.ruleId === ruleId);
    const source = inputs.find((entry) => entry.eventId === decision.inputEventId);
    const objectId = text(output?.objectId) ?? text(binding?.objectId) ?? text(source?.objectId);
    const object = objects.find((entry) => entry.objectId === objectId);
    const contact =
      record(output?.contact) ??
      record(source?.contact) ??
      (decision.inputEventId === null ? record(object?.contact) : null);
    const emitter = record(rule?.emitter);
    const attachment = text(emitter?.attachment);
    const emitterPositionM = vector(output?.positionMetres);
    const contactPositionM = vector(contact?.pointWorldMetres);
    const diagnostic: BehaviorDecisionView = {
      tick: tick as number,
      sequence: sequence as number,
      action: action as BehaviorDecisionView["action"],
      reason,
      occurrences: 1,
      ...(bindingId ? { bindingId } : {}),
      ...(typeof decision.inputEventId === "string" ? { inputEventId: decision.inputEventId } : {}),
      ...(typeof decision.instanceId === "string" ? { instanceId: decision.instanceId } : {}),
      ...(["object", "contact", "fixed", "zone"].includes(attachment ?? "")
        ? {
            emitterAttachment: attachment as NonNullable<BehaviorDecisionView["emitterAttachment"]>,
          }
        : {}),
      ...(typeof contact?.pairKey === "string" ? { contactPairKey: contact.pairKey } : {}),
      ...(contactPositionM ? { contactPositionM } : {}),
      ...(emitterPositionM ? { emitterPositionM } : {}),
    };
    // Identity is semantic and epoch-scoped. Reject sequence is not unique; array order is not identity.
    const identity = JSON.stringify([
      input.runEpoch,
      tick,
      bindingId ?? null,
      ruleId ?? null,
      decision.inputEventId ?? null,
      decision.instanceId ?? null,
      action,
      reason,
    ]);
    const eventId = text(output?.eventId) ?? `diagnostic.${input.runEpoch}.${stableHash(identity)}`;
    const previous = views.get(eventId)?.decision;
    if (previous) {
      previous.occurrences = (previous.occurrences ?? 1) + 1;
      continue;
    }
    const generator = record(rule?.generator);
    const asset = record(generator?.asset);
    views.set(eventId, {
      id: eventId,
      tick: tick as number,
      timeSeconds: (tick as number) * input.fixedDtSeconds,
      type:
        text(record(output?.trigger)?.type) ??
        text(record(rule?.trigger)?.type) ??
        "BehaviorDecision",
      ...(objectId ? { objectId } : {}),
      ...(ruleId ? { ruleId } : {}),
      ...(typeof asset?.assetId === "string" ? { assetId: asset.assetId } : {}),
      ...(emitterPositionM ? { positionM: [...emitterPositionM] } : {}),
      suppressed: action === "reject",
      detail: reason,
      decision: diagnostic,
    });
  }
  return [...views.values()];
}

/** Bounded latest status for the current evaluation epoch; raw trace remains in the evaluator/recording. */
export class BehaviorDiagnostics {
  private latest = new Map<string, BehaviorDecisionView>();
  clear(): void {
    this.latest.clear();
  }
  append(views: readonly EventView[]): void {
    for (const view of views) {
      const diagnostic = view.decision;
      if (!diagnostic?.bindingId || !view.ruleId) continue;
      const key = JSON.stringify([diagnostic.bindingId, view.ruleId]);
      this.latest.delete(key);
      this.latest.set(key, structuredClone(diagnostic));
      if (this.latest.size > 512) this.latest.delete(this.latest.keys().next().value!);
    }
  }
  get(bindingId: string, ruleId: string): BehaviorDecisionView | undefined {
    const value = this.latest.get(JSON.stringify([bindingId, ruleId]));
    return value ? structuredClone(value) : undefined;
  }
  ruleView(
    bindingId: string,
    ruleId: string,
    disabledReason?: string,
  ): Pick<BehaviorRuleView, "status" | "diagnostic"> {
    if (disabledReason) return { status: disabledReason };
    const diagnostic = this.get(bindingId, ruleId);
    return diagnostic ? { status: diagnostic.reason, diagnostic } : {};
  }
}

/** Recent live renderer failures only; logical decisions and recorded artifacts stay untouched. */
export class NativeAdmissionDiagnostics {
  private recent = new Map<string, EventView>();
  clear(): void {
    this.recent.clear();
  }
  append(input: {
    intent: VoiceIntent;
    voiceInput: VoiceInput;
    admission: VoiceAdmission;
    frame: AcousticFrame;
    behaviorDocumentRevision: number;
    attemptedAtTick: number;
  }): void {
    if (input.admission.accepted) return;
    const event = input.intent.event;
    const nativeRejection: NativeVoiceRejectionView = {
      ...(input.admission.reason !== undefined ? { reason: input.admission.reason } : {}),
      audioEventId: event.eventId,
      audioEventTick: event.tick,
      ...(event.parentPhysicsEventId ? { inputEventId: event.parentPhysicsEventId } : {}),
      instanceId: event.instanceId,
      bindingId: event.bindingId,
      ruleId: event.ruleId,
      objectId: event.objectId,
      generation: event.generation,
      runEpoch: event.runEpoch,
      sceneRevision: event.sceneRevision,
      behaviorDocumentRevision: input.behaviorDocumentRevision,
      profileId: event.profileId,
      profileRevision: event.profileRevision,
      sourceId: input.voiceInput.sourceId,
      acousticRequestId: input.frame.requestId,
      acousticSceneRevision: input.frame.sceneRevision,
      acousticPoseTick: input.frame.poseTick,
      attemptedAtTick: input.attemptedAtTick,
    };
    const identity = JSON.stringify([
      event.eventId,
      event.instanceId,
      input.frame.requestId,
      input.admission.reason ?? null,
    ]);
    const id = `native-rejection.${event.runEpoch}.${stableHash(identity)}`;
    this.recent.delete(id);
    this.recent.set(id, {
      id,
      tick: input.attemptedAtTick,
      timeSeconds: input.attemptedAtTick * event.fixedDtSeconds,
      type: "NativeAudioRejected",
      objectId: event.objectId,
      ruleId: event.ruleId,
      ...(input.intent.generator.kind === "sample"
        ? { assetId: input.intent.generator.asset.assetId }
        : {}),
      positionM: [...event.positionMetres],
      nativeRejection,
    });
    if (this.recent.size > 64) this.recent.delete(this.recent.keys().next().value!);
  }
  events(): EventView[] {
    return structuredClone([...this.recent.values()]);
  }
  ruleView(bindingId: string, ruleId: string): Pick<BehaviorRuleView, "nativeRejection"> {
    const latest = [...this.recent.values()]
      .reverse()
      .find((event) => event.nativeRejection?.bindingId === bindingId && event.ruleId === ruleId);
    return latest?.nativeRejection
      ? { nativeRejection: structuredClone(latest.nativeRejection) }
      : {};
  }
}
