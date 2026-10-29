import test from "node:test";
import assert from "node:assert/strict";
import { LabRuntime } from "../../src/app/runtime.js";
import type { LabAction } from "../../src/ui/contracts.js";
import { verifyRecording } from "../../src/experiments/index.js";
import type { RecordingArtifact } from "../../src/experiments/types.js";
import { BlobStore } from "../../src/persistence/blob-store.js";
import type { AssetStagingContext } from "../../src/app/asset-host.js";
import { FakeAudioContext } from "../audio-runtime/fake-context.js";

const storage = () => {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
};
/** Explicit offline control adapter. This does not assert native decode or DSP. */
function assetStagingContext(sampleRate: number): AssetStagingContext {
  const context = new FakeAudioContext();
  Object.defineProperty(context, "sampleRate", { value: sampleRate });
  return {
    sampleRate,
    createBuffer: context.createBuffer.bind(context) as AssetStagingContext["createBuffer"],
    decodeAudioData: (async (bytes: ArrayBuffer) => {
      const wave = new DataView(bytes),
        channels = wave.getUint16(22, true),
        encodedRate = wave.getUint32(24, true);
      const frames = wave.getUint32(40, true) / wave.getUint16(32, true);
      return context.createBuffer(
        channels,
        Math.round((frames * sampleRate) / encodedRate),
        sampleRate,
      );
    }) as AssetStagingContext["decodeAudioData"],
  };
}
function waveFile() {
  const bytes = new ArrayBuffer(44 + 9600),
    wave = new DataView(bytes);
  const ascii = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) wave.setUint8(offset + i, text.charCodeAt(i));
  };
  ascii(0, "RIFF");
  wave.setUint32(4, bytes.byteLength - 8, true);
  ascii(8, "WAVE");
  ascii(12, "fmt ");
  wave.setUint32(16, 16, true);
  wave.setUint16(20, 1, true);
  wave.setUint16(22, 1, true);
  wave.setUint32(24, 48000, true);
  wave.setUint32(28, 96000, true);
  wave.setUint16(32, 2, true);
  wave.setUint16(34, 16, true);
  ascii(36, "data");
  wave.setUint32(40, 9600, true);
  return new File([bytes], "original-test.wav", { type: "audio/wav" });
}
async function fixture(run: (app: LabRuntime) => Promise<void>) {
  const app = await LabRuntime.create({ storage: storage(), useWorker: false });
  try {
    await run(app);
  } finally {
    app.dispose();
  }
}
async function command(app: LabRuntime, action: LabAction) {
  await app.dispatch(action);
  assert.equal(app.getSnapshot().error, "", `command ${action.type} must succeed`);
}
const blocked = () => ({
  offline: {
    state: "AVAILABLE",
    provenance: "OFFLINE_DETERMINISTIC",
    modelId: null,
    cloudCostUsd: 0,
  },
  meta: {
    provider: "metaModelApi",
    state: "BLOCKED",
    reason: "Zero cost ceiling; no model calls allowed",
    modelId: null,
    remainingQuota: null,
    liveValidation: "NOT_RUN",
    estimatedCostCeilingUsd: 0,
  },
});

test("app controls: default offline authoring does not fetch or imply Meta inference", async (t) => {
  const requests: string[] = [];
  t.mock.method(globalThis, "fetch", async (url) => {
    requests.push(String(url));
    throw new Error("Unexpected provider request");
  });
  await fixture(async (app) => {
    assert.equal(app.getSnapshot().ai.selectedProvider, "offline");
    await command(app, { type: "submitPrompt", prompt: "ball 碰撞音效小聲" });
    assert.equal(app.getSnapshot().ai.mode, "offline");
    assert.equal(app.getSnapshot().ai.status, "preview");
    assert.deepEqual(requests, []);
  });
});

