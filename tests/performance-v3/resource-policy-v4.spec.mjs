// Source/VM contracts for resource-policy witnesses. Synthetic public DTOs do
// not establish native capacity, workload completion, audio quality or CPU cost.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const fixtureSource = readFileSync(
  new URL("../browser/performance-fixture-v4.mjs", import.meta.url),
  "utf8",
);
const clone = (value) => structuredClone(value);
const DEFAULT_POLICY = Object.freeze({
  maxNativeVoices: 24,
  maxNativeGraphs: 48,
  maxVirtualVoices: 32,
  minResidenceSeconds: 0.2,
  priorityHysteresis: 0.1,
  fairnessSeconds: 1,
});
// Independent original acceptance values. Public production sources:
// src/audio/control.ts DEFAULT_AUDIO_BUDGET; types.ts AudioBudget (13 fields).
const ORIGINAL_BUDGET = Object.freeze({
  maxVoices: 24,
  maxSources: 32,
  maxSourceFrames: 64,
  maxPathsPerVoice: 8,
  maxTotalPaths: 96,
  maxDecodedBytes: 67108864,
  maxAssetDurationSeconds: 120,
  maxAssetChannels: 2,
  maxPendingEvents: 256,
  maxAssets: 64,
  maxConcurrentDecodes: 2,
  maxLateSends: 16,
  maxLateReverbBytes: 4194304,
});
function between(begin, end) {
  const start = fixtureSource.indexOf(begin),
    stop = fixtureSource.indexOf(end, start);
  assert.ok(start >= 0 && stop > start, `RESOURCE_POLICY_EXTRACTION_BOUNDARY:${begin}`);
  return fixtureSource.slice(start, stop);
}
function resourceVerifier() {
  const begin = fixtureSource.indexOf("// BEGIN_TESTABLE_AUDIO_RESOURCE_POLICY_V4");
  const end = fixtureSource.indexOf("// END_TESTABLE_AUDIO_RESOURCE_POLICY_V4", begin);
  if (begin < 0 || end <= begin) return null;
  const body = fixtureSource
    .slice(begin, end)
    .replace(/export\s+(?=async\s+function|function)/g, "");
  return new Function(
    "DEFAULT_NATIVE_VOICE_POLICY",
    `${body}; return verifyNativeAudioResourcePolicyV4;`,
  )(DEFAULT_POLICY);
}
const verify = resourceVerifier();
function fixture(requestedArm = "reference", pathCap = 8) {
  const candidate = requestedArm === "candidate";
  const internal = pathCap === 32 ? 256 : 96;
  const common = {
    activeRenderedCap: 24,
    nativeGraphBudget: candidate ? 48 : null,
    internalArrivalGraphBudget: internal,
    nativeGraphTotalBudget: 48 + internal,
    nativeCarrierBudget: 48 + internal + (candidate ? 32 : 0),
    parentNativeGraphsInUse: 8,
    internalArrivalGraphsInUse: 2,
    nativeSourceNodes: 10,
  };
  // The endpoint deliberately contains active parent/internal graphs and tails;
  // resource representation is not inferred from a zero-load or reduced budget.
  const sources = Array.from({ length: 10 }, (_, index) => ({
    instanceId: `voice.${index}`,
    sourceId: `source.${index}`,
    allocationSequence: index + 1,
    kind: index < 8 ? "content" : "internalArrival",
    generatorKind: "oscillator",
    role: index < 6 || index >= 8 ? "rendered" : "tail",
    pending: false,
    startedAudioTime: 0,
    sourceEndAudioTime: null,
    sourceEndAudioTimeBasis: "modelOrLegacyCutoff;notObservedNativeEof",
    scheduledStopAudioTime: null,
    nativeEofPending: false,
    nativeEndedDeliveryAudioTime: null,
    nativeEndedFlushAudioTime: null,
  }));
  return {
    requestedArm,
    pathCap,
    resourceSnapshot: {
      ...clone(common),
      mode: candidate ? "nativeCarrierRoutes" : "nativeReference",
      sourceContentModel: "nativeReference",
      carrierCpuSeconds: null,
      sources,
    },
    telemetry: {
      ...clone(common),
      budget: { ...ORIGINAL_BUDGET, maxPathsPerVoice: pathCap, maxTotalPaths: internal },
      nativeSlotsInUse: 10,
      activeVoices: 8,
      activePaths: 8 * pathCap,
      retiringVoices: 2,
      pendingVoices: 0,
      pendingCarriers: 0,
      carrierOnlyVoices: 0,
      nativeCarrierPeak: 10,
      virtualVoices: 0,
      demotingVoices: 0,
      virtualization: {
        enabled: candidate,
        policy: candidate ? { ...DEFAULT_POLICY } : null,
        promotions: 0,
        demotions: 0,
        expirations: 0,
        virtualTimelineCapacity: candidate ? 56 : 0,
      },
    },
  };
}
function rejected(input) {
  let result;
  assert.doesNotThrow(() => {
    result = verify(input);
  });
  assert.equal(result.qualified, false);
  assert.ok(Array.isArray(result.reasons) && result.reasons.length > 0);
}

