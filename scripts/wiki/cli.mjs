import { run, markdown } from "./core.mjs";

try {
  const formatIndex = process.argv.indexOf("--format");
  const format = formatIndex >= 0 ? process.argv[formatIndex + 1] : "markdown";
  if (!["json", "markdown"].includes(format)) throw new Error("--format 必須為 json 或 markdown。");
  const result = await run(process.argv.slice(2));
  process.stdout.write(
    format === "json" ? `${JSON.stringify(result, null, 2)}\n` : markdown(result),
  );
  if (!result.ok) process.exitCode = 1;
} catch (error) {
  process.stdout.write(
    `${JSON.stringify({ ...error.details, ok: false, code: error.code ?? "ERROR", message: error.message }, null, 2)}\n`,
  );
  process.exitCode = 2;
}
