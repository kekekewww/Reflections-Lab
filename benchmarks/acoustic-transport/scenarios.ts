import { buildAcousticRequests } from "../../src/app/acoustic-input.js";
import type { AcousticInput, AcousticPose } from "../../src/app/acoustic-input.js";
import type { CorpusRow } from "./corpus.js";

/** Synthetic boundary checks retain all bodies and caps; they are never formal-trace speed evidence. */
export function invalidationScenarios(captured: readonly CorpusRow[]): CorpusRow[] {
  const seed = captured.find((row) => row.expected.ok && row.callScope === "default-live");
  if (!seed) throw new Error("COMPONENT_INVALIDATION_SEED");
  const base = structuredClone(seed.input);
  const output: CorpusRow[] = [];
  const pose = (
    input: AcousticInput,
    id: string,
    change: (value: AcousticPose) => AcousticPose,
  ) => {
    input.poses = input.poses.map((value) => (value.objectId === id ? change(value) : value));
  };
  const add = (
    name: string,
    change: (input: AcousticInput) => void = () => {},
    clearCacheBefore = false,
    epoch = seed.runEpoch,
  ) => {
    const input = structuredClone(base);
    input.tick += output.length + 1;
    change(input);
    const requests = buildAcousticRequests(input);
    output.push({
      id: `supplemental.${name}`,
      group: `invalidation.${name}`,
      phase: "synthetic-boundary-only",
      tick: input.tick,
      runEpoch: epoch,
      callScope: seed.callScope,
      sourceEvents: structuredClone(seed.sourceEvents),
      input,
      expected: { ok: true, requests },
      clearCacheBefore,
    });
  };
  add("cold", undefined, true);
  add("unchanged-pose");
  add("same-revision-pose", (input) =>
    pose(input, "profile.body.2", (value) => {
      const position = "positionMetres" in value ? value.positionMetres : value.positionM;
      const moved: [number, number, number] = [
        position[0] + 0.17,
        position[1] + 0.09,
        position[2] - 0.11,
      ];
      const rotation: [number, number, number, number] = [Math.SQRT1_2, 0, 0, Math.SQRT1_2];
      return "positionMetres" in value
        ? { ...value, positionMetres: moved, rotation }
        : { ...value, positionM: moved, orientationQuaternion: rotation };
    }),
  );
  add("same-revision-material-binding", (input) => {
    input.scene.objects.find((object) => object.id === "profile.body.1")!.acousticMaterialId =
      "material.soft";
  });
  add("same-revision-material-content", (input) => {
    input.materials = input.materials.map((material) =>
      material.id !== "material.hard"
        ? material
        : {
            ...material,
            bands: material.bands.map((band) => ({
              ...band,
              absorptionEnergy: band.absorptionEnergy + 0.01,
              reflectionEnergy: band.reflectionEnergy - 0.01,
            })),
          },
    );
  });
  add("same-revision-role", (input) => {
    input.scene.objects.find((object) => object.id === "profile.body.1")!.acousticRole =
      "dynamicReflector";
  });
  add("revision", (input) => {
    input.scene.sceneRevision++;
  });
  add("topology", (input) => {
    input.scene.objects.find((object) => object.id === "wall.back")!.id = "wall.component.back";
    pose(input, "wall.back", (value) => ({ ...value, objectId: "wall.component.back" }));
  });
  add("same-revision-dimensions", (input) => {
    input.scene.objects.find((object) => object.id === "profile.body.1")!.dimensionsM = [
      0.33, 0.31, 0.29,
    ];
  });
  add("namespace", (input) => {
    input.scene.sceneId += ".component-other";
  });
  add("epoch-reset", undefined, true, seed.runEpoch + ".component-reset");
  add("restored-original");
  return output;
}