test("V4 exposes a pure public resource-policy witness validator separately from configuration labels", () => {
  assert.equal(typeof verify, "function");
});
for (const requestedArm of ["reference", "candidate"]) {
  for (const pathCap of [8, 32]) {
    test(`public ${requestedArm} resource witness retains the original ${pathCap}-path budget and 24-voice cap`, () => {
      if (typeof verify !== "function") return;
      const input = fixture(requestedArm, pathCap),
        before = clone(input);
      assert.equal(Object.keys(input.telemetry.budget).length, 13);
      assert.equal(input.telemetry.budget.maxVoices, 24);
      assert.equal(input.resourceSnapshot.activeRenderedCap, 24);
      assert.equal(input.telemetry.activeVoices, 8);
      assert.equal(input.telemetry.retiringVoices, 2);
      assert.equal(input.telemetry.nativeSourceNodes, 10);
      const result = verify(input);
      assert.equal(result.qualified, true, JSON.stringify(result.reasons));
      assert.deepEqual(result.reasons, []);
      assert.deepEqual(input, before);
    });
  }
}
for (const [name, mutate] of [
  [
    "candidate requested but actual resource mode is reference",
    (f) => {
      f.resourceSnapshot.mode = "nativeReference";
    },
  ],
  [
    "reference requested but actual resource mode is candidate",
    (f) => {
      f.requestedArm = "reference";
    },
  ],
  [
    "software cursor representation",
    (f) => {
      f.resourceSnapshot.mode = "softwareCursorCandidate";
    },
  ],
  [
    "unknown representation",
    (f) => {
      delete f.resourceSnapshot.mode;
    },
  ],
  [
    "seekable oscillator content",
    (f) => {
      f.resourceSnapshot.sourceContentModel = "seekableHarmonics";
    },
  ],
  [
    "seekable clock content",
    (f) => {
      f.resourceSnapshot.sourceContentModel = "seekableNativeClock";
    },
  ],
  [
    "unknown content",
    (f) => {
      f.resourceSnapshot.sourceContentModel = null;
    },
  ],
  [
    "requested flags cannot rescue a reference graph",
    (f) => {
      f.qualified = true;
      f.policyMatch = true;
      f.resourceSnapshot.mode = "nativeReference";
    },
  ],
  [
    "unknown requested arm",
    (f) => {
      f.requestedArm = "automatic";
    },
  ],
  [
    "missing requested arm",
    (f) => {
      delete f.requestedArm;
    },
  ],
  [
    "null requested arm",
    (f) => {
      f.requestedArm = null;
    },
  ],
  [
    "unsupported path cap",
    (f) => {
      f.pathCap = 16;
    },
  ],
  [
    "path cap string",
    (f) => {
      f.pathCap = "32";
    },
  ],
  [
    "missing resource snapshot",
    (f) => {
      f.resourceSnapshot = null;
    },
  ],
  [
    "missing telemetry",
    (f) => {
      f.telemetry = null;
    },
  ],
  [
    "missing complete public budget",
    (f) => {
      f.telemetry.budget = null;
    },
  ],
]) {
  test(`resource witness rejects ${name}`, () => {
    if (typeof verify !== "function") return;
    const input = fixture("candidate");
    mutate(input);
    rejected(input);
  });
}
for (const key of Object.keys(ORIGINAL_BUDGET)) {
  test(`resource witness rejects changed original budget.${key}`, () => {
    if (typeof verify !== "function") return;
    const input = fixture("candidate");
    input.telemetry.budget[key] += 1;
    rejected(input);
  });
  test(`resource witness rejects unknown original budget.${key}`, () => {
    if (typeof verify !== "function") return;
    const input = fixture("candidate");
    delete input.telemetry.budget[key];
    rejected(input);
  });
}
for (const [name, arm, field, value] of [
  ["active rendered cap is reduced", "candidate", "activeRenderedCap", 23],
  ["parent graph cap erases the original retiring allowance", "candidate", "nativeGraphBudget", 24],
  ["internal arrivals consume the parent cap", "candidate", "internalArrivalGraphBudget", 0],
  ["all graphs silently omit internal arrivals", "candidate", "nativeGraphTotalBudget", 48],
  ["candidate carrier cap omits the virtual reserve", "candidate", "nativeCarrierBudget", 144],
  ["reference gains the candidate virtual reserve", "reference", "nativeCarrierBudget", 176],
  ["reference claims an explicit parent graph policy", "reference", "nativeGraphBudget", 48],
]) {
  for (const endpoint of ["resourceSnapshot", "telemetry"]) {
    test(`resource witness rejects ${endpoint}: ${name}`, () => {
      if (typeof verify !== "function") return;
      const input = fixture(arm);
      input[endpoint][field] = value;
      rejected(input);
    });
  }
}
for (const field of [
  "activeRenderedCap",
  "nativeGraphBudget",
  "internalArrivalGraphBudget",
  "nativeGraphTotalBudget",
  "nativeCarrierBudget",
]) {
  test(`resource witness rejects missing public capacity ${field} instead of inventing a value`, () => {
    if (typeof verify !== "function") return;
    const input = fixture("candidate");
    delete input.resourceSnapshot[field];
    rejected(input);
  });
}
for (const [name, mutate] of [
  [
    "stress profile is misinterpreted as 32 voices",
    (f) => {
      f.telemetry.budget.maxVoices = 32;
      f.telemetry.activeRenderedCap = 32;
      f.resourceSnapshot.activeRenderedCap = 32;
    },
  ],
  [
    "stress profile kept the default 96-path internal allowance",
    (f) => {
      f.telemetry.internalArrivalGraphBudget = 96;
      f.resourceSnapshot.internalArrivalGraphBudget = 96;
    },
  ],
  [
    "stress candidate kept default 176-carrier cap",
    (f) => {
      f.telemetry.nativeCarrierBudget = 176;
      f.resourceSnapshot.nativeCarrierBudget = 176;
    },
  ],
]) {
  test(`stress resource witness rejects ${name}`, () => {
    if (typeof verify !== "function") return;
    const input = fixture("candidate", 32);
    mutate(input);
    rejected(input);
  });
}
for (const [name, mutate] of [
  [
    "native source count unknown",
    (f) => {
      f.resourceSnapshot.nativeSourceNodes = null;
    },
  ],
  [
    "native source count nonfinite",
    (f) => {
      f.telemetry.nativeSourceNodes = NaN;
    },
  ],
  [
    "native graph count unknown",
    (f) => {
      f.telemetry.nativeSlotsInUse = null;
    },
  ],
  [
    "active and tail counts cannot be combined into a fabricated zero",
    (f) => {
      f.telemetry.activeVoices = null;
      f.telemetry.retiringVoices = null;
    },
  ],
  [
    "pending voice count unknown",
    (f) => {
      f.telemetry.pendingVoices = null;
    },
  ],
]) {
  test(`resource witness rejects ${name}`, () => {
    if (typeof verify !== "function") return;
    const input = fixture("candidate");
    mutate(input);
    rejected(input);
  });
}

