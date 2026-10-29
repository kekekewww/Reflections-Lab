import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createHash, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import YAML from "yaml";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const schemaRoot = fileURLToPath(new URL("../../schemas/", import.meta.url));
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
for (const name of ["task", "page", "source-manifest", "event"])
  ajv.addSchema(
    JSON.parse(fs.readFileSync(path.join(schemaRoot, `wiki-${name}.schema.json`), "utf8")),
  );
const timestamp = () => new Date().toISOString();
const jsonText = (value) => `${JSON.stringify(value, null, 2)}\n`;
const slash = (value) => value.split(path.sep).join("/");
const pathIdentity = (value) =>
  typeof value === "string"
    ? process.platform === "win32"
      ? value.replaceAll("\\", "/").toLowerCase()
      : value.replaceAll("\\", "/")
    : value;
const unique = (value) => [...new Set(value)];
const activeAssertion = (item) => ["ACCEPTED", "VERIFIED"].includes(item.status);

export class WikiError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

export function hash(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function parsePage(text) {
  if (Buffer.byteLength(text, "utf8") > 1024 * 1024)
    throw new WikiError("PAGE_SIZE", "單頁上限為 1 MiB；請分拆知識頁面。");
  const match = /^\uFEFF?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)([\s\S]*)$/.exec(text);
  if (!match) throw new WikiError("FRONTMATTER", "Markdown 必須以 YAML frontmatter 開始。");
  const doc = YAML.parseDocument(match[1], { uniqueKeys: true, customTags: [] });
  if (doc.errors.length || doc.warnings.length)
    throw new WikiError(
      "FRONTMATTER",
      [...doc.errors, ...doc.warnings].map((item) => item.message).join("; "),
    );
  const pending = [[doc.contents, 0]];
  while (pending.length) {
    const [node, depth] = pending.pop();
    if (!node || typeof node !== "object") continue;
    if (depth > 64) throw new WikiError("YAML_DEPTH", "YAML metadata 巢狀深度不得超過 64。");
    if (YAML.isAlias(node)) throw new WikiError("YAML_ALIAS", "Metadata 不允許 YAML aliases。");
    if (Array.isArray(node.items)) for (const item of node.items) pending.push([item, depth + 1]);
    else if (YAML.isPair(node)) pending.push([node.key, depth + 1], [node.value, depth + 1]);
  }
  const metadata = doc.toJS({ maxAliasCount: 0 });
  validate("page", metadata);
  return { metadata, body: match[2].replace(/^\r?\n/, "") };
}

export function renderPage(metadata, body) {
  validate("page", metadata);
  return `---\n${YAML.stringify(metadata, { lineWidth: 100 }).trimEnd()}\n---\n\n${body.trimEnd()}\n`;
}

function validate(name, value) {
  const validator = ajv.getSchema(`https://reflection-lab.local/schemas/wiki-${name}.schema.json`);
  if (!validator(value))
    throw new WikiError(
      "SCHEMA",
      `${name}: ${ajv.errorsText(validator.errors, { separator: "; " })}`,
    );
}

