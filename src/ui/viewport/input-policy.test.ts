import test from "node:test";
import assert from "node:assert/strict";
import { acceptsFPSKey, type KeyboardPolicyInput } from "./input-policy.js";

const active: KeyboardPolicyInput = {
  code: "KeyW",
  isComposing: false,
  repeat: false,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  typing: false,
  locked: true,
  running: true,
};
test("FPS consumes only a new game key in a running locked viewport", () => {
  assert.equal(acceptsFPSKey(active), true);
  for (const code of ["Tab", "Escape", "Space", "Delete", "KeyT"])
    assert.equal(acceptsFPSKey({ ...active, code }), false);
});
test("typing, IME, browser shortcuts, repeats and stopped scenes never reach physics", () => {
  for (const patch of [
    { typing: true },
    { isComposing: true },
    { ctrlKey: true },
    { metaKey: true },
    { altKey: true },
    { repeat: true },
    { locked: false },
    { running: false },
  ])
    assert.equal(acceptsFPSKey({ ...active, ...patch }), false);
});
test("both physical Shift keys reach sprint while UI and suspension retain input ownership", () => {
  for (const code of ["ShiftLeft", "ShiftRight"]) {
    assert.equal(acceptsFPSKey({ ...active, code }), true);
    for (const patch of [
      { typing: true },
      { isComposing: true },
      { ctrlKey: true },
      { metaKey: true },
      { altKey: true },
      { repeat: true },
      { locked: false },
      { running: false },
    ])
      assert.equal(acceptsFPSKey({ ...active, code, ...patch }), false);
  }
});
