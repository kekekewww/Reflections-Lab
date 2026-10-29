import { expect, test } from "@playwright/test";
import type { AudioEngine } from "../../src/audio/engine.js";
import type { AcousticFrame } from "../../src/acoustics/types.js";

const localeLabel = "介面語言 / Interface language";
interface NativePreviewProbe {
  staticPreview: { engine: AudioEngine | null };
  audio: AudioEngine | null;
  world: object;
  runEpoch: string;
}

test.beforeEach(async ({ page }) => {
  await page.route("**/api/agent/propose**", (route) => route.abort("blockedbyclient"));
  await page.route("https://api.meta.ai/**", (route) => route.abort("blockedbyclient"));
  await page.goto("/");
  await expect(page.locator("canvas")).toBeVisible();
  await expect.poll(() => page.evaluate(() => !!window.__reflectionLab)).toBe(true);
  await page.getByRole("combobox", { name: localeLabel, exact: true }).selectOption("en");
});

test("explicit static scene preview uses real solver/native routes and preserves muted run across locales", async ({
  page,
}, info) => {
  await page.getByRole("button", { name: "Enable listening", exact: true }).click();
  await page.getByRole("button", { name: "Mute monitor", exact: true }).click();
  await page.evaluate(async () =>
    window.__reflectionLab!.dispatch({ type: "selectObject", objectId: "speaker" }),
  );
  const before = await page.evaluate(() => {
    const app = window.__reflectionLab!;
    const native = app as unknown as NativePreviewProbe;
    (window as unknown as { __staticPreviewOriginal: unknown }).__staticPreviewOriginal = {
      world: native.world,
      audio: native.audio,
      epoch: native.runEpoch,
    };
    const view = app.getSnapshot();
    return {
      documents: JSON.stringify([app.getSceneDocument(), app.getBehaviorDocument()]),
      tick: view.tick,
      runId: view.runId,
      events: view.events,
      recording: view.recording,
      comparison: view.comparison,
      gain: view.monitor.gainLinear,
    };
  });
  await page.getByRole("button", { name: "Preview scene acoustics", exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => window.__reflectionLab!.getSnapshot().preview?.status))
    .toBe("playing");
  await expect(
    page.getByText("Monitor is muted. Use the persistent monitor controls to adjust it.", {
      exact: true,
    }),
  ).toBeVisible();
  const observed = await page.evaluate(() => {
    const app = window.__reflectionLab!;
    const native = app as unknown as NativePreviewProbe;
    const engine = native.staticPreview.engine as unknown as {
      context: BaseAudioContext;
      frames: Map<string, AcousticFrame>;
      voices: Map<
        string,
        {
          source: AudioScheduledSourceNode;
          input: { emissionTimeSeconds: number };
          routes: Map<string, { panner: PannerNode; delay: DelayNode }>;
          startedAudioTime: number;
        }
      >;
    };
    const original = (
      window as unknown as {
        __staticPreviewOriginal: { world: object; audio: object; epoch: string };
      }
    ).__staticPreviewOriginal;
    const voice = [...engine.voices.values()][0]!;
    const view = app.getSnapshot();
    const frame = engine.frames.get(view.preview!.metadata!.source.id)!;
    (window as unknown as { __staticPreviewNative: unknown }).__staticPreviewNative = {
      context: engine.context,
      voice,
      startedAudioTime: voice.startedAudioTime,
    };
    return {
      preview: view.preview,
      primaryMuted: view.monitor.muted,
      sameWorld: native.world === original.world,
      samePrimaryEngine: native.audio === original.audio,
      sameRunEpoch: native.runEpoch === original.epoch,
      contextState: engine.context.state,
      independentContext:
        engine.context !== (native.audio as unknown as { context: BaseAudioContext }).context,
      nativeSource: voice.source instanceof OscillatorNode,
      emissionTimeSeconds: voice.input.emissionTimeSeconds,
      nativePaths: [...voice.routes].map(([id, route]) => ({
        id,
        hrtf: route.panner instanceof PannerNode && route.panner.panningModel === "HRTF",
        nativeDelay: route.delay instanceof DelayNode,
        rolloff: route.panner.rolloffFactor,
        delay: route.delay.delayTime.value,
      })),
      routeIds: [...voice.routes.keys()].sort(),
      frame,
      documents: JSON.stringify([app.getSceneDocument(), app.getBehaviorDocument()]),
      tick: view.tick,
      runId: view.runId,
      events: view.events,
      recording: view.recording,
      comparison: view.comparison,
    };
  });
  expect(observed.preview?.metadata?.solver.backendId).toBe("custom-web-geometric");
  expect(observed.preview?.metadata?.excludedFromExperiment).toBe(true);
  expect(observed.preview?.metadata?.source.origin).toBe("objectOffset");
  expect(observed.preview?.monitorGain).toBe(before.gain);
  expect(observed.primaryMuted).toBe(true);
  expect(observed.contextState).toBe("running");
  expect(
    observed.independentContext &&
      observed.sameWorld &&
      observed.samePrimaryEngine &&
      observed.sameRunEpoch &&
      observed.nativeSource,
  ).toBe(true);
  expect(observed.emissionTimeSeconds).toBe(0);
  expect(observed.nativePaths.length).toBe(observed.preview?.metadata?.solver.pathCount);
  expect(observed.nativePaths.length).toBeGreaterThan(0);
  expect(observed.frame.requestId).toBe(observed.preview?.metadata?.solver.requestId);
  expect(observed.frame.sourceId).toBe(observed.preview?.metadata?.source.id);
  expect(observed.frame.listenerId).toBe(observed.preview?.metadata?.listener.id);
  expect(observed.frame.sceneRevision).toBe(observed.preview?.metadata?.solver.sceneRevision);
  expect(observed.frame.geometryRevision).toBe(observed.preview?.metadata?.solver.geometryRevision);
  expect(observed.frame.poseTick).toBe(observed.preview?.metadata?.solver.poseTick);
  expect(observed.routeIds).toEqual(observed.frame.paths.map((path) => path.id).sort());
  for (const actual of observed.nativePaths) {
    const expected = observed.frame.paths.find((path) => path.id === actual.id)!;
    expect(Math.abs(actual.delay - expected.absoluteDelayS)).toBeLessThan(1e-7);
  }
  expect(
    observed.nativePaths.every(
      (path) => path.hrtf && path.nativeDelay && path.rolloff === 0 && path.delay > 0,
    ),
  ).toBe(true);
  expect({
    documents: observed.documents,
    tick: observed.tick,
    runId: observed.runId,
    events: observed.events,
    recording: observed.recording,
    comparison: observed.comparison,
  }).toEqual({
    documents: before.documents,
    tick: before.tick,
    runId: before.runId,
    events: before.events,
    recording: before.recording,
    comparison: before.comparison,
  });
  await expect
    .poll(() => page.evaluate(() => window.__reflectionLab!.getSnapshot().preview?.status))
    .toBe("playing");
  await page.getByRole("button", { name: "Stop preview", exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => window.__reflectionLab!.getSnapshot().preview?.status))
    .toBe("stopped");
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as unknown as { __staticPreviewNative: { context: BaseAudioContext } })
            .__staticPreviewNative.context.state,
      ),
    )
    .toBe("closed");
  const stopped = await page.evaluate(() => {
    const retained = (
      window as unknown as {
        __staticPreviewNative: {
          context: BaseAudioContext;
          voice: { routes: Map<string, unknown>; source: AudioScheduledSourceNode };
          startedAudioTime: number;
        };
      }
    ).__staticPreviewNative;
    return {
      state: retained.context.state,
      elapsedSeconds: retained.context.currentTime - retained.startedAudioTime,
      routeCount: retained.voice.routes.size,
      onendedCleared: retained.voice.source.onended === null,
    };
  });
  expect(stopped.state).toBe("closed");
  expect(stopped.routeCount).toBe(0);
  expect(stopped.onendedCleared).toBe(true);
  expect(stopped.elapsedSeconds).toBeLessThan(observed.preview!.metadata!.durationSeconds);
  await page.getByRole("combobox", { name: localeLabel, exact: true }).selectOption("zh-TW");
  await expect(page.getByRole("button", { name: "停止預聽", exact: true })).toBeVisible();
  await info.attach("static-preview-native-provenance.json", {
    body: JSON.stringify(
      {
        before,
        observed,
        stopped,
        limitation: "Real native routing/control metadata; no PCM capture or hearing claim",
      },
      null,
      2,
    ),
    contentType: "application/json",
  });
  await page.screenshot({ path: info.outputPath("static-preview-stopped-zh.png") });
});

