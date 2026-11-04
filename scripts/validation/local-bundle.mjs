// Fails if the local build can reach Meta from the browser. Only the hosted build may (vite.site.config.ts).
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const META_REQUEST_PATH = "v1/chat/completions";

export function browserMetaPaths(files) {
  return files.filter((file) => file.text.includes(META_REQUEST_PATH)).map((file) => file.name);
}

function main() {
  const assets = path.join("dist", "assets");
  const files = fs
    .readdirSync(assets)
    .filter((name) => name.endsWith(".js"))
    .map((name) => ({ name, text: fs.readFileSync(path.join(assets, name), "utf8") }));
  if (files.length === 0) throw new Error(`No JavaScript in ${assets}; run the Vite build first.`);
  const found = browserMetaPaths(files);
  if (found.length > 0)
    throw new Error(`The local bundle contains a browser path to Meta: ${found.join(", ")}`);
  console.log(`PASS local bundle: ${files.length} scripts, no browser path to Meta.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
