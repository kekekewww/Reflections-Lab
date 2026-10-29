export async function quiesceProfile({ stopScheduling, isBusy, now, sleep, timeoutMs = 135000 }) {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 135000)
    throw Error("PROFILE_QUIESCENCE_BUDGET");
  stopScheduling();
  const deadline = now() + timeoutMs;
  while (isBusy()) {
    if (now() >= deadline) throw Error("PROFILE_SCRIPT_DID_NOT_QUIESCE");
    await sleep(Math.min(10, Math.max(0, deadline - now())));
  }
}
export async function runProfileTail({
  drain,
  pause,
  finishRecording,
  now,
  setTimer = setTimeout,
  clearTimer = clearTimeout,
  onStage = () => {},
  timeoutMs = 135000,
}) {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 135000)
    throw Error("PROFILE_TAIL_BUDGET");
  const startedAt = now(),
    deadline = startedAt + timeoutMs;
  async function step(stage, run) {
    onStage(stage);
    const remaining = deadline - now();
    if (remaining <= 0) throw Error("PROFILE_TAIL_TIMEOUT");
    let timer;
    const observed = Promise.resolve()
      .then(() => run(remaining))
      .then(
        (value) => ({ failed: false, value }),
        (error) => ({ failed: true, error }),
      );
    try {
      const result = await Promise.race([
        observed,
        new Promise((resolve) => {
          timer = setTimer(
            () => resolve({ failed: true, error: Error("PROFILE_TAIL_TIMEOUT") }),
            remaining,
          );
        }),
      ]);
      if (result.failed) throw result.error;
      return result.value;
    } finally {
      clearTimer(timer);
    }
  }
  await step("drain", drain);
  await step("pause", pause);
  await step("recordToggle", finishRecording);
  await step("final-drain", drain);
  onStage("complete");
  return { startedAt, deadline, endedAt: now() };
}
