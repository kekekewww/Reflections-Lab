// Frozen acceptance adapter: R2 executes exact extracted runner bodies; R3 uses its wired ownership seam.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { EventEmitter, once } from "node:events";
import { finished } from "node:stream/promises";
const root = path.resolve(process.env.V3_CANDIDATE_ROOT ?? ".");
export const runnerPath = path.join(root, "tests/browser/performance-profile-v3.mjs");
export const helperPath = path.join(root, "tests/browser/performance-owned-cleanup-v3.mjs");
export const source = await readFile(runnerPath, "utf8");
const modern =
  source.includes("./performance-owned-cleanup-v3.mjs") ||
  source.includes('"./performance-owned-cleanup-v3.mjs"');
const seam = modern
  ? await import(
      pathToFileURL(path.join(root, "tests/browser/performance-owned-cleanup-v3.mjs")).href
    )
  : null;
const slice = (start, end) => {
  const at = source.indexOf(start);
  if (at < 0) throw Error(`ACTUAL_RUNNER_MARKER_MISSING:${start}`);
  const stop = source.indexOf(end, at);
  if (stop < 0) throw Error(`ACTUAL_RUNNER_END_MISSING:${end}`);
  return source.slice(at, stop);
};
export const usesOwnedCleanupSeam = modern;
export function makeStopProcess(preview, options = {}) {
  if (modern) return () => seam.stopOwnedProcess(preview, options);
  const body = slice("  async function stopPreview()", '  let previewLog = "";');
  return new Function("preview", "setTimeout", "clearTimeout", `${body}; return stopPreview;`)(
    preview,
    options.setTimer ?? setTimeout,
    options.clearTimer ?? clearTimeout,
  );
}
export function makeSaveTrace(dependencies = {}) {
  if (modern)
    return (cdp, metadata, filename) => seam.saveOwnedTrace(cdp, metadata, filename, dependencies);
  const body = slice("async function saveTrace(cdp, metadata, filename)", "\nif (process.argv[1]");
  return new Function(
    "createWriteStream",
    "Buffer",
    "once",
    "finished",
    "SHORT_TRACE_CAPS",
    `${body}; return saveTrace;`,
  )(
    dependencies.createWriteStream,
    Buffer,
    dependencies.once ?? once,
    dependencies.finished ?? finished,
    { compressedBytes: dependencies.maxCompressedBytes ?? 16 * 1024 * 1024 },
  );
}
export async function startupCleanup(primary, browser, stopPreview, options = {}) {
  if (modern) {
    const result = await seam.cleanupOwnedResources({
      primaryError: primary,
      resources: [
        { label: "browser", close: () => browser?.close() },
        { label: "preview", close: stopPreview },
      ],
      ...options,
    });
    throw result.error ?? primary;
  }
  const marker = "  } catch (error) {\n    await browser?.close();";
  const catchText = slice(marker, "\n  const consoleEvents = []");
  const body = catchText.slice(catchText.indexOf("{") + 1, catchText.lastIndexOf("}"));
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  return new AsyncFunction(
    "error",
    "browser",
    "stopPreview",
    "writeFile",
    "path",
    "directory",
    "previewLog",
    body,
  )(primary, browser, stopPreview, async () => {}, path, "fake-owned-output", "fake-preview-log");
}
export function observeWatchdog(browser, failures) {
  if (modern) return seam.observeAsyncFailure(browser.close(), failures, "watchdog-browser-close");
  const begin = source.indexOf("  const watchdog = setTimeout(");
  const open = source.indexOf("    () => {", begin),
    stop = source.indexOf("\n    },", open);
  const callback = source.slice(open + "    () => ".length, stop + "\n    }".length);
  return new Function("browser", "report", "seconds", `return (${`() => ${callback}`})();`)(
    browser,
    {},
    20,
  );
}
export function makeCapture(options = {}) {
  if (modern) {
    const capture = seam.createBoundedCapture(options);
    return { emit: (value) => capture.add(value), view: () => capture.snapshot() };
  }
  const preview = { stdout: new EventEmitter(), stderr: new EventEmitter() };
  const body = slice('  let previewLog = "";', "  const url = ");
  const get = new Function("preview", `${body}; return () => previewLog;`)(preview);
  return {
    emit: (value) => preview.stdout.emit("data", value),
    view: () => ({
      bytes: Buffer.byteLength(get()),
      entries: get() ? [get()] : [],
      invalidated: false,
      dropped: 0,
    }),
  };
}
export function flattenErrors(error) {
  if (!error) return [];
  const nested = Array.isArray(error.errors) ? error.errors.flatMap(flattenErrors) : [];
  return [error, ...nested];
}
export const wiredHelperNames = () =>
  modern
    ? [
        "stopOwnedProcess",
        "cleanupOwnedResources",
        "saveOwnedTrace",
        "createBoundedCapture",
        "observeAsyncFailure",
      ].filter((name) => source.includes(name))
    : [];
