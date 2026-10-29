import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { DEFAULT_META_CONFIG, META_CHAT_ENDPOINT, MetaProvider } from "./meta-provider.js";
import {
  META_LIVE_ADD_OBJECT,
  META_LIVE_SCENE_PROMPT,
  META_LIVE_SIGNALS,
  META_LIVE_SOUND_PROMPT,
  metaLiveRunPrompt,
} from "./meta-live-fixture.js";
import {
  DEFAULT_MATERIALS,
  createDefaultBehaviors,
  createDefaultScene,
  makeBehaviorContext,
} from "../src/app/defaults.js";
import { createSceneToolAdapter } from "../src/ai/scene-adapter.js";
import { AgentHost } from "../src/ai/host.js";
import { AgentError } from "../src/ai/types.js";
import type { PlannerContext } from "../src/ai/types.js";

export type MetaLivePhase = "sound" | "scene" | "run";
export type ReviewedMetaPayloads = Record<MetaLivePhase, { sha256: string; bytes: number }>;
export const payloadHash = (value: string): string =>
  createHash("sha256").update(value, "utf8").digest("hex");

/** Uses an injected capture-only transport, no key loader, filesystem reads, catalog or inference. */
export async function createMetaLivePayloadPreview(
  validationScope: "scene-and-sound" | "sound-only" = "scene-and-sound",
): Promise<{
  payloads: Record<MetaLivePhase, string>;
  reviewedPayloads: ReviewedMetaPayloads;
}> {
  let scene = createDefaultScene();
  const document = createDefaultBehaviors(scene);
  const materials = DEFAULT_MATERIALS.map((material) => ({
    id: material.id,
    label: material.label,
  }));
  const payloads = {} as Record<MetaLivePhase, string>;
  let phase: MetaLivePhase = "sound";
  const provider = new MetaProvider(
    {
      ...DEFAULT_META_CONFIG,
      apiKey: "LLM_0_OFFLINE_PREVIEW_ONLY",
      networkEnabled: true,
      modelId: "muse-spark-1.3",
      verificationStatus: "verified",
      verifiedAt: "2026-10-27T00:00:00.000Z",
      verificationArtifactId: "artifact.offline-preview",
      maxEstimatedCostUsd: 1,
      inputUsdPerMillionTokens: 1.25,
      outputUsdPerMillionTokens: 4.25,
      pricingSource: "https://dev.meta.ai/docs/pricing-rate-limits",
      maxRetries: 0,
      maxCompletionTokens: 1000,
      reasoningEffort: "minimal",
    },
    {
      fetch: async (url, init) => {
        if (String(url) !== META_CHAT_ENDPOINT || init?.method !== "POST")
          throw new AgentError("POLICY_DENIED", "Preview transport範圍無效。");
        const body = String(init.body);
        if (/LLM_/i.test(body))
          throw new AgentError("POLICY_DENIED", "Preview body不能含credential資料。");
        payloads[phase] = body;
        throw new AgentError("OFFLINE_PREVIEW_CAPTURED", "離線body已擷取，沒有網路請求。");
      },
    },
  );
  const capture = async (work: Promise<unknown>): Promise<void> => {
    try {
      await work;
    } catch (error) {
      if (!(error instanceof AgentError) || error.code !== "OFFLINE_PREVIEW_CAPTURED") throw error;
    }
  };
  const context = (): PlannerContext => ({
    scene,
    materials,
    signals: META_LIVE_SIGNALS,
    materialRegistryRevision: 1,
    selectedObjectId: "ball",
  });
  phase = "scene";
  await capture(provider.plan(META_LIVE_SCENE_PROMPT, context()));
  const host = new AgentHost(
    createSceneToolAdapter({
      getScene: () => scene,
      materials,
      signals: META_LIVE_SIGNALS,
      commitScene: (next) => {
        scene = next;
        return scene;
      },
    }),
  );
  const preview = await host.stage(
    [
      {
        schemaVersion: "1.0.0",
        requestId: "request.offline-preview",
        tool: "AddObject",
        sceneId: scene.sceneId,
        expectedSceneRevision: scene.sceneRevision,
        transactionId: "transaction.offline-preview",
        arguments: META_LIVE_ADD_OBJECT,
      },
    ],
    {
      provider: "offlineDeterministic",
      modelId: null,
      requestId: null,
      label: "OFFLINE_DETERMINISTIC",
    },
  );
  if (validationScope === "scene-and-sound") await host.apply(preview.previewId, preview.digest);
  phase = "sound";
  await capture(
    provider.planSound(
      META_LIVE_SOUND_PROMPT,
      {
        sceneId: scene.sceneId,
        sceneRevision: scene.sceneRevision,
        document,
        context: makeBehaviorContext(
          scene,
          scene.objects.map((entry) => ({ objectId: entry.id, generation: 1 })),
          [],
        ),
      },
      { selectedObjectId: "ball" },
    ),
  );
  phase = "run";
  await capture(provider.plan(metaLiveRunPrompt(scene.seed), context()));
  const reviewedPayloads = Object.fromEntries(
    (["sound", "scene", "run"] as const).map((name) => [
      name,
      { sha256: payloadHash(payloads[name]), bytes: Buffer.byteLength(payloads[name], "utf8") },
    ]),
  ) as ReviewedMetaPayloads;
  return { payloads, reviewedPayloads };
}

