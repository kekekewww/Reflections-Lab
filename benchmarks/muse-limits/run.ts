import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { MetaProvider, DEFAULT_META_CONFIG } from "../../server/meta-provider.js";
import type { MetaBuildRound, MetaProviderConfig } from "../../server/meta-provider.js";
import { openMetaBudgetLedger } from "../../server/meta-budget-ledger.js";
import type { MetaBudgetPolicy } from "../../server/meta-budget-ledger.js";
import { loadMetaApiKey } from "../../server/meta-key-loader.js";
import { LabRuntime } from "../../src/app/runtime.js";
import { DEFAULT_MATERIALS } from "../../src/app/defaults.js";
import { AgentError } from "../../src/ai/types.js";
import type { AgentPreview, PlannerContext, ToolRequest } from "../../src/ai/types.js";
import type { AgentHost } from "../../src/ai/host.js";
import type { SceneSpec } from "../../src/scene/types.js";
import { LADDER } from "./ladder.js";
import type { LimitsCase } from "./ladder.js";
import { scoreScene } from "./score.js";

type Effort = "minimal" | "low" | "medium" | "high" | "xhigh";
interface Settings {
  keyFile?: string;
  cases: LimitsCase[];
  efforts: Effort[];
  repeat: number;
  maxCompletionTokens: number;
  maxRounds: number;
  stopAtUsd: number;
  out: string;
  dryRun: boolean;
}
export function parseArgs(args: string[]): Settings {
  const values = new Map<string, string>();
  let dryRun = false;
  const flags = [
    "--key-file",
    "--cases",
    "--effort",
    "--repeat",
    "--max-completion-tokens",
    "--max-rounds",
    "--stop-at-usd",
    "--out",
  ];
  for (let i = 0; i < args.length; i++) {
    const flag = args[i]!;
    if (flag === "--dry-run" && !dryRun) {
      dryRun = true;
      continue;
    }
    if (!flags.includes(flag) || values.has(flag) || !args[i + 1] || args[i + 1]!.startsWith("--"))
      throw new Error("Invalid or repeated bench argument.");
    values.set(flag, args[++i]!);
  }
  const number = (flag: string, fallback: number, min: number, max: number, integer = true) => {
    const n = values.has(flag) ? Number(values.get(flag)) : fallback;
    if (!Number.isFinite(n) || n < min || n > max || (integer && !Number.isSafeInteger(n)))
      throw new Error("Bench numeric argument is outside its limits.");
    return n;
  };
  if (!values.has("--stop-at-usd")) throw new Error("--stop-at-usd is required.");
  if (!dryRun && !values.get("--key-file")?.trim())
    throw new Error("--key-file is required for a live bench.");
  const ids = (values.get("--cases") ?? LADDER.map((c) => c.id).join(",")).split(",");
  const efforts = (values.get("--effort") ?? "minimal,medium,high").split(",");
  if (
    new Set(ids).size !== ids.length ||
    ids.some((id) => !LADDER.some((c) => c.id === id)) ||
    new Set(efforts).size !== efforts.length ||
    efforts.some((e) => !["minimal", "low", "medium", "high", "xhigh"].includes(e))
  )
    throw new Error("Unknown or duplicate case/effort.");
  return {
    cases: ids.map((id) => LADDER.find((c) => c.id === id)!),
    efforts: efforts as Effort[],
    dryRun,
    ...(values.has("--key-file") ? { keyFile: values.get("--key-file")! } : {}),
    repeat: number("--repeat", 1, 1, 200),
    maxCompletionTokens: number("--max-completion-tokens", 16000, 1, 16000),
    maxRounds: number("--max-rounds", 3, 1, 4),
    stopAtUsd: number("--stop-at-usd", NaN, Number.MIN_VALUE, 5, false),
    out: resolve(values.get("--out") ?? join(".cache", `muse-limits-${Date.now()}`)),
  };
}

