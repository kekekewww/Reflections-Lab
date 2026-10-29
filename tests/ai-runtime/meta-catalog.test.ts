import test from "node:test";
import assert from "node:assert/strict";
import { probeMetaCatalog } from "../../server/meta-catalog.js";

// Every transport is injected. This file never reads credentials or sends network requests.
const key = "fixture-catalog-secret-never-real";
const endpoint = "https://api.meta.ai/v1/models";
const model = (id = "muse.fixture") => ({ object: "model", id, created: 0, owned_by: "meta" });
const catalog = (data: unknown[] = [model()]) => ({ object: "list", data });
const respond = (value: unknown, status = 200, headers: HeadersInit = {}) =>
  new Response(JSON.stringify(value), { status, headers });
function transport(value: unknown, headers: HeadersInit = {}): typeof fetch {
  return async () => respond(value, 200, headers);
}
function safe(proof: unknown): void {
  assert.equal(JSON.stringify(proof).includes(key), false, "proof must not reflect the secret");
  assert.equal(JSON.stringify(proof).includes("owned_by"), false);
  assert.equal(JSON.stringify(proof).includes("metadata"), false);
}

test("catalog probe uses the exact fixed GET, redirects disabled, and returns only bounded access evidence", async () => {
  let fetches = 0;
  let now = Date.parse("2026-10-27T01:00:00.000Z");
  const proof = await probeMetaCatalog(key, {
    now: () => now,
    fetch: async (url, init) => {
      fetches++;
      assert.equal(url, endpoint);
      assert.equal(init?.method, "GET");
      assert.equal(init?.redirect, "error");
      assert.equal(init?.body, undefined);
      assert.equal(new Headers(init?.headers).get("authorization"), `Bearer ${key}`);
      assert.ok(init?.signal instanceof AbortSignal);
      now += 7;
      return respond(
        catalog([model("muse.z"), { ...model("muse.a"), metadata: { description: key } }]),
        200,
        { "x-request-id": "request.fixture-1" },
      );
    },
  });
  assert.equal(fetches, 1);
  assert.equal(proof.status, "PASSED");
  assert.deepEqual(proof.modelIds, ["muse.a", "muse.z"]);
  assert.equal(proof.httpStatus, 200);
  assert.equal(proof.requestId, "request.fixture-1");
  assert.equal(proof.elapsedMs, 7);
  assert.equal(proof.inferenceRequests, 0);
  assert.equal(proof.remainingCreditUsd, null);
  assert.equal(proof.actualCostUsd, null);
  assert.equal(proof.scope, "CATALOG_ACCESS_ONLY");
  assert.ok(Number.isFinite(Date.parse(proof.checkedAt)));
  assert.deepEqual(
    Object.keys(proof).sort(),
    [
      "actualCostUsd",
      "checkedAt",
      "elapsedMs",
      "httpStatus",
      "inferenceRequests",
      "modelIds",
      "remainingCreditUsd",
      "requestId",
      "scope",
      "status",
    ].sort(),
  );
  safe(proof);
});

test("secret echoes in headers and ignored fields never enter the proof", async () => {
  for (const header of ["x-request-id", "request-id", "x-meta-request-id"]) {
    const proof = await probeMetaCatalog(key, {
      fetch: transport(catalog([{ ...model(), owned_by: key, metadata: { secret: key } }]), {
        [header]: key,
      }),
    });
    assert.equal(proof.status, "PASSED");
    assert.equal(proof.requestId, null);
    safe(proof);
  }
  const modelEcho = await probeMetaCatalog(key, {
    fetch: transport(catalog([model(`${key}.echo`)])),
  });
  assert.equal(modelEcho.status, "FAILED");
  assert.deepEqual(modelEcho.modelIds, []);
  safe(modelEcho);
});

test("request identifiers suppress partial LLM credentials and permit only safe allowlisted headers", async () => {
  for (const headers of [
    {},
    { "x-request-id": "request.LLM_partial-secret" },
    { "request-id": "llm_partial-secret" },
    { "x-meta-request-id": "unsafe/id" },
    { "untrusted-request-id": "request.untrusted" },
  ]) {
    const proof = await probeMetaCatalog(key, { fetch: transport(catalog(), headers) });
    assert.equal(proof.status, "PASSED");
    assert.equal(proof.requestId, null);
    safe(proof);
  }
  const allowed = await probeMetaCatalog(key, {
    fetch: transport(catalog(), { "x-request-id": key, "request-id": "request.safe-fallback" }),
  });
  assert.equal(allowed.requestId, "request.safe-fallback");
});

test("a transport that reports following a redirect cannot establish catalog access", async () => {
  for (const changed of ["redirected", "url"] as const) {
    const proof = await probeMetaCatalog(key, {
      fetch: async () => {
        const response = respond(catalog());
        Object.defineProperty(response, changed, {
          value: changed === "redirected" ? true : "https://untrusted.invalid/models",
        });
        return response;
      },
    });
    assert.equal(proof.status, "FAILED");
    assert.equal(proof.code, "REDIRECT_REJECTED");
    assert.deepEqual(proof.modelIds, []);
    safe(proof);
  }
});

