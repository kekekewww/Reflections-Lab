import type { AudioDiagnosticsSnapshot, NativeOutputObservation } from "../audio/diagnostics.js";

export interface AudioPerformancePresentation {
  observed: boolean;
  enabled: boolean | null;
  acceptedFrames: number | null;
  rejectedFrames: number | null;
  lateOnsets: number | null;
  onsetCount: number | null;
  onsetLatenessP95Ms: number | null;
  frameConsumerP95Ms: number | null;
  routeControlP95Ms: number | null;
  listenerControlP95Ms: number | null;
  deliveryBatches: number | null;
  deliveryP95Ms: number | null;
  shapeBuilds: number | null;
  shapeReuses: number | null;
  nativeStatus: NativeOutputObservation["status"];
  nativeWindowMs: number | null;
  nativeUnderrunEvents: number | null;
  nativeUnderrunMs: number | null;
  nativeOutputLatencyMs: number | null;
}

/** A missing observation stays missing. Native deltas are meaningful only within
 * an available window from one AudioContext generation. */
export function presentAudioDiagnostics(
  diagnostics: AudioDiagnosticsSnapshot | null,
): AudioPerformancePresentation {
  const native = diagnostics?.nativeOutput;
  const nativeAvailable = native?.status === "AVAILABLE";
  return {
    observed: diagnostics !== null,
    enabled: diagnostics?.enabled ?? null,
    acceptedFrames: diagnostics?.frameDecisions.accepted ?? null,
    rejectedFrames: diagnostics
      ? Object.entries(diagnostics.frameDecisions).reduce(
          (total, [decision, count]) => total + (decision === "accepted" ? 0 : count),
          0,
        )
      : null,
    lateOnsets: diagnostics?.onsets.lateCount ?? null,
    onsetCount: diagnostics?.onsets.count ?? null,
    onsetLatenessP95Ms: diagnostics?.onsets.latenessMs.p95 ?? null,
    frameConsumerP95Ms: diagnostics?.timings.frameConsumer.p95 ?? null,
    routeControlP95Ms: diagnostics?.timings.routeControl.p95 ?? null,
    listenerControlP95Ms: diagnostics?.timings.listenerControl.p95 ?? null,
    deliveryBatches:
      diagnostics?.delivery.status === "OBSERVED" ? diagnostics.delivery.totalBatches : null,
    deliveryP95Ms:
      diagnostics?.delivery.status === "OBSERVED" ? diagnostics.delivery.elapsedMs.p95 : null,
    shapeBuilds: diagnostics?.controlOperations.shapeBuilds ?? null,
    shapeReuses: diagnostics?.controlOperations.shapeReuses ?? null,
    nativeStatus: native?.status ?? "NOT_OBSERVED",
    nativeWindowMs: nativeAvailable ? native.windowMs : null,
    nativeUnderrunEvents: nativeAvailable ? native.deltaUnderrunEvents : null,
    nativeUnderrunMs:
      nativeAvailable && native.deltaUnderrunSeconds !== null
        ? native.deltaUnderrunSeconds * 1000
        : null,
    nativeOutputLatencyMs:
      nativeAvailable && native.outputLatencySeconds !== null
        ? native.outputLatencySeconds * 1000
        : null,
  };
}

const diagnosticFormatters = new Map<string, Intl.NumberFormat>();

export function formatDiagnosticValue(
  value: number | null | undefined,
  locale: string,
  maximumFractionDigits = 2,
): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  const key = `${locale}:${maximumFractionDigits}`;
  let formatter = diagnosticFormatters.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, { maximumFractionDigits });
    if (diagnosticFormatters.size >= 16)
      diagnosticFormatters.delete(diagnosticFormatters.keys().next().value!);
    diagnosticFormatters.set(key, formatter);
  }
  return formatter.format(value);
}
