/** Offline scenario arithmetic only. Never calls providers or deploys infrastructure. */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
const defaultInput = fileURLToPath(
  new URL("../../docs/12-architecture-review/cloud-cost-scenarios.json", import.meta.url),
);
const positivePart = (n) => Math.max(0, n);
export const r2Charge = (usage, included, unit, rate) =>
  Math.ceil(positivePart(usage - included) / unit) * rate;
export const jobBillableSeconds = (seconds) => Math.max(60, Math.ceil(seconds * 10) / 10);
export function tieredEgress(gib, free, r) {
  // Free bytes occupy the first rate tier; never shift upper tiers down by the free quota.
  const first = positivePart(Math.min(gib, r.gcsEgressTier1GiB) - free);
  const second = positivePart(
    Math.min(gib, r.gcsEgressTier2GiB) - Math.max(free, r.gcsEgressTier1GiB),
  );
  const third = positivePart(gib - Math.max(free, r.gcsEgressTier2GiB));
  return (
    first * r.gcsEgressUsdPerGiB[0] +
    second * r.gcsEgressUsdPerGiB[1] +
    third * r.gcsEgressUsdPerGiB[2]
  );
}
export function calculate(model, peak, profileName) {
  const p = model.profiles[profileName],
    r = model.rates;
  const allowance = (key) => (model.sharedAllowancesAreOtherwiseUnused ? r[key] : 0);
  const hours = peak * p.windowHoursPerDay * model.monthDays * p.averageToPeakDuty;
  const sessions = hours / p.sessionHours;
  const mau = Math.ceil(sessions / p.sessionsPerMau);
  const aiRequests = hours * 60 * p.aiRequestsPerActiveMinute;
  const saves = (hours * 60) / p.saveEveryMinutes;
  const uploadedGb = hours * p.uploadGbPerUserHour;
  const downloadGb = sessions * p.downloadGbPerSession;
  const jobs = Math.ceil(hours * p.renderJobsPerUserHour);
  const attempts = Math.ceil(jobs * p.jobRetryMultiplier);
  const assetObjects = Math.ceil((uploadedGb * 1000) / p.assetObjectMb);
  const r2A = assetObjects;
  const renderInputReads = attempts * Math.ceil((p.renderInputGb * 1000) / p.assetObjectMb);
  const r2B = Math.ceil((downloadGb * 1000) / p.assetObjectMb) + renderInputReads;
  const retainedAssetGb = (uploadedGb * p.assetRetentionDays) / model.monthDays;
  const workerRequests = aiRequests + saves + assetObjects + r2B + jobs * 5 + attempts;
  const workerCpuMs = aiRequests * p.aiCpuMs + (workerRequests - aiRequests) * p.apiCpuMs;
  const workerUsd =
    r.workersBaseUsd +
    (positivePart(workerRequests - allowance("workersIncludedRequests")) / 1e6) *
      r.workersUsdPerMillionRequests +
    (positivePart(workerCpuMs - allowance("workersIncludedCpuMs")) / 1e6) *
      r.workersUsdPerMillionCpuMs;
  const r2Usd =
    r2Charge(retainedAssetGb, allowance("r2IncludedGbMonth"), 1, r.r2UsdPerGbMonth) +
    r2Charge(r2A, allowance("r2IncludedA"), 1e6, r.r2UsdPerMillionA) +
    r2Charge(r2B, allowance("r2IncludedB"), 1e6, r.r2UsdPerMillionB);
  const queueOps = jobs * 2 + attempts; // write, each read/attempt, successful delete; one <64KB descriptor.
  const queueUsd =
    (positivePart(queueOps - allowance("queuesIncludedOps")) / 1e6) * r.queuesUsdPerMillionOps;
  const metadataGb =
    (saves * p.metadataBytesPerSave * p.retainedSaveFraction * p.metadataRetentionDays) /
    model.monthDays /
    1e9;
  const dbEgressGb = (sessions * p.dbEgressBytesPerSession + saves * p.dbEgressBytesPerSave) / 1e9;
  const dbCompute = model.dbAssumedComputeByPeak[String(peak)];
  const dbUsd =
    r.supabaseProBaseUsd +
    positivePart(
      dbCompute.usdPerHour * model.monthDays * 24 -
        (model.sharedAllowancesAreOtherwiseUnused ? r.supabaseComputeCreditUsd : 0),
    ) +
    positivePart(metadataGb - allowance("supabaseIncludedDiskGb")) * r.supabaseUsdPerDiskGbMonth +
    positivePart(dbEgressGb - allowance("supabaseIncludedEgressGb")) * r.supabaseUsdPerEgressGb +
    positivePart(mau - allowance("supabaseIncludedMau")) * r.supabaseUsdPerMau;
  const billableS = jobBillableSeconds(p.renderLifetimeSeconds);
  const cpuSeconds = attempts * billableS * p.renderVcpu;
  const memoryGiBSeconds = attempts * billableS * p.renderMemoryGiB;
  const jobUsd =
    positivePart(cpuSeconds - allowance("jobsIncludedVcpuSeconds")) * r.jobsUsdPerVcpuSecond +
    positivePart(memoryGiBSeconds - allowance("jobsIncludedGibSeconds")) * r.jobsUsdPerGibSecond;
  const outputGb = jobs * p.renderOutputGb;
  const retainedOutputGiB =
    (((outputGb * 1e9) / 2 ** 30) * p.renderRetentionDays) / model.monthDays;
  const outputDownloadGiB = (outputGb * p.renderOutputDownloads * 1e9) / 2 ** 30;
  const gcsUsd =
    positivePart(retainedOutputGiB - allowance("gcsIncludedGibMonth")) *
      model.monthDays *
      24 *
      r.gcsUsdPerGibHour +
    (positivePart(attempts - allowance("gcsIncludedA")) / 1000) * r.gcsUsdPerThousandA +
    (positivePart(jobs * p.renderOutputDownloads - allowance("gcsIncludedB")) / 1000) *
      r.gcsUsdPerThousandB +
    tieredEgress(outputDownloadGiB, allowance("gcsIncludedInternetGiB"), r);
  const inputMillions = (aiRequests * p.aiInputTokens) / 1e6;
  const outputMillions = (aiRequests * p.aiOutputTokens) / 1e6;
  const aiUsd =
    model.aiUsdPerMillionInputTokens === null || model.aiUsdPerMillionOutputTokens === null
      ? null
      : inputMillions * model.aiUsdPerMillionInputTokens +
        outputMillions * model.aiUsdPerMillionOutputTokens;
  const typicalRenderConcurrency =
    ((peak * p.averageToPeakDuty * p.renderJobsPerUserHour * p.renderLifetimeSeconds) / 3600) *
    p.jobRetryMultiplier;
  const allActiveRenderConcurrency =
    ((peak * p.renderJobsPerUserHour * p.renderLifetimeSeconds) / 3600) * p.jobRetryMultiplier;
  const subtotalUsd = workerUsd + r2Usd + queueUsd + dbUsd + jobUsd + gcsUsd;
  const result = {
    peak,
    profile: profileName,
    activeUserHours: hours,
    sessions,
    estimatedMau: mau,
    aiRequests,
    peakAiRpm: peak * p.aiRequestsPerActiveMinute,
    inputMillionTokens: inputMillions,
    outputMillionTokens: outputMillions,
    aiCostExpression: `${inputMillions} * P_in + ${outputMillions} * P_out`,
    aiUsd,
    saves,
    metadataGb,
    dbComputeAssumption: dbCompute.name,
    dbEgressGb,
    uploadGb: uploadedGb,
    downloadGb,
    retainedAssetGb,
    staticGb: sessions * p.staticGbPerSession,
    staticRequests: sessions * p.staticRequestsPerSession,
    workerRequests,
    workerCpuMs,
    estimatedAiInFlightAtPeak: ((peak * p.aiRequestsPerActiveMinute) / 60) * p.aiWallSeconds,
    estimatedAiProxyMemoryGiBAtPeak:
      ((peak * p.aiRequestsPerActiveMinute) / 60) * p.aiWallSeconds * p.aiMemoryGiB,
    renderJobs: jobs,
    renderAttempts: attempts,
    renderInputReads,
    renderInputGb: attempts * p.renderInputGb,
    renderVcpuSeconds: cpuSeconds,
    renderMemoryGiBSeconds: memoryGiBSeconds,
    renderOutputGb: outputGb,
    retainedOutputGiB,
    outputDownloadGiB,
    renderConcurrencyCap: p.renderGlobalConcurrencyCap,
    typicalRenderConcurrency,
    allActiveRenderConcurrency,
    queueCapacityWarning: allActiveRenderConcurrency >= p.renderGlobalConcurrencyCap,
    workerUsd,
    r2Usd,
    queueUsd,
    dbUsd,
    jobUsd,
    gcsUsd,
    subtotalUsd,
    totalIncludingAiUsd: aiUsd === null ? null : subtotalUsd + aiUsd,
    capacityStatus: "UNVERIFIED",
    excluded: [
      "AI price if null",
      "logs and monitoring",
      "build/registry",
      "DB indexes/WAL/backup headroom",
      "cross-region traffic",
      "tax/support",
      "abuse beyond profile",
      "orchestration OAuth/bridge hosting",
    ],
  };
  for (const value of Object.values(result))
    if (typeof value === "number") assert(Number.isFinite(value) && value >= 0);
  return result;
}
function selfTest() {
  assert.equal(r2Charge(10, 10, 1, 0.015), 0);
  assert.equal(r2Charge(10.1, 10, 1, 0.015), 0.015);
  assert.equal(r2Charge(1000001, 1000000, 1e6, 4.5), 4.5);
  assert.equal(jobBillableSeconds(0.5), 60);
  assert.equal(jobBillableSeconds(60.01), 60.1);
  const r = { gcsEgressTier1GiB: 10, gcsEgressTier2GiB: 20, gcsEgressUsdPerGiB: [3, 2, 1] };
  assert.equal(tieredEgress(25, 2, r), 8 * 3 + 10 * 2 + 5);
  const model = JSON.parse(readFileSync(defaultInput, "utf8").replace(/^\uFEFF/, ""));
  const low = calculate(model, 100, "low");
  assert.equal(low.activeUserHours, 1500);
  assert.equal(low.sessions, 3000);
  assert.equal(low.aiRequests, 1800);
  assert.equal(low.inputMillionTokens, 3.6);
  assert.equal(low.outputMillionTokens, 0.9);
  assert.equal(low.totalIncludingAiUsd, null);
  assert.equal(low.subtotalUsd >= 30, true);
  const high = calculate(model, 10000, "high");
  assert.equal(high.renderJobs, 180000);
  assert.equal(high.renderInputReads, 3456000);
  assert.equal(high.renderVcpuSeconds, 518400000);
  assert.equal(high.renderMemoryGiBSeconds, 1036800000);
  assert.equal(high.retainedAssetGb, 2700000);
  assert.equal(high.queueCapacityWarning, true);
  const priced = calculate(
    { ...model, aiUsdPerMillionInputTokens: 2, aiUsdPerMillionOutputTokens: 3 },
    100,
    "low",
  );
  assert(Math.abs(priced.aiUsd - 9.9) < 1e-10); // Synthetic test rates, never provider prices.
  const usedAllowances = calculate(
    { ...model, sharedAllowancesAreOtherwiseUnused: false },
    100,
    "low",
  );
  assert(usedAllowances.subtotalUsd > low.subtotalUsd);
}
if (process.argv.includes("--self-test")) {
  selfTest();
  console.log(
    "PASS: billing units, minimum duration, egress tiers, nine-scenario workload units, symbolic AI, shared allowance sensitivity",
  );
} else {
  const pathArg = process.argv.find((arg) => arg.startsWith("--input="));
  const model = JSON.parse(
    readFileSync(pathArg ? pathArg.slice(8) : defaultInput, "utf8").replace(/^\uFEFF/, ""),
  );
  const rows = model.peakConcurrentSessions.flatMap((n) =>
    Object.keys(model.profiles).map((p) => calculate(model, n, p)),
  );
  if (process.argv.includes("--markdown")) {
    console.log(
      "| Peak | 情境 | 使用者小時 | AI requests | 雲端 jobs | Workers | R2 | DB/Auth | Jobs | GCS | Queue | 已定價小計 USD | AI token百萬 in/out |",
    );
    console.log("|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|");
    for (const x of rows)
      console.log(
        `| ${x.peak} | ${x.profile} | ${x.activeUserHours} | ${x.aiRequests} | ${x.renderJobs} | ${x.workerUsd.toFixed(2)} | ${x.r2Usd.toFixed(2)} | ${x.dbUsd.toFixed(2)} | ${x.jobUsd.toFixed(2)} | ${x.gcsUsd.toFixed(2)} | ${x.queueUsd.toFixed(2)} | ${x.subtotalUsd.toFixed(2)} | ${x.inputMillionTokens}/${x.outputMillionTokens} |`,
      );
  } else
    console.log(
      JSON.stringify(
        {
          asOf: model.asOf,
          ratesSharedAllowanceAssumption: model.sharedAllowancesAreOtherwiseUnused,
          results: rows,
        },
        null,
        2,
      ),
    );
}
