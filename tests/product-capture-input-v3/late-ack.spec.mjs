import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const target = process.env.R17_GRAB_CANDIDATE ?? "tests/browser/product-e2e-refined-v3.spec.ts";
const source = readFileSync(target, "utf8");
const section = (start, end) => {
  const a = source.indexOf(start),
    b = source.indexOf(end, a);
  assert.ok(a >= 0 && b > a, `Actual source extraction: ${start}`);
  return source.slice(a, b);
};
const stamp = section("const transportStamp =", "interface ExplicitRecovery");
const recovery = section("async function recoverCapture(", "async function captureClick(");
const helper = section("async function captureGrabV3(", "async function captureWait(");

function host({ acceptedBeforePause = true, historical = false } = {}) {
  let now = 0,
    tick = 10,
    running = true,
    overrun = false,
    busy = false;
  let liveGrip = false,
    publishedHeld = false,
    pendingGrab = false,
    resumes = 0;
  const actions = [],
    recoveries = [];
  const events = historical
    ? [{ id: "event.historical-grab", type: "OnGrab", objectId: "ball" }]
    : [];
  const model = () => ({
    tick,
    simTimeSeconds: tick / 60,
    simulationState: running ? "running" : "paused",
    pauseReason: overrun ? "FIXED_STEP_OVERRUN" : "",
    runId: "run.same",
    sceneRevision: 7,
    recording: { state: "recording" },
    objects: [{ id: "ball", held: publishedHeld }],
    events: events.map((e) => ({ ...e })),
    error: "",
  });
  class ClockDate extends Date {
    constructor(value) {
      super(value === undefined ? now : value);
    }
    static now() {
      return now;
    }
  }
  const context = vm.createContext({
    Date: ClockDate,
    Error,
    Reflect,
    console,
    window: {
      __reflectionLab: {
        getSnapshot: model,
        get busy() {
          return busy;
        },
      },
    },
    expect: (actual) => ({
      toBe: (expected) => assert.equal(actual, expected),
      toBeGreaterThanOrEqual: (expected) => assert.ok(actual >= expected),
    }),
  });
  const publishNextTick = () => {
    if (!running) return;
    tick++;
    publishedHeld = liveGrip;
    if (pendingGrab) {
      events.push({ id: "event.new-grab", type: "OnGrab", objectId: "ball" });
      pendingGrab = false;
    }
  };
  const page = {
    evaluate: async (fn) => vm.runInContext(`(${fn.toString()})()`, context),
    waitForTimeout: async (ms) => {
      now += ms;
      publishNextTick();
    },
    getByRole: (_role, options) => ({
      click: async () => {
        if (typeof options.name !== "string") {
          assert.ok(overrun, "Recovery is permitted only for the fixture overrun");
          resumes++;
          running = true;
          overrun = false;
          actions.push({ type: "Run", tick });
          return;
        }
        assert.equal(options.name, "抓取");
        const priorInputs = actions.filter((a) => a.type === "Grab").length;
        actions.push({ type: "Grab", tick, alreadyAcceptedGrip: liveGrip });
        if (priorInputs === 0 && !historical) {
          if (acceptedBeforePause) {
            liveGrip = true;
            pendingGrab = true;
          }
          // The real world accepted synchronously, but the published pose/event
          // snapshot still belongs to the preceding tick when overload pauses it.
          running = false;
          overrun = true;
          return;
        }
        if (!liveGrip) {
          liveGrip = true;
          pendingGrab = true;
        }
        // A repeated input cannot create a second accepted world grip. Publish on
        // this branch only to let the old helper finish and expose its extra input.
        publishedHeld = liveGrip;
        if (pendingGrab) {
          events.push({ id: "event.new-grab", type: "OnGrab", objectId: "ball" });
          pendingGrab = false;
        }
      },
    }),
  };
  const compiled = ts.transpileModule(
    `${stamp}\n${recovery}\n${helper}\nthis.runSubject=captureGrabV3;`,
    { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } },
  ).outputText;
  vm.runInContext(compiled, context);
  return {
    page,
    recoveries,
    actions,
    events,
    run: () => context.runSubject(page, recoveries),
    get tick() {
      return tick;
    },
    get resumes() {
      return resumes;
    },
    get inputs() {
      return actions.filter((a) => a.type === "Grab");
    },
  };
}

test("accepted grip plus overload before next tick must publish acknowledgement after resume without a duplicate Grab input", async () => {
  const h = host({ acceptedBeforePause: true });
  await h.run();
  assert.equal(
    h.inputs.length,
    1,
    "An already accepted physical grip must never receive a second Grab input",
  );
  assert.equal(h.resumes, 1, "The existing explicit recovery may resume the paused capture");
  assert.ok(h.tick > 10, "Acknowledgement must include an observed post-input tick after recovery");
  assert.ok(h.events.some((e) => e.id === "event.new-grab"));
  assert.equal(h.recoveries.length, 1);
});

test("genuinely unaccepted input plus overload must observe a resumed tick before its bounded retry", async () => {
  const h = host({ acceptedBeforePause: false });
  await h.run();
  assert.equal(h.inputs.length, 2);
  assert.ok(
    h.inputs[1].tick > h.inputs[0].tick,
    "Resuming with the old snapshot is not evidence that Grab was unaccepted",
  );
  assert.equal(h.inputs[1].alreadyAcceptedGrip, false);
  assert.equal(h.recoveries.length, 1);
});

test("historical OnGrab cannot acknowledge a new input: scope new event IDs or explicitly refuse the fixture precondition", async () => {
  const h = host({ historical: true });
  let failure;
  try {
    await h.run();
  } catch (error) {
    failure = error;
  }
  if (failure) {
    assert.equal(
      h.inputs.length,
      0,
      "A rejected historical-event precondition must issue no input",
    );
    assert.match(
      String(failure),
      /pre[- ]?existing|precondition|historical|baseline.*OnGrab/i,
      "Historical fixture rejection must be explicit, rather than treating the old event as a newly accepted lost grip",
    );
  } else {
    assert.equal(h.inputs.length, 1, "Old accepted events cannot satisfy a fresh Grab request");
    assert.ok(h.events.some((e) => e.id === "event.new-grab"));
  }
});
