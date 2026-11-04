import { createHash, randomUUID } from "node:crypto";
import type { Stats } from "node:fs";
import { lstat, mkdir, open, rename, unlink } from "node:fs/promises";
import type { FileHandle } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { assertBoundedJson, canonicalJson } from "../src/ai/validation.js";
import { metaConsumedUnits, metaExtendedAuthorization } from "./meta-budget-authorization.js";

/** A new authorization must use a new canonical ledger path, never reset an old ledger. */
export interface MetaBudgetPolicy {
  authorizationId: string;
  modelId: string;
  dataMode: "standard";
  budgetUsd: number;
  inputUsdPerMillionTokens: number;
  outputUsdPerMillionTokens: number;
  pricingSource: string;
  maxRequests: number;
  maxAttemptsPerRequest: number;
}
export interface MetaBudgetSettlement {
  status: "completed" | "failed" | "uncertain";
  httpStatus: number | null;
  responseId: string | null;
  modelId: string | null;
  usage?: { promptTokens: number; completionTokens: number } | null;
}
interface Attempt {
  attemptId: string;
  reservedUnits: number;
  status: "reserved" | MetaBudgetSettlement["status"];
  settlement: MetaBudgetSettlement | null;
}
interface RequestRecord {
  requestId: string;
  requestSha256: string;
  state: "active" | "completed" | "failed" | "uncertain";
  attempts: Attempt[];
  response: unknown | null;
  errorCode: string | null;
}
interface LedgerDocument {
  schemaVersion: "1.0.0";
  revision: number;
  policy: MetaBudgetPolicy;
  requests: RequestRecord[];
  actualBillingCostUsd: null;
  remainingCreditUsd: null;
}
export interface MetaBudgetSnapshot {
  policy: MetaBudgetPolicy;
  requests: number;
  attempts: number;
  reservedUsd: number;
  unreservedAuthorizedUsd: number;
  blockedReason: string | null;
  actualBillingCostUsd: null;
  remainingCreditUsd: null;
}
export interface MetaBudgetLedger {
  begin(
    requestId: string,
    requestSha256: string,
  ): Promise<{ kind: "new" } | { kind: "completed"; response: unknown }>;
  reserve(requestId: string, attemptId: string, reserveUsd: number): Promise<void>;
  settleAttempt(
    requestId: string,
    attemptId: string,
    settlement: MetaBudgetSettlement,
  ): Promise<void>;
  complete(requestId: string, response: unknown): Promise<void>;
  fail(requestId: string, code: string): Promise<void>;
  snapshot(): MetaBudgetSnapshot;
  close(): Promise<void>;
}
export class MetaBudgetLedgerError extends Error {
  constructor(
    readonly code: string,
    options?: ErrorOptions,
  ) {
    super(`Meta request ledger stopped: ${code}. No reserve was refunded.`, options);
    this.name = "MetaBudgetLedgerError";
  }
}
const MAX_BYTES = 4 * 1024 * 1024;
const MAX_RESPONSE_BYTES = 256 * 1024;
const UNITS_PER_USD = 1_000_000_000;
const hash = (text: string) => createHash("sha256").update(text).digest("hex");
const clone = <T>(value: T): T => structuredClone(value);
function fail(code: string): never {
  throw new MetaBudgetLedgerError(code);
}
const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const integer = (value: unknown, maximum = Number.MAX_SAFE_INTEGER): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 0 && (value as number) <= maximum;
const safeText = (value: unknown, maximum = 512): value is string =>
  typeof value === "string" &&
  value.length > 0 &&
  value.length <= maximum &&
  !/[\u0000-\u001f\u007f]/.test(value) &&
  !/(?:LLM[_|]|bearer\s|authorization\s*:)/i.test(value);
const safeId = (value: unknown): value is string =>
  safeText(value, 160) && /^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(value);
