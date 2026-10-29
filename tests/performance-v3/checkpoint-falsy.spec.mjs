import test from "node:test";
import assert from "node:assert/strict";
import { checkpointThenCloseTrace } from "../../tests/browser/performance-owned-cleanup-v3.mjs";
for (const value of [null, undefined, false, 0, ""]) {
  for (const where of ["checkpoint", "stop", "completion"])
    test(`${where} preserves thrown ${String(value)}`, async () => {
      let stopped = 0;
      const options = {
        checkpoint: async () => {
          if (where === "checkpoint") throw value;
          return {};
        },
        stop: async () => {
          stopped++;
          if (where === "stop") throw value;
        },
        completion:
          where === "completion" ? Promise.reject(value) : Promise.resolve({ done: true }),
        timeoutMs: 100,
      };
      let rejected = false,
        caught;
      try {
        await checkpointThenCloseTrace(options);
      } catch (e) {
        rejected = true;
        caught = e;
      }
      assert.equal(stopped, 1, "Always request trace stop exactly once");
      assert.equal(rejected, true, "A thrown value must never become success");
      assert(Object.is(caught, value), "Preserve the original thrown value");
    });
}
test("simultaneous falsy checkpoint and stop failures remain ordered", async () => {
  await assert.rejects(
    checkpointThenCloseTrace({
      checkpoint: () => {
        throw null;
      },
      stop: () => {
        throw 0;
      },
      completion: Promise.resolve({}),
      timeoutMs: 100,
    }),
    (e) =>
      e instanceof AggregateError &&
      e.errors.length === 2 &&
      e.errors[0] === null &&
      e.errors[1] === 0,
  );
});
