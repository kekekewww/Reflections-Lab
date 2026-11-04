import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Only vite.site.config.ts turns this on, so this build has no browser path to Meta.
  define: { __BROWSER_AGENT__: "false" },
  // Keep caches local when worktrees share installed dependencies.
  cacheDir: ".cache/vite",
  // Browser evidence profiles may contain unrelated HTML; scan only the app entry.
  optimizeDeps: { entries: ["index.html"] },
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
    fs: {
      // Retain Vite's default denies and keep locally supplied text credentials server-only.
      deny: [".env", ".env.*", "*.{crt,pem}", "**/.git/**", "**/*[kK][eE][yY]*.[tT][xX][tT]"],
    },
    proxy: { "/api": "http://127.0.0.1:8787" },
  },
  preview: { host: "127.0.0.1", port: 4173, strictPort: true },
  build: { target: "es2022", sourcemap: true },
});
