/** Read-only, redacted audit of every blob reachable from one Git ref. */
import { execFileSync, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { Readable } from "node:stream";
import { createGunzip, createInflateRaw, gzipSync } from "node:zlib";

const args = process.argv.slice(2);
const refIndex = args.indexOf("--ref");
const ref = refIndex < 0 ? "HEAD" : args[refIndex + 1];
if (!ref || ref.startsWith("-")) throw new Error("A Git ref is required after --ref.");
const sinceIndex = args.indexOf("--since");
const since = sinceIndex < 0 ? null : args[sinceIndex + 1];
if (sinceIndex >= 0 && (!since || since.startsWith("-"))) {
  throw new Error("A baseline Git ref is required after --since.");
}
const git = (...parameters) =>
  execFileSync("git", parameters, { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
const head = git("rev-parse", "--verify", `${ref}^{commit}`).trim();
const excludedBase = since ? git("rev-parse", "--verify", `${since}^{commit}`).trim() : null;
if (excludedBase) git("merge-base", "--is-ancestor", excludedBase, head);
const revisions = excludedBase ? [head, `^${excludedBase}`] : [head];
const objects = new Map(
  git("rev-list", "--objects", ...revisions)
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const split = line.indexOf(" ");
      return split < 0 ? [line, ""] : [line.slice(0, split), line.slice(split + 1)];
    }),
);
const metadata = execFileSync(
  "git",
  ["cat-file", "--batch-check=%(objectname) %(objecttype) %(objectsize)"],
  {
    input: [...objects.keys()].join("\n") + "\n",
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  },
);
const blobs = metadata
  .trim()
  .split("\n")
  .filter(Boolean)
  .map((line) => line.split(" "))
  .filter(([, type]) => type === "blob")
  .map(([sha, , bytes]) => ({ sha, bytes: Number(bytes), path: objects.get(sha) }));
const summary = {
  schema_version: 1,
  head,
  excluded_base: excludedBase,
  scope: excludedBase ? "new-blobs-since-baseline" : "all-reachable-blobs",
  commit_count: Number(git("rev-list", "--count", ...revisions).trim()),
  reachable_objects: objects.size,
  unique_blobs: blobs.length,
  blob_bytes: blobs.reduce((sum, blob) => sum + blob.bytes, 0),
  files_over_100_MiB: blobs.filter((blob) => blob.bytes > 100 * 1024 * 1024),
  files_over_10_MiB: blobs.filter((blob) => blob.bytes > 10 * 1024 * 1024),
  secret_scan: {
    mode: args.includes("--metadata-only") ? "NOT_RUN" : "rules-and-archives",
    bytes: 0,
    archive_members: 0,
    binary_payloads_skipped: 0,
    duplicate_payloads_skipped: 0,
    hits: [],
    errors: [],
  },
  limitations: [
    "Rule-based audit is evidence, not proof that no secret or restricted content exists.",
    "Only the selected ref and its ancestors are examined; other refs, reflogs and untracked files are excluded.",
    "Binary media bytes and encoded/encrypted credentials require separate review; ZIP/GZIP text members are examined.",
    "One representative path is reported for each unique Git blob; identical blobs may have additional paths.",
  ],
};
const scan = summary.secret_scan;
const sha256 = (data) => createHash("sha256").update(data).digest("hex");
const rules = [
  [
    "private-key",
    "PRIVATE KEY",
    /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY(?: BLOCK)?-----/g,
  ],
  ["aws-access-key", "A", /(?<![A-Za-z0-9])(?:AKIA|ASIA)[A-Z0-9]{16}(?![A-Za-z0-9])/g],
  [
    "github-token",
    "gh",
    /(?<![A-Za-z0-9])(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})/g,
  ],
  ["openai-token", "sk-", /(?<![A-Za-z0-9])sk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{20,}/g],
  ["meta-token", "EAA", /(?<![A-Za-z0-9])EAA[A-Za-z0-9]{30,}/g],
  ["slack-token", "xox", /xox[baprs]-[A-Za-z0-9-]{20,}/g],
  ["google-api-key", "AIza", /AIza[0-9A-Za-z_-]{35}/g],
  ["stripe-live-key", "_live_", /(?:sk|rk)_live_[0-9A-Za-z]{20,}/g],
  ["jwt", "eyJ", /eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{10,}/g],
  ["url-password", "://", /https?:\/\/[^\s:/<>"']{1,80}:[^\s@<>"']{3,120}@/g],
  [
    "literal-secret-assignment",
    null,
    /(?:api[_-]?key|client[_-]?secret|auth[_-]?token|access[_-]?token|password|passwd|secret|bearer)["']?\s*[:=]\s*["']([^"'\r\n]{8,200})["']/gi,
  ],
  ["literal-bearer", null, /\bbearer [A-Za-z0-9_.-]{16,}/gi],
];
const hitKeys = new Set();
function scanChunk(chunk, tail, offset, blob, member) {
  const text = Buffer.concat([tail, chunk]).toString("latin1");
  for (const [rule, marker, pattern] of rules) {
    if (marker !== null && !text.includes(marker)) continue;
    pattern.lastIndex = 0;
    for (let match; (match = pattern.exec(text)); ) {
      const byteOffset = offset - tail.length + match.index;
      const value = match[1] ?? match[0];
      const key = `${blob.sha}/${member}/${rule}/${byteOffset}`;
      if (hitKeys.has(key)) continue;
      hitKeys.add(key);
      scan.hits.push({
        blob: blob.sha,
        path: member ? `${blob.path}!${member}` : blob.path,
        rule,
        byte_offset: byteOffset,
        match_bytes: value.length,
        value_sha256: sha256(Buffer.from(value, "latin1")),
        placeholder_hint:
          /example|placeholder|fake|dummy|test|your[_-]|redacted|process\.env|not[_-](?:a|real)|api[_-]key/i.test(
            value,
          ),
        code_expression_hint: /=>|\btypeof\b|\$\{|\bfunction\b/.test(value),
      });
    }
  }
}
async function scanStream(stream, blob, member = "") {
  let offset = 0;
  let tail = Buffer.alloc(0);
  let binary;
  for await (const raw of stream) {
    const chunk = Buffer.from(raw);
    scan.bytes += chunk.length;
    binary ??= chunk.subarray(0, 4096).includes(0);
    if (!binary) scanChunk(chunk, tail, offset, blob, member);
    tail = binary ? Buffer.alloc(0) : Buffer.concat([tail, chunk]).subarray(-1024);
    offset += chunk.length;
    if (offset > 8 * 1024 ** 3) throw new Error("Expanded member exceeded the 8 GiB audit bound.");
  }
  if (binary) scan.binary_payloads_skipped++;
}
function* chunks(data) {
  for (let start = 0; start < data.length; start += 1024 * 1024)
    yield data.subarray(start, start + 1024 * 1024);
}
async function scanZip(data, blob) {
  let eocd = -1;
  for (let index = data.length - 22; index >= Math.max(0, data.length - 65557); index--) {
    if (data.readUInt32LE(index) === 0x06054b50) {
      eocd = index;
      break;
    }
  }
  if (eocd < 0) throw new Error("ZIP central directory not found.");
  const entries = data.readUInt16LE(eocd + 10);
  let position = data.readUInt32LE(eocd + 16);
  if (entries === 65535 || position === 0xffffffff)
    throw new Error("ZIP64 requires separate review.");
  for (let entry = 0; entry < entries; entry++) {
    if (data.readUInt32LE(position) !== 0x02014b50) throw new Error("Invalid ZIP directory entry.");
    const flags = data.readUInt16LE(position + 8);
    const method = data.readUInt16LE(position + 10);
    const compressedSize = data.readUInt32LE(position + 20);
    const nameSize = data.readUInt16LE(position + 28);
    const extraSize = data.readUInt16LE(position + 30);
    const commentSize = data.readUInt16LE(position + 32);
    const local = data.readUInt32LE(position + 42);
    const name = data.subarray(position + 46, position + 46 + nameSize).toString("utf8");
    position += 46 + nameSize + extraSize + commentSize;
    if (name.endsWith("/")) continue;
    if (flags & 1) throw new Error("Encrypted ZIP member requires separate review.");
    if (data.readUInt32LE(local) !== 0x04034b50) throw new Error("Invalid ZIP local entry.");
    const start = local + 30 + data.readUInt16LE(local + 26) + data.readUInt16LE(local + 28);
    const payload = data.subarray(start, start + compressedSize);
    scan.archive_members++;
    if (method === 0) await scanStream(Readable.from(chunks(payload)), blob, name);
    else if (method === 8)
      await scanStream(Readable.from(chunks(payload)).pipe(createInflateRaw()), blob, name);
    else throw new Error(`Unsupported ZIP method ${method}.`);
  }
}
class GitReader {
  constructor(stream) {
    this.iterator = stream[Symbol.asyncIterator]();
    this.pending = Buffer.alloc(0);
  }
  async read(size) {
    const parts = [];
    let bytes = 0;
    while (bytes < size) {
      if (!this.pending.length) {
        const next = await this.iterator.next();
        if (next.done) throw new Error("Git blob stream ended early.");
        this.pending = next.value;
      }
      const take = Math.min(size - bytes, this.pending.length);
      parts.push(this.pending.subarray(0, take));
      this.pending = this.pending.subarray(take);
      bytes += take;
    }
    return parts.length === 1 ? parts[0] : Buffer.concat(parts, size);
  }
  async line() {
    const parts = [];
    for (;;) {
      if (!this.pending.length) {
        const next = await this.iterator.next();
        if (next.done) throw new Error("Git header stream ended early.");
        this.pending = next.value;
      }
      const end = this.pending.indexOf(10);
      if (end >= 0) {
        parts.push(this.pending.subarray(0, end));
        this.pending = this.pending.subarray(end + 1);
        return Buffer.concat(parts).toString();
      }
      parts.push(this.pending);
      this.pending = Buffer.alloc(0);
    }
  }
}
if (args.includes("--self-test")) {
  const synthetic = Buffer.from("x".repeat(1020) + " " + ["sk", "a".repeat(30)].join("-"));
  const fixture = { sha: "synthetic-self-test", path: "synthetic-self-test" };
  await scanStream(Readable.from([synthetic.subarray(0, 1024), synthetic.subarray(1024)]), fixture);
  if (!scan.hits.some((hit) => hit.rule === "openai-token"))
    throw new Error("Split token self-test failed.");
  scan.hits.length = 0;
  await scanStream(Readable.from([gzipSync(synthetic)]).pipe(createGunzip()), fixture, "gzip");
  if (!scan.hits.some((hit) => hit.rule === "openai-token"))
    throw new Error("GZIP self-test failed.");
  process.stdout.write(
    JSON.stringify({
      self_test: "PASS",
      cases: ["split-token", "gzip-token"],
      values_emitted: false,
    }) + "\n",
  );
  process.exit(0);
}
if (!args.includes("--metadata-only")) {
  const child = spawn("git", ["cat-file", "--batch"], { stdio: ["pipe", "pipe", "inherit"] });
  child.stdin.end(blobs.map((blob) => blob.sha).join("\n") + "\n");
  const reader = new GitReader(child.stdout);
  for (const [index, blob] of blobs.entries()) {
    const header = await reader.line();
    if (header !== `${blob.sha} blob ${blob.bytes}`)
      throw new Error(`Unexpected Git header for ${blob.sha}.`);
    const data = await reader.read(blob.bytes);
    await reader.read(1);
    try {
      await scanStream(Readable.from(chunks(data)), blob);
      if (data[0] === 0x1f && data[1] === 0x8b) {
        scan.archive_members++;
        await scanStream(Readable.from(chunks(data)).pipe(createGunzip()), blob, "gzip");
      } else if (data.length >= 4 && data.readUInt32LE(0) === 0x04034b50) await scanZip(data, blob);
    } catch (error) {
      scan.errors.push({ blob: blob.sha, path: blob.path, error: error.message });
    }
    if (args.includes("--progress") && (index + 1) % 250 === 0)
      process.stderr.write(
        `Audited ${index + 1}/${blobs.length} blobs; expanded/text input ${scan.bytes} bytes.\n`,
      );
  }
}
scan.rule_hit_counts = Object.fromEntries(
  [...new Set(scan.hits.map((hit) => hit.rule))].map((rule) => [
    rule,
    scan.hits.filter((hit) => hit.rule === rule).length,
  ]),
);
process.stdout.write(JSON.stringify(summary, null, 2) + "\n");
process.exitCode = scan.errors.length ? 2 : 0;