test("app controls: zero-budget provider refresh uses status only and blocked submit never falls back to inference", async (t) => {
  const requests: { url: string; method: string }[] = [];
  t.mock.method(globalThis, "fetch", async (url, options?: RequestInit) => {
    requests.push({ url: String(url), method: options?.method ?? "GET" });
    assert.equal(String(url), "/api/agent/status", "status checks cannot submit a model proposal");
    return new Response(JSON.stringify(blocked()), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  });
  await fixture(async (app) => {
    const before = app.getSceneDocument(),
      behavior = app.getBehaviorDocument();
    await command(app, { type: "setAgentMode", mode: "meta" });
    assert.equal(app.getSnapshot().ai.selectedProvider, "meta");
    assert.equal(app.getSnapshot().ai.providerStatus?.status, "blocked");
    assert.match(app.getSnapshot().ai.providerStatus!.reason, /Zero cost ceiling/);
    assert.match(app.getSnapshot().ai.providerStatus!.reason, /NOT_RUN/);
    await command(app, { type: "refreshAgentStatus" });
    await app.dispatch({ type: "submitPrompt", prompt: "ball 碰撞音效小聲" });
    assert.match(app.getSnapshot().error ?? "", /META_PROVIDER_BLOCKED/);
    assert.equal(app.getSnapshot().ai.canApply, false);
    assert.notEqual(
      app.getSnapshot().ai.status,
      "preview",
      "blocked Meta must not silently use the offline planner",
    );
    assert.deepEqual(app.getSceneDocument(), before);
    assert.deepEqual(app.getBehaviorDocument(), behavior);
    assert.deepEqual(requests, [
      { url: "/api/agent/status", method: "GET" },
      { url: "/api/agent/status", method: "GET" },
    ]);
    await command(app, { type: "setAgentMode", mode: "offline" });
    await command(app, { type: "submitPrompt", prompt: "ball 碰撞音效小聲" });
    assert.equal(app.getSnapshot().ai.status, "preview", "explicit offline fallback stays usable");
    assert.equal(requests.length, 2);
  });
});

test("app controls: changing provider cancels the previous unapproved proposal", async (t) => {
  t.mock.method(
    globalThis,
    "fetch",
    async () => new Response(JSON.stringify(blocked()), { status: 200 }),
  );
  await fixture(async (app) => {
    const initial = app.getBehaviorDocument();
    await command(app, { type: "submitPrompt", prompt: "ball 碰撞音效小聲" });
    assert.equal(app.getSnapshot().ai.canApply, true);
    await command(app, { type: "setAgentMode", mode: "meta" });
    assert.equal(app.getSnapshot().ai.canApply, false);
    await command(app, { type: "applyAI" });
    assert.deepEqual(
      app.getBehaviorDocument(),
      initial,
      "a stale proposal cannot be approved under another provider",
    );
  });
});

test("app controls: failed status lookup stays blocked and never submits a proposal", async (t) => {
  let calls = 0;
  t.mock.method(globalThis, "fetch", async (url) => {
    calls++;
    assert.equal(String(url), "/api/agent/status");
    return new Response("not-json", { status: 503 });
  });
  await fixture(async (app) => {
    await command(app, { type: "setAgentMode", mode: "meta" });
    assert.equal(app.getSnapshot().ai.providerStatus?.status, "error");
    await app.dispatch({ type: "submitPrompt", prompt: "新增球" });
    assert.match(app.getSnapshot().error ?? "", /META_PROVIDER_BLOCKED/);
    assert.equal(app.getSnapshot().ai.canApply, false);
    assert.equal(calls, 1);
  });
});

test("app controls: contradictory zero-budget READY status is rejected before proposal submission", async (t) => {
  const requests: string[] = [];
  const response = blocked();
  response.meta.state = "READY";
  t.mock.method(globalThis, "fetch", async (url) => {
    requests.push(String(url));
    return String(url) === "/api/agent/status"
      ? new Response(JSON.stringify(response), { status: 200 })
      : new Response(
          JSON.stringify({
            error: { code: "BUDGET_EXCEEDED", message: "Zero server budget; inference never ran" },
          }),
          { status: 403 },
        );
  });
  await fixture(async (app) => {
    const before = app.getSceneDocument();
    await command(app, { type: "setAgentMode", mode: "meta" });
    await app.dispatch({ type: "submitPrompt", prompt: "新增球" });
    assert.deepEqual(
      requests,
      ["/api/agent/status"],
      "invalid READY cannot authorize even a local propose request",
    );
    assert.notEqual(app.getSnapshot().ai.providerStatus?.status, "ready");
    assert.deepEqual(app.getSceneDocument(), before);
    assert.equal(app.getSnapshot().ai.canApply, false);
  });
});

test("app controls: rejected or input actions cannot release another pending transaction lease", async (t) => {
  for (const duringPending of [
    { type: "addRule", objectId: "ball", trigger: "AlwaysOn" },
    { type: "inputLook", movementX: 1, movementY: 0 },
  ] satisfies LabAction[]) {
    let release!: (response: Response) => void;
    const fetch = t.mock.method(
      globalThis,
      "fetch",
      () =>
        new Promise<Response>((resolve) => {
          release = resolve;
        }),
    );
    await fixture(async (app) => {
      const before = app.getSceneDocument();
      const pending = app.dispatch({ type: "setAgentMode", mode: "meta" });
      try {
        assert.equal(app.getSnapshot().ai.providerStatus?.status, "loading");
        await app.dispatch(duringPending);
        await app.dispatch({ type: "patchObject", objectId: "ball", patch: { massKg: 5 } });
        assert.deepEqual(
          app.getSceneDocument(),
          before,
          `${duringPending.type} cannot unlock the still-running status transaction`,
        );
        assert.match(app.getSnapshot().error ?? "", /TRANSACTION_BUSY/);
      } finally {
        release(new Response(JSON.stringify(blocked()), { status: 200 }));
        await pending;
      }
    });
    fetch.mock.restore();
  }
});

test("app controls: import action swaps validated project state and malformed input preserves the running world", async () => {
  await fixture(async (app) => {
    await command(app, { type: "addRule", objectId: "ball", trigger: "WhileMoving" });
    const saved = app.exportProject(),
      scene = app.getSceneDocument(),
      behavior = app.getBehaviorDocument();
    await command(app, { type: "addObject", shape: "box" });
    assert.equal(app.getSceneDocument().objects.length, scene.objects.length + 1);
    await command(app, { type: "importProject", text: saved });
    assert.deepEqual(app.getSceneDocument(), scene);
    assert.deepEqual(app.getBehaviorDocument(), behavior);
    assert.equal(app.getSnapshot().tick, 0);
    await command(app, { type: "run" });
    app.advance(1 / 60);
    const pose = app.getPose("ball"),
      tick = app.getSnapshot().tick;
    await app.dispatch({ type: "importProject", text: "{bad" });
    assert.ok(app.getSnapshot().error);
    assert.deepEqual(app.getSceneDocument(), scene);
    assert.deepEqual(app.getBehaviorDocument(), behavior);
    assert.deepEqual(app.getPose("ball"), pose);
    assert.equal(app.getSnapshot().tick, tick);
    assert.equal(app.getSnapshot().simulationState, "running");
  });
});

test("app controls: export recording downloads the full verifiable raw artifact", async (t) => {
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
  const downloads: { blob: Blob; filename: string; clicks: number }[] = [];
  const revoked: string[] = [];
  let pending: { blob: Blob; filename: string; clicks: number } | null = null;
  t.mock.method(URL, "createObjectURL", (blob: Blob) => {
    pending = { blob, filename: "", clicks: 0 };
    downloads.push(pending);
    return "blob:recording-test";
  });
  t.mock.method(URL, "revokeObjectURL", (url: string) => {
    revoked.push(url);
  });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      createElement: (tag: string) => {
        assert.equal(tag, "a");
        return {
          href: "",
          set download(name: string) {
            pending!.filename = name;
          },
          click() {
            pending!.clicks++;
          },
        };
      },
    },
  });
  try {
    await fixture(async (app) => {
      await app.dispatch({ type: "exportRecording" });
      assert.match(app.getSnapshot().error ?? "", /NO_RECORDING/);
      assert.equal(downloads.length, 0);
      await command(app, { type: "recordToggle" });
      for (let tick = 0; tick < 4; tick++) {
        app.advance(1 / 60);
        await new Promise<void>((resolve) => setImmediate(resolve));
      }
      await command(app, { type: "recordToggle" });
      const captured = app.getRecordingArtifact()!;
      await command(app, { type: "exportRecording" });
      assert.equal(downloads.length, 1);
      assert.equal(downloads[0]!.clicks, 1);
      assert.equal(downloads[0]!.filename, `${captured.runId}.recording.json`);
      const exported = JSON.parse(await downloads[0]!.blob.text()) as RecordingArtifact;
      assert.deepEqual(
        exported,
        captured,
        "export must include raw frames and content state rather than project references only",
      );
      assert.equal(exported.frames.length, 4);
      assert.ok(exported.frames[0]!.behaviorSnapshot);
      await verifyRecording(exported);
      assert.deepEqual(revoked, ["blob:recording-test"]);
    });
  } finally {
    if (originalDocument) Object.defineProperty(globalThis, "document", originalDocument);
    else Reflect.deleteProperty(globalThis, "document");
  }
});

