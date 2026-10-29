import { ExperimentRecorder } from "../../../src/experiments/recorder.ts";
import { BlobStore } from "../../../src/persistence/blob-store.ts";
const nativeWorker = globalThis.Worker;
let postMs = null,
  replyAt = null;
class MeasuredWorker extends nativeWorker {
  constructor(...args) {
    super(...args);
    this.addEventListener(
      "message",
      () => {
        replyAt = performance.now();
      },
      { once: true },
    );
  }
  postMessage(...args) {
    const at = performance.now();
    try {
      return super.postMessage(...args);
    } finally {
      postMs = performance.now() - at;
    }
  }
}

const check = (truth, message) => {
  if (!truth) throw Error(message);
};
window.runCandidate = async (mode) => {
  check(["baseline", "worker"].includes(mode), "MODE");
  if (mode === "worker") globalThis.Worker = MeasuredWorker;
  const response = await fetch("/fixture.json");
  check(response.ok, "FIXTURE_HTTP");
  const data = await response.json();
  const recorder = Object.create(ExperimentRecorder.prototype);
  Object.assign(recorder, data, { events: new Set(data.events), finishResult: null });
  const store = new BlobStore({ databaseName: `r15-diagnostic-${crypto.randomUUID()}` });
  check(store.mode === "indexedDB", "INDEXEDDB_REQUIRED");
  const frames = [],
    longTasks = [];
  let collecting = true,
    raf = 0;
  const frame = (t) => {
    if (!collecting) return;
    if (frames.length < 20000) frames.push(t);
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  let observer = null;
  if (PerformanceObserver.supportedEntryTypes?.includes("longtask")) {
    observer = new PerformanceObserver((list) => {
      for (const e of list.getEntries())
        if (longTasks.length < 20000)
          longTasks.push({ startTime: e.startTime, duration: e.duration });
    });
    observer.observe({ type: "longtask", buffered: true });
  }
  try {
    const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));
    await nextFrame();
    await nextFrame();
    const t = performance.now(),
      pending = mode === "worker" ? store.sealRecording(recorder) : recorder.finish();
    check(pending === recorder.finish(), "RECORDER_FINISH_IDENTITY");
    const artifact = await pending,
      sealEnd = performance.now();
    let afterObserved = false,
      additionalAfter = false;
    const edgeDeadline = performance.now() + 500;
    for (let attempt = 0; attempt < 10 && performance.now() < edgeDeadline; attempt++) {
      const remaining = Math.max(0, edgeDeadline - performance.now());
      const tick = await Promise.race([
        nextFrame(),
        new Promise((resolve) => setTimeout(() => resolve(null), remaining)),
      ]);
      if (tick === null) break;
      if (afterObserved) {
        additionalAfter = true;
        break;
      }
      if (sealingFrameObserved()) afterObserved = true;
    }
    function sealingFrameObserved() {
      return frames.some((x) => x > sealEnd);
    }
    collecting = false;
    cancelAnimationFrame(raf);
    observer
      ?.takeRecords()
      .forEach((e) => longTasks.push({ startTime: e.startTime, duration: e.duration }));
    const sealingFrames = frames.slice();
    const intervals = sealingFrames
      .slice(1)
      .map((end, i) => ({
        rawStart: sealingFrames[i],
        rawEnd: end,
        rawDurationMs: end - sealingFrames[i],
        clippedStart: Math.max(t, sealingFrames[i]),
        clippedEnd: Math.min(sealEnd, end),
      }))
      .filter((x) => x.rawStart < sealEnd && x.rawEnd > t)
      .map((x) => ({ ...x, clippedDurationMs: Math.max(0, x.clippedEnd - x.clippedStart) }));
    const edgeCoverage = {
      start: intervals.some((x) => x.rawStart <= t && x.rawEnd >= t),
      end: intervals.some((x) => x.rawStart <= sealEnd && x.rawEnd >= sealEnd),
      afterSealRafs: sealingFrames.filter((x) => x > sealEnd).length,
      additionalAfter,
    };
    let calls = 0,
      retryFailure = null,
      receipt;
    const saveStart = performance.now();
    if (mode === "worker") {
      const nativeCommit = store.commit.bind(store);
      store.commit = async (...args) => {
        calls++;
        if (calls === 1) throw Error("TEST_QUOTA_FAIL");
        return nativeCommit(...args);
      };
      try {
        await store.saveRecording(artifact);
      } catch (e) {
        retryFailure = String(e).includes("TEST_QUOTA_FAIL");
      }
      check(retryFailure, "EXPECTED_COMMIT_FAILURE");
      const pair = await Promise.all([
        store.saveRecording(artifact),
        store.saveRecording(artifact),
      ]);
      receipt = pair[0];
      check(
        calls === 2 && JSON.stringify(receipt) === JSON.stringify(pair[1]),
        "RETRY_OR_CONCURRENCY",
      );
    } else receipt = await store.saveRecording(artifact);
    const saveEnd = performance.now(),
      saveMs = saveEnd - saveStart;
    await new Promise((resolve) => setTimeout(resolve, 30));
    observer
      ?.takeRecords()
      .forEach((e) => longTasks.push({ startTime: e.startTime, duration: e.duration }));
    observer?.disconnect();
    check(
      receipt.sha256 === "b92fa8d066e5d84206b4f839e11e033d35b78c0b7a771673f3ca79c82f012c5b",
      "ARTIFACT_HASH",
    );
    check(
      receipt.encodedSha256 === "243177464749f430a858de5c4374c592e4d1b45f13f489ca43fbe65d3ac948a6",
      "ENCODED_HASH",
    );
    check(receipt.byteLength === 8257745, "ENCODED_SIZE");
    const loaded = await store.loadRecording(receipt.runId, receipt.sha256);
    check(loaded.artifactSha256 === receipt.sha256, "LOAD_HASH");
    const tampered = structuredClone(artifact);
    tampered.frames[0].tick++;
    let rejected = false;
    try {
      await store.saveRecording(tampered);
    } catch {
      rejected = true;
    }
    check(rejected, "PUBLIC_TAMPER_ACCEPTED");
    return {
      status: "PASS",
      mode,
      timingStatus:
        edgeCoverage.start && edgeCoverage.end && edgeCoverage.additionalAfter
          ? "OBSERVED"
          : "UNVERIFIED_EDGE_COVERAGE",
      scope:
        "isolated synthetic recording, real Chrome IndexedDB and worker; no audio; not formal product performance",
      receipt,
      sealMs: sealEnd - t,
      postMs,
      replyToSealMs: replyAt === null ? null : sealEnd - replyAt,
      saveMs,
      raf: {
        intervals,
        edgeCoverage,
        maxRawMs: intervals.length ? Math.max(...intervals.map((x) => x.rawDurationMs)) : null,
        scope: "overlaps sealing window; clipped values and raw endpoints, approximation",
      },
      longTaskSupported: Boolean(observer),
      longTasks: longTasks.filter((e) => e.startTime < sealEnd && e.startTime + e.duration > t),
      saveLongTasks: longTasks.filter(
        (e) => e.startTime < saveEnd && e.startTime + e.duration > saveStart,
      ),
      checks: { retryFailure, calls, tamperRejected: rejected, indexedDB: true },
    };
  } finally {
    collecting = false;
    cancelAnimationFrame(raf);
    observer?.disconnect();
    store.close();
    globalThis.Worker = nativeWorker;
  }
};
