import { createHash, randomUUID } from "node:crypto";
import type { Stats } from "node:fs";
import { lstat, mkdir, open, rename, unlink } from "node:fs/promises";
import type { FileHandle } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { assertBoundedJson, canonicalJson } from "../src/ai/validation.js";

export const META_LIVE_BUDGET_POLICY = Object.freeze({
  budgetUsd: 1,
  maxPaidRequests: 3,
  reservePerRequestUsd: 0.25,
  maxCompletionTokens: 1000,
  modelId: "muse-spark-1.3" as const,
  dataMode: "standard" as const,
  inputUsdPerMillionTokens: 1.25,
  outputUsdPerMillionTokens: 4.25,
  pricingSource: "https://dev.meta.ai/docs/pricing-rate-limits",
});
export interface MetaLiveRequestSummary {
  modelId: "muse-spark-1.3";
  maxCompletionTokens: number;
  payloadSha256?: string;
  inputBytes?: number;
  toolNames?: string[];
}
export interface MetaLiveUsage {
  promptTokens: number;
  completionTokens: number;
  cachedInputTokens?: number | null;
  reasoningTokens?: number | null;
}
interface RecordedUsage {
  promptTokens: number;
  completionTokens: number;
  cachedInputTokens: number | null;
  reasoningTokens: number | null;
}
export interface MetaLiveSettlement {
  httpStatus: number | null;
  responseId: string | null;
  modelId: string | null;
  usage: MetaLiveUsage | null;
  status: "completed" | "failed" | "unknown";
}
interface Attempt {
  attemptId: string;
  phase: string;
  reservedAt: string;
  settledAt: string | null;
  reservedUsd: 0.25;
  requestSummary: MetaLiveRequestSummary;
  status: "reserved" | MetaLiveSettlement["status"];
  httpStatus: number | null;
  responseId: string | null;
  modelId: string | null;
  usage: RecordedUsage | null;
  estimatedCostUsd: number | null;
  validationError: string | null;
  actualBillingCostUsd: null;
}
export interface MetaHttp400Reconciliation {
  attemptId: string;
  kind: "HTTP_400_REQUEST_REJECTION";
  reason: string;
  safeAuthorizationRef: string;
  createdAt: string;
}
interface Document {
  schemaVersion: "1.0.0";
  policy: typeof META_LIVE_BUDGET_POLICY;
  createdAt: string;
  updatedAt: string;
  attempts: Attempt[];
  reconciliations: MetaHttp400Reconciliation[];
  actualBillingCostUsd: null;
  remainingCreditUsd: null;
}
export interface MetaLiveBudgetSnapshot extends Document {
  reservedUsd: number;
  unreservedAuthorizedUsd: number;
  remainingRequestSlots: number;
  blockedReason: string | null;
}
export interface MetaLiveBudget {
  reserve(phase: string, requestSummarySafe: MetaLiveRequestSummary): Promise<string>;
  settle(attemptId: string, result: MetaLiveSettlement): Promise<void>;
  reconcileHttp400(attemptId: string, reason: string, authorizationRef: string): Promise<void>;
  snapshot(): MetaLiveBudgetSnapshot;
  close(): Promise<void>;
}
export class MetaLiveBudgetError extends Error {
  constructor(
    readonly code: string,
    message = "Meta live ledger拒絕操作；未增加或重設授權額度。",
  ) {
    super(message);
    this.name = "MetaLiveBudgetError";
  }
}
const policy = META_LIVE_BUDGET_POLICY;
const maxLedgerBytes = 256 * 1024;
const stopCodes = [
  "INVALID_SETTLEMENT",
  "INVALID_USAGE",
  "MODEL_MISMATCH",
  "MISSING_RESPONSE_METADATA",
  "COST_RESERVE_EXCEEDED",
  "UNKNOWN_USAGE",
  "UNKNOWN_OUTCOME",
  "HTTP_400_REQUEST_REJECTED",
];
const digest = (value: string) => createHash("sha256").update(value).digest("hex");
const credentialLike = (value: string) => /LLM[_|]/i.test(value);
function fail(code: string): never {
  throw new MetaLiveBudgetError(code);
}
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return fail("LEDGER_INVALID");
  return value as Record<string, unknown>;
}
function keys(value: Record<string, unknown>, required: string[], optional: string[] = []): void {
  if (
    required.some((key) => !Object.hasOwn(value, key)) ||
    Object.keys(value).some((key) => !required.includes(key) && !optional.includes(key))
  )
    fail("LEDGER_INVALID");
}
function count(value: unknown, maximum = Number.MAX_SAFE_INTEGER): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0 && (value as number) <= maximum;
}
function safeId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/.test(value) &&
    !credentialLike(value)
  );
}
function timestamp(value: unknown): boolean {
  return (
    typeof value === "string" &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString() === value
  );
}
function summary(input: unknown): MetaLiveRequestSummary {
  const value = record(input);
  keys(value, ["modelId", "maxCompletionTokens"], ["payloadSha256", "inputBytes", "toolNames"]);
  if (
    value.modelId !== policy.modelId ||
    !count(value.maxCompletionTokens, policy.maxCompletionTokens) ||
    value.maxCompletionTokens < 1 ||
    (value.payloadSha256 !== undefined &&
      (typeof value.payloadSha256 !== "string" || !/^[a-f0-9]{64}$/.test(value.payloadSha256))) ||
    (value.inputBytes !== undefined && !count(value.inputBytes, 1024 * 1024)) ||
    (value.toolNames !== undefined &&
      (!Array.isArray(value.toolNames) ||
        value.toolNames.length > 32 ||
        value.toolNames.some(
          (name) =>
            typeof name !== "string" ||
            !/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(name) ||
            credentialLike(name),
        )))
  )
    fail("LEDGER_INVALID");
  return structuredClone(value) as unknown as MetaLiveRequestSummary;
}
function usage(input: unknown, maxCompletion: number): RecordedUsage {
  const value = record(input);
  keys(value, ["promptTokens", "completionTokens"], ["cachedInputTokens", "reasoningTokens"]);
  if (
    !count(value.promptTokens) ||
    !count(value.completionTokens, maxCompletion) ||
    (value.cachedInputTokens !== undefined &&
      value.cachedInputTokens !== null &&
      !count(value.cachedInputTokens, value.promptTokens)) ||
    (value.reasoningTokens !== undefined &&
      value.reasoningTokens !== null &&
      !count(value.reasoningTokens, value.completionTokens))
  )
    fail("INVALID_USAGE");
  return {
    promptTokens: value.promptTokens,
    completionTokens: value.completionTokens,
    cachedInputTokens: (value.cachedInputTokens as number | null | undefined) ?? null,
    reasoningTokens: (value.reasoningTokens as number | null | undefined) ?? null,
  };
}
function estimatedCost(value: RecordedUsage): number {
  // No optimistic cache discount and no double-counting reasoning tokens.
  return (
    (value.promptTokens * policy.inputUsdPerMillionTokens +
      value.completionTokens * policy.outputUsdPerMillionTokens) /
    1_000_000
  );
}
function settlementError(entry: Attempt): string | null {
  if (http400Rejection(entry)) return "HTTP_400_REQUEST_REJECTED";
  let error: string | null = null;
  if (entry.modelId !== policy.modelId)
    error = entry.modelId ? "MODEL_MISMATCH" : "MISSING_RESPONSE_METADATA";
  else if (
    !entry.responseId ||
    entry.httpStatus === null ||
    (entry.status === "completed" && (entry.httpStatus < 200 || entry.httpStatus >= 300))
  )
    error = "MISSING_RESPONSE_METADATA";
  else if (entry.status === "unknown") error = "UNKNOWN_OUTCOME";
  else if (!entry.usage) error = "UNKNOWN_USAGE";
  if (entry.estimatedCostUsd !== null && entry.estimatedCostUsd > entry.reservedUsd)
    error = "COST_RESERVE_EXCEEDED";
  return error;
}
function http400Rejection(attempt: Attempt): boolean {
  return (
    attempt.status === "failed" &&
    attempt.httpStatus === 400 &&
    attempt.settledAt !== null &&
    attempt.responseId === null &&
    attempt.modelId === null &&
    attempt.usage === null &&
    attempt.estimatedCostUsd === null
  );
}
function eligibleHttp400(attempt: Attempt): boolean {
  return (
    http400Rejection(attempt) &&
    ["MISSING_RESPONSE_METADATA", "HTTP_400_REQUEST_REJECTED"].includes(
      attempt.validationError ?? "",
    )
  );
}
function safeReviewReason(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.length <= 512 &&
    !credentialLike(value) &&
    !/[\u0000-\u001f\u007f]/.test(value) &&
    !/(?:authorization\s*:|bearer\s+)/i.test(value)
  );
}
function blocked(document: Document): string | null {
  const reviewed = new Set(document.reconciliations.map((entry) => entry.attemptId));
  for (const attempt of document.attempts) {
    // A manual rejection acknowledgement is not a refund or a claim of zero billing.
    if (reviewed.has(attempt.attemptId) && eligibleHttp400(attempt)) continue;
    if (attempt.validationError) return attempt.validationError;
    if (attempt.status === "reserved") return "PENDING_ATTEMPT";
    if (attempt.status === "unknown") return "UNKNOWN_OUTCOME";
    if (!attempt.usage) return "UNKNOWN_USAGE";
  }
  return document.attempts.length >= policy.maxPaidRequests ? "REQUEST_LIMIT_REACHED" : null;
}
function validateDocument(input: unknown): Document {
  assertBoundedJson(input, maxLedgerBytes);
  const value = record(input);
  keys(
    value,
    [
      "schemaVersion",
      "policy",
      "createdAt",
      "updatedAt",
      "attempts",
      "actualBillingCostUsd",
      "remainingCreditUsd",
    ],
    ["reconciliations"],
  );
  if (
    value.schemaVersion !== "1.0.0" ||
    canonicalJson(value.policy) !== canonicalJson(policy) ||
    !timestamp(value.createdAt) ||
    !timestamp(value.updatedAt) ||
    value.actualBillingCostUsd !== null ||
    value.remainingCreditUsd !== null ||
    !Array.isArray(value.attempts) ||
    value.attempts.length > policy.maxPaidRequests
  )
    fail("LEDGER_INVALID");
  const ids = new Set<string>();
  for (const raw of value.attempts) {
    const entry = record(raw);
    keys(entry, [
      "attemptId",
      "phase",
      "reservedAt",
      "settledAt",
      "reservedUsd",
      "requestSummary",
      "status",
      "httpStatus",
      "responseId",
      "modelId",
      "usage",
      "estimatedCostUsd",
      "validationError",
      "actualBillingCostUsd",
    ]);
    const request = summary(entry.requestSummary);
    if (
      typeof entry.attemptId !== "string" ||
      !/^meta-live-[a-f0-9-]{36}$/.test(entry.attemptId) ||
      ids.has(entry.attemptId) ||
      typeof entry.phase !== "string" ||
      !/^[A-Za-z][A-Za-z0-9._-]{0,63}$/.test(entry.phase) ||
      credentialLike(entry.phase) ||
      !timestamp(entry.reservedAt) ||
      entry.reservedUsd !== 0.25 ||
      entry.actualBillingCostUsd !== null ||
      !["reserved", "completed", "failed", "unknown"].includes(String(entry.status)) ||
      (entry.validationError !== null && !stopCodes.includes(String(entry.validationError))) ||
      (entry.httpStatus !== null && (!count(entry.httpStatus, 599) || entry.httpStatus < 100)) ||
      (entry.responseId !== null && !safeId(entry.responseId)) ||
      (entry.modelId !== null && !safeId(entry.modelId))
    )
      fail("LEDGER_INVALID");
    ids.add(entry.attemptId);
    if (entry.status === "reserved") {
      if (
        [
          entry.settledAt,
          entry.httpStatus,
          entry.responseId,
          entry.modelId,
          entry.usage,
          entry.estimatedCostUsd,
          entry.validationError,
        ].some((field) => field !== null)
      )
        fail("LEDGER_INVALID");
    } else {
      if (!timestamp(entry.settledAt)) fail("LEDGER_INVALID");
      const observed =
        entry.usage === null ? null : usage(entry.usage, request.maxCompletionTokens);
      const expected =
        observed && entry.modelId === policy.modelId ? estimatedCost(observed) : null;
      if (entry.estimatedCostUsd !== expected) fail("LEDGER_INVALID");
      if (
        !["INVALID_SETTLEMENT", "INVALID_USAGE"].includes(String(entry.validationError)) &&
        !(
          entry.validationError === "MISSING_RESPONSE_METADATA" &&
          http400Rejection(entry as unknown as Attempt)
        ) &&
        settlementError(entry as unknown as Attempt) !== entry.validationError
      )
        fail("LEDGER_INVALID");
    }
  }
  const reconciliations = value.reconciliations === undefined ? [] : value.reconciliations;
  if (!Array.isArray(reconciliations) || reconciliations.length > policy.maxPaidRequests)
    fail("LEDGER_INVALID");
  const reviewed = new Set<string>();
  for (const raw of reconciliations) {
    const entry = record(raw);
    keys(entry, ["attemptId", "kind", "reason", "safeAuthorizationRef", "createdAt"]);
    const attempt = value.attempts.find(
      (candidate) => record(candidate).attemptId === entry.attemptId,
    ) as Attempt | undefined;
    if (
      !attempt ||
      reviewed.has(attempt.attemptId) ||
      !eligibleHttp400(attempt) ||
      entry.kind !== "HTTP_400_REQUEST_REJECTION" ||
      !safeReviewReason(entry.reason) ||
      !safeId(entry.safeAuthorizationRef) ||
      !timestamp(entry.createdAt)
    )
      fail("LEDGER_INVALID");
    reviewed.add(attempt.attemptId);
  }
  // Additive in-memory migration only. The original bytes remain the CAS preimage until an explicit mutation.
  return structuredClone({ ...value, reconciliations }) as unknown as Document;
}
async function readBounded(path: string, maxBytes: number): Promise<string> {
  const handle = await open(path, "r");
  try {
    const info = await handle.stat();
    if (!info.isFile() || info.size > maxBytes) return fail("LEDGER_INVALID");
    const bytes = Buffer.alloc(maxBytes + 1);
    let length = 0;
    for (;;) {
      const result = await handle.read(bytes, length, bytes.length - length, null);
      length += result.bytesRead;
      if (length > maxBytes) return fail("LEDGER_INVALID");
      if (result.bytesRead === 0) break;
    }
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
    const code = (error as NodeJS.ErrnoException).code;
    if (
      process.platform !== "win32" ||
      !["EPERM", "EACCES", "EISDIR", "EINVAL", "ENOTSUP", "EBADF"].includes(code ?? "")
    )
      throw error;
  } finally {
    await handle?.close();
  }
}

