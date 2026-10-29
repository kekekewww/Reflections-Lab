import fs from "node:fs";
import { chromium } from "@playwright/test";

const result = {
  checkedAt: new Date().toISOString(),
  evidenceClass: "BROWSER_TAB_FIXTURE_CAPABILITY",
  stages: [],
};
const browser = await chromium.launch({ channel: "chrome", headless: false });
try {
  result.browserVersion = browser.version();
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("about:blank");
  const session = await context.newCDPSession(page);
  const original = await session.send("Target.getTargetInfo");
  async function capture(label) {
    const pages = [];
    for (const item of context.pages()) {
      const current = await context.newCDPSession(item);
      pages.push({
        target: await current.send("Target.getTargetInfo"),
        window: await current.send("Browser.getWindowForTarget"),
        state: await item.evaluate(() => ({
          url: location.href,
          hidden: document.hidden,
          visibility: document.visibilityState,
          focused: document.hasFocus(),
        })),
      });
      await current.detach();
    }
    result.stages.push({ label, pages });
  }
  await capture("original");
  const second = await context.newPage();
  await second.goto("about:blank#second");
  await second.bringToFront();
  await capture("context-newPage-brought-front");
  const pending = context.waitForEvent("page");
  const created = await session.send("Target.createTarget", {
    url: "about:blank#explicit-tab",
    browserContextId: original.targetInfo.browserContextId,
    newWindow: false,
    background: false,
    forTab: true,
  });
  result.created = created;
  const third = await pending;
  await third.waitForLoadState();
  await third.bringToFront();
  await capture("explicit-newWindow-false-forTab-true");
  await session.send("Target.activateTarget", { targetId: created.targetId });
  await capture("explicit-activateTarget");
  for (const item of context.pages()) {
    const current = await context.newCDPSession(item);
    await current.send("Emulation.setFocusEmulationEnabled", { enabled: false });
    await current.detach();
  }
  await third.bringToFront();
  await capture("native-focus-emulation-disabled-third-active");
  await page.bringToFront();
  await capture("native-focus-emulation-disabled-original-active");
  await session.detach();
  result.status = "COMPLETE";
} catch (error) {
  result.status = "FAIL";
  result.error = error instanceof Error ? error.stack : String(error);
  process.exitCode = 1;
} finally {
  await browser.close();
  result.closed = true;
  fs.mkdirSync("test-results/native-accessibility", { recursive: true });
  fs.writeFileSync(
    "test-results/native-accessibility/tabs-capability-native-focus.json",
    JSON.stringify(result, null, 2) + "\n",
  );
  console.log(JSON.stringify(result));
}
