import { V3_LIMITS } from "./performance-proof-v3.mjs";
export const FORMAL_NUMERIC_TASK_CAP = 2_000_000;
const object = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
// Versioned derivative of unchangedNumericV3; only name and declared task cap differ.
// prettier-ignore
export function formalNumericV3(ui, validated) {
  const reject = (reason) => ({ status: 'UNVERIFIED', reasons: [reason], mainTaskOccupancyMs: [], nativeTraceBinBoundariesUs: [], complete: false });
  if (!object(ui) || !object(validated) || !Array.isArray(ui.frame) || !object(ui.collectionWindow) || !Array.isArray(validated.validatedTasks))
    return reject('INPUT_SHAPE');
  if (validated.qualified !== true) return reject('NATIVE_ELIGIBILITY_REQUIRED');
  if (ui.frame.length > V3_LIMITS.rawFrames || validated.validatedTasks.length > FORMAL_NUMERIC_TASK_CAP) return reject('INPUT_CAP');
  const values = [ui.startedAtPerformanceMs, ui.sampleMilliseconds, ui.collectionWindow.endPerformanceMs, validated.begin, validated.end];
  if (!values.every(Number.isFinite)) return reject('NONFINITE_INPUT');
  if (ui.sampleMilliseconds <= 0 || ui.collectionWindow.endPerformanceMs <= ui.startedAtPerformanceMs || validated.end <= validated.begin)
    return reject('NONPOSITIVE_WINDOW');
  if (ui.collectionWindow.endPerformanceMs - ui.startedAtPerformanceMs !== ui.sampleMilliseconds) return reject('DURATION_MISMATCH');
  if (!Number.isFinite(validated.end - validated.begin)) return reject('ORDERED_OVERFLOW');
  let priorRaw = -Infinity;
  for (const row of ui.frame) {
    if (!object(row) || !Number.isFinite(row.timestamp)) return reject('NONFINITE_INPUT');
    if (row.timestamp <= priorRaw || row.timestamp > ui.collectionWindow.endPerformanceMs) return reject('RAW_ORDER_OR_WINDOW');
    priorRaw = row.timestamp;
  }
  // Validate every task before unchanged overlap selection, including malformed outside-window tasks.
  for (const task of validated.validatedTasks) {
    if (!object(task) || typeof task.ts !== 'number' || typeof task.dur !== 'number') return reject('TASK_SHAPE');
    if (!Number.isFinite(task.ts) || !Number.isFinite(task.dur)) return reject('NONFINITE_INPUT');
    if (task.dur < 0) return reject('NEGATIVE_DURATION');
    if (!Number.isFinite(task.ts + task.dur)) return reject('ORDERED_OVERFLOW');
  }
  const begin = validated.begin, end = validated.end;
  const selected = validated.validatedTasks
    .map((event) => [`${event.pid}:${event.tid}`, event.ts, event.ts + event.dur])
    .filter(([, start, stop]) => stop >= begin && start <= end)
    .map(([, start, stop]) => [Math.max(start, begin), Math.min(stop, end)])
    .sort((a, b) => a[0] - b[0]);
  const merged = [];
  for (const item of selected) {
    const previous = merged.at(-1);
    if (previous && item[0] <= previous[1]) previous[1] = Math.max(previous[1], item[1]);
    else merged.push([...item]);
  }
  const origin = ui.startedAtPerformanceMs, performanceDurationMs = ui.sampleMilliseconds;
  const performanceBins = [origin, ...ui.frame.map((row) => row.timestamp).filter((time) => time > origin && time < ui.collectionWindow.endPerformanceMs), ui.collectionWindow.endPerformanceMs];
  const frameBoundaries = performanceBins.map((time) => begin + ((time - origin) / performanceDurationMs) * (end - begin)),
    cpu = Array.from({ length: Math.max(0, frameBoundaries.length - 1) }, () => 0);
  let frameIndex = 0;
  for (const [taskStart, taskEnd] of merged) {
    const start = taskStart, stop = taskEnd;
    while (frameIndex + 1 < frameBoundaries.length && frameBoundaries[frameIndex + 1] <= start) frameIndex++;
    for (let i = frameIndex; i + 1 < frameBoundaries.length && frameBoundaries[i] < stop; i++)
      cpu[i] += Math.max(0, Math.min(stop, frameBoundaries[i + 1]) - Math.max(start, frameBoundaries[i])) / 1000;
  }
  const complete = selected.length > 0 && selected[0][0] - begin <= 50000 && end - selected.at(-1)[1] <= 50000;
  return { mainTaskOccupancyMs: complete ? cpu : [], nativeTraceBinBoundariesUs: frameBoundaries,
    performanceBins, complete, nativeTaskCount: selected.length, mergedTaskCount: merged.length, mergedNativeTasks: merged };
}
