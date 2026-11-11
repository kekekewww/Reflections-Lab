import { createHash } from "node:crypto";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { basename, dirname, relative, resolve, sep } from "node:path";

// Static Markdown local-link check only. External reachability and anchor identity are not checked.
const root = process.cwd();
const ignored = new Set([".git", "node_modules", ".cache", "third_party"]);
// Nested worktrees are other checkouts of this repository; scanning them took minutes and
// reported their links as this checkout's. Paths are relative to the repository root.
const ignoredPaths = new Set([".worktrees", ".worktree-archives", ".claude/worktrees"]);
// Evidence copies preserve source bytes and source-relative links. Their run SHA proofs
// remain separate from this maintained-document link check; artifact reports stay in scope.
const rawSnapshotDirectories = new Set([
  "source-before",
  "source-after",
  "sources",
  "tested-bundle",
]);
const excludedRawSnapshots = [];
const documents = [];
const snapshotIndexes = [];
function walk(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && !ignored.has(entry.name)) {
      const target = resolve(directory, entry.name);
      const parts = relative(root, target).split(sep);
      if (ignoredPaths.has(parts.join("/"))) continue;
      if (parts[0] === "artifacts" && rawSnapshotDirectories.has(entry.name))
        excludedRawSnapshots.push(parts.join("/"));
      else walk(target);
    } else if (entry.isFile() && entry.name.endsWith(".md"))
      documents.push(resolve(directory, entry.name));
    else if (entry.isFile() && entry.name === "SNAPSHOT_INDEX.json")
      snapshotIndexes.push(resolve(directory, entry.name));
  }
}
walk(root);
const broken = [];
const repoPath = (path) => relative(root, path).split(sep).join("/");
const sha256 = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");
// Single documents copied byte-for-byte also keep source-relative links. A copy qualifies only
// while its bytes still match: a name ending in .<first 12 hex of its own SHA-256>.md, or a
// {path, sha256} entry under byte_exact_documents in a SNAPSHOT_INDEX.json. Edited copies fail
// (registered) or are checked as maintained documents (SHA-256-named).
const registeredSnapshots = new Map();
for (const index of snapshotIndexes) {
  let entries;
  try {
    entries = JSON.parse(readFileSync(index, "utf8")).byte_exact_documents;
  } catch {
    broken.push(`${repoPath(index)}: unreadable snapshot index`);
    continue;
  }
  if (entries === undefined) continue;
  if (!Array.isArray(entries)) {
    broken.push(`${repoPath(index)}: byte_exact_documents must be an array`);
    continue;
  }
  for (const entry of entries) {
    if (typeof entry?.path !== "string" || !/^[0-9a-f]{64}$/.test(entry?.sha256 ?? ""))
      broken.push(`${repoPath(index)}: snapshot entry needs a path and a sha256`);
    else registeredSnapshots.set(entry.path, { index: repoPath(index), sha256: entry.sha256 });
  }
}
const excludedDocumentSnapshots = [];
const maintained = documents.filter((document) => {
  const path = repoPath(document);
  const registered = registeredSnapshots.get(path);
  if (registered) {
    if (sha256(document) === registered.sha256) {
      excludedDocumentSnapshots.push(path);
      return false;
    }
    broken.push(`${path}: bytes differ from the snapshot registered in ${registered.index}`);
    return true;
  }
  const prefix = /\.([0-9a-f]{12})\.md$/.exec(basename(document))?.[1];
  if (prefix && sha256(document).startsWith(prefix)) {
    excludedDocumentSnapshots.push(path);
    return false;
  }
  return true;
});
for (const path of registeredSnapshots.keys())
  if (!existsSync(resolve(root, path))) broken.push(`${path}: registered snapshot is missing`);
const scope =
  "Scope: maintained Markdown; exact raw byte snapshot directories under root artifacts " +
  "(source-before/source-after/sources/tested-bundle) and byte-exact single document copies " +
  "(SHA-256-named or SNAPSHOT_INDEX-registered, bytes verified) excluded from link checking; " +
  "run SHA proof checks are separate.\n" +
  `Excluded raw byte snapshots (${excludedRawSnapshots.length}): ${excludedRawSnapshots.join(", ") || "none"}.\n` +
  `Excluded byte-exact document copies (${excludedDocumentSnapshots.length}): ${excludedDocumentSnapshots.join(", ") || "none"}.`;
let checked = 0;
for (const document of maintained) {
  let fence = null;
  const lines = readFileSync(document, "utf8").split(/\r?\n/);
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const marker = /^\s*(`{3,}|~{3,})/.exec(line)?.[1];
    if (marker) {
      if (fence === null) fence = marker[0];
      else if (marker[0] === fence) fence = null;
      continue;
    }
    if (fence !== null) continue;
    const destinations = [...line.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)].map((match) => match[1]);
    const definition = /^\s*\[[^\]]+\]:\s*(.+)$/.exec(line);
    if (definition) destinations.push(definition[1]);
    for (let destination of destinations) {
      destination = destination.trim();
      destination = destination.startsWith("<")
        ? destination.slice(1, destination.indexOf(">"))
        : destination.split(/\s+["']/)[0];
      if (
        !destination ||
        destination.startsWith("#") ||
        /^[a-z][a-z0-9+.-]*:/i.test(destination) ||
        destination.startsWith("//")
      )
        continue;
      let local;
      try {
        local = decodeURIComponent(destination.split(/[?#]/)[0]);
      } catch {
        broken.push(
          `${relative(root, document)}:${index + 1}: malformed encoded target ${destination}`,
        );
        continue;
      }
      if (!local) continue;
      checked++;
      if (!existsSync(resolve(dirname(document), local)))
        broken.push(`${relative(root, document)}:${index + 1}: ${destination}`);
    }
  }
}
if (broken.length) {
  console.error(
    `FAIL ${broken.length} missing Markdown local targets (${checked} checked, ${maintained.length} documents):\n${broken.join("\n")}\n${scope}`,
  );
  process.exitCode = 1;
} else
  console.log(
    `PASS Markdown local targets: ${checked} links in ${maintained.length} documents; fenced code/external URLs/anchors excluded.\n${scope}`,
  );
