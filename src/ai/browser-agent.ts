import {
  DEFAULT_META_CONFIG,
  MetaProvider,
  getMetaProviderStatus,
} from "../../server/meta-provider.js";
import type { MetaProviderConfig } from "../../server/meta-provider.js";
import { proposeScene } from "../../server/scene-preflight.js";
import { getBrowserKey, subscribeBrowserKey } from "./browser-key.js";
import type { AgentProviderStatus } from "./client.js";
import type { SoundHostState } from "./sound-host.js";
import type { SoundAgentPlan, SoundPlannerOptions } from "./sound-plan.js";
import { AgentError } from "./types.js";
import type { AgentPlan, PlannerContext } from "./types.js";

/**
 * Hosted-site limits. The model and prices were checked on 2026-11-04 with live calls; a visitor's
 * key is only checked by Meta on its first request. The ceilings protect the visitor's own money
 * and restart when a key is entered again or the page reloads.
 */
export const BROWSER_AGENT_CONFIG: Readonly<MetaProviderConfig> = Object.freeze({
  ...DEFAULT_META_CONFIG,
  apiKey: null,
  networkEnabled: true,
  modelId: "muse-spark-1.3",
  verificationStatus: "verified",
  verifiedAt: "2026-11-04T00:00:00.000Z",
  verificationArtifactId: "artifact.visitor-key-20261105",
  maxEstimatedCostUsd: 3,
  inputUsdPerMillionTokens: 1.25,
  outputUsdPerMillionTokens: 4.25,
  pricingSource: "https://dev.meta.ai/docs/pricing-rate-limits",
  // A retry after an unclear failure could charge the visitor twice.
  maxRetries: 0,
  timeoutMs: 120000,
  maxCompletionTokens: 16000,
  maxRequests: 40,
  parallelToolCalls: true,
  maxInputBytes: 128000,
  reasoningEffort: "medium",
});

export interface BrowserAgentOptions {
  getKey: () => string | null;
  fetch?: typeof globalThis.fetch;
  config?: Partial<MetaProviderConfig>;
}
export interface BrowserAgent {
  status(): AgentProviderStatus;
  propose(
    prompt: string,
    context: PlannerContext,
    mode: "offline" | "meta",
    signal?: AbortSignal,
    requestId?: string,
  ): Promise<AgentPlan>;
  proposeSound(
    prompt: string,
    state: SoundHostState,
    options: SoundPlannerOptions,
    signal?: AbortSignal,
    requestId?: string,
  ): Promise<SoundAgentPlan>;
  cancel(requestId: string): Promise<{
    requestId: string;
    state: "cancelRequested";
    outcomeConfirmed: false;
  }>;
}

const newRequestId = () => `request.${globalThis.crypto.randomUUID()}`;
/** What a visitor can act on, in place of the provider's server-oriented wording. */
export const VISITOR_ERROR_MESSAGES: Readonly<Record<string, string>> = Object.freeze({
  AUTHENTICATION_ERROR: "Meta拒絕此金鑰；請檢查後重試，或清除後改用其他金鑰。",
  PERMISSION_DENIED: "此金鑰沒有使用這個模型的權限。",
  QUOTA_EXCEEDED: "此Meta帳號的額度不足。",
  MODEL_UNAVAILABLE: "Meta目前未向此金鑰提供這個模型。",
  RATE_LIMITED: "Meta暫時限制此金鑰的請求；請稍後再試。",
  TIMEOUT: "無法確認Meta是否已回覆；未自動重試以免重複計費。請檢查網路後再試。",
  BUDGET_EXCEEDED: "已達此頁的請求或費用上限；重新載入並再次輸入金鑰後可繼續。",
  CANCELED: "請求已停止；已送出的內容仍可能由Meta計費。",
});

