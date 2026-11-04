import assert from "node:assert/strict";
import test from "node:test";
import { AssetHost, type AssetStagingContext } from "../../src/app/asset-host.js";
import { StaticPreviewHost, type StaticPreviewInput } from "../../src/app/static-preview.js";
import { AudioEngine } from "../../src/audio/engine.js";
import type { AudioAssetLease } from "../../src/audio/asset-leases.js";
import type { AudioAssetDescriptor, AudioEngineOptions } from "../../src/audio/types.js";
import { BlobStore } from "../../src/persistence/blob-store.js";
import {
  createDefaultScene,
  createDefaultBehaviors,
  DEFAULT_MATERIALS,
} from "../../src/app/defaults.js";
import { FakeAudioBuffer, FakeAudioContext } from "../audio-runtime/fake-context.js";

// These are real host/store/native-graph ownership tests using a control-graph fake.
// Fake context history may retain buffers; known host bytes do not prove process RAM or GC.
function deferred() {
  let open!: () => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<void>((resolve, refuse) => {
    open = resolve;
    reject = refuse;
  });
  // The gate is independently awaited by cleanup and the disposal-completion seam.
  void promise.catch(() => {});
  return { promise, open, reject };
}
async function poll(check: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 200 && !check(); attempt++)
    await new Promise<void>((resolve) => setTimeout(resolve, 2));
}
class DeferredCloseContext extends FakeAudioContext {
  readonly closeGate = deferred();
  readonly closed = deferred();
  closeStarted = false;
  closeCalls = 0;
  rejectClose = false;
  close(): Promise<void> {
    this.closeStarted = true;
    this.closeCalls++;
    const completion = (async () => {
      try {
        await this.closeGate.promise;
        if (this.rejectClose) throw new Error("PREVIEW_FIXTURE_CLOSE");
        await super.close();
        this.closed.open();
      } catch (error) {
        this.closed.reject(error);
        throw error;
      }
    })();
    // Old engines intentionally fire-and-forget close; the explicit completion seam
    // below still propagates this rejection without an unrelated unhandled rejection.
    void completion.catch(() => {});
    return completion;
  }
}
function wave(): ArrayBuffer {
  const bytes = new ArrayBuffer(60),
    view = new DataView(bytes);
  const tag = (offset: number, text: string) =>
    [...text].forEach((value, index) => view.setUint8(offset + index, value.charCodeAt(0)));
  tag(0, "RIFF");
  view.setUint32(4, 52, true);
  tag(8, "WAVEfmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, 48000, true);
  view.setUint32(28, 96000, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  tag(36, "data");
  view.setUint32(40, 16, true);
  for (let frame = 0; frame < 8; frame++) view.setInt16(44 + frame * 2, 1000, true);
  return bytes;
}
function staging(sampleRate: number): AssetStagingContext {
  return {
    sampleRate,
    createBuffer: (channels, frames, rate) =>
      new FakeAudioBuffer(channels, frames, rate) as unknown as AudioBuffer,
    decodeAudioData: async (bytes) => {
      const buffer = new FakeAudioBuffer(
        1,
        new DataView(bytes).getUint32(40, true) / 2,
        sampleRate,
      );
      buffer.getChannelData(0).fill(1000 / 32768);
      return buffer as unknown as AudioBuffer;
    },
  };
}
function input(asset?: AudioAssetDescriptor): StaticPreviewInput {
  const scene = createDefaultScene(),
    document = createDefaultBehaviors(scene);
  if (asset) {
    const pin = { assetId: asset.assetId, revision: asset.revision, sha256: asset.sha256! };
    document.assets = [pin];
    document.profiles.find(
      (profile) => profile.profileId === "profile.continuous-tone",
    )!.rules[0]!.generator = {
      kind: "sample",
      asset: pin,
      loop: false,
      startOffsetSeconds: 0,
    };
  }
  return {
    state: "paused",
    scene,
    document,
    poses: scene.objects.map((object) => ({
      objectId: object.id,
      positionM: [...object.positionM],
      orientationQuaternion: [...object.orientationQuaternion],
    })),
    objectId: "speaker",
    generation: 1,
    bindingId: "binding.continuous.speaker",
    ruleId: "rule.always",
    tick: 12,
    listener: scene.listener,
    materials: DEFAULT_MATERIALS,
    atmosphere: {
      medium: "air",
      speedOfSoundMps: 343,
      bandAbsorptionDbPerM: DEFAULT_MATERIALS[0]!.bands.map(() => 0),
      dataClass: "Synthetic",
    },
    durationSeconds: 2,
  };
}
async function fixture(
  options: {
    borrowGate?: ReturnType<typeof deferred>;
    refuseAdmission?: boolean;
    refuseFirstAdmission?: boolean;
    rejectFirstClose?: boolean;
  } = {},
) {
  const sourceContext = new FakeAudioContext(),
    source = new AudioEngine({ context: sourceContext.asContext() });
  await source.enable(0);
  const store = new BlobStore({ indexedDB: null });
  // The main source's legacy bank is intentionally separate; dispose it before byte oracles.
  const assets = new AssetHost({ store, getEngine: () => null, createStagingContext: staging });
  const descriptor = await assets.importFile(
    new File([wave()], "original-preview.wav", { type: "audio/wav" }),
    true,
  );
  source.registerBuffer(descriptor.assetId, assets.getAssetBank()[0]!.buffer, {
    name: descriptor.name,
    origin: descriptor.origin,
    license: descriptor.license,
    revision: descriptor.revision,
    sha256: descriptor.sha256!,
  });
  const contexts: DeferredCloseContext[] = [];
  const priorContext = Object.getOwnPropertyDescriptor(globalThis, "AudioContext");
  Object.defineProperty(globalThis, "AudioContext", {
    configurable: true,
    writable: true,
    value: class extends DeferredCloseContext {
      constructor() {
        super();
        this.rejectClose = Boolean(options.rejectFirstClose && contexts.length === 0);
        contexts.push(this);
      }
    },
  });
  const requested: string[][] = [];
  const leases: AudioAssetLease[] = [];
  const hostOptions = {
    getEngine: () => source,
    createEngine: (settings: AudioEngineOptions) => {
      // No injected context: this genuine engine owns the fake device and must await close().
      const contextIndex = contexts.length;
      const engine = new AudioEngine(settings);
      // Compatibility disposal-completion seam until the audio owner's engine change is merged.
      // It invokes genuine disposal and waits for the owned fake context's actual close completion;
      // this fixture does not independently validate AudioEngine.disposeAsync or native rendering.
      const lifecycle = engine as AudioEngine & { disposeAsync?: () => Promise<void> };
      if (!lifecycle.disposeAsync) {
        const dispose = engine.dispose.bind(engine);
        let completion: Promise<void> | null = null;
        lifecycle.disposeAsync = () => {
          if (!completion) {
            dispose();
            completion = contexts[contextIndex]?.closed.promise ?? Promise.resolve();
          }
          return completion;
        };
      }
      if (options.refuseAdmission || (options.refuseFirstAdmission && contextIndex === 0))
        engine.playVoice = () => ({ accepted: false, reason: "PREVIEW_FIXTURE_ADMISSION" });
      return engine;
    },
    acquireAssetBank: async (assetIds: readonly string[]) => {
      requested.push([...assetIds]);
      const lease = await assets.acquireAssetBank("static-preview", assetIds);
      leases.push(lease);
      if (options.borrowGate) await options.borrowGate.promise;
      return lease;
    },
  };
  const preview = new StaticPreviewHost(hostOptions);
  return {
    source,
    sourceContext,
    store,
    assets,
    descriptor,
    contexts,
    requested,
    leases,
    preview,
    active(): AudioAssetLease {
      assert.ok(leases.length > 0, "static preview must acquire the real AssetHost scoped bank");
      const lease = leases.at(-1)!;
      assert.equal(
        lease.released,
        false,
        "preview must retain the real scoped lease while its context owns PCM",
      );
      return lease;
    },
    async cleanup(...pending: (Promise<unknown> | undefined)[]) {
      options.borrowGate?.open();
      for (const context of contexts) context.closeGate.open();
      preview.dispose();
      for (const context of contexts) context.closeGate.open();
      await Promise.allSettled(
        pending.filter((value): value is Promise<unknown> => Boolean(value)),
      );
      for (const context of contexts) context.closeGate.open();
      await preview.stop().catch(() => {});
      source.dispose();
      // Assertions run before this failure cleanup; never let RED leave a genuine lease pinned.
      for (const lease of leases) lease.release();
      assets.dispose();
      store.close();
      if (priorContext) Object.defineProperty(globalThis, "AudioContext", priorContext);
      else Reflect.deleteProperty(globalThis, "AudioContext");
    },
  };
}

// Extra options remain structurally assignable before the optional production seam exists.
// Passing the variable rather than an inline literal avoids a fixture-only excess-property error.

test("sample static preview pins real PCM through native drain and asynchronous owned context close", async () => {
  const f = await fixture();
  let stopping: Promise<void> | undefined;
  try {
    const request = input(f.descriptor),
      original = structuredClone(request);
    assert.equal((await f.preview.start(request))?.status, "playing");
    const lease = f.active();
    assert.deepEqual(f.requested, [[f.descriptor.assetId]]);
    assert.equal(f.assets.getResidency().leasedBytes, 32);
    assert.equal(
      f.sourceContext.sources().length,
      0,
      "preview cannot start the main engine's source graph",
    );
    f.source.dispose();
    assert.deepEqual(f.assets.evictUnused().evictedAssetIds, []);
    assert.equal(f.assets.getResidency().retainedBytes, 32);
    let stopped = false;
    stopping = f.preview.stop().finally(() => {
      stopped = true;
    });
    await poll(() => f.contexts[0]!.closeStarted || stopped);
    assert.equal(f.contexts[0]!.closeStarted, true, "preview must close its owned context");
    assert.equal(stopped, false, "stop must await owned-context close, not only start it");
    assert.equal(lease.released, false);
    assert.equal(f.assets.evictUnused().releasedBytes, 0);
    f.contexts[0]!.closeGate.open();
    await stopping;
    assert.equal(lease.released, true);
    assert.equal(f.assets.getResidency().leaseCount, 0);
    assert.equal(f.assets.evictUnused().releasedBytes, 32);
    assert.equal(f.assets.getResidency().retainedBytes, 0);
    assert.deepEqual(request, original, "preview cannot author new scene/behavior data");
  } finally {
    await f.cleanup(stopping);
  }
});

test("oscillator static preview requests an empty bank and does not pin unrelated decoded samples", async () => {
  const f = await fixture();
  let stopping: Promise<void> | undefined;
  try {
    await f.preview.start(input());
    const lease = f.active();
    assert.deepEqual(f.requested, [[]]);
    assert.deepEqual(lease.entries, []);
    assert.equal(f.assets.getResidency().leasedBytes, 0);
    f.source.dispose();
    assert.equal(
      f.assets.evictUnused().releasedBytes,
      32,
      "oscillator borrows cannot pin unused sample PCM",
    );
    stopping = f.preview.stop();
    await poll(() => f.contexts[0]!.closeStarted);
    assert.equal(lease.released, false, "even an empty scoped bank has a bounded owner lifetime");
    f.contexts[0]!.closeGate.open();
    await stopping;
    assert.equal(lease.released, true);
  } finally {
    await f.cleanup(stopping);
  }
});

test("failed static preview admission holds PCM until failure cleanup has closed its context", async () => {
  const f = await fixture({ refuseAdmission: true });
  const starting = f.preview.start(input(f.descriptor)).then(
    () => null,
    (error: unknown) => error,
  );
  try {
    await poll(() => f.contexts[0]?.closeStarted ?? false);
    const lease = f.active();
    assert.equal(f.contexts[0]!.closeStarted, true);
    assert.equal(lease.released, false);
    f.source.dispose();
    assert.equal(f.assets.evictUnused().releasedBytes, 0);
    f.contexts[0]!.closeGate.open();
    assert.match(String(await starting), /PREVIEW_FIXTURE_ADMISSION/);
    await poll(() => lease.released);
    assert.equal(lease.released, true);
    assert.equal(f.assets.evictUnused().releasedBytes, 32);
    assert.equal(f.contexts[0]!.sources().length, 0);
  } finally {
    await f.cleanup(starting);
  }
});

for (const cancel of ["stop", "dispose"] as const) {
  test(`late static preview acquisition after ${cancel} returns its real lease without starting a source`, async () => {
    const borrowGate = deferred(),
      f = await fixture({ borrowGate });
    let settled = false,
      stopping: Promise<void> | undefined;
    const starting = f.preview.start(input(f.descriptor)).then(
      (value) => {
        settled = true;
        return value;
      },
      (error: unknown) => {
        settled = true;
        return error;
      },
    );
    try {
      await poll(() => f.leases.length > 0 || settled);
      const lease = f.active();
      assert.equal(settled, false, "the genuine scoped acquisition is still pending delivery");
      assert.equal(
        f.contexts.reduce(
          (sum, context) =>
            sum + context.sources().reduce((starts, source) => starts + source.starts.length, 0),
          0,
        ),
        0,
      );
      if (cancel === "stop") stopping = f.preview.stop();
      else f.preview.dispose();
      borrowGate.open();
      assert.equal(await starting, null);
      await poll(() => f.contexts[0]?.closeStarted ?? false);
      assert.equal(f.contexts[0]!.closeStarted, true);
      assert.equal(
        lease.released,
        false,
        "late borrow cannot be released while old native close is pending",
      );
      f.source.dispose();
      assert.equal(f.assets.evictUnused().releasedBytes, 0);
      f.contexts[0]!.closeGate.open();
      await stopping;
      await poll(() => lease.released);
      assert.equal(lease.released, true);
      assert.equal(
        f.contexts.reduce(
          (sum, context) =>
            sum + context.sources().reduce((starts, source) => starts + source.starts.length, 0),
          0,
        ),
        0,
      );
      assert.equal(f.assets.evictUnused().releasedBytes, 32);
    } finally {
      borrowGate.open();
      await f.cleanup(starting, stopping);
    }
  });
}

test("replacement keeps the old preview lease until its own close and cannot release the new lease", async () => {
  const f = await fixture();
  let replacing: Promise<unknown> | undefined, stopping: Promise<void> | undefined;
  try {
    await f.preview.start(input(f.descriptor));
    const old = f.active();
    replacing = f.preview.start(input(f.descriptor)).catch((error: unknown) => error);
    await poll(() => f.contexts[0]!.closeStarted);
    assert.equal(f.contexts[0]!.closeStarted, true);
    assert.equal(old.released, false);
    assert.equal(f.assets.evictUnused().releasedBytes, 0);
    f.contexts[0]!.closeGate.open();
    await replacing;
    await poll(() => old.released);
    assert.equal(old.released, true);
    const current = f.active();
    assert.notEqual(current, old);
    assert.equal(f.assets.getResidency().leaseCount, 1);
    assert.equal(f.assets.getResidency().leasedBytes, 32);
    f.source.dispose();
    assert.equal(f.assets.evictUnused().releasedBytes, 0);
    stopping = f.preview.stop();
    await poll(() => f.contexts[1]!.closeStarted);
    assert.equal(current.released, false);
    f.contexts[1]!.closeGate.open();
    await stopping;
    assert.equal(current.released, true);
    assert.equal(f.assets.evictUnused().releasedBytes, 32);
  } finally {
    await f.cleanup(replacing, stopping);
  }
});

test("an older admission failure cannot overwrite a replacement preview after delayed cleanup", async () => {
  const f = await fixture({ refuseFirstAdmission: true });
  const first = f.preview.start(input(f.descriptor)).then(
    (value) => value,
    (error: unknown) => error,
  );
  try {
    await poll(() => f.contexts[0]?.closeStarted ?? false);
    assert.equal(f.contexts[0]!.closeStarted, true);
    const oldLease = f.active();
    assert.equal(oldLease.released, false);
    const second = await f.preview.start(input(f.descriptor));
    assert.equal(second?.status, "playing");
    const current = f.active();
    const replacementView = f.preview.getView();
    assert.notEqual(current, oldLease);
    f.contexts[0]!.closeGate.open();
    await first;
    assert.equal(oldLease.released, true);
    assert.equal(current.released, false);
    assert.equal(
      f.preview.getView().status,
      "playing",
      "old failure cleanup cannot change the current preview status",
    );
    assert.deepEqual(f.preview.getView().metadata, replacementView.metadata);
    assert.equal(
      f.preview.getView().error,
      null,
      "a replacement cannot inherit the old admission error",
    );
  } finally {
    await f.cleanup(first);
  }
});

test("an older stop close failure preserves its pin without overwriting a newer playing preview", async () => {
  const f = await fixture({ rejectFirstClose: true });
  let stopping: Promise<unknown> | undefined;
  try {
    await f.preview.start(input(f.descriptor));
    const oldLease = f.active();
    stopping = f.preview.stop().then(
      () => null,
      (error: unknown) => error,
    );
    await poll(() => f.contexts[0]!.closeStarted);
    assert.equal(f.contexts[0]!.closeStarted, true);
    const second = await f.preview.start(input(f.descriptor));
    assert.equal(second?.status, "playing");
    const current = f.active(),
      replacementView = f.preview.getView();
    assert.notEqual(current, oldLease);
    f.contexts[0]!.closeGate.open();
    assert.match(String(await stopping), /PREVIEW_FIXTURE_CLOSE/);
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.equal(oldLease.released, false, "failed context close must keep the old borrow pinned");
    assert.equal(current.released, false);
    assert.equal(
      f.preview.getView().status,
      "playing",
      "late old stop failure cannot overwrite the current generation",
    );
    assert.deepEqual(f.preview.getView().metadata, replacementView.metadata);
    assert.equal(f.preview.getView().error, null);
    f.source.dispose();
    assert.equal(
      f.assets.evictUnused().releasedBytes,
      0,
      "both retained scopes still protect the shared sample PCM",
    );
    assert.equal(f.assets.getResidency().leasedBytes, 32);
  } finally {
    await f.cleanup(stopping);
  }
});

test("a third scoped replacement waits for a real close slot without exceeding two live contexts", async () => {
  const f = await fixture();
  let third:
    | Promise<{ value?: Awaited<ReturnType<StaticPreviewHost["start"]>>; error?: unknown }>
    | undefined;
  try {
    await f.preview.start(input(f.descriptor));
    const firstLease = f.active();
    await f.preview.start(input(f.descriptor));
    const secondLease = f.active();
    assert.equal(f.contexts.length, 2);
    let settled = false;
    third = f.preview.start(input(f.descriptor)).then(
      (value) => {
        settled = true;
        return { value };
      },
      (error: unknown) => {
        settled = true;
        return { error };
      },
    );
    await poll(() => f.contexts[0]!.closeStarted || settled);
    assert.equal(
      settled,
      false,
      "replacement must await a retiring slot rather than reject the valid request",
    );
    assert.equal(
      f.contexts.length,
      2,
      "pending owned closes cannot be bypassed by creating a third context",
    );
    assert.equal(firstLease.released, false);
    assert.equal(secondLease.released, false);
    f.contexts[0]!.closeGate.open();
    const result = await third;
    assert.equal(result.error, undefined);
    assert.equal(result.value?.status, "playing");
    assert.equal(
      f.contexts.length,
      3,
      "the replacement starts after the first context actually closes",
    );
    assert.ok(f.contexts.filter((context) => context.state !== "closed").length <= 2);
    assert.equal(firstLease.released, true);
    assert.equal(
      secondLease.released,
      false,
      "the next retiring lease is not released before its own close",
    );
    const current = f.active();
    assert.notEqual(current, secondLease);
    assert.equal(f.assets.getResidency().leaseCount, 2);
    assert.equal(f.assets.getResidency().leasedBytes, 32);
  } finally {
    await f.cleanup(third);
  }
});

for (const cancel of ["stop", "dispose"] as const) {
  test(`a capacity-waiting preview is cancelled by ${cancel} before any late third context is created`, async () => {
    const f = await fixture();
    let third:
      | Promise<{ value?: Awaited<ReturnType<StaticPreviewHost["start"]>>; error?: unknown }>
      | undefined;
    let stopping: Promise<void> | undefined;
    try {
      await f.preview.start(input(f.descriptor));
      await f.preview.start(input(f.descriptor));
      let settled = false;
      third = f.preview.start(input(f.descriptor)).then(
        (value) => {
          settled = true;
          return { value };
        },
        (error: unknown) => {
          settled = true;
          return { error };
        },
      );
      await poll(() => f.contexts[0]!.closeStarted || settled);
      assert.equal(settled, false, "the capacity-waiting replacement must remain cancellable");
      assert.equal(f.contexts.length, 2);
      if (cancel === "stop") stopping = f.preview.stop();
      else f.preview.dispose();
      for (const context of f.contexts) context.closeGate.open();
      const result = await third;
      assert.equal(result.error, undefined);
      assert.equal(result.value, null);
      await stopping;
      await poll(() => f.leases.every((lease) => lease.released));
      assert.ok(f.leases.every((lease) => lease.released));
      assert.equal(
        f.contexts.length,
        2,
        "cancelled capacity waiting cannot create a late context or source",
      );
      assert.notEqual(f.preview.getView().status, "playing");
    } finally {
      await f.cleanup(third, stopping);
    }
  });
}

test("dispose synchronously disconnects the active graph while retaining its PCM lease until close completes", async () => {
  const f = await fixture();
  try {
    await f.preview.start(input(f.descriptor));
    const lease = f.active();
    const voices = f.contexts[0]!.sources();
    assert.ok(voices.some((voice) => voice.connections.length > 0));
    f.source.dispose();
    f.preview.dispose();
    assert.ok(
      voices.every((voice) => voice.connections.length === 0),
      "synchronous disposal cannot leave an active native source connected",
    );
    assert.equal(
      lease.released,
      false,
      "disconnect is not proof that owned context close completed",
    );
    assert.equal(f.assets.evictUnused().releasedBytes, 0);
    f.contexts[0]!.closeGate.open();
    await f.preview.stop();
    assert.equal(lease.released, true);
    assert.equal(f.assets.evictUnused().releasedBytes, 32);
  } finally {
    await f.cleanup();
  }
});

test("queued replacement close rejection preserves its slot and PCM without creating a third context", async () => {
  const f = await fixture({ rejectFirstClose: true });
  let third:
    | Promise<{ value?: Awaited<ReturnType<StaticPreviewHost["start"]>>; error?: unknown }>
    | undefined;
  try {
    await f.preview.start(input(f.descriptor));
    const oldLease = f.active();
    await f.preview.start(input(f.descriptor));
    let settled = false;
    third = f.preview.start(input(f.descriptor)).then(
      (value) => {
        settled = true;
        return { value };
      },
      (error: unknown) => {
        settled = true;
        return { error };
      },
    );
    await poll(() => f.contexts[0]!.closeStarted || settled);
    assert.equal(settled, false, "a full pool waits for its real close result");
    f.contexts[0]!.closeGate.open();
    assert.match(String((await third).error), /PREVIEW_FIXTURE_CLOSE/);
    assert.equal(
      f.contexts.length,
      2,
      "a failed close cannot be counted as an available context slot",
    );
    assert.equal(oldLease.released, false);
    assert.equal(f.assets.getResidency().leasedBytes, 32);
    f.source.dispose();
    assert.equal(f.assets.evictUnused().releasedBytes, 0);
  } finally {
    await f.cleanup(third);
  }
});

test("the newest capacity-waiting request supersedes an older request without an extra context or stale view", async () => {
  const f = await fixture();
  let older:
    | Promise<{ value?: Awaited<ReturnType<StaticPreviewHost["start"]>>; error?: unknown }>
    | undefined;
  let newer:
    | Promise<{ value?: Awaited<ReturnType<StaticPreviewHost["start"]>>; error?: unknown }>
    | undefined;
  try {
    await f.preview.start(input(f.descriptor));
    await f.preview.start(input(f.descriptor));
    const oldInput = input(f.descriptor),
      newInput = input(f.descriptor);
    oldInput.tick = 13;
    newInput.tick = 14;
    let oldSettled = false,
      newSettled = false;
    older = f.preview.start(oldInput).then(
      (value) => {
        oldSettled = true;
        return { value };
      },
      (error: unknown) => {
        oldSettled = true;
        return { error };
      },
    );
    await poll(() => f.contexts[0]!.closeStarted || oldSettled);
    assert.equal(oldSettled, false);
    newer = f.preview.start(newInput).then(
      (value) => {
        newSettled = true;
        return { value };
      },
      (error: unknown) => {
        newSettled = true;
        return { error };
      },
    );
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.equal(newSettled, false);
    assert.equal(f.contexts.length, 2);
    f.contexts[0]!.closeGate.open();
    const oldResult = await older,
      newResult = await newer;
    assert.equal(oldResult.error, undefined);
    assert.equal(oldResult.value, null, "a superseded waiter cannot create a late native source");
    assert.equal(newResult.error, undefined);
    assert.equal(newResult.value?.status, "playing");
    assert.equal(f.preview.getView().metadata?.poseTick, 14);
    assert.equal(f.contexts.length, 3, "only the latest waiting request creates one replacement");
    assert.equal(f.requested.length, 3, "a superseded capacity waiter never borrows or starts");
    assert.ok(f.contexts.filter((context) => context.state !== "closed").length <= 2);
  } finally {
    await f.cleanup(older, newer);
  }
});