function solverOptions(config) {
  const body = between("function solverAudioPolicyOptionsV4()", "\nconst previousRAF =");
  return new Function(
    "window",
    "DEFAULT_NATIVE_VOICE_POLICY",
    `${body}; return solverAudioPolicyOptionsV4();`,
  )({ __performanceProfileConfig: config }, DEFAULT_POLICY);
}
for (const [name, config] of [
  ["default reference", {}],
  ["explicit reference", { audioPolicyArm: "reference" }],
]) {
  test(`solver ${name} omits the virtualization key and any substitute content model`, () => {
    const options = solverOptions(config);
    assert.equal(Object.hasOwn(options, "virtualization"), false);
    assert.equal(Object.hasOwn(options, "oscillatorModel"), false);
    assert.deepEqual(options, {});
  });
}
test("solver candidate passes the actual typed DEFAULT policy under the new audioPolicyArm config", () => {
  const options = solverOptions({ audioPolicyArm: "candidate" });
  assert.equal(options.virtualization, DEFAULT_POLICY);
  assert.equal(Object.hasOwn(options, "oscillatorModel"), false);
});
test("solver rejects an unknown audioPolicyArm before constructing any engine", () => {
  assert.throws(() => solverOptions({ audioPolicyArm: "not-an-arm" }));
});

