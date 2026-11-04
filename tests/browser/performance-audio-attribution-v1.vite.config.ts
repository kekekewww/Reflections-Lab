import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
export default defineConfig({
  cacheDir: fileURLToPath(new URL("../../.cache/performance-attribution-v1/vite", import.meta.url)),
  build: {
    target: "es2022",
    sourcemap: true,
    outDir: fileURLToPath(
      new URL("../../test-results/performance-audio-attribution-v1-dist", import.meta.url),
    ),
    emptyOutDir: true,
    rollupOptions: {
      input: fileURLToPath(new URL("./performance-audio-attribution-v1.html", import.meta.url)),
    },
  },
  preview: { host: "127.0.0.1", port: 5197, strictPort: true },
});
