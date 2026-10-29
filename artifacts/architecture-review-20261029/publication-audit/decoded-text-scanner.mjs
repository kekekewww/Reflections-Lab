import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
const sha = (b) => createHash("sha256").update(b).digest("hex");
const rules = [
  ["private-key", /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY(?: BLOCK)?-----/g],
  ["aws-access-key", /(?<![A-Za-z0-9])(?:AKIA|ASIA)[A-Z0-9]{16}(?![A-Za-z0-9])/g],
  ["github-token", /(?<![A-Za-z0-9])(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})/g],
  ["openai-token", /(?<![A-Za-z0-9])sk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{20,}/g],
  ["meta-token", /(?<![A-Za-z0-9])EAA[A-Za-z0-9]{30,}/g],
  ["slack-token", /xox[baprs]-[A-Za-z0-9-]{20,}/g],
  ["google-api-key", /AIza[0-9A-Za-z_-]{35}/g],
  ["stripe-live-key", /(?:sk|rk)_live_[0-9A-Za-z]{20,}/g],
  ["jwt", /eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{10,}/g],
  ["url-password", /https?:\/\/[^\s:/<>"']{1,80}:[^\s@<>"']{3,120}@/g],
  [
    "literal-secret-assignment",
    /(?:api[_-]?key|client[_-]?secret|auth[_-]?token|access[_-]?token|password|passwd|secret|bearer)["']?\s*[:=]\s*["']([^"'\r\n]{8,200})["']/gi,
  ],
];
function find(text, location) {
  const hits = [];
  for (const [rule, expression] of rules) {
    expression.lastIndex = 0;
    for (const match of text.matchAll(expression))
      hits.push({ location, rule, match_sha256: sha(match[0]), offset: match.index });
  }
  return hits;
}
function utf16(bytes) {
  if (bytes[0] === 255 && bytes[1] === 254) return bytes.subarray(2).toString("utf16le");
  if (bytes[0] === 254 && bytes[1] === 255) {
    const copy = Buffer.from(bytes.subarray(2));
    if (copy.length % 2) throw Error("Odd UTF16BE byte count");
    copy.swap16();
    return copy.toString("utf16le");
  }
  return null;
}
function containers(value, location, output, seen, depth = 0) {
  if (depth > 64) throw Error("Structured container depth exceeded");
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    const at = location + "/" + key;
    if (child && typeof child === "object") {
      containers(child, at, output, seen, depth + 1);
      continue;
    }
    if (typeof child !== "string") continue;
    let bytes = null,
      text = null,
      mode = null;
    const trimmed = child.trim();
    if (/^[\[{]/.test(trimmed)) {
      text = child;
      bytes = Buffer.from(child);
      mode = "serialized-json";
    } else if (
      child.length >= 80 &&
      child.length % 4 === 0 &&
      /^[A-Za-z0-9+/]+={0,2}$/.test(child)
    ) {
      bytes = Buffer.from(child, "base64");
      text = utf16(bytes) ?? bytes.toString("utf8");
      mode = "base64-json";
    }
    if (!text || !bytes) continue;
    if (bytes.length > 10 * 1024 * 1024) throw Error("Decoded text container exceeds 10MiB");
    let nested;
    try {
      nested = JSON.parse(text.replace(/^\uFEFF/, ""));
    } catch {
      if (key === "body" && mode === "base64-json")
        output.opaque_base64_bodies.push({ location: at, bytes: bytes.length, sha256: sha(bytes) });
      continue;
    }
    if (!nested || typeof nested !== "object") continue;
    const digest = sha(bytes);
    if (seen.has(digest)) {
      output.duplicate_containers++;
      continue;
    }
    seen.add(digest);
    output.decoded_containers.push({ location: at, mode, bytes: bytes.length, sha256: digest });
    output.hits.push(...find(text, at));
    containers(nested, at, output, seen, depth + 1);
  }
}
if (process.argv.includes("--self-test")) {
  const fixtureValue = "SYNTHETIC_ONLY_NEVER_AUTHENTICATES";
  const text = JSON.stringify({ secret: fixtureValue, padding: "x".repeat(80) });
  const encoded = Buffer.from(text).toString("base64");
  const result = {
    decoded_containers: [],
    opaque_base64_bodies: [],
    hits: [],
    duplicate_containers: 0,
  };
  containers({ body: encoded }, "synthetic", result, new Set());
  assert.equal(result.decoded_containers.length, 1);
  let deep = { body: encoded };
  for (let i = 0; i < 24; i++) deep = { report: deep };
  const deepResult = {
    decoded_containers: [],
    opaque_base64_bodies: [],
    hits: [],
    duplicate_containers: 0,
  };
  containers(deep, "synthetic-deep-report", deepResult, new Set());
  assert.equal(
    deepResult.hits.some((x) => x.rule === "literal-secret-assignment"),
    true,
  );
  assert.equal(
    result.hits.some((x) => x.rule === "literal-secret-assignment"),
    true,
  );
  const wide = Buffer.concat([Buffer.from([255, 254]), Buffer.from(text, "utf16le")]);
  assert.equal(utf16(wide), text);
  assert.equal(
    find(utf16(wide), "synthetic").some((x) => x.rule === "literal-secret-assignment"),
    true,
  );
  console.log(
    JSON.stringify({
      status: "PASS",
      scope:
        "Synthetic decoded JSON and UTF16 credential-signature positive controls; no real credentials",
    }),
  );
  process.exit(0);
}
const requested = process.argv[2] ?? "HEAD";
const git = (args, options = {}) =>
  execFileSync("git", args, { windowsHide: true, maxBuffer: 256 * 1024 * 1024, ...options });
const head = git(["rev-parse", "--verify", requested + "^{commit}"], { encoding: "utf8" }).trim();
const entries = git(["rev-list", "--objects", head], { encoding: "utf8" })
  .trim()
  .split("\n")
  .map((line) => {
    const i = line.indexOf(" ");
    return { oid: i < 0 ? line : line.slice(0, i), path: i < 0 ? "" : line.slice(i + 1) };
  });
const metadata = git(["cat-file", "--batch-check=%(objectname) %(objecttype) %(objectsize)"], {
  input: entries.map((x) => x.oid).join("\n") + "\n",
  encoding: "utf8",
})
  .trim()
  .split("\n");
const names = new Map(entries.map((x) => [x.oid, x.path]));
const blobs = metadata.map((x) => x.split(" ")).filter((x) => x[1] === "blob");
const batch = git(["cat-file", "--batch"], { input: blobs.map((x) => x[0]).join("\n") + "\n" });
const result = {
  schema_version: 1,
  head,
  scope:
    "All reachable blobs: UTF16 text and nested serialized/base64 JSON containers supplement primary plain-text/archive audit",
  blobs: blobs.length,
  utf16_text: [],
  decoded_containers: [],
  opaque_base64_bodies: [],
  duplicate_containers: 0,
  skipped_non_text_blobs: [],
  hits: [],
  errors: [],
  limitations: [
    "Rule-based signatures are not an absolute absence proof.",
    "Opaque non-JSON base64 body payloads require separate review; no media or unknown payload is silently classified safe.",
    "No matched values or decoded source bodies are printed.",
  ],
};
let offset = 0;
const seen = new Set();
for (const [oid, , sizeText] of blobs) {
  const end = batch.indexOf(10, offset);
  const header = batch.subarray(offset, end).toString("utf8");
  const size = Number(sizeText);
  if (header !== oid + " blob " + size) throw Error("Unexpected Git batch header");
  const bytes = batch.subarray(end + 1, end + 1 + size);
  offset = end + 1 + size + 1;
  const location = names.get(oid) + "@" + oid;
  try {
    let text = utf16(bytes);
    if (text !== null) {
      result.utf16_text.push({ location, bytes: size, decoded_sha256: sha(Buffer.from(text)) });
      result.hits.push(...find(text, location));
    } else if (bytes.includes(0)) {
      result.skipped_non_text_blobs.push({ location, bytes: size, sha256: sha(bytes) });
      continue;
    } else text = bytes.toString("utf8");
    let parsed;
    try {
      parsed = JSON.parse(text.replace(/^\uFEFF/, ""));
    } catch {
      continue;
    }
    containers(parsed, location, result, seen);
  } catch (e) {
    result.errors.push({ location, message: String(e.message) });
  }
}
result.status =
  result.errors.length || result.opaque_base64_bodies.length
    ? "REVIEW_REQUIRED"
    : result.hits.length
      ? "CANDIDATES_REQUIRE_CLASSIFICATION"
      : "NO_SIGNATURE_HITS_IN_IDENTIFIED_TEXT_CONTAINERS";
console.log(JSON.stringify(result, null, 2));
if (result.errors.length || result.opaque_base64_bodies.length) process.exitCode = 1;
