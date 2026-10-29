import test from "node:test";
import assert from "node:assert/strict";
import { makeFixtureHost, allErrors } from "./fixture-adapter.mjs";
for (const value of [null, undefined, false, 0, ""])
  test(`explicit falsy abort preserves exact thrown value ${String(value)}`, async () => {
    const h = makeFixtureHost();
    let caught = false,
      actual;
    try {
      await h.finish({ abortError: value });
    } catch (error) {
      caught = true;
      actual = error;
    }
    assert.equal(caught, true);
    assert.equal(actual, value);
    assert.equal(h.nativeCalls.dispose, 1);
    assert.equal(h.state().runtime, null);
    assert.equal(h.window.requestAnimationFrame, h.previousRAF);
    assert.equal(h.proof.snapshot().closed, true);
    assert.ok(h.proof.snapshot().reasons.includes("COLLECTION_FAILED"));
  });
for (const kind of ["endMark", "collect", "cancel", "disconnect", "recorderView", "snapshot"])
  test(`close ${kind} error cleans once and finish preserves exact error identity`, async () => {
    const primary = new Error(`literal-close-${kind}`);
    const options = {};
    if (["endMark", "collect", "cancel"].includes(kind)) options[`${kind}Error`] = primary;
    const h = makeFixtureHost(options);
    if (kind === "cancel") {
      const id = h.nativeRequest(() => {});
      h.setState({ scriptFrameHandle: id });
    }
    if (kind === "disconnect")
      h.setState({
        observer: {
          disconnect() {
            throw primary;
          },
        },
      });
    if (kind === "recorderView")
      h.runtime.recorder.getView = () => {
        throw primary;
      };
    if (kind === "snapshot")
      h.runtime.getSnapshot = () => {
        throw primary;
      };
    let initial;
    try {
      h.close();
    } catch (error) {
      initial = error;
    }
    assert.ok(allErrors(initial).includes(primary));
    assert.equal(h.nativeCalls.dispose, 1);
    assert.equal(h.state().runtime, null);
    assert.equal(h.window.requestAnimationFrame, h.previousRAF);
    await assert.rejects(h.finish(), (error) => error === initial);
    assert.equal(h.nativeCalls.dispose, 1, "no duplicate disposal");
    assert.ok(h.proof.snapshot().reasons.includes("COLLECTION_FAILED"));
  });
test("close collection failure plus cancellation/disposal/disconnect failure preserves every exact error", async () => {
  const primary = new Error("literal-collect"),
    cancel = new Error("literal-cancel"),
    dispose = new Error("literal-dispose"),
    disconnect = new Error("literal-disconnect");
  const h = makeFixtureHost({
    collectError: primary,
    cancelError: cancel,
    disposeError: dispose,
    disconnectError: disconnect,
  });
  h.setState({ scriptFrameHandle: h.nativeRequest(() => {}) });
  let actual;
  try {
    h.close();
  } catch (error) {
    actual = error;
  }
  for (const error of [primary, cancel, dispose, disconnect])
    assert.ok(allErrors(actual).includes(error), error.message);
  assert.equal(h.nativeCalls.dispose, 1);
  assert.equal(h.nativeCalls.disconnect, 1);
  await assert.rejects(h.finish(), (error) => error === actual);
});
