import { canonicalStringify } from "./hash.js";
import type {
  RecordingArtifact,
  RecordingFrame,
  RecordingMetric,
  RecordingMetricPopulation,
} from "./types.js";
import type { AcousticFrame } from "../acoustics/types.js";

interface MetricSample {
  key: string;
  value: number;
}
export interface RecordingPathSamples {
  directDelay: MetricSample[];
  pathEnergy: MetricSample[];
  population: Omit<RecordingMetricPopulation, "sampleCount">;
}
const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const integer = (value: unknown): value is number =>
  Number.isSafeInteger(value) && Number(value) >= 0;

/** Query identity only. Full source content/phase validation remains in source-phase.ts. */
function playingSources(frame: RecordingFrame): Map<string, string> | null {
  const captured = frame.behaviorSnapshot;
  if (!record(captured) || !record(captured.runtimeSnapshot)) return null;
  const snapshot = captured.runtimeSnapshot,
    state = snapshot.state;
  if (
    !record(state) ||
    state.tick !== frame.tick ||
    state.sceneRevision !== frame.sceneRevision ||
    state.runEpoch !== frame.runEpoch ||
    !Array.isArray(state.instances) ||
    !Array.isArray(snapshot.voiceMetadata) ||
    state.instances.length > 256 ||
    state.instances.length !== snapshot.voiceMetadata.length
  )
    return null;
  const metadata = new Map<string, Record<string, unknown>>();
  for (const value of snapshot.voiceMetadata) {
    if (
      !record(value) ||
      typeof value.instanceId !== "string" ||
      metadata.has(value.instanceId) ||
      !(value.startEventId === null || typeof value.startEventId === "string")
    )
      return null;
    metadata.set(value.instanceId, value);
  }
  const active = new Map<string, string>(),
    ids = new Set<string>(),
    semanticIds = new Set<string>();
  for (const value of state.instances) {
    if (
      !record(value) ||
      typeof value.instanceId !== "string" ||
      ids.has(value.instanceId) ||
      ![value.bindingId, value.ruleId, value.objectId].every(
        (id) => typeof id === "string" && id.length > 0,
      ) ||
      !integer(value.generation) ||
      value.generation < 1 ||
      !integer(value.startedAtTick) ||
      value.startedAtTick > frame.tick ||
      !["continuous", "oneShot"].includes(String(value.kind)) ||
      !["scheduled", "playing", "fading", "stopped"].includes(String(value.playbackState))
    )
      return null;
    const entry = metadata.get(value.instanceId);
    if (!entry) return null;
    ids.add(value.instanceId);
    const key = canonicalStringify([
      value.bindingId,
      value.ruleId,
      value.objectId,
      value.generation,
      value.kind,
      value.startedAtTick,
      entry.startEventId,
    ]);
    if (semanticIds.has(key)) return null;
    semanticIds.add(key);
    if (value.playbackState === "playing") active.set(value.instanceId, key);
  }
  return active;
}

/** One equally weighted sample per available (tick, semantic source) query.
 * A retained stop/fading diagnostic is not another source emission sample.
 * Missing source metadata uses a separately qualified geometric estimator.
 */
