import { lstat, open } from "node:fs/promises";

const names = ["MODEL_API_KEY", "META_API_KEY", "META_MODEL_API_KEY"] as const;
const maxBytes = 16 * 1024;
const keyPattern = /^LLM_[0-9]{1,32}_[A-Za-z0-9._~+/-]+={0,2}$/;
export class MetaKeyError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "MetaKeyError";
  }
}
function validKey(value: string, code: string): string {
  if (value.length > 4096 || !keyPattern.test(value))
    throw new MetaKeyError(code, "Meta憑證格式無效；未載入或顯示任何憑證內容。");
  return value;
}
/** Parse data only: exactly one supported quoted assignment, with optional full-line comments. */
export function parseMetaKeyFile(input: string): string {
  if (Buffer.byteLength(input, "utf8") > maxBytes)
    throw new MetaKeyError("KEY_FILE_TOO_LARGE", "憑證檔超出允許大小；未載入內容。");
  const lines = input
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
  const match =
    lines.length === 1
      ? /^(MODEL_API_KEY|META_API_KEY|META_MODEL_API_KEY)\s*=\s*(?:"([^"\\\r\n]+)"|'([^'\\\r\n]+)')$/.exec(
          lines[0]!,
        )
      : null;
  if (!match)
    throw new MetaKeyError(
      "KEY_FILE_FORMAT_INVALID",
      "憑證檔必須只有一個允許名稱的quoted assignment；未執行或顯示內容。",
    );
  return validKey(match[2] ?? match[3]!, "KEY_FILE_FORMAT_INVALID");
}

export interface LoadedMetaKey {
  apiKey: string | null;
  source: (typeof names)[number] | "file" | "missing";
}
/** Server-only. Explicit --key-file wins; otherwise existing env aliases precede META_API_KEY_FILE. */
export async function loadMetaApiKey(
  options: { env?: NodeJS.ProcessEnv; keyFile?: string } = {},
): Promise<LoadedMetaKey> {
  const env = options.env ?? process.env;
  const explicitFile = options.keyFile?.trim();
  if (!explicitFile) {
    for (const name of names) {
      const value = env[name];
      if (value !== undefined && value.trim())
        return { apiKey: validKey(value, "KEY_ENV_FORMAT_INVALID"), source: name };
    }
  }
  const file = explicitFile || env.META_API_KEY_FILE?.trim();
  if (!file) return { apiKey: null, source: "missing" };
  let input: string;
  try {
    const info = await lstat(file);
    if (!info.isFile())
      throw new MetaKeyError("KEY_FILE_UNAVAILABLE", "憑證來源不是一般檔案；未載入內容。");
    if (info.size > maxBytes)
      throw new MetaKeyError("KEY_FILE_TOO_LARGE", "憑證檔超出允許大小；未載入內容。");
    const handle = await open(file, "r");
    try {
      const opened = await handle.stat();
      if (!opened.isFile() || opened.dev !== info.dev || opened.ino !== info.ino)
        throw new MetaKeyError("KEY_FILE_UNAVAILABLE", "憑證來源在讀取前已改變；未載入內容。");
      const buffer = Buffer.alloc(maxBytes + 1);
      let bytes = 0;
      while (bytes < buffer.length) {
        const result = await handle.read(buffer, bytes, buffer.length - bytes, bytes);
        if (result.bytesRead === 0) break;
        bytes += result.bytesRead;
      }
      if (bytes > maxBytes)
        throw new MetaKeyError("KEY_FILE_TOO_LARGE", "憑證檔超出允許大小；未載入內容。");
      input = buffer.subarray(0, bytes).toString("utf8");
    } finally {
      await handle.close();
    }
  } catch (error) {
    if (error instanceof MetaKeyError) throw error;
    throw new MetaKeyError(
      "KEY_FILE_UNAVAILABLE",
      "無法讀取指定的server憑證檔；未顯示路徑或內容。",
    );
  }
  return { apiKey: parseMetaKeyFile(input), source: "file" };
}

export function metaKeyFileArgument(args: readonly string[]): string | undefined {
  if (args.length === 0) return undefined;
  if (args.length !== 2 || args[0] !== "--key-file" || !args[1]?.trim())
    throw new MetaKeyError(
      "CLI_ARGUMENT_INVALID",
      "僅支援可選的 --key-file <path>；未顯示參數內容。",
    );
  return args[1];
}
