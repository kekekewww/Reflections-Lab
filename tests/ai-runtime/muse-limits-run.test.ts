import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { main, parseArgs, stopsRun } from "../../benchmarks/muse-limits/run.js";
import { body, response, call, addArgs } from "./muse-limits-fixtures.js";

test(
  "dry-run main retries a real Motion rejection, stages, applies, undoes and writes durable evidence",
  { timeout: 30000 },
  async () => {
    const out = await mkdtemp(join(tmpdir(), "muse-limits-run-"));
    const lines: string[] = [];
    const result = await main(
      [
        "--dry-run",
        "--cases",
        "ball-orbit",
        "--effort",
        "minimal",
        "--repeat",
        "1",
        "--stop-at-usd",
        "0.1",
        "--out",
        out,
      ],
      { print: (line) => lines.push(line) },
    );
    assert.equal(result.rows.length, 1);
    const report = JSON.parse(await readFile(join(out, "ball-orbit-minimal-1.json"), "utf8"));
    assert.equal(report.offlineFixture, true);
    assert.equal(report.rounds.length, 2);
    assert.equal(report.rounds[0].failures[0].code, "MOTION_NOT_KINEMATIC");
    assert.equal(report.stopReason, "accepted");
    assert.equal(report.apply.worked, true);
    assert.equal(report.undo.worked, true);
    assert.equal(report.score.paths[0].samples, 33);
    assert.ok(report.score.paths[0].maxRadiusErrorM < 1e-10);
    assert.equal(
      report.candidateScene.objects.find((o: { id: string }) => o.id === "ball").mode,
      "kinematic",
    );
    assert.equal(report.estimatedCost.label, "Estimated at list price; not actual billing");
    assert.equal(lines.filter((l) => l.startsWith("ball-orbit")).length, 1);
    const summary = JSON.parse(await readFile(join(out, "summary.json"), "utf8"));
    assert.equal(summary.totals.runs, 1);
    assert.equal(summary.totals.accepted, 1);
    assert.ok(summary.ledgerPath.startsWith(tmpdir()));
    assert.deepEqual((await readdir(out)).sort(), ["ball-orbit-minimal-1.json", "summary.json"]);
  },
);
test("CLI rejects missing stop, live key, unknown cases and out-of-range limits before any side effect", () => {
  for (const args of [
    [],
    ["--dry-run"],
    ["--stop-at-usd", "5"],
    ["--dry-run", "--stop-at-usd", "5.01"],
    ["--dry-run", "--stop-at-usd", "1", "--cases", "missing"],
    ["--dry-run", "--stop-at-usd", "1", "--max-rounds", "5"],
    ["--dry-run", "--stop-at-usd", "1", "--effort", "max"],
    ["--dry-run", "--stop-at-usd", "1", "--max-completion-tokens", "16001"],
  ])
    assert.throws(() => parseArgs(args));
});
test("all ledger failures stop the bench, including request identity and invalid settlement failures", () => {
  for (const code of [
    "LEDGER_IO_UNCERTAIN",
    "REQUEST_ID_CONFLICT",
    "REQUEST_NOT_ACTIVE",
    "INVALID_SETTLEMENT",
    "INVALID_RESPONSE",
    "FAILURE_CODE_INVALID",
    "RESERVATION_INVALID",
    "ATTEMPT_LIMIT_REACHED",
    "LOCK_OWNERSHIP_LOST",
    "RESPONSE_IDENTITY_MISMATCH",
    "AUTHENTICATION_ERROR",
    "QUOTA_EXCEEDED",
    "BUDGET_EXCEEDED",
  ])
    assert.equal(stopsRun(code), true, code);
  for (const code of [
    "SCHEMA_INVALID",
    "DOMAIN_INVALID",
    "PROVIDER_REQUEST_FAILED",
    "MODEL_UNAVAILABLE",
    "TIMEOUT",
  ])
    assert.equal(stopsRun(code), false, code);
});
test(
  "dry-run maxRounds one records rejection and preserves the real validator error",
  { timeout: 30000 },
  async () => {
    const out = await mkdtemp(join(tmpdir(), "muse-limits-reject-"));
    const summary = await main(
      [
        "--dry-run",
        "--cases",
        "room-furnish",
        "--effort",
        "medium",
        "--max-rounds",
        "1",
        "--stop-at-usd",
        "1",
        "--out",
        out,
      ],
      { print: () => {} },
    );
    assert.equal(summary.rows[0]!.stopReason, "rejected");
    assert.equal(summary.totals.accepted, 0);
  },
);
test(
  "bench persists a nonfatal provider error and continues to the next fresh case",
  { timeout: 30000 },
  async () => {
    const out = await mkdtemp(join(tmpdir(), "muse-limits-http-"));
    let calls = 0;
    const result = await main(
      [
        "--dry-run",
        "--cases",
        "room-furnish,treatment",
        "--effort",
        "minimal",
        "--stop-at-usd",
        "1",
        "--out",
        out,
      ],
      {
        print: () => {},
        fetch: async () =>
          ++calls === 1
            ? new Response(JSON.stringify({ error: { code: "bad_request" } }), { status: 400 })
            : response(body([], "response.empty", "stop")),
      },
    );
    assert.equal(result.rows.length, 2);
    assert.equal(result.rows[0]!.errorCode, "PROVIDER_REQUEST_FAILED");
    assert.equal(result.rows[1]!.stopReason, "noCalls");
  },
);
test(
  "authentication and quota failures stop after recording the failed case",
  { timeout: 30000 },
  async () => {
    for (const status of [401, 402]) {
      const out = await mkdtemp(join(tmpdir(), "muse-limits-auth-"));
      let calls = 0;
      const result = await main(
        [
          "--dry-run",
          "--cases",
          "room-furnish,treatment",
          "--effort",
          "minimal",
          "--stop-at-usd",
          "1",
          "--out",
          out,
        ],
        {
          print: () => {},
          fetch: async () => {
            calls++;
            return new Response("{}", { status });
          },
        },
      );
      assert.equal(calls, 1);
      assert.equal(result.rows.length, 1);
      assert.equal(
        result.stoppedReason,
        status === 401 ? "AUTHENTICATION_ERROR" : "QUOTA_EXCEEDED",
      );
    }
  },
);
test(
  "stop-at-usd prevents even the first fetch when its reservation would cross the threshold",
  { timeout: 30000 },
  async () => {
    const out = await mkdtemp(join(tmpdir(), "muse-limits-stop-"));
    let calls = 0;
    const result = await main(
      [
        "--dry-run",
        "--cases",
        "room-furnish",
        "--effort",
        "minimal",
        "--stop-at-usd",
        "0.001",
        "--out",
        out,
      ],
      {
        print: () => {},
        fetch: async () => {
          calls++;
          return response();
        },
      },
    );
    assert.equal(calls, 0);
    assert.equal(result.stoppedReason, "BUDGET_EXCEEDED");
    assert.equal(result.totals.consumedUsd, 0);
  },
);

