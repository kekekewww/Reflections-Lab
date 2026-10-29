import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { loadMetaApiKey, parseMetaKeyFile } from "../../server/meta-key-loader.js";
import { metaConfigFromEnv } from "../../server/meta-provider.js";

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
