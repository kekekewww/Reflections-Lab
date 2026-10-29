import { runAutomaticZoom } from "./native-accessibility-runner.mjs";

const baseURL = process.argv[2] ?? "http://127.0.0.1:5174";
const manifest = process.argv[3] ?? "test-results/ui-preview-build.json";
try {
  const result = await runAutomaticZoom(baseURL, manifest);
  process.stdout.write(JSON.stringify(result) + "\n");
  if (result.status !== "PASS") process.exitCode = 1;
} catch (error) {
  process.stderr.write((error instanceof Error ? error.stack : String(error)) + "\n");
  process.exitCode = 1;
}
