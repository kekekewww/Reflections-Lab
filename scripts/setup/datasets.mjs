import { createHash, randomUUID } from "node:crypto";
import { open, lstat, mkdir, rename, rmdir, unlink } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const CACHE_ROOT = path.join(REPO_ROOT, ".cache", "datasets");
export const MAX_DOWNLOAD_BYTES = 50_000_000;
const TIMEOUT_MS = 30_000;
const MAX_REDIRECTS = 3;
// Exact official hosts only. A newly required mirror needs a reviewed code change.
const DOWNLOAD_HOSTS = new Set([
  "www.york.ac.uk",
  "zenodo.org",
  "depositonce.tu-berlin.de",
  "www.openslr.org",
  "github.com",
  "codeload.github.com",
  "raw.githubusercontent.com",
]);
const FIELDS = [
  "dataset_id",
  "record_doi",
  "version",
  "source_url",
  "download_url",
  "license_id",
  "license_status",
  "license_url",
  "license_evidence_url",
  "license_scope",
  "accessed_at",
  "file_name",
  "size_bytes",
  "sha256",
  "subset_ids",
  "modifications",
  "attribution",
  "test_ids",
  "max_download_bytes",
  "dry_run",
  "acquisition_status",
];

export class DatasetError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "DatasetError";
    this.code = code;
  }
}

function reject(code, message) {
  throw new DatasetError(code, message);
}

function isText(value) {
  return (
    typeof value === "string" && value.trim().length > 0 && !/[\u0000-\u001f\u007f]/u.test(value)
  );
}

function checkedUrl(value, download = false) {
  let url;
  try {
    url = new URL(value);
  } catch {
    reject("INVALID_URL", "URL 必須是完整 HTTPS 位址。");
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.hash ||
    url.search ||
    (url.port && url.port !== "443")
  ) {
    reject("INVALID_URL", "只接受無帳密、query、fragment 或非標準 port 的 HTTPS URL。");
  }
  if (download && !DOWNLOAD_HOSTS.has(url.hostname)) {
    reject("HOST_NOT_ALLOWED", "下載或重新導向的 host 不在固定 allowlist。");
  }
  return url;
}

function checkedFileName(value) {
  if (
    !isText(value) ||
    !/^[A-Za-z0-9][A-Za-z0-9._-]{0,179}$/u.test(value) ||
    value === "." ||
    value === ".." ||
    /[. ]$/u.test(value) ||
    /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/iu.test(value)
  ) {
    reject("INVALID_PATH", "file_name 必須是可攜單一檔名，不接受路徑或 Windows 保留名稱。");
  }
}

