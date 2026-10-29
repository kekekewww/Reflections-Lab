import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import base from "../../vite.config.js";

const fileDeny = base.server?.fs?.deny;
if (!fileDeny?.length) throw new Error("Missing application dev-server file deny policy");

/** Isolate the real module graph from other agents' dev-server HMR and optimizer cache. */
export default defineConfig({
  plugins: [react()],
  // Preserve the failed cache as evidence and isolate this corrected dev graph.
  cacheDir: "test-results/physics-vite-cache-v2",
  server: {
    host: "127.0.0.1",
    port: 5176,
    strictPort: true,
    hmr: false,
    fs: { deny: [...fileDeny] },
  },
  optimizeDeps: {
    entries: ["index.html"],
    include: [
      "react",
      "react-dom/client",
      "react/jsx-runtime",
      "@react-three/fiber",
      "three",
      "@dimforge/rapier3d-compat",
    ],
  },
  build: { target: "es2022" },
});