async function captureRuntimeOptions(config) {
  const calls = [],
    stop = new Error("CONTROLLED_STOP_AFTER_RUNTIME_ARGUMENT_CAPTURE");
  const body = between("async function mountUI()", "\nasync function warmupUI(");
  const mount = new Function(
    "dependencies",
    `
    const {window,LabRuntime,DEFAULT_NATIVE_VOICE_POLICY}=dependencies;
    let runtime;
    ${body}
    return mountUI;
  `,
  )({
    window: { __performanceProfileConfig: config },
    DEFAULT_NATIVE_VOICE_POLICY: DEFAULT_POLICY,
    LabRuntime: {
      async create(...args) {
        calls.push(args);
        throw stop;
      },
    },
  });
  let failure;
  try {
    await mount();
  } catch (error) {
    failure = error;
  }
  return { calls, failure, stop };
}
for (const [name, config] of [
  ["default reference", {}],
  ["explicit reference", { audioPolicyArm: "reference" }],
]) {
  test(`actual UI mount ${name} calls LabRuntime.create with no options argument`, async () => {
    const result = await captureRuntimeOptions(config);
    assert.equal(result.failure, result.stop);
    assert.deepEqual(result.calls, [[]]);
  });
}
test("actual UI mount candidate passes typed DEFAULT without changing source content", async () => {
  const result = await captureRuntimeOptions({ audioPolicyArm: "candidate" });
  assert.equal(result.failure, result.stop);
  assert.equal(result.calls.length, 1);
  assert.equal(result.calls[0].length, 1);
  assert.deepEqual(Object.keys(result.calls[0][0]), ["audioResourcePolicy"]);
  assert.equal(result.calls[0][0].audioResourcePolicy, DEFAULT_POLICY);
  assert.equal(Object.hasOwn(result.calls[0][0], "oscillatorModel"), false);
});
test("actual UI mount rejects unknown arm before LabRuntime.create", async () => {
  const result = await captureRuntimeOptions({ audioPolicyArm: "not-an-arm" });
  assert.equal(result.calls.length, 0);
  assert.notEqual(result.failure, result.stop);
  assert.ok(result.failure instanceof Error);
});

for (const [name, arm, mutate] of [
  [
    "candidate policy disabled",
    "candidate",
    (f) => {
      f.telemetry.virtualization.enabled = false;
    },
  ],
  [
    "candidate DEFAULT policy unknown",
    "candidate",
    (f) => {
      f.telemetry.virtualization.policy = null;
    },
  ],
  [
    "candidate residence differs from DEFAULT",
    "candidate",
    (f) => {
      f.telemetry.virtualization.policy.minResidenceSeconds = 0.21;
    },
  ],
  [
    "candidate hysteresis differs from DEFAULT",
    "candidate",
    (f) => {
      f.telemetry.virtualization.policy.priorityHysteresis = 0.11;
    },
  ],
  [
    "candidate fairness differs from DEFAULT",
    "candidate",
    (f) => {
      f.telemetry.virtualization.policy.fairnessSeconds = 1.1;
    },
  ],
  [
    "reference unexpectedly enables a candidate policy",
    "reference",
    (f) => {
      f.telemetry.virtualization.enabled = true;
      f.telemetry.virtualization.policy = { ...DEFAULT_POLICY };
    },
  ],
]) {
  test(`resource witness rejects ${name} from the public virtualization telemetry`, () => {
    if (typeof verify !== "function") return;
    const input = fixture(arm);
    mutate(input);
    rejected(input);
  });
}

