import { createConnection } from "node:net";
import { performance } from "node:perf_hooks";
import { setTimeout, clearTimeout } from "node:timers";

// One loopback probe at cleanup time only. A refusal is not a persistent
// absence claim and does not authorize stopping a different listener.
export async function observePreviewListenerV4(
  options,
  {
    connect = createConnection,
    setTimer = setTimeout,
    clearTimer = clearTimeout,
    now = () => performance.now(),
  } = {},
) {
  if (
    options?.host !== "127.0.0.1" ||
    options?.port !== 5194 ||
    !Number.isSafeInteger(options?.timeoutMs) ||
    options.timeoutMs < 1 ||
    options.timeoutMs > 5000 ||
    ![connect, setTimer, clearTimer, now].every((value) => typeof value === "function")
  )
    throw new Error("V4_OWNED_PREVIEW_OBSERVATION_ARGUMENTS");
  const { host, port, timeoutMs } = options;
  const startedAtMonotonicMs = now();
  if (!Number.isFinite(startedAtMonotonicMs)) throw new Error("V4_MONOTONIC_CLOCK_UNAVAILABLE");
  return await new Promise((resolve) => {
    let socket,
      timer,
      settled = false;
    const finish = (listening, errorCode = null) => {
      if (settled) return;
      settled = true;
      if (timer !== undefined) clearTimer(timer);
      socket?.destroy();
      const endedAtMonotonicMs = now();
      const orderedClock =
        Number.isFinite(endedAtMonotonicMs) && endedAtMonotonicMs >= startedAtMonotonicMs;
      resolve({
        listening: orderedClock ? listening : null,
        observationScope: "BOUNDED_TCP_CONNECT_ONLY",
        host,
        port,
        timeoutMs,
        startedAtMonotonicMs,
        endedAtMonotonicMs: orderedClock ? endedAtMonotonicMs : null,
        errorCode: orderedClock ? errorCode : "MONOTONIC_CLOCK_UNAVAILABLE",
      });
    };
    timer = setTimer(() => finish(null, "CONNECT_OBSERVATION_TIMEOUT"), timeoutMs);
    try {
      socket = connect({ host, port });
      socket.once("connect", () => finish(true));
      socket.once("error", (error) => {
        const code = typeof error?.code === "string" ? error.code : null;
        finish(code === "ECONNREFUSED" ? false : null, code);
      });
    } catch (error) {
      finish(null, typeof error?.code === "string" ? error.code : null);
    }
  });
}