export function collectRecordingPathSamples(
  recording: RecordingArtifact,
  bandCenterHz: number | null = null,
): RecordingPathSamples {
  const eligibility = recording.frames.map(playingSources);
  const missingEligibilityFrameCount = eligibility.filter((value) => value === null).length;
  const logical = recording.frames.length > 0 && missingEligibilityFrameCount === 0;
  const population: RecordingPathSamples["population"] = {
    kind: logical ? "logicalPlayingSourceQueries" : "capturedGeometricQueries",
    policyVersion: logical ? "post-step-playing-v1" : "geometric-query-v1",
    eligibleQueryCount: 0,
    excludedNonPlayingQueryCount: 0,
    invalidAcousticQueryCount: 0,
    backendDeclarationMismatchQueryCount: 0,
    missingEligibilityFrameCount,
    bandCenterHz,
    window: {
      startTick: recording.startTick,
      endTick: recording.endTick,
      fixedDtS: recording.configuration.fixedDtS,
    },
  };
  const directDelay: MetricSample[] = [],
    pathEnergy: MetricSample[] = [];
  for (let index = 0; index < recording.frames.length; index++) {
    const frame = recording.frames[index]!,
      active = eligibility[index];
    const queries: { key: string; acoustic: AcousticFrame }[] = [];
    const counts = new Map<string, number>();
    for (const acoustic of frame.acousticFrames) {
      const backendMismatch =
        acoustic.backendId !== recording.configuration.backendId ||
        acoustic.backendVersion !== recording.configuration.backendVersion;
      if (backendMismatch) population.backendDeclarationMismatchQueryCount++;
      if (
        acoustic.stale ||
        acoustic.pathAvailability !== "available" ||
        acoustic.poseTick !== frame.tick ||
        acoustic.sceneRevision !== frame.sceneRevision ||
        acoustic.listenerId !== frame.listener.id ||
        (logical && backendMismatch)
      ) {
        population.invalidAcousticQueryCount++;
        continue;
      }
      if (bandCenterHz !== null && !acoustic.bandCentersHz.includes(bandCenterHz)) continue;
      const source = logical ? active!.get(acoustic.sourceId) : acoustic.sourceId;
      if (source === undefined) {
        population.excludedNonPlayingQueryCount++;
        continue;
      }
      const key = canonicalStringify([frame.tick, source, acoustic.listenerId]);
      counts.set(key, (counts.get(key) ?? 0) + 1);
      queries.push({ key, acoustic });
    }
    for (const { key, acoustic } of queries) {
      // Ambiguous duplicate queries must not double-weight a time/source sample
      // or select a winner based on array order. Retain the raw data for diagnosis.
      if (counts.get(key)! > 1) {
        population.invalidAcousticQueryCount++;
        continue;
      }
      population.eligibleQueryCount++;
      const direct = acoustic.paths.find((path) => path.order === 0);
      if (direct && Number.isFinite(direct.absoluteDelayS) && direct.absoluteDelayS >= 0)
        directDelay.push({ key, value: direct.absoluteDelayS });
      // A completed available query with no returned paths has a modeled empty
      // path sum of zero. It is not dropped from the energy support population.
      const bandIndex = bandCenterHz === null ? null : acoustic.bandCentersHz.indexOf(bandCenterHz);
      const energy = acoustic.paths.reduce(
        (sum, path) =>
          sum +
          (bandIndex === null
            ? path.bandGains.reduce((bands, gain) => bands + gain * gain, 0) /
              Math.max(1, path.bandGains.length)
            : path.bandGains[bandIndex]! ** 2),
        0,
      );
      if (Number.isFinite(energy) && energy >= 0)
        pathEnergy.push({
          key: canonicalStringify([
            key,
            bandCenterHz === null ? acoustic.bandCentersHz : [bandCenterHz],
          ]),
          value: energy,
        });
    }
  }
  const byKey = (left: MetricSample, right: MetricSample) =>
    left.key < right.key ? -1 : left.key > right.key ? 1 : 0;
  directDelay.sort(byKey);
  pathEnergy.sort(byKey);
  return { directDelay, pathEnergy, population };
}
export function pathMetricPopulation(
  samples: RecordingPathSamples,
  metric: "directDelay" | "pathEnergy",
): RecordingMetricPopulation {
  return {
    ...samples.population,
    window: { ...samples.population.window },
    sampleCount: samples[metric].length,
  };
}
export function compatiblePathMetricPopulation(
  a: RecordingPathSamples,
  b: RecordingPathSamples,
  metric: "directDelay" | "pathEnergy",
): boolean {
  return (
    a.population.kind === b.population.kind &&
    a.population.policyVersion === b.population.policyVersion &&
    a.population.bandCenterHz === b.population.bandCenterHz &&
    canonicalStringify(a.population.window) === canonicalStringify(b.population.window) &&
    canonicalStringify(a[metric].map((sample) => sample.key)) ===
      canonicalStringify(b[metric].map((sample) => sample.key))
  );
}

