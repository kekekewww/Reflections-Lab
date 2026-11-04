import test from "node:test";
import assert from "node:assert/strict";
import { SoundProposalHost } from "../../src/ai/sound-host.js";
import type { SoundHostState } from "../../src/ai/sound-host.js";
import { formatMessage } from "../../src/ui/locale-model.js";

const profile = {
  profileId: "profile.ball",
  revision: 1,
  name: "Synthetic impact",
  presetKind: "creative",
  materialPairOverrides: [],
  rules: [
    {
      ruleId: "rule.impact",
      enabled: true,
      trigger: { kind: "discrete", type: "OnImpact" },
      conditions: [],
      generator: { kind: "oscillator", waveform: "sine", frequencyHz: 440 },
      emitter: { attachment: "contact", aggregation: "representative" },
      gainLinear: 0.4,
      pitchSemitones: 0,
      fadeInSeconds: 0.01,
      fadeOutSeconds: 0.03,
      cooldownSeconds: 0.08,
      priority: 50,
      voiceLimit: 2,
      layerGroup: "layer.creative",
      mappings: [],
      oneShotDurationSeconds: 0.2,
    },
  ],
};
const binding = {
  bindingId: "binding.ball",
  objectId: "ball",
  objectGeneration: 1,
  profileId: "profile.ball",
  profileRevision: 1,
  enabled: true,
  overrides: [],
};
const state = {
  sceneId: "scene.preview",
  sceneRevision: 1,
  document: {
    schemaVersion: "1.0.0",
    documentId: "behavior.preview",
    revision: 1,
    assets: [],
    profiles: [profile],
    bindings: [binding],
  },
  context: {
    sceneRevision: 1,
    objects: [{ objectId: "ball", generation: 1 }],
    materialIds: [],
    zoneIds: [],
    assetRegistry: [],
  },
} as unknown as SoundHostState;

test("a sound preview names the parameter a binding override changes, and English reads it", async () => {
  const host = new SoundProposalHost({
    getState: () => state,
    commit: () => {
      throw new Error("preview must not commit");
    },
  });
  const preview = await host.stage(
    {
      schemaVersion: "1.0.0",
      proposalId: "sound.preview-text",
      sceneId: "scene.preview",
      expectedSceneRevision: 1,
      expectedBehaviorRevision: 1,
      operations: [
        { type: "RemoveBinding", bindingId: "binding.ball" },
        {
          type: "AssignBinding",
          binding: {
            ...binding,
            overrides: [{ ruleId: "rule.impact", pitchSemitones: 12, gainLinear: 0.5 }],
          },
        },
      ],
    } as never,
    {
      provider: "metaModelApi",
      modelId: "model.fixture",
      requestId: "response.fixture",
      label: "META_LIVE",
    },
  );
  assert.deepEqual(preview.changes, [
    "解除Binding binding.ball",
    "將 ball 綁定至 profile.ball@1",
    "Binding覆寫 ball rule.impact：音高 +12 半音",
    "Binding覆寫 ball rule.impact：增益 ×0.5",
  ]);
  assert.deepEqual(
    preview.changes.map((line) => formatMessage("en", line)),
    [
      "Remove binding binding.ball",
      "Bind ball to profile.ball@1",
      "ball · rule.impact: pitch +12 semitones",
      "ball · rule.impact: gain ×0.5",
    ],
  );
  assert.equal(
    formatMessage("en", "Meta Sound提案：2個受限操作，等待本機Host預覽與套用。"),
    "Meta Sound proposal: 2 bounded actions, waiting for local Host preview and Apply.",
  );
  assert.equal(
    formatMessage(
      "en",
      "READY_REQUIRES_EXPLICIT_REQUEST；只有提交指令才會呼叫模型；剩餘額度未知。",
    ),
    "The server gate is ready; a model request is sent only when you submit an instruction. [READY_REQUIRES_EXPLICIT_REQUEST] Remaining credit is unknown.",
  );
});
