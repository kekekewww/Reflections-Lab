import assert from "node:assert/strict";
import test from "node:test";
import { AudioAssetStore } from "../../src/audio/assets.js";
import { makeBudget } from "../../src/audio/control.js";
import {
  AudioEngineError,
  type AudioAssetBankEntry,
  type AudioAssetMetadata,
} from "../../src/audio/types.js";
import { FakeAudioBuffer, FakeAudioContext } from "./fake-context.js";

// These are ownership/accounting tests. The fake context does not render PCM or prove GC.
const metadata: AudioAssetMetadata = {
  name: "Original asset lease fixture",
  origin: "generated",
  license: "PROJECT_GENERATED_TEST_FIXTURE",
  revision: 1,
  sha256: "a".repeat(64),
};
const hasCode =
  (code: string) =>
  (error: unknown): boolean =>
    error instanceof AudioEngineError && error.code === code;
function buffer(frames = 32, channels = 1, rate = 48000): AudioBuffer {
  return new FakeAudioBuffer(channels, frames, rate) as unknown as AudioBuffer;
}
function entry(assetId: string, pcm = buffer(), revision = 1): AudioAssetBankEntry {
  return {
    assetId,
    buffer: pcm,
    metadata: { ...metadata, revision, sha256: revision === 1 ? "a".repeat(64) : "b".repeat(64) },
  };
}
function register(store: AudioAssetStore, value: AudioAssetBankEntry): void {
  store.register(value.assetId, value.buffer, value.metadata);
}
function wave(frames = 32): ArrayBuffer {
  const bytes = new Uint8Array(44 + frames * 2),
    view = new DataView(bytes.buffer);
  for (const [offset, label] of [
    [0, "RIFF"],
    [8, "WAVE"],
    [12, "fmt "],
    [36, "data"],
  ] as const)
    for (let index = 0; index < label.length; index++)
      bytes[offset + index] = label.charCodeAt(index);
  view.setUint32(4, bytes.length - 8, true);
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, 48000, true);
  view.setUint32(28, 96000, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  view.setUint32(40, frames * 2, true);
  return bytes.buffer;
}
class DeferredDecodeContext extends FakeAudioContext {
  calls = 0;
  private enteredResolve!: () => void;
  readonly entered = new Promise<void>((resolve) => {
    this.enteredResolve = resolve;
  });
  private finishResolve: ((value: AudioBuffer) => void) | null = null;
  private finishReject: ((error: Error) => void) | null = null;
  decodeAudioData(): Promise<AudioBuffer> {
    this.calls++;
    return new Promise((resolve, reject) => {
      this.finishResolve = resolve;
      this.finishReject = reject;
      this.enteredResolve();
    });
  }
  finish(): void {
    assert.ok(this.finishResolve);
    this.finishResolve(buffer());
  }
  fail(): void {
    assert.ok(this.finishReject);
    this.finishReject(new Error("Native decoder fixture failure"));
  }
}

test("overlapping active, retiring, pending, frozen, recording and offline leases protect PCM", () => {
  const store = new AudioAssetStore(null, makeBudget({ maxDecodedBytes: 512 }));
  register(store, entry("lease-shared"));
  const leases = ["active", "retiring", "pending", "frozen", "recording", "offline"].map((reason) =>
    store.acquire(["lease-shared"], reason),
  );
  assert.equal(store.getResidency().leaseCount, 6);
  assert.equal(store.getResidency().leasedBytes, 128, "overlapping borrowers share actual PCM");
  assert.equal(store.getResidency().retainedBytes, 128);
  for (const lease of leases.slice(0, -1)) {
    lease.release();
    assert.equal(lease.released, true);
    assert.equal(
      lease.entries.length,
      0,
      "a released lease must relinquish its own strong entries",
    );
    assert.deepEqual(store.evictUnused().evictedAssetIds, []);
    assert.ok(store.get("lease-shared"));
  }
  const last = leases.at(-1)!;
  assert.equal(last.entries[0]?.metadata.sha256, metadata.sha256);
  assert.equal(last.entries[0]?.buffer.sampleRate, 48000);
  assert.equal(last.entries[0]?.buffer.numberOfChannels, 1);
  last.release();
  last.release();
  assert.equal(store.getResidency().leaseCount, 0);
  const eviction = store.evictUnused();
  assert.deepEqual(eviction.evictedAssetIds, ["lease-shared"]);
  assert.equal(eviction.releasedBytes, 128);
  assert.equal(store.get("lease-shared"), undefined);
  assert.equal(store.getResidency().retainedBytes, 0);
});

