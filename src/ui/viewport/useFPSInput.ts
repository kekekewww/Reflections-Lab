import { useEffect, useRef, useState } from "react";
import type { LabController, LabViewModel } from "../contracts.js";
import { acceptsFPSKey, isTextEntryElement, isTypingElement } from "./input-policy.js";
import { ReleaseLedger } from "./release-ledger.js";
import { LookSpikeFilter } from "./look-filter.js";
import { useLocale } from "../locale.js";

const tracksFPSKey = (code: string) =>
  acceptsFPSKey({
    code,
    isComposing: false,
    repeat: false,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    typing: false,
    locked: true,
    running: true,
  });
const tracksPointerButton = (button: number) =>
  Number.isSafeInteger(button) && button >= 0 && button <= 4;
/** Raw mouse counts (IC-01); platforms without it fall back to adjusted movement. */
async function requestRawPointerLock(surface: HTMLCanvasElement): Promise<void> {
  try {
    await surface.requestPointerLock({ unadjustedMovement: true });
  } catch (error) {
    if ((error as { name?: unknown } | null)?.name !== "NotSupportedError") throw error;
    await surface.requestPointerLock();
  }
}
/** Keyboard look steps for the explicit controls without pointer lock (look units). */
const alternativeLook: Readonly<Record<string, readonly [number, number]>> = {
  ArrowLeft: [-24, 0],
  ArrowRight: [24, 0],
  ArrowUp: [0, -16],
  ArrowDown: [0, 16],
};