/** Validate one pinned file; null metadata blocks acquisition without fabricating values. */
export function validateManifest(manifest) {
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    reject("INVALID_MANIFEST", "manifest 必須是單一 JSON object。");
  }
  if (
    FIELDS.some((key) => !Object.hasOwn(manifest, key)) ||
    Object.keys(manifest).some((key) => !FIELDS.includes(key))
  ) {
    reject("INVALID_MANIFEST", "manifest 欄位不完整或含未知欄位；請對照 example。");
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/u.test(manifest.dataset_id ?? "")) {
    reject("INVALID_PATH", "dataset_id 必須是 1–80 字元的英文數字、底線或連字號 ID。");
  }
  // Reject reserved Windows directory names too, including CON and NUL.
  checkedFileName(manifest.dataset_id);
  if (manifest.file_name !== null) checkedFileName(manifest.file_name);
  const nullableTextFields = [
    "record_doi",
    "version",
    "source_url",
    "download_url",
    "license_id",
    "license_url",
    "license_evidence_url",
    "license_scope",
    "accessed_at",
    "file_name",
    "sha256",
    "attribution",
  ];
  for (const key of nullableTextFields) {
    if (manifest[key] !== null && !isText(manifest[key])) {
      reject("INVALID_MANIFEST", "metadata 必須是非空文字或 null。");
    }
  }
  for (const key of ["subset_ids", "modifications", "test_ids"]) {
    if (!Array.isArray(manifest[key]) || !manifest[key].every(isText)) {
      reject("INVALID_MANIFEST", "subset_ids、modifications、test_ids 必須是文字陣列。");
    }
  }
  if (!["UNKNOWN", "REFUSED", "VERIFIED_PAGE_ONLY", "VERIFIED"].includes(manifest.license_status)) {
    reject("INVALID_MANIFEST", "license_status 不在支援的狀態集合。");
  }
  if (manifest.dry_run !== true || manifest.acquisition_status !== "NOT_RUN") {
    reject("INVALID_MANIFEST", "輸入 manifest 必須保持 dry_run=true、acquisition_status=NOT_RUN。");
  }
  if (
    !Number.isSafeInteger(manifest.max_download_bytes) ||
    manifest.max_download_bytes < 1 ||
    manifest.max_download_bytes > MAX_DOWNLOAD_BYTES
  ) {
    reject("INVALID_SIZE", "max_download_bytes 必須介於 1 與 50000000 bytes。");
  }
  if (
    manifest.size_bytes !== null &&
    (!Number.isSafeInteger(manifest.size_bytes) ||
      manifest.size_bytes < 1 ||
      manifest.size_bytes > manifest.max_download_bytes)
  ) {
    reject("INVALID_SIZE", "size_bytes 必須是小於等於下載上限的正整數。");
  }
  if (manifest.sha256 !== null && !/^[a-f0-9]{64}$/u.test(manifest.sha256)) {
    reject("INVALID_HASH", "sha256 必須是 64 字元的小寫十六進位值。");
  }
  if (manifest.file_name !== null) checkedFileName(manifest.file_name);
  if (
    manifest.accessed_at !== null &&
    (!/^\d{4}-\d{2}-\d{2}$/u.test(manifest.accessed_at) ||
      !Number.isFinite(Date.parse(manifest.accessed_at)) ||
      new Date(manifest.accessed_at).toISOString().slice(0, 10) !== manifest.accessed_at)
  ) {
    reject("INVALID_MANIFEST", "accessed_at 必須是有效的 YYYY-MM-DD 日期。");
  }
  for (const key of ["source_url", "license_url", "license_evidence_url", "download_url"]) {
    if (manifest[key] !== null) checkedUrl(manifest[key], key === "download_url");
  }
  const blockers = [];
  if (manifest.license_status !== "VERIFIED") blockers.push("LICENSE_NOT_VERIFIED");
  for (const key of [
    "version",
    "source_url",
    "download_url",
    "license_id",
    "license_url",
    "license_evidence_url",
    "license_scope",
    "accessed_at",
    "file_name",
    "size_bytes",
    "sha256",
    "attribution",
  ]) {
    if (manifest[key] === null) blockers.push(`MISSING_${key.toUpperCase()}`);
  }
  if (manifest.subset_ids.length === 0) blockers.push("MISSING_SUBSET_IDS");
  if (manifest.test_ids.length === 0) blockers.push("MISSING_TEST_IDS");
  return { blockers };
}