/** The production CLI must always use one canonical path; no ledger reset or budget override API exists. */
export async function openMetaLiveBudget(ledgerPath: string): Promise<MetaLiveBudget> {
  const path = resolve(ledgerPath),
    directory = dirname(path),
    lockPath = path + ".lock";
  await mkdir(directory, { recursive: true });
  let lock: FileHandle;
  try {
    lock = await open(lockPath, "wx", 0o600);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") return fail("LEDGER_LOCKED");
    return fail("LEDGER_IO_ERROR");
  }
  const lockText = JSON.stringify({
    nonce: randomUUID(),
    pid: process.pid,
    createdAt: new Date().toISOString(),
  });
  let lockIdentity: Stats;
  try {
    lockIdentity = await lock.stat();
    await lock.writeFile(lockText, "utf8");
    await lock.sync();
    await syncDirectory(directory);
  } catch {
    try {
      const handleIdentity = await lock.stat(),
        pathIdentity = await lstat(lockPath);
      if (
        pathIdentity.isFile() &&
        pathIdentity.dev === handleIdentity.dev &&
        pathIdentity.ino === handleIdentity.ino
      )
        await unlink(lockPath);
    } finally {
      await lock.close();
    }
    return fail("LEDGER_IO_ERROR");
  }
  let closed = false,
    closing = false,
    poisoned = false;
  let closePromise: Promise<void> | undefined;
  let queue = Promise.resolve();
  const currentRun = new Set<string>();
  const assertLock = async (): Promise<void> => {
    try {
      const identity = await lstat(lockPath);
      if (
        !identity.isFile() ||
        identity.dev !== lockIdentity.dev ||
        identity.ino !== lockIdentity.ino ||
        (await readBounded(lockPath, 1024)) !== lockText
      )
        fail("LOCK_OWNERSHIP_LOST");
    } catch {
      fail("LOCK_OWNERSHIP_LOST");
    }
  };
  const release = async (): Promise<void> => {
    try {
      await assertLock();
      await unlink(lockPath);
      await syncDirectory(directory);
    } finally {
      await lock.close();
      closed = true;
    }
  };
  let document: Document;
  let expectedText: string;
  try {
    try {
      expectedText = await readBounded(path, maxLedgerBytes);
      document = validateDocument(JSON.parse(expectedText));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      const now = new Date().toISOString();
      document = {
        schemaVersion: "1.0.0",
        policy: { ...policy },
        createdAt: now,
        updatedAt: now,
        attempts: [],
        reconciliations: [],
        actualBillingCostUsd: null,
        remainingCreditUsd: null,
      };
      expectedText = JSON.stringify(document, null, 2) + "\n";
      const initial = await open(path, "wx", 0o600);
      try {
        await initial.writeFile(expectedText, "utf8");
        await initial.sync();
      } finally {
        await initial.close();
      }
      await syncDirectory(directory);
    }
  } catch {
    await release();
    return fail("LEDGER_INVALID");
  }
  const serialize = <T>(operation: () => Promise<T>): Promise<T> => {
    const result = queue.then(operation);
    queue = result.then(
      () => {},
      () => {},
    );
    return result;
  };
  const persist = async (candidate: Document): Promise<void> => {
    try {
      await assertLock();
      if (digest(await readBounded(path, maxLedgerBytes)) !== digest(expectedText))
        fail("LEDGER_CHANGED");
      validateDocument(candidate);
      const serialized = JSON.stringify(candidate, null, 2) + "\n";
      const temporaryPath = path + ".tmp-" + randomUUID();
      const temporary = await open(temporaryPath, "wx", 0o600);
      try {
        await temporary.writeFile(serialized, "utf8");
        await temporary.sync();
      } finally {
        await temporary.close();
      }
      // Recheck immediately before rename. Cooperating writers are excluded by the retained lock.
      await assertLock();
      if (digest(await readBounded(path, maxLedgerBytes)) !== digest(expectedText))
        fail("LEDGER_CHANGED");
      await rename(temporaryPath, path);
      await syncDirectory(directory);
      document = candidate;
      expectedText = serialized;
    } catch (error) {
      poisoned = true;
      if (error instanceof MetaLiveBudgetError) throw error;
      fail("LEDGER_IO_UNCERTAIN");
    }
  };
  const assertOpen = (): void => {
    if (closed) fail("LEDGER_CLOSED");
    if (poisoned) fail("LEDGER_IO_UNCERTAIN");
  };
  const result: MetaLiveBudget = {
    reserve(phase, requestSummarySafe) {
      if (closed || closing) return Promise.reject(new MetaLiveBudgetError("LEDGER_CLOSED"));
      return serialize(async () => {
        assertOpen();
        const stop = blocked(document);
        if (stop) fail(stop);
        let request: MetaLiveRequestSummary;
        try {
          assertBoundedJson(requestSummarySafe, 8192);
          request = summary(requestSummarySafe);
          if (
            typeof phase !== "string" ||
            !/^[A-Za-z][A-Za-z0-9._-]{0,63}$/.test(phase) ||
            credentialLike(phase)
          )
            fail("REQUEST_SUMMARY_INVALID");
        } catch {
          return fail("REQUEST_SUMMARY_INVALID");
        }
        const candidate = structuredClone(document),
          now = new Date().toISOString();
        const id = "meta-live-" + randomUUID();
        candidate.updatedAt = now;
        candidate.attempts.push({
          attemptId: id,
          phase,
          reservedAt: now,
          settledAt: null,
          reservedUsd: 0.25,
          requestSummary: request,
          status: "reserved",
          httpStatus: null,
          responseId: null,
          modelId: null,
          usage: null,
          estimatedCostUsd: null,
          validationError: null,
          actualBillingCostUsd: null,
        });
        await persist(candidate); // No caller may POST before this durable reservation returns.
        currentRun.add(id);
        return id;
      });
    },
    settle(attemptId, input) {
      if (closed || closing) return Promise.reject(new MetaLiveBudgetError("LEDGER_CLOSED"));
      return serialize(async () => {
        assertOpen();
        const original = document.attempts.find((entry) => entry.attemptId === attemptId);
        if (!original) fail("UNKNOWN_ATTEMPT");
        if (!currentRun.has(attemptId)) fail("RESULT_UNKNOWN");
        if (original.status !== "reserved") fail("SETTLEMENT_ALREADY_RECORDED");
        const candidate = structuredClone(document),
          entry = candidate.attempts.find((value) => value.attemptId === attemptId)!;
        entry.settledAt = candidate.updatedAt = new Date().toISOString();
        entry.status = "unknown";
        let invalid: string | null = null;
        try {
          assertBoundedJson(input, 8192);
          const value = record(input);
          keys(value, ["httpStatus", "responseId", "modelId", "usage", "status"]);
          if (
            !["completed", "failed", "unknown"].includes(String(value.status)) ||
            (value.httpStatus !== null &&
              (!count(value.httpStatus, 599) || value.httpStatus < 100)) ||
            (value.responseId !== null && !safeId(value.responseId)) ||
            (value.modelId !== null && !safeId(value.modelId))
          )
            fail("INVALID_SETTLEMENT");
          entry.status = value.status as MetaLiveSettlement["status"];
          entry.httpStatus = value.httpStatus as number | null;
          entry.responseId = value.responseId as string | null;
          entry.modelId = value.modelId as string | null;
          if (value.usage !== null) {
            try {
              entry.usage = usage(value.usage, original.requestSummary.maxCompletionTokens);
            } catch {
              fail("INVALID_USAGE");
            }
          }
          if (entry.usage && entry.modelId === policy.modelId)
            entry.estimatedCostUsd = estimatedCost(entry.usage);
          invalid = settlementError(entry);
        } catch (error) {
          invalid =
            error instanceof MetaLiveBudgetError && error.code === "INVALID_USAGE"
              ? "INVALID_USAGE"
              : "INVALID_SETTLEMENT";
        }
        entry.validationError = invalid;
        await persist(candidate);
        if (invalid) fail(invalid);
      });
    },
    reconcileHttp400(attemptId, reason, authorizationRef) {
      if (closed || closing) return Promise.reject(new MetaLiveBudgetError("LEDGER_CLOSED"));
      return serialize(async () => {
        assertOpen();
        if (!safeReviewReason(reason) || !safeId(authorizationRef))
          fail("RECONCILIATION_METADATA_INVALID");
        const attempt = document.attempts.find((entry) => entry.attemptId === attemptId);
        if (!attempt || !eligibleHttp400(attempt)) fail("HTTP400_RECONCILIATION_DENIED");
        if (document.reconciliations.some((entry) => entry.attemptId === attemptId))
          fail("RECONCILIATION_ALREADY_RECORDED");
        if (document.attempts.length >= policy.maxPaidRequests) fail("REQUEST_LIMIT_REACHED");
        const candidate = structuredClone(document),
          now = new Date().toISOString();
        candidate.updatedAt = now;
        candidate.reconciliations.push({
          attemptId,
          kind: "HTTP_400_REQUEST_REJECTION",
          reason,
          safeAuthorizationRef: authorizationRef,
          createdAt: now,
        });
        await persist(candidate);
      });
    },
    snapshot() {
      const reservedUsd = document.attempts.reduce((sum, attempt) => sum + attempt.reservedUsd, 0);
      return structuredClone({
        ...document,
        reservedUsd,
        unreservedAuthorizedUsd: policy.budgetUsd - reservedUsd,
        remainingRequestSlots: policy.maxPaidRequests - document.attempts.length,
        blockedReason: poisoned ? "LEDGER_IO_UNCERTAIN" : blocked(document),
      });
    },
    close() {
      if (closePromise) return closePromise;
      closing = true;
      closePromise = serialize(async () => {
        if (!closed) await release();
      });
      return closePromise;
    },
  };
  return result;
}
