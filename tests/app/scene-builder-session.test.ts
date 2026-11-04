import test from "node:test";
import assert from "node:assert/strict";
import { LabRuntime } from "../../src/app/runtime.js";
import type { AgentHost } from "../../src/ai/host.js";
import type { AgentPlan, ToolRequest } from "../../src/ai/types.js";
import type { SceneSpec } from "../../src/scene/types.js";

const IDENTITY = [0, 0, 0, 1];
let sequence = 0;
function plan(scene: SceneSpec, count: number, note?: string, shape = "box"): AgentPlan {
  const batch = ++sequence;
  const requests: ToolRequest[] = Array.from({ length: count }, (_, index) => ({
    schemaVersion: "1.0.0",
    requestId: `meta.plan-${batch}.request-${index + 1}`,
    tool: "AddObject",
    sceneId: scene.sceneId,
    expectedSceneRevision: scene.sceneRevision,
    transactionId: `meta.plan-${batch}.transaction`,
    arguments: {
      objectId: `box.b${batch}-${index}`,
      label: "Box",
      shape,
      dimensionsM: [0.1, 0.1, 0.1],
      positionM: [-2.5 + (index % 8) * 0.6, 0.05, -3 + batch * 0.2 + Math.floor(index / 8) * 0.04],
      orientationQuaternion: IDENTITY,
      materialId: "material.wood",
      mode: "fixed",
      massKg: 1,
    },
  }));
  return {
    planId: `meta.plan-${batch}`,
    requests,
    assumptions: [],
    warnings: [],
    summary: "Meta提出受限工具，尚待本地預覽與人員套用。",
    ...(note ? { note } : {}),
    provenance: {
      provider: "metaModelApi",
      modelId: "muse-spark-1.3",
      requestId: `response.${batch}`,
      label: "META_LIVE",
    },
  };
}
async function withApp(body: (app: LabRuntime, urls: string[]) => Promise<void>): Promise<void> {
  const app = await LabRuntime.create({ useWorker: false });
  const urls: string[] = [];
  const original = globalThis.fetch;
  try {
    globalThis.fetch = (async (url: string, init?: RequestInit) => {
      urls.push(String(url));
      const pending = (app as unknown as { nextPlan?: (input: unknown) => unknown }).nextPlan;
      return new Response(
        JSON.stringify(
          pending ? pending(JSON.parse(String(init?.body))) : { error: { code: "X" } },
        ),
        { status: pending ? 200 : 400 },
      );
    }) as typeof globalThis.fetch;
    await body(app, urls);
  } finally {
    globalThis.fetch = original;
    app.dispose();
  }
}
function respondWith(app: LabRuntime, make: () => unknown): void {
  (app as unknown as { nextPlan: () => unknown }).nextPlan = make;
}

test("a live proposal with many steps previews once, shows Muse's note and applies at once", async () => {
  await withApp(async (app) => {
    const session = app.getAgentSession();
    const before = app.getSceneDocument();
    respondWith(app, () => plan(before, 20, "Here are twenty boxes."));
    await session.submitLive("Add twenty boxes");
    const view = session.getView();
    assert.equal(view.status, "preview");
    assert.equal(view.note, "Here are twenty boxes.");
    assert.equal(view.preview!.split("\n").length, 20);
    assert.equal(app.getSceneDocument().objects.length, before.objects.length);
    await session.apply();
    assert.equal(app.getSceneDocument().objects.length, before.objects.length + 20);
    assert.equal(app.getSceneDocument().sceneRevision, before.sceneRevision + 1);
    assert.equal(session.canUndo(), true);
    await session.undo();
    assert.equal(app.getSceneDocument().objects.length, before.objects.length);
  });
});

test("when Muse proposes nothing, its note is still shown", async () => {
  await withApp(async (app) => {
    const session = app.getAgentSession();
    respondWith(app, () => plan(app.getSceneDocument(), 0, "There's no velvet here."));
    await session.submitLive("Add velvet");
    assert.equal(session.getView().status, "idle");
    assert.equal(session.getView().note, "There's no velvet here.");
  });
});

test("a new request clears the previous note", async () => {
  await withApp(async (app) => {
    const session = app.getAgentSession();
    respondWith(app, () => plan(app.getSceneDocument(), 1, "First note."));
    await session.submitLive("Add a box");
    respondWith(app, () => plan(app.getSceneDocument(), 1));
    await session.submitLive("Add another box");
    assert.equal(session.getView().note, undefined);
  });
});

test("live requests keep working after two minutes and past twelve turns", async (t) => {
  await withApp(async (app) => {
    const session = app.getAgentSession();
    const start = Date.now();
    let elapsed = 0;
    t.mock.method(Date, "now", () => start + elapsed);
    for (let turn = 0; turn < 14; turn++) {
      respondWith(app, () => plan(app.getSceneDocument(), 0, `Turn ${turn}`));
      await session.submitLive("Do something");
      assert.notEqual(session.getView().status, "error", session.getView().message);
      assert.equal(session.getView().note, `Turn ${turn}`);
      elapsed += 60000;
    }
  });
});

test("large proposals can be applied one after another without hitting the tool allowance", async () => {
  await withApp(async (app) => {
    const session = app.getAgentSession();
    for (let round = 0; round < 4; round++) {
      // Spheres count as one acoustic surface each, so this stays within the acoustic limit.
      respondWith(app, () => plan(app.getSceneDocument(), 25, undefined, "sphere"));
      await session.submitLive("Add twenty-five spheres");
      assert.equal(session.getView().status, "preview", session.getView().message);
      await session.apply();
      assert.notEqual(session.getView().status, "error", session.getView().message);
    }
    assert.equal(
      app.getSceneDocument().objects.filter((object) => object.id.startsWith("box.")).length,
      100,
    );
  });
});

test("cancelled proposals don't run out the Host's or adapter's capacity", async () => {
  await withApp(async (app) => {
    const host = (app.getAgentSession() as unknown as { sceneHost: AgentHost }).sceneHost;
    const provenance = plan(app.getSceneDocument(), 0).provenance;
    for (let round = 0; round < 60; round++) {
      const preview = await host.stage(plan(app.getSceneDocument(), 3).requests, provenance);
      host.cancel(preview.previewId);
    }
  });
});

const SCENE = "/api/agent/propose";
const SOUND = "/api/agent/propose-sound";
for (const [prompt, route] of [
  ["Move the ball to the corner and remove the speaker", SCENE],
  ["Build a stage, and put a piano on it", SCENE],
  ["舞台上擺放一台鋼琴", SCENE],
  ["移除球，再移動喇叭", SCENE],
  ["Add a ball that flies around the listener", SCENE],
  ["Raise the pitch of the ball's impact sound by 7 semitones", SOUND],
  ["把球的撞擊音效調高", SOUND],
  ["讓球滾動時發出聲音", SOUND],
] as const)
  test(`routing: "${prompt}" goes to ${route}`, async () => {
    await withApp(async (app, urls) => {
      await app.getAgentSession().submitLive(prompt);
      assert.equal(urls[0], route);
    });
  });

test("the wait message says Muse is working, not that a gate is being checked", async () => {
  await withApp(async (app) => {
    const session = app.getAgentSession();
    let during = "";
    respondWith(app, () => {
      during = session.getView().message;
      return plan(app.getSceneDocument(), 0);
    });
    await session.submitLive("Add a box");
    assert.equal(during, "Muse正在規劃提案，通常需要10–60秒；場景尚未變更。");
  });
});
