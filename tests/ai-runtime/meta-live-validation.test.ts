import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { runMetaLiveValidation } from "../../server/meta-live-validation-cli.js";
import { verifyRecording } from "../../src/experiments/index.js";
import { createMetaLivePayloadPreview } from "../../server/meta-live-payload-preview.js";
import { openMetaLiveBudget } from "../../server/meta-live-budget.js";

// Actual local HTTP and numerical runtime, with every model request injected.
// This test never reads a user credential or contacts an inference provider.
for (const priorRejectedCalls of [0, 1, 2]) {
  test(`mock trusted Apply -> 180-tick run shares the durable budget (prior 400 count: ${priorRejectedCalls})`, async (t) => {
    const directory = await mkdtemp(join(tmpdir(), "reflection-meta-live-fake-"));
    t.after(async () => {
      assert.equal(dirname(resolve(directory)), resolve(tmpdir()));
      await rm(directory, { recursive: true, force: true });
    });
    const key = "LLM_12345_fake_transport_only";
    const soundOnly = priorRejectedCalls === 2;
    const validationScope = soundOnly ? "sound-only" : "scene-and-sound";
    for (let prior = 0; prior < priorRejectedCalls; prior++) {
      const previous = await openMetaLiveBudget(join(directory, "budget.json"));
      const id = await previous.reserve("sound", {
        modelId: "muse-spark-1.3",
        maxCompletionTokens: 1000,
      });
      await assert.rejects(
        previous.settle(id, {
          httpStatus: 400,
          responseId: null,
          modelId: null,
          usage: null,
          status: "failed",
        }),
      );
      await previous.reconcileHttp400(
        id,
        "Fake-only authorized request rejection",
        "TEST-HTTP400-REPAIR",
      );
      await previous.close();
    }
    let calls = 0;
    const argumentsByCall = [
      {
        name: "ProposeSoundBehavior",
        value: {
          operations: [
            { type: "RemoveBinding", bindingId: "binding.interactive.ball" },
            {
              type: "AssignBinding",
              binding: {
                bindingId: "binding.interactive.ball",
                objectId: "ball",
                objectGeneration: 1,
                profileId: "profile.interactive-tone",
                profileRevision: 1,
                enabled: true,
                overrides: [
                  { ruleId: "rule.impact", enabled: null, gainLinear: null, pitchSemitones: 2 },
                ],
              },
            },
          ],
        },
      },
      {
        name: "AddObject",
        value: {
          objectId: "object.meta-proof",
          label: "Meta proof sphere",
          shape: "sphere",
          dimensionsM: [0.4, 0.4, 0.4],
          positionM: [2, 2, 0],
          orientationQuaternion: [0, 0, 0, 1],
          materialId: "material.metal",
          mode: "dynamicNoGravity",
          massKg: 1,
        },
      },
      {
        name: "RunSimulation",
        value: {
          backendId: "custom-web",
          durationS: 3,
          timeStepS: 1 / 60,
          seed: 1746,
          replayTraceId: null,
          maxReflectionOrder: 1,
          sampleRateHz: 48000,
        },
      },
    ];
    const result = await runMetaLiveValidation({
      apiKey: key,
      ledgerPath: join(directory, "budget.json"),
      outputDirectory: join(directory, "proof"),
      catalogProof: {
        status: "PASSED",
        modelIds: ["muse-spark-1.3"],
        httpStatus: 200,
        requestId: "catalog.fake",
        checkedAt: "2026-10-27T01:30:52.820Z",
        elapsedMs: 1,
        inferenceRequests: 0,
        actualCostUsd: null,
        remainingCreditUsd: null,
        scope: "CATALOG_ACCESS_ONLY",
      },
      validationScope,
      reviewedPayloads: (await createMetaLivePayloadPreview(validationScope)).reviewedPayloads,
      remoteFetch: async (input, init) => {
        assert.equal(input, "https://api.meta.ai/v1/chat/completions");
        assert.equal(init?.redirect, "error");
        const body = JSON.parse(String(init?.body));
        assert.equal(body.model, "muse-spark-1.3");
        assert.equal(body.max_completion_tokens, 1000);
        assert.equal(body.reasoning_effort, "minimal");
        const index = (soundOnly ? [0] : [1, 0, 2])[calls++];
        const call = index === undefined ? undefined : argumentsByCall[index];
        assert.ok(call, "a fourth paid request must never be dispatched");
        return new Response(
          JSON.stringify({
            id: `response.fake-${calls}`,
            model: "muse-spark-1.3",
            choices: [
              {
                finish_reason: "tool_calls",
                message: {
                  role: "assistant",
                  content: null,
                  tool_calls: [
                    {
                      id: `call.fake-${calls}`,
                      type: "function",
                      function: { name: call.name, arguments: JSON.stringify(call.value) },
                    },
                  ],
                },
              },
            ],
            usage: {
              prompt_tokens: 12000,
              completion_tokens: 100,
              total_tokens: 12100,
              prompt_tokens_details: { cached_tokens: 0 },
              completion_tokens_details: { reasoning_tokens: 20 },
            },
          }),
          { status: 200, headers: { "x-request-id": `request.fake-${calls}` } },
        );
      },
    });
    assert.equal(
      result.status,
      soundOnly ? "SOUND_PASSED_SCENE_NOT_RUN" : "PASSED",
      JSON.stringify(result),
    );
    assert.equal(calls, 3 - priorRejectedCalls);
    assert.equal(result.soundPassed, true);
    assert.equal(result.scenePassed, !soundOnly);
    assert.equal(result.runPassed, true);
    assert.equal(result.metaRun, priorRejectedCalls === 0);
    assert.equal(result.runPlanner, priorRejectedCalls > 0 ? "HOST_EXPLICIT_FIXED60" : "META_LIVE");
    assert.equal(result.totalPaidRequests, 3);
    assert.equal(JSON.stringify(result).includes(key), false);
    const budget = JSON.parse(await readFile(join(directory, "budget.json"), "utf8"));
    assert.equal(budget.attempts.length, 3);
    const recording = JSON.parse(
      await readFile(join(directory, "proof", "recording.json"), "utf8"),
    );
    await verifyRecording(recording);
    assert.equal(recording.endTick, 180);
    assert.equal(recording.frameCount, 181);
    const trace = JSON.parse(
      await readFile(join(directory, "proof", "meta-behavior-trace.json"), "utf8"),
    );
    assert.ok(trace.actualStartedEvents.length > 0);
    assert.ok(
      trace.actualStartedEvents.every(
        (event: { pitchSemitones: number }) => event.pitchSemitones === 2,
      ),
    );
  });
}