async function statOrNull(filePath) {
  try {
    return await lstat(filePath);
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

function assertInsideCache(filePath) {
  const relative = path.relative(CACHE_ROOT, filePath);
  if (
    !relative ||
    relative.startsWith(`..${path.sep}`) ||
    relative === ".." ||
    path.isAbsolute(relative)
  ) {
    reject("INVALID_PATH", "輸出必須位於專案 .cache/datasets 內。");
  }
}

// Check every component we own; do not traverse preexisting symlinks/junctions.
async function checkedDirectories(directory, create) {
  const relative = path.relative(REPO_ROOT, directory);
  const components = [REPO_ROOT];
  let current = REPO_ROOT;
  for (const part of relative.split(path.sep)) {
    current = path.join(current, part);
    components.push(current);
  }
  for (const component of components) {
    let stat = await statOrNull(component);
    if (!stat && create) {
      try {
        await mkdir(component);
      } catch (error) {
        if (error.code !== "EEXIST") throw error;
      }
      stat = await lstat(component);
    }
    if (stat && (stat.isSymbolicLink() || !stat.isDirectory())) {
      reject("UNSAFE_CACHE", "cache 路徑不可包含 symlink、junction 或非目錄項目。");
    }
  }
}

async function checkCached(target, manifest) {
  const stat = await statOrNull(target);
  if (!stat) return false;
  if (stat.isSymbolicLink() || !stat.isFile()) reject("UNSAFE_CACHE", "cache 目標必須是一般檔案。");
  if (stat.size !== manifest.size_bytes)
    reject("CACHE_MISMATCH", "既有 cache 大小不符；保留檔案供查核。");
  const handle = await open(target, "r");
  const hash = createHash("sha256");
  let bytes = 0;
  try {
    for await (const chunk of handle.createReadStream({ autoClose: false })) {
      bytes += chunk.length;
      if (bytes > manifest.size_bytes)
        reject("CACHE_MISMATCH", "既有 cache 大小不符；保留檔案供查核。");
      hash.update(chunk);
    }
  } finally {
    await handle.close();
  }
  if (bytes !== manifest.size_bytes || hash.digest("hex") !== manifest.sha256) {
    reject("CACHE_MISMATCH", "既有 cache SHA-256 不符；保留檔案供查核。");
  }
  return true;
}

async function cancelBody(response) {
  try {
    await response.body?.cancel();
  } catch {
    // Keep the original validation/network error.
  }
}

async function downloadResponse(url, fetchImpl, signal) {
  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    checkedUrl(url.href, true);
    const response = await fetchImpl(url.href, {
      redirect: "manual",
      credentials: "omit",
      referrerPolicy: "no-referrer",
      signal,
      headers: { "Accept-Encoding": "identity" },
    });
    // Native fetch should never follow with manual mode. Check an injected response too.
    if (response.redirected || (response.url && response.url !== url.href)) {
      await cancelBody(response);
      reject("UNEXPECTED_REDIRECT", "fetch 未遵守手動重新導向契約。");
    }
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      await cancelBody(response);
      if (!location || redirects === MAX_REDIRECTS)
        reject("REDIRECT_LIMIT", "重新導向缺少 Location 或超過 3 次。");
      try {
        url = checkedUrl(new URL(location, url).href, true);
      } catch (error) {
        if (error instanceof DatasetError) throw error;
        reject("INVALID_URL", "重新導向 Location 無效。");
      }
      continue;
    }
    if (response.status !== 200 || !response.body) {
      await cancelBody(response);
      reject("HTTP_STATUS", "伺服器未回傳有內容的 HTTP 200；不重試或接受條款。");
    }
    if (
      response.headers.get("content-encoding") &&
      response.headers.get("content-encoding") !== "identity"
    ) {
      await cancelBody(response);
      reject("ENCODING_NOT_SUPPORTED", "只接受 identity 傳輸，避免解壓縮與 byte 長度歧義。");
    }
    return response;
  }
  reject("REDIRECT_LIMIT", "超過重新導向上限。");
}

