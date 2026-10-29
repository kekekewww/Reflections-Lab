import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { isAbsolute, relative, resolve } from "node:path";
import { loadMetaApiKey, MetaKeyError } from "./meta-key-loader.js";
import { probeMetaCatalog } from "./meta-catalog.js";

/** This entry point has no generation route, retries, provider configuration or budget mutation. */
export async function runMetaCatalogCli(
  args: readonly string[] = process.argv.slice(2),
): Promise<void> {
  let keyFile: string | undefined;
  let output: string | undefined;
  for (let index = 0; index < args.length; index += 2) {
    const option = args[index];
    const value = args[index + 1];
    if (
      !value ||
      (option !== "--key-file" && option !== "--output") ||
      (option === "--key-file" ? keyFile !== undefined : output !== undefined)
    )
      throw new MetaKeyError(
        "CLI_ARGUMENT_INVALID",
        "只支援可選的 --key-file <path> 與 --output <research/v1/proof.json>。",
      );
    if (option === "--key-file") keyFile = value;
    else output = value;
  }
  let outputFile: string | undefined;
  if (output) {
    const root = fileURLToPath(new URL("../research/v1/", import.meta.url));
    outputFile = resolve(output);
    const local = relative(root, outputFile);
    if (!local || local.startsWith("..") || isAbsolute(local) || !local.endsWith(".json"))
      throw new MetaKeyError(
        "ARTIFACT_PATH_INVALID",
        "Catalog證據僅可寫入專案research/v1內的新JSON檔。",
      );
  }
  const loaded = await loadMetaApiKey({ ...(keyFile ? { keyFile } : {}) });
  if (!loaded.apiKey)
    throw new MetaKeyError("AUTHENTICATION_NOT_CONFIGURED", "沒有指定server-side Meta憑證。");
  const proof = await probeMetaCatalog(loaded.apiKey);
  const json = JSON.stringify(proof, null, 2) + "\n";
  if (outputFile) {
    try {
      await writeFile(outputFile, json, { encoding: "utf8", flag: "wx" });
    } catch {
      // Never print native filesystem errors or caller-supplied paths.
      process.stderr.write("Catalog artifact write failed: ARTIFACT_WRITE_FAILED\n");
      process.exitCode = 1;
    }
  }
  process.stdout.write(json);
  if (proof.status !== "PASSED") process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  void runMetaCatalogCli().catch((error: unknown) => {
    const code = error instanceof MetaKeyError ? error.code : "CATALOG_PREFLIGHT_FAILED";
    process.stderr.write(
      JSON.stringify({
        status: "FAILED",
        code,
        scope: "CATALOG_ACCESS_ONLY",
        inferenceRequests: 0,
      }) + "\n",
    );
    process.exitCode = 1;
  });
}
