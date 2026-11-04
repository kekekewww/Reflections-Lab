import { AgentError } from "./types.js";
import type { AgentPlan, PlannerContext } from "./types.js";
import { assertBoundedJson } from "./validation.js";
import type { SoundHostState } from "./sound-host.js";
import type { SoundAgentPlan, SoundPlannerOptions } from "./sound-plan.js";

/** True only in the hosted build, where the visitor's tab calls Meta with their own key. */
export const BROWSER_AGENT_BUILD = typeof __BROWSER_AGENT__ !== "undefined" && __BROWSER_AGENT__;
const siteAgent = async () => (await import("./browser-agent.js")).browserAgent();

export interface AgentProviderStatus {
  offline: {
    state: "AVAILABLE";
    provenance: "OFFLINE_DETERMINISTIC";
    modelId: null;
    cloudCostUsd: 0;
  };
  meta: {
    provider: "metaModelApi";
    state: "BLOCKED" | "READY";
    reason: string;
    modelId: string | null;
    remainingQuota: null;
    liveValidation: "NOT_RUN";
    estimatedCostCeilingUsd: number;
  };
}

async function readResponse<T>(response: Response): Promise<T> {
  let value: unknown;
  try {
    value = await response.json();
  } catch {
    throw new AgentError("PROVIDER_REQUEST_FAILED", "本機API未回傳完整JSON；尚未接受提案。");
  }
  assertBoundedJson(value, 256 * 1024);
  if (!response.ok) {
    const error =
      value &&
      typeof value === "object" &&
      "error" in value &&
      value.error &&
      typeof value.error === "object"
        ? (value.error as Record<string, unknown>)
        : {};
    throw new AgentError(
      typeof error.code === "string" ? error.code : "PROVIDER_REQUEST_FAILED",
      typeof error.message === "string" ? error.message : "Planner暫時不可用，手動操作仍可使用。",
    );
  }
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new AgentError("SCHEMA_INVALID", "本機API回傳格式無效；尚未接受提案或provider狀態。");
  return value as T;
}

/** Server status is a capability gate, never proof that a live model call has run. */
export async function getProviderStatus(signal?: AbortSignal): Promise<AgentProviderStatus> {
  if (BROWSER_AGENT_BUILD) return (await siteAgent()).status();
  const value = await readResponse<AgentProviderStatus>(
    await fetch("/api/agent/status", {
      credentials: "same-origin",
      ...(signal ? { signal } : {}),
    }),
  );
  if (
    value.offline?.state !== "AVAILABLE" ||
    value.offline.provenance !== "OFFLINE_DETERMINISTIC" ||
    value.offline.modelId !== null ||
    value.offline.cloudCostUsd !== 0 ||
    value.meta?.provider !== "metaModelApi" ||
    !["BLOCKED", "READY"].includes(value.meta.state) ||
    typeof value.meta.reason !== "string" ||
    !value.meta.reason ||
    (value.meta.modelId !== null && typeof value.meta.modelId !== "string") ||
    value.meta.remainingQuota !== null ||
    value.meta.liveValidation !== "NOT_RUN" ||
    !Number.isFinite(value.meta.estimatedCostCeilingUsd) ||
    value.meta.estimatedCostCeilingUsd < 0
  )
    throw new AgentError("SCHEMA_INVALID", "Provider狀態格式不符；尚無可用的live能力證據。");
  return structuredClone(value);
}

/** Sound has its own five-operation contract; it never enters the original Scene tool enum. */
export async function requestSoundAgentPlan(
  prompt: string,
  state: SoundHostState,
  options: SoundPlannerOptions = {},
  signal?: AbortSignal,
  requestId = `request.${globalThis.crypto.randomUUID()}`,
): Promise<SoundAgentPlan> {
  if (BROWSER_AGENT_BUILD)
    return (await siteAgent()).proposeSound(prompt, state, options, signal, requestId);
  return readResponse<SoundAgentPlan>(
    await fetch("/api/agent/propose-sound", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", "X-Reflection-Request-ID": requestId },
      body: JSON.stringify({ prompt, state, options, mode: "meta" }),
      ...(signal ? { signal } : {}),
    }),
  );
}

/** Calls only the same-origin local API; client configuration cannot set billing or credentials. */
export async function requestAgentPlan(
  prompt: string,
  context: PlannerContext,
  mode: "offline" | "meta" = "offline",
  signal?: AbortSignal,
  requestId = `request.${globalThis.crypto.randomUUID()}`,
): Promise<AgentPlan> {
  if (BROWSER_AGENT_BUILD)
    return (await siteAgent()).propose(prompt, context, mode, signal, requestId);
  const response = await fetch("/api/agent/propose", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Reflection-Request-ID": requestId },
    body: JSON.stringify({ prompt, context, mode }),
    ...(signal ? { signal } : {}),
  });
  return readResponse<AgentPlan>(response);
}

/** Cancellation requests stop dispatch; they do not assert a refund or a known transport outcome. */
export async function cancelAgentRequest(requestId: string): Promise<{
  requestId: string;
  state: "cancelRequested" | "completed" | "failed";
  outcomeConfirmed: boolean;
}> {
  if (BROWSER_AGENT_BUILD) return (await siteAgent()).cancel(requestId);
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/.test(requestId))
    throw new AgentError("SCHEMA_INVALID", "Planner requestId格式無效。");
  return readResponse(
    await fetch("/api/agent/cancel", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestId }),
    }),
  );
}