export function useFPSInput(controller: LabController, model: LabViewModel) {
  const { message } = useLocale();
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const current = useRef(model);
  const composing = useRef(false);
  const armed = useRef(false);
  const pressedKeys = useRef(new ReleaseLedger<string>(32, tracksFPSKey));
  const pressedButtons = useRef(new ReleaseLedger<number>(5, tracksPointerButton));
  const lookFilter = useRef(new LookSpikeFilter());
  const hadLock = useRef(false);
  const attempt = useRef(0);
  const wantsLock = useRef(false);
  // Generation of the explicit entry whose transaction completed and may start controls.
  const entryStart = useRef<number | null>(null);
  const startEntry = useRef<() => void>(() => {});
  const enterRef = useRef<() => Promise<void>>(async () => {});
  // A primary press that began on the locked, paused view; its release resumes.
  const resumeClick = useRef(false);
  // A Ctrl+primary press that asked to paint; its release ends the stroke and never resumes.
  const paintPress = useRef(false);
  // One Resume at a time: entry start and explicit Enter/click share this guard.
  const starting = useRef(false);
  // Identity of the Resume in flight; handover to the UI invalidates it.
  const resumeToken = useRef(0);
  const resumeRef = useRef<() => void>(() => {});
  const [locked, setLocked] = useState(false);
  const [entering, setEntering] = useState(false);
  const [lockError, setLockError] = useState<string | null>(null);
  current.current = model;

  useEffect(() => {
    const clear = () => {
      attempt.current++;
      entryStart.current = null;
      resumeClick.current = false;
      paintPress.current = false;
      resumeToken.current++;
      starting.current = false;
      wantsLock.current = false;
      setEntering(false);
      armed.current = false;
      pressedKeys.current.suspend();
      pressedButtons.current.suspend();
      void controller.dispatch({ type: "inputBlur" });
    };
    const lockedHere = () => !!canvas.current && document.pointerLockElement === canvas.current;
    // An explicit entry is waiting for the browser's lock; interruptions cancel it.
    const pendingEntry = () => wantsLock.current && !lockedHere();
    // Running, key-holding or Resume-pending no-lock controls; UI focus must
    // take them back (the pending run commits only if inputBlur never arrives).
    const alternativeOwnsInput = () =>
      !lockedHere() &&
      current.current.alternativeInput === true &&
      current.current.interactionMode !== "editor" &&
      (current.current.simulationState === "running" ||
        pressedKeys.current.size > 0 ||
        starting.current);
    const releaseToUI = () => {
      if (lockedHere()) document.exitPointerLock();
      clear();
    };
    const lockChange = () => {
      const hasLock = lockedHere();
      if (hasLock && !wantsLock.current) {
        document.exitPointerLock();
        return;
      }
      const previouslyOwned = hadLock.current;
      // Native ownership can precede notification. An explicit Enter may have
      // already reconciled it; a late duplicate must preserve held input.
      if (hasLock === previouslyOwned) return;
      hadLock.current = hasLock;
      lookFilter.current.reset();
      setLocked(hasLock);
      void controller.dispatch({ type: "pointerLockChanged", locked: hasLock });
      armed.current = hasLock;
      if (hasLock) {
        setLockError(null);
        canvas.current?.focus({ preventScroll: true });
        // Lock is requested by a click handler, after its pointerup. The host's
        // acquisition barrier must see that completed release before a new press.
        for (const button of [0, 2])
          if (!pressedButtons.current.hasUnreleased(button))
            void controller.dispatch({ type: "inputPointer", button, pressed: false });
        startOwnedEntry();
      } else if (previouslyOwned) clear();
    };
    // Enter, a click on the locked view and the entry button are explicit Resume
    // gestures. Observe the actual native owner first: pointerlockchange can
    // arrive after this distinct user action.
    const resumeControls = () => {
      if (starting.current) return;
      lockChange();
      const snapshot = controller.getSnapshot();
      if (snapshot.interactionMode === "editor" || snapshot.simulationState === "running") return;
      if (!lockedHere() && !snapshot.alternativeInput) return;
      for (const button of [0, 2])
        if (!pressedButtons.current.hasUnreleased(button))
          void controller.dispatch({ type: "inputPointer", button, pressed: false });
      starting.current = true;
      const token = ++resumeToken.current;
      void Promise.resolve(controller.dispatch({ type: "run" })).finally(() => {
        if (token === resumeToken.current) starting.current = false;
      });
    };
    resumeRef.current = resumeControls;
    // The entry click itself starts controls once its transaction and the actual
    // native lock both completed (R18). Held or placement states keep waiting for
    // an explicit Resume after reacquisition.
    const startOwnedEntry = () => {
      if (entryStart.current === null || entryStart.current !== attempt.current) return;
      if (!lockedHere()) return;
      entryStart.current = null;
      lockChange();
      // Text entry and IME composition own the keyboard; never start under them.
      const focus = document.activeElement;
      if (composing.current || (focus !== canvas.current && isTextEntryElement(focus))) return;
      const snapshot = controller.getSnapshot();
      if (snapshot.placementGhost || snapshot.objects.some((object) => object.held)) return;
      resumeControls();
    };
    startEntry.current = startOwnedEntry;
    const lockFailed = () => {
      // This native event has no request identity. A prior request may fail
      // after a newer one succeeds (or while it is pending); never revoke it.
      // Promise rejection below handles the current request when supported.
      if (wantsLock.current && !lockedHere())
        setLockError("瀏覽器未提供滑鼠鎖定，仍可使用下方按鈕操作。");
    };
    const keyDown = (event: KeyboardEvent) => {
      // The browser can own the lock before pointerlockchange moves focus off
      // the acquisition button. Tab must release a real lock in that window, and
      // also cancels a pending entry or hands running no-lock controls to the UI.
      if (event.code === "Tab" && (lockedHere() || pendingEntry() || alternativeOwnsInput())) {
        releaseToUI();
        return;
      }
      const typing = isTypingElement(event.target instanceof Element ? event.target : null);
      if (event.isComposing || composing.current || typing) return;
      if (
        event.code === "Escape" &&
        (wantsLock.current || current.current.interactionMode !== "editor")
      ) {
        if (controller.getSnapshot().placementGhost?.stage === "preview") {
          event.preventDefault();
          void controller.dispatch({ type: "cancelPlacement" });
          return;
        }
        if (lockedHere()) document.exitPointerLock();
        clear();
        return;
      }
      const native = lockedHere();
      // Explicit controls without pointer lock own keys only while the 3D view
      // itself has focus; they never claim a native lock.
      const alternative =
        !native &&
        current.current.alternativeInput === true &&
        current.current.interactionMode !== "editor" &&
        event.target === canvas.current;
      if (!native && !alternative) return;
      const modified = event.ctrlKey || event.metaKey || event.altKey;
      if (
        event.code === "Enter" &&
        current.current.interactionMode !== "editor" &&
        !event.repeat &&
        !modified
      ) {
        event.preventDefault();
        // The take starts after the stroke, never in the middle of it.
        if (paintPress.current) return;
        lockChange();
        // A Resume already in flight (e.g. started by the lock reconciliation
        // above) consumes this Enter; it is neither a second start nor a pause.
        if (starting.current) return;
        if (current.current.simulationState === "running")
          void controller.dispatch({ type: "pause" });
        else resumeControls();
        return;
      }
      const look = alternative ? alternativeLook[event.code] : undefined;
      if (look && !modified && current.current.simulationState === "running") {
        event.preventDefault();
        void controller.dispatch({ type: "inputLook", movementX: look[0], movementY: look[1] });
        return;
      }
      if (
        acceptsFPSKey({
          code: event.code,
          isComposing: event.isComposing || composing.current,
          repeat: event.repeat,
          ctrlKey: event.ctrlKey,
          metaKey: event.metaKey,
          altKey: event.altKey,
          typing,
          locked: native ? armed.current : alternative,
          running: current.current.simulationState === "running",
        })
      ) {
        event.preventDefault();
        if (pressedKeys.current.press(event.code)) {
          void controller.dispatch({ type: "inputKey", code: event.code, pressed: true });
          if (event.code === "KeyL" && lockedHere()) document.exitPointerLock();
        }
      }
    };
    const keyUp = (event: KeyboardEvent) => {
      if (pressedKeys.current.release(event.code))
        void controller.dispatch({ type: "inputKey", code: event.code, pressed: false });
    };
    const pointerDown = (event: PointerEvent) => {
      if (!lockedHere()) return;
      if (!pressedButtons.current.press(event.button)) return;
      if (!armed.current) return;
      // Ctrl only has to be held for the press; the runtime freezes the room and starts the
      // stroke. The press is neither a throw nor, on a paused view, a Resume.
      if (event.button === 0 && event.ctrlKey && current.current.interactionMode !== "editor") {
        resumeClick.current = false;
        paintPress.current = true;
        void controller.dispatch({ type: "paintStart" });
        return;
      }
      if (current.current.simulationState !== "running") {
        // A primary click on the locked, paused view is an explicit Resume on its
        // release. The press is never forwarded, so it cannot throw or place.
        resumeClick.current = event.button === 0 && current.current.interactionMode !== "editor";
        return;
      }
      void controller.dispatch({ type: "inputPointer", button: event.button, pressed: true });
    };
    const click = (event: MouseEvent) => {
      // Clicking the released first-person view explicitly asks to lock it again.
      if (event.button !== 0 || event.target !== canvas.current || lockedHere()) return;
      const view = current.current;
      if (view.interactionMode === "editor" || view.alternativeInput || wantsLock.current) return;
      void enterRef.current();
    };
    const pointerUp = (event: PointerEvent) => {
      const resume = event.button === 0 && resumeClick.current;
      const painted = event.button === 0 && paintPress.current;
      if (event.button === 0) {
        resumeClick.current = false;
        paintPress.current = false;
      }
      // Ends the stroke before the release reaches the host; the room stays frozen.
      if (painted) void controller.dispatch({ type: "paintEnd" });
      if (pressedButtons.current.release(event.button))
        void controller.dispatch({ type: "inputPointer", button: event.button, pressed: false });
      // A press held across another Resume (e.g. Enter) is not a second Resume.
      if (resume && lockedHere() && current.current.simulationState !== "running") resumeControls();
    };
    const look = (event: MouseEvent) => {
      // A stroke looks around on the frozen room.
      if (
        lockedHere() &&
        armed.current &&
        !composing.current &&
        (current.current.simulationState === "running" || current.current.paint)
      ) {
        for (const [movementX, movementY] of lookFilter.current.accept(
          event.movementX,
          event.movementY,
          event.timeStamp,
        ))
          void controller.dispatch({ type: "inputLook", movementX, movementY });
      }
    };
    const wheel = (event: WheelEvent) => {
      const ownsViewport =
        (lockedHere() && armed.current) ||
        (current.current.alternativeInput &&
          current.current.interactionMode !== "editor" &&
          event.target === canvas.current);
      if (!ownsViewport || event.ctrlKey || event.metaKey) return;
      event.preventDefault();
      void controller.dispatch({ type: "inputWheel", deltaY: event.deltaY });
    };
    const contextMenu = (event: MouseEvent) => {
      if (
        current.current.interactionMode !== "editor" &&
        (lockedHere() || (current.current.alternativeInput && event.target === canvas.current))
      )
        event.preventDefault();
    };
    const blur = () => {
      if (lockedHere()) document.exitPointerLock();
      if (wantsLock.current || current.current.interactionMode !== "editor") clear();
    };
    const hidden = () => {
      if (document.hidden) blur();
    };
    const compositionStart = () => {
      composing.current = true;
      if (lockedHere() || pendingEntry() || alternativeOwnsInput()) releaseToUI();
    };
    const compositionEnd = () => {
      composing.current = false;
    };
    const focusUI = (event: FocusEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if ((lockedHere() || pendingEntry()) && isTypingElement(target)) releaseToUI();
      // No-lock controls are buttons; only text entry takes the keyboard back.
      else if (alternativeOwnsInput() && isTextEntryElement(target)) releaseToUI();
    };
    document.addEventListener("pointerlockchange", lockChange);
    document.addEventListener("pointerlockerror", lockFailed);
    document.addEventListener("keydown", keyDown);
    document.addEventListener("keyup", keyUp);
    document.addEventListener("pointerdown", pointerDown);
    document.addEventListener("pointerup", pointerUp);
    document.addEventListener("click", click);
    document.addEventListener("mousemove", look);
    document.addEventListener("wheel", wheel, { passive: false });
    document.addEventListener("contextmenu", contextMenu);
    document.addEventListener("visibilitychange", hidden);
    document.addEventListener("compositionstart", compositionStart);
    document.addEventListener("compositionend", compositionEnd);
    document.addEventListener("focusin", focusUI);
    window.addEventListener("blur", blur);
    return () => {
      document.removeEventListener("pointerlockchange", lockChange);
      document.removeEventListener("pointerlockerror", lockFailed);
      document.removeEventListener("keydown", keyDown);
      document.removeEventListener("keyup", keyUp);
      document.removeEventListener("pointerdown", pointerDown);
      document.removeEventListener("pointerup", pointerUp);
      document.removeEventListener("click", click);
      document.removeEventListener("mousemove", look);
      document.removeEventListener("wheel", wheel);
      document.removeEventListener("contextmenu", contextMenu);
      document.removeEventListener("visibilitychange", hidden);
      document.removeEventListener("compositionstart", compositionStart);
      document.removeEventListener("compositionend", compositionEnd);
      document.removeEventListener("focusin", focusUI);
      window.removeEventListener("blur", blur);
      if (lockedHere()) document.exitPointerLock();
      if (
        wantsLock.current ||
        hadLock.current ||
        current.current.interactionMode !== "editor" ||
        pressedKeys.current.size ||
        pressedButtons.current.size
      )
        clear();
    };
  }, [controller]);

  useEffect(() => {
    if (model.interactionMode === "editor" && document.pointerLockElement === canvas.current)
      document.exitPointerLock();
  }, [model.interactionMode]);

  const enter = async () => {
    const surface = canvas.current;
    if (!surface?.isConnected) {
      setLockError("三維畫面尚未準備好；請重試三維顯示後再進入第一人稱。");
      return;
    }
    const generation = ++attempt.current;
    wantsLock.current = true;
    setEntering(true);
    setLockError(null);
    // This handler runs on click (after release); its pointerdown cannot become a throw.
    // Move focus before changing the acquisition button into an Exit button.
    // pointerlockchange may arrive after the next keyboard event; Enter must
    // already target the canvas instead of activating that same button again.
    surface.focus({ preventScroll: true });
    armed.current = false;
    pressedKeys.current.suspend();
    pressedButtons.current.suspend();
    const entry = Promise.resolve(controller.dispatch({ type: "enterFPS" }));
    let entered = false;
    try {
      if (!surface.requestPointerLock) throw new Error("Pointer Lock unavailable");
      const request = requestRawPointerLock(surface);
      await Promise.all([entry, request]);
      if (attempt.current !== generation || controller.getSnapshot().interactionMode === "editor") {
        if (attempt.current === generation) wantsLock.current = false;
        if (!wantsLock.current && document.pointerLockElement === surface)
          document.exitPointerLock();
        if (attempt.current === generation)
          setLockError("無法進入第一人稱；請確認目前操作已完成後重試。");
      } else {
        if (
          document.pointerLockElement === surface &&
          hadLock.current &&
          !pressedButtons.current.hasUnreleased(0)
        )
          // Entry can reset the release barrier after an early native lock event.
          void controller.dispatch({ type: "inputPointer", button: 0, pressed: false });
        entered = true;
      }
    } catch {
      await entry;
      if (attempt.current !== generation) return;
      wantsLock.current = false;
      setLockError("無法鎖定滑鼠；請使用替代操作，或明示重試。");
      void controller.dispatch({ type: "pointerLockChanged", locked: false });
      void controller.dispatch({ type: "inputBlur" });
    } finally {
      if (attempt.current === generation) setEntering(false);
    }
    if (!entered || attempt.current !== generation) return;
    // Start now if the browser already owns the lock; otherwise its later
    // pointerlockchange starts this same generation. Outside the lock-failure path.
    entryStart.current = generation;
    startEntry.current();
  };
  enterRef.current = enter;
  const exit = () => {
    attempt.current++;
    entryStart.current = null;
    wantsLock.current = false;
    setEntering(false);
    if (document.pointerLockElement === canvas.current) document.exitPointerLock();
    armed.current = false;
    pressedKeys.current.suspend();
    pressedButtons.current.suspend();
    void controller.dispatch({ type: "inputBlur" });
    void controller.dispatch({ type: "exitFPS" });
  };
  // Localize on render; the physical input effect must depend only on its controller.
  return {
    canvas,
    locked,
    entering,
    lockError: lockError ? message(lockError) : null,
    enter,
    exit,
    /** Explicit Resume from the visible controls; shares the keyboard path's pending-intent tracking. */
    resume: () => resumeRef.current(),
  };
}