test(
  "a budget stop is recorded and stops the bench before another case",
  { timeout: 30000 },
  async () => {
    const out = await mkdtemp(join(tmpdir(), "muse-limits-budget-stop-"));
    let fetches = 0;
    const result = await main(
      [
        "--dry-run",
        "--cases",
        "room-furnish,treatment",
        "--effort",
        "minimal",
        "--stop-at-usd",
        "0.001",
        "--out",
        out,
      ],
      {
        print: () => {},
        fetch: async () => {
          fetches++;
          return response(body([call(0, addArgs(0))], "response.budget-stop"));
        },
      },
    );
    assert.equal(result.rows.length, 1);
    assert.equal(result.rows[0]!.errorCode, "BUDGET_EXCEEDED");
    assert.equal(result.stoppedReason, "BUDGET_EXCEEDED");
    assert.equal(fetches, 0, "the reservation must fail before anything is sent");
  },
);

test(
  "a later schema-invalid round never reports an earlier candidate as its final requests",
  { timeout: 30000 },
  async () => {
    const out = await mkdtemp(join(tmpdir(), "muse-limits-final-requests-"));
    let fetches = 0;
    await main(
      [
        "--dry-run",
        "--cases",
        "room-furnish",
        "--effort",
        "minimal",
        "--max-rounds",
        "2",
        "--stop-at-usd",
        "1",
        "--out",
        out,
      ],
      {
        print: () => {},
        fetch: async () =>
          response(
            body(
              [
                ++fetches === 1
                  ? call(0, { ...addArgs(0), materialId: "material.unknown" })
                  : call(0, {}),
              ],
              `response.final-${fetches}`,
            ),
          ),
      },
    );
    const report = JSON.parse(await readFile(join(out, "room-furnish-minimal-1.json"), "utf8"));
    assert.equal(report.stopReason, "rejected");
    assert.equal(report.rounds[1].failures[0].code, "SCHEMA_INVALID");
    assert.deepEqual(report.finalRequests, []);
  },
);
