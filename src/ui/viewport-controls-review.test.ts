import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LabRuntime } from "../app/runtime.js";
import { LocaleProvider } from "./locale.js";
import { Viewport } from "./Viewport.js";

test("review 8: unlocked FPS has a focusable mouse-control button in its bottom hint", async () => {
  const app = await LabRuntime.create({ useWorker: false });
  try {
    await app.dispatch({ type: "enterFPS" });
    const html = renderToStaticMarkup(
      createElement(
        LocaleProvider,
        null,
        createElement(Viewport, { controller: app, model: app.getSnapshot() }),
      ),
    );
    assert.match(html, /viewport-fps-hint[\s\S]*?<button[^>]*>啟用滑鼠控制<\/button>/);
  } finally {
    app.dispose();
  }
});
