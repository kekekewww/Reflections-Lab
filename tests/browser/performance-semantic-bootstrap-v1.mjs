// One real, bounded post-begin task for the semantic fixture only.
// It neither changes the collection window nor repairs missing native CPU evidence.
const METHOD = "ONE_SHOT_POST_BEGIN";
const MAX_EVENTS = 200000;
const fields = [
  "schemaVersion",
  "method",
  "collectionId",
  "state",
  "scheduleCount",
  "fireCount",
  "requestedDelayMs",
  "timerHandle",
  "scheduledAtPerformanceMs",
  "enteredAtPerformanceMs",
  "exitedAtPerformanceMs",
  "enterMarkName",
  "exitMarkName",
];
const object = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const exact = (value, keys) =>
  object(value) &&
  Object.keys(value).length === keys.length &&
  keys.every((key) => Object.hasOwn(value, key));
const finite = Number.isFinite;
const positiveId = (value) => Number.isSafeInteger(value) && value > 0;
const id = (value) => typeof value === "string" && /^[a-zA-Z0-9-]{1,64}$/.test(value);

export function createSemanticBootstrap({ collectionId, clock, mark, schedule, cancel }) {
  if (!id(collectionId) || ![clock, mark, schedule, cancel].every((fn) => typeof fn === "function"))
    throw new Error("BOOTSTRAP_CONFIGURATION");
  const data = {
    schemaVersion: 1,
    method: METHOD,
    collectionId,
    state: "IDLE",
    scheduleCount: 0,
    fireCount: 0,
    requestedDelayMs: 0,
    timerHandle: null,
    scheduledAtPerformanceMs: null,
    enteredAtPerformanceMs: null,
    exitedAtPerformanceMs: null,
    enterMarkName: null,
    exitMarkName: null,
  };
  return {
    schedule() {
      if (data.state !== "IDLE") throw new Error("BOOTSTRAP_ALREADY_SCHEDULED_OR_CLOSED");
      data.scheduledAtPerformanceMs = clock();
      if (!finite(data.scheduledAtPerformanceMs)) throw new Error("BOOTSTRAP_CLOCK");
      data.state = "SCHEDULED";
      data.scheduleCount = 1;
      data.timerHandle = schedule(() => {
        if (data.state !== "SCHEDULED" || data.fireCount !== 0) return;
        if (!positiveId(data.timerHandle)) throw new Error("BOOTSTRAP_ASYNC_TIMER_REQUIRED");
        data.fireCount = 1;
        data.enteredAtPerformanceMs = clock();
        data.enterMarkName = `rlab-semantic.bootstrap.enter.${collectionId}.${data.timerHandle}`;
        data.exitMarkName = `rlab-semantic.bootstrap.exit.${collectionId}.${data.timerHandle}`;
        mark(data.enterMarkName);
        mark(data.exitMarkName);
        data.exitedAtPerformanceMs = clock();
        data.state = "FIRED";
      }, 0);
      if (!positiveId(data.timerHandle)) throw new Error("BOOTSTRAP_NATIVE_TIMER_HANDLE");
      return data.timerHandle;
    },
    snapshot: () => ({ ...data }),
    restore() {
      if (data.state === "SCHEDULED" && data.fireCount === 0) {
        data.state = "CANCELLED";
        cancel(data.timerHandle);
      } else if (data.state === "IDLE") data.state = "CANCELLED";
      return { ...data };
    },
  };
}

