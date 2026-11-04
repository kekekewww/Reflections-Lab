import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LabRuntime } from "../app/runtime.js";
import type { LabViewModel, PlacementGhostView } from "./contracts.js";
import { LocaleProvider } from "./locale.js";
import { Viewport } from "./Viewport.js";

test("accessible gentle placement uses the held state while ghost placement keeps valid/preview guards", async () => {
  const app = await LabRuntime.create({ useWorker: false });
  const ghost: PlacementGhostView = {
    positionM: [0, 1, 1],
    orientationQuaternion: [0, 0, 0, 1],
    shape: "box",
    dimensionsM: [0.5, 0.5, 0.5],
    stage: "preview",
    valid: true,
  };
  try {
    const base = app.getSnapshot();
    const cases: {
      held: boolean;
      running: boolean;
      ghost: PlacementGhostView | null;
      label: string;
      disabled: boolean;
    }[] = [
      { held: true, running: true, ghost: null, label: "輕放", disabled: false },
      { held: true, running: false, ghost: null, label: "輕放", disabled: true },
      { held: false, running: true, ghost: null, label: "放置", disabled: true },
      { held: false, running: true, ghost, label: "放置", disabled: false },
      {
        held: false,
        running: true,
        ghost: { ...ghost, valid: false },
        label: "放置",
        disabled: true,
      },
      {
        held: false,
        running: true,
        ghost: { ...ghost, stage: "pending" },
        label: "放置",
        disabled: true,
      },
      { held: true, running: true, ghost, label: "輕放", disabled: true },
    ];
    for (const state of cases) {
      const model: LabViewModel = {
        ...base,
        interactionMode: "fps-interact",
        simulationState: state.running ? "running" : "paused",
        placementGhost: state.ghost,
        objects: base.objects.map((object) => ({
          ...object,
          held: state.held && object.id === "ball",
        })),
      };
      const html = renderToStaticMarkup(
        createElement(LocaleProvider, null, createElement(Viewport, { controller: app, model })),
      );
      const match = html.match(new RegExp("<button([^>]*)>" + state.label + "</button>"));
      assert.ok(match, "the current placement action has its own visible label");
      assert.equal(/disabled/.test(match[1]!), state.disabled, JSON.stringify(state));
    }
  } finally {
    app.dispose();
  }
});
