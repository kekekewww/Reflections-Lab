/// <reference types="vite/client" />
/** Set by the Vite configs. Undefined when source runs directly, as in the Node tests. */
declare const __BROWSER_AGENT__: boolean | undefined;
interface Window {
  __reflectionLab?: import("./app/runtime.js").LabRuntime;
}
