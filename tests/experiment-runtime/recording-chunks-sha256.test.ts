import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

// Dynamic import keeps RED an assertion about absent behavior rather than a resolver error.
async function algorithm() {
  const module = await import("../../src/persistence/incremental-sha256.js").catch(() => null);
  assert.ok(module?.IncrementalSha256, "bounded incremental SHA-256 is available");
  return module.IncrementalSha256;
}

test("incremental SHA-256 matches the published empty, abc and million-a vectors", async () => {
  const Hash = await algorithm();
  assert.equal(
    new Hash().digestHex(),
    "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  );
  assert.equal(
    new Hash().update(new TextEncoder().encode("abc")).digestHex(),
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
  );
  const hash = new Hash();
  const block = new Uint8Array(1000).fill(97);
  for (let index = 0; index < 1000; index++) hash.update(block);
  assert.equal(
    hash.digestHex(),
    "cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0",
  );
});

test("every split at padding and block boundaries agrees with independent Node crypto", async () => {
  const Hash = await algorithm();
  for (const length of [1, 55, 56, 57, 63, 64, 65, 127, 128, 129, 4099]) {
    const bytes = Uint8Array.from({ length }, (_, index) => (index * 37 + 19) % 256);
    const expected = createHash("sha256").update(bytes).digest("hex");
    for (const split of [0, 1, 55, 56, 63, 64, 65, length].filter((value) => value <= length)) {
      const hash = new Hash();
      hash.update(bytes.subarray(0, split));
      hash.update(bytes.subarray(split));
      assert.equal(hash.digestHex(), expected, `length=${length};split=${split}`);
    }
  }
});

test("offset views are consumed before mutation and finalization cannot silently reuse state", async () => {
  const Hash = await algorithm();
  const backing = new Uint8Array([99, 97, 98, 99, 88]);
  const hash = new Hash();
  hash.update(backing.subarray(1, 4));
  backing.fill(0);
  const expected = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";
  assert.equal(hash.digestHex(), expected);
  assert.equal(hash.digestHex(), expected);
  assert.throws(() => hash.update(new Uint8Array()), { code: "SHA256_FINALIZED" });
});