test("legacy engine in-use callback protects each lifecycle phase until drain", () => {
  for (const phase of ["active", "retiring", "pending", "frozen", "resume"] as const) {
    let inUse = true;
    const store = new AudioAssetStore(null, makeBudget(), (id) => id === phase && inUse);
    register(store, entry(phase));
    assert.deepEqual(store.evictUnused().evictedAssetIds, [], phase);
    assert.equal(store.getResidency().residentBytes, 128);
    inUse = false;
    assert.deepEqual(store.evictUnused().evictedAssetIds, [phase]);
    assert.equal(store.getResidency().residentBytes, 0);
  }
});

test("LRU eviction honors target bytes, explicit asset scope, and reads that refresh recency", () => {
  const store = new AudioAssetStore(null, makeBudget({ maxDecodedBytes: 1024 }));
  for (const id of ["lru-first", "lru-second", "lru-third"]) register(store, entry(id));
  assert.ok(store.get("lru-first"));
  const eviction = store.evictUnused({ targetBytes: 256 });
  assert.deepEqual(eviction.evictedAssetIds, ["lru-second"]);
  assert.equal(eviction.releasedBytes, 128);
  assert.equal(store.getResidency().residentBytes, 256);
  assert.ok(store.get("lru-first"));
  assert.ok(store.get("lru-third"));
  const scoped = store.evictUnused({ targetBytes: 0, assetIds: ["lru-first"] });
  assert.deepEqual(scoped.evictedAssetIds, ["lru-first"]);
  assert.ok(store.get("lru-third"), "an explicit eviction scope cannot evict another asset");
  assert.equal(store.getResidency().residentBytes, 128);
});

test("shared buffer aliases count physical PCM once while every alias lease prevents release", () => {
  const store = new AudioAssetStore(null, makeBudget({ maxDecodedBytes: 512 }));
  const pcm = buffer();
  register(store, entry("alias-first", pcm));
  register(store, entry("alias-second", pcm));
  const first = store.acquire(["alias-first", "alias-first"], "recording");
  const second = store.acquire(["alias-second"], "offline");
  assert.equal(first.entries.length, 1, "duplicate asset IDs do not duplicate an ownership claim");
  assert.equal(store.getResidency().residentAssets, 2);
  assert.equal(store.getResidency().residentBytes, 128);
  assert.equal(store.getResidency().leasedBytes, 128);
  assert.equal(store.getResidency().retainedBytes, 128);
  first.release();
  store.evictUnused({ assetIds: ["alias-first"] });
  assert.equal(store.get("alias-first"), undefined);
  assert.equal(store.getResidency().retainedBytes, 128, "the second alias retains shared PCM");
  second.release();
  store.evictUnused();
  assert.equal(store.getResidency().retainedBytes, 0);
});

test("an invalid multi-asset acquisition is atomic and does not leave a hidden pin", () => {
  const store = new AudioAssetStore(null, makeBudget());
  register(store, entry("lease-present"));
  assert.throws(
    () => store.acquire(["lease-present", "lease-missing"], "offline"),
    (error) => error instanceof AudioEngineError,
  );
  assert.equal(store.getResidency().leaseCount, 0);
  assert.equal(store.getResidency().leasedBytes, 0);
  assert.deepEqual(store.evictUnused().evictedAssetIds, ["lease-present"]);
});

test("clear releases the current bank but an old generation lease remains accounted until release", () => {
  const store = new AudioAssetStore(null, makeBudget({ maxDecodedBytes: 512 }));
  const original = entry("lease-generation");
  register(store, original);
  const lease = store.acquire([original.assetId], "recording");
  store.clear();
  assert.equal(store.list().length, 0);
  assert.equal(store.getResidency().residentBytes, 0);
  assert.equal(store.getResidency().retainedBytes, 128);
  assert.equal(store.getResidency().leasedBytes, 128);
  const replacement = entry(original.assetId, buffer(48, 2, 44100), 2);
  register(store, replacement);
  assert.equal(store.getResidency().retainedBytes, 512);
  assert.equal(lease.entries[0]?.buffer, original.buffer);
  assert.equal(lease.entries[0]?.metadata.revision, 1);
  assert.equal(lease.entries[0]?.metadata.sha256, "a".repeat(64));
  lease.release();
  lease.release();
  assert.equal(store.get(original.assetId)?.buffer, replacement.buffer);
  assert.equal(store.get(original.assetId)?.descriptor.revision, 2);
  assert.equal(store.get(original.assetId)?.descriptor.sha256, "b".repeat(64));
  assert.equal(store.getResidency().retainedBytes, 384);
  assert.equal(store.getResidency().leasedBytes, 0);
  store.evictUnused();
  assert.equal(store.getResidency().retainedBytes, 0);
});