test("app controls: a fresh runtime reloads trusted asset bytes and a verifiable recording from the shared local store", async (t) => {
  const local = storage(),
    blobs = new BlobStore({ indexedDB: null });
  let liveContexts = 0;
  const previous = globalThis.AudioContext;
  class Context extends FakeAudioContext {
    constructor() {
      super();
      liveContexts++;
    }
  }
  globalThis.AudioContext = Context as unknown as typeof AudioContext;
  t.after(() => {
    blobs.close();
    if (previous) globalThis.AudioContext = previous;
    else Reflect.deleteProperty(globalThis, "AudioContext");
  });
  const options = { storage: local, useWorker: false, blobStore: blobs, assetStagingContext };
  const first = await LabRuntime.create(options);
  let text = "",
    assetId = "",
    hash = "",
    recording: RecordingArtifact | null = null;
  try {
    // Asset authoring/storage is independent of user-gesture monitoring.
    await command(first, { type: "importAudio", file: waveFile(), rightsConfirmed: true });
    const project = JSON.parse(first.exportProject()) as {
      assets: { assetId: string; storage: string; sha256: string }[];
    };
    const imported = project.assets.find((asset) => asset.storage === "externalFile")!;
    assetId = imported.assetId;
    hash = imported.sha256;
    assert.equal(liveContexts, 0);
    assert.ok(
      first.getSnapshot().assets.some((asset) => asset.id === assetId && asset.status === "ready"),
      "offline decoded imports must be selectable before monitor activation",
    );
    await command(first, {
      type: "patchRule",
      objectId: "ball",
      ruleId: "rule.impact",
      patch: { generator: "sample", assetId },
    });
    await command(first, { type: "recordToggle" });
    for (let tick = 0; tick < 4; tick++) {
      first.advance(1 / 60);
      await new Promise<void>((resolve) => setImmediate(resolve));
    }
    await command(first, { type: "recordToggle" });
    recording = first.getRecordingArtifact()!;
    await command(first, { type: "save" });
    text = first.exportProject();
  } finally {
    first.dispose();
  }
  const second = await LabRuntime.create(options);
  try {
    await command(second, { type: "load" });
    assert.equal(liveContexts, 0, "restoring files cannot activate the live AudioContext");
    const pin = second.getBehaviorDocument().assets.find((asset) => asset.assetId === assetId)!;
    assert.equal(pin.sha256, hash);
    assert.equal(second.getRecordingArtifact()!.artifactSha256, recording!.artifactSha256);
    assert.deepEqual(second.getRecordingArtifact()!.frames, recording!.frames);
    assert.equal(second.getSnapshot().recording.canReplay, true);
    await verifyRecording(second.getRecordingArtifact()!);
    await command(second, { type: "enableAudio" });
    assert.equal(liveContexts, 1);
    assert.ok(
      second.getSnapshot().assets.some((asset) => asset.id === assetId && asset.status === "ready"),
    );
    assert.equal(
      JSON.parse(text).soundBehaviors.assets.find(
        (asset: { assetId: string }) => asset.assetId === assetId,
      ).sha256,
      hash,
    );
  } finally {
    second.dispose();
  }
});

