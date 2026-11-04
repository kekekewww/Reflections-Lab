#!/usr/bin/env node
// Starts the local agent server with the approved live Muse settings and serves the production
// build on :4173, the address the agent server accepts. Spends money only when someone submits an
// instruction with "Meta Model API" selected. The owner approved US$5 for this ledger
// (research/v1/meta-limits-authorization-20261104.json); going further needs a new approval.
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const CATALOG_PROOF = "research/v1/meta-catalog-20261104-demo.json";
const LEDGER = "research/v1/meta-live-budget-20261104-limits.json";

const args = process.argv.slice(2);
// Windows PowerShell's npm wrapper drops the "--" separator, so npm consumes --key-file and only the path arrives.
const keyFile =
  args.length === 2 && args[0] === "--key-file"
    ? args[1]
    : args.length === 1 && !args[0].startsWith("-")
      ? args[0]
      : "";
if (!keyFile) {
  process.stderr.write(
    'Usage: npm run demo:live -- --key-file "<path to the server-only key file>"\n',
  );
  process.exit(2);
}
if (!existsSync("dist/index.html")) {
  process.stderr.write("dist/ is missing. Run npm run build first.\n");
  process.exit(2);
}
const proof = JSON.parse(readFileSync(CATALOG_PROOF, "utf8"));
const env = {
  ...process.env,
  META_NETWORK_ENABLED: "true",
  META_MODEL_ID: "muse-spark-1.3",
  META_VERIFICATION_STATUS: "verified",
  META_VERIFIED_AT: proof.checkedAt,
  META_VERIFICATION_ARTIFACT_ID: "artifact.meta-limits-20261104",
  META_MAX_SESSION_COST_USD: "5",
  META_INPUT_USD_PER_MILLION_TOKENS: "1.25",
  META_OUTPUT_USD_PER_MILLION_TOKENS: "4.25",
  META_PRICING_SOURCE: "https://dev.meta.ai/docs/pricing-rate-limits",
  META_MAX_RETRIES: "0",
  META_TIMEOUT_MS: "120000",
  META_REASONING_EFFORT: "medium",
  META_MAX_REQUESTS: "200",
  META_MAX_COMPLETION_TOKENS: "16000",
  META_MAX_INPUT_BYTES: "128000",
  META_PARALLEL_TOOL_CALLS: "true",
  META_BUDGET_LEDGER_PATH: LEDGER,
};
const children = [
  spawn(process.execPath, ["--import", "tsx", "server/cli.ts", "--key-file", keyFile], {
    env,
    stdio: "inherit",
  }),
  spawn(process.execPath, ["node_modules/vite/bin/vite.js", "preview", "--strictPort"], {
    stdio: "inherit",
  }),
];
const stop = () => {
  for (const child of children) child.kill();
};
for (const child of children) child.on("exit", stop);
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
process.stdout.write("Open http://127.0.0.1:4173 and press Ctrl+C here to stop both servers.\n");