test("a body differing from the reviewed synthetic payload is blocked before reservation or remote dispatch", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "reflection-meta-payload-mismatch-"));
  t.after(async () => {
    assert.equal(dirname(resolve(directory)), resolve(tmpdir()));
    await rm(directory, { recursive: true, force: true });
  });
  const preview = await createMetaLivePayloadPreview();
  preview.reviewedPayloads.scene.sha256 = "0".repeat(64);
  let remoteCalls = 0;
  const result = await runMetaLiveValidation({
    apiKey: "LLM_12345_fake_payload_guard_only",
    ledgerPath: join(directory, "budget.json"),
    outputDirectory: join(directory, "proof"),
    reviewedPayloads: preview.reviewedPayloads,
    catalogProof: {
      status: "PASSED",
      modelIds: ["muse-spark-1.3"],
      httpStatus: 200,
      requestId: "catalog.fake",
      checkedAt: "2026-10-27T01:30:52.820Z",
      elapsedMs: 1,
      inferenceRequests: 0,
      actualCostUsd: null,
      remainingCreditUsd: null,
      scope: "CATALOG_ACCESS_ONLY",
    },
    remoteFetch: async () => {
      remoteCalls++;
      throw new Error("must not dispatch");
    },
  });
  assert.equal(result.status, "INCOMPLETE");
  assert.equal(result.paidRequests, 0);
  assert.equal(remoteCalls, 0);
  assert.equal(
    JSON.parse(await readFile(join(directory, "budget.json"), "utf8")).attempts.length,
    0,
  );
});

test("HTTP 400 records redacted typed diagnostics before stopping once with reservation retained", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "reflection-meta-http400-"));
  t.after(async () => {
    assert.equal(dirname(resolve(directory)), resolve(tmpdir()));
    await rm(directory, { recursive: true, force: true });
  });
  const key = "LLM_12345_fake_http400_transport_only";
  let remoteCalls = 0;
  const result = await runMetaLiveValidation({
    apiKey: key,
    ledgerPath: join(directory, "budget.json"),
    outputDirectory: join(directory, "proof"),
    reviewedPayloads: (await createMetaLivePayloadPreview()).reviewedPayloads,
    catalogProof: {
      status: "PASSED",
      modelIds: ["muse-spark-1.3"],
      httpStatus: 200,
      requestId: "catalog.fake",
      checkedAt: "2026-10-27T01:30:52.820Z",
      elapsedMs: 1,
      inferenceRequests: 0,
      actualCostUsd: null,
      remainingCreditUsd: null,
      scope: "CATALOG_ACCESS_ONLY",
    },
    remoteFetch: async () => {
      remoteCalls++;
      return new Response(
        JSON.stringify({
          error: {
            code: "invalid_json_schema",
            type: "invalid_request_error",
            param: "tools[0].function.parameters",
            message: `Synthetic rejection ${key} LLM_98765_other_fake_key`,
            privateContext: "DO_NOT_COPY_PRIVATE_CONTEXT",
          },
        }),
        { status: 400, headers: { "x-request-id": "request.fake-400" } },
      );
    },
  });
  assert.equal(result.status, "INCOMPLETE");
  assert.equal(remoteCalls, 1, "no automatic paid or local proposal retry");
  assert.equal(result.paidRequests, 1);
  assert.equal(result.scenePassed, false);
  assert.equal(result.soundPassed, false);
  const transport = JSON.parse(
    await readFile(join(directory, "proof", "transport-1.json"), "utf8"),
  );
  assert.equal(transport.httpStatus, 400);
  assert.equal(transport.diagnostic.code, "invalid_json_schema");
  assert.equal(transport.diagnostic.param, "tools[0].function.parameters");
  assert.equal(transport.diagnostic.message, "Synthetic rejection [REDACTED] [REDACTED]");
  assert.equal(transport.responseId, null);
  assert.equal(transport.usage, null);
  const budget = JSON.parse(await readFile(join(directory, "budget.json"), "utf8"));
  assert.equal(budget.attempts.length, 1);
  assert.equal(budget.attempts[0].reservedUsd, 0.25);
  assert.equal(budget.attempts[0].validationError, "HTTP_400_REQUEST_REJECTED");
  assert.equal(budget.attempts[0].actualBillingCostUsd, null);
  const api = JSON.parse(await readFile(join(directory, "proof", "product-api-1.json"), "utf8"));
  assert.equal(api.value.error.code, "PROVIDER_REQUEST_FAILED");
  assert.doesNotMatch(
    JSON.stringify({ result, transport, budget, api }),
    /LLM_|DO_NOT_COPY_PRIVATE_CONTEXT/,
  );
});
