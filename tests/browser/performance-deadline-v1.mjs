/* global setTimeout, clearTimeout */
/** Factories are never started after the deadline; completion is checked again after await. */
export async function runBeforeDeadline(label, operation, { deadlineMs, now = Date.now } = {}) {
  if (typeof operation !== "function" || !Number.isFinite(deadlineMs) || typeof now !== "function")
    throw new TypeError("VALID_ABSOLUTE_DEADLINE_AND_OPERATION_FACTORY_REQUIRED");
  if (now() >= deadlineMs) throw new Error(`PILOT_DEADLINE:${label}`);
  let timer;
  try {
    const result = await Promise.race([
      Promise.resolve().then(() => {
        if (now() >= deadlineMs) throw new Error(`PILOT_DEADLINE:${label}`);
        return operation();
      }),
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`PILOT_DEADLINE:${label}`)),
          Math.max(1, deadlineMs - now()),
        );
      }),
    ]);
    if (now() >= deadlineMs) throw new Error(`PILOT_DEADLINE:${label}`);
    return result;
  } finally {
    clearTimeout(timer);
  }
}