test("non-success HTTP bodies are ignored, never retried, and cannot echo secrets", async () => {
  for (const status of [301, 302, 307, 401, 403, 429, 500]) {
    let fetches = 0;
    let reads = 0;
    const proof = await probeMetaCatalog(key, {
      fetch: async () => {
        fetches++;
        return new Response(
          new ReadableStream<Uint8Array>({
            pull() {
              reads++;
              throw new Error(key);
            },
          }),
          {
            status,
            headers: { "x-request-id": key, Location: `https://untrusted.invalid/${key}` },
          },
        );
      },
    });
    assert.equal(proof.status, "FAILED");
    assert.equal(proof.httpStatus, status);
    assert.equal(fetches, 1);
    assert.ok(reads <= 1); // A stream may perform its eager initial pull; the probe never consumes it.
    assert.deepEqual(proof.modelIds, []);
    assert.ok(proof.code);
    safe(proof);
  }
});

test("catalog validates the official list/model envelope and safe model identifiers", async () => {
  for (const value of [
    null,
    [],
    { ...catalog(), object: "other" },
    { ...catalog(), secret: key },
    catalog([{ id: "muse.a", object: "model", created: 0 }]),
    catalog([{ ...model(), created: -1 }]),
    catalog([{ ...model(), metadata: null }]),
    catalog([model("Muse.Uppercase")]),
    catalog([model("model/unsafe")]),
    catalog([model(), model()]),
    catalog(Array.from({ length: 257 }, (_, index) => model(`muse.${index}`))),
  ]) {
    const proof = await probeMetaCatalog(key, { fetch: transport(value) });
    assert.equal(proof.status, "FAILED");
    assert.deepEqual(proof.modelIds, []);
    safe(proof);
  }
  const empty = await probeMetaCatalog(key, { fetch: transport(catalog([])) });
  assert.equal(empty.status, "PASSED");
  assert.deepEqual(empty.modelIds, []);
  const maximum = await probeMetaCatalog(key, {
    fetch: transport(catalog(Array.from({ length: 256 }, (_, index) => model(`muse.${index}`)))),
  });
  assert.equal(maximum.status, "PASSED");
  assert.equal(maximum.modelIds.length, 256);
});

test("catalog refuses malformed JSON and response bodies above 256 KiB", async () => {
  for (const [body, code] of [
    ["not JSON", "SCHEMA_INVALID"],
    [" ".repeat(256 * 1024 + 1), "INPUT_LIMIT"],
  ] as const) {
    const proof = await probeMetaCatalog(key, {
      fetch: async () => new Response(body, { status: 200 }),
    });
    assert.equal(proof.status, "FAILED");
    assert.equal(proof.httpStatus, 200);
    assert.equal(proof.code, code);
    assert.deepEqual(proof.modelIds, []);
    safe(proof);
  }
});

test("timeout bounds an uncooperative transport and aborts its signal without retries", async () => {
  let signal: AbortSignal | undefined;
  let calls = 0;
  const startedAt = Date.now();
  const proof = await probeMetaCatalog(key, {
    timeoutMs: 15,
    fetch: async (_url, init) => {
      calls++;
      signal = init?.signal ?? undefined;
      return new Promise<Response>(() => {});
    },
  });
  assert.equal(proof.status, "FAILED");
  assert.equal(proof.code, "TIMEOUT");
  assert.equal(proof.httpStatus, null);
  assert.equal(calls, 1);
  assert.equal(signal?.aborted, true);
  assert.ok(Date.now() - startedAt < 1000);
  safe(proof);
});

test("timeout also bounds a stalled response stream", async () => {
  let cancelled = false;
  const proof = await probeMetaCatalog(key, {
    timeoutMs: 15,
    fetch: async () =>
      new Response(
        new ReadableStream<Uint8Array>({
          pull: () => new Promise<void>(() => {}),
          cancel: () => {
            cancelled = true;
          },
        }),
        { status: 200 },
      ),
  });
  assert.equal(proof.status, "FAILED");
  assert.equal(proof.code, "TIMEOUT");
  assert.equal(cancelled, true);
  safe(proof);
});

test("transport failures and invalid options return only static failure codes", async () => {
  const failure = await probeMetaCatalog(key, {
    fetch: async () => {
      throw new Error(key);
    },
  });
  assert.equal(failure.status, "FAILED");
  safe(failure);
  let calls = 0;
  for (const timeoutMs of [0, -1, 15001, Number.NaN]) {
    const proof = await probeMetaCatalog(key, {
      timeoutMs,
      fetch: async () => {
        calls++;
        return respond(catalog());
      },
    });
    assert.equal(proof.status, "FAILED");
    safe(proof);
  }
  for (const invalidKey of ["", "\r\nforged"]) {
    const proof = await probeMetaCatalog(invalidKey, {
      fetch: async () => {
        calls++;
        return respond(catalog());
      },
    });
    assert.equal(proof.status, "FAILED");
  }
  assert.equal(calls, 0);
});
