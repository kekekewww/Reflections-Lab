import fs from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";
import test from "node:test";
import ts from "typescript";

const oldSource = fs.readFileSync("tests/browser/product-e2e-refined-v2.spec.ts", "utf8");
const newSource = fs.readFileSync("tests/browser/product-e2e-refined-v3.spec.ts", "utf8");
function extract(source, name, next) {
  return source.slice(
    source.indexOf("async function " + name + "("),
    source.indexOf("async function " + next + "("),
  );
}
function setup({
  mode = "lost-first",
  initialHeld = false,
  recoveryCount = 0,
  busyPolls = 0,
  historical = false,
  missingTick = false,
  noTickAdvance = false,
} = {}) {
  let time = 0,
    clicks = 0,
    polls = 0,
    pendingAccepted = false;
  const recoveries = Array.from({ length: recoveryCount }, () => ({ preserved: true }));
  const state = {
    tick: missingTick ? undefined : 10,
    busy: false,
    held: initialHeld,
    accepted: initialHeld || historical,
    state: "running",
    overrun: false,
  };
  const page = {
    evaluate: async () => {
      polls++;
      return { ...state, busy: polls <= busyPolls };
    },
    waitForTimeout: async (ms) => {
      time += ms;
      if (state.state === "running" && !noTickAdvance) {
        state.tick++;
        if (pendingAccepted || (mode === "deferred-accepted" && clicks)) {
          state.held = true;
          state.accepted = true;
          pendingAccepted = false;
        }
      }
    },
    getByRole: () => ({
      click: async () => {
        clicks++;
        if (mode === "accepted" || (mode === "lost-first" && clicks === 2)) {
          state.held = true;
          state.accepted = true;
        } else if (mode === "accepted-lost") {
          state.accepted = true;
          state.held = false;
        } else if (mode === "aim-miss" || mode === "deferred-accepted") {
          state.overrun = false;
        } else {
          if (mode === "accepted-before-pause") pendingAccepted = true;
          state.state = "paused";
          state.overrun = true;
        }
      },
    }),
  };
  const recoverCapture = async (_page, _phase, shared) => {
    assert.equal(shared, recoveries);
    if (state.state === "running") return;
    if (shared.length >= 8) throw new Error("Explicit capture recovery budget exhausted (8)");
    shared.push({ before: shared.length });
    state.state = "running";
    state.overrun = false;
  };
  const context = vm.createContext({
    Date: { now: () => time },
    Error,
    Reflect,
    recoverCapture,
    console,
  });
  function load(source) {
    return vm.runInContext(
      ts.transpileModule(source, {
        compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
      }).outputText,
      context,
    );
  }
  load(extract(newSource, "captureGrabV3", "captureWait") + "\nthis.subject = captureGrabV3;");
  return {
    state,
    page,
    recoveries,
    context,
    load,
    run: () => context.subject(page, recoveries),
    get clicks() {
      return clicks;
    },
    get polls() {
      return polls;
    },
  };
}
test("RED reproduction: old click succeeds but old held wait never retries unaccepted Grab", async () => {
  const h = setup();
  h.load(
    extract(oldSource, "captureClick", "captureWait") +
      extract(oldSource, "captureWait", "productChain") +
      "\nthis.legacyClick=captureClick;this.legacyWait=captureWait;",
  );
  await h.context.legacyClick(h.page, "抓取", h.recoveries);
  await assert.rejects(
    h.context.legacyWait(h.page, "actual held body", async () => h.state.held, h.recoveries),
    /Capture condition timed out/,
  );
  assert.equal(h.clicks, 1);
  assert.equal(h.state.held, false);
  assert.equal(h.recoveries.length, 1);
});
test("GREEN lost first click: explicit recovery then second accepted Grab", async () => {
  const h = setup();
  await h.run();
  assert.equal(h.clicks, 2);
  assert.equal(h.recoveries.length, 1);
  assert.equal(h.state.held, true);
});
test("already held: no click and no recovery", async () => {
  const h = setup({ initialHeld: true });
  await h.run();
  assert.equal(h.clicks, 0);
  assert.equal(h.recoveries.length, 0);
});
test("first accepted Grab: exactly one click", async () => {
  const h = setup({ mode: "accepted" });
  await h.run();
  assert.equal(h.clicks, 1);
  assert.equal(h.recoveries.length, 0);
});
test("accepted Grab published on next tick: wait acknowledgement without duplicate input", async () => {
  const h = setup({ mode: "deferred-accepted" });
  await h.run();
  assert.equal(h.clicks, 1);
  assert.equal(h.recoveries.length, 0);
  assert.equal(h.state.held, true);
});
test("accepted grip then pause before published tick: resume and observe next tick without duplicate", async () => {
  const h = setup({ mode: "accepted-before-pause" });
  await h.run();
  assert.equal(h.clicks, 1);
  assert.equal(h.recoveries.length, 1);
  assert.ok(h.state.tick > 10);
  assert.equal(h.state.held, true);
});
test("historical OnGrab with unheld target fails precondition before any input", async () => {
  const h = setup({ historical: true });
  await assert.rejects(h.run(), /precondition rejects pre-existing OnGrab/);
  assert.equal(h.clicks, 0);
});
test("unaccepted pause without post-resume tick fails closed without duplicate input", async () => {
  const h = setup({ mode: "never", noTickAdvance: true });
  await assert.rejects(h.run(), /missing post-input tick after recovery/);
  assert.equal(h.clicks, 1);
  assert.equal(h.recoveries.length, 1);
});
test("missing observed tick fails closed without input", async () => {
  const h = setup({ missingTick: true });
  await assert.rejects(h.run(), /missing valid observed tick/);
  assert.equal(h.clicks, 0);
});
test("never accepted: finite three input attempts", async () => {
  const h = setup({ mode: "never" });
  await assert.rejects(h.run(), /input attempt budget exhausted \(3\)/);
  assert.equal(h.clicks, 3);
  assert.equal(h.recoveries.length, 2);
});
test("shared global eight recovery cap cannot reset", async () => {
  const h = setup({ mode: "never", recoveryCount: 8 });
  await assert.rejects(h.run(), /recovery budget exhausted \(8\)/);
  assert.equal(h.clicks, 1);
  assert.equal(h.recoveries.length, 8);
});
test("seventh prior recovery permits only one more before global refusal", async () => {
  const h = setup({ mode: "never", recoveryCount: 7 });
  await assert.rejects(h.run(), /recovery budget exhausted \(8\)/);
  assert.equal(h.clicks, 2);
  assert.equal(h.recoveries.length, 8);
});
test("accepted event with missing held refuses duplicate", async () => {
  const h = setup({ mode: "accepted-lost" });
  await assert.rejects(h.run(), /refusing duplicate/);
  assert.equal(h.clicks, 1);
});
test("aim miss without overrun refuses blind retry", async () => {
  const h = setup({ mode: "aim-miss" });
  await assert.rejects(h.run(), /refusing blind retry/);
  assert.equal(h.clicks, 1);
});
test("busy runtime is observed before first click", async () => {
  const h = setup({ mode: "accepted", busyPolls: 3 });
  await h.run();
  assert.ok(h.polls >= 5);
  assert.equal(h.clicks, 1);
});
test("permanently busy runtime is bounded without input", async () => {
  const h = setup({ busyPolls: Infinity });
  await assert.rejects(h.run(), /timed out while runtime busy/);
  assert.equal(h.clicks, 0);
});
test("v3 preserves every v2 byte outside insertion and one Grab call", () => {
  const marker = "// R17 v3 Grab-only helper.";
  const begin = newSource.lastIndexOf("\n", newSource.indexOf(marker));
  const end = newSource.indexOf("async function captureWait(", begin);
  const restored = newSource.slice(0, begin) + newSource.slice(end);
  assert.equal(
    restored.replace(
      "await captureGrabV3(page, recoveries);",
      'await captureClick(page, "抓取", recoveries);',
    ),
    oldSource,
  );
});
