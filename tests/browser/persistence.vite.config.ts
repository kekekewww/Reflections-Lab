import { defineConfig, mergeConfig } from "vite";
import base from "../../vite.config.js";

/** Preserve the app's file denies while isolating optimizer/HMR and listening port. */
export default defineConfig(
  mergeConfig(base, {
    cacheDir: "test-results/storage-vite-cache",
    server: { host: "127.0.0.1", port: 5178, strictPort: true, hmr: false },
  }),
);
