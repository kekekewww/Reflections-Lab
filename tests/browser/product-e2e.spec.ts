import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import type { LabAction, LabViewModel } from "../../src/ui/contracts.js";
import type { RecordingArtifact, RecordingComparison } from "../../src/experiments/types.js";

interface NativeGraph {
  contexts: AudioContext[];
  starts: {
    nodeId: number;
    connectionCountAtStart: number;
    kind: "oscillator" | "sample";
    frequencyHz: number | null;
    at: number;
    durationSeconds: number | null;
  }[];
  panners: PannerNode[];
  delays: DelayNode[];
  destinations: number[];
  connections: { from: number; to: number; fromKind: string; toKind: string }[];
  nodeId(node: object): number;
  timingInstalled?: boolean;
  advanceTimings: {
    wallDeltaMs: number;
    costMs: number;
    beforeTick: number;
    afterTick: number;
    recordingState: string;
    afterState: string;
  }[];
  tickTimings: { tick: number; costMs: number; recordingState: string }[];
  droppedTimingSamples: number;
}
declare global {
  interface Window {
    /** Installed only by this browser-test initialization script. */
    __nativeGraph: NativeGraph;
  }
}
type GraphWindow = Window & { __nativeGraph: NativeGraph };
const observerLight = (process.env.PRODUCT_OBSERVER_PROFILE ?? "light") === "light";
test.beforeEach(async ({ context }) => {
  if (observerLight)
    await context.tracing.start({ screenshots: false, snapshots: false, sources: true });
});
test.afterEach(async ({ context }, info) => {
  if (observerLight)
    await context.tracing.stop({ path: info.outputPath("observer-light-source.trace.zip") });
});
type JsonRecord = Record<string, unknown>;
const asRecord = (value: unknown): JsonRecord => value as JsonRecord;
const canonical = (value: unknown): string => {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  return `{${Object.keys(asRecord(value))
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonical(asRecord(value)[key])}`)
    .join(",")}}`;
};
const sha256 = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");

function waveFixture(): Buffer {
  const frames = 4800,
    bytes = Buffer.alloc(44 + frames * 2);
  bytes.write("RIFF", 0);
  bytes.writeUInt32LE(bytes.length - 8, 4);
  bytes.write("WAVEfmt ", 8);
  bytes.writeUInt32LE(16, 16);
  bytes.writeUInt16LE(1, 20);
  bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(48000, 24);
  bytes.writeUInt32LE(96000, 28);
  bytes.writeUInt16LE(2, 32);
  bytes.writeUInt16LE(16, 34);
  bytes.write("data", 36);
  bytes.writeUInt32LE(frames * 2, 40);
  for (let index = 0; index < frames; index++)
    bytes.writeInt16LE(
      Math.round(Math.sin((index / 48000) * Math.PI * 2 * 220) * 2000),
      44 + index * 2,
    );
  return bytes;
}

async function instrumentNativeGraph(page: Page) {
  // Product E2E is always offline. The separately authorised Meta validation owns paid calls.
  await page.route("**/api/agent/propose**", (route) =>
    route.fulfill({
      status: 403,
      contentType: "application/json",
      body: JSON.stringify({
        error: {
          code: "E2E_MODEL_CALL_BLOCKED",
          message: "This product E2E suite cannot invoke a model.",
        },
      }),
    }),
  );
  await page.route("https://api.meta.ai/**", (route) => route.abort("blockedbyclient"));
  await page.addInitScript(() => {
    const identities = new WeakMap<object, number>();
    let sequence = 0;
    const graph: NativeGraph = {
      contexts: [],
      starts: [],
      panners: [],
      delays: [],
      destinations: [],
      connections: [],
      advanceTimings: [],
      tickTimings: [],
      droppedTimingSamples: 0,
      nodeId: (node) => {
        let identity = identities.get(node);
        if (identity === undefined) {
          identity = ++sequence;
          identities.set(node, identity);
        }
        return identity;
      },
    };
    (window as GraphWindow).__nativeGraph = graph;
    const Original = window.AudioContext;
    const originalConnect = AudioNode.prototype.connect;
    const connectNode = originalConnect as (
      this: AudioNode,
      destination: AudioNode,
      output?: number,
      input?: number,
    ) => AudioNode;
    const connectParam = originalConnect as (
      this: AudioNode,
      destination: AudioParam,
      output?: number,
    ) => void;
    AudioNode.prototype.connect = function (
      this: AudioNode,
      destination: AudioNode | AudioParam,
      output?: number,
      input?: number,
    ) {
      const result =
        destination instanceof AudioParam
          ? connectParam.call(this, destination, output)
          : connectNode.call(this, destination, output, input);
      graph.connections.push({
        from: graph.nodeId(this),
        to: graph.nodeId(destination),
        fromKind: this.constructor.name,
        toKind: destination.constructor.name,
      });
      return result;
    } as typeof AudioNode.prototype.connect;
    window.AudioContext = class extends Original {
      constructor(options?: AudioContextOptions) {
        super(options);
        graph.contexts.push(this);
        graph.destinations.push(graph.nodeId(this.destination));
      }
      override createOscillator() {
        const node = super.createOscillator(),
          start = node.start.bind(node);
        node.start = (when?: number) => {
          const frequencyHz = node.frequency.value;
          start(when);
          graph.starts.push({
            nodeId: graph.nodeId(node),
            connectionCountAtStart: graph.connections.length,
            kind: "oscillator",
            frequencyHz,
            at: when ?? 0,
            durationSeconds: null,
          });
        };
        return node;
      }
      override createBufferSource() {
        const node = super.createBufferSource(),
          start = node.start.bind(node);
        node.start = (when?: number, offset?: number, duration?: number) => {
          start(when, offset, duration);
          graph.starts.push({
            nodeId: graph.nodeId(node),
            connectionCountAtStart: graph.connections.length,
            kind: "sample",
            frequencyHz: null,
            at: when ?? 0,
            durationSeconds: node.buffer?.duration ?? null,
          });
        };
        return node;
      }
      override createPanner() {
        const node = super.createPanner();
        graph.panners.push(node);
        return node;
      }
      override createDelay(maxDelayTime?: number) {
        const node = super.createDelay(maxDelayTime);
        graph.delays.push(node);
        return node;
      }
    };
  });
}
async function command(page: Page, action: LabAction) {
  await page.evaluate(async (input) => {
    const runtime = window.__reflectionLab;
    if (!runtime) throw new Error("Product runtime not mounted");
    await runtime.dispatch(input);
    if (runtime.getSnapshot().error) throw new Error(runtime.getSnapshot().error);
  }, action);
}
async function open(page: Page) {
  await page.goto("/");
  const manifest = JSON.parse(await readFile("test-results/product-e2e/build.json", "utf8")) as {
    bundle: { path: string; sha256: string }[];
  };
  const expectedHtml = manifest.bundle.find(
    (file) => file.path === "test-results/product-preview-dist/index.html",
  )?.sha256;
  if (!expectedHtml) throw new Error("Frozen product index hash is missing");
  const servedHtml = await page.evaluate(async () =>
    [
      ...new Uint8Array(
        await crypto.subtle.digest(
          "SHA-256",
          await (await fetch(location.href, { cache: "reload" })).arrayBuffer(),
        ),
      ),
    ]
      .map((value) => value.toString(16).padStart(2, "0"))
      .join(""),
  );
  expect(servedHtml, "The preview server must serve the exact frozen product HTML").toBe(
    expectedHtml,
  );
  await expect(page.locator("canvas")).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => Boolean(window.__reflectionLabMount && window.__reflectionLab)))
    .toBe(true);
  await installRuntimeTimings(page);
}
async function installRuntimeTimings(page: Page) {
  await page.evaluate(() => {
    const runtime = window.__reflectionLab!,
      graph = window.__nativeGraph;
    if (graph.timingInstalled) return;
    graph.timingInstalled = true;
    const advance = runtime.advance.bind(runtime);
    runtime.advance = (delta: number) => {
      const before = runtime.getSnapshot(),
        started = performance.now();
      try {
        advance(delta);
      } finally {
        const after = runtime.getSnapshot(),
          sample = {
            wallDeltaMs: delta * 1000,
            costMs: performance.now() - started,
            beforeTick: before.tick,
            afterTick: after.tick,
            recordingState: before.recording.state,
            afterState: after.simulationState,
          };
        if (graph.advanceTimings.length < 4096) graph.advanceTimings.push(sample);
        else graph.droppedTimingSamples++;
      }
    };
    const onTick: unknown = Reflect.get(runtime, "onTick");
    if (typeof onTick === "function")
      Reflect.set(runtime, "onTick", (snapshot: { tick: number }) => {
        const started = performance.now(),
          recordingState = runtime.getSnapshot().recording.state;
        try {
          return Reflect.apply(onTick, runtime, [snapshot]);
        } finally {
          if (graph.tickTimings.length < 4096)
            graph.tickTimings.push({
              tick: snapshot.tick,
              costMs: performance.now() - started,
              recordingState,
            });
          else graph.droppedTimingSamples++;
        }
      });
  });
}
async function collectGraph(page: Page) {
  return page.evaluate(() => {
    const graph = (window as GraphWindow).__nativeGraph;
    const canvas = document.querySelector("canvas"),
      gl = canvas?.getContext("webgl2"),
      debug = gl?.getExtension("WEBGL_debug_renderer_info");
    return {
      browserDevice: {
        userAgent: navigator.userAgent,
        hardwareConcurrency: navigator.hardwareConcurrency,
        widthCssPx: innerWidth,
        heightCssPx: innerHeight,
        devicePixelRatio,
        webglVendor: gl ? gl.getParameter(debug?.UNMASKED_VENDOR_WEBGL ?? gl.VENDOR) : null,
        webglRenderer: gl ? gl.getParameter(debug?.UNMASKED_RENDERER_WEBGL ?? gl.RENDERER) : null,
      },
      contextCount: graph.contexts.length,
      contextStates: graph.contexts.map((context) => ({
        state: context.state,
        currentTimeSeconds: context.currentTime,
        sampleRateHz: context.sampleRate,
        baseLatencySeconds: context.baseLatency,
        outputLatencySeconds: context.outputLatency ?? null,
      })),
      starts: graph.starts,
      destinations: graph.destinations,
      connections: graph.connections,
      panners: graph.panners.map((node) => ({
        nodeId: graph.nodeId(node),
        panningModel: node.panningModel,
        rolloffFactor: node.rolloffFactor,
        distanceModel: node.distanceModel,
      })),
      delaysSeconds: graph.delays.map((node) => node.delayTime.value),
      delayNodes: graph.delays.map((node) => ({
        nodeId: graph.nodeId(node),
        delaySeconds: node.delayTime.value,
      })),
      timings: {
        advance: graph.advanceTimings,
        tickBridge: graph.tickTimings,
        droppedSamples: graph.droppedTimingSamples,
        limits:
          "Measured public advance and actual onTick bridge/capture spans, not complete UI CPU or native audio render deadline",
      },
    };
  });
}
const transportStamp = (model: LabViewModel) => ({
  tick: model.tick,
  simTimeSeconds: model.simTimeSeconds,
  state: model.simulationState,
  runId: model.runId,
  sceneRevision: model.sceneRevision,
  recordingState: model.recording.state,
  pauseReason: model.pauseReason ?? "",
});
interface ExplicitRecovery {
  phase: string;
  action: "EXPLICIT_UI_RUN";
  at: string;
  before: ReturnType<typeof transportStamp>;
  after: ReturnType<typeof transportStamp>;
}
async function recoverCapture(
  page: Page,
  phase: string,
  recoveries: ExplicitRecovery[],
): Promise<void> {
  const before = await page.evaluate(() => window.__reflectionLab!.getSnapshot());
  if (before.simulationState === "running") return;
  if (
    before.recording.state !== "recording" ||
    !/固定步.*超限|FIXED_STEP_OVERRUN/i.test(before.pauseReason ?? "")
  )
    throw new Error(
      `Unexpected capture stop at ${phase}: ${JSON.stringify(transportStamp(before))}`,
    );
  if (recoveries.length >= 8) throw new Error("Explicit capture recovery budget exhausted (8)");
  await page.getByRole("button", { name: /^(開始運算|繼續運算)$/ }).click({ timeout: 3000 });
  const after = await page.evaluate(() => window.__reflectionLab!.getSnapshot());
  recoveries.push({
    phase,
    action: "EXPLICIT_UI_RUN",
    at: new Date().toISOString(),
    before: transportStamp(before),
    after: transportStamp(after),
  });
  expect(after.runId).toBe(before.runId);
  expect(after.sceneRevision).toBe(before.sceneRevision);
  expect(after.recording.state).toBe("recording");
  expect(after.tick).toBeGreaterThanOrEqual(before.tick);
  if (after.error) throw new Error(after.error);
}
async function captureClick(
  page: Page,
  name: string,
  recoveries: ExplicitRecovery[],
): Promise<void> {
  for (;;) {
    await recoverCapture(page, `click:${name}`, recoveries);
    try {
      await page.getByRole("button", { name, exact: true }).click({ timeout: 1500 });
      return;
    } catch (error) {
      const state = await page.evaluate(() => window.__reflectionLab!.getSnapshot());
      if (
        state.simulationState === "running" ||
        !/固定步.*超限|FIXED_STEP_OVERRUN/i.test(state.pauseReason ?? "")
      )
        throw error;
    }
  }
}
async function captureWait(
  page: Page,
  phase: string,
  condition: () => Promise<boolean>,
  recoveries: ExplicitRecovery[],
  timeoutMs = 12000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await condition()) return;
    await recoverCapture(page, phase, recoveries);
    await page.waitForTimeout(50);
  }
  throw new Error(`Capture condition timed out: ${phase}`);
}

async function productChain(page: Page, info: TestInfo, launch: number) {
  const consoleEntries: { type: string; text: string }[] = [],
    pageErrors: string[] = [],
    modelRequests: string[] = [];
  page.on("console", (message) =>
    consoleEntries.push({ type: message.type(), text: message.text() }),
  );
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("request", (request) => {
    if (/api\/agent\/(propose|propose-sound)/.test(request.url()))
      modelRequests.push(request.url());
  });
  await instrumentNativeGraph(page);
  const source = waveFixture(),
    originalWavHash = sha256(source);
  const recoveries: ExplicitRecovery[] = [];
  let warmupEvidence: unknown = null;
  let captureStart: {
    before: ReturnType<typeof transportStamp>;
    after: ReturnType<typeof transportStamp>;
  } | null = null;
  let failureSealError: string | null = null;
  try {
    await open(page);
    expect((await collectGraph(page)).contextCount).toBe(0);
    await page.getByRole("checkbox", { name: "我確認有權使用匯入的音檔", exact: true }).check();
    await page
      .locator(".scene-explorer input[type='file']")
      .setInputFiles({ name: "original-220hz.wav", mimeType: "audio/wav", buffer: source });
    await expect
      .poll(() =>
        page.evaluate(() =>
          window
            .__reflectionLab!.getSnapshot()
            .assets.some(
              (asset) => asset.name === "original-220hz.wav" && asset.status === "ready",
            ),
        ),
      )
      .toBe(true);
    expect((await collectGraph(page)).contextCount).toBe(0);
    const assetId = await page.evaluate(
      () =>
        window
          .__reflectionLab!.getSnapshot()
          .assets.find((asset) => asset.name === "original-220hz.wav")!.id,
    );
    await command(page, {
      type: "patchRule",
      objectId: "speaker",
      ruleId: "rule.always",
      patch: { generator: "sample", assetId },
    });
    await command(page, {
      type: "patchObject",
      objectId: "ball",
      patch: { positionM: [0, 1.6, 1.5], mode: "dynamicNoGravity" },
    });
    // This is a real user gesture enabling the product's native AudioContext.
    await page.getByRole("button", { name: "啟用聆聽", exact: true }).click();
    await expect
      .poll(() => page.evaluate(() => window.__reflectionLab!.getSnapshot().monitor.state))
      .toBe("audible");
    expect((await collectGraph(page)).contextCount).toBe(1);
    await expect
      .poll(() => page.evaluate(() => (window as GraphWindow).__nativeGraph.contexts[0]?.state))
      .toBe("running");
    const nativeClockBefore = await page.evaluate(
      () => (window as GraphWindow).__nativeGraph.contexts[0]!.currentTime,
    );
    await expect
      .poll(() =>
        page.evaluate(() => (window as GraphWindow).__nativeGraph.contexts[0]!.currentTime),
      )
      .toBeGreaterThan(nativeClockBefore);
    // Real readiness prewarm: run the actual editor graph, then explicitly Pause + Reset before capture.
    await command(page, { type: "run" });
    await expect
      .poll(
        async () => {
          const observed = await page.evaluate(() => {
            const state = window.__reflectionLab!.getSnapshot(),
              graph = window.__nativeGraph;
            const ready =
              state.simulationState === "running" &&
              state.monitor.activeVoices > 0 &&
              state.acoustic.state === "ready" &&
              state.paths.some((path) => path.stale !== true) &&
              graph.starts.some((start) => start.kind === "sample") &&
              graph.panners.some(
                (panner) => panner.panningModel === "HRTF" && panner.rolloffFactor === 0,
              ) &&
              graph.delays.some((delay) => delay.delayTime.value > 0) &&
              graph.contexts[0]!.state === "running";
            return {
              ready,
              evidence: {
                tick: state.tick,
                state: state.simulationState,
                acousticState: state.acoustic.state,
                voices: state.monitor.activeVoices,
                freshPaths: state.paths.filter((path) => path.stale !== true).length,
                nativeContextTime: graph.contexts[0]!.currentTime,
                nativeStarts: graph.starts.length,
                policy:
                  "Actual native graph and fresh solver readiness; atomic observation; explicit Pause+Reset before recording, not a timed sleep",
              },
            };
          });
          if (observed.ready) warmupEvidence = observed.evidence;
          return observed.ready;
        },
        { timeout: 15000 },
      )
      .toBe(true);
    await command(page, { type: "pause" });
    await command(page, { type: "reset" });
    await command(page, { type: "enterFPS" });
    await page.getByRole("button", { name: "啟用免鎖定操作", exact: true }).click();
    await page.getByRole("button", { name: /^(開始運算|繼續運算)$/ }).click();
    captureStart = await page.evaluate(async () => {
      const runtime = window.__reflectionLab!,
        stamp = (model: LabViewModel) => ({
          tick: model.tick,
          simTimeSeconds: model.simTimeSeconds,
          state: model.simulationState,
          runId: model.runId,
          sceneRevision: model.sceneRevision,
          recordingState: model.recording.state,
          pauseReason: model.pauseReason ?? "",
        });
      const before = stamp(runtime.getSnapshot());
      await runtime.dispatch({ type: "recordToggle" });
      if (runtime.getSnapshot().error) throw new Error(runtime.getSnapshot().error);
      return { before, after: stamp(runtime.getSnapshot()) };
    });
    await captureClick(page, "抓取", recoveries);
    await captureWait(
      page,
      "actual held body",
      () =>
        page.evaluate(
          () =>
            window.__reflectionLab!.getSnapshot().objects.find((object) => object.id === "ball")!
              .held === true,
        ),
      recoveries,
    );
    await captureWait(
      page,
      "OnGrab",
      () =>
        page.evaluate(() =>
          window.__reflectionLab!.getSnapshot().events.some((event) => event.type === "OnGrab"),
        ),
      recoveries,
    );
    await captureClick(page, "投擲", recoveries);
    await captureWait(
      page,
      "OnThrow",
      () =>
        page.evaluate(() =>
          window.__reflectionLab!.getSnapshot().events.some((event) => event.type === "OnThrow"),
        ),
      recoveries,
    );
    await captureWait(
      page,
      "OnImpact",
      () =>
        page.evaluate(() =>
          window
            .__reflectionLab!.getSnapshot()
            .events.some((event) => event.type === "OnImpact" && event.objectId === "ball"),
        ),
      recoveries,
    );
    await captureWait(
      page,
      "native impact source",
      () =>
        page.evaluate(() =>
          window.__nativeGraph.starts.some(
            (start) => start.kind === "oscillator" && start.frequencyHz === 440,
          ),
        ),
      recoveries,
    );
    await command(page, { type: "recordToggle" });
    await command(page, { type: "pause" });
    const artifact = await page.evaluate(() => window.__reflectionLab!.getRecordingArtifact());
    expect(artifact?.status).toBe("captured");
    expect(artifact!.frameCount).toBeGreaterThan(10);
    expect(artifact!.startTick).toBe(captureStart.before.tick + 1);
    expect(captureStart.after.runId).toBe(captureStart.before.runId);
    expect(captureStart.after.sceneRevision).toBe(captureStart.before.sceneRevision);
    expect(artifact!.frameCount).toBe(artifact!.endTick! - artifact!.startTick! + 1);
    for (let index = 0; index < artifact!.frames.length; index++) {
      expect(artifact!.frames[index]!.tick).toBe(artifact!.startTick! + index);
      expect(artifact!.frames[index]!.runEpoch).toBe(artifact!.runEpoch);
    }
    const body = { ...artifact } as Record<string, unknown>;
    delete body.artifactSha256;
    expect(sha256(canonical(body))).toBe(artifact!.artifactSha256);
    const events = artifact!.frames.flatMap((frame) =>
      frame.audioEvents.map((event) => ({ event: asRecord(event), frame })),
    );
    for (const trigger of ["OnGrab", "OnThrow"]) {
      expect(
        artifact!.frames
          .flatMap((frame) => frame.physicsEvents)
          .filter(
            (event) =>
              asRecord(event).type === trigger &&
              asRecord(event).accepted === true &&
              asRecord(event).objectId === "ball",
          ),
      ).toHaveLength(1);
      expect(
        events.filter(
          ({ event }) =>
            event.action === "start" &&
            asRecord(event.trigger).type === trigger &&
            event.objectId === "ball",
        ),
      ).toHaveLength(1);
    }
    for (const trigger of ["OnGrab", "OnThrow", "OnImpact"])
      expect(
        events.some(
          ({ event, frame }) =>
            event.action === "start" &&
            asRecord(event.trigger).type === trigger &&
            frame.physicsEvents.some(
              (raw) =>
                asRecord(raw).eventId === event.parentPhysicsEventId &&
                asRecord(raw).type === trigger &&
                asRecord(raw).accepted === true,
            ),
        ),
      ).toBe(true);
    const impacts = events.filter(
      ({ event }) => event.action === "start" && asRecord(event.trigger).type === "OnImpact",
    );
    for (const { event, frame } of impacts) {
      expect(
        frame.physicsEvents.some(
          (raw) =>
            asRecord(raw).type === "OnImpact" &&
            asRecord(raw).eventId === event.parentPhysicsEventId,
        ),
      ).toBe(true);
      const route = frame.acousticFrames.find((acoustic) => acoustic.sourceId === event.instanceId);
      expect(route?.poseTick).toBe(frame.tick);
      const direct = route!.paths.find((path) => path.order === 0);
      expect(direct?.verticesM[0]).toEqual(event.positionMetres);
      expect(direct?.verticesM.at(-1)).toEqual(frame.listener.positionM);
    }
    await command(page, { type: "exitFPS" });
    await command(page, { type: "captureComparison", slot: "A" });
    await command(page, {
      type: "patchObject",
      objectId: "wall.back",
      patch: { acousticMaterialId: "material.soft" },
    });
    await command(page, { type: "captureComparison", slot: "B" });
    await command(page, { type: "compare", kind: "acoustic" });
    const comparison = await page.evaluate(() => {
      const runtime = window.__reflectionLab!,
        host = Reflect.get(runtime, "recorder") as {
          getComparison(): RecordingComparison | null;
        };
      return {
        view: runtime.getSnapshot().comparison,
        slots: runtime.getComparisonArtifacts(),
        result: host.getComparison(),
        resultAccess:
          "Read-only actual RecordingHost.getComparison test seam via runtime reflection",
      };
    });
    await writeFile(info.outputPath("comparison.json"), JSON.stringify(comparison, null, 2) + "\n");
    await writeFile(
      info.outputPath("recording-candidate.json"),
      JSON.stringify(comparison.slots.B) + "\n",
    );
    expect(comparison.view.status).toContain("固定條件相符");
    expect(comparison.result?.matched).toBe(true);
    const directMetric = comparison.result!.metrics.find(
      (metric) => metric.id === "meanDirectDelay",
    )!;
    expect(directMetric.reason).toBeNull();
    expect(directMetric.method).toContain("playing");
    expect(directMetric.population?.compatible).toBe(true);
    expect(directMetric.population!.a.kind).toBe("logicalPlayingSourceQueries");
    expect(directMetric.population!.b.kind).toBe("logicalPlayingSourceQueries");
    expect(directMetric.population!.a.sampleCount).toBeGreaterThan(0);
    expect(directMetric.population!.a.sampleCount).toBe(directMetric.population!.b.sampleCount);
    expect(
      directMetric.delta,
      "Material-only B must preserve direct-delay estimator population and values",
    ).toBe(0);
    const pathMetric = comparison.result!.metrics.find((metric) => metric.id === "meanPathEnergy")!;
    expect(pathMetric.reason).toBeNull();
    expect(pathMetric.population?.compatible).toBe(true);
    expect(pathMetric.population!.a.sampleCount).toBeGreaterThan(0);
    expect(pathMetric.population!.a.sampleCount).toBe(pathMetric.population!.b.sampleCount);
    expect(comparison.slots.B!.fingerprints.motionTraceHash).toBe(
      comparison.slots.A!.fingerprints.motionTraceHash,
    );
    expect(comparison.slots.B!.fingerprints.sourceSignalHash).toBe(
      comparison.slots.A!.fingerprints.sourceSignalHash,
    );
    expect(comparison.slots.B!.fingerprints.propagationMaterialHash).not.toBe(
      comparison.slots.A!.fingerprints.propagationMaterialHash,
    );
    expect(comparison.slots.A!.artifactSha256).toBe(artifact!.artifactSha256);
    const { artifactSha256: candidateHash, ...candidateBody } = comparison.slots.B!;
    expect(sha256(canonical(candidateBody))).toBe(candidateHash);
    const acousticContent = (recording: RecordingArtifact) =>
      recording.frames.map((frame) =>
        frame.acousticFrames
          .flatMap((acoustic) =>
            acoustic.paths.map((path) => ({
              order: path.order,
              verticesM: path.verticesM,
              surfaceIds: path.surfaceIds,
              bandGains: path.bandGains,
              lengthM: path.lengthM,
              absoluteDelayS: path.absoluteDelayS,
            })),
          )
          .map(canonical)
          .sort(),
      );
    expect(
      acousticContent(comparison.slots.B!),
      "B must contain newly solved propagation changes, not merely a different material fingerprint",
    ).not.toEqual(acousticContent(comparison.slots.A!));
    const graph = await collectGraph(page);
    expect(graph.starts.some((start) => start.kind === "sample")).toBe(true);
    expect(graph.panners.length).toBeGreaterThan(0);
    expect(
      graph.panners.every((panner) => panner.panningModel === "HRTF" && panner.rolloffFactor === 0),
    ).toBe(true);
    expect(graph.delaysSeconds.some((delay) => delay > 0)).toBe(true);
    const connectedPath = (start: number, connectionCountAtStart: number): number[] | null => {
      const visited = new Set<string>(),
        queue: number[][] = [[start]];
      for (let path = queue.shift(); path; path = queue.shift()) {
        const at = path.at(-1)!;
        const hasPanner = path.some((node) =>
            graph.panners.some((panner) => panner.nodeId === node),
          ),
          hasDelay = path.some((node) =>
            graph.delayNodes.some((delay) => delay.nodeId === node && delay.delaySeconds > 0),
          ),
          state = `${at}:${hasPanner}:${hasDelay}`;
        if (graph.destinations.includes(at) && hasPanner && hasDelay) return path;
        if (visited.has(state)) continue;
        visited.add(state);
        for (const edge of graph.connections.slice(0, connectionCountAtStart))
          if (edge.from === at) queue.push([...path, edge.to]);
      }
      return null;
    };
    const impactNativePaths = graph.starts
      .filter((start) => start.kind === "oscillator" && start.frequencyHz === 440)
      .map((start) => connectedPath(start.nodeId, start.connectionCountAtStart))
      .filter((path): path is number[] => path !== null);
    expect(
      impactNativePaths.length,
      "A native impact source must actually connect through the product graph to its AudioDestination",
    ).toBeGreaterThan(0);
    expect(
      impactNativePaths.some(
        (path) =>
          path.some((node) => graph.panners.some((panner) => panner.nodeId === node)) &&
          path.some((node) =>
            graph.delayNodes.some((delay) => delay.nodeId === node && delay.delaySeconds > 0),
          ),
      ),
    ).toBe(true);
    const project = await page.evaluate(() => window.__reflectionLab!.exportProject());
    const projectDocument = JSON.parse(project) as {
      assets: { assetId: string; sha256: string }[];
      recordings: { runId: string; sha256: string }[];
    };
    expect(projectDocument.assets.find((asset) => asset.assetId === assetId)?.sha256).toBe(
      originalWavHash,
    );
    expect(
      projectDocument.recordings.some((recording) => recording.sha256 === artifact!.artifactSha256),
    ).toBe(true);
    await page.getByRole("button", { name: "儲存專案", exact: true }).click();
    await expect
      .poll(() => page.evaluate(() => window.__reflectionLab!.getSnapshot().notice))
      .toMatch(/已儲存/);
    const downloadPromise = page.waitForEvent("download");
    await command(page, { type: "exportRecording" });
    const download = await downloadPromise,
      file = await download.path();
    if (!file) throw new Error("Recording download has no local file");
    const downloaded = JSON.parse(await readFile(file, "utf8")) as RecordingArtifact;
    expect(downloaded.artifactSha256).toBe(artifact!.artifactSha256);
    expect(downloaded.frames).toEqual(artifact!.frames);
    await page.reload();
    await expect.poll(() => page.evaluate(() => Boolean(window.__reflectionLab))).toBe(true);
    expect((await collectGraph(page)).contextCount).toBe(0);
    await page.getByRole("button", { name: "載入本機已儲存的專案", exact: true }).click();
    await expect
      .poll(() => page.evaluate(() => window.__reflectionLab!.getSnapshot().recording.canReplay))
      .toBe(true);
    const restored = await page.evaluate(() => ({
      artifact: window.__reflectionLab!.getRecordingArtifact(),
      assets: window.__reflectionLab!.getSnapshot().assets,
    }));
    expect(restored.artifact!.artifactSha256).toBe(artifact!.artifactSha256);
    expect(restored.assets.find((asset) => asset.id === assetId)?.status).toBe("ready");
    expect((await collectGraph(page)).contextCount).toBe(0);
    await page.getByRole("button", { name: "啟用聆聽", exact: true }).click();
    const sampleStartsBeforeReplay = await page.evaluate(
      () =>
        (window as GraphWindow).__nativeGraph.starts.filter((start) => start.kind === "sample")
          .length,
    );
    await command(page, { type: "replay" });
    await expect
      .poll(() => page.evaluate(() => window.__reflectionLab!.getSnapshot().tick))
      .toBeGreaterThan(artifact!.startTick!);
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (window as GraphWindow).__nativeGraph.starts.filter((start) => start.kind === "sample")
              .length,
        ),
      )
      .toBeGreaterThan(sampleStartsBeforeReplay);
    await expect
      .poll(() => page.evaluate(() => window.__reflectionLab!.getSnapshot().monitor.activeVoices))
      .toBeGreaterThan(0);
    await command(page, { type: "pause" });
    const replayTime = await page.evaluate(
      () => window.__reflectionLab!.getSnapshot().recording.replayTimeSeconds,
    );
    await page.waitForTimeout(120);
    expect(
      await page.evaluate(() => window.__reflectionLab!.getSnapshot().recording.replayTimeSeconds),
    ).toBe(replayTime);
    const seekTime = Math.min(0.1, (artifact!.endTick! - artifact!.startTick!) / 60);
    await command(page, {
      type: "seek",
      timeSeconds: seekTime,
    });
    const seekTick = artifact!.startTick! + Math.round(seekTime * 60),
      seekFrame = artifact!.frames.find((frame) => frame.tick === seekTick)!;
    const seekPose = seekFrame.poses.find((pose) => pose.objectId === "ball")!;
    const observedSeek = await page.evaluate(() => ({
      tick: window.__reflectionLab!.getSnapshot().tick,
      pose: window.__reflectionLab!.getPose("ball"),
    }));
    expect(observedSeek.tick).toBe(seekTick);
    expect(observedSeek.pose).toEqual({
      positionM: seekPose.positionM,
      orientationQuaternion: seekPose.orientationQuaternion,
    });
    const sampleStartsBeforeResume = await page.evaluate(
      () =>
        (window as GraphWindow).__nativeGraph.starts.filter((start) => start.kind === "sample")
          .length,
    );
    await command(page, { type: "run" });
    await expect
      .poll(() =>
        page.evaluate(() => window.__reflectionLab!.getSnapshot().recording.replayTimeSeconds),
      )
      .toBeGreaterThan(0.1);
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (window as GraphWindow).__nativeGraph.starts.filter((start) => start.kind === "sample")
              .length,
        ),
      )
      .toBeGreaterThan(sampleStartsBeforeResume);
    await command(page, { type: "stopReplay" });
    await page.screenshot({ path: info.outputPath(`launch-${launch}-restored.png`) });
    expect(modelRequests).toEqual([]);
    expect(pageErrors).toEqual([]);
    expect(
      consoleEntries.filter((entry) => entry.type === "error"),
      "Clean product launches must retain and reject browser console errors",
    ).toEqual([]);
    const evidence = {
      schemaVersion: 1,
      launch,
      observerProfile: observerLight
        ? "observer-light: no continuous video or DOM/action screenshots; source/API trace retained"
        : "instrumented: continuous video and full trace snapshots",
      browser: await page.context().browser()!.version(),
      actualControlClass:
        "Product UI for WAV rights/import, native listening gesture, alternative input, grab/throw, save/load; public runtime actions for authoring/capture/A-B/replay/export",
      originalWavHash,
      assetId,
      artifactHash: artifact!.artifactSha256,
      frameCount: artifact!.frameCount,
      warmupEvidence,
      captureStart,
      explicitOverrunRecoveries: recoveries,
      nativeGraph: graph,
      comparison: comparison.view,
      comparisonResult: comparison.result,
      comparisonResultAccess: comparison.resultAccess,
      fingerprints: { A: comparison.slots.A!.fingerprints, B: comparison.slots.B!.fingerprints },
      restoredArtifactHash: restored.artifact!.artifactSha256,
      pageErrors,
      modelRequests,
      limitations: [
        "Real native Web Audio API graph instrumentation, not hardware hearing or AudioWorklet deadline proof",
        "Synthetic material data; computed first-order finite surface acoustics",
        "This case uses one clean browser context; distinct clean-launch cases create separate contexts; no account/model calls",
      ],
    };
    await writeFile(info.outputPath("evidence.json"), JSON.stringify(evidence, null, 2) + "\n");
    await writeFile(info.outputPath("project.json"), project);
    await writeFile(info.outputPath("recording.json"), JSON.stringify(artifact) + "\n");
  } catch (failure) {
    let sealTimer: ReturnType<typeof setTimeout> | undefined;
    try {
      await writeFile(
        info.outputPath("failure-native-graph.json"),
        JSON.stringify(await collectGraph(page), null, 2) + "\n",
      );
      const sealing = page.evaluate(async () => {
        const runtime = window.__reflectionLab;
        if (!runtime) return null;
        const before = runtime.getSnapshot();
        if (before.recording.state === "recording")
          await runtime.dispatch({ type: "recordToggle" });
        return {
          before,
          after: runtime.getSnapshot(),
          recording: runtime.getRecordingArtifact(),
          project: runtime.exportProject(),
        };
      });
      const partial = await Promise.race([
        sealing,
        new Promise<never>((_, reject) => {
          sealTimer = setTimeout(
            () => reject(new Error("Failed-run artifact seal exceeded10s")),
            10000,
          );
        }),
      ]);
      if (partial) {
        await writeFile(
          info.outputPath("failure-state.json"),
          JSON.stringify(
            { testFailure: String(failure), before: partial.before, after: partial.after },
            null,
            2,
          ) + "\n",
        );
        if (partial.recording)
          await writeFile(
            info.outputPath("failure-recording.json"),
            JSON.stringify(partial.recording) + "\n",
          );
        await writeFile(info.outputPath("failure-project.json"), partial.project);
      }
    } catch (error) {
      failureSealError = String(error);
    } finally {
      if (sealTimer !== undefined) clearTimeout(sealTimer);
    }
    throw failure;
  } finally {
    await writeFile(
      info.outputPath("execution-diagnostics.json"),
      JSON.stringify(
        {
          warmupEvidence,
          captureStart,
          explicitOverrunRecoveries: recoveries,
          recoveryBudget: 8,
          captureResetOrDroppedTicksAllowed: false,
          failureSealError,
        },
        null,
        2,
      ) + "\n",
    );
    await writeFile(
      info.outputPath("console.json"),
      JSON.stringify({ consoleEntries, pageErrors, modelRequests }, null, 2) + "\n",
    );
  }
}

for (let launch = 1; launch <= 3; launch++) {
  test(`clean launch ${launch}: actual throw/impact/native audio/capture/acoustic B and durable reload/replay`, async ({
    page,
  }, info) => productChain(page, info, launch));
}

test("a separate browser store rejects missing WAV bytes, then relinks the exact original without activating hardware", async ({
  page,
  browser,
}, info) => {
  const source = waveFixture();
  const consoleEntries: { page: string; type: string; text: string }[] = [],
    errors: string[] = [],
    modelRequests: string[] = [];
  const observe = (observed: Page, label: string) => {
    observed.on("console", (message) =>
      consoleEntries.push({ page: label, type: message.type(), text: message.text() }),
    );
    observed.on("pageerror", (error) => errors.push(`${label}: ${error.message}`));
    observed.on("request", (request) => {
      if (/\/api\/agent\/propose|https:\/\/api\.meta\.ai\//.test(request.url()))
        modelRequests.push(`${label}: ${request.url()}`);
    });
  };
  observe(page, "source");
  await instrumentNativeGraph(page);
  await open(page);
  await page.getByRole("checkbox", { name: "我確認有權使用匯入的音檔", exact: true }).check();
  await page
    .locator(".scene-explorer input[type='file']")
    .setInputFiles({ name: "source-original.wav", mimeType: "audio/wav", buffer: source });
  await expect
    .poll(() =>
      page.evaluate(() =>
        window
          .__reflectionLab!.getSnapshot()
          .assets.some((asset) => asset.name === "source-original.wav"),
      ),
    )
    .toBe(true);
  const assetId = await page.evaluate(
    () =>
      window
        .__reflectionLab!.getSnapshot()
        .assets.find((asset) => asset.name === "source-original.wav")!.id,
  );
  await command(page, {
    type: "patchRule",
    objectId: "speaker",
    ruleId: "rule.always",
    patch: { generator: "sample", assetId },
  });
  const project = await page.evaluate(() => window.__reflectionLab!.exportProject());
  const other = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  let targetTraceStarted = false;
  try {
    await other.tracing.start({
      screenshots: !observerLight,
      snapshots: !observerLight,
      sources: true,
    });
    targetTraceStarted = true;
    const target = await other.newPage();
    observe(target, "target");
    await instrumentNativeGraph(target);
    await target.goto("http://127.0.0.1:5190/");
    await expect.poll(() => target.evaluate(() => Boolean(window.__reflectionLab))).toBe(true);
    const oldScene = await target.evaluate(() => window.__reflectionLab!.getSceneDocument());
    const rejected = await target.evaluate(async (text) => {
      await window.__reflectionLab!.dispatch({ type: "importProject", text });
      return window.__reflectionLab!.getSnapshot().error;
    }, project);
    expect(rejected).toMatch(/ASSET_REQUIRED_MISSING|original WAV/);
    expect(await target.evaluate(() => window.__reflectionLab!.getSceneDocument())).toEqual(
      oldScene,
    );
    expect((await collectGraph(target)).contextCount).toBe(0);
    await target.getByRole("checkbox", { name: "我確認有權使用匯入的音檔", exact: true }).check();
    const wrong = Buffer.from(source);
    wrong.writeInt16LE(1234, wrong.length - 2);
    await target
      .locator(".scene-explorer input[type='file']")
      .setInputFiles({ name: "wrong.wav", mimeType: "audio/wav", buffer: wrong });
    await expect
      .poll(() => target.evaluate(() => window.__reflectionLab!.getSnapshot().error))
      .toMatch(/ASSET_RELINK_MISMATCH|does not match any external asset SHA/);
    expect(await target.evaluate(() => window.__reflectionLab!.getSnapshot().assets)).toEqual([]);
    await target
      .locator(".scene-explorer input[type='file']")
      .setInputFiles({ name: "renamed-exact-original.wav", mimeType: "audio/wav", buffer: source });
    await expect
      .poll(() => target.evaluate(() => window.__reflectionLab!.getSnapshot().notice))
      .toMatch(/再次套用/);
    expect(await target.evaluate(() => window.__reflectionLab!.getSnapshot().assets)).toEqual([]);
    await command(target, { type: "importProject", text: project });
    const loaded = await target.evaluate(() => ({
      project: JSON.parse(window.__reflectionLab!.exportProject()),
      view: window.__reflectionLab!.getSnapshot(),
    }));
    expect(
      loaded.project.assets.find((asset: { assetId: string }) => asset.assetId === assetId).sha256,
    ).toBe(sha256(source));
    expect(loaded.view.assets.filter((asset) => asset.id === assetId)).toHaveLength(1);
    expect(loaded.view.assets.find((asset) => asset.id === assetId)?.status).toBe("ready");
    expect(loaded.view.recording.canReplay).toBe(false);
    expect((await collectGraph(target)).contextCount).toBe(0);
    expect(errors).toEqual([]);
    expect(consoleEntries.filter((entry) => entry.type === "error")).toEqual([]);
    expect(modelRequests).toEqual([]);
    await writeFile(
      info.outputPath("evidence.json"),
      JSON.stringify(
        {
          originalWavHash: sha256(source),
          assetId,
          separateBrowserContext: true,
          initialRejection: rejected,
          nativeHardwareContextCount: 0,
          restoredReady: true,
          pageErrors: errors,
          consoleEntries,
          modelRequests,
          note: "Actual product import and native OfflineAudioContext/IndexedDB; raw recordings are not synthesized from metadata.",
        },
        null,
        2,
      ) + "\n",
    );
  } finally {
    try {
      await writeFile(
        info.outputPath("console.json"),
        JSON.stringify({ consoleEntries, pageErrors: errors, modelRequests }, null, 2) + "\n",
      );
      if (targetTraceStarted)
        await other.tracing.stop({ path: info.outputPath("relink-target-source.trace.zip") });
    } finally {
      await other.close();
    }
  }
});
