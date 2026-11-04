import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const source = await readFile(
  new URL("../browser/performance-fixture-v3.mjs", import.meta.url),
  "utf8",
);
const begin = source.indexOf("// BEGIN_TESTABLE_PHYSICS_MAINTENANCE");
const end = source.indexOf("// END_TESTABLE_PHYSICS_MAINTENANCE", begin);
const body = source.slice(begin, end).replace("export function", "function");
const maintain = new Function(`${body}; return maintainPhysicsLoad;`)();
function host() {
  const actions = [];
  let clockReads = 0,
    sleepReads = 0;
  const records = new Map(
    Array.from({ length: 255 }, (_, i) => [
      `stress.${i}`,
      {
        definition: { mode: "dynamicGravity" },
        body: {
          isDynamic: () => true,
          isSleeping: () => {
            sleepReads++;
            return false;
          },
          wakeUp: () => actions.push(["wake", `stress.${i}`]),
        },
      },
    ]),
  );
  records.set("floor", { definition: { mode: "fixed" }, body: { isFixed: () => true } });
  return {
    world: { records, applyImpulse: (id, impulse) => actions.push(["impulse", id, impulse]) },
    now: () => ++clockReads,
    actions,
    reads: () => ({ clockReads, sleepReads }),
  };
}
for (const tick of [0, 1, 30]) {
  test(`probe-free physics tick ${tick} preserves every impulse/wake action without timing or sleep probes`, () => {
    const on = host(),
      off = host();
    const observed = maintain(on.world, tick, on.now);
    const silent = maintain(off.world, tick, off.now, { measure: false });
    assert.deepEqual(off.actions, on.actions);
    assert.equal(silent.wakeCalls, 255);
    assert.equal(silent.nativePreWakeSleepingBodies, null);
    assert.equal(silent.nativePostWakeSleepingBodies, null);
    assert.equal(silent.totalSetupMs, null);
    assert.deepEqual(off.reads(), { clockReads: 0, sleepReads: 0 });
    assert.ok(observed.totalSetupMs >= 0);
    assert.ok(on.reads().sleepReads > 0);
  });
}
