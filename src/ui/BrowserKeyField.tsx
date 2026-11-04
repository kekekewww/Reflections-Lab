import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  forgetBrowserKey,
  hasBrowserKey,
  setBrowserKey,
  subscribeBrowserKey,
} from "../ai/browser-key.js";
import { useLocale } from "./locale.js";

/**
 * The hosted site's key field. The input is uncontrolled so that the key never enters React
 * state. It isn't a form either, because browsers offer to save passwords from submitted forms.
 */
export function BrowserKeyField() {
  const { t } = useLocale();
  const held = useSyncExternalStore(subscribeBrowserKey, hasBrowserKey, hasBrowserKey);
  const [invalid, setInvalid] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const refocusInput = useRef(false);
  useEffect(() => {
    // Returning with the back button must not bring a key back from the page cache.
    window.addEventListener("pagehide", forgetBrowserKey);
    return () => window.removeEventListener("pagehide", forgetBrowserKey);
  }, []);
  useEffect(() => {
    if (held || !refocusInput.current) return;
    refocusInput.current = false;
    input.current?.focus();
  }, [held]);
  function useKey() {
    const field = input.current;
    if (!field) return;
    try {
      setBrowserKey(field.value);
    } catch {
      setInvalid(true);
      field.focus();
      return;
    }
    field.value = "";
    setInvalid(false);
    document.getElementById("experiment-agent-prompt")?.focus();
  }
  function forget() {
    refocusInput.current = true;
    forgetBrowserKey();
  }
  return (
    <div className="agent-key-field">
      {held ? (
        <div className="agent-key-held">
          <span>{t("analysis.agent.keyHeld")}</span>
          <button type="button" onClick={forget}>
            {t("analysis.agent.keyForget")}
          </button>
        </div>
      ) : (
        <>
          <label className="field-label" htmlFor="experiment-agent-key">
            {t("analysis.agent.keyLabel")}
          </label>
          <div className="agent-input-row">
            <input
              ref={input}
              id="experiment-agent-key"
              type="password"
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              maxLength={1024}
              aria-describedby="experiment-agent-key-help"
              aria-invalid={invalid}
              onInput={() => setInvalid(false)}
              onKeyDown={(event) => {
                if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
                event.preventDefault();
                useKey();
              }}
            />
            <button type="button" onClick={useKey}>
              {t("analysis.agent.keyUse")}
            </button>
          </div>
          {invalid && (
            <p className="field-help inline-error" role="alert">
              {t("analysis.agent.keyInvalid")}
            </p>
          )}
        </>
      )}
      <p className="field-help" id="experiment-agent-key-help">
        {t("analysis.agent.keyHelp")}
      </p>
    </div>
  );
}