const authorizationId = "artifact.meta-limits-20261104";
const pricingSource = "https://dev.meta.ai/docs/pricing-rate-limits";
/** Deliberately independent of completion tokens, effort and rounds: these are not policy pins. */
const policy: MetaBudgetPolicy = {
  authorizationId,
  modelId: "muse-spark-1.3",
  dataMode: "standard",
  budgetUsd: 5,
  maxRequests: 200,
  maxAttemptsPerRequest: 1,
  inputUsdPerMillionTokens: 1.25,
  outputUsdPerMillionTokens: 4.25,
  pricingSource,
};
const offlineProvenance = {
  provider: "offlineDeterministic",
  modelId: null,
  requestId: null,
  label: "OFFLINE_DETERMINISTIC",
} as const;

/** Synthetic fixtures exercise the real validator; these are never evidence of Muse quality. */
function dryRunFetch(): typeof globalThis.fetch {
  let sequence = 0;
  return async (_url, init) => {
    const input = JSON.parse(String(init!.body));
    const user = JSON.parse(input.messages[1].content) as {
      goal: string;
      scene: PlannerContext["scene"];
    };
    const scene = user.scene;
    const entry = LADDER.find((c) => c.prompt === user.goal || c.followUp?.prompt === user.goal)!;
    const followingUp = entry.followUp?.prompt === user.goal;
    const tool = (name: string, args: unknown) => ({
      id: `call.fixture-${sequence++}`,
      type: "function",
      function: { name, arguments: JSON.stringify(args) },
    });
    const ball = scene.objects.find((o) => o.id === "ball")!;
    const sample = (timeS: number, positionM: number[]) => ({
      timeS,
      positionM,
      orientationQuaternion: [0, 0, 0, 1],
    });
    const path = (id: string, samples: unknown[]) =>
      tool("SetTrajectory", { objectId: id, interpolation: "linearSlerp", samples });
    const orbit = Array.from({ length: 33 }, (_, i) =>
      sample(i / 4, [
        scene.listener.positionM[0] + 2 * Math.cos((2 * Math.PI * i) / 32),
        ball.positionM[1],
        scene.listener.positionM[2] + 2 * Math.sin((2 * Math.PI * i) / 32),
      ]),
    );
    const add = (i: number, mode = "fixed") =>
      tool("AddObject", {
        objectId: `fixture.object-${i}`,
        label: "Synthetic fixture",
        shape: "box",
        dimensionsM: [0.2, 0.2, 0.2],
        positionM: [-2 + (i % 5) * 0.8, 0.1, -3 + Math.floor(i / 5)],
        orientationQuaternion: [0, 0, 0, 1],
        materialId: "material.metal",
        mode,
        massKg: 1,
      });
    let calls;
    // First response fails in MotionWorkspace, not merely at JSON/schema parsing.
    if (input.messages.length === 2)
      calls = [path("ball", [sample(0, ball.positionM), sample(1, ball.positionM)])];
    else if (entry.id === "ball-orbit")
      calls = [
        tool("MoveObject", {
          objectId: "ball",
          positionM: orbit[0]!.positionM,
          orientationQuaternion: [0, 0, 0, 1],
        }),
        tool("SetRigidBodyMode", { objectId: "ball", mode: "kinematic", velocityPolicy: "zero" }),
        path("ball", orbit),
      ];
    else if (followingUp)
      calls = [
        tool("MoveObject", {
          objectId: "fixture.object-1",
          positionM: [-1.2, 0.1, 1],
          orientationQuaternion: [0, 0, 0, 1],
        }),
        tool("ResizeObject", { objectId: "fixture.object-2", dimensionsM: [0.3, 0.2, 0.3] }),
        tool("RemoveObject", { objectId: "fixture.object-0" }),
      ];
    else if (entry.id === "edit-speaker")
      calls = [
        tool("MoveObject", {
          objectId: "speaker",
          positionM: [-2.7, 0.7, -3.7],
          orientationQuaternion: [0, 0, 0, 1],
        }),
        tool("ResizeObject", { objectId: "speaker", dimensionsM: [0.45, 1.4, 0.35] }),
        tool("RemoveObject", { objectId: "ball" }),
      ];
    else if (entry.id === "two-paths-sound")
      calls = [
        add(0, "kinematic"),
        tool("ConfigureSoundSource", {
          sourceId: "source.fixture",
          objectId: "fixture.object-0",
          signalId: "signal.tone-220",
          mode: "continuous",
          gainDbfs: -24,
          referenceFrequencyHz: 220,
        }),
        path("fixture.object-0", [sample(0, [-2, 0.1, -3]), sample(12, [-1, 0.1, -3])]),
        tool("SetRigidBodyMode", { objectId: "ball", mode: "kinematic", velocityPolicy: "zero" }),
        path("ball", [sample(0, ball.positionM), sample(12, [-2.5, 2, 0])]),
      ];
    else if (entry.id === "new-hall")
      calls = [
        tool("CreateScene", {
          label: "Synthetic hall",
          roomDimensionsM: [14, 9, 24],
          surfaceMaterialId: "material.wood",
          seed: 1746,
        }),
      ];
    else {
      const count = entry.id === "over-limit" ? 32 : (entry.expect.minAddedObjects ?? 1);
      calls = Array.from({ length: count }, (_, i) => add(i));
      if (entry.id === "treatment")
        calls.push(
          tool("SetMaterial", {
            objectId: "wall.back",
            materialId: "material.soft",
            materialRegistryRevision: 1,
            scope: "both",
          }),
          tool("MoveListener", {
            listenerId: scene.listener.id,
            positionM: [0, 1.6, 0],
            orientationQuaternion: [0, 0, 0, 1],
          }),
        );
    }
    return new Response(
      JSON.stringify({
        id: `response.fixture-${sequence++}`,
        model: "muse-spark-1.3",
        choices: [
          {
            finish_reason: "tool_calls",
            message: {
              role: "assistant",
              content:
                entry.id === "over-limit"
                  ? "Synthetic fixture: capped at 32; 8 chairs omitted."
                  : "Synthetic offline fixture.",
              tool_calls: calls,
            },
          },
        ],
        usage: {
          prompt_tokens: 200,
          completion_tokens: 100,
          completion_tokens_details: { reasoning_tokens: 25 },
          prompt_tokens_details: { cached_tokens: 0 },
        },
      }),
    );
  };
}

