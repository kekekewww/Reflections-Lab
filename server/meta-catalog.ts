/** A catalog access proof is deliberately separate from inference/billing authorization. */
export interface MetaCatalogProof {
  modelIds: string[];
  httpStatus: number | null;
  requestId: string | null;
  checkedAt: string;
  elapsedMs: number;
  status: "PASSED" | "FAILED";
  code?: MetaCatalogFailureCode;
  inferenceRequests: 0;
  remainingCreditUsd: null;
  actualCostUsd: null;
  scope: "CATALOG_ACCESS_ONLY";
}
export interface MetaCatalogDependencies {
  fetch?: typeof fetch;
  now?: () => number;
  timeoutMs?: number;
}
export type MetaCatalogFailureCode =
  | "INVALID_API_KEY"
  | "INVALID_OPTIONS"
  | "AUTHENTICATION_ERROR"
  | "PERMISSION_DENIED"
  | "RATE_LIMITED"
  | "HTTP_ERROR"
  | "REDIRECT_REJECTED"
  | "SCHEMA_INVALID"
  | "INPUT_LIMIT"
  | "TIMEOUT"
  | "TRANSPORT_ERROR";

const ENDPOINT = "https://api.meta.ai/v1/models";
const MAX_BYTES = 256 * 1024;
class CatalogFailure extends Error {
  constructor(readonly code: MetaCatalogFailureCode) {
    super(code);
  }
}
function plain(value: unknown): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    [Object.prototype, null].includes(Object.getPrototypeOf(value))
  );
}
function catalogIds(value: unknown, key: string): string[] {
  if (
    !plain(value) ||
    value.object !== "list" ||
    !Array.isArray(value.data) ||
    value.data.length > 256 ||
    Object.keys(value).some((name) => !["object", "data"].includes(name))
  )
    throw new CatalogFailure("SCHEMA_INVALID");
  const ids = value.data.map((entry: unknown) => {
    if (
      !plain(entry) ||
      entry.object !== "model" ||
      typeof entry.id !== "string" ||
      !/^[a-z][a-z0-9._-]{0,127}$/.test(entry.id) ||
      entry.id.includes(key) ||
      !Number.isSafeInteger(entry.created) ||
      Number(entry.created) < 0 ||
      typeof entry.owned_by !== "string" ||
      ("metadata" in entry && !plain(entry.metadata)) ||
      Object.keys(entry).some(
        (name) => !["object", "id", "created", "owned_by", "metadata"].includes(name),
      )
    )
      throw new CatalogFailure("SCHEMA_INVALID");
    return entry.id;
  });
  if (new Set(ids).size !== ids.length) throw new CatalogFailure("SCHEMA_INVALID");
  return ids.sort();
}
function correlationId(headers: Headers, key: string): string | null {
  for (const name of ["x-request-id", "request-id", "x-meta-request-id"]) {
    const value = headers.get(name);
    if (
      value &&
      /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value) &&
      !value.includes(key) &&
      !/LLM_/i.test(value)
    )
      return value;
  }
  return null;
}
function httpFailure(status: number): MetaCatalogFailureCode {
  if (status >= 300 && status < 400) return "REDIRECT_REJECTED";
  if (status === 401) return "AUTHENTICATION_ERROR";
  if (status === 403) return "PERMISSION_DENIED";
  if (status === 429) return "RATE_LIMITED";
  return "HTTP_ERROR";
}

/** Fixed GET only, no retries, no body/header/error retention, and no inference side effects. */
export async function probeMetaCatalog(
  apiKey: string,
  dependencies: MetaCatalogDependencies = {},
): Promise<MetaCatalogProof> {
  const clock = (): number => {
    try {
      const value = (dependencies.now ?? Date.now)();
      if (Number.isFinite(value) && Math.abs(value) <= 8640000000000000) return value;
    } catch {
      /* A failing injected clock must never expose its error text. */
    }
    return Date.now();
  };
  const startedAt = clock();
  let httpStatus: number | null = null;
  let requestId: string | null = null;
  const finish = (
    status: MetaCatalogProof["status"],
    modelIds: string[] = [],
    code?: MetaCatalogFailureCode,
  ): MetaCatalogProof => {
    const finishedAt = clock();
    return {
      modelIds,
      httpStatus,
      requestId,
      checkedAt: new Date(finishedAt).toISOString(),
      elapsedMs: Math.max(0, finishedAt - startedAt),
      status,
      ...(code ? { code } : {}),
      inferenceRequests: 0,
      remainingCreditUsd: null,
      actualCostUsd: null,
      scope: "CATALOG_ACCESS_ONLY",
    };
  };
  if (
    typeof apiKey !== "string" ||
    !apiKey ||
    apiKey.length > 8192 ||
    /[\x00-\x20\x7f]/.test(apiKey)
  )
    return finish("FAILED", [], "INVALID_API_KEY");
  const timeoutMs = dependencies.timeoutMs ?? 10000;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 15000)
    return finish("FAILED", [], "INVALID_OPTIONS");
  const controller = new AbortController();
  let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  let body: ReadableStream<Uint8Array> | null = null;
  let timedOut = false;
  const cancel = (): void => {
    try {
      const pending = reader ? reader.cancel() : body?.cancel();
      if (pending) void pending.catch(() => {});
    } catch {
      /* Cancellation errors and transport error messages are never evidence. */
    }
  };
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
      cancel();
      reject(new CatalogFailure("TIMEOUT"));
    }, timeoutMs);
  });
  const operation = async (): Promise<string[]> => {
    const response = await (dependencies.fetch ?? globalThis.fetch)(ENDPOINT, {
      method: "GET",
      redirect: "error",
      signal: controller.signal,
      headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
    });
    if (controller.signal.aborted) throw new CatalogFailure("TIMEOUT");
    httpStatus = response.status;
    requestId = correlationId(response.headers, apiKey);
    body = response.body;
    if (response.redirected || (response.url && response.url !== ENDPOINT))
      throw new CatalogFailure("REDIRECT_REJECTED");
    if (!response.ok) throw new CatalogFailure(httpFailure(response.status));
    if (!body) throw new CatalogFailure("SCHEMA_INVALID");
    reader = body.getReader();
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      bytes += part.value.byteLength;
      if (bytes > MAX_BYTES) throw new CatalogFailure("INPUT_LIMIT");
      chunks.push(part.value);
    }
    const combined = new Uint8Array(bytes);
    let offset = 0;
    for (const chunk of chunks) {
      combined.set(chunk, offset);
      offset += chunk.byteLength;
    }
    let value: unknown;
    try {
      value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(combined));
    } catch {
      throw new CatalogFailure("SCHEMA_INVALID");
    }
    return catalogIds(value, apiKey);
  };
  try {
    const ids = await Promise.race([operation(), deadline]);
    return finish("PASSED", ids);
  } catch (error) {
    return finish(
      "FAILED",
      [],
      timedOut ? "TIMEOUT" : error instanceof CatalogFailure ? error.code : "TRANSPORT_ERROR",
    );
  } finally {
    clearTimeout(timer);
    controller.abort();
    cancel();
  }
}
