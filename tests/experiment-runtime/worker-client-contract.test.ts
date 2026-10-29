import test from "node:test";
import assert from "node:assert/strict";
import { RecordingWorkerClient } from "../../src/experiments/recording-worker-client.js";

const input = { runId: "root.contract" };
class Port {
  onmessage: any = null;
  onerror: any = null;
  onmessageerror: any = null;
  terminateCalls = 0;
  sent: any[] = [];
  postMessage(value: any) {
    this.sent.push(value);
  }
  terminate() {
    this.terminateCalls++;
  }
}
const outcome = (p: Promise<unknown>) =>
  p.then(
    (value) => ({ kind: "resolved", value }),
    (error) => ({ kind: "rejected", error }),
  );
const bounded = async (p: Promise<unknown>) => {
  let timer: ReturnType<typeof setTimeout>;
  try {
    return await Promise.race([
      p,
      new Promise((resolve) => {
        timer = setTimeout(() => resolve({ kind: "never-settled" }), 100);
      }),
    ]);
  } finally {
    clearTimeout(timer!);
  }
};
test("transport failure plus throwing cleanup settles and retains both causes", async () => {
  const primary = new Error("ROOT_SEND_FAILURE"),
    cleanup = new Error("ROOT_TERMINATE_FAILURE");
  const port = new Port();
  port.postMessage = () => {
    throw primary;
  };
  port.terminate = () => {
    port.terminateCalls++;
    throw cleanup;
  };
  const client = new RecordingWorkerClient(() => port, 500);
  const result: any = await bounded(outcome(client.run(input)));
  assert.equal(result.kind, "rejected");
  assert.ok(result.error instanceof AggregateError);
  assert.deepEqual(result.error.errors, [primary, cleanup]);
  assert.equal(port.terminateCalls, 1);
});
test("error event cleanup failure never leaves caller pending or throws to event loop", async () => {
  const cleanup = new Error("ROOT_TERMINATE_FAILURE");
  const port = new Port();
  port.terminate = () => {
    port.terminateCalls++;
    throw cleanup;
  };
  const client = new RecordingWorkerClient(() => port, 500);
  const pending = outcome(client.run(input));
  assert.doesNotThrow(() => port.onerror({ message: "worker failed" }));
  const result: any = await bounded(pending);
  assert.equal(result.kind, "rejected");
  assert.ok(result.error instanceof AggregateError);
  assert.equal(result.error.errors[1], cleanup);
});
test("unreadable response is rejected immediately and terminated exactly once", async () => {
  const port = new Port();
  const client = new RecordingWorkerClient(() => port, 500);
  const pending = outcome(client.run(input));
  assert.equal(typeof port.onmessageerror, "function");
  port.onmessageerror({});
  const result: any = await bounded(pending);
  assert.equal(result.kind, "rejected");
  assert.match(result.error.message, /MESSAGE|PROTOCOL/);
  assert.equal(port.terminateCalls, 1);
});
test("timeout bounds must be finite positive and bounded", () => {
  for (const invalid of [NaN, Infinity, -1, 0, 1e12])
    assert.throws(
      () => new RecordingWorkerClient(() => new Port(), invalid),
      /TIMEOUT|BUDGET|RANGE/,
    );
});

test("falsy transport failure is preserved when cleanup also fails", async () => {
  const cleanup = new Error("terminate failed");
  const port = new Port();
  port.postMessage = () => {
    throw null;
  };
  port.terminate = () => {
    throw cleanup;
  };
  const result: any = await bounded(outcome(new RecordingWorkerClient(() => port, 500).run(input)));
  assert.equal(result.kind, "rejected");
  assert.ok(result.error instanceof AggregateError);
  assert.deepEqual(result.error.errors, [null, cleanup]);
});
