import { createAgentServer } from "./app.js";
import { metaConfigFromEnv } from "./meta-provider.js";
import { loadMetaApiKey, metaKeyFileArgument } from "./meta-key-loader.js";

const keyFile = metaKeyFileArgument(process.argv.slice(2));
const loaded = await loadMetaApiKey({ ...(keyFile ? { keyFile } : {}) }).catch((error: unknown) => {
  process.stderr.write(
    `Agent credential load failed: ${error instanceof Error && "code" in error ? String(error.code) : "KEY_LOAD_FAILED"}\n`,
  );
  process.exit(1);
});
const server = createAgentServer({ metaConfig: { ...metaConfigFromEnv(), apiKey: loaded.apiKey } });
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
      process.exitCode = 0;
    }),
  );
