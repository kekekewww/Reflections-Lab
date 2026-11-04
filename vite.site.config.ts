import { fileURLToPath } from "node:url";
import { defineConfig, mergeConfig } from "vite";
import base from "./vite.config.js";

/**
 * The hosted static site: the visitor's tab runs the Muse planner with their own key.
 * The local app keeps vite.config.ts, where the key stays on the server.
 */
export default mergeConfig(
  base,
  defineConfig({
    define: { __BROWSER_AGENT__: "true" },
    resolve: {
      alias: {
        "node:crypto": fileURLToPath(new URL("./src/ai/browser-crypto.ts", import.meta.url)),
      },
    },
    // Hidden maps are read for the licence notices, then deleted by scripts/build-site.mjs.
    build: { outDir: "dist-site", sourcemap: "hidden" },
  }),
);
