import fs from "node:fs";
import readline from "node:readline";
import {
  launchNativeAccessibility,
  recordNativeBaseline,
  recordNativeZoomMenu,
  verifyNative200,
  finishNativeAccessibility,
  failNativeAccessibility,
} from "./native-accessibility-runner.mjs";

const run = await launchNativeAccessibility(
  process.argv[2] ?? "http://127.0.0.1:5174",
  process.argv[3] ?? "test-results/ui-preview-build.json",
  "native-menu",
);
await recordNativeBaseline(run);
console.log(
  JSON.stringify({
    state: "WAITING_NATIVE_MENU",
    pid: run.proof.process.pid,
    output: run.outputDirectory,
  }),
);
let finished = false;
const input = readline.createInterface({ input: process.stdin, terminal: false });
try {
  for await (const line of input) {
    if (line === "verify") {
      const evidence = JSON.parse(
        fs.readFileSync("test-results/native-accessibility/menu-evidence.json", "utf8"),
      );
      recordNativeZoomMenu(run, evidence.tree, evidence.screenshotURL, evidence.window);
      await verifyNative200(run);
      console.log(
        JSON.stringify({ state: "WAITING_NATIVE_RESTORE", checks: run.proof.checks.length }),
      );
    } else if (line === "finish") {
      console.log(JSON.stringify(await finishNativeAccessibility(run)));
      finished = true;
      break;
    } else if (line === "abort")
      throw new Error("Native menu test aborted; preserve partial evidence");
    else throw new Error(`Unsupported test control command: ${line}`);
  }
  if (!finished) throw new Error("Native menu test control ended before finish");
} catch (error) {
  console.log(JSON.stringify(await failNativeAccessibility(run, error)));
  process.exitCode = 1;
} finally {
  input.close();
}