test("app controls: Scene source proposal commits and undoes its audible Behavior sidecar atomically", async () => {
  await fixture(async (app) => {
    const original = app.getSceneDocument();
    const alwaysOnBall = () =>
      app
        .getBehaviorDocument()
        .bindings.filter((binding) => binding.objectId === "ball")
        .flatMap(
          (binding) =>
            app
              .getBehaviorDocument()
              .profiles.find((profile) => profile.profileId === binding.profileId)!.rules,
        )
        .filter((rule) => rule.trigger.type === "AlwaysOn");
    assert.equal(alwaysOnBall().length, 0);
    await command(app, { type: "selectObject", objectId: "ball" });
    await command(app, { type: "submitPrompt", prompt: "tone" });
    assert.equal(app.getSnapshot().ai.status, "preview");
    assert.deepEqual(app.getSceneDocument(), original);
    await command(app, { type: "applyAI" });
    const source = app.getSceneDocument().sources.find((value) => value.objectId === "ball")!;
    assert.ok(source, "the Scene host must actually commit ConfigureSoundSource");
    assert.equal(source.signalId, "signal.tone-220");
    // Canonical AI_TOOL_SCHEMAS.md §與 SceneSpec 的轉換 requires a new
    // source to start with playing=false. Projection must still exist in Inspector.
    assert.equal(source.playing, false);
    assert.equal(
      alwaysOnBall().length,
      1,
      "an accepted Scene source needs its disabled, editable Behavior sidecar",
    );
    const rule = alwaysOnBall()[0]!;
    assert.equal(rule.enabled, false);
    assert.equal(app.getSnapshot().tick, 0, "Apply cannot run the simulation");
    assert.equal(app.getSnapshot().monitor.activeVoices, 0);
    assert.equal(
      app.getSnapshot().monitor.state,
      "blocked",
      "Apply cannot activate the AudioContext",
    );
    await command(app, { type: "run" });
    for (let tick = 0; tick < 4; tick++) {
      app.advance(1 / 60);
      await new Promise<void>((resolve) => setImmediate(resolve));
    }
    await command(app, { type: "pause" });
    assert.equal(
      app
        .getSnapshot()
        .events.filter((event) => event.objectId === "ball" && event.type === "AlwaysOn").length,
      0,
      "Run does not implicitly enable the newly configured source",
    );
    await command(app, {
      type: "patchRule",
      objectId: "ball",
      ruleId: rule.ruleId,
      patch: { enabled: true },
    });
    assert.equal(
      app.getSceneDocument().sources.find((value) => value.id === source.id)!.playing,
      true,
    );
    await command(app, { type: "run" });
    for (let tick = 0; tick < 4; tick++) {
      app.advance(1 / 60);
      await new Promise<void>((resolve) => setImmediate(resolve));
    }
    await command(app, { type: "pause" });
    const count = app
      .getSnapshot()
      .events.filter((event) => event.objectId === "ball" && event.type === "AlwaysOn").length;
    assert.equal(count, 1);
    await command(app, { type: "undo" });
    assert.equal(
      app.getSceneDocument().sources.find((value) => value.id === source.id)!.playing,
      false,
      "first Undo restores the explicit Enable transaction",
    );
    assert.equal(alwaysOnBall()[0]!.enabled, false);
    await command(app, { type: "undo" });
    assert.deepEqual(app.getSceneDocument().sources, original.sources);
    assert.equal(alwaysOnBall().length, 0);
    await command(app, { type: "run" });
    app.advance(1 / 60);
    await command(app, { type: "pause" });
    assert.equal(
      app
        .getSnapshot()
        .events.filter((event) => event.objectId === "ball" && event.type === "AlwaysOn").length,
      count,
      "Undo must also remove the source's runtime sidecar",
    );
  });
});

