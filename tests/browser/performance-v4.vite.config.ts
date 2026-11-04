import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [react()],
  cacheDir: ".cache/performance-v4/vite",
  build: {
    target: "es2022",
    sourcemap: true,
    outDir: "test-results/performance-v4-dist",
    emptyOutDir: true,
    rollupOptions: {
      input: fileURLToPath(new URL("./performance-fixture-v4.html", import.meta.url)),
    },
  },
  preview: { host: "127.0.0.1", port: 5194, strictPort: true },
});