function exactKeys(value: Record<string, unknown>, keys: string[]): boolean {
  return (
    Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key))
  );
}
function policyOf(value: unknown): MetaBudgetPolicy {
  if (
    !isRecord(value) ||
    !exactKeys(value, [
      "authorizationId",
      "modelId",
      "dataMode",
      "budgetUsd",
      "inputUsdPerMillionTokens",
      "outputUsdPerMillionTokens",
      "pricingSource",
      "maxRequests",
      "maxAttemptsPerRequest",
    ]) ||
    !safeText(value.authorizationId) ||
    !safeId(value.modelId) ||
    value.dataMode !== "standard" ||
    typeof value.budgetUsd !== "number" ||
    !Number.isFinite(value.budgetUsd) ||
    value.budgetUsd <= 0 ||
    value.budgetUsd >
      (metaExtendedAuthorization(String(value.authorizationId))?.maxBudgetUsd ?? 1) ||
    !safeText(value.pricingSource, 2048) ||
    !integer(
      value.maxRequests,
      metaExtendedAuthorization(String(value.authorizationId))?.maxRequests ?? 12,
    ) ||
    value.maxRequests < 1 ||
    !integer(value.maxAttemptsPerRequest, 3) ||
    value.maxAttemptsPerRequest < 1
  )
    fail("LEDGER_POLICY_INVALID");
  for (const key of ["inputUsdPerMillionTokens", "outputUsdPerMillionTokens"]) {
    if (typeof value[key] !== "number" || !Number.isFinite(value[key]) || value[key] < 0)
      fail("LEDGER_POLICY_INVALID");
  }
  return clone(value) as unknown as MetaBudgetPolicy;
}
function settlementOf(value: unknown): MetaBudgetSettlement {
  if (!isRecord(value)) fail("INVALID_SETTLEMENT");
  const allowed = ["status", "httpStatus", "responseId", "modelId", "usage"];
  if (
    Object.keys(value).some((key) => !allowed.includes(key)) ||
    !["completed", "failed", "uncertain"].includes(String(value.status)) ||
    (value.httpStatus !== null && (!integer(value.httpStatus, 599) || value.httpStatus < 100)) ||
    (value.responseId !== null && !safeId(value.responseId)) ||
    (value.modelId !== null && !safeId(value.modelId))
  )
    fail("INVALID_SETTLEMENT");
  const usage = value.usage ?? null;
  if (
    usage !== null &&
    (!isRecord(usage) ||
      !exactKeys(usage, ["promptTokens", "completionTokens"]) ||
      !integer(usage.promptTokens) ||
      !integer(usage.completionTokens))
  )
    fail("INVALID_SETTLEMENT");
  return clone({ ...value, usage }) as unknown as MetaBudgetSettlement;
}
/** Persist only provider output fields, never input messages, transport headers or credentials. */
function responseOf(value: unknown): unknown {
  if (!isRecord(value)) fail("INVALID_RESPONSE");
  const normalized: Record<string, unknown> = {};
  for (const key of ["id", "model", "choices", "usage"])
    if (Object.hasOwn(value, key)) normalized[key] = value[key];
  try {
    assertBoundedJson(normalized, MAX_RESPONSE_BYTES);
    const text = canonicalJson(normalized);
    if (Buffer.byteLength(text, "utf8") > MAX_RESPONSE_BYTES) fail("INVALID_RESPONSE");
  } catch {
    fail("INVALID_RESPONSE");
  }
  return clone(normalized);
}
function reservedUnits(document: LedgerDocument): number {
  if (metaExtendedAuthorization(document.policy.authorizationId)) {
    const policy = document.policy;
    return document.requests.reduce(
      (sum, request) =>
        sum +
        request.attempts.reduce(
          (part, attempt) =>
            part +
            metaConsumedUnits(
              policy.authorizationId,
              attempt.reservedUnits,
              policy.inputUsdPerMillionTokens,
              policy.outputUsdPerMillionTokens,
              attempt.status === "completed",
              attempt.settlement?.usage ?? null,
            ),
          0,
        ),
      0,
    );
  }
  return document.requests.reduce(
    (sum, request) =>
      sum + request.attempts.reduce((part, attempt) => part + attempt.reservedUnits, 0),
    0,
  );
}
function documentJson(document: LedgerDocument): string {
  // Extended ledgers may hold 200 bounded responses. The generic canonicalizer is capped
  // at 1 MiB; the ledger has its own structural validator and unchanged 4 MiB byte cap.
  return metaExtendedAuthorization(document.policy.authorizationId)
    ? JSON.stringify(document)
    : canonicalJson(document);
}
function validateDocument(value: unknown, policy: MetaBudgetPolicy): LedgerDocument {
  if (
    !isRecord(value) ||
    !exactKeys(value, [
      "schemaVersion",
      "revision",
      "policy",
      "requests",
      "actualBillingCostUsd",
      "remainingCreditUsd",
    ]) ||
    value.schemaVersion !== "1.0.0" ||
    !integer(value.revision) ||
    canonicalJson(policyOf(value.policy)) !== canonicalJson(policy) ||
    value.actualBillingCostUsd !== null ||
    value.remainingCreditUsd !== null ||
    !Array.isArray(value.requests) ||
    value.requests.length > policy.maxRequests
  )
    fail("LEDGER_INVALID");
  const requestIds = new Set<string>();
  for (const raw of value.requests) {
    if (
      !isRecord(raw) ||
      !exactKeys(raw, [
        "requestId",
        "requestSha256",
        "state",
        "attempts",
        "response",
        "errorCode",
      ]) ||
      !safeId(raw.requestId) ||
      requestIds.has(raw.requestId) ||
      typeof raw.requestSha256 !== "string" ||
      !/^[a-f0-9]{64}$/.test(raw.requestSha256) ||
      !["active", "completed", "failed", "uncertain"].includes(String(raw.state)) ||
      (raw.errorCode !== null && !safeId(raw.errorCode)) ||
      !Array.isArray(raw.attempts) ||
      raw.attempts.length > policy.maxAttemptsPerRequest
    )
      fail("LEDGER_INVALID");
    requestIds.add(raw.requestId);
    const attemptIds = new Set<string>();
    for (const entry of raw.attempts) {
      if (
        !isRecord(entry) ||
        !exactKeys(entry, ["attemptId", "reservedUnits", "status", "settlement"]) ||
        !safeId(entry.attemptId) ||
        attemptIds.has(entry.attemptId) ||
        !integer(
          entry.reservedUnits,
          metaExtendedAuthorization(policy.authorizationId)
            ? Math.floor(policy.budgetUsd * UNITS_PER_USD)
            : UNITS_PER_USD,
        ) ||
        !["reserved", "completed", "failed", "uncertain"].includes(String(entry.status)) ||
        (entry.status === "reserved" ? entry.settlement !== null : entry.settlement === null)
      )
        fail("LEDGER_INVALID");
      attemptIds.add(entry.attemptId);
      if (entry.settlement !== null && settlementOf(entry.settlement).status !== entry.status)
        fail("LEDGER_INVALID");
    }
    const last = raw.attempts.at(-1);
    if (raw.state === "completed") {
      if (!last || last.status !== "completed" || raw.response === null || raw.errorCode !== null)
        fail("LEDGER_INVALID");
      if (canonicalJson(responseOf(raw.response)) !== canonicalJson(raw.response))
        fail("LEDGER_INVALID");
    } else if (raw.response !== null) fail("LEDGER_INVALID");
    if (raw.state === "failed" && raw.attempts.some((attempt) => attempt.status !== "failed"))
      fail("LEDGER_INVALID");
  }
  const result = clone(value) as unknown as LedgerDocument;
  if (reservedUnits(result) > Math.floor(policy.budgetUsd * UNITS_PER_USD)) fail("LEDGER_INVALID");
  return result;
}
function sameFile(a: Stats, b: Stats): boolean {
  return a.dev === b.dev && a.ino === b.ino;
}
async function readBounded(path: string, maxBytes: number): Promise<string> {
  const before = await lstat(path);
  if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1 || before.size > maxBytes)
    fail("LEDGER_INVALID");
  const handle = await open(path, "r");
  try {
    const opened = await handle.stat();
    if (!sameFile(before, opened)) fail("LEDGER_CHANGED");
    const bytes = Buffer.alloc(maxBytes + 1);
    let length = 0;
    for (;;) {
      const result = await handle.read(bytes, length, bytes.length - length, null);
      length += result.bytesRead;
      if (length > maxBytes) fail("LEDGER_INVALID");
      if (!result.bytesRead) break;
    }
    const after = await lstat(path);
    if (!after.isFile() || after.isSymbolicLink() || !sameFile(opened, after))
      fail("LEDGER_CHANGED");
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes.subarray(0, length));
  } finally {
    await handle.close();
  }
}
async function syncDirectory(path: string): Promise<void> {
  let handle: FileHandle | undefined;
  try {
    handle = await open(path, "r");
    await handle.sync();
  } catch (error) {
    if (
      process.platform !== "win32" ||
      !["EPERM", "EACCES", "EISDIR", "EINVAL", "ENOTSUP", "EBADF"].includes(
        (error as NodeJS.ErrnoException).code ?? "",
      )
    )
      throw error;
  } finally {
    await handle?.close();
  }
}

