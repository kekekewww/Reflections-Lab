import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { validateManifest, verifyFrozenBundle } from "./build-binding.mjs";
const root = process.cwd(),
  cache = path.join(root, "artifacts/v1/device-hearing-v3-frozen-20261029-r6");
const bytes = await readFile(path.join(cache, "build.raw.json"));
const m = validateManifest(bytes);
await verifyFrozenBundle(bytes, path.join(cache, "bundle"));
const files = new Map();
for (const item of m.bundle) {
  const rel = item.path.slice("test-results/product-preview-dist/".length);
  files.set("/" + rel, await readFile(path.join(cache, "bundle", rel)));
}
files.set("/", files.get("/index.html"));
const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://127.0.0.1");
  if (!["GET", "HEAD"].includes(req.method) || url.search || !files.has(url.pathname)) {
    res.writeHead(404);
    res.end();
    return;
  }
  const data = files.get(url.pathname);
  res.writeHead(200, { "cache-control": "no-store" });
  res.end(req.method === "HEAD" ? undefined : data);
});
server.listen(5174, "127.0.0.1", () =>
  console.log(
    JSON.stringify({ url: "http://127.0.0.1:5174/", pid: process.pid, scope: "frozen bytes only" }),
  ),
);
