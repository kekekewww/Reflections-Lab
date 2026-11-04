// New process-CPU endpoint method: test source only until the parent runs RED.
// No browser/process counter is collected here; fixtures are literal protocol DTOs.
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";

const moduleUrl = new URL("../browser/performance-process-cpu-v4.mjs", import.meta.url);
const candidate = existsSync(moduleUrl) ? await import(moduleUrl.href) : {};
const available = typeof candidate.summarizeProcessCpuDeltaV4 === "function";
const scope = "OWNED_BROWSER_SHARED_ENDPOINTS_BEFORE_TRACE_TO_CLOSED_WINDOW_BEFORE_TAIL";
const options = { wallMilliseconds: 1000, scope };
const clone = (value) => structuredClone(value);
const endpoint = (...processInfo) => ({ processInfo });
const browser = (cpuTime = 2.25) => ({ id: 101, type: "browser", cpuTime });
const renderer = (cpuTime = 7.5) => ({ id: 202, type: "renderer", cpuTime });
const beforeFixture = () => endpoint(browser(), renderer());
const afterFixture = () => endpoint(renderer(10), browser(2.75));

function summarize(before, after, settings = options) {
  return candidate.summarizeProcessCpuDeltaV4(before, after, settings);
}
function unverified(before, after, settings = options) {
  let result;
  assert.doesNotThrow(() => {
    result = summarize(before, after, settings);
  });
  assert.equal(result.completeCoverage, false);
  assert.notEqual(result.status, "OBSERVED");
  assert.equal(result.totalCpuSeconds, null);
  assert.equal(result.cpuToWallRatio, null);
  assert.equal(result.nativeDspCpuMs, null);
  assert.equal(result.hardwareUnderruns, null);
  assert.doesNotThrow(() => JSON.stringify(result));
  return result;
}
function behavior(name, run) {
  test(name, { skip: !available }, run);
}

test("process CPU method exposes the independent versioned summarizer", () => {
  assert.equal(typeof candidate.summarizeProcessCpuDeltaV4, "function");
});

behavior(
  "same complete PID/type sets use cumulative CPU seconds over the actual wall interval",
  () => {
    const before = beforeFixture(),
      after = afterFixture();
    const original = clone({ before, after, options });
    const result = summarize(before, after);
    // Independent literals: browser +0.5s, renderer +2.5s, actual wall 1s.
    assert.equal(result.status, "OBSERVED");
    assert.equal(result.completeCoverage, true);
    assert.equal(result.totalCpuSeconds, 3);
    assert.equal(result.cpuToWallRatio, 3, "CPU/wall can exceed one across multiple threads");
    assert.equal(result.wallMilliseconds, 1000);
    assert.equal(result.scope, scope);
    assert.equal(result.nativeDspCpuMs, null);
    assert.equal(result.hardwareUnderruns, null);
    assert.deepEqual(
      { before, after, options },
      original,
      "pure summarization does not sort or mutate endpoints",
    );
  },
);

behavior(
  "a measured positive cumulative counter that does not change preserves actual delta zero",
  () => {
    const result = summarize(endpoint(browser(3)), endpoint(browser(3)), {
      wallMilliseconds: 500,
      scope,
    });
    assert.equal(result.status, "OBSERVED");
    assert.equal(result.completeCoverage, true);
    assert.equal(result.totalCpuSeconds, 0);
    assert.equal(result.cpuToWallRatio, 0);
  },
);

behavior("subsecond wall duration is converted from milliseconds exactly once", () => {
  const result = summarize(
    endpoint(browser(1), renderer(8)),
    endpoint(browser(1.125), renderer(8.25)),
    { wallMilliseconds: 750, scope },
  );
  assert.equal(result.completeCoverage, true);
  assert.equal(result.totalCpuSeconds, 0.375);
  assert.equal(result.cpuToWallRatio, 0.5);
  assert.equal(result.wallMilliseconds, 750);
});

behavior(
  "a zero cumulative endpoint is ambiguous in the pinned producer and cannot become measured zero",
  () => {
    // Chromium SystemInfo handler uses GetCumulativeCPUUsage().value_or(TimeDelta()).
    // No validity bit distinguishes failed native queries from a real initial zero.
    unverified(endpoint(browser(0)), endpoint(browser(0)));
    unverified(endpoint(browser(0)), endpoint(browser(1)));
    unverified(endpoint(browser(1)), endpoint(browser(0)));
  },
);

behavior(
  "a new process prevents a matched subset from being presented as whole-browser CPU",
  () => {
    const result = unverified(
      beforeFixture(),
      endpoint(browser(2.75), renderer(10), { id: 303, type: "utility", cpuTime: 0.25 }),
    );
    assert.notEqual(result.status, "OBSERVED");
  },
);

behavior(
  "a disappeared process prevents a smaller surviving total from being reported as complete",
  () => {
    unverified(beforeFixture(), endpoint(browser(2.75)));
  },
);

behavior("a PID whose type changes cannot inherit the previous process counter", () => {
  unverified(endpoint(browser(2)), endpoint({ id: 101, type: "renderer", cpuTime: 3 }));
});

behavior("a cumulative counter reset is unknown rather than a negative CPU measurement", () => {
  unverified(endpoint(browser(5)), endpoint(browser(4)));
});

behavior("two empty endpoints do not claim that the browser consumed zero CPU", () => {
  unverified(endpoint(), endpoint());
});