// Additional observed-cap/consistency RED cases. The preceding 88 policy cases
// and their original full-budget positives remain byte-for-byte unchanged.
function setObservedNativeSourceCount(input, total) {
  input.resourceSnapshot.nativeSourceNodes = total;
  input.telemetry.nativeSourceNodes = total;
  const template = input.resourceSnapshot.sources[0];
  input.resourceSnapshot.sources = Array.from({ length: total }, (_, index) => ({
    ...clone(template),
    instanceId: `cap-negative.voice.${index}`,
    sourceId: `cap-negative.source.${index}`,
    allocationSequence: index + 1,
  }));
}
const observedCapNegatives = [
  [
    "candidate sources exceed the original 176-carrier capacity",
    "candidate",
    8,
    (f) => {
      setObservedNativeSourceCount(f, 177);
    },
  ],
  [
    "reference sources exceed the original 144-source capacity",
    "reference",
    8,
    (f) => {
      setObservedNativeSourceCount(f, 145);
    },
  ],
  [
    "stress candidate sources exceed 336 rather than inheriting the default cap",
    "candidate",
    32,
    (f) => {
      setObservedNativeSourceCount(f, 337);
    },
  ],
  [
    "parent graphs exceed the original active-plus-retiring capacity 48",
    "candidate",
    8,
    (f) => {
      f.resourceSnapshot.parentNativeGraphsInUse = 49;
      f.telemetry.parentNativeGraphsInUse = 49;
      f.telemetry.nativeSlotsInUse = 51;
    },
  ],
  [
    "default internal-arrival graphs exceed 96",
    "candidate",
    8,
    (f) => {
      f.resourceSnapshot.internalArrivalGraphsInUse = 97;
      f.telemetry.internalArrivalGraphsInUse = 97;
      f.telemetry.nativeSlotsInUse = 105;
    },
  ],
  [
    "stress internal-arrival graphs exceed 256",
    "candidate",
    32,
    (f) => {
      f.resourceSnapshot.internalArrivalGraphsInUse = 257;
      f.telemetry.internalArrivalGraphsInUse = 257;
      f.telemetry.nativeSlotsInUse = 265;
    },
  ],
  [
    "native slots do not equal the separately observed parent and internal graphs",
    "candidate",
    8,
    (f) => {
      f.telemetry.nativeSlotsInUse = 11;
    },
  ],
  [
    "native slots exceed all graph capacity instead of being truncated",
    "candidate",
    8,
    (f) => {
      f.telemetry.nativeSlotsInUse = 145;
    },
  ],
  [
    "public parent-graph endpoints disagree",
    "candidate",
    8,
    (f) => {
      f.telemetry.parentNativeGraphsInUse = 9;
      f.telemetry.nativeSlotsInUse = 11;
    },
  ],
  [
    "public internal-arrival endpoints disagree",
    "candidate",
    8,
    (f) => {
      f.telemetry.internalArrivalGraphsInUse = 3;
      f.telemetry.nativeSlotsInUse = 11;
    },
  ],
  [
    "active voices exceed the unchanged 24-voice capacity",
    "candidate",
    8,
    (f) => {
      f.telemetry.activeVoices = 25;
    },
  ],
  [
    "default active paths exceed the original total 96",
    "candidate",
    8,
    (f) => {
      f.telemetry.activePaths = 97;
    },
  ],
  [
    "stress active paths exceed the original total 256",
    "candidate",
    32,
    (f) => {
      f.telemetry.activePaths = 257;
    },
  ],
];
for (const [name, arm, pathCap, mutate] of observedCapNegatives) {
  test(`additional V4 observed-cap rejection: ${name}`, () => {
    if (typeof verify !== "function") return;
    const input = fixture(arm, pathCap);
    mutate(input);
    rejected(input);
  });
}
