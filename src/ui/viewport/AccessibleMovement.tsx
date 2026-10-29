import { useEffect, useRef } from "react";
import type { LabController } from "../contracts.js";
import { useLocale } from "../locale.js";

/** A short explicit control pulse is an input intent, never a transform write. */
export function AccessibleMovement({
  controller,
  disabled,
}: {
  controller: LabController;
  disabled: boolean;
}) {
  const { t } = useLocale();
  const pulses = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  useEffect(() => {
    const release = () => {
      for (const [code, timer] of pulses.current) {
        clearTimeout(timer);
        void controller.dispatch({ type: "inputKey", code, pressed: false });
      }
      pulses.current.clear();
    };
    const hidden = () => {
      if (document.hidden) release();
    };
    if (disabled) release();
    window.addEventListener("blur", release);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      window.removeEventListener("blur", release);
      document.removeEventListener("visibilitychange", hidden);
      release();
    };
  }, [controller, disabled]);
  const step = (code: string) => {
    const previous = pulses.current.get(code);
    if (previous) clearTimeout(previous);
    void controller.dispatch({ type: "inputKey", code, pressed: true });
    pulses.current.set(
      code,
      setTimeout(() => {
        pulses.current.delete(code);
        void controller.dispatch({ type: "inputKey", code, pressed: false });
      }, 200),
    );
  };
  return (
    <details className="viewport-accessible-movement">
      <summary>{t("viewport.movement.summary")}</summary>
      <div className="button-group" role="group" aria-label={t("viewport.movement.aria")}>
        <button disabled={disabled} onClick={() => step("KeyW")}>
          {t("viewport.movement.forward")}
        </button>
        <button disabled={disabled} onClick={() => step("KeyS")}>
          {t("viewport.movement.backward")}
        </button>
        <button disabled={disabled} onClick={() => step("KeyA")}>
          {t("viewport.movement.left")}
        </button>
        <button disabled={disabled} onClick={() => step("KeyD")}>
          {t("viewport.movement.right")}
        </button>
      </div>
      <div className="button-group" role="group" aria-label={t("viewport.look.aria")}>
        <button
          disabled={disabled}
          onClick={() =>
            void controller.dispatch({ type: "inputLook", movementX: -60, movementY: 0 })
          }
        >
          {t("viewport.look.left")}
        </button>
        <button
          disabled={disabled}
          onClick={() =>
            void controller.dispatch({ type: "inputLook", movementX: 60, movementY: 0 })
          }
        >
          {t("viewport.look.right")}
        </button>
        <button
          disabled={disabled}
          onClick={() =>
            void controller.dispatch({ type: "inputLook", movementX: 0, movementY: -30 })
          }
        >
          {t("viewport.look.up")}
        </button>
        <button
          disabled={disabled}
          onClick={() =>
            void controller.dispatch({ type: "inputLook", movementX: 0, movementY: 30 })
          }
        >
          {t("viewport.look.down")}
        </button>
      </div>
    </details>
  );
}