test("app controls: missing original asset bytes reject atomically and reimport reconnects the original pin", async () => {
  const sourceBlobs = new BlobStore({ indexedDB: null }),
    targetBlobs = new BlobStore({ indexedDB: null });
  const source = await LabRuntime.create({
    useWorker: false,
    blobStore: sourceBlobs,
    assetStagingContext,
  });
  let text = "",
    assetId = "",
    hash = "";
  try {
    await command(source, { type: "importAudio", file: waveFile(), rightsConfirmed: true });
    const imported = JSON.parse(source.exportProject()).assets.find(
      (asset: { storage: string }) => asset.storage === "externalFile",
    );
    assetId = imported.assetId;
    hash = imported.sha256;
    await command(source, {
      type: "patchRule",
      objectId: "ball",
      ruleId: "rule.impact",
      patch: { generator: "sample", assetId },
    });
    text = source.exportProject();
  } finally {
    source.dispose();
    sourceBlobs.close();
  }
  const target = await LabRuntime.create({
    useWorker: false,
    blobStore: targetBlobs,
    assetStagingContext,
  });
  try {
    const before = target.getSceneDocument(),
      behavior = target.getBehaviorDocument();
    await target.dispatch({ type: "importProject", text });
    assert.match(target.getSnapshot().error ?? "", /ASSET_REQUIRED_MISSING/);
    assert.deepEqual(target.getSceneDocument(), before);
    assert.deepEqual(target.getBehaviorDocument(), behavior);
    await command(target, { type: "importAudio", file: waveFile(), rightsConfirmed: true });
    await command(target, { type: "importProject", text });
    const pin = target.getBehaviorDocument().assets.find((asset) => asset.assetId === assetId)!;
    assert.equal(pin.sha256, hash);
    const project = JSON.parse(target.exportProject()) as {
      assets: { assetId: string; sha256: string }[];
    };
    assert.equal(
      project.assets.filter((asset) => asset.sha256 === hash).length,
      1,
      "relink must not create a duplicate asset identity",
    );
    assert.equal(project.assets.find((asset) => asset.sha256 === hash)!.assetId, assetId);
  } finally {
    target.dispose();
    targetBlobs.close();
  }
});

