import assert from "node:assert/strict";
import test from "node:test";
import * as React from "react";
import { useFPSInput } from "./useFPSInput.js";
import type { LabAction, LabController, LabViewModel } from "../contracts.js";

function harness(options: { deferLock?: boolean; deferRun?: boolean; rawLockError?: string } = {}) {
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
  const runs: Array<() => void> = [];
  const model = {
    interactionMode: "editor",
    simulationState: "paused",
    alternativeInput: false,
    objects: [],
    placementGhost: null,
  } as unknown as LabViewModel;
  const controller = {
    getSnapshot: () => model,
    dispatch: (action: LabAction) => {
      actions.push(action);
      if (action.type === "enterFPS") return new Promise<void>((resolve) => pending.push(resolve));
      if (action.type === "run" && options.deferRun)
        return new Promise<void>((resolve) => runs.push(resolve));
    },
  } as unknown as LabController;
  const input = useFPSInput(controller, model);
  const lockRequests: Array<PointerLockOptions | undefined> = [];
  const canvas = {
    isConnected: true,
    focus() {},
    requestPointerLock(lockOptions?: PointerLockOptions) {
      lockRequests.push(lockOptions);
      if (lockOptions?.unadjustedMovement && options.rawLockError)
        return Promise.reject(
          Object.assign(new Error(options.rawLockError), { name: options.rawLockError }),
        );
      if (!options.deferLock) document.pointerLockElement = canvas;
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
    runs,
    lockRequests,
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

type Harness = ReturnType<typeof harness>;
function key(h: Harness, type: "keydown" | "keyup", code: string, target?: unknown) {
  const event = new Event(type) as KeyboardEvent;
  Object.defineProperty(event, "code", { value: code });
  if (target) Object.defineProperty(event, "target", { value: target });
  h.document.dispatchEvent(event);
}
function pointer(h: Harness, type: "pointerdown" | "pointerup", button = 0, ctrlKey = false) {
  const event = new Event(type) as PointerEvent;
  Object.defineProperty(event, "button", { value: button });
  Object.defineProperty(event, "ctrlKey", { value: ctrlKey });
  h.document.dispatchEvent(event);
}
const kinds = (actions: LabAction[]) => actions.map((action) => action.type);
async function enterFirstPerson(h: Harness) {
  const entry = h.input.enter();
  h.model.interactionMode = "fps-interact";
  h.pending[0]!();
  await entry;
}

test("R18: the entry click starts controls once its transaction and the native lock complete", async () => {
  const h = harness();
  try {
    const entry = h.input.enter();
    assert.equal(kinds(h.actions).includes("run"), false, "no start before the entry commits");
    h.model.interactionMode = "fps-interact";
    h.pending[0]!();
    await entry;
    const list = kinds(h.actions);
    const run = list.indexOf("run");
    assert.ok(run > list.indexOf("enterFPS"));
    assert.equal(list.filter((kind) => kind === "run").length, 1);
    const confirm = h.actions.findIndex(
      (action) => action.type === "pointerLockChanged" && action.locked,
    );
    assert.ok(confirm >= 0 && confirm < run, "the actual native owner is confirmed first");
    const release = h.actions.findIndex(
      (action) => action.type === "inputPointer" && !action.pressed,
    );
    assert.ok(release >= 0 && release < run, "the acquisition click is released before Resume");
    assert.equal(
      h.actions.some((action) => action.type === "inputPointer" && action.pressed),
      false,
      "the acquisition click is never forwarded as a throw",
    );
  } finally {
    h.cleanup();
  }
});

test("R18: a lock notification after the entry transaction starts that same entry exactly once", async () => {
  const h = harness({ deferLock: true });
  try {
    await enterFirstPerson(h);
    assert.equal(kinds(h.actions).includes("run"), false, "no Resume without the actual lock");
    h.document.pointerLockElement = h.canvas;
    h.document.dispatchEvent(new Event("pointerlockchange"));
    assert.equal(kinds(h.actions).filter((kind) => kind === "run").length, 1);
    h.document.dispatchEvent(new Event("pointerlockchange"));
    assert.equal(kinds(h.actions).filter((kind) => kind === "run").length, 1);
  } finally {
    h.cleanup();
  }
});

test("R18: an entry cancelled before its lock arrives never starts controls", async () => {
  const h = harness({ deferLock: true });
  try {
    await enterFirstPerson(h);
    key(h, "keydown", "Escape");
    h.document.pointerLockElement = h.canvas;
    h.document.dispatchEvent(new Event("pointerlockchange"));
    assert.equal(h.document.pointerLockElement, null, "an unwanted late lock is released");
    assert.equal(kinds(h.actions).includes("run"), false);
  } finally {
    h.cleanup();
  }
});

test("R18: reacquiring the lock while holding waits for Enter or a click, which never throws", async () => {
  for (const gesture of ["Enter", "click"] as const) {
    const h = harness();
    try {
      (h.model as unknown as { objects: unknown[] }).objects = [{ id: "ball", held: true }];
      await enterFirstPerson(h);
      assert.equal(kinds(h.actions).includes("run"), false, gesture);
      const before = h.actions.length;
      if (gesture === "Enter") key(h, "keydown", "Enter");
      else {
        pointer(h, "pointerdown", 0);
        assert.equal(
          h.actions.slice(before).length,
          0,
          "the press alone neither resumes nor reaches the host",
        );
        pointer(h, "pointerup", 0);
      }
      const after = h.actions.slice(before);
      assert.equal(kinds(after).filter((kind) => kind === "run").length, 1, gesture);
      assert.equal(
        after.some((action) => action.type === "inputPointer" && action.pressed),
        false,
        gesture,
      );
      if (gesture === "click") {
        assert.deepEqual(
          after.slice(0, 1),
          [{ type: "inputPointer", button: 0, pressed: false }],
          "the completed release reaches the host before Resume",
        );
      }
    } finally {
      h.cleanup();
    }
  }
});

test("R18: controls without pointer lock accept keys only from the focused view and never claim a lock", () => {
  const h = harness();
  try {
    Object.assign(h.model, {
      interactionMode: "fps-interact",
      simulationState: "paused",
      alternativeInput: true,
    });
    key(h, "keydown", "KeyW");
    key(h, "keydown", "Enter");
    assert.equal(h.actions.length, 0, "keys outside the 3D view stay with the page");
    key(h, "keydown", "Enter", h.canvas);
    assert.deepEqual(h.actions, [
      { type: "inputPointer", button: 0, pressed: false },
      { type: "inputPointer", button: 2, pressed: false },
      { type: "run" },
    ]);
    h.model.simulationState = "running";
    key(h, "keydown", "KeyW", h.canvas);
    key(h, "keydown", "ArrowLeft", h.canvas);
    key(h, "keyup", "KeyW", h.canvas);
    assert.deepEqual(h.actions.slice(3), [
      { type: "inputKey", code: "KeyW", pressed: true },
      { type: "inputLook", movementX: -24, movementY: 0 },
      { type: "inputKey", code: "KeyW", pressed: false },
    ]);
    assert.equal(
      h.actions.some((action) => action.type === "pointerLockChanged"),
      false,
      "alternative controls never report a native lock",
    );
  } finally {
    h.cleanup();
  }
});

test("R18: a press held across an Enter Resume is not a second Resume and is never forwarded", async () => {
  const h = harness();
  try {
    (h.model as unknown as { objects: unknown[] }).objects = [{ id: "ball", held: true }];
    await enterFirstPerson(h);
    const before = h.actions.length;
    pointer(h, "pointerdown", 0);
    key(h, "keydown", "Enter");
    h.model.simulationState = "running";
    pointer(h, "pointerup", 0);
    const after = h.actions.slice(before);
    assert.deepEqual(
      kinds(after).filter((kind) => kind === "run" || kind === "pause"),
      ["run"],
    );
    assert.equal(
      after.some((action) => action.type === "inputPointer" && action.pressed),
      false,
    );
    assert.deepEqual(after.at(-1), { type: "inputPointer", button: 0, pressed: false });
  } finally {
    h.cleanup();
  }
});

const TYPING_SELECTOR_PREFIX = "input, textarea, select, button";
function fakeElement(kind: "input" | "button") {
  const ElementClass = globalThis.Element as unknown as new () => object;
  return Object.assign(new ElementClass(), {
    closest: (selector: string) =>
      kind === "input" || selector.startsWith(TYPING_SELECTOR_PREFIX) ? {} : null,
  });
}
function interrupt(h: Harness, kind: "Tab" | "composition" | "focus-input" | "focus-button") {
  if (kind === "Tab") key(h, "keydown", "Tab");
  else if (kind === "composition") h.document.dispatchEvent(new Event("compositionstart"));
  else {
    const event = new Event("focusin");
    Object.defineProperty(event, "target", {
      value: fakeElement(kind === "focus-input" ? "input" : "button"),
    });
    h.document.dispatchEvent(event);
  }
}

test("R18 review: Tab, IME or text focus during a pending entry cancels it before the lock arrives", async () => {
  for (const kind of ["Tab", "composition", "focus-input"] as const) {
    const h = harness({ deferLock: true });
    try {
      await enterFirstPerson(h);
      interrupt(h, kind);
      assert.ok(kinds(h.actions).includes("inputBlur"), kind);
      h.document.pointerLockElement = h.canvas;
      h.document.dispatchEvent(new Event("pointerlockchange"));
      assert.equal(kinds(h.actions).includes("run"), false, `${kind}: no start after interruption`);
      assert.equal(h.document.pointerLockElement, null, `${kind}: the late lock is released`);
    } finally {
      h.cleanup();
    }
  }
});

test("R18 review: Tab, IME or text focus hands running no-lock controls back to the UI; buttons do not", () => {
  for (const kind of ["Tab", "composition", "focus-input", "focus-button"] as const) {
    const h = harness();
    try {
      Object.assign(h.model, {
        interactionMode: "fps-interact",
        simulationState: "running",
        alternativeInput: true,
      });
      key(h, "keydown", "KeyW", h.canvas);
      assert.deepEqual(h.actions.at(-1), { type: "inputKey", code: "KeyW", pressed: true });
      interrupt(h, kind);
      assert.equal(
        kinds(h.actions).includes("inputBlur"),
        kind !== "focus-button",
        `${kind}: alternative buttons remain usable controls`,
      );
    } finally {
      h.cleanup();
    }
  }
});

test("R18 review: Enter during a delayed lock notification starts exactly once", async () => {
  const h = harness({ deferLock: true });
  try {
    await enterFirstPerson(h);
    h.document.pointerLockElement = h.canvas;
    key(h, "keydown", "Enter");
    assert.equal(kinds(h.actions).filter((kind) => kind === "run").length, 1);
    assert.equal(kinds(h.actions).includes("pause"), false);
  } finally {
    h.cleanup();
  }
});

function pausedAlternative(h: Harness) {
  Object.assign(h.model, {
    interactionMode: "fps-interact",
    simulationState: "paused",
    alternativeInput: true,
  });
}

test("R18 review: Tab, IME or text focus during a pending no-lock Resume invalidates it; buttons do not", () => {
  for (const start of ["Enter", "button"] as const) {
    for (const kind of ["Tab", "composition", "focus-input", "focus-button"] as const) {
      const h = harness({ deferRun: true });
      try {
        pausedAlternative(h);
        if (start === "Enter") key(h, "keydown", "Enter", h.canvas);
        else h.input.resume();
        assert.equal(kinds(h.actions).filter((k) => k === "run").length, 1, `${start}/${kind}`);
        const before = h.actions.length;
        interrupt(h, kind);
        assert.equal(
          kinds(h.actions.slice(before)).includes("inputBlur"),
          kind !== "focus-button",
          `${start}/${kind}: the pending Resume must hand input back to the UI`,
        );
      } finally {
        h.cleanup();
      }
    }
  }
});

test("R18 review: after a cancelled no-lock Resume settles, a new Resume can start", async () => {
  const h = harness({ deferRun: true });
  try {
    pausedAlternative(h);
    key(h, "keydown", "Enter", h.canvas);
    interrupt(h, "Tab");
    key(h, "keydown", "Enter", h.canvas);
    assert.equal(kinds(h.actions).filter((k) => k === "run").length, 2);
    // The cancelled run settling must not clear the newer Resume's in-flight guard.
    h.runs[0]!();
    await new Promise((resolve) => setTimeout(resolve, 0));
    key(h, "keydown", "Enter", h.canvas);
    assert.equal(kinds(h.actions).filter((k) => k === "run").length, 2);
    h.runs.forEach((release) => release());
  } finally {
    h.cleanup();
  }
});

test("R21 locked FPS routes right press and release and suppresses its context menu", async () => {
  const h = harness();
  try {
    const entry = h.input.enter();
    h.model.interactionMode = "fps-interact";
    h.model.simulationState = "running";
    h.pending[0]!();
    await entry;
    h.document.dispatchEvent(new Event("pointerlockchange"));
    const before = h.actions.length;
    for (const type of ["pointerdown", "pointerup"]) {
      const event = new Event(type, { cancelable: true });
      Object.defineProperty(event, "button", { value: 2 });
      h.document.dispatchEvent(event);
    }
    assert.deepEqual(
      h.actions.slice(before).filter((action) => action.type === "inputPointer"),
      [
        { type: "inputPointer", button: 2, pressed: true },
        { type: "inputPointer", button: 2, pressed: false },
      ],
    );
    const menu = new Event("contextmenu", { cancelable: true });
    h.document.dispatchEvent(menu);
    assert.equal(menu.defaultPrevented, true);
    h.document.pointerLockElement = null;
    const ordinary = new Event("contextmenu", { cancelable: true });
    h.document.dispatchEvent(ordinary);
    assert.equal(ordinary.defaultPrevented, false);
  } finally {
    h.cleanup();
  }
});

test("R21 Esc cancels a preview while keeping native input ownership", async () => {
  const h = harness();
  try {
    const entry = h.input.enter();
    h.model.interactionMode = "fps-interact";
    h.model.simulationState = "running";
    h.pending[0]!();
    await entry;
    h.document.dispatchEvent(new Event("pointerlockchange"));
    h.model.placementGhost = { stage: "preview" } as NonNullable<LabViewModel["placementGhost"]>;
    const before = h.actions.length;
    key(h, "keydown", "Escape", h.canvas);
    assert.ok(h.actions.slice(before).some((action) => action.type === "cancelPlacement"));
    assert.equal(
      h.actions.slice(before).some((action) => action.type === "inputBlur"),
      false,
    );
    assert.equal(h.document.pointerLockElement, h.canvas);
  } finally {
    h.cleanup();
  }
});

test("first-person entry asks for raw mouse counts and falls back only when unsupported", async () => {
  for (const [rawLockError, requests, locked] of [
    [undefined, [{ unadjustedMovement: true }], true],
    ["NotSupportedError", [{ unadjustedMovement: true }, undefined], true],
    ["NotAllowedError", [{ unadjustedMovement: true }], false],
  ] as const) {
    const h = harness(rawLockError ? { rawLockError } : {});
    try {
      const entry = h.input.enter();
      h.model.interactionMode = "fps-interact";
      h.pending[0]!();
      await entry;
      assert.deepEqual(h.lockRequests, requests, String(rawLockError));
      assert.equal(h.document.pointerLockElement === h.canvas, locked, String(rawLockError));
    } finally {
      h.cleanup();
    }
  }
});

test("locked look drops an isolated movement spike instead of turning the view", async () => {
  const h = harness();
  try {
    const entry = h.input.enter();
    h.model.interactionMode = "fps-interact";
    h.model.simulationState = "running";
    h.pending[0]!();
    await entry;
    h.document.dispatchEvent(new Event("pointerlockchange"));
    const before = h.actions.length;
    for (const [movementX, movementY, timeStamp] of [
      [4, 1, 0],
      [-700, 40, 16],
      [5, 0, 32],
    ]) {
      const event = new Event("mousemove");
      Object.defineProperties(event, {
        movementX: { value: movementX },
        movementY: { value: movementY },
        timeStamp: { value: timeStamp },
      });
      h.document.dispatchEvent(event);
    }
    assert.deepEqual(
      h.actions.slice(before).filter((action) => action.type === "inputLook"),
      [
        { type: "inputLook", movementX: 4, movementY: 1 },
        { type: "inputLook", movementX: 5, movementY: 0 },
      ],
    );
  } finally {
    h.cleanup();
  }
});

function look(h: Harness, movementX: number, movementY: number, timeStamp: number) {
  const event = new Event("mousemove");
  Object.defineProperties(event, {
    movementX: { value: movementX },
    movementY: { value: movementY },
    timeStamp: { value: timeStamp },
  });
  h.document.dispatchEvent(event);
}
/** Locked first person whose entry Resume has settled, in the given simulation state. */
async function lockedView(h: Harness, state: LabViewModel["simulationState"]) {
  await enterFirstPerson(h);
  await new Promise((resolve) => setTimeout(resolve, 0));
  h.model.simulationState = state;
}
const STROKE: NonNullable<LabViewModel["paint"]> = {
  objectId: "ball",
  pointsM: [[0, 1.6, 2.5]],
  distanceM: 1.5,
};

test("Ctrl+left press paints instead of throwing or resuming; its release ends the stroke, not the pause", async () => {
  for (const state of ["running", "ready"] as const) {
    const h = harness();
    try {
      await lockedView(h, state);
      const before = h.actions.length;
      pointer(h, "pointerdown", 0, true);
      assert.deepEqual(h.actions.slice(before), [{ type: "paintStart" }], state);
      // The runtime froze the room; look stays gated until it publishes the stroke.
      h.model.simulationState = "ready";
      look(h, 4, 1, 0);
      assert.equal(h.actions.length, before + 1, `${state}: no look before the stroke exists`);
      h.model.paint = structuredClone(STROKE);
      look(h, 5, 0, 16);
      // Ctrl was let go during the stroke; the button release alone ends it.
      pointer(h, "pointerup", 0);
      assert.deepEqual(
        h.actions.slice(before),
        [
          { type: "paintStart" },
          { type: "inputLook", movementX: 5, movementY: 0 },
          { type: "paintEnd" },
          { type: "inputPointer", button: 0, pressed: false },
        ],
        `${state}: neither the press nor the release is a Resume`,
      );
      h.model.paint = null;
      pointer(h, "pointerdown", 0);
      pointer(h, "pointerup", 0);
      assert.equal(
        kinds(h.actions.slice(before)).filter((kind) => kind === "run").length,
        1,
        `${state}: a later plain click starts the take`,
      );
    } finally {
      h.cleanup();
    }
  }
});

test("Enter during a stroke does not start the take; Enter after it does", async () => {
  const h = harness();
  try {
    await lockedView(h, "running");
    const before = h.actions.length;
    pointer(h, "pointerdown", 0, true);
    Object.assign(h.model, { simulationState: "ready", paint: structuredClone(STROKE) });
    key(h, "keydown", "Enter");
    key(h, "keyup", "Enter");
    assert.deepEqual(kinds(h.actions.slice(before)), ["paintStart"]);
    pointer(h, "pointerup", 0);
    h.model.paint = null;
    key(h, "keydown", "Enter");
    assert.deepEqual(
      kinds(h.actions.slice(before)).filter((kind) => kind === "run" || kind === "pause"),
      ["run"],
    );
  } finally {
    h.cleanup();
  }
});

test("focus loss during a stroke hands input back, and the later release ends nothing", async () => {
  const h = harness();
  try {
    await lockedView(h, "running");
    const before = h.actions.length;
    pointer(h, "pointerdown", 0, true);
    Object.assign(h.model, { simulationState: "ready", paint: structuredClone(STROKE) });
    h.window.dispatchEvent(new Event("blur"));
    assert.ok(kinds(h.actions.slice(before)).includes("inputBlur"));
    assert.equal(h.document.pointerLockElement, null);
    pointer(h, "pointerup", 0);
    assert.equal(kinds(h.actions.slice(before)).includes("paintEnd"), false);
  } finally {
    h.cleanup();
  }
});
