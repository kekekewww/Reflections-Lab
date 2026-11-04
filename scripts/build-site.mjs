// Finishes the hosted site after Vite: network rules, a 404 page and licence notices, no source maps.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const SITE = "dist-site";
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  // The visitor's key leaves this page only for Meta, whatever a script tries.
  "connect-src 'self' https://api.meta.ai",
  // Ajv compiles its bundled schemas with new Function, and Rapier needs WebAssembly.
  // Inline and third-party scripts stay blocked, and connect-src above still limits where data goes.
  "script-src 'self' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "worker-src 'self'",
  "media-src 'self' blob:",
  "font-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join("; ");

export function siteHeaders() {
  return [
    "/*",
    `  Content-Security-Policy: ${CONTENT_SECURITY_POLICY}`,
    "  X-Content-Type-Options: nosniff",
    "  Referrer-Policy: no-referrer",
    "  X-Frame-Options: DENY",
    "",
    "/assets/*",
    "  Cache-Control: public, max-age=31536000, immutable",
    "",
  ].join("\n");
}

/** The packages compiled into the bundle, read from source map paths, nested copies included. */
export function noticePackages(sources) {
  const found = new Map();
  for (const source of sources) {
    const parts = source.split("\\").join("/").split("node_modules/");
    if (parts.length < 2) continue;
    const rest = parts.at(-1).split("/");
    const name = rest[0].startsWith("@") ? `${rest[0]}/${rest[1]}` : rest[0];
    const parents = parts.slice(1, -1).map((part) => part.replace(/\/$/, ""));
    const directory = path.join(
      "node_modules",
      ...parents.flatMap((parent) => [parent, "node_modules"]),
      name,
    );
    found.set(directory, name);
  }
  return [...found]
    .map(([directory, name]) => ({ name, directory }))
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}

function licenceSection({ name, directory }) {
  const manifest = JSON.parse(fs.readFileSync(path.join(directory, "package.json"), "utf8"));
  const declared =
    typeof manifest.license === "string"
      ? manifest.license
      : (manifest.license?.type ?? "unstated");
  const file = fs
    .readdirSync(directory)
    .find((entry) => /^(licen[cs]e|copying|notice)(\.|$|-)/i.test(entry));
  const rule = "-".repeat(80);
  const body = file
    ? fs.readFileSync(path.join(directory, file), "utf8").trim()
    : `No licence file was found in this package. Its package.json declares ${declared}.`;
  return `\n\n${rule}\n${name} ${manifest.version} (${declared})\n${rule}\n\n${body}`;
}

function allFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    return entry.isDirectory() ? allFiles(full) : [full];
  });
}

function main() {
  const maps = allFiles(SITE).filter((file) => file.endsWith(".map"));
  if (maps.length === 0) throw new Error(`No source maps in ${SITE}; run the Vite build first.`);
  const sources = maps.flatMap((file) => JSON.parse(fs.readFileSync(file, "utf8")).sources ?? []);
  const packages = noticePackages(sources);
  for (const file of maps) fs.rmSync(file);
  fs.writeFileSync(path.join(SITE, "_headers"), siteHeaders());
  // Without a 404 page, Cloudflare Pages answers every unknown path with index.html.
  fs.writeFileSync(
    path.join(SITE, "404.html"),
    '<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><title>Not found</title></head><body><p>Page not found. <a href="/">Open Reflection Lab</a>.</p></body></html>\n',
  );
  fs.writeFileSync(
    path.join(SITE, "third-party-notices.txt"),
    `Third-party software in this build of Reflection Lab\n\nThis site's JavaScript includes the open source packages below. Each package's licence text follows, taken from the installed package.\n${packages.map(licenceSection).join("")}\n`,
  );
  const files = allFiles(SITE);
  const bytes = files.reduce((total, file) => total + fs.statSync(file).size, 0);
  console.log(
    `${SITE}: ${files.length} files, ${(bytes / 1048576).toFixed(2)} MB, ${packages.length} packages in the notices.`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
