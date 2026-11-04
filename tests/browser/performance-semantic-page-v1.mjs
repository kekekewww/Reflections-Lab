/* global window, document, performance, requestAnimationFrame, cancelAnimationFrame, setTimeout */
import { createProofCollector } from "./performance-proof-v3.mjs";

const previousRAF = requestAnimationFrame;
const previousCancelRAF = cancelAnimationFrame;
const nativeRAF = previousRAF.bind(window);
const nativeCancel = previousCancelRAF.bind(window);
const collectionId = window.crypto.randomUUID();
const journal = {
  schemaVersion: "1.0.0",
  scenario: "native-raf-semantic-pilot-v1",
  collectionId,
  operations: [],
  marks: [],
};
const frames = new Map();
const handles = new Map();
const pending = new Set();
const invoked = new Set();
const children = {
  P0: ["A0", "A1", "A2"],
  A2: ["B0", "B1"],
  B1: ["C0"],
  C0: ["D0", "D1", "D2"],
  D2: ["E0", "E1"],
  E1: ["F0"],
  F0: ["G0", "G1"],
  G0: ["H0"],
  G1: ["H1"],
  H1: ["I0"],
  I0: ["J0", "J1"],
  J1: ["K0"],
  K0: ["L0", "L1"],
};
let phase = "pretrace",
  state = "IDLE",
  activeLabel = null;
let startedAt = null,
  collectionWindow = null,
  result = null,
  resolveResult;
function rawBits(number) {
  const storage = new ArrayBuffer(8);
  new DataView(storage).setFloat64(0, number, false);
  return [...new Uint8Array(storage)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
const collector = createProofCollector({
  mark(name) {
    const custom = activeLabel === "E0";
    const mark = custom ? performance.mark(name, { startTime: 0 }) : performance.mark(name);
    if (journal.marks.length >= 128) throw new Error("PILOT_MARK_CAP");
    journal.marks.push({
      name,
      representativeLabel: activeLabel,
      requestedStartTimeMs: custom ? 0 : null,
      returnedStartTimeMs: mark.startTime,
    });
  },
});
function operation(value) {
  if (journal.operations.length >= 512) throw new Error("PILOT_OPERATION_CAP");
  journal.operations.push(value);
}
function register(label, parentLabel = null) {
  if (handles.has(label)) throw new Error("PILOT_DUPLICATE_LABEL");
  let handle;
  handle = nativeRAF((rawRafMs) => {
    if (phase !== "measured" || state !== "OPEN") throw new Error("PILOT_CALLBACK_OUTSIDE_WINDOW");
    if (invoked.has(label) || invoked.size >= 128) throw new Error("PILOT_INVOCATION_OR_CAP");
    const observedNowMs = performance.now();
    pending.delete(handle);
    invoked.add(label);
    operation({
      kind: "callback",
      label,
      handle,
      phase,
      rawRafMs,
      rawRafBits: rawBits(rawRafMs),
      observedNowMs,
      observedNowBits: rawBits(observedNowMs),
    });
    activeLabel = label;
    try {
      collector.callback(handle, rawRafMs, observedNowMs, true);
    } finally {
      activeLabel = null;
    }
    const group = frames.get(rawRafMs);
    if (group) group.callbacks++;
    else
      frames.set(rawRafMs, {
        collectionId,
        timestamp: rawRafMs,
        callbackObservedAtPerformanceMs: observedNowMs,
        callbacks: 1,
      });
    if (label === "B1") {
      register("MC", label);
      cancel("MC");
    }
    for (const child of children[label] ?? []) register(child, label);
    if (label === "L1") setTimeout(close, 0);
  });
  handles.set(label, handle);
  pending.add(handle);
  operation({ kind: "register", label, handle, phase, parentLabel });
  collector.register(handle, phase === "measured");
  return handle;
}
function cancel(label) {
  const handle = handles.get(label);
  nativeCancel(handle);
  pending.delete(handle);
  operation({ kind: "cancel", label, handle, phase });
  collector.cancel(handle);
}
function close() {
  if (state !== "OPEN") throw new Error("PILOT_INVALID_CLOSE");
  const end = performance.mark(collectionWindow.endMarkName).startTime;
  collectionWindow.endPerformanceMs = end;
  collector.close();
  state = "CLOSED";
  result = structuredClone({
    journal,
    ui: {
      startedAtPerformanceMs: startedAt,
      sampleMilliseconds: end - startedAt,
      droppedSamples: 0,
      collectionWindow,
      frame: [...frames.values()],
      v3Proof: collector.snapshot(),
    },
  });
  document.getElementById("status").textContent =
    "Closed. Semantic evidence only; qualification is not approved.";
  resolveResult(result);
}
async function prepareAndPause() {
  if (state !== "IDLE") throw new Error("PILOT_ALREADY_PREPARED");
  state = "PRETRACE_PENDING";
  register("PC");
  cancel("PC");
  register("P0");
  register("P1");
  // The owned CDP gate starts tracing before this exact same task resumes.
  debugger;
  startedAt = performance.mark(`reflection-profile.begin.${collectionId}`).startTime;
  collectionWindow = {
    schemaVersion: "3.0.0",
    collectionId,
    beginMarkName: `reflection-profile.begin.${collectionId}`,
    endMarkName: `reflection-profile.end.${collectionId}`,
    beginPerformanceMs: startedAt,
    endPerformanceMs: null,
  };
  collector.begin(collectionId);
  phase = "measured";
  state = "OPEN";
  return await new Promise((resolve) => {
    resolveResult = resolve;
  });
}
function restore() {
  for (const handle of pending) nativeCancel(handle);
  pending.clear();
  return {
    nativeRafIdentityUnchanged: window.requestAnimationFrame === previousRAF,
    nativeCancelIdentityUnchanged: window.cancelAnimationFrame === previousCancelRAF,
    pendingAfterRestore: pending.size,
    state,
  };
}
window.__semanticPilot = { prepareAndPause, snapshot: () => result, restore };
window.__semanticPilotReady = true;
