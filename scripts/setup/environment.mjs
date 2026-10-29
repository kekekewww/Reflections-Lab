#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import { dirname, resolve } from "node:path";

const expected = Object.freeze({
  node: "22.17.0",
  npm: "11.4.2",
  python: "3.12.11",
});

function readOptions(args) {
  const options = { strict: false, output: undefined };
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === "--strict") {
      options.strict = true;
    } else if (args[index] === "--output" && args[index + 1] && !args[index + 1].startsWith("--")) {
      options.output = resolve(args[index + 1]);
      index += 1;
    } else {
      throw new Error("Usage: node scripts/setup/environment.mjs [--strict] [--output <path>]");
    }
  }
  return options;
}

function commandVersion(command) {
  // Windows npm is a .cmd shim. The shell receives a fixed command only; no
  // user-controlled strings, environment values, or file paths are interpolated.
  const result =
    process.platform === "win32" && command === "npm"
      ? spawnSync("cmd.exe", ["/d", "/s", "/c", "npm --version"], {
          encoding: "utf8",
          windowsHide: true,
          timeout: 10_000,
        })
      : spawnSync(command, ["--version"], {
          encoding: "utf8",
          windowsHide: true,
          timeout: 10_000,
        });
  if (result.error || result.status !== 0) return null;
  return `${result.stdout ?? ""}${result.stderr ?? ""}`.match(/\b(\d+\.\d+\.\d+)\b/)?.[1] ?? null;
}

function inspectVersion(name, actual, required) {
  return {
    expected: expected[name],
    actual,
    required,
    status: actual === null ? "MISSING" : actual === expected[name] ? "PASS" : "MISMATCH",
  };
}

async function main() {
  const options = readOptions(process.argv.slice(2));
  const cpus = os.cpus();
  const tools = {
    node: inspectVersion("node", process.versions.node, true),
    npm: inspectVersion("npm", commandVersion("npm"), true),
    python: inspectVersion("python", commandVersion("python"), false),
  };
  const requiredVersionsMatch = Object.values(tools).every(
    (tool) => !tool.required || tool.status === "PASS",
  );
  const report = {
    schemaVersion: "1.0.0",
    capturedAtUtc: new Date().toISOString(),
    scope: "preproduction-environment-inspection",
    status: requiredVersionsMatch ? "PASS" : "MISMATCH",
    strict: options.strict,
    tools,
    operatingSystem: {
      platform: process.platform,
      release: os.release(),
      architecture: os.arch(),
      processArchitecture: process.arch,
    },
    hardware: {
      cpuModels: [...new Set(cpus.map((cpu) => cpu.model))],
      logicalCpuCount: cpus.length,
      totalMemoryBytes: os.totalmem(),
    },
    runtimeVersions: { ...process.versions },
    limitations: [
      "Version agreement does not establish scientific or product correctness.",
      "Python is optional for the Node validation suite and does not fail strict mode.",
      "No environment-variable values, host name, user name, or credentials are recorded.",
    ],
  };
  const json = `${JSON.stringify(report, null, 2)}\n`;
  if (options.output) {
    await mkdir(dirname(options.output), { recursive: true });
    await writeFile(options.output, json, "utf8");
  }
  process.stdout.write(json);
  if (options.strict && !requiredVersionsMatch) process.exitCode = 1;
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 2;
});
