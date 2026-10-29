import assert from "node:assert/strict";

const close = (actual, expected, tolerance = 1e-12) => {
  assert.ok(Number.isFinite(actual), "result must be finite");
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
};

// Constants are independent hand-calculated references, not obtained from candidate code.
export const acceptance = {
  "typescript-component": [
    [
      "normal accessible state",
      (m) => assert.equal(m.button({ label: "播放" }), '<button aria-busy="false">播放</button>'),
    ],
    [
      "loading state",
      (m) =>
        assert.equal(
          m.button({ label: "播放", loading: true }),
          '<button aria-busy="true" disabled>處理中</button>',
        ),
    ],
    [
      "disabled state",
      (m) =>
        assert.equal(
          m.button({ label: "播放", disabled: true }),
          '<button aria-busy="false" disabled>播放</button>',
        ),
    ],
    [
      "escape label",
      (m) =>
        assert.equal(
          m.button({ label: '<script>&"' }),
          '<button aria-busy="false">&lt;script&gt;&amp;&quot;</button>',
        ),
    ],
  ],
  "physics-impulse": [
    [
      "mass multiplies velocity delta",
      (m) => {
        const v = m.impulse([1, 2, 0], 2, 20);
        close(v[0], 2);
        close(v[1], 4);
        close(v[2], 0);
      },
    ],
    [
      "bounded vector length",
      (m) => {
        const v = m.impulse([3, 4, 0], 2, 5);
        close(v[0], 3);
        close(v[1], 4);
        close(Math.hypot(...v), 5);
      },
    ],
    [
      "zero delta stays zero",
      (m) => {
        for (const x of m.impulse([0, 0, 0], 1, 1)) close(x, 0);
      },
    ],
    [
      "invalid mass or velocity rejected",
      (m) => {
        assert.throws(() => m.impulse([1, 0, 0], 0, 1));
        assert.throws(() => m.impulse([NaN, 0, 0], 1, 1));
      },
    ],
    [
      "finite input overflow rejected explicitly",
      (m) =>
        assert.throws(
          () => m.impulse([Number.MAX_VALUE, 0, 0], Number.MAX_VALUE, 1),
          /numeric range/,
        ),
    ],
  ],
  "acoustic-floor-reflection": [
    [
      "vertical length and delay",
      (m) => {
        const r = m.reflect(0, 2, 0, 3, 343);
        close(r.x, 0);
        close(r.length, 5);
        close(r.delay, 5 / 343);
      },
    ],
    [
      "3-4-5 triangle",
      (m) => {
        const r = m.reflect(0, 2, 3, 2, 343);
        close(r.x, 1.5);
        close(r.length, 5);
        close(r.delay, 5 / 343);
      },
    ],
    [
      "asymmetric bounce",
      (m) => {
        const r = m.reflect(0, 1, 6, 2, 340);
        close(r.x, 2);
        close(r.length, Math.sqrt(45));
      },
    ],
    [
      "invalid geometry rejected",
      (m) => {
        assert.throws(() => m.reflect(0, -1, 3, 2, 343));
        assert.throws(() => m.reflect(0, 1, 3, 2, 0));
      },
    ],
    [
      "finite input overflow rejected explicitly",
      (m) =>
        assert.throws(
          () => m.reflect(0, Number.MAX_VALUE, 0, Number.MAX_VALUE, 343),
          /numeric range/,
        ),
    ],
  ],
  "bugfix-smoothing": [
    ["normal interpolation", (m) => close(m.smooth(0, 10, 0.25), 2.5)],
    ["lower clamp regression", (m) => close(m.smooth(0, 10, -0.5), 0)],
    ["upper clamp regression", (m) => close(m.smooth(0, 10, 2), 10)],
    [
      "invalid input rejected",
      (m) => {
        assert.throws(() => m.smooth(NaN, 10, 0.5));
        assert.throws(() => m.smooth(0, 10, Infinity));
      },
    ],
    [
      "finite input overflow rejected explicitly",
      (m) =>
        assert.throws(() => m.smooth(-Number.MAX_VALUE, Number.MAX_VALUE, 0.5), /numeric range/),
    ],
  ],
};
