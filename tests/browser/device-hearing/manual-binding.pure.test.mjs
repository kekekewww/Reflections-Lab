import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  assertQualifiedBytes,
  assertRuntimePromotionBinding,
  compareQualifiedBuildManifests,
  launchManualProbeDriver,
} from "./manual-probe-driver.mjs";

// Pure verification only, designed for the permanent path after Root PROMOTEGO.
// No browser, localhost, native AudioContext or user hearing is exercised.
const archivePath = new URL(
  "../../../artifacts/v1/ui-current-fixed-build-20261027T173919314Z/build-manifest.json",
  import.meta.url,
);
const archiveBytes = await readFile(archivePath);
const archive = JSON.parse(archiveBytes);
const archiveSha256 = "c31a05cf470313cea8a7deccaafd0676f1e83f29b2b4b059ffebf74649a676f5";
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const clone = () => structuredClone(archive);
const reject = (mutate) => {
  const rebuilt = clone();
  mutate(rebuilt);
  assert.throws(() => compareQualifiedBuildManifests(archive, rebuilt));
};
const gateFixture = () => ({
  schemaVersion: 1,
  status: "QUALIFIED_BUILD_PROVENANCE_ONLY",
  promotionVerification: { status: "PASS_STATIC_AND_PURE_HOST_SCOPE" },
  trustedBuild: {
    manifestSha256: archiveSha256,
    inputDigest: archive.inputDigest,
    permittedTimestampDifferences: ["buildStartedAt", "buildCompletedAt"],
  },
  preparation: {
    helperReview: { sha256: "ca93bc279d3f9738432c3d79fb3d33e6db960d4220170f2895b3100bca745611" },
  },
});

test("Pure binding: exact trusted archive bytes and exact rebuilt structure are accepted", () => {
  assertQualifiedBytes(archiveBytes, archiveSha256);
  const result = compareQualifiedBuildManifests(archive, clone());
  assert.equal(result.ok, true);
  assert.equal(result.inputCount, 170);
  assert.equal(result.bundleCount, 12);
  assert.deepEqual(result.changedTimestampFields, []);
  assert.equal(result.scope, "qualified-build provenance for device observation only");
});

test("Pure binding: only two actual timestamp values may differ; both pairs and actual SHAs remain distinct", () => {
  const rebuilt = clone();
  rebuilt.buildStartedAt = "2026-10-28T00:00:00.000Z";
  rebuilt.buildCompletedAt = "2026-10-28T00:00:02.000Z";
  const result = compareQualifiedBuildManifests(archive, rebuilt);
  assert.deepEqual(result.changedTimestampFields, ["buildStartedAt", "buildCompletedAt"]);
  assert.equal(result.trustedTimes.buildStartedAt, archive.buildStartedAt);
  assert.equal(result.rebuiltTimes.buildStartedAt, rebuilt.buildStartedAt);
  assert.notEqual(sha(JSON.stringify(rebuilt)), sha(JSON.stringify(archive)));
});

test("Pure binding: changed archive bytes cannot pass the trusted archived SHA", () => {
  const changed = Buffer.from(archiveBytes);
  changed[changed.length - 1] ^= 1;
  assert.throws(() => assertQualifiedBytes(changed, archiveSha256));
  assert.throws(() => assertQualifiedBytes(archiveBytes, "0".repeat(64)));
});

for (const [field, value] of [
  ["schemaVersion", 2],
  ["mode", "production"],
  ["sourceStableDuringBuild", false],
  ["inputDigest", "0".repeat(64)],
]) {
  test(`Pure binding: changed non-timestamp ${field} is rejected`, () =>
    reject((m) => {
      m[field] = value;
    }));
}

test("Pure binding: missing or extra top-level keys and invented timestamp aliases reject", () => {
  reject((m) => {
    delete m.buildStartedAt;
  });
  reject((m) => {
    m.builtAt = "2026-10-28T00:00:00.000Z";
  });
  reject((m) => {
    m.extraMetadata = "changed";
  });
});

