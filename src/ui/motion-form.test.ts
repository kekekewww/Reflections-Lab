import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MotionPanel } from "./MotionPanel.js";
import { LocaleProvider } from "./locale.js";
import { createMotionAction } from "../motion/registry.js";
import type { MotionWorkspaceView } from "../motion/types.js";
const view: MotionWorkspaceView = {
  document: {
    schemaVersion: "1.0.0",
    registryId: "motion.registry",
    revision: 0,
    scenePin: { sceneId: "scene.test", sceneRevision: 1, sceneHash: "sha256:" + "0".repeat(64) },
    actions: [],
  },
  runs: [],
  activeRunIds: [],
  stale: false,
  canUndo: false,
  canRedo: false,
};
const noop = () => {};
test("Motion form serializes an HTML v-compatible ID pattern and finite-domain numbers without a step grid", () => {
  const html = renderToStaticMarkup(
    createElement(
      LocaleProvider,
      null,
      createElement(MotionPanel, {
        locale: "en",
        view,
        selectedObject: {
          id: "ball",
          positionM: [0.35791234618, 2.00000001, -0.75],
          mode: "dynamicNoGravity",
        },
        onSave: noop,
        onRemove: noop,
        onStart: noop,
        onCancel: noop,
        onUndo: noop,
        onRedo: noop,
        onRebase: noop,
        onExport: noop,
        onImport: noop,
      }),
    ),
  );
  const pattern = html.match(/pattern="([^"]+)"/)![1]!;
  const id = new RegExp("^(?:" + pattern + ")$", "v");
  assert.equal(id.test("motion.ball-1"), true);
  assert.equal(id.test("Motion.bad"), false);
  assert.equal(id.test("motion space"), false);
  const numbers = [...html.matchAll(/<input[^>]*type="number"[^>]*>/g)].map((value) => value[0]);
  assert.equal(numbers.length, 7);
  for (const input of numbers) {
    assert.match(input, /step="any"/);
    assert.match(input, /min="/);
    assert.match(input, /max="/);
  }
  assert.match(html, /required=""/);
  assert.doesNotMatch(html, /novalidate/i);
  assert.throws(
    () =>
      createMotionAction(
        {
          actionId: "move",
          objectId: "ball",
          kind: "moveTo",
          targetPositionM: [0, 2, 0],
          maxSpeedMps: 0,
        },
        1,
        1,
      ),
    /maximum speed/,
  );
});
