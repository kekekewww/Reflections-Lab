import { createAgentServer } from "./app.js";
import { getMetaProviderStatus, metaConfigFromEnv, MetaProvider } from "./meta-provider.js";
import { loadMetaApiKey, metaKeyFileArgument } from "./meta-key-loader.js";
import { openMetaBudgetLedger } from "./meta-budget-ledger.js";
import type { MetaBudgetLedger } from "./meta-budget-ledger.js";
import { resolve } from "node:path";

const keyFile = metaKeyFileArgument(process.argv.slice(2));
const loaded = await loadMetaApiKey({ ...(keyFile ? { keyFile } : {}) }).catch((error: unknown) => {
  process.stderr.write(
    `Agent credential load failed: ${error instanceof Error && "code" in error ? String(error.code) : "KEY_LOAD_FAILED"}\n`,
  );
  process.exit(1);
});
const config = { ...metaConfigFromEnv(), apiKey: loaded.apiKey };
let budget: MetaBudgetLedger | undefined;
if (getMetaProviderStatus(config).state === "READY") {
  budget = await openMetaBudgetLedger(
    resolve(process.env.META_BUDGET_LEDGER_PATH ?? ".cache/meta-agent/budget-ledger.json"),
    {
      authorizationId: config.verificationArtifactId!,
      modelId: config.modelId!,
      dataMode: config.dataMode,
      budgetUsd: config.maxEstimatedCostUsd,
      inputUsdPerMillionTokens: config.inputUsdPerMillionTokens!,
      outputUsdPerMillionTokens: config.outputUsdPerMillionTokens!,
      pricingSource: config.pricingSource!,
      maxRequests: config.maxRequests,
      maxAttemptsPerRequest: config.maxRetries + 1,
    },
  ).catch((error: unknown) => {
    process.stderr.write(
      `Agent budget ledger failed: ${error instanceof Error && "code" in error ? String(error.code) : "LEDGER_INVALID"}\n`,
    );
    process.exit(1);
  });
}
const server = createAgentServer({
  provider: new MetaProvider(config, { ...(budget ? { budget } : {}) }),
});
server.listen(8787, "127.0.0.1", () => {
  process.stdout.write(
    "Reflection Lab local agent API: http://127.0.0.1:8787 (offline default; Meta live gated)\n",
  );
});
server.on("error", (error) => {
  process.stderr.write(`Agent server failed: ${error.message}\n`);
  process.exitCode = 1;
});
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, () =>
    server.close(() => {
      void (budget?.close() ?? Promise.resolve()).then(
        () => {
          process.exitCode = 0;
        },
        () => {
          process.exitCode = 1;
        },
      );
    }),
  );