/** Short mutation locks allow independent processes to inspect one canonical authorization ledger. */
export async function openMetaBudgetLedger(
  ledgerPath: string,
  policyInput: MetaBudgetPolicy,
): Promise<MetaBudgetLedger> {
  const policy = policyOf(policyInput);
  const path = resolve(ledgerPath),
    directory = dirname(path),
    lockPath = path + ".lock";
  await mkdir(directory, { recursive: true });
  const directoryInfo = await lstat(directory);
  if (!directoryInfo.isDirectory() || directoryInfo.isSymbolicLink()) fail("LEDGER_INVALID");
  let cached: LedgerDocument | undefined;
  let closed = false;
  let poisoned = false;
  let queue = Promise.resolve();
  const owned = new Set<string>();
  const withLock = async <T>(operation: (document: LedgerDocument) => Promise<T>): Promise<T> => {
    if (closed) fail("LEDGER_CLOSED");
    if (poisoned) fail("LEDGER_IO_UNCERTAIN");
    let lock: FileHandle;
    try {
      lock = await open(lockPath, "wx", 0o600);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EEXIST") fail("LEDGER_LOCKED");
      fail("LEDGER_IO_ERROR");
    }
    const lockIdentity = await lock.stat();
    const lockText = JSON.stringify({ nonce: randomUUID(), pid: process.pid });
    const assertLock = async (): Promise<void> => {
      const info = await lstat(lockPath);
      if (
        !info.isFile() ||
        !sameFile(lockIdentity, info) ||
        (await readBounded(lockPath, 1024)) !== lockText
      )
        fail("LOCK_OWNERSHIP_LOST");
    };
    try {
      await lock.writeFile(lockText, "utf8");
      await lock.sync();
      let text: string;
      try {
        text = await readBounded(path, MAX_BYTES);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT" || cached) throw error;
        const initial: LedgerDocument = {
          schemaVersion: "1.0.0",
          revision: 0,
          policy,
          requests: [],
          actualBillingCostUsd: null,
          remainingCreditUsd: null,
        };
        text = JSON.stringify(initial, null, 2) + "\n";
        const handle = await open(path, "wx", 0o600);
        try {
          await handle.writeFile(text, "utf8");
          await handle.sync();
        } finally {
          await handle.close();
        }
        await syncDirectory(directory);
      }
      const document = validateDocument(JSON.parse(text), policy);
      if (
        cached &&
        (document.revision < cached.revision ||
          (metaExtendedAuthorization(policy.authorizationId)
            ? document.requests.reduce(
                (s, r) => s + r.attempts.reduce((p, a) => p + a.reservedUnits, 0),
                0,
              ) <
              cached.requests.reduce(
                (s, r) => s + r.attempts.reduce((p, a) => p + a.reservedUnits, 0),
                0,
              )
            : reservedUnits(document) < reservedUnits(cached)))
      )
        fail("LEDGER_CHANGED");
      cached = clone(document);
      const before = hash(text);
      const result = await operation(document);
      if (documentJson(document) !== documentJson(cached)) {
        document.revision++;
        validateDocument(document, policy);
        const serialized = JSON.stringify(document, null, 2) + "\n";
        if (Buffer.byteLength(serialized, "utf8") > MAX_BYTES) {
          poisoned = true;
          fail("LEDGER_CAPACITY_EXCEEDED");
        }
        await assertLock();
        if (hash(await readBounded(path, MAX_BYTES)) !== before) fail("LEDGER_CHANGED");
        const temporaryPath = path + ".tmp-" + randomUUID();
        const temporary = await open(temporaryPath, "wx", 0o600);
        try {
          await temporary.writeFile(serialized, "utf8");
          await temporary.sync();
        } finally {
          await temporary.close();
        }
        await assertLock();
        if (hash(await readBounded(path, MAX_BYTES)) !== before) fail("LEDGER_CHANGED");
        await rename(temporaryPath, path);
        await syncDirectory(directory);
        cached = clone(document);
      }
      return result;
    } catch (error) {
      if (!(error instanceof MetaBudgetLedgerError)) {
        poisoned = true;
        throw new MetaBudgetLedgerError("LEDGER_IO_UNCERTAIN", { cause: error });
      }
      throw error;
    } finally {
      try {
        await assertLock();
        await unlink(lockPath);
      } finally {
        await lock.close();
      }
    }
  };
  const serialize = <T>(operation: () => Promise<T>): Promise<T> => {
    const result = queue.then(operation);
    queue = result.then(
      () => {},
      () => {},
    );
    return result;
  };
  const mutation = <T>(operation: (document: LedgerDocument) => Promise<T> | T): Promise<T> =>
    serialize(() => withLock(async (document) => operation(document)));
  const request = (document: LedgerDocument, requestId: string): RequestRecord => {
    if (!owned.has(requestId)) fail("REQUEST_NOT_OWNED");
    const entry = document.requests.find((item) => item.requestId === requestId);
    if (!entry || entry.state !== "active") fail("REQUEST_NOT_ACTIVE");
    return entry;
  };
  await mutation(() => {});
  const ledger: MetaBudgetLedger = {
    begin(requestId, requestSha256) {
      return mutation((document) => {
        if (!safeId(requestId) || !/^[a-f0-9]{64}$/.test(requestSha256)) fail("REQUEST_ID_INVALID");
        const old = document.requests.find((item) => item.requestId === requestId);
        if (old) {
          if (old.requestSha256 !== requestSha256) fail("REQUEST_ID_CONFLICT");
          if (old.state === "completed")
            return { kind: "completed", response: clone(old.response) };
          fail(old.state === "failed" ? "REQUEST_ALREADY_FAILED" : "REQUEST_OUTCOME_UNCONFIRMED");
        }
        if (document.requests.some((item) => item.state === "active" || item.state === "uncertain"))
          fail("REQUEST_OUTCOME_UNCONFIRMED");
        if (document.requests.length >= policy.maxRequests) fail("REQUEST_LIMIT_REACHED");
        document.requests.push({
          requestId,
          requestSha256,
          state: "active",
          attempts: [],
          response: null,
          errorCode: null,
        });
        owned.add(requestId);
        return { kind: "new" };
      });
    },
    reserve(requestId, attemptId, reserveUsd) {
      return mutation((document) => {
        const entry = request(document, requestId);
        if (
          !safeId(attemptId) ||
          !Number.isFinite(reserveUsd) ||
          reserveUsd < 0 ||
          reserveUsd > policy.budgetUsd
        )
          fail("RESERVATION_INVALID");
        if (entry.attempts.some((item) => item.attemptId === attemptId))
          fail("ATTEMPT_ALREADY_RESERVED");
        if (entry.attempts.some((item) => item.status !== "failed"))
          fail("ATTEMPT_OUTCOME_UNCONFIRMED");
        if (entry.attempts.length >= policy.maxAttemptsPerRequest) fail("ATTEMPT_LIMIT_REACHED");
        const units = Math.ceil(reserveUsd * UNITS_PER_USD);
        if (reservedUnits(document) + units > Math.floor(policy.budgetUsd * UNITS_PER_USD))
          fail("BUDGET_EXCEEDED");
        entry.attempts.push({
          attemptId,
          reservedUnits: units,
          status: "reserved",
          settlement: null,
        });
      });
    },
    settleAttempt(requestId, attemptId, input) {
      return mutation((document) => {
        const entry = request(document, requestId);
        const attempt = entry.attempts.find((item) => item.attemptId === attemptId);
        if (!attempt || attempt.status !== "reserved") fail("ATTEMPT_NOT_RESERVED");
        const settlement = settlementOf(input);
        if (
          settlement.status === "completed" &&
          (settlement.modelId !== policy.modelId ||
            settlement.responseId === null ||
            settlement.httpStatus === null ||
            settlement.httpStatus < 200 ||
            settlement.httpStatus >= 300)
        )
          settlement.status = "uncertain";
        attempt.status = settlement.status;
        attempt.settlement = settlement;
      });
    },
    complete(requestId, response) {
      return mutation((document) => {
        const entry = request(document, requestId);
        if (entry.attempts.at(-1)?.status !== "completed") fail("ATTEMPT_NOT_COMPLETED");
        const normalized = responseOf(response);
        const settlement = entry.attempts.at(-1)!.settlement!;
        if (
          !isRecord(normalized) ||
          normalized.id !== settlement.responseId ||
          normalized.model !== settlement.modelId
        )
          fail("RESPONSE_IDENTITY_MISMATCH");
        entry.response = normalized;
        entry.state = "completed";
        owned.delete(requestId);
      });
    },
    fail(requestId, code) {
      return mutation((document) => {
        if (!safeId(code)) fail("FAILURE_CODE_INVALID");
        const entry = request(document, requestId);
        entry.state = entry.attempts.some(
          (item) => item.status === "reserved" || item.status === "uncertain",
        )
          ? "uncertain"
          : "failed";
        // A completed HTTP body may still fail local schema validation. Its reserve stays held.
        if (entry.attempts.some((item) => item.status === "completed")) entry.state = "uncertain";
        entry.errorCode = code;
        owned.delete(requestId);
      });
    },
    snapshot() {
      if (!cached) fail("LEDGER_NOT_READY");
      const units = reservedUnits(cached);
      return {
        policy: clone(policy),
        requests: cached.requests.length,
        attempts: cached.requests.reduce((sum, entry) => sum + entry.attempts.length, 0),
        reservedUsd: units / UNITS_PER_USD,
        unreservedAuthorizedUsd:
          (Math.floor(policy.budgetUsd * UNITS_PER_USD) - units) / UNITS_PER_USD,
        blockedReason: poisoned
          ? "LEDGER_IO_UNCERTAIN"
          : cached.requests.some((entry) => entry.state === "active" || entry.state === "uncertain")
            ? "REQUEST_OUTCOME_UNCONFIRMED"
            : null,
        actualBillingCostUsd: null,
        remainingCreditUsd: null,
      };
    },
    close() {
      return serialize(async () => {
        closed = true;
      });
    },
  };
  return ledger;
}
