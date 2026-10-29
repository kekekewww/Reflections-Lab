import { useEffect, useRef, useState } from "react";
import type { LabController, LabViewModel } from "../contracts.js";
import { acceptsFPSKey, isTypingElement } from "./input-policy.js";
import { ReleaseLedger } from "./release-ledger.js";
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

export function useFPSInput(controller: LabController, model: LabViewModel) {
  const { message } = useLocale();
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const current = useRef(model);
  const composing = useRef(false);
  const armed = useRef(false);
  const pressedKeys = useRef(new ReleaseLedger<string>(32, tracksFPSKey));
  const pressedButtons = useRef(new ReleaseLedger<number>(5, tracksPointerButton));
  const hadLock = useRef(false);
  const attempt = useRef(0);
  const wantsLock = useRef(false);
  const [locked, setLocked] = useState(false);
  const [entering, setEntering] = useState(false);
  const [lockError, setLockError] = useState<string | null>(null);
  current.current = model;

  useEffect(() => {
    const clear = () => {
      attempt.current++;
      wantsLock.current = false;
      setEntering(false);
      armed.current = false;
      pressedKeys.current.suspend();
      pressedButtons.current.suspend();
      void controller.dispatch({ type: "inputBlur" });
    };
    const lockedHere = () => !!canvas.current && document.pointerLockElement === canvas.current;
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
      setLocked(hasLock);
      void controller.dispatch({ type: "pointerLockChanged", locked: hasLock });
      armed.current = hasLock;
      if (hasLock) {
        setLockError(null);
        canvas.current?.focus({ preventScroll: true });
        // Lock is requested by a click handler, after its pointerup. The host's
        // acquisition barrier must see that completed release before a new press.
        if (!pressedButtons.current.hasUnreleased(0))
          void controller.dispatch({ type: "inputPointer", button: 0, pressed: false });
      } else if (previouslyOwned) clear();
    };
    const lockFailed = () => {
      // This native event has no request identity. A prior request may fail
      // after a newer one succeeds (or while it is pending); never revoke it.
      // Promise rejection below handles the current request when supported.
      if (wantsLock.current && !lockedHere())
        setLockError("瀏覽器未提供滑鼠鎖定，仍可使用下方按鈕操作。");
    };
    const keyDown = (event: KeyboardEvent) => {
      // The browser can own the lock before pointerlockchange moves focus off
      // the acquisition button. Tab must release a real lock in that window.
      if (event.code === "Tab" && lockedHere()) {
        document.exitPointerLock();
        clear();
        return;
      }
      const typing = isTypingElement(event.target instanceof Element ? event.target : null);
      if (event.isComposing || composing.current || typing) return;
      if (
        event.code === "Escape" &&
        (wantsLock.current || current.current.interactionMode !== "editor")
      ) {
        if (lockedHere()) document.exitPointerLock();
        clear();
        return;
      }
      if (!lockedHere()) return;
      if (
        event.code === "Enter" &&
        current.current.interactionMode !== "editor" &&
        !event.repeat &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey
      ) {
        event.preventDefault();
        // Observe the actual native owner before asking the host to resume;
        // pointerlockchange can arrive after this distinct user action.
        lockChange();
        if (
          current.current.simulationState !== "running" &&
          !pressedButtons.current.hasUnreleased(0)
        )
          void controller.dispatch({ type: "inputPointer", button: 0, pressed: false });
        void controller.dispatch({
          type: current.current.simulationState === "running" ? "pause" : "run",
        });
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
          locked: armed.current,
          running: current.current.simulationState === "running",
        })
      ) {
        event.preventDefault();
        if (pressedKeys.current.press(event.code))
          void controller.dispatch({ type: "inputKey", code: event.code, pressed: true });
      }
    };
    const keyUp = (event: KeyboardEvent) => {
      if (pressedKeys.current.release(event.code))
        void controller.dispatch({ type: "inputKey", code: event.code, pressed: false });
    };
    const pointerDown = (event: PointerEvent) => {
      if (!lockedHere()) return;
      if (!pressedButtons.current.press(event.button)) return;
      if (!armed.current || current.current.simulationState !== "running") return;
      void controller.dispatch({ type: "inputPointer", button: event.button, pressed: true });
    };
    const pointerUp = (event: PointerEvent) => {
      if (pressedButtons.current.release(event.button))
        void controller.dispatch({ type: "inputPointer", button: event.button, pressed: false });
    };
    const look = (event: MouseEvent) => {
      if (
        lockedHere() &&
        armed.current &&
        !composing.current &&
        current.current.simulationState === "running"
      ) {
        void controller.dispatch({
          type: "inputLook",
          movementX: event.movementX,
          movementY: event.movementY,
        });
      }
    };
    const wheel = (event: WheelEvent) => {
      if (!lockedHere() || !armed.current || event.ctrlKey || event.metaKey) return;
      event.preventDefault();
      void controller.dispatch({ type: "inputWheel", deltaY: event.deltaY });
    };
    const contextMenu = (event: MouseEvent) => {
      if (lockedHere() && current.current.interactionMode === "fps-build") event.preventDefault();
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
      if (lockedHere()) {
        document.exitPointerLock();
        clear();
      }
    };
    const compositionEnd = () => {
      composing.current = false;
    };
    const focusUI = (event: FocusEvent) => {
      if (lockedHere() && isTypingElement(event.target instanceof Element ? event.target : null)) {
        document.exitPointerLock();
        clear();
      }
    };
    document.addEventListener("pointerlockchange", lockChange);
    document.addEventListener("pointerlockerror", lockFailed);
    document.addEventListener("keydown", keyDown);
    document.addEventListener("keyup", keyUp);
    document.addEventListener("pointerdown", pointerDown);
    document.addEventListener("pointerup", pointerUp);
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
    try {
      if (!surface.requestPointerLock) throw new Error("Pointer Lock unavailable");
      const request = Promise.resolve(surface.requestPointerLock());
      await Promise.all([entry, request]);
      if (attempt.current !== generation || controller.getSnapshot().interactionMode === "editor") {
        if (attempt.current === generation) wantsLock.current = false;
        if (!wantsLock.current && document.pointerLockElement === surface)
          document.exitPointerLock();
        if (attempt.current === generation)
          setLockError("無法進入第一人稱；請確認目前操作已完成後重試。");
      } else if (
        document.pointerLockElement === surface &&
        hadLock.current &&
        !pressedButtons.current.hasUnreleased(0)
      ) {
        // Entry can reset the release barrier after an early native lock event.
        void controller.dispatch({ type: "inputPointer", button: 0, pressed: false });
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
  };
  const exit = () => {
    attempt.current++;
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
  };
}
