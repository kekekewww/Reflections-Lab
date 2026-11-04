// Independent corroboration of the frozen semantic pilot against a complete native trace.
// This module never trusts an advertised qualification flag and never approves a browser.
import { validateSemanticPilotJournal } from "./performance-semantic-oracle-v1.mjs";
import { SHORT_TRACE_CAPS } from "./performance-native-v3.mjs";
import { validateNativeBoundaryV4 } from "./performance-native-boundary-v4.mjs";

const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const positiveId = (value) => Number.isSafeInteger(value) && value > 0;
const handleValid = (value) => Number.isSafeInteger(value) && value >= 0;
const categoryValid = (value) =>
  typeof value === "string" &&
  value.length <= 4096 &&
  value.split(",").includes("devtools.timeline");
const instant = (event) => ["I", "R"].includes(event.ph) && Number.isFinite(event.ts);
const span = (event) =>
  event.ph === "X" &&
  Number.isFinite(event.ts) &&
  Number.isFinite(event.dur) &&
  event.dur >= 0 &&
  Number.isFinite(event.ts + event.dur);
const names = new Set(["RequestAnimationFrame", "FireAnimationFrame", "CancelAnimationFrame"]);
const append = (map, key, value) => {
  const rows = map.get(key);
  if (rows) rows.push(value);
  else map.set(key, [value]);
};