function errorRecord(error: unknown) {
  return {
    code:
      error && typeof error === "object" && "code" in error ? String(error.code) : "BENCH_ERROR",
    message: error instanceof Error ? error.message : "Unknown bench error.",
  };
}
interface StageResult {
  before: SceneSpec;
  rounds: MetaBuildRound[];
  finalRequests: ToolRequest[];
  preview?: AgentPreview;
  accepted: boolean;
  stopReason: string;
  apply: OperationResult;
  pathStarts: {
    objectId: string;
    started: boolean;
    error: ReturnType<typeof errorRecord> | null;
  }[];
}
/** A path that can't start is no use to the person, however good it looks in the preview. */
async function startPaths(app: LabRuntime, requests: ToolRequest[]) {
  const results: StageResult["pathStarts"] = [];
  for (const request of requests) {
    if (request.tool !== "SetTrajectory") continue;
    const objectId = request.arguments.objectId as string;
    try {
      const receipt = await app
        .getMotionWorkspace()
        .start(`trajectory.${objectId}`, `command.bench-${randomUUID()}`);
      app.getMotionWorkspace().cancel(receipt.runId);
      results.push({ objectId, started: true, error: null });
    } catch (error) {
      results.push({ objectId, started: false, error: errorRecord(error) });
    }
  }
  return results;
}
interface Row {
  caseId: string;
  effort: Effort;
  repeat: number;
  accepted: boolean;
  stopReason: string;
  rounds: number;
  calls: number;
  estimatedCostUsd: number | null;
  apply: boolean;
  undo: boolean;
  pathsStarted: number;
  pathsTotal: number;
  followUpAccepted: boolean | null;
  errorCode: string | null;
}
interface OperationResult {
  worked: boolean;
  error: ReturnType<typeof errorRecord> | null;
}

export function stopsRun(code: string): boolean {
  return (
    [
      "STOP_AT_USD",
      "BUDGET_EXCEEDED",
      "AUTHENTICATION_ERROR",
      "PERMISSION_DENIED",
      "QUOTA_EXCEEDED",
      "INVALID_SETTLEMENT",
      "INVALID_RESPONSE",
      "FAILURE_CODE_INVALID",
    ].includes(code) ||
    /^(?:LEDGER_|REQUEST_|ATTEMPT_|LOCK_|RESERVATION_|RESPONSE_IDENTITY)/.test(code)
  );
}

