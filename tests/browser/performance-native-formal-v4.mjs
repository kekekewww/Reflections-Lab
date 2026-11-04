/* global process, Buffer */
import { FORMAL_TRACE_CAPS } from "./performance-native-v3.mjs";
import { formalNumericV3 } from "./performance-numeric-formal-v3.mjs";
import { parseTraceStream } from "./performance-stream-v3.mjs";
import { validateNativeBoundaryV4 } from "./performance-native-boundary-v4.mjs";
import { V4_CANDIDATE_POLICY } from "./performance-qualification-registry-v4.mjs";

const object = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const taskNames = new Set(["RunTask", "ThreadControllerImpl::RunTask"]);
const knownPostingSite = (event) =>
  object(event.args) &&
  Object.entries(V4_CANDIDATE_POLICY.sourceLocation).every(
    ([key, value]) => event.args[key] === value,
  );

// A pure algorithm adapter: execution duration and registry approval belong to
// the separately versioned profile/launcher. A short input never becomes 600s.
export async function analyzeFormalTraceV4(filename, ui, context) {
  const retained = [],
    rawIndexes = [];
  let retainedBytes = 0,
    maxHeapBytes = 0,
    rawCount = 0,
    namedTaskCandidates = 0,
    beginEndCandidates = 0,
    postingSiteCandidates = 0;
  const heapGuard = () => {
    const bytes = process.memoryUsage().heapUsed;
    maxHeapBytes = Math.max(maxHeapBytes, bytes);
    if (bytes > FORMAL_TRACE_CAPS.heapBytes) throw Error("HEAP_CAP");
  };
  try {
    const stats = await parseTraceStream(
      filename,
      (event) => {
        const rawIndex = rawCount++;
        // Validate every raw event before retention, including foreign/pruned rows.
        if (!object(event)) throw Error("EVENT_OBJECT_SCHEMA");
        if (
          typeof event.name !== "string" ||
          event.name.length > FORMAL_TRACE_CAPS.metadataNameCharacters
        )
          throw Error("EVENT_NAME_SCHEMA_OR_CAP");
        heapGuard();
        const namedTask = taskNames.has(event.name),
          beginEnd = ["B", "E"].includes(event.ph),
          knownPosting = knownPostingSite(event);
        if (namedTask) namedTaskCandidates++;
        if (beginEnd) beginEndCandidates++;
        if (knownPosting) postingSiteCandidates++;
        if (
          namedTask ||
          beginEnd ||
          knownPosting ||
          ["FireAnimationFrame", "RequestAnimationFrame", "thread_name"].includes(event.name) ||
          event.name.startsWith("rlab-v3.observe.") ||
          event.name === ui?.collectionWindow?.beginMarkName ||
          event.name === ui?.collectionWindow?.endMarkName
        ) {
          retainedBytes += Buffer.byteLength(JSON.stringify(event), "utf8");
          if (retainedBytes > FORMAL_TRACE_CAPS.retainedSerializedBytes)
            throw Error("RETAINED_BYTES_CAP");
          rawIndexes.push(rawIndex);
          retained.push(event);
        }
      },
      {
        caps: {
          compressedBytes: FORMAL_TRACE_CAPS.compressedBytes,
          decodedBytes: FORMAL_TRACE_CAPS.decompressedBytes,
          events: FORMAL_TRACE_CAPS.events,
          timeoutMs: 300000,
        },
      },
    );
    const native = validateNativeBoundaryV4(ui, retained, context, FORMAL_TRACE_CAPS);
    heapGuard();
    const numeric = formalNumericV3(ui, native);
    heapGuard();
    const classifications = native.classifications.map((entry) => {
      if (
        !Number.isSafeInteger(entry.eventIndex) ||
        entry.eventIndex < 0 ||
        entry.eventIndex >= rawIndexes.length ||
        retained[entry.eventIndex] !== entry.source
      )
        throw Error("RAW_ORDINAL_MAPPING");
      return { ...entry, eventIndex: rawIndexes[entry.eventIndex] };
    });
    return {
      ...numeric,
      scope: "ALGORITHM_ONLY",
      formal600Run: false,
      formalQualification: "NOT_APPROVED",
      traceCaps: FORMAL_TRACE_CAPS,
      parsedTraceEvents: stats.events,
      rawEventCount: stats.events,
      inputViewEventCount: retained.length,
      rendererMainThreads: native.qualified ? [`${native.expectedPid}:${native.expectedTid}`] : [],
      nativeEligibility: {
        ...native,
        rawEventCount: stats.events,
        inputViewEventCount: retained.length,
        classifications,
        validatedTasks: undefined,
      },
      streamStats: {
        ...stats,
        retainedEvents: retained.length,
        retainedSerializedBytes: retainedBytes,
        retainedNamedTaskCandidates: namedTaskCandidates,
        retainedBeginEndCandidates: beginEndCandidates,
        retainedKnownPostingCandidates: postingSiteCandidates,
        maxObservedHeapBytes: maxHeapBytes,
      },
      analysisContext: context,
      coverage: {
        complete: native.qualified === true && numeric.complete === true,
        nativeV4Qualified: native.qualified === true,
        originalRawV3Qualified: native.legacyRawEligibility?.qualified === true,
        beginMarkTsUs: native.begin ?? null,
        endMarkTsUs: native.end ?? null,
        markedDurationMs: native.qualified ? (native.end - native.begin) / 1000 : null,
        clockCorrelation: {
          nativeTraceBinBoundariesUs: numeric.nativeTraceBinBoundariesUs,
          method:
            "Original two-anchor binary64 mapping and unchanged formalNumericV3 union/intersection",
        },
      },
      method:
        "Full raw schema/caps before retention; all B/E and known posting sites retained; frozen V4 typed native validation then unchanged formal V3 numeric kernel",
    };
  } catch (error) {
    return {
      scope: "ALGORITHM_ONLY",
      formal600Run: false,
      formalQualification: "NOT_APPROVED",
      traceCaps: FORMAL_TRACE_CAPS,
      parsedTraceEvents: null,
      rawEventCount: null,
      inputViewEventCount: retained.length,
      parsedEventsBeforeFailure: rawCount,
      rendererMainThreads: [],
      mainTaskOccupancyMs: [],
      nativeTraceBinBoundariesUs: [],
      complete: false,
      nativeEligibility: {
        qualified: false,
        status: "UNVERIFIED",
        reasons: [String(error?.message ?? error)],
        rawEventCount: null,
        inputViewEventCount: retained.length,
        formalQualification: "NOT_APPROVED",
      },
      coverage: {
        complete: false,
        nativeV4Qualified: false,
        originalRawV3Qualified: null,
        markedDurationMs: null,
      },
      analysisContext: context,
    };
  }
}
