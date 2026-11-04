import { validateNativeV3, SHORT_TRACE_CAPS } from "./performance-native-v3.mjs";
import { V4_CANDIDATE_POLICY as policy } from "./performance-qualification-registry-v4.mjs";
const object = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const exactKeys = (value, keys) =>
  object(value) &&
  Reflect.ownKeys(value).length === keys.length &&
  keys.every((key) => Object.hasOwn(value, key));
const positiveId = (value) => Number.isSafeInteger(value) && value > 0;
const sourceMatches = (event) =>
  object(event.args) &&
  Object.entries(policy.sourceLocation).every(([key, value]) => event.args[key] === value);
const rawSummary = (legacy) => ({
  qualified: legacy.qualified,
  status: legacy.status,
  reasons: [...legacy.reasons],
  formalQualification: legacy.formalQualification,
});

/**
 * Versioned typed interpretation of the complete immutable raw trace. It is not
 * formal qualification. Original V3 still evaluates the exact original events.
 * A separately classified post-window begin has null duration and contributes
 * no span. All supported spans and numeric inputs remain original objects.
 */
export function validateNativeBoundaryV4(ui, events, context, caps = SHORT_TRACE_CAPS) {
  const reasons = new Set(),
    classifications = [];
  let legacy = null,
    typedValidation = null;
  const reject = (reason) => reasons.add(reason);
  const answer = (native = legacy) => ({
    ...(native ?? {}),
    qualified: reasons.size === 0,
    status: reasons.size ? "UNVERIFIED" : "CANDIDATE_EVIDENCE",
    reasons: [...reasons],
    classifications,
    legacyRawEligibility: legacy ? rawSummary(legacy) : null,
    candidatePolicyId: policy.id,
    candidateRegistryStatus: policy.status,
    rawEventCount: Array.isArray(events) ? events.length : null,
    nativeTaskCandidates: legacy?.nativeTaskCandidates ?? null,
    typedNativeTaskCandidates: typedValidation?.nativeTaskCandidates ?? null,
    formalQualification: "NOT_APPROVED",
    originalV3ResultUnchanged: true,
  });
  try {
    legacy = validateNativeV3(ui, events, context, caps);
    if (
      !object(context) ||
      context.producerRevision !== policy.producerRevision ||
      context.executableSha256 !== policy.executableSha256
    )
      reject("V4_EXPLICIT_PRODUCER_AND_EXECUTABLE_REQUIRED");
    // Raw caps, identities, proof bits and every non-task contract are checked
    // before any typed task selection. No cap is applied to a reduced event set.
    for (const reason of legacy.reasons)
      if (reason !== "RENDERER_TASK_SCHEMA_OR_CATEGORY") reject(reason);
    if (
      reasons.size ||
      !Array.isArray(events) ||
      !Number.isFinite(legacy.end) ||
      !positiveId(legacy.expectedPid) ||
      !positiveId(legacy.expectedTid)
    ) {
      if (!reasons.size) reject("V4_VALIDATED_WINDOW_AND_OWNER_REQUIRED");
      return answer();
    }
    const excludedIndexes = new Set();
    for (let eventIndex = 0; eventIndex < events.length; eventIndex++) {
      const event = events[eventIndex];
      if (!object(event)) {
        reject("V4_RAW_EVENT_SCHEMA");
        continue;
      }
      if (!["B", "E"].includes(event.ph)) continue;
      const owned = event.pid === legacy.expectedPid && event.tid === legacy.expectedTid;
      // A known posting site cannot acquire eligibility by changing its owner.
      if (!owned && !sourceMatches(event)) continue;
      if (!owned) {
        reject("V4_POST_WINDOW_OWNER_MISMATCH");
        continue;
      }
      if (
        !exactKeys(event, ["args", "cat", "name", "ph", "pid", "tid", "ts"]) ||
        event.name !== policy.eventName ||
        event.cat !== policy.eventCategory ||
        event.ph !== policy.eventPhase ||
        !positiveId(event.pid) ||
        !positiveId(event.tid) ||
        !exactKeys(event.args, ["src_file", "src_func", "src_line"]) ||
        !sourceMatches(event) ||
        !Number.isFinite(event.ts) ||
        !(event.ts > legacy.end)
      ) {
        reject("V4_UNSUPPORTED_BEGIN_END_OR_BOUNDARY");
        continue;
      }
      classifications.push({
        eventIndex,
        classification: "POST_WINDOW_BEGIN_ONLY",
        duration: null,
        numericIncluded: false,
        source: event,
      });
      excludedIndexes.add(eventIndex);
    }
    if (classifications.length > policy.maximumClassifiedTasks)
      reject("V4_POST_WINDOW_CLASSIFICATION_CAP");
    if (reasons.size) return answer();
    // This is an explicit typed validation view, not a rewritten raw trace.
    // Every excluded index is retained verbatim above with its null duration.
    const typedEvents = events.filter((_event, index) => !excludedIndexes.has(index));
    const supported = (typedValidation = validateNativeV3(ui, typedEvents, context, caps));
    for (const reason of supported.reasons) reject(reason);
    if (!classifications.length && !legacy.qualified)
      for (const reason of legacy.reasons) reject(reason);
    return answer(supported);
  } catch (error) {
    reject(`V4_CONTROLLED_INPUT_REJECTION:${String(error?.message ?? error)}`);
    return answer();
  }
}
