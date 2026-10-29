import type {
  ExperimentRecorderOptions,
  RecordingFrameInput,
} from "../../src/experiments/types.js";
const scene = {
  schemaVersion: "1.0.0" as const,
  sceneId: "scene.test",
  sceneRevision: 2,
  units: "SI" as const,
  coordinateSystem: "right-handed-y-up-minus-z-forward" as const,
  seed: 13,
  gravityMps2: [0, -9.81, 0] as [number, number, number],
  objects: [
    {
      id: "ball",
      shape: "sphere" as const,
      dimensionsM: [1, 1, 1] as [number, number, number],
      positionM: [0, 1, 0] as [number, number, number],
      orientationQuaternion: [0, 0, 0, 1] as [number, number, number, number],
      mode: "dynamicGravity" as const,
      massKg: 1,
      friction: 0.5,
      restitution: 0.4,
      physicsMaterialId: "metal",
      acousticMaterialId: "synthetic.wall",
      acousticRole: "dynamicOccluder" as const,
    },
  ],
  sources: [],
  listener: {
    id: "listener",
    positionM: [0, 1, 3] as [number, number, number],
    orientationQuaternion: [0, 0, 0, 1] as [number, number, number, number],
    attachment: "independent" as const,
  },
};
export function options(runId = "run.a"): ExperimentRecorderOptions {
  return {
    runId,
    runEpoch: "epoch.one",
    sceneSnapshot: structuredClone(scene),
    sourceConfig: { signal: "sine", frequencyHz: 440 },
    behaviorConfig: { gain: 0.2 },
    solverConfig: { maxReflectionOrder: 1 },
    atmosphere: { medium: "air", speedOfSoundMps: 343 },
    materialRegistry: [{ id: "synthetic.wall", absorption: 0.3 }],
    assetManifest: [],
    generatorConfig: { type: "sine" },
    physicsVersion: "rapier-0.21.0",
    backendVersion: "1.0.0",
    fixedDtS: 1 / 60,
    sampleRateHz: 48000,
    createdAt: "2026-10-27T00:00:00.000Z",
  };
}
export function frame(tick: number): RecordingFrameInput {
  return {
    tick,
    sceneRevision: 2,
    poses: [
      {
        objectId: "ball",
        positionM: [tick / 60, 1, 0],
        orientationQuaternion: [0, 0, 0, 1],
        linearVelocityMps: [1, 0, 0],
      },
    ],
    listener: structuredClone(scene.listener),
    physicsEvents:
      tick === 1
        ? [
            {
              eventId: "impact.one",
              tick,
              sequence: 0,
              objectId: "ball",
              type: "OnImpact",
              accepted: true,
            },
          ]
        : [],
    behaviorDecisions: tick === 1 ? [{ tick, sequence: 0, action: "start", ruleId: "impact" }] : [],
    audioEvents:
      tick === 1
        ? [{ eventId: "audio.one", tick, sequence: 0, objectId: "ball", action: "start" }]
        : [],
  };
}
