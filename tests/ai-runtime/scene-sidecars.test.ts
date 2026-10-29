import test from "node:test";
import assert from "node:assert/strict";
import { AgentHost } from "../../src/ai/host.js";
import { createSceneToolAdapter } from "../../src/ai/scene-adapter.js";
import { createScene } from "../../src/scene/index.js";
import type { PlannerProvenance, ToolRequest } from "../../src/ai/types.js";

const provenance: PlannerProvenance = {
  provider: "offlineDeterministic",
  modelId: null,
  requestId: null,
  label: "OFFLINE_DETERMINISTIC",
};

test("the exact approved source metadata survives another preview with the same Scene candidate", async () => {
  let scene = createScene({
    schemaVersion: "1.0.0",
    sceneId: "scene.sidecars",
    sceneRevision: 0,
    units: "SI",
    coordinateSystem: "right-handed-y-up-minus-z-forward",
    seed: 1,
    gravityMps2: [0, -9.81, 0],
    objects: [
      {
        id: "object.ball",
        shape: "sphere",
        dimensionsM: [0.5, 0.5, 0.5],
        positionM: [0, 2, 0],
        orientationQuaternion: [0, 0, 0, 1],
        mode: "dynamicGravity",
        massKg: 1,
        friction: 0.5,
        restitution: 0.25,
        physicsMaterialId: "material.synthetic",
        acousticMaterialId: "material.synthetic",
        acousticRole: "dynamicOccluder",
      },
    ],
    sources: [],
    listener: {
      id: "listener.main",
      positionM: [0, 1.6, 4],
      orientationQuaternion: [0, 0, 0, 1],
      attachment: "independent",
    },
  });
  const commits: { transactionId: string; requests: ToolRequest[] }[] = [];
  const host = new AgentHost(
    createSceneToolAdapter({
      getScene: () => structuredClone(scene),
      materials: [{ id: "material.synthetic", label: "Synthetic fixture" }],
      // Broadband signals do not have a single signal frequency. The reference
      // frequency is analysis metadata and must remain bound to its approval.
      signals: [{ id: "signal.broadband", label: "Broadband descriptor fixture" }],
      commitScene(next, expected, transactionId, requests) {
        assert.equal(scene.sceneRevision, expected);
        commits.push({ transactionId, requests: structuredClone(requests) });
        scene = createScene(next);
        return structuredClone(scene);
      },
    }),
  );
  const request = (id: string, referenceFrequencyHz: number): ToolRequest => ({
    schemaVersion: "1.0.0",
    requestId: id,
    sceneId: scene.sceneId,
    expectedSceneRevision: 0,
    transactionId: `${id}.transaction`,
    tool: "ConfigureSoundSource",
    arguments: {
      sourceId: "source.ball",
      objectId: "object.ball",
      signalId: "signal.broadband",
      mode: "continuous",
      gainDbfs: -18,
      referenceFrequencyHz,
    },
  });
  const approved = request("request.approved", 440);
  const other = request("request.other", 880);
  const previewA = await host.stage([approved], provenance);
  const previewB = await host.stage([other], provenance);
  assert.deepEqual(previewA.candidate, previewB.candidate);
  assert.equal(
    previewA.candidate.sources[0]?.playing,
    false,
    "new sources require explicit Enable",
  );
  assert.notEqual(previewA.digest, previewB.digest);
  await host.apply(previewA.previewId, previewA.digest);
  assert.equal(commits[0]?.transactionId, previewA.previewId);
  assert.deepEqual(commits[0]?.requests, [approved]);
  assert.equal(commits[0]?.requests[0]?.arguments.referenceFrequencyHz, 440);
  const update = {
    ...approved,
    requestId: "request.update",
    expectedSceneRevision: scene.sceneRevision,
    transactionId: "transaction.update",
    arguments: { ...approved.arguments, gainDbfs: -12 },
  };
  const disabled = await host.stage([update], provenance);
  assert.equal(disabled.candidate.sources[0]?.playing, false);
  await host.apply(disabled.previewId, disabled.digest);
  scene = createScene({
    ...scene,
    sceneRevision: scene.sceneRevision + 1,
    sources: [{ ...scene.sources[0]!, playing: true }],
  });
  const enabled = await host.stage(
    [
      {
        ...update,
        requestId: "request.enabled",
        expectedSceneRevision: scene.sceneRevision,
        transactionId: "transaction.enabled",
      },
    ],
    provenance,
  );
  assert.equal(enabled.candidate.sources[0]?.playing, true, "existing enabled flags are preserved");
});
