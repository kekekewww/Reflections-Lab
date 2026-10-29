import test from "node:test";
import assert from "node:assert/strict";
import { sanitizeMetaHttpDiagnostic } from "../../server/meta-http-diagnostic.js";

test("retains only bounded typed HTTP error fields and redacts exact and LLM credentials", () => {
  const key = "fake-dedicated-credential";
  const diagnostic = sanitizeMetaHttpDiagnostic(
    {
      error: {
        code: "invalid_json_schema",
        type: "invalid_request_error",
        param: "tools[0].function.parameters",
        message: `Bad schema\n${key} LLM_12345_other_fake_key ${"x".repeat(2000)}`,
        headers: { Authorization: `Bearer ${key}` },
        body: "PRIVATE_BODY_MUST_NOT_SURVIVE",
      },
      request: "PRIVATE_REQUEST_MUST_NOT_SURVIVE",
    },
    key,
  );
  assert.equal(diagnostic.kind, "TYPED_PROVIDER_ERROR");
  assert.equal(diagnostic.code, "invalid_json_schema");
  assert.equal(diagnostic.param, "tools[0].function.parameters");
  assert.equal(diagnostic.message?.length, 768);
  assert.ok(diagnostic.message?.startsWith("Bad schema [REDACTED] [REDACTED]"));
  assert.doesNotMatch(
    JSON.stringify(diagnostic),
    /fake-dedicated|LLM_|PRIVATE_|Authorization|headers|body|"request":/,
  );
  assert.deepEqual(Object.keys(diagnostic), ["kind", "code", "type", "param", "message"]);
});

test("redacts before truncating and refuses arrays, nested fields and non-string diagnostics", () => {
  const key = "fake-secret-spanning-the-boundary";
  const result = sanitizeMetaHttpDiagnostic(
    {
      error: {
        message: `${"x".repeat(760)}${key}`,
        code: { value: "unsafe" },
        type: ["unsafe"],
        param: 3,
      },
    },
    key,
  );
  assert.doesNotMatch(JSON.stringify(result), /fake-secret|spanning|unsafe/);
  assert.equal(result.code, null);
  for (const value of [null, "raw body", [], { error: [] }, { error: { message: {} } }]) {
    assert.deepEqual(sanitizeMetaHttpDiagnostic(value, key), {
      kind: "UNAVAILABLE",
      code: null,
      type: null,
      param: null,
      message: null,
    });
  }
});
