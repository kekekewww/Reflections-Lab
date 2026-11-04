import assert from "node:assert/strict";
import test from "node:test";
import { LookSpikeFilter } from "./look-filter.js";

const run = (filter: LookSpikeFilter, deltas: Array<[number, number]>, stepMs = 16) =>
  deltas.flatMap(([x, y], i) => filter.accept(x, y, i * stepMs)).map(([x, y]) => [x, y]);

test("ordinary look motion passes through unchanged and in order", () => {
  const deltas: Array<[number, number]> = [
    [3, 1],
    [8, -2],
    [20, 0],
    [45, 4],
    [90, 6],
    [60, 2],
    [12, 0],
  ];
  assert.deepEqual(run(new LookSpikeFilter(), deltas), deltas);
});

test("a lone spike during slow motion is dropped", () => {
  const out = run(new LookSpikeFilter(), [
    [4, 0],
    [5, 1],
    [-640, 3],
    [4, 0],
    [5, 0],
  ]);
  assert.deepEqual(out, [
    [4, 0],
    [5, 1],
    [4, 0],
    [5, 0],
  ]);
});

test("a spike in the direction of fast motion is still dropped when the motion does not continue it", () => {
  const out = run(new LookSpikeFilter(), [
    [60, 0],
    [80, 0],
    [900, 0],
    [70, 0],
  ]);
  assert.deepEqual(out, [
    [60, 0],
    [80, 0],
    [70, 0],
  ]);
});

test("a real flick from rest is delayed one event, not lost", () => {
  const out = run(new LookSpikeFilter(), [
    [0, 0],
    [180, 10],
    [220, 12],
    [150, 5],
  ]);
  assert.deepEqual(out, [
    [0, 0],
    [180, 10],
    [220, 12],
    [150, 5],
  ]);
});

test("the recent-motion allowance decays after the mouse stops", () => {
  const filter = new LookSpikeFilter();
  filter.accept(110, 0, 0);
  assert.deepEqual(filter.accept(300, 0, 16), [[300, 0]]);
  // 500 ms later the allowance has decayed to the floor: an isolated jump is held and dropped.
  assert.deepEqual(filter.accept(400, 0, 516), []);
  assert.deepEqual(filter.accept(2, 0, 532), [[2, 0]]);
});

test("reset forgets a held delta and the recent allowance", () => {
  const kept = new LookSpikeFilter();
  kept.accept(100, 0, 0);
  assert.deepEqual(kept.accept(900, 0, 16), []);
  // Without reset the earlier motion still allows 200 px; the unconfirmed 900 is dropped.
  assert.deepEqual(kept.accept(200, 0, 32), [[200, 0]]);

  const fresh = new LookSpikeFilter();
  fresh.accept(100, 0, 0);
  assert.deepEqual(fresh.accept(900, 0, 16), []);
  fresh.reset();
  // After reset (new lock) nothing is held and the allowance is back at the floor.
  assert.deepEqual(fresh.accept(200, 0, 32), []);
  assert.deepEqual(fresh.accept(-3, 0, 48), [[-3, 0]]);
});
