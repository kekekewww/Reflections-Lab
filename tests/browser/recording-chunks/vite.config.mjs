import { defineConfig } from "vite";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.dirname(fileURLToPath(import.meta.url));
export default defineConfig({
  plugins: [
    {
      name: "recording-chunks-owned-server",
      configureServer(server) {
        server.middlewares.use("/__recording_chunk_owner__", (_request, response) => {
          response.setHeader("Content-Type", "text/plain");
          response.end(process.env.REFLECTION_CHUNK_OWNER_NONCE ?? "MISSING_OWNER_NONCE");
        });
      },
    },
  ],
  cacheDir: path.resolve(root, "../../../.cache/recording-chunks-vite"),
  root,
  server: {
    host: "127.0.0.1",
    port: 5198,
    strictPort: true,
    fs: { allow: [path.resolve(root, "../../..")] },
  },
});