/** The same Muse path as server/app.ts, with the visitor's tab in place of our server. */
export function createBrowserAgent(options: BrowserAgentOptions): BrowserAgent {
  const config: MetaProviderConfig = { ...BROWSER_AGENT_CONFIG, ...options.config };
  // Called bare because browsers reject fetch called as a method of another object.
  const send: typeof globalThis.fetch = (input, init) =>
    (options.fetch ?? globalThis.fetch)(input, {
      ...init,
      credentials: "omit",
      referrerPolicy: "no-referrer",
    });
  let held: { key: string; provider: MetaProvider } | null = null;
  let active: { requestId: string; controller: AbortController } | null = null;

  /** The provider is the only other holder of the key, so it is dropped with the key. */
  function provider(): MetaProvider | null {
    const key = options.getKey();
    if (key === held?.key) return held.provider;
    active?.controller.abort();
    held =
      key === null
        ? null
        : { key, provider: new MetaProvider({ ...config, apiKey: key }, { fetch: send }) };
    return held?.provider ?? null;
  }

  async function run<T>(
    prompt: string,
    signal: AbortSignal | undefined,
    requestId: string,
    perform: (host: MetaProvider, signal: AbortSignal) => Promise<T>,
  ): Promise<T> {
    if (!prompt.trim() || prompt.length > 4000)
      throw new AgentError("SCHEMA_INVALID", "Planner欄位不合法；不能從請求設定provider或預算。");
    const host = provider();
    if (!host) throw new AgentError("KEY_NOT_ENTERED", "尚未輸入Meta API金鑰；未送出請求。");
    if (active) throw new AgentError("TRANSACTION_BUSY", "已有一個Planner請求進行中。");
    const controller = new AbortController();
    const stop = () => controller.abort();
    if (signal?.aborted) stop();
    signal?.addEventListener("abort", stop, { once: true });
    active = { requestId, controller };
    try {
      const result = await perform(host, controller.signal);
      if (controller.signal.aborted)
        throw new AgentError("CANCELED", "Planner請求已取消，未接受提案。");
      return result;
    } catch (error) {
      const message = error instanceof AgentError ? VISITOR_ERROR_MESSAGES[error.code] : undefined;
      if (error instanceof AgentError && message)
        throw new AgentError(error.code, message, error.fieldPaths, error.retryable);
      throw error;
    } finally {
      signal?.removeEventListener("abort", stop);
      active = null;
    }
  }

  return {
    status() {
      const host = provider();
      return {
        offline: {
          state: "AVAILABLE",
          provenance: "OFFLINE_DETERMINISTIC",
          modelId: null,
          cloudCostUsd: 0,
        },
        meta: host
          ? host.status()
          : { ...getMetaProviderStatus(config), reason: "KEY_NOT_ENTERED" },
      };
    },
    propose(prompt, context, mode, signal, requestId = newRequestId()) {
      // Offline tools run in the agent session and never come here.
      if (mode !== "meta")
        return Promise.reject(new AgentError("POLICY_DENIED", "離線工具不經過此入口。"));
      return run(prompt, signal, requestId, (host, stopped) =>
        proposeScene(host, prompt, context, { requestId, signal: stopped }),
      );
    },
    proposeSound(prompt, state, plannerOptions, signal, requestId = newRequestId()) {
      return run(prompt, signal, requestId, (host, stopped) =>
        host.planSound(prompt, state, plannerOptions, { requestId, signal: stopped }),
      );
    },
    cancel(requestId) {
      if (active?.requestId !== requestId)
        return Promise.reject(new AgentError("UNKNOWN_ID", "找不到此本機Planner請求。"));
      active.controller.abort();
      return Promise.resolve({ requestId, state: "cancelRequested", outcomeConfirmed: false });
    },
  };
}

let shared: BrowserAgent | null = null;
/** The one agent the hosted page uses. Forgetting the key drops it and stops any request. */
export function browserAgent(): BrowserAgent {
  if (!shared) {
    const agent = createBrowserAgent({ getKey: getBrowserKey });
    subscribeBrowserKey(() => agent.status());
    shared = agent;
  }
  return shared;
}