for (const [name, value] of [
  ["missing response", undefined],
  ["null response", null],
  ["array instead of response", []],
  ["missing processInfo", {}],
  ["null processInfo", { processInfo: null }],
  ["object processInfo", { processInfo: {} }],
]) {
  behavior(`invalid before ${name} remains explicit unknown`, () =>
    unverified(value, afterFixture()),
  );
  behavior(`invalid after ${name} remains explicit unknown`, () =>
    unverified(beforeFixture(), value),
  );
}

for (const [name, mutate] of [
  [
    "null row",
    (rows) => {
      rows[0] = null;
    },
  ],
  [
    "scalar row",
    (rows) => {
      rows[0] = 3;
    },
  ],
  [
    "string PID",
    (rows) => {
      rows[0].id = "101";
    },
  ],
  [
    "fractional PID",
    (rows) => {
      rows[0].id = 101.5;
    },
  ],
  [
    "zero PID",
    (rows) => {
      rows[0].id = 0;
    },
  ],
  [
    "negative PID",
    (rows) => {
      rows[0].id = -1;
    },
  ],
  [
    "missing PID",
    (rows) => {
      delete rows[0].id;
    },
  ],
  [
    "empty process type",
    (rows) => {
      rows[0].type = "";
    },
  ],
  [
    "nonstring process type",
    (rows) => {
      rows[0].type = false;
    },
  ],
  [
    "missing process type",
    (rows) => {
      delete rows[0].type;
    },
  ],
  [
    "missing CPU counter",
    (rows) => {
      delete rows[0].cpuTime;
    },
  ],
  [
    "null CPU counter",
    (rows) => {
      rows[0].cpuTime = null;
    },
  ],
  [
    "string CPU counter",
    (rows) => {
      rows[0].cpuTime = "2.25";
    },
  ],
  [
    "NaN CPU counter",
    (rows) => {
      rows[0].cpuTime = NaN;
    },
  ],
  [
    "infinite CPU counter",
    (rows) => {
      rows[0].cpuTime = Infinity;
    },
  ],
  [
    "negative CPU counter",
    (rows) => {
      rows[0].cpuTime = -1;
    },
  ],
  [
    "duplicate PID/type",
    (rows) => {
      rows.push(clone(rows[0]));
    },
  ],
  [
    "same PID with another type",
    (rows) => {
      rows.push({ ...rows[0], type: "utility" });
    },
  ],
]) {
  behavior(`before ${name} is not coerced or silently discarded`, () => {
    const before = beforeFixture();
    mutate(before.processInfo);
    unverified(before, afterFixture());
  });
  behavior(`after ${name} is not coerced or silently discarded`, () => {
    const after = afterFixture();
    mutate(after.processInfo);
    unverified(beforeFixture(), after);
  });
}

for (const [name, settings] of [
  ["null options", null],
  ["non-object options", true],
  ["missing interval", { scope }],
  ["null interval", { wallMilliseconds: null, scope }],
  ["string interval", { wallMilliseconds: "1000", scope }],
  ["zero interval", { wallMilliseconds: 0, scope }],
  ["negative interval", { wallMilliseconds: -1, scope }],
  ["NaN interval", { wallMilliseconds: NaN, scope }],
  ["infinite interval", { wallMilliseconds: Infinity, scope }],
  ["missing scope", { wallMilliseconds: 1000 }],
  ["nonstring scope", { wallMilliseconds: 1000, scope: true }],
  ["empty scope", { wallMilliseconds: 1000, scope: "" }],
]) {
  behavior(
    `${name} cannot substitute a fixed 600-second denominator or an advertised status`,
    () => {
      unverified(beforeFixture(), afterFixture(), settings);
    },
  );
}

behavior("advertised totals and success flags cannot repair a missing raw counter", () => {
  const before = beforeFixture(),
    after = afterFixture();
  delete before.processInfo[0].cpuTime;
  before.completeCoverage = true;
  before.totalCpuSeconds = 0;
  after.status = "OBSERVED";
  after.totalCpuSeconds = 3;
  unverified(before, after);
});

behavior(
  "overflow of finite per-process deltas does not serialize Infinity as a valid total",
  () => {
    unverified(endpoint(browser(1), renderer(1)), endpoint(browser(1e308), renderer(1e308)));
  },
);

behavior(
  "wall milliseconds that underflow during conversion cannot substitute a zero denominator",
  () => {
    unverified(endpoint(browser(1)), endpoint(browser(1e308)), {
      wallMilliseconds: Number.MIN_VALUE,
      scope,
    });
  },
);

behavior(
  "overflow of CPU/wall ratio with a representable wall interval leaves totals unknown",
  () => {
    // 1e-300 ms converts to nonzero 1e-303 seconds; the ratio itself is Infinity.
    unverified(endpoint(browser(1)), endpoint(browser(1e308)), { wallMilliseconds: 1e-300, scope });
  },
);

behavior("the maximum bounded process list is fully evaluated without truncation", () => {
  const rows = Array.from({ length: 1024 }, (_, index) => ({
    id: index + 1,
    type: "renderer",
    cpuTime: 1,
  }));
  const result = summarize(endpoint(...rows), endpoint(...clone(rows)), options);
  assert.equal(result.completeCoverage, true);
  assert.equal(result.totalCpuSeconds, 0);
  assert.equal(result.cpuToWallRatio, 0);
});

behavior(
  "one process beyond the observation cap fails closed rather than reporting a truncated total",
  () => {
    const rows = Array.from({ length: 1025 }, (_, index) => ({
      id: index + 1,
      type: "renderer",
      cpuTime: 1,
    }));
    unverified(endpoint(...rows), endpoint(...clone(rows)));
  },
);
