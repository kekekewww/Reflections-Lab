import { spawn } from "node:child_process";
import path from "node:path";

const children = [
  spawn(process.execPath, [path.resolve("node_modules/vite/bin/vite.js")], {
    stdio: "inherit",
    windowsHide: true,
  }),
  spawn(process.execPath, ["--import", "tsx", "server/cli.ts"], {
    stdio: "inherit",
    windowsHide: true,
  }),
];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) if (child.exitCode === null) child.kill("SIGTERM");
  process.exitCode = code;
}
for (const child of children) {
  child.on("error", (error) => {
    process.stderr.write(`${error.message}\n`);
    stop(1);
  });
  child.on("exit", (code) => {
    if (!stopping) stop(code ?? 1);
  });
}
process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());
