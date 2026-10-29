import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { isAbsolute, relative, resolve } from "node:path";
import { createAgentServer } from "./app.js";
import { DEFAULT_META_CONFIG, META_CHAT_ENDPOINT, MetaProvider } from "./meta-provider.js";
import { loadMetaApiKey, MetaKeyError } from "./meta-key-loader.js";
import { MetaLiveBudgetError, openMetaLiveBudget } from "./meta-live-budget.js";
import { AgentSession } from "../src/app/agent-session.js";
import { AgentError } from "../src/ai/types.js";
import type { ToolRequest } from "../src/ai/types.js";
import {
  DEFAULT_MATERIALS,
  createDefaultBehaviors,
  createDefaultScene,
  makeBehaviorContext,
} from "../src/app/defaults.js";
import { projectSceneSources } from "../src/app/scene-source-behaviors.js";
import { ExperimentToolHost } from "../src/app/experiment-tools.js";
import { PhysicsWorld } from "../src/physics/index.js";
import { SOLVER_VERSION } from "../src/acoustics/index.js";
import { createScene } from "../src/scene/index.js";
import { verifyRecording } from "../src/experiments/index.js";
import type { ExperimentRecorderOptions } from "../src/experiments/types.js";
import type { MetaCatalogProof } from "./meta-catalog.js";
import {
  META_LIVE_SCENE_PROMPT,
  META_LIVE_SIGNALS,
  META_LIVE_SOUND_PROMPT,
  metaLiveRunPrompt,
} from "./meta-live-fixture.js";
import { payloadHash } from "./meta-live-payload-preview.js";
import type { ReviewedMetaPayloads } from "./meta-live-payload-preview.js";
import { sanitizeMetaHttpDiagnostic } from "./meta-http-diagnostic.js";

const MODEL = "muse-spark-1.3";
const PRICE_SOURCE = "https://dev.meta.ai/docs/pricing-rate-limits";
const clone = <T>(value: T): T => structuredClone(value);
type Phase = "sound" | "scene" | "run";
interface ValidationOptions {
  apiKey: string;
  ledgerPath: string;
  outputDirectory: string;
  catalogProof: MetaCatalogProof;
  remoteFetch: typeof fetch;
  reviewedPayloads: ReviewedMetaPayloads;
  validationScope?: "scene-and-sound" | "sound-only";
}
function object(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
function safeId(value: unknown): string | null {
  return typeof value === "string" &&
    /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/.test(value) &&
    !/LLM_/i.test(value)
    ? value
    : null;
}
async function boundedJson(response: Response): Promise<unknown> {
  if (!response.body) throw new AgentError("PROVIDER_REQUEST_FAILED", "回覆沒有body。");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    for (;;) {
      const result = await reader.read();
      if (result.done) break;
      bytes += result.value.byteLength;
      if (bytes > 256 * 1024) throw new AgentError("INPUT_LIMIT", "回覆超出大小限制。");
      chunks.push(result.value);
    }
  } finally {
    void reader.cancel().catch(() => {});
  }
  const all = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) {
    all.set(chunk, offset);
    offset += chunk.length;
  }
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(all));
}

