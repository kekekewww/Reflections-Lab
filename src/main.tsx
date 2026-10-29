import { mountReflectionLab, type MountedReflectionLab } from "./app/bootstrap.js";
import {
  formatMessage,
  readStoredLocale,
  resolveDisplayLocale,
  translate,
} from "./ui/locale-model.js";

const element = document.getElementById("root");
if (!element) throw new Error("Missing application root");
const initialLocale = readStoredLocale();
document.documentElement.lang = initialLocale;
const loading = document.createElement("p");
loading.style.font = "16px system-ui";
loading.style.padding = "24px";
loading.textContent = translate(initialLocale, "startup.loading");
element.replaceChildren(loading);
const startup = new AbortController();
let application: MountedReflectionLab | null = null;
const dispose = () => {
  startup.abort();
  window.removeEventListener("pagehide", pagehide);
  application?.dispose();
};
const pagehide = (event: PageTransitionEvent) => {
  if (event.persisted) {
    // A BFCache page keeps the mounted app; returning must not resurrect an empty disposed root.
    void application?.runtime.dispatch({ type: "inputBlur" });
    return;
  }
  dispose();
};
window.addEventListener("pagehide", pagehide);
// Register before startup awaits so replacement/unload can cancel an initializing application.
import.meta.hot?.dispose(dispose);
try {
  application = await mountReflectionLab(element, {
    signal: startup.signal,
    onError: (error) => {
      console.error(error);
      if (startup.signal.aborted) return;
      const locale = resolveDisplayLocale(document.documentElement.lang);
      element.textContent = translate(locale, "startup.stopped", {
        detail: formatMessage(locale, error instanceof Error ? error.message : String(error)),
      });
    },
  });
  if (startup.signal.aborted) application.dispose();
} catch (error) {
  if (!startup.signal.aborted) {
    window.removeEventListener("pagehide", pagehide);
    const locale = resolveDisplayLocale(document.documentElement.lang);
    element.textContent = translate(locale, "startup.failed", {
      detail: formatMessage(locale, error instanceof Error ? error.message : String(error)),
    });
    console.error(error);
  } else if (!(error instanceof DOMException && error.name === "AbortError")) {
    console.error(error);
  }
}
