import type { Vec3 } from "../../src/scene/types.js";

export interface LimitsExpectation {
  minAddedObjects?: number;
  toolCounts?: Record<string, number>;
  paths?: number;
  sources?: number;
  path?: {
    objectId: string;
    minSamples?: number;
    durationS?: number;
    centre?: "listener" | Vec3;
    radiusM?: number;
  };
  listenerFacingTarget?: string;
  evenGrid?: boolean;
  arcAround?: { target: string; radiusM: number };
  recordLimit?: number;
  createSceneAlone?: boolean;
}
export interface LimitsCase {
  id: string;
  prompt: string;
  expect: LimitsExpectation;
  /** A second instruction on the applied result, which the scene must already show. */
  followUp?: { prompt: string; expect: LimitsExpectation };
}
export const LADDER: readonly LimitsCase[] = [
  {
    id: "room-furnish",
    prompt:
      "Furnish this room as a small living room: a sofa, a low coffee table, a bookshelf against a wall, two armchairs and a rug. Everything should rest on the floor, stay inside the walls, and leave the listener's spot clear.",
    expect: { minAddedObjects: 6, toolCounts: { AddObject: 6 } },
  },
  {
    id: "recital-stage",
    prompt:
      "Turn this room into a small recital room: a raised wooden stage across the back wall, a grand-piano-sized box on the stage, and twelve chairs in three rows facing the stage.",
    expect: { minAddedObjects: 14, toolCounts: { AddObject: 14 } },
  },
  {
    id: "ball-orbit",
    prompt:
      "Move the ball in a slow circle around the listener at the ball's height, radius 2 m, over 8 seconds, ending where it started.",
    expect: {
      paths: 1,
      path: { objectId: "ball", minSamples: 25, centre: "listener", radiusM: 2, durationS: 8 },
    },
  },
  {
    id: "two-paths-sound",
    prompt:
      "Add a small metal ball that plays the 220 Hz tone and flies a figure-eight in front of the listener over 12 seconds. At the same time, move the existing ball slowly back and forth along the left wall.",
    expect: { paths: 2, sources: 1, minAddedObjects: 1 },
  },
  {
    id: "treatment",
    prompt:
      "Acoustic treatment: change the back wall to the soft material, add four thick soft panels on the side walls at ear height, put a wooden diffuser box behind the speaker, and move the listener to the middle of the room facing the speaker.",
    expect: {
      minAddedObjects: 5,
      toolCounts: { AddObject: 5, SetMaterial: 1, MoveListener: 1 },
      listenerFacingTarget: "speaker",
    },
  },
  {
    id: "column-grid",
    prompt:
      "Add a 5 by 5 grid of slim metal columns, floor to ceiling height, evenly spaced across the room.",
    expect: { minAddedObjects: 25, toolCounts: { AddObject: 25 }, evenGrid: true },
  },
  {
    id: "over-limit",
    prompt: "Add 40 chairs in 5 rows of 8, facing the back wall, evenly spaced.",
    expect: { recordLimit: 32 },
  },
  {
    id: "edit-speaker",
    prompt:
      "Move the speaker to the back left corner, standing on the floor. Make it twice as tall. Remove the ball.",
    expect: { toolCounts: { MoveObject: 1, ResizeObject: 1, RemoveObject: 1 } },
  },
  {
    id: "build-then-edit",
    prompt:
      "Turn this room into a small recital room: a raised wooden stage across the back wall, a grand-piano-sized box on the stage, and twelve chairs in three rows facing the stage.",
    expect: { minAddedObjects: 14, toolCounts: { AddObject: 14 } },
    followUp: {
      prompt:
        "Move the audience 0.5 m further from the stage, make the stage 1 m deeper, and remove the back row of chairs.",
      expect: { toolCounts: { MoveObject: 8, ResizeObject: 1, RemoveObject: 4 } },
    },
  },
  {
    id: "arc-seating",
    prompt:
      "Arrange ten chairs in a curved arc, 3 m from the speaker, with every chair rotated so that its front faces the speaker.",
    expect: {
      minAddedObjects: 10,
      toolCounts: { AddObject: 10 },
      arcAround: { target: "speaker", radiusM: 3 },
    },
  },
  {
    id: "composite-table",
    prompt:
      "Build a dining table from separate parts: a top and four legs, with the legs on the floor and the top resting on them. Put a lamp on the table, made of a base and a shade.",
    expect: { minAddedObjects: 7, toolCounts: { AddObject: 7 } },
  },
  {
    id: "stairs",
    prompt:
      "Build a staircase of 8 steps rising toward the back wall. Each step is 0.2 m higher and 0.3 m further back than the last, with no gaps, and every step reaches the floor.",
    expect: { minAddedObjects: 8, toolCounts: { AddObject: 8 } },
  },
  {
    id: "three-orbits",
    prompt:
      "Add three small balls at different heights. Give each its own smooth circular path with 64 points over 16 seconds, each starting from a different point on its circle.",
    expect: { paths: 3, minAddedObjects: 3 },
  },
  {
    id: "vague-echo",
    prompt: "Make this room sound less echoey, without changing where anything is.",
    expect: {},
  },
  {
    id: "impossible-asset",
    prompt:
      "Cover the walls with velvet curtains and play a recording of a cello from the speaker.",
    expect: {},
  },
  {
    id: "zh-meeting-room",
    prompt: "把這個房間改成小型會議室：中間一張長桌，兩側各四張椅子，後方牆面加一塊白板。",
    expect: { minAddedObjects: 10, toolCounts: { AddObject: 10 } },
  },
  {
    id: "hall-in-stages",
    prompt: "Build an empty concert hall 14 m wide, 9 m high and 24 m long, with wooden surfaces.",
    expect: { createSceneAlone: true },
    followUp: {
      prompt:
        "Now add a raised stage across one end, and as many evenly spaced rows of seats as fit in this one step.",
      expect: { minAddedObjects: 20 },
    },
  },
  {
    id: "new-hall",
    prompt:
      "Build a small concert hall from scratch, 14 m wide, 9 m high and 24 m long, with wooden surfaces, a stage at one end and ten rows of seats.",
    expect: { createSceneAlone: true },
  },
];
