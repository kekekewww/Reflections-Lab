import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const COMMIT = "2d228630ba1446365f614a108cb8252f1feda202";
const REPOSITORY = "https://github.com/emilkowalski/skills";
const SKILLS = new Set([
  "emil-design-eng",
  "animate",
  "review-animations",
  "improve-animations",
  "animation-performance",
  "pick-ui-library",
  "prototype",
  "break-ui",
]);
const REQUIRED_STATES = ["Default", "Hover", "Focus", "Active", "Disabled", "Loading", "Error"];
const COMPONENTS = [
  "ProjectBar",
  "SimulationTransport",
  "SceneExplorer",
  "ObjectLibrary",
  "Viewport",
  "TransformInspector",
  "PhysicsInspector",
  "SoundEmitterInspector",
  "AcousticSurfaceInspector",
  "ListenerInspector",
  "FPSHud",
  "EventTimeline",
  "AcousticLayerPanel",
  "PathTableInspector",
  "IRMetricsDock",
  "ComparisonPanel",
  "MonitorStrip",
  "AICommandPalette",
  "StatusEvidenceBadge",
];
const MANIFEST_PATH = "third_party/emil-skills.manifest.json";
const sha = (algorithm, bytes) => createHash(algorithm).update(bytes).digest("hex");
const gitBlob = (bytes) =>
  sha("sha1", Buffer.concat([Buffer.from(`blob ${bytes.length}\0`), bytes]));

export async function loadManifest(root) {
  return JSON.parse(await fs.readFile(path.join(root, MANIFEST_PATH), "utf8"));
}

function validateManifest(manifest) {
  if (
    manifest.schemaVersion !== 1 ||
    manifest.repository !== REPOSITORY ||
    manifest.commit !== COMMIT
  )
    throw new Error("Unexpected upstream repository, commit or manifest version");
  if (manifest.license !== "MIT" || manifest.licensePath !== "third_party/emil-skills.LICENSE")
    throw new Error("Missing MIT license reference");
  if (!Array.isArray(manifest.files) || manifest.files.length !== 16)
    throw new Error("Expected the curated 16 upstream files");
  const seen = new Set();
  const selected = new Set();
  for (const file of manifest.files) {
    const source = file.sourcePath;
    const match = /^skills\/([a-z-]+)\/([A-Z-]+\.md)$/.exec(source);
    const expected =
      source === "LICENSE"
        ? "third_party/emil-skills.LICENSE"
        : source === "README.md"
          ? "third_party/emil-skills.README.md"
          : `.agents/${source}`;
    if (!(source === "LICENSE" || source === "README.md" || (match && SKILLS.has(match[1]))))
      throw new Error(`Unapproved source: ${source}`);
    if (file.localPath !== expected || seen.has(expected))
      throw new Error(`Invalid target: ${expected}`);
    if (
      !Number.isSafeInteger(file.bytes) ||
      file.bytes < 1 ||
      file.bytes > 100_000 ||
      !/^[a-f0-9]{64}$/.test(file.sha256) ||
      !/^[a-f0-9]{40}$/.test(file.gitBlobSha1)
    )
      throw new Error(`Missing content pin: ${source}`);
    seen.add(expected);
    if (match && match[2] === "SKILL.md") selected.add(match[1]);
  }
  if (
    selected.size !== SKILLS.size ||
    !seen.has(manifest.licensePath) ||
    !seen.has("third_party/emil-skills.README.md")
  )
    throw new Error("Incomplete curated skills");
}