function inspect(bootstrap, ui, events, context) {
  const reject = (reason) => ({
    qualified: false,
    reasons: [reason],
    formalQualification: "NOT_APPROVED",
    deliveryDelayMs: null,
    entryFromBeginMs: null,
    nativeDspCpuMs: null,
  });
  if (
    !exact(bootstrap, fields) ||
    !object(ui) ||
    !object(ui.collectionWindow) ||
    !Array.isArray(events) ||
    events.length > MAX_EVENTS ||
    !object(context)
  )
    return reject("BOOTSTRAP_INPUT_SCHEMA_OR_CAP");
  const native = context.nativeEligibility,
    before = context.documentBefore,
    after = context.documentAfter;
  if (
    !object(native) ||
    native.qualified !== true ||
    !Array.isArray(native.validatedTasks) ||
    native.validatedTasks.length > MAX_EVENTS ||
    !positiveId(native.expectedPid) ||
    !positiveId(native.expectedTid) ||
    !object(before) ||
    !object(after) ||
    !["id", "loaderId", "url"].every(
      (key) =>
        typeof before[key] === "string" && before[key].length > 0 && before[key] === after[key],
    ) ||
    native.expectedNavigationId !== before.loaderId ||
    context.traceDataLoss !== false ||
    context.traceStreamClosed !== true
  )
    return reject("BOOTSTRAP_NATIVE_CONTEXT_OR_LIFECYCLE");
  const origin = ui.startedAtPerformanceMs,
    finish = ui.collectionWindow.endPerformanceMs;
  if (
    !id(bootstrap.collectionId) ||
    ui.collectionWindow.collectionId !== bootstrap.collectionId ||
    ui.collectionWindow.schemaVersion !== "3.0.0" ||
    ui.collectionWindow.beginPerformanceMs !== origin ||
    ![origin, finish, ui.sampleMilliseconds, native.begin, native.end].every(finite) ||
    ui.sampleMilliseconds <= 0 ||
    ui.sampleMilliseconds > 45000 ||
    finish - origin !== ui.sampleMilliseconds ||
    native.end <= native.begin ||
    ui.collectionWindow.beginMarkName !== `reflection-profile.begin.${bootstrap.collectionId}` ||
    ui.collectionWindow.endMarkName !== `reflection-profile.end.${bootstrap.collectionId}`
  )
    return reject("BOOTSTRAP_COLLECTION_WINDOW");
  const enterName = `rlab-semantic.bootstrap.enter.${bootstrap.collectionId}.${bootstrap.timerHandle}`;
  const exitName = `rlab-semantic.bootstrap.exit.${bootstrap.collectionId}.${bootstrap.timerHandle}`;
  const scheduled = bootstrap.scheduledAtPerformanceMs,
    entered = bootstrap.enteredAtPerformanceMs,
    exited = bootstrap.exitedAtPerformanceMs;
  if (
    bootstrap.schemaVersion !== 1 ||
    bootstrap.method !== METHOD ||
    bootstrap.state !== "FIRED" ||
    bootstrap.scheduleCount !== 1 ||
    bootstrap.fireCount !== 1 ||
    bootstrap.requestedDelayMs !== 0 ||
    !positiveId(bootstrap.timerHandle) ||
    bootstrap.enterMarkName !== enterName ||
    bootstrap.exitMarkName !== exitName ||
    ![scheduled, entered, exited].every(finite) ||
    scheduled < origin ||
    entered < scheduled ||
    exited < entered ||
    exited > finish ||
    entered - origin > 50
  )
    return reject("BOOTSTRAP_ONE_SHOT_OR_ACTUAL_TIMING");
  const sameOwner = (event) =>
    event?.pid === native.expectedPid && event?.tid === native.expectedTid;
  const ownedClaim = (event) => sameOwner(event) || event?.args?.data?.frame === before.id;
  const dataOf = (event) => event?.args?.data;
  const installs = [],
    fires = [],
    enters = [],
    exits = [],
    rawTasks = [];
  for (let index = 0; index < events.length; index++) {
    const event = events[index];
    if (!object(event)) return reject("BOOTSTRAP_RAW_EVENT_SCHEMA");
    if (["TimerInstall", "TimerFire"].includes(event.name) && ownedClaim(event)) {
      const data = dataOf(event),
        install = event.name === "TimerInstall";
      if (!object(data) || !positiveId(data.timerId))
        return reject("BOOTSTRAP_PRESENT_TIMER_SCHEMA");
      if (data.timerId === bootstrap.timerHandle)
        (install ? installs : fires).push({ event, index });
    }
    if (event.name === enterName) enters.push({ event, index });
    if (event.name === exitName) exits.push({ event, index });
    if (["RunTask", "ThreadControllerImpl::RunTask"].includes(event.name))
      rawTasks.push({ event, index });
  }
  if (installs.length !== 1 || fires.length !== 1 || enters.length !== 1 || exits.length !== 1)
    return reject("BOOTSTRAP_NATIVE_EVENT_MULTIPLICITY");
  const install = installs[0].event,
    fire = fires[0].event,
    enter = enters[0].event,
    exit = exits[0].event;
  const installData = dataOf(install),
    fireData = dataOf(fire);
  // Exact current category configuration excludes devtools.timeline.stack.
  if (
    !sameOwner(install) ||
    !sameOwner(fire) ||
    installData.frame !== before.id ||
    fireData.frame !== before.id ||
    !exact(installData, ["frame", "timerId", "timeout", "singleShot"]) ||
    !exact(fireData, ["frame", "timerId"]) ||
    installData.timeout !== 0 ||
    installData.singleShot !== true ||
    install.cat !== "devtools.timeline" ||
    fire.cat !== "devtools.timeline" ||
    install.ph !== "I" ||
    install.s !== "t" ||
    Object.hasOwn(install, "dur") ||
    fire.ph !== "X" ||
    ![install.ts, fire.ts, fire.dur, fire.ts + fire.dur].every(finite) ||
    fire.dur < 0 ||
    fire.ts - native.begin > 50000 ||
    install.ts < native.begin ||
    install.ts > fire.ts ||
    fire.ts < native.begin ||
    fire.ts + fire.dur > native.end
  )
    return reject("BOOTSTRAP_NATIVE_TIMER_IDENTITY_SCHEMA_OR_WINDOW");
  const marks = [enter, exit];
  for (const event of marks) {
    const data = dataOf(event);
    if (
      !sameOwner(event) ||
      event.cat !== "blink.user_timing" ||
      event.ph !== "I" ||
      event.s !== "t" ||
      !finite(event.ts) ||
      !object(data) ||
      data.navigationId !== before.loaderId ||
      !finite(data.callTime) ||
      !finite(data.startTime) ||
      data.callTime < fire.ts ||
      data.callTime > fire.ts + fire.dur ||
      event.ts < fire.ts ||
      event.ts > fire.ts + fire.dur
    )
      return reject("BOOTSTRAP_NATIVE_MARK_IDENTITY_OR_PHYSICAL_CALLTIME");
  }
  if (
    dataOf(enter).startTime - origin > 50 ||
    dataOf(enter).callTime > dataOf(exit).callTime ||
    entered > dataOf(enter).startTime ||
    dataOf(enter).startTime > dataOf(exit).startTime ||
    dataOf(exit).startTime > exited
  )
    return reject("BOOTSTRAP_CLOCK_AND_NATIVE_MARK_JOIN");
  const validated = new Set(native.validatedTasks.map((task) => JSON.stringify(task)));
  const enclosingTasks = rawTasks.filter(
    ({ event }) =>
      sameOwner(event) &&
      event.ph === "X" &&
      event.cat === "toplevel" &&
      [event.ts, event.dur, event.ts + event.dur].every(finite) &&
      event.dur >= 0 &&
      event.ts <= fire.ts &&
      event.ts + event.dur >= fire.ts + fire.dur &&
      validated.has(JSON.stringify(event)),
  );
  if (enclosingTasks.length !== 1) return reject("BOOTSTRAP_COMPLETE_RAW_VALIDATED_TASK_REQUIRED");
  return {
    qualified: true,
    reasons: [],
    formalQualification: "NOT_APPROVED",
    scope: "SEMANTIC_BOOTSTRAP_CAPTURE_ONLY",
    deliveryDelayMs: entered - scheduled,
    entryFromBeginMs: entered - origin,
    nativeDspCpuMs: null,
    requestedDelayMs: 0,
    capturedTimerId: bootstrap.timerHandle,
    rawEventIndexes: {
      install: installs[0].index,
      fire: fires[0].index,
      enterMark: enters[0].index,
      exitMark: exits[0].index,
      completeTask: enclosingTasks[0].index,
    },
    physicalTimerFireDurationUs: fire.dur,
    limitations:
      "One real task does not recover the pre-existing resumed task or prove lossless native CPU coverage",
  };
}
export function verifySemanticBootstrapV1(bootstrap, ui, events, context) {
  try {
    return inspect(bootstrap, ui, events, context);
  } catch {
    return {
      qualified: false,
      reasons: ["BOOTSTRAP_INPUT_UNVERIFIABLE"],
      formalQualification: "NOT_APPROVED",
      deliveryDelayMs: null,
      entryFromBeginMs: null,
      nativeDspCpuMs: null,
    };
  }
}
