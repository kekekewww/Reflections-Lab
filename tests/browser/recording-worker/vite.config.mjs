import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { createReadStream } from "node:fs";
import path from "node:path";
const fixture = path.resolve("artifacts/v1/r15-recording-worker-20261028/fixture.json");
export default defineConfig({
  root: path.dirname(fileURLToPath(import.meta.url)),
  cacheDir: path.resolve(".cache/v1/recording-worker-vite-cache"),
  server: { host: "127.0.0.1", port: 5197, strictPort: true, fs: { allow: [process.cwd()] } },
  plugins: [
    {
      name: "owned-fixed-fixture",
      configureServer(server) {
        server.middlewares.use("/fixture.json", (_req, res) => {
          res.setHeader("Content-Type", "application/json");
          createReadStream(fixture)
            .on("error", () => {
              res.statusCode = 500;
              res.end();
            })
            .pipe(res);
        });
      },
    },
  ],
});