/** Real product HTTP -> Session -> trusted hosts. Only remoteFetch can perform paid transport. */
export async function runMetaLiveValidation(
  options: ValidationOptions,
): Promise<Record<string, unknown>> {
  if (
    options.catalogProof.scope !== "CATALOG_ACCESS_ONLY" ||
    options.catalogProof.status !== "PASSED" ||
    !options.catalogProof.modelIds.includes(MODEL)
  )
    throw new AgentError("PROVIDER_UNVERIFIED", "需要既有的成功catalog證據；不會重新GET目錄。");
  const noSecret = (value: unknown): void => {
    const json = JSON.stringify(value);
    if (json.includes(options.apiKey) || /LLM_/i.test(json))
      throw new AgentError("POLICY_DENIED", "證據含禁止的credential資料，未保存內容。");
  };
  await mkdir(options.outputDirectory, { recursive: false });
  const save = async (name: string, value: unknown): Promise<void> => {
    noSecret(value);
    await writeFile(resolve(options.outputDirectory, name), JSON.stringify(value, null, 2) + "\n", {
      encoding: "utf8",
      flag: "wx",
    });
  };
  const ledger = await openMetaLiveBudget(options.ledgerPath);
  const nativeFetch = globalThis.fetch;
  const trace: Record<string, unknown>[] = [];
  const phaseResults: Record<string, unknown>[] = [];
  const productPlans: Record<string, unknown>[] = [];
  let phase: Phase = "sound";
  let paidRequests = 0;
  let scene = createDefaultScene();
  let document = createDefaultBehaviors(scene);
  let poses = scene.objects.map((entry) => ({ objectId: entry.id, generation: 1 }));
  const initialScene = clone(scene);
  const initialDocument = clone(document);
  const signals = clone(META_LIVE_SIGNALS);
  const configuration = (): ExperimentRecorderOptions => ({
    runId: "run.meta-live-proof",
    runEpoch: "epoch.meta-live-proof",
    sceneSnapshot: clone(scene),
    sourceConfig: clone(scene.sources),
    behaviorConfig: clone(document),
    generatorConfig: document.profiles.map((profile) =>
      profile.rules.map((rule) => rule.generator),
    ),
    solverConfig: { backendId: "custom-web-geometric", maxReflectionOrder: 1, maxPaths: 8 },
    atmosphere: {
      medium: "air",
      speedOfSoundMps: 343,
      temperatureC: 20,
      bandAbsorptionDbPerM: [0, 0, 0, 0, 0, 0, 0],
      dataClass: "Synthetic",
    },
    materialRegistry: clone(DEFAULT_MATERIALS),
    assetManifest: [],
    physicsVersion: "rapier-0.21.0",
    backendId: "custom-web-geometric",
    backendVersion: SOLVER_VERSION,
    fixedDtS: 1 / 60,
    sampleRateHz: 48000,
  });
  const experiment = new ExperimentToolHost({
    getConfiguration: configuration,
    getAssets: () => [],
  });
  const paidFetch: typeof fetch = async (input, init) => {
    const body = object(JSON.parse(String(init?.body)));
    noSecret(body);
    const tools = body.tools as { type: string; function?: { name?: string } }[];
    if (
      String(input) !== META_CHAT_ENDPOINT ||
      init?.method !== "POST" ||
      body.model !== MODEL ||
      body.max_completion_tokens !== 1000 ||
      body.reasoning_effort !== "minimal" ||
      body.stream !== false ||
      body.tool_choice !== "auto" ||
      body.parallel_tool_calls !== false ||
      !Array.isArray(tools) ||
      tools.some((tool) => tool.type !== "function")
    )
      throw new AgentError("POLICY_DENIED", "Live transport超出此次固定模型／請求範圍。");
    const inputBytes = new TextEncoder().encode(String(init?.body)).length;
    if (inputBytes > 32000)
      throw new AgentError("BUDGET_EXCEEDED", "Live請求超出固定輸入大小限制。");
    const reviewed = options.reviewedPayloads[phase];
    const actualPayloadSha256 = payloadHash(String(init?.body));
    if (!reviewed || reviewed.bytes !== inputBytes || reviewed.sha256 !== actualPayloadSha256) {
      const rejected = {
        phase,
        code: "REVIEWED_PAYLOAD_MISMATCH",
        actualPayloadSha256,
        expectedPayloadSha256: reviewed?.sha256 ?? null,
        inputBytes,
        dispatched: false,
      };
      trace.push(rejected);
      await save(`payload-mismatch-${trace.length}.json`, rejected);
      throw new AgentError(
        "POLICY_DENIED",
        "實際payload與已審查的Synthetic preview不符；未保留額度或派送。",
      );
    }
    let attempt: string;
    try {
      attempt = await ledger.reserve(phase, {
        modelId: MODEL,
        maxCompletionTokens: 1000,
        inputBytes,
        payloadSha256: actualPayloadSha256,
        toolNames: tools.map((tool) => String(tool.function?.name)),
      });
    } catch (error) {
      if (error instanceof MetaLiveBudgetError)
        throw new AgentError("BUDGET_EXCEEDED", `Live ledger blocked: ${error.code}`);
      throw error;
    }
    paidRequests++;
    let settled = false;
    try {
      const response = await options.remoteFetch(input, { ...init, redirect: "error" });
      let value: Record<string, unknown> = {};
      let diagnostic = sanitizeMetaHttpDiagnostic(null, options.apiKey);
      try {
        const parsed = await boundedJson(response.clone());
        if (response.ok) {
          value = object(parsed);
          noSecret(value);
        } else diagnostic = sanitizeMetaHttpDiagnostic(parsed, options.apiKey);
      } catch (error) {
        if (response.ok) throw error;
        // A non-JSON or oversized error body is deliberately not persisted.
      }
      const reported = object(value.usage);
      const integer = (item: unknown): number | null =>
        Number.isSafeInteger(item) && Number(item) >= 0 ? Number(item) : null;
      const promptTokens = integer(reported.prompt_tokens),
        completionTokens = integer(reported.completion_tokens);
      const cachedInputTokens = integer(object(reported.prompt_tokens_details).cached_tokens);
      const reasoningTokens = integer(object(reported.completion_tokens_details).reasoning_tokens);
      const usage =
        promptTokens !== null && completionTokens !== null
          ? { promptTokens, completionTokens, cachedInputTokens, reasoningTokens }
          : null;
      const responseId = safeId(value.id),
        modelId = safeId(value.model);
      const choices = Array.isArray(value.choices) ? value.choices : [];
      const first = object(choices[0]),
        message = object(first.message);
      const calls = Array.isArray(message.tool_calls) ? message.tool_calls : [];
      const names = calls.map((call) => safeId(object(object(call).function).name));
      const item = {
        attempt,
        phase,
        httpStatus: response.status,
        responseId,
        modelId,
        usage,
        finishReason: safeId(first.finish_reason),
        toolCallNames: names,
        toolCallIds: calls.map((call) => safeId(object(call).id)),
        requestId: safeId(
          response.headers.get("x-request-id") ?? response.headers.get("request-id"),
        ),
        ...(response.ok ? {} : { diagnostic }),
      };
      trace.push(item);
      await save(`transport-${paidRequests}.json`, item);
      // Persist the redacted HTTP receipt before any fail-closed ledger validation.
      settled = true;
      try {
        await ledger.settle(attempt, {
          httpStatus: response.status,
          responseId,
          modelId,
          usage,
          status: response.ok ? "completed" : "failed",
        });
      } catch (error) {
        if (
          !response.ok &&
          response.status >= 400 &&
          response.status < 500 &&
          error instanceof MetaLiveBudgetError
        ) {
          await save(`ledger-stop-${paidRequests}.json`, {
            attempt,
            httpStatus: response.status,
            code: error.code,
            classification: "KNOWN_HTTP_REQUEST_REJECTION",
            reservationRetained: true,
          });
          throw new AgentError(
            "PROVIDER_REQUEST_FAILED",
            `Meta HTTP ${response.status} request rejected; diagnostic saved.`,
          );
        }
        throw error;
      }
      const expected =
        phase === "sound"
          ? "ProposeSoundBehavior"
          : phase === "scene"
            ? "AddObject"
            : "RunSimulation";
      if (response.ok && (names.length !== 1 || names[0] !== expected))
        throw new AgentError("POLICY_DENIED", "模型未提出本階段唯一允許的工具；未派送或套用。");
      return response;
    } catch (error) {
      if (!settled)
        await ledger
          .settle(attempt, {
            httpStatus: null,
            responseId: null,
            modelId: null,
            usage: null,
            status: "unknown",
          })
          .catch(() => {});
      if (error instanceof AgentError) throw error;
      if (error instanceof MetaLiveBudgetError)
        throw new AgentError("BUDGET_EXCEEDED", `Live ledger已停止：${error.code}。`);
      throw new AgentError("TIMEOUT", "Live transport結果未確認；不自動重送。");
    }
  };
  const provider = new MetaProvider(
    {
      ...DEFAULT_META_CONFIG,
      apiKey: options.apiKey,
      networkEnabled: true,
      modelId: MODEL,
      verificationStatus: "verified",
      verifiedAt: options.catalogProof.checkedAt,
      verificationArtifactId: "artifact.meta-catalog-20261027-0131",
      dataMode: "standard",
      maxEstimatedCostUsd: 1,
      inputUsdPerMillionTokens: 1.25,
      outputUsdPerMillionTokens: 4.25,
      pricingSource: PRICE_SOURCE,
      maxRetries: 0,
      timeoutMs: 30000,
      maxCompletionTokens: 1000,
      reasoningEffort: "minimal",
    },
    { fetch: paidFetch },
  );
  const server = createAgentServer({ provider });
  try {
    await new Promise<void>((resolveReady, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolveReady);
    });
  } catch {
    await ledger.close();
    throw new AgentError("INTERNAL_ERROR", "本機驗證API無法啟動；未派送付費請求。");
  }
  const address = server.address();
  if (!address || typeof address === "string") {
    server.close();
    await ledger.close();
    throw new AgentError("INTERNAL_ERROR", "本機API未啟動。");
  }
  const base = `http://127.0.0.1:${address.port}`;
  globalThis.fetch = async (input, init) => {
    const product = typeof input === "string" && input.startsWith("/api/");
    const response = await nativeFetch(product ? base + input : input, init);
    if (product) {
      const value = await boundedJson(response.clone());
      noSecret(value);
      const item = { phase, route: input, httpStatus: response.status, value };
      productPlans.push(item);
      await save(`product-api-${productPlans.length}.json`, item);
    }
    return response;
  };
  const session = new AgentSession({
    getScene: () => clone(scene),
    getBehaviorState: () => ({
      sceneId: scene.sceneId,
      sceneRevision: scene.sceneRevision,
      document: clone(document),
      context: makeBehaviorContext(scene, poses, []),
    }),
    getRegistries: () => ({
      materials: DEFAULT_MATERIALS.map((material) => ({ id: material.id, label: material.label })),
      signals,
      materialRegistryRevision: 1,
      selectedObjectId: "ball",
    }),
    commitBehavior: (next, expectedDocumentRevision, expectedSceneRevision) => {
      if (
        document.revision !== expectedDocumentRevision ||
        scene.sceneRevision !== expectedSceneRevision
      )
        throw new AgentError("REVISION_CONFLICT", "Live Sound Apply版本不符。");
      noSecret(next);
      document = clone(next);
      return clone(document);
    },
    commitScene: async (next, expected, _transactionId, requests) => {
      if (scene.sceneRevision !== expected)
        throw new AgentError("REVISION_CONFLICT", "Live Scene Apply版本不符。");
      const candidate = createScene(next);
      const world = await PhysicsWorld.create(candidate);
      const nextPoses = world
        .snapshot()
        .poses.map((pose) => ({ objectId: pose.objectId, generation: pose.generation }));
      world.dispose();
      const nextDocument = projectSceneSources(
        scene,
        candidate,
        document,
        requests,
        nextPoses,
        [],
        signals,
      );
      noSecret(candidate);
      noSecret(nextDocument);
      scene = candidate;
      document = nextDocument;
      poses = nextPoses;
      return clone(scene);
    },
    runTool: (request) => experiment.execute(request),
  });
  const soundPrompt = META_LIVE_SOUND_PROMPT;
  const scenePrompt = META_LIVE_SCENE_PROMPT;
  const runPrompt = metaLiveRunPrompt(scene.seed);
  const proposeAndApply = async (kind: "sound" | "scene", prompt: string): Promise<boolean> => {
    phase = kind;
    // A failed request requires an offline diagnosis and a newly reviewed execution.
    if (ledger.snapshot().remainingRequestSlots > 0) {
      if (kind === "sound") await session.submitLiveSound(prompt);
      else await session.submitLive(prompt);
      const preview = session.getView();
      noSecret(preview);
      const entry: Record<string, unknown> = {
        phase: kind,
        attempt: 1,
        preview,
        beforeSceneRevision: scene.sceneRevision,
        beforeBehaviorRevision: document.revision,
      };
      if (preview.status === "preview" && preview.canApply) {
        await session.apply();
        entry.apply = session.getView();
        entry.afterSceneRevision = scene.sceneRevision;
        entry.afterBehaviorRevision = document.revision;
        phaseResults.push(entry);
        await save(`${kind}-1.json`, entry);
        return session.getView().status === "idle";
      }
      phaseResults.push(entry);
      await save(`${kind}-1.json`, entry);
    }
    return false;
  };
  let final: Record<string, unknown>;
  try {
    await save("initial.json", {
      scene: initialScene,
      document: initialDocument,
      catalogProof: options.catalogProof,
      model: MODEL,
      dataMode: "standard",
      scope: "PRODUCT_API_AND_LOCAL_COMPUTED_RUNTIME",
      hardwareAudio: "NOT_RUN",
    });
    const soundOnly = options.validationScope === "sound-only";
    const scenePassed = !soundOnly && (await proposeAndApply("scene", scenePrompt));
    const soundPassed = (soundOnly || scenePassed) && (await proposeAndApply("sound", soundPrompt));
    let metaRun = false;
    if (soundPassed && scenePassed && ledger.snapshot().remainingRequestSlots > 0) {
      phase = "run";
      await session.submitLive(runPrompt);
      metaRun = session.getToolResults().at(-1)?.status === "completed";
      await save("meta-run.json", { view: session.getView(), results: session.getToolResults() });
    }
    if (soundPassed && !metaRun)
      await experiment.execute({
        schemaVersion: "1.0.0",
        requestId: "request.live.explicit-run",
        tool: "RunSimulation",
        sceneId: scene.sceneId,
        expectedSceneRevision: scene.sceneRevision,
        transactionId: null,
        arguments: {
          backendId: "custom-web",
          durationS: 3,
          timeStepS: 1 / 60,
          seed: scene.seed,
          replayTraceId: null,
          maxReflectionOrder: 1,
          sampleRateHz: 48000,
        },
      });
    const runs = experiment.getRuns();
    const recording = runs.at(-1);
    let runPassed = false;
    if (recording) {
      await verifyRecording(recording);
      runPassed =
        recording.status === "captured" &&
        recording.startTick === 0 &&
        recording.endTick === 180 &&
        recording.frameCount === 181;
      const behaviorEvents = recording.frames
        .flatMap((frame) => frame.audioEvents)
        .filter((event) => {
          const value = object(event);
          return (
            value.bindingId === "binding.interactive.ball" &&
            value.ruleId === "rule.impact" &&
            value.action === "start" &&
            value.pitchSemitones === 2
          );
        });
      runPassed &&= behaviorEvents.length > 0;
      await save("recording.json", recording);
      await save("meta-behavior-trace.json", {
        changedBindingId: "binding.interactive.ball",
        changedRuleId: "rule.impact",
        expectedPitchSemitones: 2,
        actualStartedEvents: behaviorEvents,
        evidence: "COMPUTED_NOT_HARDWARE_AUDIO",
      });
      const read = (
        id: string,
        tool: ToolRequest["tool"],
        args: Record<string, unknown>,
      ): ToolRequest => ({
        schemaVersion: "1.0.0",
        requestId: id,
        tool,
        sceneId: scene.sceneId,
        expectedSceneRevision: scene.sceneRevision,
        transactionId: null,
        arguments: args,
      });
      const capture = await experiment.execute(
        read("request.live.capture", "CaptureExperiment", {
          runId: recording.runId,
          label: "Meta live proposal + actual local runtime",
        }),
      );
      const analysis = await experiment.execute(
        read("request.live.analysis", "AnalyzeAcousticResults", {
          runId: recording.runId,
          metrics: ["directArrivalTimeS", "rt60S"],
          bandCentersHz: [1000],
        }),
      );
      await save("analysis.json", {
        capture,
        analysis,
        artifacts: [...new Set([...capture.artifactIds, ...analysis.artifactIds])].map((id) =>
          experiment.getArtifact(id),
        ),
      });
      runPassed &&= capture.state === "succeeded" && analysis.state === "succeeded";
    }
    final = {
      status:
        soundPassed && runPassed
          ? soundOnly
            ? "SOUND_PASSED_SCENE_NOT_RUN"
            : scenePassed
              ? "PASSED"
              : "INCOMPLETE"
          : "INCOMPLETE",
      validationScope: options.validationScope ?? "scene-and-sound",
      sceneLive: soundOnly
        ? "NOT_RUN_REQUEST_CAP_RESERVED_FOR_SOUND"
        : scenePassed
          ? "PASSED"
          : "FAILED",
      soundPassed,
      scenePassed,
      runPassed,
      metaRun,
      runPlanner: metaRun ? "META_LIVE" : "HOST_EXPLICIT_FIXED60",
      paidRequests,
      paidRequestsThisExecution: paidRequests,
      totalPaidRequests: ledger.snapshot().attempts.length,
      model: MODEL,
      dataMode: "standard",
      scene,
      document,
      audit: session.getAudit(),
      experimentLedger: experiment.getLedger(),
      transport: trace,
      productPlans,
      phaseResults,
      budget: ledger.snapshot(),
      remainingCreditUsd: null,
      actualBillingCostUsd: null,
      browser: "NOT_RUN",
      hearing: "NOT_RUN",
      physicalMeasurement: "NOT_RUN",
    };
  } catch (error) {
    final = {
      status: "FAILED",
      code: error instanceof AgentError ? error.code : "VALIDATION_FAILED",
      paidRequests,
      paidRequestsThisExecution: paidRequests,
      totalPaidRequests: ledger.snapshot().attempts.length,
      transport: trace,
      phaseResults,
      budget: ledger.snapshot(),
      remainingCreditUsd: null,
      actualBillingCostUsd: null,
    };
  } finally {
    globalThis.fetch = nativeFetch;
    server.closeAllConnections();
    await new Promise<void>((resolveClosed) => server.close(() => resolveClosed()));
    await ledger.close();
  }
  await save("summary.json", final);
  return final;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  let keyFile: string | undefined;
  let approved = false;
  let output: string | undefined;
  for (let index = 0; index < args.length; index += 2) {
    const name = args[index],
      value = args[index + 1];
    if (name === "--key-file" && value && !keyFile) keyFile = value;
    else if (name === "--approved-total-usd" && value === "1" && !approved) approved = true;
    else if (name === "--output-dir" && value && !output) output = value;
    else
      throw new MetaKeyError(
        "CLI_ARGUMENT_INVALID",
        "Live CLI只接受明確key-file、approved-total-usd 1及新output-dir。",
      );
  }
  if (!approved || !keyFile || !output)
    throw new MetaKeyError("APPROVAL_REQUIRED", "缺少此次US$1總額授權參數或server key來源。");
  const root = fileURLToPath(new URL("../research/v1/", import.meta.url));
  const outputDirectory = resolve(output),
    local = relative(root, outputDirectory);
  if (!local || local.startsWith("..") || isAbsolute(local))
    throw new MetaKeyError("ARTIFACT_PATH_INVALID", "證據必須寫入research/v1內的新目錄。");
  const previewDirectory = resolve(root, "meta-live-payload-preview-20261027-r3-minimal");
  const manifest = object(
    JSON.parse(await readFile(resolve(previewDirectory, "manifest.json"), "utf8")),
  );
  if (
    manifest.classification !== "AUTHORED_SYNTHETIC_FIXTURE_ONLY" ||
    manifest.endpoint !== META_CHAT_ENDPOINT ||
    manifest.model !== MODEL ||
    manifest.dataMode !== "standard" ||
    manifest.validationScope !== "sound-only" ||
    manifest.reasoningEffort !== "minimal"
  )
    throw new MetaKeyError(
      "REVIEWED_PAYLOAD_INVALID",
      "缺少明確審查過的Synthetic payload manifest。",
    );
  const reviewedPayloads = {} as ReviewedMetaPayloads;
  for (const phase of ["sound", "scene", "run"] as const) {
    const entry = object(object(manifest.reviewedPayloads)[phase]);
    const body = await readFile(resolve(previewDirectory, `${phase}.request.json`), "utf8");
    if (
      typeof entry.sha256 !== "string" ||
      !/^[a-f0-9]{64}$/.test(entry.sha256) ||
      entry.sha256 !== payloadHash(body) ||
      !Number.isSafeInteger(entry.bytes) ||
      entry.bytes !== Buffer.byteLength(body) ||
      Number(entry.bytes) > 32000
    )
      throw new MetaKeyError(
        "REVIEWED_PAYLOAD_INVALID",
        "Synthetic payload的SHA／byte count與審查manifest不符。",
      );
    reviewedPayloads[phase] = { sha256: entry.sha256, bytes: Number(entry.bytes) };
  }
  const loaded = await loadMetaApiKey({ keyFile });
  if (!loaded.apiKey)
    throw new MetaKeyError("AUTHENTICATION_NOT_CONFIGURED", "缺少server API key。");
  const catalogProof = JSON.parse(
    await readFile(resolve(root, "meta-catalog-20261027T0131Z.json"), "utf8"),
  ) as MetaCatalogProof;
  const result = await runMetaLiveValidation({
    apiKey: loaded.apiKey,
    ledgerPath: resolve(root, "meta-live-budget-20261027.json"),
    outputDirectory,
    catalogProof,
    remoteFetch: globalThis.fetch,
    reviewedPayloads,
    validationScope: "sound-only",
  });
  process.stdout.write(
    JSON.stringify(
      {
        status: result.status,
        paidRequests: result.paidRequests,
        paidRequestsThisExecution: result.paidRequestsThisExecution,
        totalPaidRequests: result.totalPaidRequests,
        validationScope: result.validationScope,
        sceneLive: result.sceneLive,
        soundPassed: result.soundPassed ?? false,
        scenePassed: result.scenePassed ?? false,
        runPassed: result.runPassed ?? false,
        metaRun: result.metaRun ?? false,
        budget: result.budget,
        actualBillingCostUsd: null,
        remainingCreditUsd: null,
      },
      null,
      2,
    ) + "\n",
  );
  if (!["PASSED", "SOUND_PASSED_SCENE_NOT_RUN"].includes(String(result.status)))
    process.exitCode = 1;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  void main().catch((error: unknown) => {
    process.stderr.write(
      JSON.stringify({
        status: "FAILED",
        code: error instanceof MetaKeyError ? error.code : "LIVE_VALIDATION_STOPPED",
      }) + "\n",
    );
    process.exitCode = 1;
  });
