import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PerformancePanel } from "./PerformancePanel.js";
import { LocaleProvider } from "./locale.js";
import { AudioDiagnostics } from "../audio/diagnostics.js";
import {
  formatDiagnosticValue,
  presentAudioDiagnostics,
} from "./audio-diagnostics-presentation.js";

test("absent audio observations stay missing while measured zero stays zero", () => {
  const view = presentAudioDiagnostics(null);
  assert.equal(view.observed, false);
  assert.equal(view.enabled, null);
  assert.equal(view.acceptedFrames, null);
  assert.equal(view.lateOnsets, null);
  assert.equal(view.nativeUnderrunEvents, null);
  assert.equal(view.deliveryBatches, null);
  assert.equal(formatDiagnosticValue(null, "en"), "—");
  assert.equal(formatDiagnosticValue(NaN, "en"), "—");
  assert.equal(formatDiagnosticValue(0, "en"), "0");
});

test("unavailable native windows suppress numeric counters instead of implying clean output", () => {
  const diagnostics = new AudioDiagnostics();
  for (const status of ["NOT_OBSERVED", "UNSUPPORTED", "WARMUP", "COUNTER_RESET"] as const) {
    const snapshot = diagnostics.snapshot();
    snapshot.nativeOutput = {
      ...snapshot.nativeOutput,
      status,
      deltaUnderrunEvents: 0,
      windowMs: 1000,
      deltaUnderrunSeconds: 0,
      outputLatencySeconds: 0.02,
    };
    const view = presentAudioDiagnostics(snapshot);
    assert.equal(view.nativeStatus, status);
    assert.equal(view.nativeUnderrunEvents, null);
    assert.equal(view.nativeWindowMs, null);
    assert.equal(view.nativeUnderrunMs, null);
    assert.equal(view.nativeOutputLatencyMs, null);
  }
});

test("available native values retain window deltas and display seconds as milliseconds", () => {
  const snapshot = new AudioDiagnostics().snapshot();
  snapshot.nativeOutput = {
    ...snapshot.nativeOutput,
    status: "AVAILABLE",
    windowMs: 600,
    deltaUnderrunEvents: 3,
    deltaUnderrunSeconds: 0.012,
    outputLatencySeconds: 0.024,
  };
  const view = presentAudioDiagnostics(snapshot);
  assert.equal(view.nativeWindowMs, 600);
  assert.equal(view.nativeUnderrunEvents, 3);
  assert.equal(view.nativeUnderrunMs, 12);
  assert.equal(view.nativeOutputLatencyMs, 24);
});

test("consumer decisions, onset lateness and control timings use separate populations", () => {
  const diagnostics = new AudioDiagnostics();
  diagnostics.recordFrame("accepted", 0.5);
  diagnostics.recordFrame("stale", 1.5);
  diagnostics.recordFrame("source-budget", 0.25);
  diagnostics.recordOnset(1, 1.002);
  diagnostics.timing("routeControl", 0.4);
  const beforeDelivery = presentAudioDiagnostics(diagnostics.snapshot());
  assert.equal(beforeDelivery.acceptedFrames, 1);
  assert.equal(beforeDelivery.rejectedFrames, 2);
  assert.equal(beforeDelivery.lateOnsets, 1);
  assert.equal(beforeDelivery.frameConsumerP95Ms, 1.5);
  assert.equal(beforeDelivery.routeControlP95Ms, 0.4);
  assert.equal(beforeDelivery.listenerControlP95Ms, null);
  assert.equal(beforeDelivery.deliveryBatches, null);
  diagnostics.recordDelivery({
    decision: "age-rejected",
    frameCount: 3,
    ageTicks: 4,
    elapsedMs: 0.7,
  });
  const afterDelivery = presentAudioDiagnostics(diagnostics.snapshot());
  assert.equal(afterDelivery.deliveryBatches, 1);
  assert.equal(afterDelivery.deliveryP95Ms, 0.7);
  assert.equal(afterDelivery.rejectedFrames, 2);
});

test("disabled diagnostics are labelled as retained observations rather than current measurements", () => {
  const diagnostics = new AudioDiagnostics();
  diagnostics.recordFrame("accepted", 0.5);
  diagnostics.setEnabled(false);
  diagnostics.recordFrame("accepted", 4);
  const view = presentAudioDiagnostics(diagnostics.snapshot());
  assert.equal(view.enabled, false);
  assert.equal(view.acceptedFrames, 1);
  assert.equal(view.frameConsumerP95Ms, 0.5);
});

test("the visible observation toggle identifies retained data and stays disabled before audio exists", () => {
  const diagnostics = new AudioDiagnostics();
  diagnostics.recordFrame("accepted", 0.5);
  diagnostics.setEnabled(false);
  const render = (snapshot: ReturnType<AudioDiagnostics["snapshot"]> | null) =>
    renderToStaticMarkup(
      createElement(
        LocaleProvider,
        null,
        createElement(PerformancePanel, { diagnostics: snapshot, onEnabledChange() {} }),
      ),
    );
  const retained = render(diagnostics.snapshot());
  assert.match(retained, /啟用成本觀測/);
  assert.match(retained, /觀測已停用；顯示保留資料/);
  assert.match(retained, /type="checkbox"/);
  assert.doesNotMatch(retained, /type="checkbox"[^>]*checked/);
  const absent = render(null);
  assert.match(absent, /type="checkbox" disabled=""/);
  assert.match(absent, /尚無原生輸出觀測/);
  assert.match(absent, /—/);
});
