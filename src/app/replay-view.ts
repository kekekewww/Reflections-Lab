import type { RecordingArtifact } from "../experiments/types.js";
import type { EventView } from "../ui/contracts.js";
import { projectBehaviorDecisions } from "./behavior-diagnostics.js";

/** Copied historical event data. Rendering never evaluates triggers or creates new sound events. */
export function replayEventViews(artifact: RecordingArtifact, limit = 256): EventView[] {
  const result: EventView[] = [];
  for (const frame of artifact.frames) {
    const captured = frame.behaviorSnapshot;
    const inputFrame =
      captured && typeof captured === "object" && "inputFrame" in captured
        ? captured.inputFrame
        : { events: frame.physicsEvents };
    const decisions = projectBehaviorDecisions({
      runEpoch: frame.runEpoch,
      fixedDtSeconds: artifact.configuration.fixedDtS,
      document: artifact.configuration.behaviorConfig,
      inputFrame,
      decisions: frame.behaviorDecisions,
      audioEvents: frame.audioEvents,
    });
    const diagnostics = new Map(decisions.map((view) => [view.id, view]));
    for (const input of [...frame.physicsEvents, ...frame.audioEvents]) {
      if (!input || typeof input !== "object") continue;
      const event = input as Record<string, unknown>;
      if (typeof event.eventId !== "string") continue;
      const trigger =
        event.trigger && typeof event.trigger === "object"
          ? (event.trigger as Record<string, unknown>)
          : null;
      const position = event.positionMetres;
      const diagnostic = diagnostics.get(event.eventId);
      const view: EventView = {
        id: event.eventId,
        tick: frame.tick,
        timeSeconds: frame.tick * artifact.configuration.fixedDtS,
        type:
          typeof event.type === "string"
            ? event.type
            : typeof trigger?.type === "string"
              ? trigger.type
              : "RecordedEvent",
        ...(typeof event.objectId === "string" ? { objectId: event.objectId } : {}),
        ...(typeof event.ruleId === "string" ? { ruleId: event.ruleId } : {}),
        ...(Array.isArray(position) &&
        position.length === 3 &&
        position.every((value) => typeof value === "number" && Number.isFinite(value))
          ? { positionM: [...position] as [number, number, number] }
          : {}),
        detail: `RecordedOutput · ${artifact.runId}`,
        ...(diagnostic?.decision
          ? { decision: diagnostic.decision, assetId: diagnostic.assetId }
          : {}),
      };
      result.push(view);
      if (result.length > limit) result.shift();
    }
    for (const view of decisions) {
      if (view.decision?.action !== "reject") continue;
      result.push(view);
      if (result.length > limit) result.shift();
    }
  }
  return result;
}