// All reads and writes reject symlink/junction components; a repository-relative path
// is an address, never an instruction to follow a link outside the selected root.
function safe(root, relative) {
  if (
    typeof relative !== "string" ||
    !relative ||
    path.isAbsolute(relative) ||
    /^[A-Za-z]:/.test(relative)
  )
    throw new WikiError("PATH", `必須使用專案內相對路徑：${relative}`);
  const segments = relative.replaceAll("\\", "/").split("/");
  if (
    segments.includes("..") ||
    segments.includes(".") ||
    segments.includes("") ||
    relative.includes("\0") ||
    segments.some(
      (segment) =>
        /[:<>"|?*]/.test(segment) ||
        /[. ]$/.test(segment) ||
        /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(segment),
    )
  )
    throw new WikiError("PATH", `拒絕不安全路徑：${relative}`);
  const target = path.resolve(root, ...segments);
  if (!target.startsWith(`${root}${path.sep}`)) throw new WikiError("PATH", "路徑超出專案。");
  let current = root;
  for (const segment of segments) {
    current = path.join(current, segment);
    try {
      if (fs.lstatSync(current).isSymbolicLink())
        throw new WikiError("SYMLINK", `拒絕符號連結或 junction：${relative}`);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  return target;
}

function wikiPath(relative) {
  relative = typeof relative === "string" ? relative.replaceAll("\\", "/") : relative;
  if (!/^wiki\/.+\.md$/.test(relative))
    throw new WikiError("PATH", `頁面必須位於 wiki/ 並使用 .md：${relative}`);
  return `knowledge/${relative}`;
}

function read(root, relative) {
  const target = safe(root, relative);
  return fs.existsSync(target) ? fs.readFileSync(target, "utf8") : null;
}

function readJson(root, relative, fallback) {
  const text = read(root, relative);
  return text === null ? fallback : JSON.parse(text);
}

function trackedRead(context, file) {
  const text = read(context.root, file);
  if (!context.expectedHashes.has(file))
    context.expectedHashes.set(file, text === null ? null : hash(text));
  return text;
}

function readInput(root, file) {
  const value = read(root, file);
  if (value === null) throw new WikiError("NOT_FOUND", `找不到 ${file}`);
  return JSON.parse(value);
}

function atomicWrite(root, relative, text, exclusive = false) {
  const target = safe(root, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  if (exclusive) {
    const fd = fs.openSync(target, "wx");
    try {
      fs.writeFileSync(fd, text);
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
    return;
  }
  const temporary = `${target}.${randomUUID()}.tmp`;
  const fd = fs.openSync(temporary, "wx");
  try {
    fs.writeFileSync(fd, text);
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  try {
    fs.renameSync(temporary, target);
  } catch (error) {
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
    throw error;
  }
}

function list(root, folder, extension) {
  const target = safe(root, folder);
  if (!fs.existsSync(target)) return [];
  const output = [];
  for (const entry of fs
    .readdirSync(target, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name))) {
    const relative = `${folder}/${entry.name}`;
    safe(root, relative);
    if (entry.isDirectory()) output.push(...list(root, relative, extension));
    else if (entry.isFile() && entry.name.endsWith(extension)) output.push(relative);
  }
  return output;
}

function pages(root, updates = new Map()) {
  const names = unique([
    ...list(root, "knowledge/wiki", ".md"),
    ...[...updates.keys()].filter(
      (file) => file.startsWith("knowledge/wiki/") && file.endsWith(".md"),
    ),
  ]);
  return names.map((file) => ({
    path: file.slice("knowledge/".length),
    ...parsePage(updates.has(file) ? updates.get(file) : read(root, file)),
  }));
}

function manifest(root) {
  const value = readJson(root, "knowledge/sources/manifest.json", {
    schema_version: 1,
    sources: [],
  });
  validate("source-manifest", value);
  return value;
}

function tasks(root, updates = new Map()) {
  const names = unique([
    ...list(root, "knowledge/tasks", ".json"),
    ...[...updates.keys()].filter(
      (file) => file.startsWith("knowledge/tasks/") && file.endsWith(".json"),
    ),
  ]);
  return names.map((file) => {
    const value = JSON.parse(updates.has(file) ? updates.get(file) : read(root, file));
    validate("task", value);
    return value;
  });
}

function makeEvent(type, input, details) {
  const event = {
    id: randomUUID(),
    type,
    created_at: timestamp(),
    agent: input.agent,
    session: input.session,
    summary: input.summary,
    task_id: input.task_id ?? null,
    details,
  };
  validate("event", event);
  return event;
}

function secretCheck(text) {
  if (
    /(?:\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}|\bAKIA[A-Z0-9]{16}\b|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|(?:api[_-]?key|access[_-]?token|password)\s*[:=]\s*["']?[A-Za-z0-9_./+-]{20,})/i.test(
      text,
    )
  )
    throw new WikiError("POSSIBLE_SECRET", "內容疑似包含憑證；請移除後再保存。");
}

function assertionConflicts(allPages) {
  const groups = new Map();
  for (const page of allPages) {
    if (page.metadata.status === "DEPRECATED") continue;
    for (const assertion of page.metadata.assertions ?? []) {
      if (!activeAssertion(assertion)) continue;
      const rows = groups.get(assertion.key) ?? [];
      rows.push({ path: page.path, ...assertion });
      groups.set(assertion.key, rows);
    }
  }
  return [...groups]
    .filter(([_key, rows]) => new Set(rows.map((row) => JSON.stringify(row.value))).size > 1)
    .map(([key, assertions]) => ({ key, assertions }));
}

function sourceGraphErrors(sources) {
  const errors = [];
  const byId = new Map(sources.map((source) => [source.id, source]));
  const visited = new Set();
  const active = new Set();
  function visit(id) {
    if (active.has(id)) {
      errors.push(`來源版本形成循環：${id}`);
      return;
    }
    if (visited.has(id)) return;
    active.add(id);
    const source = byId.get(id);
    for (const predecessor of source.supersedes ?? []) {
      const old = byId.get(predecessor);
      if (!old) errors.push(`前版 ${predecessor} 不存在。`);
      else {
        if (
          pathIdentity(old.path) !== pathIdentity(source.path) ||
          (source.path === null && old.url !== source.url)
        )
          errors.push(`${id} 的前版 ${predecessor} 指向不同來源。`);
        visit(predecessor);
      }
    }
    active.delete(id);
    visited.add(id);
  }
  for (const source of sources) visit(source.id);
  return unique(errors);
}

function supersedeCycles(allPages) {
  const pagesById = new Map(allPages.map((page) => [page.metadata.id, page]));
  const visited = new Set();
  const active = new Set();
  const cycles = [];
  function visit(id) {
    if (active.has(id)) {
      cycles.push(id);
      return;
    }
    if (visited.has(id)) return;
    active.add(id);
    for (const old of pagesById.get(id)?.metadata.supersedes ?? [])
      if (pagesById.has(old)) visit(old);
    active.delete(id);
    visited.add(id);
  }
  for (const id of pagesById.keys()) visit(id);
  return unique(cycles);
}

function defaultMetadata(id, title, type) {
  const now = timestamp();
  return {
    id,
    title,
    type,
    status: "UNVERIFIED",
    created_at: now,
    updated_at: now,
    sources: [],
    related_tasks: [],
    related_decisions: [],
    supersedes: [],
    tags: [],
  };
}

function generated(root, updates, file, title, type, body) {
  const previous = updates.get(file) ?? read(root, file);
  updates.expectedHashes ??= new Map();
  if (!updates.expectedHashes.has(file))
    updates.expectedHashes.set(file, previous === null ? null : hash(previous));
  const page = previous
    ? parsePage(previous)
    : {
        metadata: defaultMetadata(`RLAB-KB-${type.toUpperCase()}`, title, type),
        body: `# ${title}\n`,
      };
  const start = "<!-- wiki:generated:start -->";
  const end = "<!-- wiki:generated:end -->";
  const block = `${start}\n${body.trimEnd()}\n${end}`;
  const first = page.body.indexOf(start);
  const last = page.body.indexOf(end);
  if (first < 0 !== last < 0 || (first >= 0 && last < first))
    throw new WikiError("GENERATED_MARKER", `${file} 生成區塊標記不完整。`);
  const next =
    first >= 0
      ? `${page.body.slice(0, first)}${block}${page.body.slice(last + end.length)}`
      : `${page.body.trimEnd()}\n\n${block}\n`;
  if (next.trimEnd() !== page.body.trimEnd()) {
    page.metadata.updated_at = timestamp();
    updates.set(file, renderPage(page.metadata, next));
  }
}

function derive(root, updates, event) {
  const allPages = pages(root, updates);
  const manifestFile = "knowledge/sources/manifest.json";
  const manifestText = updates.get(manifestFile) ?? read(root, manifestFile);
  const sourceManifest =
    manifestText === null ? { schema_version: 1, sources: [] } : JSON.parse(manifestText);
  validate("source-manifest", sourceManifest);
  let sourceLinksChanged = false;
  for (const source of sourceManifest.sources) {
    const references = allPages
      .filter((page) => page.metadata.sources.includes(source.id))
      .map((page) => page.path)
      .sort();
    if (JSON.stringify(source.wiki_pages) !== JSON.stringify(references)) {
      source.wiki_pages = references;
      sourceLinksChanged = true;
    }
  }
  if (sourceLinksChanged) {
    updates.expectedHashes ??= new Map();
    if (!updates.has(manifestFile) && !updates.expectedHashes.has(manifestFile))
      updates.expectedHashes.set(manifestFile, manifestText === null ? null : hash(manifestText));
    updates.set(manifestFile, jsonText(sourceManifest));
  }
  generated(
    root,
    updates,
    "knowledge/wiki/index.md",
    "知識索引",
    "index",
    allPages
      .filter((page) => page.path !== "wiki/index.md")
      .sort((a, b) => a.path.localeCompare(b.path))
      .map(
        (page) =>
          `- [${page.metadata.title}](${page.path.slice("wiki/".length)}) — ${page.metadata.type} / ${page.metadata.status} / ${page.metadata.updated_at}`,
      )
      .join("\n"),
  );
  const events = list(root, "knowledge/events", ".json").map((file) => readJson(root, file));
  if (event) events.push(event);
  events.sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
  generated(
    root,
    updates,
    "knowledge/wiki/log.md",
    "事件時間索引",
    "log",
    events
      .map(
        (item) =>
          `- ${item.created_at} [${item.type}: ${item.summary}](../events/${item.id}.json) — ${item.agent} / ${item.session}`,
      )
      .join("\n"),
  );
  generated(
    root,
    updates,
    "knowledge/wiki/tasks.md",
    "任務索引",
    "tasks",
    tasks(root, updates)
      .map(
        (item) =>
          `- [${item.id}: ${item.title}](../tasks/${item.id}.json) — ${item.status} / ${item.priority} / ${item.owner?.agent ?? "未認領"}`,
      )
      .join("\n"),
  );
  // Include newly generated log/tasks pages in the index on the first mutation.
  const finalPages = pages(root, updates);
  generated(
    root,
    updates,
    "knowledge/wiki/index.md",
    "知識索引",
    "index",
    finalPages
      .filter((page) => page.path !== "wiki/index.md")
      .sort((a, b) => a.path.localeCompare(b.path))
      .map(
        (page) =>
          `- [${page.metadata.title}](${page.path.slice("wiki/".length)}) — ${page.metadata.type} / ${page.metadata.status} / ${page.metadata.updated_at}`,
      )
      .join("\n"),
  );
}

function pendingTransactions(root) {
  return list(root, "knowledge/transactions", ".json")
    .map((file) => readJson(root, file))
    .filter((item) => ["PREPARED", "APPLYING", "RECOVERY_REQUIRED"].includes(item.status));
}

async function withLock(context, callback, { recovery = false } = {}) {
  if (context.dryRun) return callback();
  const root = context.root;
  const lock = safe(root, "knowledge/.locks/writer");
  fs.mkdirSync(path.dirname(lock), { recursive: true });
  const token = randomUUID();
  const deadline = Date.now() + 4000;
  for (;;) {
    try {
      fs.mkdirSync(lock);
      break;
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      if (Date.now() >= deadline)
        throw new WikiError("LOCKED", "另一個 writer 持有鎖；不會自動竊取過期鎖。", {
          owner: readJson(root, "knowledge/.locks/writer/owner.json", null),
        });
      await delay(20 + Math.floor(Math.random() * 30));
    }
  }
  try {
    atomicWrite(
      root,
      "knowledge/.locks/writer/owner.json",
      jsonText({ token, pid: process.pid, host: os.hostname(), created_at: timestamp() }),
      true,
    );
    if (!recovery) {
      const pending = pendingTransactions(root);
      if (pending.length)
        throw new WikiError("RECOVERY_REQUIRED", "有未完成交易；先執行 recover。", {
          transactions: pending.map((item) => item.id),
        });
    }
    return await callback();
  } finally {
    const owner = readJson(root, "knowledge/.locks/writer/owner.json", null);
    if (owner?.token === token) {
      fs.unlinkSync(safe(root, "knowledge/.locks/writer/owner.json"));
      fs.rmdirSync(lock);
    }
  }
}

// One process-wide writer serializes cooperating tools. Each rename is atomic,
// while a multi-file transaction is recoverable, explicitly not globally atomic.
function commit(context, updates, event) {
  if (event) updates.set(`knowledge/events/${event.id}.json`, jsonText(event));
  for (const [file, content] of updates) {
    safe(context.root, file);
    secretCheck(content);
  }
  const files = [...updates]
    .map(([file, content]) => {
      const previous = read(context.root, file);
      const actual = previous === null ? null : hash(previous);
      const expected = context.expectedHashes.has(file)
        ? context.expectedHashes.get(file)
        : updates.expectedHashes?.get(file);
      if (expected !== undefined && actual !== expected)
        throw new WikiError("EXTERNAL_WRITE", `預檢後偵測到外部修改，未建立交易：${file}`);
      return {
        path: file,
        before: previous,
        before_hash: previous === null ? null : hash(previous),
        after: content,
        after_hash: hash(content),
        exclusive: file.startsWith("knowledge/events/"),
      };
    })
    .filter((file) => file.before !== file.after);
  if (!files.length) return { ok: true, unchanged: true };
  if (context.dryRun)
    return {
      ok: true,
      dry_run: true,
      changed_files: files.map((file) => file.path),
      event_id: event?.id ?? null,
    };
  const transaction = { id: randomUUID(), created_at: timestamp(), status: "PREPARED", files };
  const journal = `knowledge/transactions/${transaction.id}.json`;
  atomicWrite(context.root, journal, jsonText(transaction), true);
  try {
    transaction.status = "APPLYING";
    atomicWrite(context.root, journal, jsonText(transaction));
    for (const file of files) {
      const current = read(context.root, file.path);
      if ((current === null ? null : hash(current)) !== file.before_hash)
        throw new WikiError("EXTERNAL_WRITE", `交易期間偵測到外部修改：${file.path}`);
      atomicWrite(context.root, file.path, file.after, file.exclusive);
    }
    transaction.status = "COMMITTED";
    transaction.completed_at = timestamp();
    atomicWrite(context.root, journal, jsonText(transaction));
  } catch (error) {
    transaction.status = "RECOVERY_REQUIRED";
    transaction.error = error.message;
    atomicWrite(context.root, journal, jsonText(transaction));
    throw new WikiError("RECOVERY_REQUIRED", error.message, { transaction_id: transaction.id });
  }
  return {
    ok: true,
    transaction_id: transaction.id,
    event_id: event?.id ?? null,
    changed_files: files.map((file) => file.path),
  };
}

function conflict(context, input, kind, details) {
  const record = {
    id: randomUUID(),
    status: "OPEN",
    kind,
    created_at: timestamp(),
    agent: input.agent,
    session: input.session,
    details,
    proposal: input,
  };
  const event = makeEvent(
    "conflict",
    { ...input, summary: `${kind}：保留提案等待重驗` },
    { conflict_id: record.id, kind },
  );
  const updates = new Map([[`knowledge/conflicts/${record.id}.json`, jsonText(record)]]);
  derive(context.root, updates, event);
  const result = commit(context, updates, event);
  throw new WikiError("CONFLICT", "衝突已保留；未覆寫現有知識。", {
    ...result,
    conflict_id: record.id,
    kind,
    details,
  });
}

function checkExpected(context, input, proposed) {
  for (const page of proposed) {
    const target = wikiPath(page.path);
    const current = read(context.root, target);
    const actual = current === null ? null : hash(current);
    if (actual !== page.expected_hash)
      conflict(context, input, "STALE_PATCH", {
        path: page.path,
        expected_hash: page.expected_hash,
        actual_hash: actual,
        current,
        proposed: page,
      });
    context.expectedHashes.set(target, page.expected_hash);
  }
}

function stagePages(context, input, proposed, { reviewedReplacement = false } = {}) {
  if (!Array.isArray(proposed) || !proposed.length)
    throw new WikiError("PLAN", "至少需要一個明確的綜合頁面更新。");
  const updates = new Map();
  const targets = new Set();
  for (const page of proposed) {
    page.path = typeof page.path === "string" ? page.path.replaceAll("\\", "/") : page.path;
    if (["wiki/index.md", "wiki/log.md", "wiki/tasks.md"].includes(pathIdentity(page.path)))
      throw new WikiError("GENERATED", "請更新權威資料；index/log/tasks 由工具生成。");
    if (
      !Object.hasOwn(page, "expected_hash") ||
      !(page.expected_hash === null || /^[a-f0-9]{64}$/.test(page.expected_hash))
    )
      throw new WikiError("PLAN", "每個 patch 必須提供 expected_hash（新檔案用 null）。");
    if (typeof page.body !== "string" || !page.body.trim())
      throw new WikiError("PLAN", "必須提供實際綜合整理內容。");
    const target = wikiPath(page.path);
    if (targets.has(pathIdentity(target))) throw new WikiError("PLAN", `重複 patch：${page.path}`);
    targets.add(pathIdentity(target));
    updates.set(target, renderPage(page.metadata, page.body));
  }
  checkExpected(context, input, proposed);
  for (const page of proposed) {
    const previous = read(context.root, wikiPath(page.path));
    if (previous && parsePage(previous).metadata.id !== page.metadata.id)
      throw new WikiError(
        "PAGE_ID_CHANGE",
        "更新既有頁面不可變更 stable ID；請建立新頁與取代關係。",
      );
  }
  if (!reviewedReplacement)
    for (const page of proposed) {
      const previous = read(context.root, wikiPath(page.path));
      if (!previous) continue;
      const old = parsePage(previous);
      if (page.metadata.status === "DEPRECATED" && page.metadata.superseded_by?.length) continue;
      const changed = (old.metadata.assertions ?? [])
        .filter(activeAssertion)
        .filter((assertion) => {
          const replacement = page.metadata.assertions?.find((item) => item.key === assertion.key);
          return (
            !replacement ||
            !activeAssertion(replacement) ||
            JSON.stringify(replacement.value) !== JSON.stringify(assertion.value)
          );
        });
      if (changed.length)
        conflict(context, input, "ACCEPTED_ASSERTION_CHANGE", {
          path: page.path,
          previous: changed,
          proposed: page.metadata.assertions ?? [],
        });
    }
  const contradictions = assertionConflicts(pages(context.root, updates));
  if (contradictions.length) conflict(context, input, "ASSERTION_CONFLICT", { contradictions });
  const ids = pages(context.root, updates).map((page) => page.metadata.id);
  if (new Set(ids).size !== ids.length) throw new WikiError("DUPLICATE_ID", "頁面 ID 重複。");
  if (supersedeCycles(pages(context.root, updates)).length)
    throw new WikiError("SUPERSEDE_CYCLE", "頁面取代關係不可形成循環。");
  return updates;
}

function ingest(context, sourcePath, input) {
  sourcePath = typeof sourcePath === "string" ? sourcePath.replaceAll("\\", "/") : sourcePath;
  const sourceFile = safe(context.root, sourcePath);
  const sourceHash = hash(fs.readFileSync(sourceFile));
  const source = {
    ...input.source,
    path: sourcePath,
    sha256: sourceHash,
    acquired_at: input.source?.acquired_at ?? timestamp(),
    wiki_pages: input.pages?.map((page) => page.path) ?? [],
  };
  const manifestText = trackedRead(context, "knowledge/sources/manifest.json");
  const current =
    manifestText === null ? { schema_version: 1, sources: [] } : JSON.parse(manifestText);
  validate("source-manifest", current);
  const existing = current.sources.find((item) => item.id === source.id);
  const duplicate = current.sources.find(
    (item) =>
      item.id !== source.id &&
      pathIdentity(item.path) === pathIdentity(sourcePath) &&
      item.sha256 === sourceHash &&
      item.version === source.version,
  );
  if (duplicate)
    throw new WikiError(
      "DUPLICATE_SOURCE_VERSION",
      "相同路徑、hash 與版本已登錄，請使用既有來源 ID。",
      { source_id: duplicate.id },
    );
  if (
    existing &&
    (existing.sha256 !== sourceHash ||
      existing.path !== sourcePath ||
      existing.version !== source.version)
  )
    conflict(context, input, "SOURCE_VERSION", { existing, proposed: source });
  if (existing)
    for (const [key, value] of Object.entries(input.source)) {
      if (key === "wiki_pages") continue;
      if (
        JSON.stringify(value) !==
        JSON.stringify(existing[key] ?? (key === "supersedes" ? [] : undefined))
      )
        throw new WikiError(
          "SOURCE_IMMUTABLE",
          `來源 ${source.id} 的 ${key} 已釘選；請建立新版本 ID。`,
        );
    }
  const identical =
    existing &&
    input.pages?.every(
      (page) => read(context.root, wikiPath(page.path)) === renderPage(page.metadata, page.body),
    );
  if (identical) return { ok: true, unchanged: true, source_id: existing.id };
  if (existing?.snapshot_mode === "historical")
    throw new WikiError(
      "SOURCE_HISTORICAL",
      "歷史來源 ID 不可重新啟用或用於新的 ingest；請建立新版本 ID。",
    );
  const supersedes = source.supersedes ?? [];
  for (const id of supersedes) {
    const previous = current.sources.find((item) => item.id === id);
    if (!previous || id === source.id || pathIdentity(previous.path) !== pathIdentity(sourcePath))
      throw new WikiError("SOURCE_SUPERSEDES", `來源版本 ${id} 不存在、循環或指向不同路徑。`);
  }
  const unlinked = current.sources.filter(
    (item) =>
      item.id !== source.id &&
      pathIdentity(item.path) === pathIdentity(sourcePath) &&
      item.snapshot_mode !== "historical" &&
      item.sha256 !== sourceHash &&
      !supersedes.includes(item.id),
  );
  if (unlinked.length)
    throw new WikiError(
      "SOURCE_SUPERSEDES",
      "新來源版本必須明確 supersedes 相同路徑的 current 版本。",
      { source_ids: unlinked.map((item) => item.id) },
    );
  const updates = stagePages(context, input, input.pages);
  source.wiki_pages = input.pages.map((page) => page.path.replaceAll("\\", "/"));
  for (const id of supersedes)
    current.sources.find((item) => item.id === id).snapshot_mode = "historical";
  if (existing) existing.wiki_pages = unique([...existing.wiki_pages, ...source.wiki_pages]);
  else current.sources.push(source);
  validate("source-manifest", current);
  const graphErrors = sourceGraphErrors(current.sources);
  if (graphErrors.length) throw new WikiError("SOURCE_GRAPH", graphErrors.join("; "));
  const known = new Set(current.sources.map((item) => item.id));
  for (const page of input.pages)
    for (const id of page.metadata.sources)
      if (!known.has(id)) throw new WikiError("SOURCE_REFERENCE", `未知來源 ID：${id}`);
  updates.set("knowledge/sources/manifest.json", jsonText(current));
  const event = makeEvent("ingest", input, {
    source_id: source.id,
    source_hash: sourceHash,
    pages: input.pages.map((page) => page.path),
  });
  derive(context.root, updates, event);
  return { ...commit(context, updates, event), source_id: source.id };
}

function evidenceErrors(root, evidence) {
  const errors = [];
  for (const item of evidence) {
    try {
      const target = safe(root, item.path);
      if (!fs.existsSync(target)) errors.push(`證據不存在：${item.path}`);
      else if (hash(fs.readFileSync(target)) !== item.sha256)
        errors.push(`證據 hash 不符：${item.path}`);
    } catch (error) {
      errors.push(error.message);
    }
  }
  return errors;
}

function taskErrors(root, task) {
  const errors = evidenceErrors(root, task.evidence);
  if (task.agent_execution) {
    errors.push(
      ...evidenceErrors(root, [
        {
          path: task.agent_execution.run_state_path,
          sha256: task.agent_execution.run_state_sha256,
        },
        ...task.agent_execution.verification_evidence,
      ]),
    );
  }
  if (task.status === "DONE") {
    if (!task.evidence.length) errors.push("DONE 缺少 artifact 證據。");
    if (!task.acceptance_criteria.length) errors.push("DONE 缺少驗收條件。");
    for (const criterion of task.acceptance_criteria) {
      if (!criterion.verified || !criterion.evidence.length)
        errors.push(`驗收未驗證：${criterion.id}`);
      errors.push(...evidenceErrors(root, criterion.evidence));
    }
  }
  return errors;
}

function requireOwner(task, flags) {
  if (
    !task.owner ||
    task.owner.agent !== flags.agent ||
    task.owner.session !== flags.session ||
    task.owner.token !== flags.token
  )
    throw new WikiError("OWNER", "需要持有者的 agent、session 與 token。");
}

function taskOperation(context, operation, id, flags) {
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(id ?? ""))
    throw new WikiError("TASK_ID", "任務 ID 格式不正確。");
  const file = `knowledge/tasks/${id}.json`;
  const taskText = trackedRead(context, file);
  const task = taskText === null ? null : JSON.parse(taskText);
  if (!task) throw new WikiError("NOT_FOUND", `任務不存在：${id}`);
  validate("task", task);
  const before = JSON.stringify(task);
  const now = timestamp();
  const seconds = Number(flags["lease-seconds"] ?? 300);
  if (!Number.isInteger(seconds) || seconds < 10 || seconds > 86400)
    throw new WikiError("LEASE", "lease-seconds 必須介於 10–86400。");
  if (!flags.agent || !flags.session)
    throw new WikiError("OWNER", "必須提供 --agent 與 --session。");
  if (operation === "claim") {
    if (task.owner)
      throw new WikiError("CLAIMED", "任務已有持有者；lease 過期也不會自動竊取。", {
        owner: task.owner,
      });
    if (["DONE", "CANCELLED", "BLOCKED"].includes(task.status))
      throw new WikiError("TASK_STATE", "此狀態不可認領。");
    const others = tasks(context.root);
    if (
      task.dependencies.some(
        (dependency) => !others.find((item) => item.id === dependency && item.status === "DONE"),
      )
    )
      throw new WikiError("DEPENDENCY", "任務前置依賴尚未 DONE。");
    task.owner = {
      agent: flags.agent,
      session: flags.session,
      token: randomUUID(),
      claimed_at: now,
      heartbeat_at: now,
      lease_until: new Date(Date.now() + seconds * 1000).toISOString(),
    };
    task.status = "IN_PROGRESS";
  } else {
    requireOwner(task, flags);
    if (operation === "heartbeat") {
      task.owner.heartbeat_at = now;
      task.owner.lease_until = new Date(Date.now() + seconds * 1000).toISOString();
    } else if (operation === "release") {
      task.owner = null;
      if (task.status === "IN_PROGRESS") task.status = "READY";
    } else if (operation === "update") {
      const patch = readInput(context.root, flags.file);
      const allowed = new Set([
        "status",
        "description",
        "priority",
        "dependencies",
        "acceptance_criteria",
        "relevant_files",
        "evidence",
        "summary",
        "blockers",
        "agent_execution",
      ]);
      for (const key of Object.keys(patch))
        if (!allowed.has(key)) throw new WikiError("TASK_PATCH", `不允許修改：${key}`);
      const summary = patch.summary;
      delete patch.summary;
      Object.assign(task, patch);
      if (summary) task.last_summary = summary;
    } else throw new WikiError("COMMAND", `未知 task 操作：${operation}`);
  }
  task.updated_at = now;
  validate("task", task);
  const errors = taskErrors(context.root, task);
  if (errors.length) throw new WikiError("TASK_EVIDENCE", errors.join("; "));
  if (before === JSON.stringify(task)) return { ok: true, unchanged: true };
  const updates = new Map([[file, jsonText(task)]]);
  const event = makeEvent(
    `task.${operation}`,
    { ...flags, summary: `${id} ${operation}`, task_id: id },
    { status: task.status, owner: task.owner },
  );
  derive(context.root, updates, event);
  return { ...commit(context, updates, event), task, token: task.owner?.token ?? null };
}

function gitState(root) {
  const git = (...args) => {
    try {
      return execFileSync("git", args, {
        cwd: root,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      }).trim();
    } catch {
      return null;
    }
  };
  return {
    branch: git("symbolic-ref", "--short", "HEAD"),
    head: git("rev-parse", "--verify", "HEAD"),
    status: git("status", "--porcelain=v1", "-uall"),
    worktree: root,
  };
}

function recordOperation(context, type, input) {
  for (const key of ["agent", "session", "task_id", "summary"])
    if (typeof input[key] !== "string" || !input[key]) throw new WikiError("RECORD", `缺少 ${key}`);
  for (const key of ["completed", "commands", "evidence", "risks", "next_steps", "modified_files"])
    if (!Array.isArray(input[key])) throw new WikiError("RECORD", `${key} 必須為 array。`);
  if (!readJson(context.root, `knowledge/tasks/${input.task_id}.json`, null))
    throw new WikiError("RECORD", "task_id 不存在。");
  if (!input.next_steps.length) throw new WikiError("RECORD", "交接必須有明確下一步。");
  const errors = evidenceErrors(context.root, input.evidence);
  if (errors.length) throw new WikiError("EVIDENCE", errors.join("; "));
  const scopes = input.modified_files.map((file) => {
    const target = safe(context.root, file);
    return {
      path: file,
      sha256: fs.existsSync(target) ? hash(fs.readFileSync(target)) : null,
      state: fs.existsSync(target) ? "present" : "missing",
    };
  });
  const details = {
    ...input,
    git: gitState(context.root),
    modified_files: scopes,
    execution_note: "命令與結果由操作者提供；檔案 hash 與 Git 狀態由工具現場取得。",
  };
  const event = makeEvent(type, input, details);
  const updates = new Map();
  if (type === "handoff" && !input.now)
    throw new WikiError("RECORD", "handoff 必須提供 now.expected_hash 與 now.body。");
  if (input.now) {
    const nowFile = "knowledge/wiki/now.md";
    const previous = read(context.root, nowFile);
    if (!previous) throw new WikiError("NOT_FOUND", "缺少 now.md。");
    const page = parsePage(previous);
    checkExpected(context, input, [
      {
        path: "wiki/now.md",
        expected_hash: input.now.expected_hash,
        metadata: page.metadata,
        body: input.now.body,
      },
    ]);
    page.metadata.updated_at = timestamp();
    updates.set(nowFile, renderPage(page.metadata, input.now.body));
  }
  let handoffPath;
  if (type === "handoff") {
    handoffPath = `wiki/handoffs/${event.id}.md`;
    const metadata = defaultMetadata(`RLAB-HANDOFF-${event.id}`, input.summary, "handoff");
    metadata.related_tasks = [input.task_id];
    const section = (title, values) =>
      `## ${title}\n\n${values.map((item) => `- ${typeof item === "string" ? item : JSON.stringify(item)}`).join("\n") || "無"}\n`;
    const body = `# ${input.summary}\n\nAgent / Session：${input.agent} / ${input.session}\n\n任務：[${input.task_id}](../../tasks/${input.task_id}.json)\n\nGit：${details.git.branch ?? "null"} / ${details.git.head ?? "null（尚無 commit）"}\n\n${section("已完成", input.completed)}\n${section("修改範圍與 hash", scopes)}\n${section("執行命令與結果", input.commands)}\n${section("證據", input.evidence)}\n${section("風險與未完成", input.risks)}\n${section("下一步", input.next_steps)}\n原始事件：[${event.id}](../../events/${event.id}.json)\n`;
    updates.set(wikiPath(handoffPath), renderPage(metadata, body));
  }
  derive(context.root, updates, event);
  return { ...commit(context, updates, event), path: handoffPath ?? null, git: details.git };
}

function supersede(context, oldPath, flags) {
  const previous = trackedRead(context, wikiPath(oldPath));
  const replacement = trackedRead(context, wikiPath(flags.replacement));
  if (!previous || !replacement || oldPath === flags.replacement)
    throw new WikiError("SUPERSEDE", "需要兩份不同且存在的頁面。");
  const old = parsePage(previous);
  const next = parsePage(replacement);
  if (next.metadata.status === "DEPRECATED")
    throw new WikiError("SUPERSEDE_DEPRECATED", "替代頁已過時；請選擇目前有效的頁面。");
  if (
    old.metadata.superseded_by?.includes(next.metadata.id) &&
    next.metadata.supersedes.includes(old.metadata.id)
  )
    return { ok: true, unchanged: true };
  const input = { ...flags, summary: `${old.metadata.id} 由 ${next.metadata.id} 取代` };
  checkExpected(context, input, [{ path: oldPath, expected_hash: flags["expected-hash"] }]);
  old.metadata.status = "DEPRECATED";
  old.metadata.superseded_by = unique([...(old.metadata.superseded_by ?? []), next.metadata.id]);
  next.metadata.supersedes = unique([...next.metadata.supersedes, old.metadata.id]);
  old.metadata.updated_at = next.metadata.updated_at = timestamp();
  const updates = new Map([
    [wikiPath(oldPath), renderPage(old.metadata, old.body)],
    [wikiPath(flags.replacement), renderPage(next.metadata, next.body)],
  ]);
  if (supersedeCycles(pages(context.root, updates)).length)
    throw new WikiError("SUPERSEDE_CYCLE", "頁面取代關係不可形成循環。");
  const event = makeEvent("supersede", input, { old: oldPath, replacement: flags.replacement });
  derive(context.root, updates, event);
  return commit(context, updates, event);
}

function reconcile(context, id, input) {
  if (!/^[a-f0-9-]{36}$/.test(id ?? "")) throw new WikiError("CONFLICT_ID", "衝突 ID 格式不正確。");
  const file = `knowledge/conflicts/${id}.json`;
  const recordText = trackedRead(context, file);
  const record = recordText === null ? null : JSON.parse(recordText);
  if (!record) throw new WikiError("NOT_FOUND", "衝突紀錄不存在。");
  if (record.status === "RESOLVED") return { ok: true, unchanged: true };
  if (typeof input.resolution !== "string" || !input.resolution.trim())
    throw new WikiError("RESOLUTION", "必須記錄來源比較與解決理由。");
  const updates = stagePages(context, input, input.pages, { reviewedReplacement: true });
  const knownSources = new Set(manifest(context.root).sources.map((item) => item.id));
  for (const page of input.pages)
    for (const source of page.metadata.sources)
      if (!knownSources.has(source))
        throw new WikiError("SOURCE_REFERENCE", `未知來源 ID：${source}`);
  record.status = "RESOLVED";
  record.resolved_at = timestamp();
  record.resolution = {
    agent: input.agent,
    session: input.session,
    rationale: input.resolution,
    pages: input.pages,
  };
  updates.set(file, jsonText(record));
  const event = makeEvent(
    "reconcile",
    { ...input, summary: input.resolution },
    { conflict_id: id },
  );
  derive(context.root, updates, event);
  return commit(context, updates, event);
}

function recover(context, id, action) {
  if (!/^[a-f0-9-]{36}$/.test(id ?? "") || !["complete", "rollback"].includes(action))
    throw new WikiError("RECOVERY", "recover <交易 UUID> --action complete|rollback");
  const journal = `knowledge/transactions/${id}.json`;
  const transaction = readJson(context.root, journal, null);
  if (!transaction) throw new WikiError("NOT_FOUND", "交易紀錄不存在。");
  if (transaction.id !== id || !Array.isArray(transaction.files) || !transaction.files.length)
    throw new WikiError("RECOVERY_JOURNAL", "交易內容或 ID 不正確。");
  const targets = new Set();
  for (const file of transaction.files) {
    const canonical = typeof file.path === "string" ? file.path.replaceAll("\\", "/") : "";
    const identity = process.platform === "win32" ? canonical.toLowerCase() : canonical;
    if (
      !canonical.startsWith("knowledge/") ||
      /^knowledge\/(?:\.locks|transactions)\//i.test(canonical)
    )
      throw new WikiError(
        "RECOVERY_JOURNAL",
        "交易僅能修改 knowledge 資料，不能修改鎖或其他交易。",
      );
    safe(context.root, canonical);
    if (
      targets.has(identity) ||
      !(file.before === null || typeof file.before === "string") ||
      typeof file.after !== "string" ||
      (file.before === null ? null : hash(file.before)) !== file.before_hash ||
      hash(file.after) !== file.after_hash
    )
      throw new WikiError("RECOVERY_JOURNAL", `交易 preimage/proposal hash 不正確：${file.path}`);
    targets.add(identity);
    file.path = canonical;
    secretCheck(file.after);
    if (file.before !== null) secretCheck(file.before);
  }
  if (!["PREPARED", "APPLYING", "RECOVERY_REQUIRED"].includes(transaction.status))
    return { ok: true, unchanged: true, status: transaction.status };
  for (const file of transaction.files) {
    const current = read(context.root, file.path);
    const actual = current === null ? null : hash(current);
    if (![file.before_hash, file.after_hash].includes(actual))
      throw new WikiError("RECOVERY_EXTERNAL_CHANGE", `保留外部修改，請先人工比較：${file.path}`);
  }
  if (context.dryRun) return { ok: true, dry_run: true, transaction_id: id, action };
  for (const file of action === "rollback" ? [...transaction.files].reverse() : transaction.files) {
    const current = read(context.root, file.path);
    if (![file.before_hash, file.after_hash].includes(current === null ? null : hash(current)))
      throw new WikiError("RECOVERY_EXTERNAL_CHANGE", `復原期間偵測到外部修改：${file.path}`);
    const target = action === "rollback" ? file.before : file.after;
    if (target === null) {
      const existing = safe(context.root, file.path);
      if (fs.existsSync(existing)) fs.unlinkSync(existing);
    } else atomicWrite(context.root, file.path, target);
  }
  transaction.status = action === "rollback" ? "ROLLED_BACK" : "COMMITTED";
  transaction.recovered_at = timestamp();
  atomicWrite(context.root, journal, jsonText(transaction));
  return { ok: true, transaction_id: id, status: transaction.status };
}

function status(context) {
  const allTasks = tasks(context.root);
  return {
    ok: true,
    pages: pages(context.root).length,
    sources: manifest(context.root).sources.length,
    events: list(context.root, "knowledge/events", ".json").length,
    tasks: allTasks.map((task) => ({
      id: task.id,
      status: task.status,
      owner: task.owner,
      lease_expired: !!task.owner && Date.parse(task.owner.lease_until) < Date.now(),
    })),
    conflicts: list(context.root, "knowledge/conflicts", ".json")
      .map((file) => readJson(context.root, file))
      .filter((record) => record.status === "OPEN"),
    pending_transactions: pendingTransactions(context.root).map((item) => item.id),
    writer: readJson(context.root, "knowledge/.locks/writer/owner.json", null),
    automation: "MANUAL_COMMANDS_ONLY",
  };
}

function query(context, question, flags) {
  // Read the directory first. Retrieval remains local lexical matching and cannot
  // establish that prose is true or generate semantic answers from raw sources.
  const index = read(context.root, "knowledge/wiki/index.md");
  if (!index) throw new WikiError("INDEX", "請先建立知識索引。");
  const terms = unique(question.toLocaleLowerCase().split(/\s+/u).filter(Boolean));
  if (!terms.length) throw new WikiError("QUERY", "請提供搜尋文字。");
  const limit = Math.max(1, Math.min(10, Number(flags.limit) || 5));
  const sources = manifest(context.root).sources;
  const results = pages(context.root)
    .filter((page) => !["index", "log", "tasks"].includes(page.metadata.type))
    .map((page) => {
      const text = `${page.metadata.title}\n${page.body}`;
      const lowered = text.toLocaleLowerCase();
      const score = terms.reduce((sum, term) => sum + (lowered.includes(term) ? 1 : 0), 0);
      const first = Math.min(
        ...terms.map((term) => lowered.indexOf(term)).filter((position) => position >= 0),
      );
      const start = Math.max(0, Number.isFinite(first) ? first - 100 : 0);
      return {
        path: page.path,
        id: page.metadata.id,
        title: page.metadata.title,
        status: page.metadata.status,
        score,
        excerpt: text.slice(start, start + 800),
        citations: page.metadata.sources.map((id) => {
          const source = sources.find((item) => item.id === id);
          return source
            ? {
                id,
                path: source.path,
                url: source.url ?? null,
                version: source.version,
                sha256: source.sha256,
                snapshot_mode: source.snapshot_mode ?? "current",
                current_hash_match:
                  source.path === null
                    ? null
                    : (() => {
                        const file = safe(context.root, source.path);
                        return fs.existsSync(file) && hash(fs.readFileSync(file)) === source.sha256;
                      })(),
              }
            : { id, missing: true };
        }),
      };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.path.localeCompare(b.path))
    .slice(0, limit);
  return {
    ok: true,
    query: question,
    mode: "LEXICAL_RETRIEVAL",
    notice: "這是有來源的文字檢索；結論需由 Agent 比較權威來源後產生。",
    index_hash: hash(index),
    results,
  };
}

function lint(context) {
  const issues = [];
  const issue = (code, file, message, severity = "error") =>
    issues.push({ code, path: file, message, severity });
  const allPages = [];
  for (const file of list(context.root, "knowledge/wiki", ".md")) {
    try {
      allPages.push({
        path: file.slice("knowledge/".length),
        ...parsePage(read(context.root, file)),
      });
    } catch (error) {
      issue("METADATA", file, error.message);
    }
  }
  let sources;
  try {
    sources = manifest(context.root).sources;
  } catch (error) {
    issue("SOURCE_MANIFEST", "knowledge/sources/manifest.json", error.message);
    sources = [];
  }
  const sourceIds = new Set();
  const sourceVersions = new Map();
  for (const source of sources) {
    if (sourceIds.has(source.id))
      issue("DUPLICATE_SOURCE_ID", "knowledge/sources/manifest.json", source.id);
    sourceIds.add(source.id);
    const sourceKey = JSON.stringify([
      source.path === null ? source.url : pathIdentity(source.path),
      source.sha256,
      source.version,
    ]);
    if (sourceVersions.has(sourceKey))
      issue(
        "DUPLICATE_SOURCE_VERSION",
        "knowledge/sources/manifest.json",
        `${source.id} 與 ${sourceVersions.get(sourceKey)} 為相同來源版本。`,
      );
    sourceVersions.set(sourceKey, source.id);
    if (source.path !== null) {
      try {
        const file = safe(context.root, source.path);
        if (!fs.existsSync(file)) issue("SOURCE_MISSING", source.path, source.id);
        else if (hash(fs.readFileSync(file)) !== source.sha256)
          issue(
            "SOURCE_HASH_STALE",
            source.path,
            `${source.id} pinned hash 與目前檔案不同。`,
            source.snapshot_mode === "historical" ? "warning" : "error",
          );
      } catch (error) {
        issue("SOURCE_PATH", source.path, error.message);
      }
    }
    for (const file of source.wiki_pages)
      if (!allPages.some((page) => page.path === file))
        issue("SOURCE_PAGE", file, `${source.id} 參考缺少的頁面。`);
    const expectedLinks = allPages
      .filter((page) => page.metadata.sources.includes(source.id))
      .map((page) => page.path)
      .sort();
    if (JSON.stringify([...source.wiki_pages].sort()) !== JSON.stringify(expectedLinks))
      issue(
        "SOURCE_BACKREFERENCE",
        "knowledge/sources/manifest.json",
        `${source.id} 的 wiki_pages 與頁面來源引用不一致；請執行 rebuild。`,
      );
    for (const id of source.supersedes ?? [])
      if (!sources.some((entry) => entry.id === id))
        issue("SOURCE_SUPERSEDES", source.path, `來源版本 ${id} 不存在。`);
  }
  for (const error of sourceGraphErrors(sources))
    issue("SOURCE_CYCLE_OR_REFERENCE", "knowledge/sources/manifest.json", error);
  const taskRows = [];
  for (const file of list(context.root, "knowledge/tasks", ".json")) {
    try {
      const task = readJson(context.root, file);
      validate("task", task);
      if (path.basename(file, ".json") !== task.id)
        issue("TASK_FILENAME", file, "檔名必須與 task ID 一致。");
      taskRows.push(task);
      for (const error of taskErrors(context.root, task)) issue("TASK_EVIDENCE", file, error);
      if (task.owner && Date.parse(task.owner.lease_until) < Date.now())
        issue(
          "LEASE_EXPIRED",
          file,
          "持有者 lease 已過期；需顯式 release，不會自動轉移。",
          "warning",
        );
      if (task.status === "BLOCKED" && Date.now() - Date.parse(task.updated_at) > 30 * 86400000)
        issue("OLD_BLOCKER", file, "BLOCKED 已超過 30 天未更新。", "warning");
      if (["DONE", "CANCELLED"].includes(task.status) && task.owner)
        issue("FINISHED_CLAIM_OPEN", file, "任務已關閉但 claim 尚未 release。", "warning");
    } catch (error) {
      issue("TASK_SCHEMA", file, error.message);
    }
  }
  for (const task of taskRows)
    for (const id of task.dependencies)
      if (!taskRows.some((item) => item.id === id))
        issue("TASK_DEPENDENCY", `knowledge/tasks/${task.id}.json`, id);
  const ids = new Map();
  const contentHashes = new Map();
  const graph = new Map();
  const dependencyPins = readJson(context.root, "package-lock.json", null)?.packages ?? {};
  for (const page of allPages) {
    const file = `knowledge/${page.path}`;
    if (ids.has(page.metadata.id))
      issue("DUPLICATE_ID", file, `${page.metadata.id} 也用於 ${ids.get(page.metadata.id)}`);
    ids.set(page.metadata.id, page.path);
    const normalized = page.body
      .replace(/<!-- wiki:generated:start -->[\s\S]*?<!-- wiki:generated:end -->/g, "")
      .trim();
    if (normalized.length > 80 && !["index", "log", "tasks"].includes(page.metadata.type)) {
      const key = hash(normalized);
      if (contentHashes.has(key))
        issue("DUPLICATE_CONTENT", file, `內容與 ${contentHashes.get(key)} 相同。`, "warning");
      contentHashes.set(key, file);
    }
    for (const id of page.metadata.sources)
      if (!sourceIds.has(id)) issue("SOURCE_REFERENCE", file, `未知來源 ${id}`);
    for (const id of page.metadata.related_tasks)
      if (!taskRows.some((task) => task.id === id)) issue("TASK_REFERENCE", file, `未知任務 ${id}`);
    for (const id of page.metadata.related_decisions) {
      if (
        !allPages.some((entry) => entry.metadata.id === id) &&
        !list(context.root, "docs/02-architecture", ".md").some((entry) => {
          const number = /^ADR-(\d+)$/.exec(id)?.[1];
          return (
            path.basename(entry).startsWith(`${id}-`) ||
            (number &&
              path.basename(entry).startsWith(`${number}-`) &&
              new RegExp(`^#\\s+${id}\\b`, "m").test(read(context.root, entry)))
          );
        })
      )
        issue("DECISION_REFERENCE", file, `未知 decision ${id}`);
    }
    if (
      page.metadata.status === "VERIFIED" &&
      !page.metadata.sources.length &&
      !page.metadata.evidence?.length
    )
      issue("VERIFIED_WITHOUT_SOURCE", file, "VERIFIED 頁面沒有來源或證據。");
    for (const error of evidenceErrors(context.root, page.metadata.evidence ?? []))
      issue("PAGE_EVIDENCE", file, error);
    if (page.metadata.status === "DEPRECATED" && !page.metadata.superseded_by?.length)
      issue("DEPRECATED_REPLACEMENT", file, "過時頁面未記錄替代關係。", "warning");
    for (const assertion of page.metadata.assertions ?? []) {
      for (const error of evidenceErrors(context.root, assertion.evidence))
        issue("ASSERTION_EVIDENCE", file, error);
      if (
        assertion.status === "VERIFIED" &&
        !assertion.evidence.length &&
        !page.metadata.sources.length
      )
        issue("ASSERTION_UNSUPPORTED", file, `主張 ${assertion.key} 沒有證據。`);
    }
    for (const dependency of page.metadata.dependencies ?? []) {
      const actual = dependencyPins[`node_modules/${dependency.name}`]?.version;
      if (!actual || actual !== dependency.version)
        issue(
          "DEPENDENCY_STALE",
          file,
          `${dependency.name}：頁面 ${dependency.version}，lockfile ${actual ?? "缺少"}`,
        );
    }
    if (/citation needed|\[SOURCE\??\]|TODO[^\n]*(?:citation|引用)/i.test(page.body))
      issue("CITATION_PENDING", file, "包含待補引用。", "warning");
    const edges = [];
    for (const match of page.body.matchAll(/\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
      const href = match[1].replace(/^<|>$/g, "");
      if (/^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith("#")) continue;
      try {
        const pathname = decodeURIComponent(href.split("#")[0]);
        if (!pathname) continue;
        const target = slash(
          path.relative(context.root, path.resolve(context.root, path.dirname(file), pathname)),
        );
        const resolved = safe(context.root, target);
        if (!fs.existsSync(resolved)) issue("BROKEN_LINK", file, href);
        if (target.startsWith("knowledge/wiki/") && target.endsWith(".md"))
          edges.push(target.slice("knowledge/".length));
      } catch (error) {
        issue("LINK_PATH", file, `${href}: ${error.message}`);
      }
    }
    graph.set(page.path, edges);
  }
  for (const page of allPages) {
    for (const id of [...page.metadata.supersedes, ...(page.metadata.superseded_by ?? [])])
      if (!ids.has(id)) issue("SUPERSEDE_REFERENCE", `knowledge/${page.path}`, id);
    for (const id of page.metadata.supersedes) {
      const old = allPages.find((entry) => entry.metadata.id === id);
      if (
        old &&
        (old.metadata.status !== "DEPRECATED" ||
          !old.metadata.superseded_by?.includes(page.metadata.id))
      )
        issue("SUPERSEDE_INCOMPLETE", `knowledge/${page.path}`, `舊頁 ${id} 未保留雙向取代關係。`);
    }
  }
  for (const id of supersedeCycles(allPages)) issue("SUPERSEDE_CYCLE", "knowledge/wiki", id);
  const reachable = new Set();
  const visit = (file) => {
    if (reachable.has(file)) return;
    reachable.add(file);
    for (const edge of graph.get(file) ?? []) visit(edge);
  };
  visit("wiki/index.md");
  for (const page of allPages)
    if (!reachable.has(page.path))
      issue("ORPHAN", `knowledge/${page.path}`, "無法由 index.md 追溯。");
  for (const item of assertionConflicts(allPages))
    issue("ASSERTION_CONFLICT", "knowledge/wiki", JSON.stringify(item));
  for (const file of list(context.root, "knowledge/conflicts", ".json"))
    if (readJson(context.root, file).status === "OPEN")
      issue("OPEN_CONFLICT", file, "需要來源比較與顯式 reconcile。");
  for (const file of list(context.root, "knowledge/events", ".json")) {
    try {
      const event = readJson(context.root, file);
      validate("event", event);
      if (path.basename(file, ".json") !== event.id)
        issue("EVENT_FILENAME", file, "事件檔名不符合 UUID。");
    } catch (error) {
      issue("EVENT_SCHEMA", file, error.message);
    }
  }
  for (const item of pendingTransactions(context.root))
    issue("RECOVERY_REQUIRED", `knowledge/transactions/${item.id}.json`, item.status);
  return {
    ok: !issues.some((item) => item.severity === "error"),
    issues,
    summary: {
      pages: allPages.length,
      sources: sources.length,
      tasks: taskRows.length,
      errors: issues.filter((item) => item.severity === "error").length,
      warnings: issues.filter((item) => item.severity === "warning").length,
    },
    limitations: [
      "只比較明確 assertion key/value；不自動判斷任意自然語言矛盾。",
      "檢查引用、artifact hash 與本地版本，不驗證論文真實性、實際命令執行或遠端最新版本。",
      "Markdown 連結檢查檔案路徑，不保證所有平台的 heading anchor 語法。",
    ],
  };
}

function parseArgs(argv) {
  const flags = {};
  const positional = [];
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (!arg.startsWith("--")) positional.push(arg);
    else {
      const name = arg.slice(2);
      if (Object.hasOwn(flags, name)) throw new WikiError("ARGUMENT", `重複參數 --${name}`);
      if (["dry-run", "help"].includes(name)) flags[name] = true;
      else {
        if (!argv[index + 1] || argv[index + 1].startsWith("--"))
          throw new WikiError("ARGUMENT", `--${name} 缺少值。`);
        flags[name] = argv[++index];
      }
    }
  }
  return { flags, positional };
}

function snapshotRead(context, callback) {
  const writer = safe(context.root, "knowledge/.locks/writer");
  const stamp = () =>
    list(context.root, "knowledge/transactions", ".json")
      .map((file) => {
        const stat = fs.statSync(safe(context.root, file), { bigint: true });
        return `${file}:${stat.mtimeNs}:${stat.size}`;
      })
      .join("\n");
  if (fs.existsSync(writer))
    throw new WikiError("READ_BUSY", "Writer 正在更新；請稍後重讀同一查詢。");
  const before = stamp();
  const result = callback();
  if (fs.existsSync(writer) || stamp() !== before)
    throw new WikiError("READ_CHANGED", "讀取期間知識已變更；請重新執行。這次結果未返回。");
  return result;
}

async function unlock(context, flags) {
  if (context.dryRun) return unlockOwned(context, flags);
  const directory = safe(context.root, "knowledge/.locks/recovery");
  fs.mkdirSync(path.dirname(directory), { recursive: true });
  try {
    fs.mkdirSync(directory);
  } catch (error) {
    if (error.code === "EEXIST")
      throw new WikiError(
        "UNLOCK_BUSY",
        "另一個明確復原操作正在檢查鎖；不會自動竊取 recovery guard。",
      );
    throw error;
  }
  const token = randomUUID();
  try {
    atomicWrite(
      context.root,
      "knowledge/.locks/recovery/owner.json",
      jsonText({ token, pid: process.pid, host: os.hostname(), created_at: timestamp() }),
      true,
    );
    return await unlockOwned(context, flags);
  } finally {
    if (readJson(context.root, "knowledge/.locks/recovery/owner.json", null)?.token === token) {
      fs.unlinkSync(safe(context.root, "knowledge/.locks/recovery/owner.json"));
      fs.rmdirSync(directory);
    }
  }
}

async function unlockOwned(context, flags) {
  if (!flags.agent || !flags.session || !flags.reason || !flags.token)
    throw new WikiError("UNLOCK", "unlock 需要 --agent、--session、--token 與 --reason。");
  const file = "knowledge/.locks/writer/owner.json";
  const previous = read(context.root, file);
  if (!previous)
    throw new WikiError("UNLOCK", "找不到可驗證的 owner；請先人工檢查未初始化的 lock 目錄。");
  const owner = JSON.parse(previous);
  if (owner.token !== flags.token)
    throw new WikiError("UNLOCK_TOKEN", "鎖 token 不符合，拒絕移除。");
  if (owner.host !== os.hostname() || !Number.isInteger(owner.pid) || owner.pid <= 0)
    throw new WikiError("UNLOCK_HOST", "無法驗證這個 host 的持有程序；拒絕自動移除。");
  let alive = true;
  try {
    process.kill(owner.pid, 0);
  } catch (error) {
    if (error.code === "ESRCH") alive = false;
    else throw new WikiError("UNLOCK_PROCESS", `無法確認程序已結束：${error.message}`);
  }
  if (alive) throw new WikiError("UNLOCK_LIVE", "持有鎖的程序仍存活；不會移除 active writer。");
  if (context.dryRun) return { ok: true, dry_run: true, owner, reason: flags.reason };
  if (read(context.root, file) !== previous)
    throw new WikiError("UNLOCK_CHANGED", "檢查期間鎖已改變；請重新檢查。");
  fs.unlinkSync(safe(context.root, file));
  fs.rmdirSync(safe(context.root, "knowledge/.locks/writer"));
  return withLock(
    context,
    () => {
      const event = makeEvent(
        "unlock",
        { ...flags, summary: flags.reason },
        { previous_owner: owner, reason: flags.reason },
      );
      const updates = new Map();
      // Preserve pending transaction files exactly. A separate recover must complete
      // them before any derived page can be safely rebuilt.
      if (!pendingTransactions(context.root).length) derive(context.root, updates, event);
      return { ...commit(context, updates, event), released_owner: owner };
    },
    { recovery: true },
  );
}

export async function run(argv, cwd = process.cwd()) {
  const { flags, positional } = parseArgs(argv);
  if (flags.format && !["json", "markdown"].includes(flags.format))
    throw new WikiError("FORMAT", "--format 必須為 json 或 markdown。");
  const command = positional.shift();
  const root = fs.realpathSync(path.resolve(cwd, flags.root ?? "."));
  const context = { root, dryRun: !!flags["dry-run"], expectedHashes: new Map() };
  if (!command || command === "help" || flags.help)
    return {
      ok: true,
      commands: [
        "ingest <repo-source> --plan <json>",
        "query <words>",
        "lint",
        "status",
        "checkpoint --file <json>",
        "handoff --file <json>",
        "task claim|update|heartbeat|release <ID> --agent <ID> --session <ID> [--token <token>]",
        "supersede <wiki/old.md> --replacement <wiki/new.md> --expected-hash <sha256> --agent <ID> --session <ID>",
        "reconcile <conflict UUID> --file <json>",
        "recover <transaction UUID> --action complete|rollback",
        "unlock --token <writer token> --reason <text> --agent <ID> --session <ID>",
        "rebuild --agent <ID> --session <ID>",
      ],
      flags: ["--root <repo>", "--format json|markdown", "--dry-run"],
    };
  if (command === "status") return status(context);
  if (command === "unlock") return unlock(context, flags);
  if (command === "lint") return snapshotRead(context, () => lint(context));
  if (command === "query")
    return snapshotRead(context, () => {
      const pending = pendingTransactions(root);
      if (pending.length)
        throw new WikiError("RECOVERY_REQUIRED", "查詢前先復原未完成交易。", {
          transactions: pending.map((item) => item.id),
        });
      return query(context, positional.join(" "), flags);
    });
  return withLock(
    context,
    () => {
      if (command === "ingest") return ingest(context, positional[0], readInput(root, flags.plan));
      if (command === "task") return taskOperation(context, positional[0], positional[1], flags);
      if (["checkpoint", "handoff"].includes(command))
        return recordOperation(context, command, readInput(root, flags.file));
      if (command === "supersede") return supersede(context, positional[0], flags);
      if (command === "reconcile")
        return reconcile(context, positional[0], readInput(root, flags.file));
      if (command === "recover") return recover(context, positional[0], flags.action);
      if (command === "rebuild") {
        const updates = new Map();
        derive(root, updates);
        return commit(context, updates);
      }
      throw new WikiError("COMMAND", `未知命令：${command}`);
    },
    { recovery: command === "recover" },
  );
}

export function markdown(result) {
  if (result.results)
    return `查詢：${result.query}\n\n${result.notice}\n\n${result.results.map((item) => `- [${item.title}](${item.path}) (${item.status})\n\n  ${item.excerpt.replaceAll("\n", " ")}\n\n  來源：${item.citations.map((cite) => `[${cite.id}](${cite.path ?? cite.url ?? "#"})`).join("、")}`).join("\n\n")}\n`;
  if (result.issues)
    return `Wiki Lint：${result.ok ? "PASS" : "FAIL"}\n\n${result.issues.map((item) => `- ${item.severity} ${item.code} [${item.path}](${item.path})：${item.message}`).join("\n") || "沒有發現可自動檢查的問題。"}\n`;
  return `\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\`\n`;
}