export function computeRecordingMetrics(recording: RecordingArtifact): RecordingMetric[] {
  const result: RecordingMetric[] = [];
  const metric = (
    id: string,
    label: string,
    value: number | null,
    unit: string,
    method: string,
    reason: string | null,
    population?: RecordingMetricPopulation,
  ): void => {
    if (value !== null && !Number.isFinite(value)) {
      value = null;
      reason = "NUMERIC_RANGE";
    }
    result.push({
      id,
      label,
      value,
      unit,
      evidenceClass: "Computed",
      method,
      status: value === null ? "unavailable" : "available",
      reason,
      ...(population ? { population } : {}),
    });
  };
  const duration =
    recording.startTick !== null && recording.endTick !== null
      ? (recording.endTick - recording.startTick) * recording.configuration.fixedDtS
      : 0;
  metric("duration", "錄製長度", duration, "s", "(endTick-startTick)*fixedDtS", null);
  metric(
    "impactCount",
    "原始撞擊事件",
    recording.frames.reduce(
      (sum, frame) =>
        sum +
        frame.physicsEvents.filter((value) => {
          if (!record(value)) return false;
          return ["OnImpact", "impact"].includes(String(value.type)) && value.accepted !== false;
        }).length,
      0,
    ),
    "events",
    "Count accepted normalized physics impact events; excludes voice decisions",
    null,
  );
  const samples = collectRecordingPathSamples(recording),
    logical = samples.population.kind === "logicalPlayingSourceQueries";
  const mean = (values: MetricSample[]) =>
    values.length ? values.reduce((sum, sample) => sum + sample.value, 0) / values.length : null;
  metric(
    "meanDirectDelay",
    logical ? "平均直達聲到達時間" : "幾何查詢平均直達延遲（非發聲取樣）",
    mean(samples.directDelay),
    "s",
    logical
      ? "Arithmetic mean across available order-0 (tick, logical playing source) queries; post-step playing state, excludes stop/fading diagnostics; v2"
      : "Arithmetic mean across captured geometric order-0 queries; emission eligibility missing/invalid, backend declaration unverified (see mismatch count); not an emitted-source population; v1",
    samples.directDelay.length ? null : "NO_CAPTURED_DIRECT_PATH",
    pathMetricPopulation(samples, "directDelay"),
  );
  metric(
    "meanPathEnergy",
    logical ? "平均路徑壓力比平方總和" : "幾何查詢路徑壓力比平方總和（非發聲取樣）",
    mean(samples.pathEnergy),
    "ratio",
    `Mean_queries(sum_returned_paths(mean_actual_frame_bands(pressureGain²))); ${logical ? "post-step logical playing source queries; excludes stop/fading diagnostics" : "captured geometric queries; emission eligibility missing/invalid; backend declaration unverified (see mismatch count)"}; available empty-path sums are zero; excludes authored gain, pitch, waveform and PCM; not rendered energy or SPL; v2`,
    samples.pathEnergy.length ? null : "NO_AVAILABLE_ACOUSTIC_QUERY",
    pathMetricPopulation(samples, "pathEnergy"),
  );
  for (const [id, label, unit] of [
    ["rt60", "RT60", "s"],
    ["drr", "DRR", "dB"],
    ["c50", "C50", "dB"],
  ])
    metric(
      id!,
      label!,
      null,
      unit!,
      "Requires a valid supported impulse-response measurement; never derived from path count or AI",
      "VALID_IR_REQUIRED",
    );
  return result;
}
