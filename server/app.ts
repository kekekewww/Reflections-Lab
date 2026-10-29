import { createServer } from "node:http";
import type { IncomingMessage, Server, ServerResponse } from "node:http";
import { AgentError } from "../src/ai/types.js";
import type { PlannerContext } from "../src/ai/types.js";
import { OfflinePlanner } from "../src/ai/offline-planner.js";
import { assertBoundedJson } from "../src/ai/validation.js";
import { validateScene } from "../src/scene/index.js";
import { DEFAULT_META_CONFIG, MetaProvider } from "./meta-provider.js";
import type { MetaProviderConfig } from "./meta-provider.js";
import { validateSoundPlannerInput } from "../src/ai/sound-plan.js";
import type { SoundPlannerInput } from "../src/ai/sound-plan.js";

export interface AgentServerOptions {
  metaConfig?: MetaProviderConfig;
  allowedOrigins?: string[];
  maxBodyBytes?: number;
  provider?: MetaProvider;
}
const LOCAL_ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
  "http://localhost:8787",
  "http://127.0.0.1:8787",
];
function json(response: ServerResponse, status: number, value: unknown): void {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(JSON.stringify(value));
}
async function readBody(request: IncomingMessage, maxBytes: number): Promise<unknown> {
  if (!request.headers["content-type"]?.startsWith("application/json"))
    throw new AgentError("SCHEMA_INVALID", "只接受application/json。");
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    bytes += buffer.length;
    if (bytes > maxBytes) throw new AgentError("INPUT_LIMIT", "請求超出大小上限。");
    chunks.push(buffer);
  }
  let value: unknown;
  try {
    value = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new AgentError("SCHEMA_INVALID", "請求不是完整JSON。");
  }
  assertBoundedJson(value, maxBytes);
  return value;
}
function plannerInput(value: unknown): {
  mode: "offline" | "meta";
  prompt: string;
  context: PlannerContext;
} {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new AgentError("SCHEMA_INVALID", "請求必須是object。");
  const record = value as Record<string, unknown>;
  if (
    Object.keys(record).some((key) => !["mode", "prompt", "context"].includes(key)) ||
    typeof record.prompt !== "string" ||
    !record.prompt.trim() ||
    record.prompt.length > 4000 ||
    (record.mode !== undefined && record.mode !== "offline" && record.mode !== "meta")
  )
    throw new AgentError("SCHEMA_INVALID", "Planner欄位不合法；不能從請求設定provider或預算。");
  const context = record.context as PlannerContext;
  if (
    !context ||
    typeof context !== "object" ||
    !Array.isArray(context.materials) ||
    !Array.isArray(context.signals) ||
    !Number.isSafeInteger(context.materialRegistryRevision)
  )
    throw new AgentError("SCHEMA_INVALID", "缺少可信registry context。");
  validateScene(context.scene);
  for (const entries of [context.materials, context.signals]) {
    if (
      entries.length > 256 ||
      entries.some(
        (entry) =>
          !entry ||
          typeof entry.id !== "string" ||
          !/^[a-z][a-z0-9._-]{0,63}$/.test(entry.id) ||
          typeof entry.label !== "string" ||
          entry.label.length > 160,
      )
    )
      throw new AgentError("SCHEMA_INVALID", "Registry內容不合法。");
  }
  return { mode: record.mode === "meta" ? "meta" : "offline", prompt: record.prompt, context };
}
function soundPlannerInput(value: unknown): SoundPlannerInput & { prompt: string } {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new AgentError("SCHEMA_INVALID", "Sound請求必須是object。");
  const record = value as Record<string, unknown>;
  if (
    Object.keys(record).some((key) => !["mode", "prompt", "state", "options"].includes(key)) ||
    record.mode !== "meta" ||
    typeof record.prompt !== "string" ||
    !record.prompt.trim() ||
    record.prompt.length > 4000
  )
    throw new AgentError(
      "SCHEMA_INVALID",
      "Sound planner欄位不合法；此入口不接受provider、預算或授權設定。",
    );
  return {
    prompt: record.prompt,
    ...validateSoundPlannerInput({
      state: record.state,
      ...(record.options === undefined ? {} : { options: record.options }),
    }),
  };
}
/** Node-only local endpoint. It cannot apply scene changes or expose credentials. */
export function createAgentServer(options: AgentServerOptions = {}): Server {
  const provider = options.provider ?? new MetaProvider(options.metaConfig ?? DEFAULT_META_CONFIG);
  const offline = new OfflinePlanner();
  const origins = new Set(options.allowedOrigins ?? LOCAL_ORIGINS);
  const maxBytes = options.maxBodyBytes ?? 256 * 1024;
  let active = 0;
  return createServer((request, response) => {
    void (async () => {
      const origin = request.headers.origin;
      const host = request.headers.host ?? "";
      if (
        !/^(localhost|127\.0\.0\.1)(?::\d{1,5})?$/.test(host) ||
        (origin && !origins.has(origin))
      ) {
        json(response, 403, {
          error: { code: "POLICY_DENIED", message: "只接受授權的本機介面。" },
        });
        return;
      }
      const path = new URL(request.url ?? "/", "http://127.0.0.1").pathname;
      if (request.method === "GET" && path === "/api/agent/status") {
        json(response, 200, {
          offline: {
            state: "AVAILABLE",
            provenance: "OFFLINE_DETERMINISTIC",
            modelId: null,
            cloudCostUsd: 0,
          },
          meta: provider.status(),
        });
        return;
      }
      if (
        request.method !== "POST" ||
        !["/api/agent/propose", "/api/agent/propose-sound"].includes(path)
      ) {
        json(response, 404, { error: { code: "UNKNOWN_ROUTE", message: "找不到此API。" } });
        return;
      }
      if (active >= 1) throw new AgentError("TRANSACTION_BUSY", "已有一個Planner請求進行中。");
      active++;
      try {
        const value = await readBody(request, maxBytes);
        let plan;
        if (path === "/api/agent/propose-sound") {
          const input = soundPlannerInput(value);
          plan = await provider.planSound(input.prompt, input.state, input.options);
        } else {
          const input = plannerInput(value);
          plan =
            input.mode === "meta"
              ? await provider.plan(input.prompt, input.context)
              : offline.plan(input.prompt, input.context);
        }
        json(response, 200, plan);
      } finally {
        active--;
      }
    })().catch((error) => {
      const known = error instanceof AgentError;
      const code = known ? error.code : "SCHEMA_INVALID";
      json(
        response,
        code === "INPUT_LIMIT"
          ? 413
          : code === "PROVIDER_UNVERIFIED"
            ? 503
            : code === "TRANSACTION_BUSY"
              ? 409
              : 400,
        {
          error: {
            code,
            message: known ? error.message : "請求無效；未執行場景變更。",
            retryable: known ? error.retryable : false,
            fieldPaths: known ? error.fieldPaths : [],
          },
        },
      );
    });
  });
}