// Reject symbolic links/junctions on every existing ancestor, including the root.
// A native race against hostile path replacement is outside this local tool's contract.
async function safePath(root, relative) {
  const base = path.resolve(root);
  const target = path.resolve(base, relative);
  if (!target.startsWith(base + path.sep) || path.isAbsolute(relative))
    throw new Error(`Path escapes workspace: ${relative}`);
  const parsed = path.parse(base);
  let cursor = parsed.root;
  const parts = path.relative(parsed.root, target).split(path.sep);
  for (const part of parts) {
    cursor = path.join(cursor, part);
    try {
      if ((await fs.lstat(cursor)).isSymbolicLink()) throw new Error(`Refuse link: ${cursor}`);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  return target;
}

function assertBytes(bytes, file) {
  if (
    bytes.length !== file.bytes ||
    sha("sha256", bytes) !== file.sha256 ||
    gitBlob(bytes) !== file.gitBlobSha1
  )
    throw new Error(`Content pin mismatch: ${file.sourcePath}`);
}

export async function checkSkillBundle(root, { manifest } = {}) {
  manifest ??= await loadManifest(root);
  validateManifest(manifest);
  const files = [];
  for (const file of manifest.files) {
    const target = await safePath(root, file.localPath);
    try {
      assertBytes(await fs.readFile(target), file);
      files.push({ path: file.localPath, status: "MATCH" });
    } catch (error) {
      if (error.code === "ENOENT") files.push({ path: file.localPath, status: "MISSING" });
      else if (error.message.startsWith("Content pin mismatch:"))
        files.push({ path: file.localPath, status: "DIFFERENT", error: error.message });
      else throw error;
    }
  }
  return { ok: files.every((f) => f.status === "MATCH"), commit: COMMIT, files };
}

export async function restoreSkillBundle(root, { manifest, fetchImpl = fetch } = {}) {
  manifest ??= await loadManifest(root);
  const before = await checkSkillBundle(root, { manifest });
  if (before.files.some((f) => f.status === "DIFFERENT"))
    throw new Error(
      "Existing upstream files differ; preserve the diff and review instead of overwriting",
    );
  const missing = new Set(before.files.filter((f) => f.status === "MISSING").map((f) => f.path));
  const staged = [];
  // Verify every response before creating any skill file. No archives, redirects or executable hooks.
  for (const file of manifest.files.filter((f) => missing.has(f.localPath))) {
    const url = `https://raw.githubusercontent.com/emilkowalski/skills/${COMMIT}/${file.sourcePath}`;
    const response = await fetchImpl(url, {
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) throw new Error(`Download ${response.status}: ${file.sourcePath}`);
    if (!response.body?.getReader) throw new Error(`No bounded response body: ${file.sourcePath}`);
    const reader = response.body.getReader();
    const chunks = [];
    let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > file.bytes) throw new Error(`Download exceeds pinned size: ${file.sourcePath}`);
        chunks.push(value);
      }
    } finally {
      await reader.cancel();
    }
    const bytes = Buffer.concat(chunks);
    assertBytes(bytes, file);
    staged.push({ file, bytes });
  }
  const created = [];
  for (const { file, bytes } of staged) {
    const target = await safePath(root, file.localPath);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await safePath(root, file.localPath);
    await fs.writeFile(target, bytes, { flag: "wx" });
    created.push(file.localPath);
  }
  return { ...(await checkSkillBundle(root, { manifest })), created };
}

