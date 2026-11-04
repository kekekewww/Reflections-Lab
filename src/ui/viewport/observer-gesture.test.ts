import assert from "node:assert/strict";
import test from "node:test";
import { ObserverGestureOwnership } from "./observer-gesture.js";

const start = (patch = {}) => ({
  pointerId: 7,
  button: 0,
  altKey: true,
  editor: true,
  gizmoDragging: false,
  ...patch,
});

test("Alt orbit keeps ownership across modifier release and ignores a different pointer's up", () => {
  const gesture = new ObserverGestureOwnership();
  assert.equal(gesture.begin(start()), true);
  assert.equal(gesture.primaryOrbit, true);
  assert.equal(gesture.permitsGizmo(0), false);
  // The key may be released while the same physical drag continues.
  assert.equal(gesture.begin(start({ altKey: false })), true);
  assert.equal(gesture.permitsGizmo(0), false);
  assert.equal(gesture.release(8), false);
  assert.equal(gesture.pointerId, 7);
  assert.equal(gesture.release(7), true);
  assert.equal(gesture.primaryOrbit, false);
  assert.equal(gesture.permitsGizmo(0), true);
});

test("middle/right camera gestures exclude transforms; primary object drags and FPS retain ownership", () => {
  for (const button of [1, 2]) {
    const gesture = new ObserverGestureOwnership();
    assert.equal(gesture.begin(start({ button, altKey: false })), true);
    assert.equal(gesture.primaryOrbit, false);
    assert.equal(gesture.permitsGizmo(0), false);
  }
  for (const patch of [{ altKey: false }, { editor: false }, { gizmoDragging: true }]) {
    const gesture = new ObserverGestureOwnership();
    assert.equal(gesture.begin(start(patch)), false);
    assert.equal(gesture.pointerId, null);
  }
});

test("cancel/blur restore pointer ownership without bypassing an in-flight scene commit", () => {
  const gesture = new ObserverGestureOwnership();
  gesture.begin(start());
  gesture.cancel();
  assert.equal(gesture.pointerId, null);
  assert.equal(gesture.permitsGizmo(1), false);
  assert.equal(gesture.permitsGizmo(0), true);
  assert.equal(gesture.begin(start({ pointerId: 9, altKey: true })), true);
  assert.equal(gesture.permitsGizmo(0), false);
});