test("bank replacement accounts old leased PCM and rejects over-cap candidates atomically", () => {
  for (const cap of [255, 256]) {
    const store = new AudioAssetStore(null, makeBudget({ maxDecodedBytes: cap }));
    const original = entry("replace-original");
    const replacement = entry("replace-new");
    register(store, original);
    const lease = store.acquire([original.assetId], "offline");
    if (cap === 255) {
      assert.throws(() => store.replace([replacement]), hasCode("DECODED_MEMORY_BUDGET"));
      assert.equal(store.get(original.assetId)?.buffer, original.buffer);
      assert.equal(store.get(replacement.assetId), undefined);
      assert.equal(store.getResidency().retainedBytes, 128);
    } else {
      store.replace([replacement]);
      assert.equal(store.get(original.assetId), undefined);
      assert.equal(store.get(replacement.assetId)?.buffer, replacement.buffer);
      assert.equal(lease.entries[0]?.buffer, original.buffer);
      assert.equal(store.getResidency().residentBytes, 128);
      assert.equal(store.getResidency().retainedBytes, 256);
    }
    lease.release();
    assert.equal(store.getResidency().retainedBytes, 128);
    store.evictUnused();
    assert.equal(store.getResidency().retainedBytes, 0);
  }
});

test("clear cannot erase a reservation while native decode is still running", async () => {
  const context = new DeferredDecodeContext();
  const store = new AudioAssetStore(context.asContext(), makeBudget({ maxDecodedBytes: 200 }));
  const pending = store.import("decode-pending", wave(), metadata);
  const cancelled = assert.rejects(pending, hasCode("DECODE_CANCELLED"));
  await context.entered;
  assert.equal(store.getResidency().decodeReservedBytes, 132);
  assert.equal(store.hasPendingDecodes, true);
  store.clear();
  assert.equal(store.getResidency().residentBytes, 0);
  assert.equal(store.getResidency().decodeReservedBytes, 132);
  assert.equal(store.hasPendingDecodes, true);
  await assert.rejects(
    store.import("decode-over-cap", wave(), metadata),
    hasCode("DECODED_MEMORY_BUDGET"),
  );
  assert.throws(
    () => register(store, entry("register-over-cap")),
    hasCode("DECODED_MEMORY_BUDGET"),
  );
  assert.equal(
    context.calls,
    1,
    "an outstanding cancelled decoder still consumes admission capacity",
  );
  context.finish();
  await cancelled;
  assert.equal(store.hasPendingDecodes, false);
  assert.equal(store.getResidency().decodeReservedBytes, 0);
  assert.equal(store.getResidency().retainedBytes, 0);
  register(store, entry("register-after-decode"));
  assert.equal(store.getResidency().residentBytes, 128);
});

test("native decode failure releases only its reservation and preserves the valid bank", async () => {
  const context = new DeferredDecodeContext();
  const store = new AudioAssetStore(context.asContext(), makeBudget({ maxDecodedBytes: 512 }));
  const original = entry("decode-existing");
  register(store, original);
  const pending = store.import("decode-failing", wave(), metadata);
  const failed = assert.rejects(pending, /Native decoder fixture failure/);
  await context.entered;
  assert.equal(store.getResidency().residentBytes, 128);
  assert.equal(store.getResidency().decodeReservedBytes, 132);
  context.fail();
  await failed;
  assert.equal(store.get(original.assetId)?.buffer, original.buffer);
  assert.equal(store.getResidency().residentBytes, 128);
  assert.equal(store.getResidency().decodeReservedBytes, 0);
  assert.equal(store.getResidency().leaseCount, 0);
  assert.equal(store.getResidency().retainedBytes, 128);
  assert.equal(store.hasPendingDecodes, false);
});

test("additive cold restoration keeps unrelated in-use buffers and rejects protected replacements atomically", () => {
  const held = "restore-active";
  const store = new AudioAssetStore(
    null,
    makeBudget({ maxDecodedBytes: 512 }),
    (id) => id === held,
  );
  const active = entry(held),
    cold = entry("restore-cold");
  register(store, active);
  store.restore([cold]);
  assert.equal(store.get(held)?.buffer, active.buffer);
  assert.equal(store.get(cold.assetId)?.buffer, cold.buffer);
  const changed = entry(held, buffer(), 2);
  assert.throws(() => store.restore([entry("restore-new"), changed]), hasCode("ASSET_IN_USE"));
  assert.equal(store.get(held)?.buffer, active.buffer);
  assert.equal(store.get("restore-new"), undefined);
});

