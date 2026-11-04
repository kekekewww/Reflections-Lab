import test from "node:test";
import assert from "node:assert/strict";
import {
  ACOUSTIC_SURFACE_BUDGET,
  acousticSurfaceCount,
} from "../../src/capabilities/acoustic-geometry.js";
import { createDefaultScene } from "../../src/app/defaults.js";

const object = (shape: string, acousticRole: string, mode = "fixed") => ({
  shape,
  acousticRole,
  mode,
});

test("boxes count as six surfaces, other shapes as one, and silent objects as none", () => {
  assert.equal(
    acousticSurfaceCount({
      objects: [
        object("box", "staticSurface"),
        object("box", "none"),
        object("sphere", "dynamicOccluder", "dynamicGravity"),
        object("capsule", "dynamicOccluder", "dynamicGravity"),
      ],
    } as never),
    8,
  );
});

test("the default room counts 25 surfaces", () => {
  assert.equal(acousticSurfaceCount(createDefaultScene()), 25);
  assert.equal(ACOUSTIC_SURFACE_BUDGET, 256);
});

test("over the limit, moving boxes reduce to one volume each, as the solver's input does", () => {
  const moving = Array.from({ length: 50 }, () =>
    object("box", "dynamicOccluder", "dynamicGravity"),
  );
  // A sphere selects the extended model, which is what allows the compact form.
  assert.equal(
    acousticSurfaceCount({ objects: [...moving, object("sphere", "staticSurface")] } as never),
    51,
  );
  // Without it, the legacy model keeps every box's faces and the solve is refused.
  assert.equal(acousticSurfaceCount({ objects: moving } as never), 300);
});