test("Pure binding: malformed, noncanonical or reversed timestamps reject", () => {
  reject((m) => {
    m.buildStartedAt = "unknown";
  });
  reject((m) => {
    m.buildStartedAt = "2026-10-28T00:00:00Z";
  });
  reject((m) => {
    m.buildStartedAt = "2030-01-01T00:00:00.000Z";
  });
});

for (const field of ["inputs", "bundle"]) {
  test(`Pure binding: missing, extra or duplicate ${field} entries reject`, () => {
    reject((m) => {
      m[field].pop();
    });
    reject((m) => {
      m[field].push({ path: "extra-entry.js", sha256: "1".repeat(64) });
    });
    reject((m) => {
      m[field][1] = structuredClone(m[field][0]);
    });
  });
  test(`Pure binding: ${field} hash, metadata, path and array-order changes reject`, () => {
    reject((m) => {
      m[field][0].sha256 = "f".repeat(64);
    });
    reject((m) => {
      m[field][0].sha256 = "NOT_A_SHA";
    });
    reject((m) => {
      m[field][0].note = "new metadata";
    });
    reject((m) => {
      m[field][0].path = "../outside-workspace";
    });
    reject((m) => {
      [m[field][0], m[field][1]] = [m[field][1], m[field][0]];
    });
  });
}

test("Pure binding: recomputing an altered input digest cannot replace the trusted input set", () => {
  reject((m) => {
    m.inputs[0].sha256 = "0".repeat(64);
    m.inputDigest = sha(JSON.stringify(m.inputs));
  });
});

test("Pure binding: current local/HTTP byte verifier rejects changed bytes without touching product files", () => {
  const abcSha256 = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";
  assertQualifiedBytes(Buffer.from("abc"), abcSha256);
  assert.throws(() =>
    assertQualifiedBytes(Buffer.from("abd"), abcSha256, "Frozen local file changed"),
  );
  assert.throws(() =>
    assertQualifiedBytes(Buffer.from("abc\n"), abcSha256, "HTTP root bytes changed"),
  );
});

test("Pure binding: permanent-path promotion status is required before runtime provenance access", () => {
  assert.doesNotThrow(() => assertRuntimePromotionBinding(gateFixture()));
  for (const status of [
    "NOT_RUN_WAIT_ROOT_PROMOTEGO",
    "NO_SOURCE_BLOCKER_TO_CONTROLLED_PROMOTION",
    "PASS",
  ]) {
    const config = gateFixture();
    config.promotionVerification.status = status;
    assert.throws(
      () => assertRuntimePromotionBinding(config),
      /Permanent-path verification still required/,
    );
  }
  const wrongScope = gateFixture();
  wrongScope.status = "OVERALL_V1_PASS";
  assert.throws(() => assertRuntimePromotionBinding(wrongScope));
});

test("Pure binding: wrong bound archive/digest/helper or extra timestamp exception rejects", () => {
  const wrongArchive = gateFixture();
  wrongArchive.trustedBuild.manifestSha256 = "0".repeat(64);
  assert.throws(() => assertRuntimePromotionBinding(wrongArchive));
  const wrongDigest = gateFixture();
  wrongDigest.trustedBuild.inputDigest = "0".repeat(64);
  assert.throws(() => assertRuntimePromotionBinding(wrongDigest));
  const extraException = gateFixture();
  extraException.trustedBuild.permittedTimestampDifferences.push("builtAt");
  assert.throws(() => assertRuntimePromotionBinding(extraException));
  const wrongHelper = gateFixture();
  wrongHelper.preparation.helperReview.sha256 = "0".repeat(64);
  assert.throws(() => assertRuntimePromotionBinding(wrongHelper));
});

test("Pure binding: explicit runtimeGO=false refuses before config/files/browser/network access", async () => {
  await assert.rejects(
    launchManualProbeDriver({ go: false, bindingPath: "not-a-real-binding.json" }),
    /Coordinator GO required/,
  );
});
