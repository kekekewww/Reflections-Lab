import { readdirSync, readFileSync, existsSync } from "node:fs";
import { dirname, relative, resolve, sep } from "node:path";

// Static Markdown local-link check only. External reachability and anchor identity are not checked.
const root = process.cwd();
const ignored = new Set([".git", "node_modules", ".cache", "third_party"]);
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
function walk(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && !ignored.has(entry.name)) {
      const target = resolve(directory, entry.name);
      const parts = relative(root, target).split(sep);
      if (parts[0] === "artifacts" && rawSnapshotDirectories.has(entry.name))
        excludedRawSnapshots.push(parts.join("/"));
      else walk(target);
    } else if (entry.isFile() && entry.name.endsWith(".md"))
      documents.push(resolve(directory, entry.name));
  }
}
walk(root);
const scope =
  "Scope: maintained Markdown; exact raw byte snapshot directories under root artifacts " +
  "(source-before/source-after/sources/tested-bundle) excluded from link checking; " +
  "run SHA proof checks are separate.\n" +
  `Excluded raw byte snapshots (${excludedRawSnapshots.length}): ${excludedRawSnapshots.join(", ") || "none"}.`;
let checked = 0;
const broken = [];
for (const document of documents) {
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
    `FAIL ${broken.length} missing Markdown local targets (${checked} checked, ${documents.length} documents):\n${broken.join("\n")}\n${scope}`,
  );
  process.exitCode = 1;
} else
  console.log(
    `PASS Markdown local targets: ${checked} links in ${documents.length} documents; fenced code/external URLs/anchors excluded.\n${scope}`,
  );