function inspect(journal, ui, events, context, state, fail) {
  const journalResult = validateSemanticPilotJournal(journal, ui);
  state.journal = journalResult;
  if (journalResult.qualified !== true) {
    fail("FIXED_JOURNAL_NOT_QUALIFIED");
    return;
  }
  if (!Array.isArray(events) || events.length > SHORT_TRACE_CAPS.events || !isObject(context)) {
    fail("NATIVE_INPUT_SCHEMA_OR_CAP");
    return;
  }
  // Explicitly select native input fields. context.qualified/nativeEligibility are advertisements.
  const actualContext = {
    documentBefore: context.documentBefore,
    documentAfter: context.documentAfter,
    traceDataLoss: context.traceDataLoss,
    traceStreamClosed: context.traceStreamClosed,
    producerRevision: context.producerRevision,
    executableSha256: context.executableSha256,
  };
  const native = validateNativeBoundaryV4(ui, events, actualContext, SHORT_TRACE_CAPS);
  state.strictNative = {
    qualified: native.qualified,
    status: native.status,
    reasons: native.reasons,
    evidence: native.evidence,
    legacyRawEligibility: native.legacyRawEligibility,
    classifications: native.classifications,
    advertisementUsedForEligibility: false,
    caps: { ...SHORT_TRACE_CAPS },
  };
  if (native.qualified !== true) {
    fail("STRICT_NATIVE_NOT_QUALIFIED");
    return;
  }

  const documentId = actualContext.documentBefore.id;
  const registered = journal.operations.filter((row) => row.kind === "register");
  const registeredByHandle = new Map(registered.map((row) => [row.handle, row]));
  const registeredByLabel = new Map(registered.map((row) => [row.label, row]));
  const requests = new Map();
  const fires = new Map();
  const cancellations = new Map();
  let ownedRequestCandidates = 0;
  let ownedFireCandidates = 0;
  let ownedCancelCandidates = 0;
  const ownedHandles = new Set();
  let requestCount = 0;
  let fireCount = 0;
  let cancellationCount = 0;
  let excludedOtherDocumentEvents = 0;
  for (const event of events) {
    // V4 already inspects complete raw before this independent RAF-set scan.
    if (!names.has(event.name)) continue;
    const data = event.args?.data;
    const sameThread = event.pid === native.expectedPid && event.tid === native.expectedTid;
    const ownedDocument = data?.frame === documentId;
    const knownHandle = registeredByHandle.has(data?.id);
    if (ownedDocument) {
      if (event.name === "RequestAnimationFrame") ownedRequestCandidates++;
      else if (event.name === "FireAnimationFrame") ownedFireCandidates++;
      else ownedCancelCandidates++;
      if (handleValid(data?.id)) ownedHandles.add(data.id);
    }
    if (!positiveId(event.pid) || !positiveId(event.tid)) {
      fail("RAF_EVENT_IDENTITY_UNKNOWN");
      continue;
    }
    if (ownedDocument && !sameThread) {
      fail("OWNED_DOCUMENT_WRONG_NATIVE_THREAD");
      continue;
    }
    if (!ownedDocument) {
      if (sameThread && (knownHandle || !isObject(data) || typeof data.frame !== "string")) {
        fail("OWNED_RAF_DOCUMENT_UNKNOWN_OR_DIFFERENT");
      } else {
        excludedOtherDocumentEvents++;
      }
      continue;
    }
    if (!isObject(data) || !handleValid(data.id) || !knownHandle) {
      fail("UNKNOWN_OWNED_RAF_HANDLE");
      continue;
    }
    if (
      !categoryValid(event.cat) ||
      (event.name === "FireAnimationFrame" ? !span(event) : !instant(event))
    ) {
      fail("OWNED_RAF_EVENT_SCHEMA_OR_CATEGORY");
      continue;
    }
    if (
      event.ts < native.begin ||
      (event.name === "FireAnimationFrame" ? event.ts + event.dur : event.ts) > native.end
    ) {
      fail("OWNED_RAF_EVENT_OUTSIDE_CLOSED_WINDOW");
    }
    if (event.name === "RequestAnimationFrame") {
      append(requests, data.id, event);
      requestCount++;
    } else if (event.name === "FireAnimationFrame") {
      append(fires, data.id, event);
      fireCount++;
    } else {
      append(cancellations, data.id, event);
      cancellationCount++;
    }
  }

  if (registered.length !== 26 || registeredByHandle.size !== 26) {
    fail("RETURNED_REGISTRATION_HANDLE_SET");
  }
  if (
    ownedRequestCandidates !== 23 ||
    ownedFireCandidates !== 24 ||
    ownedCancelCandidates !== 1 ||
    cancellationCount !== 1 ||
    requestCount !== 23 ||
    fireCount !== 24 ||
    ownedHandles.size !== 25
  ) {
    fail("FULL_OWNED_RAF_EVENT_SET");
  }
  state.observedCounts = {
    requestEvents: ownedRequestCandidates,
    fireEvents: ownedFireCandidates,
    cancelEvents: ownedCancelCandidates,
    ownedTraceHandles: ownedHandles.size,
    validKnownRequestEvents: requestCount,
    validKnownFireEvents: fireCount,
    validKnownCancelEvents: cancellationCount,
    registeredJournalHandles: registeredByHandle.size,
    excludedOtherDocumentEvents,
  };
  const observations = [];
  for (const registration of registered) {
    const capturedRequests = requests.get(registration.handle) ?? [];
    const capturedFires = fires.get(registration.handle) ?? [];
    const capturedCancels = cancellations.get(registration.handle) ?? [];
    const cancelled = registration.label === "PC" || registration.label === "MC";
    const pretrace = registration.phase === "pretrace";
    if (capturedRequests.length !== (pretrace ? 0 : 1)) {
      fail("REQUEST_CAPTURE_COUNT");
    }
    if (capturedFires.length !== (cancelled ? 0 : 1)) fail("FIRE_CAPTURE_OR_CANCEL_COUNT");
    if (pretrace && capturedCancels.length !== 0) fail("PRETRACE_CANCEL_UNEXPECTEDLY_CAPTURED");
    if (!cancelled && capturedCancels.length !== 0) fail("UNSCHEDULED_NATIVE_CANCEL");
    if (capturedCancels.length > 1) fail("NATIVE_CANCEL_MULTIPLICITY");
    if (registration.label === "MC" && capturedCancels.length !== 1)
      fail("MC_NATIVE_CANCEL_REQUIRED");

    let parent = null;
    if (!pretrace) {
      const parentRegistration = registeredByLabel.get(registration.parentLabel);
      const parentFires = parentRegistration ? (fires.get(parentRegistration.handle) ?? []) : [];
      if (parentFires.length !== 1) {
        fail("REQUEST_PARENT_FIRE_NOT_UNIQUE");
      } else {
        parent = parentFires[0];
        for (const request of capturedRequests) {
          if (request.ts < parent.ts || request.ts > parent.ts + parent.dur) {
            fail("REQUEST_OUTSIDE_FIXED_PARENT_FIRE");
          }
        }
        for (const cancel of capturedCancels) {
          if (cancel.ts < parent.ts || cancel.ts > parent.ts + parent.dur) {
            fail("CANCEL_OUTSIDE_FIXED_PARENT_FIRE");
          }
        }
      }
    }
    if (
      capturedRequests.length === 1 &&
      capturedFires.length === 1 &&
      capturedRequests[0].ts > capturedFires[0].ts
    ) {
      fail("REQUEST_AFTER_NATIVE_FIRE");
    }
    if (
      capturedRequests.length === 1 &&
      capturedCancels.length === 1 &&
      capturedRequests[0].ts > capturedCancels[0].ts
    ) {
      fail("CANCEL_BEFORE_NATIVE_REQUEST");
    }
    observations.push({
      label: registration.label,
      handle: registration.handle,
      phase: registration.phase,
      parentLabel: registration.parentLabel,
      requestCount: capturedRequests.length,
      fireCount: capturedFires.length,
      cancelEventCount: capturedCancels.length,
      cancellationScope:
        registration.label === "PC"
          ? "PRETRACE_API_JOURNAL_ONLY_NATIVE_CANCEL_NOT_VERIFIED"
          : registration.label === "MC"
            ? capturedCancels.length === 1
              ? "NATIVE_CANCEL_CAPTURED_WITH_REQUEST_AND_NO_FIRE"
              : "REQUEST_AND_NO_FIRE_OBSERVED_NO_NATIVE_CANCEL_EVENT_CAPTURED"
            : "NOT_CANCELLED_IN_FIXED_SCENARIO",
      parentFire: parent ? { ts: parent.ts, dur: parent.dur } : null,
    });
  }
  state.observations = observations;

  const mark = journal.marks.find((row) => row.representativeLabel === "E0");
  const frame = ui.v3Proof.frames.find((row) => row.markName === mark?.name);
  const custom = native.evidence.find((row) => row.ordinal === frame?.ordinal);
  if (
    !custom ||
    !(custom.observationMarkTsUs < native.begin) ||
    !Number.isFinite(custom.observationCallTimeUs) ||
    custom.observationCallTimeUs < custom.fireTsUs ||
    custom.observationCallTimeUs > custom.fireTsUs + custom.fireDurationUs
  ) {
    fail("CUSTOM_MARK_PHYSICAL_CALLTIME_NOT_DISTINCT");
  }
  state.customStartTimeEvidence = custom ?? null;
}

/**
 * Additional fixed-pilot evidence after the independent V4 typed boundary validator. The outer
 * collector must independently enforce its smaller compressed/decoded/event budgets.
 * This pure oracle keeps original SHORT_TRACE_CAPS and inspects every raw event.
 */
export function verifySemanticNativeEvidenceV2(journal, ui, events, context) {
  const reasons = new Set();
  const state = {
    journal: null,
    strictNative: null,
    observedCounts: null,
    observations: [],
    customStartTimeEvidence: null,
  };
  try {
    inspect(journal, ui, events, context, state, (reason) => reasons.add(reason));
  } catch {
    reasons.add("SEMANTIC_NATIVE_INPUT_ACCESS_FAILED");
  }
  return {
    qualified: reasons.size === 0,
    reasons: [...reasons],
    ...state,
    advertisementUsedForEligibility: false,
    scope: "FROZEN_PILOT_AND_ONE_OWNED_DOCUMENT_NATIVE_TRACE_ONLY",
    formalQualification: "NOT_APPROVED",
    oldV2StatusUnchanged: true,
    originalV3RawStatusUnchanged: true,
  };
}