async function main(): Promise<void> {
  const preview = await createMetaLivePayloadPreview("sound-only");
  const directory = fileURLToPath(
    new URL("../research/v1/meta-live-payload-preview-20261027-r3-minimal/", import.meta.url),
  );
  await mkdir(directory, { recursive: false });
  for (const phase of ["sound", "scene", "run"] as const) {
    await writeFile(resolve(directory, `${phase}.request.json`), preview.payloads[phase], {
      encoding: "utf8",
      flag: "wx",
    });
    await writeFile(
      resolve(directory, `${phase}.readable.json`),
      JSON.stringify(JSON.parse(preview.payloads[phase]), null, 2) + "\n",
      { encoding: "utf8", flag: "wx" },
    );
  }
  const manifest = {
    schemaVersion: "1.0.0",
    classification: "AUTHORED_SYNTHETIC_FIXTURE_ONLY",
    createdAt: new Date().toISOString(),
    endpoint: META_CHAT_ENDPOINT,
    method: "POST",
    model: "muse-spark-1.3",
    dataMode: "standard",
    validationScope: "sound-only",
    reasoningEffort: "minimal",
    executionOrder: ["sound", "host-explicit-fixed60-run"],
    unrequestedBodies: ["scene", "run"],
    repairBasis:
      "Both HTTP 400 receipts and US$0.50 reservations preserved; confirmed remote uniqueItems rejection; no automatic retry",
    reviewedPayloads: preview.reviewedPayloads,
    sourceFunctions: [
      "src/app/defaults.ts:createDefaultScene",
      "src/app/defaults.ts:createDefaultBehaviors",
      "src/app/defaults.ts:DEFAULT_MATERIALS",
      "server/meta-live-fixture.ts:fixed prompts and oscillator registry",
      "src/ai/scene-adapter.ts:deterministic approved sphere candidate",
    ],
    filesystemInputsToPrompts: [],
    privateProjectInputs: [],
    sampleAssets: [],
    inferenceRequests: 0,
    networkRequests: 0,
    authorizationBasis: [
      "User explicitly requested product Meta live validation",
      "User supplied a dedicated Meta API key file for server-only Authorization",
      "User explicitly approved this validation TOTAL spend cap US$1",
    ],
    restrictions: [
      "Only the ignored user-selected credential file is read for the Authorization header; never prompt content",
      "No filesystem, shell, repository or credential tools are advertised",
      "Only fixed official Meta endpoint; redirect:error; Standard model only",
      "At most three paid requests; persistent shared US$1 ledger; US$0.25 reserved before each; max_completion_tokens1000",
      "Actual send bytes/SHA-256 must match these reviewed synthetic bodies before reserving or dispatching",
      "Any model-derived scene deviation causes subsequent payload mismatch and stops that network request",
      "Catalog proof and budget ledger are read only as control metadata; never prompt inputs",
    ],
  };
  await writeFile(resolve(directory, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n", {
    encoding: "utf8",
    flag: "wx",
  });
  process.stdout.write(
    JSON.stringify({
      status: "PREVIEW_ONLY",
      inferenceRequests: 0,
      networkRequests: 0,
      reviewedPayloads: preview.reviewedPayloads,
    }) + "\n",
  );
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  void main().catch(() => {
    process.stderr.write("OFFLINE_PREVIEW_FAILED\n");
    process.exitCode = 1;
  });
