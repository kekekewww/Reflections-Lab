import assert from "node:assert/strict";
import test from "node:test";
import { validateNative200 } from "./native-accessibility-reachability.mjs";

const base = {
  devicePixelRatio: 1.25,
  innerWidth: 1400,
  visualViewportScale: 1,
  rootZoom: "1",
  bodyZoom: "1",
  bodyTransform: "none",
  screenWidth: 1920,
  screenHeight: 1080,
  window: {
    windowId: 7,
    bounds: { left: 10, top: 10, width: 1440, height: 1000, windowState: "normal" },
  },
};
const zoom = { ...base, devicePixelRatio: 2.5, innerWidth: 700 };
const authority = {
  kind: "ChromeTabsAutomaticAPI",
  beforeZoom: 1,
  afterZoom: 2,
  settings: { mode: "automatic", scope: "per-tab" },
};

test("native page zoom is measured relative to the same OS-scaled baseline", () => {
  assert.doesNotThrow(() => validateNative200(base, zoom, authority));
});
test("DPR/viewport emulation without native zoom authority cannot impersonate 200%", () => {
  assert.throws(() => validateNative200(base, zoom, { ...authority, afterZoom: 1 }));
  assert.throws(() =>
    validateNative200(base, zoom, { ...authority, settings: { mode: "manual", scope: "per-tab" } }),
  );
});
test("pinch scaling and CSS zoom cannot impersonate native page zoom", () => {
  assert.throws(() => validateNative200(base, { ...zoom, visualViewportScale: 2 }, authority));
  assert.throws(() => validateNative200(base, { ...zoom, bodyZoom: "2" }, authority));
  assert.throws(() => validateNative200(base, { ...zoom, rootZoom: "2" }, authority));
  assert.throws(() =>
    validateNative200(base, { ...zoom, bodyTransform: "matrix(2,0,0,2,0,0)" }, authority),
  );
});
test("window resize and a different screen cannot supply the missing zoom evidence", () => {
  assert.throws(() =>
    validateNative200(
      base,
      { ...zoom, window: { ...base.window, bounds: { ...base.window.bounds, width: 720 } } },
      authority,
    ),
  );
  assert.throws(() => validateNative200(base, { ...zoom, screenWidth: 1280 }, authority));
  assert.throws(() => validateNative200(base, { ...zoom, devicePixelRatio: 1.25 }, authority));
});
test("a native-menu label without observed paired menu evidence is insufficient", () => {
  assert.throws(() =>
    validateNative200(base, zoom, { kind: "ChromeNativeMenu", beforeZoom: 1, afterZoom: 2 }),
  );
});
