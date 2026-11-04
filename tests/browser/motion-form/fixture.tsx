import { createElement, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { LocaleProvider } from "../../../src/ui/locale.js";
import { MotionPanel } from "../../../src/ui/MotionPanel.js";
import { MotionWorkspace } from "../../../src/motion/index.js";
import { PhysicsWorld } from "../../../src/physics/index.js";
import type { SceneSpec } from "../../../src/scene/types.js";
const scene: SceneSpec = {
  schemaVersion: "1.0.0",
  sceneId: "scene.form-test",
  sceneRevision: 1,
  units: "SI",
  coordinateSystem: "right-handed-y-up-minus-z-forward",
  seed: 1,
  gravityMps2: [0, -9.81, 0],
  objects: [
    {
      id: "ball",
      shape: "sphere",
      dimensionsM: [0.2, 0.2, 0.2],
      positionM: [0.35791234618, 2.00000001, -0.75],
      orientationQuaternion: [0, 0, 0, 1],
      mode: "dynamicNoGravity",
      massKg: 1,
      friction: 0,
      restitution: 0,
      physicsMaterialId: "test",
      acousticMaterialId: "test",
      acousticRole: "none",
    },
  ],
  sources: [],
  listener: {
    id: "listener",
    positionM: [0, 1, 3],
    orientationQuaternion: [0, 0, 0, 1],
    attachment: "independent",
  },
};
const world = await PhysicsWorld.create(scene);
const motion = await MotionWorkspace.create(scene, world, { getScene: () => scene });
const probes = { saves: 0, starts: 0, undos: 0 };
Object.assign(window, {
  __motionFormSmoke: {
    get snapshot() {
      return motion.getView();
    },
    probes,
    dispose() {
      motion.dispose();
      world.dispose();
    },
  },
});
function App() {
  const [view, setView] = useState(motion.getView());
  useEffect(() => motion.subscribe(() => setView(motion.getView())), []);
  return createElement(
    LocaleProvider,
    null,
    createElement(MotionPanel, {
      locale: "en",
      view,
      selectedObject: {
        id: "ball",
        positionM: scene.objects[0]!.positionM,
        mode: "dynamicNoGravity",
      },
      onSave: async (input, revision) => {
        await motion.save(input, revision);
        probes.saves++;
      },
      onRemove: (id, revision) => motion.remove(id, revision),
      onStart: async (id) => {
        await motion.start(id, "command.form." + ++probes.starts);
        world.resume();
        for (let i = 0; i < 360 && motion.getView().activeRunIds.length; i++) world.step();
        world.pause();
      },
      onCancel: (id) => motion.cancel(id),
      onUndo: async (revision) => {
        await motion.undo(revision);
        probes.undos++;
      },
      onRedo: (revision) => motion.redo(revision),
      onRebase: (revision) => motion.rebase(revision),
      onExport: () => {},
      onImport: (text, revision) => motion.importJson(text, revision),
    }),
  );
}
createRoot(document.getElementById("root")!).render(createElement(App));
