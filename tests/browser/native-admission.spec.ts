import { expect, test } from "@playwright/test";
import type { ProjectDocument } from "../../src/persistence/types.js";
import type { AudioTelemetry } from "../../src/audio/types.js";
import type { AcousticFrame } from "../../src/acoustics/types.js";
import type { EventView } from "../../src/ui/contracts.js";

const localeLabel = "介面語言 / Interface language";
interface NativeProbe {
  audio: {
    context: AudioContext;
    budget: { maxSources: number };
    getTelemetry(): AudioTelemetry;
    voices: Map<string, { source: AudioScheduledSourceNode }>;
    frames: Map<string, AcousticFrame>;
  } | null;
}

test.beforeEach(async ({ page }) => {
  await page.route("**/api/agent/propose**", (route) => route.abort("blockedbyclient"));
  await page.route("https://api.meta.ai/**", (route) => route.abort("blockedbyclient"));
  await page.goto("/");
  await expect(page.locator("canvas")).toBeVisible();
  await expect.poll(() => page.evaluate(() => !!window.__reflectionLab)).toBe(true);
  await page.getByRole("combobox", { name: localeLabel, exact: true }).selectOption("en");
});

test("real native source rejection stays separate from logical intent and device-output evidence", async ({
  page,
}, info) => {
  await page.evaluate(async () => {
    const app = window.__reflectionLab!;
    const project = JSON.parse(app.exportProject()) as ProjectDocument;
    const object = project.scene.objects.find((value) => value.id === "speaker")!;
    const source = project.scene.sources[0]!;
    const binding = project.soundBehaviors.bindings.find((value) => value.objectId === "speaker")!;
    for (let index = 1; index <= 8; index++) {
      const objectId = `speaker.${String(index).padStart(2, "0")}`;
      project.scene.objects.push({ ...object, id: objectId, positionM: [index, 1, -2] });
      project.scene.sources.push({ ...source, id: `source.${objectId}`, objectId });
      project.soundBehaviors.bindings.push({
        ...binding,
        bindingId: `binding.${objectId}`,
        objectId,
      });
    }
    await app.importProject(JSON.stringify(project));
  });
  await page.getByRole("button", { name: "Enable listening", exact: true }).click();
  await page.getByRole("button", { name: "Mute monitor", exact: true }).click();
  const { setup, observed } = await page.evaluate(async () => {
    const app = window.__reflectionLab!;
    const engine = (app as unknown as NativeProbe).audio!;
    const defaultBudget = engine.getTelemetry().budget;
    // Deliberately constrained fixture before any voice starts. No production API or budget changes.
    engine.budget.maxSources = 8;
    const documents = JSON.stringify([app.getSceneDocument(), app.getBehaviorDocument()]);
    // Capture synchronously from the real publish so a newer solver frame cannot replace the
    // frame associated with this rejection before the test reads its native control metadata.
    const capture = new Promise<{
      rejected: EventView;
      original: EventView;
      logicalStarts: number;
      logicalRejects: number;
      actualNative: {
        contextIsNative: boolean;
        activeSources: number;
        droppedVoices: number;
        nativeOscillators: number;
        frame: AcousticFrame;
      };
    }>((resolve) => {
      const unsubscribe = app.subscribe(() => {
        const view = app.getSnapshot();
        const rejected = view.events.find(
          (event) => event.nativeRejection?.reason === "SOURCE_BUDGET",
        );
        if (!rejected) return;
        unsubscribe();
        const native = rejected.nativeRejection!;
        resolve({
          rejected: structuredClone(rejected),
          original: structuredClone(view.events.find((event) => event.id === native.audioEventId)!),
          logicalStarts: view.events.filter((event) => event.decision?.action === "start").length,
          logicalRejects: view.events.filter((event) => event.decision?.action === "reject").length,
          actualNative: {
            contextIsNative: engine.context instanceof AudioContext,
            activeSources: engine.getTelemetry().activeSources,
            droppedVoices: engine.getTelemetry().droppedVoices,
            nativeOscillators: [...engine.voices.values()].filter(
              (voice) => voice.source instanceof OscillatorNode,
            ).length,
            frame: structuredClone(engine.frames.get(native.sourceId)!),
          },
        });
      });
    });
    await app.dispatch({ type: "run" });
    app.advance(1 / 60);
    const captured = await capture;
    await app.dispatch({ type: "pause" });
    await app.dispatch({ type: "save" });
    await app.dispatch({
      type: "selectObject",
      objectId: captured.rejected.nativeRejection!.objectId,
    });
    return {
      setup: { defaultBudget, configuredBudget: engine.getTelemetry().budget, documents },
      observed: {
        ...captured,
        paused: app.getSnapshot().simulationState,
        pauseReason: app.getSnapshot().pauseReason,
        notice: app.getSnapshot().notice,
        muted: app.getSnapshot().monitor.muted,
        documents: JSON.stringify([app.getSceneDocument(), app.getBehaviorDocument()]),
      },
    };
  });
  expect(setup.configuredBudget.maxSources).toBe(8);
  expect(setup.configuredBudget.maxVoices).toBe(setup.defaultBudget.maxVoices);
  expect(observed.logicalStarts).toBe(9);
  expect(observed.logicalRejects).toBe(0);
  expect(observed.actualNative.contextIsNative).toBe(true);
  expect(observed.actualNative.nativeOscillators).toBe(8);
  expect(observed.actualNative.activeSources).toBe(8);
  expect(observed.actualNative.droppedVoices).toBe(1);
  expect(observed.original.decision?.action).toBe("start");
  expect(observed.original.decision?.instanceId).toBe(
    observed.rejected.nativeRejection!.instanceId,
  );
  expect(observed.actualNative.frame.requestId).toBe(
    observed.rejected.nativeRejection!.acousticRequestId,
  );
  expect(observed.actualNative.frame.sourceId).toBe(observed.rejected.nativeRejection!.sourceId);
  expect(observed.rejected.decision).toBeUndefined();
  expect(observed.paused).toBe("paused");
  expect(observed.pauseReason).toBeTruthy();
  expect(observed.notice).not.toContain("admission");
  expect(observed.muted).toBe(true);
  expect(observed.documents).toBe(setup.documents);
  await page.getByRole("searchbox", { name: "Filter events", exact: true }).fill("SOURCE_BUDGET");
  const row = page.locator(".event-table tbody tr").filter({ hasText: "SOURCE_BUDGET" });
  await expect(row).toHaveCount(1);
  await expect(row).toContainText("Native audio rejected: source capacity reached");
  await row.getByRole("button").click();
  const detail = page.getByRole("complementary", { name: "Selected event details", exact: true });
  await expect(detail).toContainText(observed.rejected.nativeRejection!.audioEventId);
  await expect(detail).toContainText(observed.rejected.nativeRejection!.acousticRequestId);
  await expect(detail).toContainText("excluded from recordings");
  const rule = page.getByRole("article", { name: "Sound behavior rule.always", exact: true });
  await expect(rule).toContainText("SOURCE_BUDGET");
  await expect(rule).toContainText("Latest native rejection");
  await page.getByRole("combobox", { name: localeLabel, exact: true }).selectOption("zh-TW");
  await expect(page.locator(".dock-detail")).toContainText(
    "原生音訊拒絕：已達聲源容量 [SOURCE_BUDGET]",
  );
  await expect(page.locator(".dock-detail")).toContainText(observed.rejected.id);
  await expect(page.locator(".behavior-card")).toContainText("邏輯實例不代表實際裝置輸出");
  await info.attach("real-native-admission.json", {
    body: JSON.stringify(
      {
        setup,
        observed,
        limitation:
          "Explicit test-only source capacity 8; real native control graph, no PCM or device/hearing claim",
      },
      null,
      2,
    ),
    contentType: "application/json",
  });
  await page.screenshot({ path: info.outputPath("native-rejection-zh.png") });
});

