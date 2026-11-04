import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { RenderHost } from "../app/render-host.js";
import type { LabController } from "./contracts.js";
import { RenderPanel } from "./RenderPanel.js";
import { RecordingRecoveryPanel } from "./RecordingRecoveryPanel.js";
import { LocaleProvider } from "./locale.js";

const render = (node: ReturnType<typeof createElement>) =>
  renderToStaticMarkup(createElement(LocaleProvider, null, node));

test("capture duration exposes units and limits while preserving the default capture accessible name", () => {
  const host = new RenderHost({ getRecording: () => null, getAssetBank: () => [] });
  try {
    for (const [locale, capture, duration] of [
      ["zh-TW", "錄製3秒", "錄製長度 s"],
      ["en", "Capture 3 seconds", "Capture duration s"],
    ] as const) {
      const html = render(
        createElement(RenderPanel, { host, locale, onCaptureShortTake: async () => {} }),
      );
      assert.ok(html.includes(capture));
      assert.ok(html.includes(`aria-label="${duration}"`));
      assert.match(html, /min="1" max="60" step="1"/);
      assert.doesNotMatch(html, /up to 30 seconds|最多30秒/);
    }
  } finally {
    host.dispose();
  }
});

test("recovery UI exposes incomplete-prefix semantics only when all recovery capabilities exist", () => {
  const legacy = {} as LabController;
  assert.equal(
    render(createElement(RecordingRecoveryPanel, { controller: legacy, locale: "en" })),
    "",
  );
  const capable: LabController = {
    ...legacy,
    listRecordingRecovery: async () => [],
    recoverRecording: async () => {},
    discardRecordingRecovery: async () => {},
  };
  for (const [locale, expected] of [
    ["zh-TW", /仍標為中斷.*不能當作完整錄製或完整 WAV/],
    ["en", /keeps it marked interrupted.*not a complete take or complete WAV/],
  ] as const) {
    const html = render(createElement(RecordingRecoveryPanel, { controller: capable, locale }));
    assert.match(html, /<details/);
    assert.match(html, expected);
    assert.doesNotMatch(html, /download=/);
  }
});

test("unavailable archive ownership is explained without exposing browser API internals", () => {
  const host = new RenderHost({ getRecording: () => null, getAssetBank: () => [] });
  const snapshot = {
    ...host.getSnapshot(),
    error:
      "Web Locks API is unavailable; another render writer cannot safely be classified as inactive.",
  };
  host.getSnapshot = () => snapshot;
  try {
    for (const [locale, expected] of [
      ["zh-TW", /無法安全確認輸出工作擁有者/],
      ["en", /cannot safely verify output ownership/],
    ] as const) {
      const html = render(createElement(RenderPanel, { host, locale }));
      assert.match(html, expected);
      assert.doesNotMatch(html, /Web Locks|LockManager|classified as inactive/);
    }
  } finally {
    host.dispose();
  }
});