export async function main(
  args: string[],
  dependencies: { print?: (line: string) => void; fetch?: typeof globalThis.fetch } = {},
) {
  const settings = parseArgs(args);
  // This branch is never evaluated for dry runs: no key file or process env is read.
  const key = settings.dryRun
    ? null
    : (await loadMetaApiKey({ keyFile: settings.keyFile! })).apiKey;
  if (!settings.dryRun && !key) throw new Error("No Meta key configured.");
  const credentialFree = (text: string) =>
    assert.ok(!key || !text.includes(key), "Bench output contains a credential; refused to write.");
  const print = (line: string) => {
    credentialFree(line);
    (dependencies.print ?? console.log)(line);
  };
  const write = async (path: string, value: unknown) => {
    const serialized = JSON.stringify(value, null, 2) + "\n";
    credentialFree(serialized);
    await writeFile(path, serialized, { encoding: "utf8", flag: "wx" });
  };
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
  const proof = JSON.parse(
    await readFile(join(root, "research/v1/meta-catalog-20261104-demo.json"), "utf8"),
  );
  if (typeof proof.checkedAt !== "string" || !Number.isFinite(Date.parse(proof.checkedAt)))
    throw new Error("Invalid catalog verification time.");
  const ledgerPath = settings.dryRun
    ? join(await mkdtemp(join(tmpdir(), "muse-limits-ledger-")), "ledger.json")
    : join(root, "research/v1/meta-live-budget-20261104-limits.json");
  await mkdir(settings.out, { recursive: true });
  const ledger = await openMetaBudgetLedger(ledgerPath, policy);
  const limitedBudget = {
    ...ledger,
    async begin(id: string, fingerprint: string) {
      if (ledger.snapshot().reservedUsd >= settings.stopAtUsd)
        throw new AgentError("STOP_AT_USD", "The requested bench stop threshold has been reached.");
      return ledger.begin(id, fingerprint);
    },
    async reserve(id: string, attempt: string, usd: number) {
      if (
        Math.ceil(usd * 1e9) + Math.round(ledger.snapshot().reservedUsd * 1e9) >
        Math.floor(settings.stopAtUsd * 1e9)
      )
        throw new AgentError("BUDGET_EXCEEDED", "The next reservation would exceed --stop-at-usd.");
      return ledger.reserve(id, attempt, usd);
    },
  };
  const providers = new Map(
    settings.efforts.map((effort) => {
      const config: MetaProviderConfig = {
        ...DEFAULT_META_CONFIG,
        apiKey: key ?? "offline-fixture",
        networkEnabled: true,
        modelId: policy.modelId,
        verificationStatus: "verified",
        verifiedAt: proof.checkedAt,
        verificationArtifactId: authorizationId,
        maxEstimatedCostUsd: 5,
        maxRequests: 200,
        inputUsdPerMillionTokens: 1.25,
        outputUsdPerMillionTokens: 4.25,
        pricingSource,
        maxRetries: 0,
        timeoutMs: 120000,
        parallelToolCalls: true,
        maxInputBytes: 128000,
        maxCompletionTokens: settings.maxCompletionTokens,
        reasoningEffort: effort,
      };
      return [
        effort,
        new MetaProvider(config, {
          budget: limitedBudget,
          ...(settings.dryRun ? { fetch: dependencies.fetch ?? dryRunFetch() } : {}),
        }),
      ] as const;
    }),
  );
  const rows: Row[] = [];
  let stoppedReason: string | null = null;
  try {
    runs: for (const entry of settings.cases)
      for (const effort of settings.efforts)
        for (let n = 1; n <= settings.repeat; n++) {
          if (
            ledger.snapshot().blockedReason ||
            ledger.snapshot().reservedUsd >= settings.stopAtUsd
          ) {
            stoppedReason = ledger.snapshot().blockedReason ?? "STOP_AT_USD";
            break runs;
          }
          const app = await LabRuntime.create({ useWorker: false });
          const outcome: { failure: ReturnType<typeof errorRecord> | null } = { failure: null };
          const undo: OperationResult = { worked: false, error: null };
          const host = (app.getAgentSession() as unknown as { sceneHost: AgentHost }).sceneHost;
          const runStage = async (prompt: string): Promise<StageResult> => {
            const stage: StageResult = {
              before: app.getSceneDocument(),
              rounds: [],
              finalRequests: [],
              accepted: false,
              stopReason: "error",
              apply: { worked: false, error: null },
              pathStarts: [],
            };
            try {
              const context: PlannerContext = {
                scene: stage.before,
                materials: DEFAULT_MATERIALS.map(({ id, label }) => ({ id, label })),
                signals: [{ id: "signal.tone-220", label: "220 Hz sine", frequencyHz: 220 }],
                materialRegistryRevision: 1,
              };
              const result = await providers.get(effort)!.planBuild(prompt, context, {
                requestId: `bench.${randomUUID()}`,
                maxRounds: settings.maxRounds,
                validate: async (requests) => {
                  stage.finalRequests = requests;
                  try {
                    stage.preview = await host.stage(
                      requests,
                      settings.dryRun
                        ? offlineProvenance
                        : {
                            provider: "metaModelApi",
                            modelId: policy.modelId,
                            requestId: null,
                            label: "META_LIVE",
                          },
                    );
                    return [];
                  } catch (error) {
                    const { code, message } = errorRecord(error);
                    return [{ callIndex: null, tool: null, code, message }];
                  }
                },
              });
              stage.rounds = result.rounds;
              stage.accepted = result.accepted;
              stage.stopReason = result.stopReason;
              const fatalValidation = stage.rounds
                .flatMap((round) => round.failures)
                .find((item) => stopsRun(item.code));
              if (fatalValidation)
                outcome.failure = { code: fatalValidation.code, message: fatalValidation.message };
              const lastRound = stage.rounds.at(-1);
              const finalSchemaChecked =
                lastRound?.finishReason === "tool_calls" &&
                lastRound.calls <= 32 &&
                lastRound.failures.every((item) => item.callIndex === null);
              stage.finalRequests =
                result.plan?.requests ?? (finalSchemaChecked ? stage.finalRequests : []);
              if (stage.accepted && stage.preview) {
                // The bench explicitly approves only its isolated Node runtime, never the product session.
                try {
                  await host.apply(stage.preview.previewId, stage.preview.digest);
                  stage.apply.worked = true;
                  stage.pathStarts = await startPaths(app, stage.finalRequests);
                } catch (error) {
                  stage.apply.error = errorRecord(error);
                }
              }
            } catch (error) {
              outcome.failure = errorRecord(error);
              if (error && typeof error === "object" && "rounds" in error)
                stage.rounds = error.rounds as MetaBuildRound[];
            }
            return stage;
          };
          let first!: StageResult;
          let second: StageResult | null = null;
          try {
            first = await runStage(entry.prompt);
            if (entry.followUp && first.apply.worked && !outcome.failure)
              second = await runStage(entry.followUp.prompt);
            // Newest first: Undo refuses to overwrite a later edit.
            const applied = [second, first].filter((stage) => stage?.apply.worked) as StageResult[];
            undo.worked = applied.length > 0;
            for (const stage of applied)
              try {
                await host.undo(stage.preview!.previewId);
              } catch (error) {
                undo.worked = false;
                undo.error = errorRecord(error);
                break;
              }
          } finally {
            app.dispose();
          }
          const { before, rounds, finalRequests, preview, accepted, stopReason, apply } = first;
          const failure = outcome.failure;
          const allRounds = [...rounds, ...(second?.rounds ?? [])];
          const allStarts = [...first.pathStarts, ...(second?.pathStarts ?? [])];
          const knownCost = allRounds.reduce(
            (sum, r) =>
              sum +
              (r.usage ? (r.usage.promptTokens * 1.25 + r.usage.completionTokens * 4.25) / 1e6 : 0),
            0,
          );
          const estimatedCostUsd =
            allRounds.length && allRounds.every((r) => r.usage !== null) ? knownCost : null;
          const row: Row = {
            caseId: entry.id,
            effort,
            repeat: n,
            accepted,
            stopReason,
            rounds: rounds.length,
            calls: finalRequests.length,
            estimatedCostUsd,
            apply: apply.worked,
            undo: undo.worked,
            pathsStarted: allStarts.filter((item) => item.started).length,
            pathsTotal: allStarts.length,
            followUpAccepted: second ? second.accepted : null,
            errorCode: failure?.code ?? null,
          };
          await write(join(settings.out, `${entry.id}-${effort}-${n}.json`), {
            offlineFixture: settings.dryRun,
            prompt: entry.prompt,
            expect: entry.expect,
            settings: {
              modelId: policy.modelId,
              authorizationId,
              effort,
              maxCompletionTokens: settings.maxCompletionTokens,
              maxRounds: settings.maxRounds,
              stopAtUsd: settings.stopAtUsd,
              parallelToolCalls: true,
              maxInputBytes: 128000,
            },
            rounds,
            stopReason,
            accepted,
            finalRequests,
            beforeScene: before,
            candidateScene: preview?.candidate ?? null,
            score: preview
              ? scoreScene(before, preview.candidate, finalRequests, entry.expect)
              : null,
            apply,
            pathStarts: first.pathStarts,
            followUp:
              second && entry.followUp
                ? {
                    prompt: entry.followUp.prompt,
                    expect: entry.followUp.expect,
                    rounds: second.rounds,
                    stopReason: second.stopReason,
                    accepted: second.accepted,
                    finalRequests: second.finalRequests,
                    candidateScene: second.preview?.candidate ?? null,
                    score: second.preview
                      ? scoreScene(
                          second.before,
                          second.preview.candidate,
                          second.finalRequests,
                          entry.followUp.expect,
                        )
                      : null,
                    apply: second.apply,
                    pathStarts: second.pathStarts,
                  }
                : null,
            undo,
            error: failure,
            estimatedCost: {
              label: "Estimated at list price; not actual billing",
              usd: estimatedCostUsd,
              knownUsageUsd: knownCost,
              roundsWithUsage: allRounds.filter((r) => r.usage).length,
              coverage:
                "Reported usage in finished planner rounds only; failed or uncertain attempts may consume additional reservations.",
              inputUsdPerMillionTokens: 1.25,
              outputUsdPerMillionTokens: 4.25,
              pricingSource,
            },
          });
          rows.push(row);
          print(
            `${entry.id} ${effort} #${n}: ${failure?.code ?? stopReason}, ${rounds.length} rounds, ${finalRequests.length} calls, estimate $${estimatedCostUsd?.toFixed(6) ?? "unknown"}`,
          );
          const code = failure?.code;
          if (code && stopsRun(code)) {
            stoppedReason = code;
            break runs;
          }
        }
    const summary = {
      offlineFixture: settings.dryRun,
      ledgerPath,
      rows,
      stoppedReason,
      totals: {
        runs: rows.length,
        plannedRuns: settings.cases.length * settings.efforts.length * settings.repeat,
        accepted: rows.filter((r) => r.accepted).length,
        applied: rows.filter((r) => r.apply).length,
        undone: rows.filter((r) => r.undo).length,
        rounds: rows.reduce((s, r) => s + r.rounds, 0),
        estimatedCostUsd: rows.reduce((s, r) => s + (r.estimatedCostUsd ?? 0), 0),
        runsWithUnknownCost: rows.filter((r) => r.estimatedCostUsd === null).length,
        consumedUsd: ledger.snapshot().reservedUsd,
        actualBillingCostUsd: null,
      },
    };
    await write(join(settings.out, "summary.json"), summary);
    print(
      `Finished ${summary.totals.runs}/${summary.totals.plannedRuns} runs; consumed $${summary.totals.consumedUsd.toFixed(6)}; ${stoppedReason ?? "complete"}.`,
    );
    return summary;
  } finally {
    await ledger.close();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch(() => {
    // No raw error or stack here: setup/I/O failures may contain sensitive paths or content.
    console.error(
      "Muse limits bench stopped; check arguments and local output. No credential was printed.",
    );
    process.exitCode = 1;
  });
}