export async function acquireDataset(
  manifest,
  { fetchEnabled = false, fetchImpl = globalThis.fetch } = {},
) {
  const { blockers } = validateManifest(manifest);
  const mode = fetchEnabled ? "fetch" : "dry-run";
  if (blockers.length)
    return { status: "BLOCKED", mode, dataset_id: manifest.dataset_id, blockers };
  const target = path.join(CACHE_ROOT, manifest.dataset_id, manifest.sha256, manifest.file_name);
  assertInsideCache(target);
  await checkedDirectories(path.dirname(target), false);
  if (!fetchEnabled)
    return { status: "READY", mode, dataset_id: manifest.dataset_id, network: "NOT_RUN" };
  if (await checkCached(target, manifest)) {
    return {
      status: "CACHED",
      mode,
      dataset_id: manifest.dataset_id,
      size_bytes: manifest.size_bytes,
      sha256: manifest.sha256,
    };
  }
  const response = await downloadResponse(
    checkedUrl(manifest.download_url, true),
    fetchImpl,
    AbortSignal.timeout(TIMEOUT_MS),
  );
  const contentLength = response.headers.get("content-length");
  if (
    contentLength !== null &&
    (!/^\d+$/u.test(contentLength) || Number(contentLength) !== manifest.size_bytes)
  ) {
    await cancelBody(response);
    reject("SIZE_MISMATCH", "Content-Length 與固定 size_bytes 不符。");
  }
  let temp;
  let stagingDirectory;
  let handle;
  const reader = response.body.getReader();
  try {
    const finalDirectory = path.dirname(target);
    await checkedDirectories(path.dirname(finalDirectory), true);
    stagingDirectory = path.join(path.dirname(finalDirectory), `.${randomUUID()}.part`);
    assertInsideCache(stagingDirectory);
    await mkdir(stagingDirectory);
    temp = path.join(stagingDirectory, manifest.file_name);
    assertInsideCache(temp);
    handle = await open(temp, "wx");
    const hash = createHash("sha256");
    let bytes = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > manifest.max_download_bytes || bytes > manifest.size_bytes) {
        reject("SIZE_LIMIT", "串流超出固定檔案大小或下載容量上限。");
      }
      hash.update(value);
      await handle.writeFile(value);
    }
    if (bytes !== manifest.size_bytes)
      reject("SIZE_MISMATCH", "串流結束時大小與固定 size_bytes 不符。");
    if (hash.digest("hex") !== manifest.sha256)
      reject("HASH_MISMATCH", "下載 SHA-256 不符；不發布 cache。");
    await handle.sync();
    await handle.close();
    handle = undefined;
    await checkedDirectories(path.dirname(target), false);
    if (await statOrNull(finalDirectory)) {
      reject("CACHE_EXISTS", "cache 目錄已由其他程序建立；不覆寫，請重新查核或重跑。");
    }
    // Publish an entire directory atomically. A racing nonempty directory cannot be replaced.
    await rename(stagingDirectory, finalDirectory);
    temp = undefined;
    stagingDirectory = undefined;
    return {
      status: "ACQUIRED",
      mode,
      dataset_id: manifest.dataset_id,
      size_bytes: bytes,
      sha256: manifest.sha256,
      file: path.relative(REPO_ROOT, target).split(path.sep).join("/"),
    };
  } finally {
    try {
      await reader.cancel();
    } catch {
      /* Preserve original error. */
    }
    reader.releaseLock();
    if (handle) await handle.close();
    if (temp)
      await unlink(temp).catch((error) => {
        if (error.code !== "ENOENT") throw error;
      });
    if (stagingDirectory)
      await rmdir(stagingDirectory).catch((error) => {
        if (error.code !== "ENOENT") throw error;
      });
  }
}

export function parseArgs(args) {
  const result = {
    fetchEnabled: false,
    manifestPath: path.join(REPO_ROOT, "research/datasets/acquisition-manifest.example.json"),
  };
  let specifiedManifest = false;
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === "--fetch" && !result.fetchEnabled) result.fetchEnabled = true;
    else if (
      args[index] === "--manifest" &&
      !specifiedManifest &&
      args[index + 1] &&
      !args[index + 1].startsWith("--")
    ) {
      result.manifestPath = path.resolve(args[++index]);
      specifiedManifest = true;
    } else
      reject(
        "INVALID_ARGUMENT",
        "用法：node scripts/setup/datasets.mjs [--manifest <file.json>] [--fetch]",
      );
  }
  return result;
}

async function main() {
  try {
    const options = parseArgs(process.argv.slice(2));
    const handle = await open(options.manifestPath, "r");
    let manifest;
    try {
      if ((await handle.stat()).size > 64_000)
        reject("INVALID_MANIFEST", "manifest 不可超過 64000 bytes。");
      manifest = JSON.parse(await handle.readFile("utf8"));
    } finally {
      await handle.close();
    }
    const result = await acquireDataset(manifest, options);
    console.log(JSON.stringify(result, null, 2));
    if (result.status === "BLOCKED") process.exitCode = 2;
  } catch (error) {
    // Do not print arbitrary network/JSON errors: they can echo supplied URL credentials.
    console.error(
      JSON.stringify(
        {
          status: "ERROR",
          code: error instanceof DatasetError ? error.code : "IO_OR_NETWORK_ERROR",
          message:
            error instanceof DatasetError
              ? error.message
              : "I/O、JSON 或網路失敗；未接受條款，請檢查本地來源與網路。",
        },
        null,
        2,
      ),
    );
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  await main();
