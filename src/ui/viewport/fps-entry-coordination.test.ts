import assert from "node:assert/strict";
import test from "node:test";
import * as React from "react";
import { useFPSInput } from "./useFPSInput.js";
import type { LabAction, LabController, LabViewModel } from "../contracts.js";

function harness() {
  const internals = (
    React as unknown as {
      __CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE: { H: unknown };
    }
  ).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
  const oldDispatcher = internals.H;
  const oldDocument = globalThis.document;
  const oldWindow = globalThis.window;
  const oldElement = globalThis.Element;
  const effects: Array<() => void | (() => void)> = [];
  const cleanups: Array<() => void> = [];
  const document = new EventTarget() as EventTarget & {
    pointerLockElement: unknown;
    hidden: boolean;
    exitPointerLock(): void;
  };
  const window = new EventTarget();
  document.pointerLockElement = null;
  document.hidden = false;
  document.exitPointerLock = () => {
    document.pointerLockElement = null;
  };
  Object.assign(globalThis, { document, window, Element: class Element {} });
  internals.H = {
    useContext: () => ({ message: (raw: string) => raw }),
    useRef: (value: unknown) => ({ current: value }),
    useState: (value: unknown) => [value, () => {}],
    useEffect: (effect: () => void | (() => void)) => effects.push(effect),
  };
  const actions: LabAction[] = [];
  const pending: Array<() => void> = [];
  const model = { interactionMode: "editor", simulationState: "paused" } as LabViewModel;
  const controller = {
    getSnapshot: () => model,
    dispatch: (action: LabAction) => {
      actions.push(action);
      if (action.type === "enterFPS") return new Promise<void>((resolve) => pending.push(resolve));
    },
  } as unknown as LabController;
  const input = useFPSInput(controller, model);
  const canvas = {
    isConnected: true,
    focus() {},
    requestPointerLock() {
      document.pointerLockElement = canvas;
    },
  } as unknown as HTMLCanvasElement;
  input.canvas.current = canvas;
  for (const effect of effects) {
    const cleanup = effect();
    if (cleanup) cleanups.push(cleanup);
  }
  return {
    input,
    canvas,
    document,
    window,
    model,
    actions,
    pending,
    cleanup() {
      cleanups.forEach((fn) => fn());
      internals.H = oldDispatcher;
      Object.assign(globalThis, { document: oldDocument, window: oldWindow, Element: oldElement });
    },
  };
}

test("blur and hidden cancel a pending editor entry even before lock notification", async () => {
  for (const cause of ["blur", "hidden"]) {
    const h = harness();
    try {
      const entry = h.input.enter();
      if (cause === "blur") h.window.dispatchEvent(new Event("blur"));
      else {
        h.document.hidden = true;
        h.document.dispatchEvent(new Event("visibilitychange"));
      }
      assert.ok(
        h.actions.some((action) => action.type === "inputBlur"),
        cause,
      );
      h.pending[0]!();
      await entry;
      assert.equal(h.document.pointerLockElement, null);
    } finally {
      h.cleanup();
    }
  }
});

test("completion of canceled A cannot release newer B's canvas lock", async () => {
  const h = harness();
  try {
    const a = h.input.enter();
    h.input.exit();
    const b = h.input.enter();
    h.model.interactionMode = "fps-interact";
    h.pending[1]!();
    await b;
    assert.equal(h.document.pointerLockElement, h.canvas);
    h.pending[0]!();
    await a;
    assert.equal(h.document.pointerLockElement, h.canvas);
  } finally {
    h.cleanup();
  }
});

test("Escape cancels pending entry before pointerlockchange", async () => {
  const h = harness();
  try {
    const entry = h.input.enter();
    const event = new Event("keydown") as KeyboardEvent;
    Object.defineProperty(event, "code", { value: "Escape" });
    h.document.dispatchEvent(event);
    assert.ok(h.actions.some((action) => action.type === "inputBlur"));
    h.pending[0]!();
    await entry;
    assert.equal(h.document.pointerLockElement, null);
  } finally {
    h.cleanup();
  }
});

test("late pointerlockerror cannot cancel a new lock already owned by the canvas", async () => {
  const h = harness();
  try {
    const entry = h.input.enter();
    h.document.dispatchEvent(new Event("pointerlockchange"));
    const count = h.actions.length;
    h.document.dispatchEvent(new Event("pointerlockerror"));
    assert.equal(
      h.actions.slice(count).some((action) => action.type === "inputBlur"),
      false,
    );
    h.model.interactionMode = "fps-interact";
    h.pending[0]!();
    await entry;
    assert.equal(h.document.pointerLockElement, h.canvas);
  } finally {
    h.cleanup();
  }
});