test("logical start remains inspectable without constructing a native audio device", async ({
  page,
}, info) => {
  const observed = await page.evaluate(async () => {
    const app = window.__reflectionLab!;
    await app.dispatch({ type: "run" });
    app.advance(1 / 60);
    await app.dispatch({ type: "pause" });
    const view = app.getSnapshot();
    const start = view.events.find((event) => event.decision?.action === "start")!;
    await app.dispatch({ type: "selectObject", objectId: start.objectId! });
    return {
      start,
      hasNativeDevice: !!(app as unknown as NativeProbe).audio,
      nativeRejections: view.events.filter((event) => event.nativeRejection).length,
    };
  });
  expect(observed.hasNativeDevice).toBe(false);
  expect(observed.nativeRejections).toBe(0);
  const row = page.locator(".event-table tbody tr").filter({ hasText: "RULE_MATCH" });
  await row.getByRole("button").click();
  await expect(page.locator(".dock-detail")).toContainText("Logical sound instance created");
  await expect(page.locator(".dock-detail")).not.toContainText("Admitted and started");
  await page.getByRole("combobox", { name: localeLabel, exact: true }).selectOption("zh-TW");
  await expect(page.locator(".dock-detail")).toContainText("已建立邏輯聲音實例");
  await expect(page.locator(".dock-detail")).toContainText(observed.start.id);
  await info.attach("logical-intent-without-device.json", {
    body: JSON.stringify(observed, null, 2),
    contentType: "application/json",
  });
});