function luminance(hex) {
  const channels = hex
    .slice(1)
    .match(/../g)
    .map((v) => parseInt(v, 16) / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

export async function validateDesignStandards(root) {
  const read = async (name) =>
    JSON.parse(await fs.readFile(path.join(root, "docs/05-ux", name), "utf8"));
  const [tokens, schema, states] = await Promise.all([
    read("DESIGN_TOKENS.json"),
    read("DESIGN_TOKENS.schema.json"),
    read("COMPONENT_STATES.json"),
  ]);
  const errors = [];
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  if (!validate(tokens))
    errors.push(...validate.errors.map((e) => `${e.instancePath}: ${e.message}`));
  const leaves = new Map();
  function walk(group, prefix = "") {
    for (const [key, value] of Object.entries(group ?? {})) {
      const id = prefix ? `${prefix}.${key}` : key;
      if (value && typeof value === "object" && "$type" in value) leaves.set(id, value);
      else if (value && typeof value === "object") walk(value, id);
    }
  }
  walk(tokens.groups);
  for (const [id, token] of leaves) {
    const value = token.$value;
    const type = token.$type;
    if (type === "color" && !(typeof value === "string" && /^#[A-Fa-f0-9]{6}$/.test(value)))
      errors.push(`${id}: expected opaque sRGB hex`);
    if (
      (type === "dimension" || type === "duration") &&
      !(typeof value === "string" && (type === "duration" ? /^\d+ms$/ : /^\d+px$/).test(value))
    )
      errors.push(`${id}: invalid unit`);
    if (type === "number" && !(typeof value === "number" && Number.isFinite(value)))
      errors.push(`${id}: expected finite number`);
    if (
      type === "cubicBezier" &&
      !(
        Array.isArray(value) &&
        value.length === 4 &&
        value.every(Number.isFinite) &&
        value[0] >= 0 &&
        value[0] <= 1 &&
        value[2] >= 0 &&
        value[2] <= 1
      )
    )
      errors.push(`${id}: invalid cubic Bezier`);
    if (["string", "shadow", "fontFamily"].includes(type) && typeof value !== "string")
      errors.push(`${id}: expected string`);
    if (id.startsWith("spacing.") && (type !== "dimension" || parseInt(value, 10) % 4 !== 0))
      errors.push(`${id}: spacing must follow 4px grid`);
  }
  for (const group of [
    "color",
    "typography",
    "spacing",
    "radius",
    "border",
    "elevation",
    "motion",
    "zIndex",
    "interactive",
    "acoustic",
  ])
    if (!tokens.groups?.[group]) errors.push(`Missing token group: ${group}`);
  for (const [id, token] of leaves) {
    if (!id.startsWith("acoustic.")) continue;
    const colorReference = /^color\.[A-Za-z]+/.exec(token.$value)?.[0];
    if (!colorReference || leaves.get(colorReference)?.$type !== "color")
      errors.push(`${id}: missing canonical color reference`);
  }
  for (const state of REQUIRED_STATES)
    if (
      !states.requiredStates?.includes(state) ||
      typeof states.commonStates?.[state] !== "string" ||
      !states.commonStates[state].trim()
    )
      errors.push(`Missing common state: ${state}`);
  const seen = new Set();
  for (const component of states.components ?? []) {
    if (seen.has(component.id)) errors.push(`Duplicate component: ${component.id}`);
    seen.add(component.id);
    if (!states.profiles?.[component.profile]) errors.push(`Missing profile: ${component.id}`);
    for (const state of component.extensions ?? [])
      if (!states.extensions?.[state]) errors.push(`Unknown extension: ${component.id}/${state}`);
  }
  for (const id of COMPONENTS) if (!seen.has(id)) errors.push(`Missing component: ${id}`);
  const ratios = [];
  const backgrounds = ["canvas", "panel", "raised"];
  const checks = {
    textPrimary: 4.5,
    textSecondary: 4.5,
    textMuted: 4.5,
    accent: 3,
    success: 3,
    warning: 3,
    danger: 3,
    borderControl: 3,
  };
  for (const [foreground, minimum] of Object.entries(checks)) {
    const fg = leaves.get(`color.${foreground}`)?.$value;
    for (const background of backgrounds) {
      const bg = leaves.get(`color.${background}`)?.$value;
      if (![fg, bg].every((v) => typeof v === "string" && /^#[A-Fa-f0-9]{6}$/.test(v))) {
        errors.push(`Missing contrast pair: ${foreground}/${background}`);
        continue;
      }
      const [light, dark] = [luminance(fg), luminance(bg)].sort((a, b) => b - a);
      const ratio = (light + 0.05) / (dark + 0.05);
      ratios.push({ foreground, background, ratio, minimum });
      if (ratio < minimum) errors.push(`Contrast below ${minimum}: ${foreground}/${background}`);
    }
  }
  return {
    ok: errors.length === 0,
    tokenCount: leaves.size,
    componentCount: seen.size,
    ratios,
    errors,
    scope: "STATIC TOKENS/STANDARDS ONLY; UI, browser, physics, audio, hearing NOT RUN",
  };
}

async function main() {
  const args = process.argv.slice(2);
  if (
    args.length > 1 ||
    (args.length === 1 && !["--check", "--dry-run", "--restore", "--standards"].includes(args[0]))
  )
    throw new Error(
      "Usage: node scripts/setup/emil-skills.mjs [--check|--dry-run|--restore|--standards]",
    );
  const root = fileURLToPath(new URL("../../", import.meta.url));
  const mode = args[0] ?? "--check";
  const result =
    mode === "--standards"
      ? await validateDesignStandards(root)
      : mode === "--restore"
        ? await restoreSkillBundle(root)
        : await checkSkillBundle(root);
  console.log(JSON.stringify({ mode, ...result }, null, 2));
  process.exitCode = result.ok || mode === "--dry-run" ? 0 : 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
