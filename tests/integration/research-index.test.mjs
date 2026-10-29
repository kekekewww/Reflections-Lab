import test from "node:test";
import assert from "node:assert/strict";
import {
  validateLedger,
  validateFixtureReferences,
} from "../../scripts/validation/research-index.mjs";

const valid = () => ({
  schema_version: "1.0.0",
  review_date: "2026-10-26",
  scope: "synthetic validator test only",
  sources: Array.from({ length: 15 }, (_, i) => ({
    id: `S-${i}`,
    title: `Synthetic ${i}`,
    authors: ["Fixture"],
    year: 2026,
    url: `https://example.org/${i}`,
    publication_type: "synthetic",
    access_level: "metadata",
    evidence_locator: "test-only",
    review_date: "2026-10-26",
  })),
  claims: [
    {
      id: "C-1",
      claim: "synthetic",
      source_ids: ["S-0"],
      evidence_type: "synthetic",
      applicable_conditions: "test",
      verification_status: "test-only",
      related_implementation: ["test"],
      limitations: ["no scientific evidence"],
    },
  ],
});
test("research validator accepts complete synthetic metadata, rejects broken traceability", () => {
  assert.deepEqual(validateLedger(valid()), []);
  const missing = valid();
  missing.claims[0].source_ids = ["missing"];
  assert.ok(validateLedger(missing).some((e) => e.includes("unknown source")));
  const duplicate = valid();
  duplicate.sources.push(duplicate.sources[0]);
  assert.ok(validateLedger(duplicate).some((e) => e.includes("duplicate source")));
  const empty = valid();
  delete empty.claims[0].limitations;
  assert.ok(validateLedger(empty).some((e) => e.includes("limitations")));
  assert.ok(
    validateFixtureReferences({ fixtures: [{ id: "f", referenceClaimIds: ["UNKNOWN"] }] }, valid())
      .length,
  );
  const local = valid();
  local.sources[0].url = "package.json";
  local.sources[0].artifact_path = "package.json";
  assert.deepEqual(validateLedger(local), []);
  local.sources[0].url = "../outside.json";
  local.sources[0].artifact_path = "../outside.json";
  assert.ok(validateLedger(local).some((error) => error.includes("repository artifact")));
});
