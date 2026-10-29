import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [react()],
  build: {
    target: "es2022",
    sourcemap: true,
    outDir: "test-results/performance-dist",
    emptyOutDir: true,
    rollupOptions: { input: fileURLToPath(new URL("./performance-fixture.html", import.meta.url)) },
  },
  preview: { host: "127.0.0.1", port: 5191, strictPort: true },
});
