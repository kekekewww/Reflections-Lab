import { expect, test } from "@playwright/test";

// A same-origin page without the app's HMR client isolates real browser storage tests
// from unrelated application edits. Module requests still use the actual Vite server.
test.beforeEach(async ({ context }) => {
  await context.route("**/persistence-harness", (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/html",
      body: "<!doctype html><title>Persistence browser harness</title>",
    }),
  );
});

test("IndexedDB retains verified encoded audio bytes and raw recording after page reload", async ({
  page,
}) => {
  await page.goto("/persistence-harness");
  const saved = await page.evaluate(async () => {
    const { BlobStore } = await import("/src/persistence/blob-store.ts");
    const { ExperimentRecorder } = await import("/src/experiments/recorder.ts");
    const { createDefaultScene } = await import("/src/app/defaults.ts");
    const databaseName = `persistence-reload-${crypto.randomUUID()}`;
    const store = new BlobStore({ databaseName });
    // A valid one-channel PCM WAV; stored SHA covers these encoded bytes.
    const bytes = new ArrayBuffer(52),
      view = new DataView(bytes);
    const write = (offset: number, value: string) =>
      [...value].forEach((char, index) => view.setUint8(offset + index, char.charCodeAt(0)));
    write(0, "RIFF");
    view.setUint32(4, 44, true);
    write(8, "WAVEfmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, 48000, true);
    view.setUint32(28, 96000, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    write(36, "data");
    view.setUint32(40, 8, true);
    view.setInt16(46, 1200, true);
    const sha256 = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
      .map((v) => v.toString(16).padStart(2, "0"))
      .join("");
    await store.saveAsset({
      assetId: "asset.wav",
      sha256,
      bytes,
      metadata: {
        name: "original.wav",
        origin: "imported",
        license: "Original test fixture",
        revision: 1,
      },
    });
    const scene = createDefaultScene();
    const recorder = new ExperimentRecorder({
      runId: "run.saved",
      sceneSnapshot: scene,
      sourceConfig: scene.sources,
      behaviorConfig: {},
      solverConfig: {},
      atmosphere: { medium: "air", speedOfSoundMps: 343 },
      materialRegistry: [],
      physicsVersion: "test",
      backendVersion: "test",
      fixedDtS: 1 / 60,
      sampleRateHz: 48000,
      createdAt: "2026-10-27T00:00:00.000Z",
    });
    for (let tick = 0; tick < 2; tick++)
      recorder.appendFrame({
        tick,
        sceneRevision: scene.sceneRevision,
        poses: scene.objects.map((object) => ({
          objectId: object.id,
          positionM: object.positionM,
          orientationQuaternion: object.orientationQuaternion,
        })),
        listener: scene.listener,
        physicsEvents: [],
        behaviorDecisions: [],
        audioEvents: [],
      });
    const artifact = await recorder.finish(),
      receipt = await store.saveRecording(artifact);
    const result = {
      databaseName,
      sha256,
      recordingSha256: receipt.sha256,
      encodedSha256: receipt.encodedSha256,
      mode: store.mode,
      capabilities: store.capabilities,
    };
    store.close();
    return result;
  });
  expect(saved.mode).toBe("indexedDB");
  expect(saved.capabilities.persistent).toBe(true);
  expect(saved.encodedSha256).not.toBe(saved.recordingSha256);
  await page.reload();
  const restored = await page.evaluate(async (saved) => {
    const { BlobStore } = await import("/src/persistence/blob-store.ts");
    const { verifyRecording } = await import("/src/experiments/recorder.ts");
    const store = new BlobStore({ databaseName: saved.databaseName });
    const asset = await store.loadAsset("asset.wav", saved.sha256),
      artifact = await store.loadRecording("run.saved", saved.recordingSha256);
    await verifyRecording(artifact!);
    const audio = new OfflineAudioContext(1, 4, 48000);
    const decoded = await audio.decodeAudioData(asset!.bytes.slice(0));
    const result = {
      byteLength: asset!.bytes.byteLength,
      hashKind: asset!.hashKind,
      name: asset!.metadata.name,
      decodedSamples: decoded.length,
      frameCount: artifact!.frames.length,
      lastTick: artifact!.frames.at(-1)!.tick,
    };
    store.close();
    return result;
  }, saved);
  expect(restored).toEqual({
    byteLength: 52,
    hashKind: "encodedBytesSha256",
    name: "original.wav",
    decodedSamples: 4,
    frameCount: 2,
    lastTick: 1,
  });
  const corruptedRecording = await page.evaluate(async (saved) => {
    const { BlobStore } = await import("/src/persistence/blob-store.ts");
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(saved.databaseName, 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction("recordings", "readwrite"),
        recordings = transaction.objectStore("recordings"),
        request = recordings.get(["run.saved", saved.recordingSha256]);
      request.onsuccess = () => {
        const row = request.result;
        new Uint8Array(row.bytes)[0] ^= 1;
        recordings.put(row);
      };
      transaction.oncomplete = () => resolve();
      transaction.onabort = () => reject(transaction.error);
    });
    database.close();
    const store = new BlobStore({ databaseName: saved.databaseName });
    try {
      await store.loadRecording("run.saved", saved.recordingSha256);
      return "accepted-corrupt";
    } catch (error) {
      return (error as { code: string }).code;
    } finally {
      store.close();
    }
  }, saved);
  expect(corruptedRecording).toBe("BLOB_INTEGRITY");
});

test("cross-tab revision conflicts atomically retain one immutable version", async ({
  page,
  context,
}) => {
  const second = await context.newPage();
  await Promise.all([page.goto("/persistence-harness"), second.goto("/persistence-harness")]);
  const databaseName = `persistence-conflict-${Date.now()}`;
  const write = async (target: typeof page, value: number) =>
    target.evaluate(
      async ({ databaseName, value }) => {
        const { BlobStore } = await import("/src/persistence/blob-store.ts");
        const store = new BlobStore({ databaseName }),
          bytes = new Uint8Array([value, 2, 3, 4]).buffer;
        const sha256 = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
          .map((v) => v.toString(16).padStart(2, "0"))
          .join("");
        try {
          await store.saveAsset({
            assetId: "asset.same",
            sha256,
            bytes,
            metadata: { name: "source", origin: "imported", license: "fixture", revision: 1 },
          });
          return { status: "saved", sha256, value };
        } catch (error) {
          return { status: (error as { code: string }).code, sha256, value };
        } finally {
          store.close();
        }
      },
      { databaseName, value },
    );
  const results = await Promise.all([write(page, 1), write(second, 9)]);
  expect(results.map((result) => result.status).sort()).toEqual(["REVISION_CONFLICT", "saved"]);
  const loaded = await page.evaluate(
    async ({ databaseName, results }) => {
      const { BlobStore } = await import("/src/persistence/blob-store.ts");
      const store = new BlobStore({ databaseName });
      const values = await Promise.all(
        results.map(async (result) => {
          const asset = await store.loadAsset("asset.same", result.sha256);
          return asset ? new Uint8Array(asset.bytes)[0] : null;
        }),
      );
      store.close();
      return values;
    },
    { databaseName, results },
  );
  expect(loaded).toEqual(
    results.map((result) => (result.status === "saved" ? result.value : null)),
  );
  await second.close();
});

test("concurrent connections serialize aggregate caps and aborted writes preserve capacity", async ({
  page,
}) => {
  await page.goto("/persistence-harness");
  const result = await page.evaluate(async () => {
    const { BlobStore } = await import("/src/persistence/blob-store.ts");
    const databaseName = `persistence-budget-${crypto.randomUUID()}`;
    const first = new BlobStore({ databaseName, limits: { maxTotalBytes: 4 } }),
      second = new BlobStore({ databaseName, limits: { maxTotalBytes: 4 } });
    const bytes = new Uint8Array([1, 2, 3, 4]).buffer;
    const sha256 = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
      .map((v) => v.toString(16).padStart(2, "0"))
      .join("");
    const input = {
      sha256,
      bytes,
      metadata: { name: "source", origin: "imported" as const, license: "fixture", revision: 1 },
    };
    const writes = await Promise.allSettled([
      first.saveAsset({ ...input, assetId: "asset.one" }),
      second.saveAsset({ ...input, assetId: "asset.two" }),
    ]);
    const statuses = writes.map((write) =>
      write.status === "fulfilled" ? "saved" : String((write.reason as { code: string }).code),
    );
    const present = await Promise.all(
      ["asset.one", "asset.two"].map(async (id) => Boolean(await first.loadAsset(id, sha256))),
    );
    // The failed cap transaction must leave both prior bytes and aggregate accounting intact.
    await first.saveAsset({ ...input, assetId: present[0] ? "asset.one" : "asset.two" });
    first.close();
    second.close();
    return { statuses, present };
  });
  expect(result.statuses.sort()).toEqual(["BLOB_BUDGET", "saved"]);
  expect(result.present.filter(Boolean)).toHaveLength(1);
});

test("tampered IndexedDB bytes are rejected and failed new writes retain the previous asset", async ({
  page,
}) => {
  await page.goto("/persistence-harness");
  const result = await page.evaluate(async () => {
    const { BlobStore } = await import("/src/persistence/blob-store.ts");
    const databaseName = `persistence-corrupt-${crypto.randomUUID()}`,
      store = new BlobStore({ databaseName });
    const bytes = new Uint8Array([1, 2, 3, 4]).buffer;
    const sha256 = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
      .map((v) => v.toString(16).padStart(2, "0"))
      .join("");
    const input = {
      assetId: "asset.original",
      sha256,
      bytes,
      metadata: { name: "source", origin: "imported" as const, license: "fixture", revision: 1 },
    };
    await store.saveAsset(input);
    const originalAdd = IDBObjectStore.prototype.add;
    IDBObjectStore.prototype.add = function (...args) {
      this.transaction.abort();
      return originalAdd.apply(this, args);
    };
    let failed = "";
    try {
      await store.saveAsset({ ...input, assetId: "asset.failed" });
    } catch (error) {
      failed = (error as { code: string }).code;
    } finally {
      IDBObjectStore.prototype.add = originalAdd;
    }
    const preserved = [...new Uint8Array((await store.loadAsset(input.assetId, sha256))!.bytes)];
    const unavailable = await store.loadAsset("asset.failed", sha256);
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(databaseName, 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction("assets", "readwrite"),
        assets = transaction.objectStore("assets"),
        request = assets.get([input.assetId, sha256]);
      request.onsuccess = () => {
        const row = request.result;
        new Uint8Array(row.bytes)[0] = 99;
        assets.put(row);
      };
      transaction.oncomplete = () => resolve();
      transaction.onabort = () => reject(transaction.error);
    });
    database.close();
    let corrupt = "";
    try {
      await store.loadAsset(input.assetId, sha256);
    } catch (error) {
      corrupt = (error as { code: string }).code;
    }
    await store.saveAsset(input);
    const repaired = [...new Uint8Array((await store.loadAsset(input.assetId, sha256))!.bytes)];
    const stateDatabase = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(databaseName, 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise<void>((resolve, reject) => {
      const transaction = stateDatabase.transaction("state", "readwrite");
      transaction.objectStore("state").put(null, "budget");
      transaction.oncomplete = () => resolve();
      transaction.onabort = () => reject(transaction.error);
    });
    stateDatabase.close();
    let malformedBudget = "";
    try {
      await store.saveAsset({ ...input, assetId: "asset.budget-corrupt" });
    } catch (error) {
      malformedBudget = (error as { code: string }).code;
    }
    const rejectedBudgetBytes = await store.loadAsset("asset.budget-corrupt", sha256);
    store.close();
    return {
      failed,
      preserved,
      unavailable,
      corrupt,
      repaired,
      malformedBudget,
      rejectedBudgetBytes,
    };
  });
  expect(result.failed).toBe("BLOB_STORAGE_WRITE");
  expect(result.preserved).toEqual([1, 2, 3, 4]);
  expect(result.unavailable).toBeNull();
  expect(result.corrupt).toBe("BLOB_INTEGRITY");
  expect(result.repaired).toEqual([1, 2, 3, 4]);
  expect(result.malformedBudget).toBe("BLOB_INTEGRITY");
  expect(result.rejectedBudgetBytes).toBeNull();
});

test("known builtin descriptor regeneration matches actual AudioAssetStore PCM in Chrome", async ({
  page,
}) => {
  await page.goto("/persistence-harness");
  const results = await page.evaluate(async () => {
    const { AudioAssetStore } = await import("/src/audio/assets.ts");
    const { DEFAULT_AUDIO_BUDGET } = await import("/src/audio/control.ts");
    const { regenerateBuiltinAsset } = await import("/src/persistence/blob-store.ts");
    const results: { id: string; rate: number; equal: boolean; sha256: string }[] = [];
    for (const rate of [44100, 48000] as const) {
      const context = new OfflineAudioContext(1, 10, rate),
        store = new AudioAssetStore(context, DEFAULT_AUDIO_BUDGET);
      for (const descriptor of await store.registerBuiltins()) {
        const regenerated = await regenerateBuiltinAsset({
          assetId: descriptor.assetId,
          revision: descriptor.revision,
          sha256: descriptor.sha256!,
          hashKind: "float32MonoPcmBytesSha256",
          name: descriptor.name,
          mimeType: "audio/x-float32-pcm",
          byteLength: descriptor.decodedBytes,
          storage: "generatedDescriptor",
          rights: { license: descriptor.license, source: "builtin" },
          generator: {
            algorithm: `${descriptor.assetId}-v1` as
              | "builtin-tone-v1"
              | "builtin-impact-v1"
              | "builtin-whoosh-v1",
            durationSeconds: descriptor.durationSeconds,
            sampleRateHz: rate,
          },
        });
        const expected = store.get(descriptor.assetId)!.buffer.getChannelData(0);
        results.push({
          id: descriptor.assetId,
          rate,
          equal: regenerated!.bytesPCM.every((value, i) => value === expected[i]),
          sha256: regenerated!.sha256,
        });
      }
    }
    return results;
  });
  expect(results).toHaveLength(6);
  expect(results.every((result) => result.equal && /^[a-f0-9]{64}$/.test(result.sha256))).toBe(
    true,
  );
});