test("app controls: object labels and source reference frequency survive undo, save and fresh load without entering Scene v1", async () => {
  const local = storage(),
    options = { storage: local, useWorker: false, assetStagingContext };
  const first = await LabRuntime.create(options);
  let sourceId = "";
  const metadata = (app: LabRuntime) =>
    JSON.parse(app.exportProject()).editorMetadata as {
      objectLabels: { objectId: string; label: string }[];
      sourceReferences: { sourceId: string; referenceFrequencyHz: number }[];
    };
  try {
    await command(first, {
      type: "patchObject",
      objectId: "ball",
      patch: { name: "標籤球 · 版本化作者資料" },
    });
    assert.equal(
      first.getSnapshot().objects.find((object) => object.id === "ball")!.name,
      "標籤球 · 版本化作者資料",
    );
    assert.ok(
      !Object.hasOwn(
        first.getSceneDocument().objects.find((object) => object.id === "ball")!,
        "name",
      ),
      "labels belong to versioned editor metadata, not frozen Scene v1",
    );
    await command(first, { type: "undo" });
    assert.equal(first.getSnapshot().objects.find((object) => object.id === "ball")!.name, "ball");
    await command(first, { type: "redo" });
    assert.equal(
      metadata(first).objectLabels.find((entry) => entry.objectId === "ball")!.label,
      "標籤球 · 版本化作者資料",
    );
    await command(first, { type: "selectObject", objectId: "ball" });
    await command(first, { type: "submitPrompt", prompt: "tone" });
    await command(first, { type: "applyAI" });
    sourceId = first.getSceneDocument().sources.find((source) => source.objectId === "ball")!.id;
    assert.equal(
      metadata(first).sourceReferences.find((entry) => entry.sourceId === sourceId)!
        .referenceFrequencyHz,
      220,
    );
    await command(first, { type: "undo" });
    assert.ok(!first.getSceneDocument().sources.some((source) => source.id === sourceId));
    assert.ok(
      !metadata(first).sourceReferences.some((entry) => entry.sourceId === sourceId),
      "Undo cannot leave a dangling source metadata reference",
    );
    await command(first, { type: "redo" });
    assert.equal(
      metadata(first).sourceReferences.find((entry) => entry.sourceId === sourceId)!
        .referenceFrequencyHz,
      220,
    );
    await command(first, { type: "save" });
    await command(first, {
      type: "patchObject",
      objectId: "ball",
      patch: { name: "未儲存的另一個標籤" },
    });
    await command(first, { type: "load" });
    assert.equal(
      first.getSnapshot().objects.find((object) => object.id === "ball")!.name,
      "標籤球 · 版本化作者資料",
    );
  } finally {
    first.dispose();
  }
  const second = await LabRuntime.create(options);
  try {
    await command(second, { type: "load" });
    assert.equal(
      second.getSnapshot().objects.find((object) => object.id === "ball")!.name,
      "標籤球 · 版本化作者資料",
    );
    assert.equal(
      metadata(second).sourceReferences.find((entry) => entry.sourceId === sourceId)!
        .referenceFrequencyHz,
      220,
    );
    assert.ok(
      !Object.hasOwn(
        second.getSceneDocument().sources.find((source) => source.id === sourceId)!,
        "referenceFrequencyHz",
      ),
    );
  } finally {
    second.dispose();
  }
});
