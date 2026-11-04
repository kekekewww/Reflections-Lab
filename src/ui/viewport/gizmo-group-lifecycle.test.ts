import assert from "node:assert/strict";
import test from "node:test";
import { Group, PerspectiveCamera, Scene } from "three";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";
import { createGizmoBridge, updateGizmoGroup } from "./TransformGizmo.js";

const detachedObjectError =
  "TransformControls: The attached 3D object must be a part of the scene graph.";

function fixture() {
  // Real Three controls need only event registration and style for this lifecycle
  // regression; this host intentionally supplies no browser or pointer behavior.
  const host = Object.assign(new EventTarget(), { style: { touchAction: "" } });
  const scene = new Scene();
  const camera = new PerspectiveCamera(50, 1, 0.1, 100);
  camera.position.set(3, 2, 3);
  const group = new Group();
  const controls = new TransformControls(camera, host as unknown as HTMLElement);
  const helper = controls.getHelper();
  scene.add(group, helper);
  controls.attach(group);
  scene.updateMatrixWorld(true);
  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    controls.detach();
    scene.remove(helper);
    controls.dispose();
  };
  return { scene, group, controls, helper, dispose };
}

test("real Three reproduces the original diagnostic when the attached group leaves first", (t) => {
  const f = fixture();
  t.after(f.dispose);
  const errors: unknown[][] = [];
  // Only the deliberately broken order captures console output. Every corrected
  // path below leaves console.error untouched, so a new diagnostic stays visible.
  const capture = t.mock.method(console, "error", (...args: unknown[]) => {
    errors.push(args);
  });
  try {
    f.scene.remove(f.group);
    f.scene.updateMatrixWorld(true);
  } finally {
    capture.mock.restore();
  }
  assert.deepEqual(errors, [[detachedObjectError]]);
  assert.equal(f.controls.object, f.group);
  t.diagnostic("Original failure reproduced: " + detachedObjectError);
});

test("ref retirement detaches controls before graph removal and preserves pending commits", (t) => {
  const f = fixture();
  t.after(f.dispose);
  const bridge = createGizmoBridge();
  assert.equal(bridge.retireGroup, null);
  updateGizmoGroup(bridge, "ball", null, f.group);
  bridge.controls = f.controls;
  const pending = Symbol("scene-command-in-flight");
  bridge.pending.add(pending);
  const retired: Group[] = [];
  bridge.retireGroup = (group) => {
    retired.push(group);
    // Retirement must run synchronously while both registry and scene parent
    // still identify the outgoing group, before R3F removes that scene node.
    assert.equal(bridge.groups.get("ball"), group);
    assert.equal(group.parent, f.scene);
    assert.equal(f.controls.object, group);
    f.dispose();
    bridge.controls = null;
  };

  updateGizmoGroup(bridge, "ball", f.group, null);
  assert.deepEqual(retired, [f.group]);
  assert.equal(f.controls.object, undefined);
  assert.equal(f.helper.parent, null);
  assert.equal(bridge.controls, null);
  assert.equal(bridge.groups.has("ball"), false);
  assert.deepEqual([...bridge.pending], [pending]);
  f.scene.remove(f.group);
  // Exercise the real controls root as well as the remaining scene. No console
  // spy is active here: detach must prevent the original Three diagnostic.
  f.helper.updateMatrixWorld(true);
  f.scene.updateMatrixWorld(true);
});

test("replacement under the same domain id survives stale old-ref cleanup", (t) => {
  const old = fixture();
  const replacement = fixture();
  t.after(old.dispose);
  t.after(replacement.dispose);
  const bridge = createGizmoBridge();
  updateGizmoGroup(bridge, "ball", null, old.group);
  let oldRetirements = 0;
  bridge.retireGroup = (group) => {
    assert.equal(group, old.group);
    assert.equal(bridge.groups.get("ball"), old.group);
    oldRetirements++;
    old.dispose();
  };
  updateGizmoGroup(bridge, "ball", old.group, replacement.group);
  assert.equal(oldRetirements, 1);
  assert.equal(old.controls.object, undefined);
  assert.equal(bridge.groups.get("ball"), replacement.group);

  bridge.controls = replacement.controls;
  const pending = Symbol("replacement-command-in-flight");
  bridge.pending.add(pending);
  let replacementRetirements = 0;
  bridge.retireGroup = (group) => {
    // A later cleanup can still name the old group. An active owner must match
    // its actual Group identity rather than sharing only the persisted id.
    if (group !== replacement.group) return;
    replacementRetirements++;
    replacement.dispose();
    bridge.controls = null;
  };
  updateGizmoGroup(bridge, "ball", old.group, null);
  assert.equal(bridge.groups.get("ball"), replacement.group);
  assert.equal(bridge.controls, replacement.controls);
  assert.equal(replacement.controls.object, replacement.group);
  assert.equal(replacementRetirements, 0);
  assert.deepEqual([...bridge.pending], [pending]);
  old.scene.remove(old.group);
  old.scene.updateMatrixWorld(true);
  replacement.scene.updateMatrixWorld(true);

  updateGizmoGroup(bridge, "ball", replacement.group, null);
  assert.equal(replacementRetirements, 1);
  assert.equal(replacement.controls.object, undefined);
  assert.equal(bridge.groups.has("ball"), false);
  assert.deepEqual([...bridge.pending], [pending]);
});

test("unchanged and empty refs do not retire a live group or disturb another id", () => {
  const bridge = createGizmoBridge();
  const group = new Group();
  const other = new Group();
  const retired: Group[] = [];
  bridge.retireGroup = (outgoing) => retired.push(outgoing);
  updateGizmoGroup(bridge, "ball", null, group);
  updateGizmoGroup(bridge, "wall", null, other);
  updateGizmoGroup(bridge, "ball", group, group);
  updateGizmoGroup(bridge, "ball", null, null);
  assert.deepEqual(retired, []);
  assert.equal(bridge.groups.get("ball"), group);
  assert.equal(bridge.groups.get("wall"), other);

  updateGizmoGroup(bridge, "wall", other, null);
  assert.deepEqual(retired, [other]);
  assert.equal(bridge.groups.has("wall"), false);
  assert.equal(bridge.groups.get("ball"), group);
});