test("evicting a shared-buffer alias does not report bytes still owned by another alias as released", () => {
  const store = new AudioAssetStore(null, makeBudget({ maxDecodedBytes: 512 }));
  const pcm = buffer();
  register(store, entry("alias-held", pcm));
  register(store, entry("alias-cold", pcm));
  const lease = store.acquire(["alias-held"], "offline");
  const result = store.evictUnused({ assetIds: ["alias-cold"] });
  assert.deepEqual(result.evictedAssetIds, ["alias-cold"]);
  assert.equal(result.releasedBytes, 0);
  assert.equal(result.residentBytes, 128);
  lease.release();
});

test("known encoded and native input staging remains visible through decode and clears at settle", async () => {
  const context = new DeferredDecodeContext();
  const store = new AudioAssetStore(context.asContext(), makeBudget({ maxDecodedBytes: 512 }));
  const bytes = wave(),
    pending = store.import("staging-visible", bytes, metadata);
  await context.entered;
  const running = store.getResidency();
  assert.equal(running.knownStagingBytes, bytes.byteLength * 2);
  assert.equal(running.decodeReservedBytes, 132);
  assert.equal(running.highWaterBytes, bytes.byteLength * 2 + 132);
  assert.equal(
    running.nativeDecoderScratchBytes,
    null,
    "browser scratch is not observable PCM or zero",
  );
  context.finish();
  await pending;
  const settled = store.getResidency();
  assert.equal(settled.knownStagingBytes, 0);
  assert.equal(settled.decodeReservedBytes, 0);
  assert.equal(settled.residentBytes, 128);
  assert.equal(settled.highWaterBytes, running.highWaterBytes);
});

test("public decoded descriptors cannot mutate store accounting or immutable lease metadata", () => {
  const store = new AudioAssetStore(null, makeBudget({ maxDecodedBytes: 255 }));
  const original = entry("immutable-descriptor");
  register(store, original);
  const borrowed = store.get(original.assetId)!;
  borrowed.descriptor.decodedBytes = 0;
  borrowed.descriptor.revision = 42;
  borrowed.descriptor.sha256 = "c".repeat(64);
  borrowed.buffer = buffer(1);
  assert.equal(store.get(original.assetId)?.buffer, original.buffer);
  assert.equal(store.get(original.assetId)?.descriptor.revision, 1);
  assert.equal(store.get(original.assetId)?.descriptor.decodedBytes, 128);
  assert.throws(
    () => register(store, entry("immutable-over-cap")),
    hasCode("DECODED_MEMORY_BUDGET"),
  );
  const lease = store.acquire([original.assetId], "recording");
  assert.equal(lease.entries[0]?.metadata.revision, 1);
  assert.equal(lease.entries[0]?.metadata.sha256, "a".repeat(64));
  lease.release();
});

test("builtin generation reserves its hash PCM copy before allocating an over-cap waveform", async () => {
  const context = new FakeAudioContext();
  const store = new AudioAssetStore(context.asContext(), makeBudget({ maxDecodedBytes: 192000 }));
  await assert.rejects(store.registerBuiltins(), hasCode("DECODED_MEMORY_BUDGET"));
  assert.equal(store.list().length, 0, "the rejected waveform must not be partially generated");
  assert.ok(store.getResidency().highWaterBytes <= 192000);
  assert.equal(store.getResidency().knownStagingBytes, 0);
  assert.equal(store.getResidency().decodeReservedBytes, 0);
});

test("concurrent builtin generation cannot spend PCM capacity already held by another hash copy", async () => {
  const context = new FakeAudioContext();
  const store = new AudioAssetStore(
    context.asContext(),
    makeBudget({ maxDecodedBytes: 600000, maxConcurrentDecodes: 2 }),
  );
  const first = store.registerBuiltins(),
    second = store.registerBuiltins();
  const results = await Promise.allSettled([first, second]);
  assert.ok(
    store.getResidency().highWaterBytes <= 600000,
    `overlapping PCM/hash reservations peak ${store.getResidency().highWaterBytes} must share the original cap`,
  );
  assert.ok(
    results.some(
      (result) => result.status === "rejected" && hasCode("DECODED_MEMORY_BUDGET")(result.reason),
    ),
  );
  assert.equal(store.getResidency().knownStagingBytes, 0);
  assert.equal(store.getResidency().decodeReservedBytes, 0);
});
