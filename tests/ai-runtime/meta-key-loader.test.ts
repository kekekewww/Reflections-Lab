import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { loadMetaApiKey, parseMetaKeyFile } from "../../server/meta-key-loader.js";
import { getMetaProviderStatus, metaConfigFromEnv } from "../../server/meta-provider.js";

// Deliberately fake values; never read the user's credential file in unit tests.
const fakeA = "LLM_12345_fixture_not_a_real_key_A";
const fakeB = "LLM_54321_fixture_not_a_real_key_B";

test("strict credential files allow one named quoted assignment and never execute their contents", () => {
  for (const name of ["MODEL_API_KEY", "META_API_KEY", "META_MODEL_API_KEY"])
    assert.equal(parseMetaKeyFile(`\uFEFF# fixture only\r\n ${name} = "${fakeA}" \r\n`), fakeA);
  for (const invalid of [
    fakeA,
    `META_MODEL_API_KEY=${fakeA}`,
    `OTHER_KEY="${fakeA}"`,
    `META_MODEL_API_KEY="${fakeA}";`,
    `META_MODEL_API_KEY="${fakeA}"\nMETA_API_KEY="${fakeB}"`,
    `META_MODEL_API_KEY="${fakeA}\n${fakeB}"`,
    `META_MODEL_API_KEY="${fakeA} $(echo leaked)"`,
  ]) {
    assert.throws(
      () => parseMetaKeyFile(invalid),
      (error: unknown) => {
        assert.ok(error instanceof Error && "code" in error);
        assert.equal(error.code, "KEY_FILE_FORMAT_INVALID");
        assert.equal(error.message.includes(fakeA), false);
        assert.equal(error.message.includes(fakeB), false);
        return true;
      },
    );
  }
});

test("environment aliases preserve existing priority without mutating the supplied environment", async () => {
  const env = { MODEL_API_KEY: fakeA, META_API_KEY: fakeB, META_MODEL_API_KEY: fakeB };
  const before = structuredClone(env);
  assert.deepEqual(await loadMetaApiKey({ env }), { apiKey: fakeA, source: "MODEL_API_KEY" });
  assert.deepEqual(env, before);
  assert.equal((await loadMetaApiKey({ env: { META_MODEL_API_KEY: fakeB } })).apiKey, fakeB);
  assert.equal(metaConfigFromEnv({ META_MODEL_API_KEY: fakeB }).apiKey, fakeB);
  assert.equal(metaConfigFromEnv({ META_MODEL_API_KEY: fakeB }).maxEstimatedCostUsd, 0);
  assert.deepEqual(await loadMetaApiKey({ env: {} }), { apiKey: null, source: "missing" });
});

test("only an explicitly selected file is loaded, while errors and limits remain redacted", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "reflection-meta-key-fixture-"));
  t.after(async () => {
    assert.equal(dirname(resolve(directory)), resolve(tmpdir()));
    await rm(directory, { recursive: true, force: true });
  });
  const file = join(directory, "fake-credential.txt");
  await writeFile(file, `META_MODEL_API_KEY = "${fakeA}"\n`, "utf8");
  assert.deepEqual(await loadMetaApiKey({ env: {}, keyFile: file }), {
    apiKey: fakeA,
    source: "file",
  });
  assert.deepEqual(await loadMetaApiKey({ env: { META_API_KEY_FILE: file } }), {
    apiKey: fakeA,
    source: "file",
  });
  assert.equal(
    (await loadMetaApiKey({ env: { MODEL_API_KEY: fakeB }, keyFile: file })).apiKey,
    fakeA,
  );
  await writeFile(file, "x".repeat(17000), "utf8");
  await assert.rejects(loadMetaApiKey({ env: {}, keyFile: file }), { code: "KEY_FILE_TOO_LARGE" });
  await assert.rejects(loadMetaApiKey({ env: {}, keyFile: join(directory, "missing.txt") }), {
    code: "KEY_FILE_UNAVAILABLE",
  });
});

test("metaConfigFromEnv takes the reviewed retry, timeout and reasoning settings; the gate blocks bad ones", () => {
  const ready = {
    META_MODEL_API_KEY: fakeB,
    META_NETWORK_ENABLED: "true",
    META_MODEL_ID: "muse-spark-1.3",
    META_VERIFICATION_STATUS: "verified",
    META_VERIFIED_AT: "2026-11-04T01:49:00.597Z",
    META_VERIFICATION_ARTIFACT_ID: "artifact.fake-catalog",
    META_MAX_SESSION_COST_USD: "1",
    META_INPUT_USD_PER_MILLION_TOKENS: "1.25",
    META_OUTPUT_USD_PER_MILLION_TOKENS: "4.25",
    META_PRICING_SOURCE: "https://example.test/pricing",
  };
  const defaults = metaConfigFromEnv(ready);
  assert.equal(defaults.maxRetries, 2);
  assert.equal(defaults.timeoutMs, 20000);
  assert.equal(defaults.reasoningEffort, undefined);
  assert.equal(getMetaProviderStatus(defaults).state, "READY");

  const reviewed = metaConfigFromEnv({
    ...ready,
    META_MAX_RETRIES: "0",
    META_TIMEOUT_MS: "30000",
    META_REASONING_EFFORT: "minimal",
  });
  assert.equal(reviewed.maxRetries, 0);
  assert.equal(reviewed.timeoutMs, 30000);
  assert.equal(reviewed.reasoningEffort, "minimal");
  assert.equal(getMetaProviderStatus(reviewed).state, "READY");

  for (const bad of [
    { META_MAX_RETRIES: "9" },
    { META_MAX_RETRIES: "many" },
    { META_TIMEOUT_MS: "1" },
    { META_REASONING_EFFORT: "high" },
  ])
    assert.equal(
      getMetaProviderStatus(metaConfigFromEnv({ ...ready, ...bad })).reason,
      "INVALID_HOST_BUDGET",
      JSON.stringify(bad),
    );
});