test("real contact selection is required and runtime rejects running dry/scene previews", async ({
  page,
}, info) => {
  const setup = await page.evaluate(async () => {
    const app = window.__reflectionLab!;
    await app.dispatch({
      type: "previewRule",
      objectId: "ball",
      bindingId: "binding.interactive.ball",
      ruleId: "rule.impact",
    });
    const missingContact = app.getSnapshot().error;
    await app.dispatch({ type: "run" });
    await app.dispatch({ type: "audition", assetId: "not-needed-for-running-gate" });
    const rawRunning = app.getSnapshot().error;
    await app.dispatch({
      type: "previewRule",
      objectId: "ball",
      bindingId: "binding.interactive.ball",
      ruleId: "rule.impact",
    });
    const sceneRunning = app.getSnapshot().error;
    for (let tick = 0; tick < 120; tick++) app.advance(1 / 60);
    await app.dispatch({ type: "pause" });
    const event = app
      .getSnapshot()
      .events.find((value) => value.type === "OnImpact" && value.decision?.action === "start")!;
    await app.dispatch({ type: "selectEvent", eventId: event.id });
    await app.dispatch({ type: "selectObject", objectId: "ball" });
    return { missingContact, rawRunning, sceneRunning, event, tick: app.getSnapshot().tick };
  });
  expect(setup.missingContact).toContain("CONTACT_EVENT_REQUIRED");
  expect(setup.rawRunning).toContain("PREVIEW_REQUIRES_PAUSE");
  expect(setup.sceneRunning).toContain("PREVIEW_REQUIRES_PAUSE");
  const impact = page.getByRole("article", { name: "Sound behavior rule.impact", exact: true });
  await impact.getByRole("button", { name: "Preview scene acoustics", exact: true }).click();
  const preview = await page.evaluate(() => window.__reflectionLab!.getSnapshot().preview);
  expect(preview?.status).toBe("playing");
  expect(preview?.metadata?.source.positionM).toEqual(setup.event.positionM);
  expect(preview?.metadata?.source.origin).toBe("capturedContact");
  expect(preview?.metadata?.contact?.audioEventId).toBe(setup.event.id);
  await page.getByText("Preview snapshot and provenance", { exact: true }).click();
  await expect(page.locator(".inspector")).toContainText(setup.event.id);
  await page.getByRole("button", { name: "Stop preview", exact: true }).click();
  expect(await page.evaluate(() => window.__reflectionLab!.getSnapshot().tick)).toBe(setup.tick);
  await info.attach("real-contact-preview.json", {
    body: JSON.stringify({ setup, preview }, null, 2),
    contentType: "application/json",
  });
});
