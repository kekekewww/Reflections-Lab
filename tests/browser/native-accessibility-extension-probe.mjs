import fs from "node:fs";
import { launchNativeAccessibility } from "./native-accessibility-runner.mjs";
const run = await launchNativeAccessibility(
  "http://127.0.0.1:5174",
  "test-results/ui-preview-build.json",
  "chrome-tabs-automatic",
);
const evidence = { checkedAt: new Date().toISOString(), stages: [], console: [] };
run.page.on("console", (message) => {
  if (message.type() === "error")
    evidence.console.push({ text: message.text(), location: message.location() });
});
try {
  const worker =
    run.context
      .serviceWorkers()
      .find((item) => item.url().endsWith("/native-accessibility-zoom-worker.js")) ??
    (await run.context.waitForEvent("serviceworker"));
  async function capture(label) {
    const pages = [];
    for (const page of run.context.pages()) {
      const session = await run.context.newCDPSession(page);
      pages.push({
        window: await session.send("Browser.getWindowForTarget"),
        state: await page.evaluate(() => ({
          url: location.href,
          hidden: document.hidden,
          focused: document.hasFocus(),
        })),
      });
      await session.detach();
    }
    const tabs = await worker.evaluate(() => chrome.tabs.query({}));
    evidence.stages.push({ label, pages, tabs });
  }
  const tabs = await worker.evaluate(() => chrome.tabs.query({}));
  const task = tabs.find((item) => item.url.startsWith("http://127.0.0.1:5174"));
  await run.session.send("Emulation.setFocusEmulationEnabled", { enabled: false });
  await capture("before-real-tab-create");
  const pending = run.context.waitForEvent("page");
  const otherTab = await worker.evaluate(
    (task) =>
      chrome.tabs.create({
        windowId: task.windowId,
        url: "about:blank#native-other",
        active: true,
      }),
    task,
  );
  const other = await pending;
  await other.waitForLoadState();
  const otherSession = await run.context.newCDPSession(other);
  await otherSession.send("Emulation.setFocusEmulationEnabled", { enabled: false });
  await worker.evaluate((tab) => chrome.tabs.update(tab.id, { active: true }), otherTab);
  await capture("real-chrome-tabs-create-update");
  await worker.evaluate(async (tab) => {
    await chrome.tabs.update(tab.id, { active: true });
    await chrome.windows.update(tab.windowId, { focused: true });
  }, task);
  await capture("real-chrome-tabs-update-window-focus");
  await otherSession.detach();
  await other.close();
  await run.page.getByRole("button", { name: "進入第一人稱", exact: true }).click();
  evidence.lock = await run.page.evaluate(() => ({
    element: document.pointerLockElement?.tagName,
    focused: document.hasFocus(),
    hidden: document.hidden,
    text: document.body.innerText,
  }));
  await run.page.getByRole("button", { name: "離開第一人稱", exact: true }).click();
  const session = run.session;
  const network = [];
  await session.send("Network.enable");
  session.on("Network.responseReceived", (event) => {
    if (event.response.status >= 400)
      network.push({ url: event.response.url, status: event.response.status });
  });
  await run.page.reload();
  await run.page.getByRole("button", { name: "開始運算", exact: true }).waitFor();
  evidence.network = network;
} catch (error) {
  evidence.error = error instanceof Error ? error.stack : String(error);
  process.exitCode = 1;
} finally {
  await run.context.close();
  evidence.closed = true;
  fs.writeFileSync(
    "test-results/native-accessibility/extension-capability.json",
    JSON.stringify(evidence, null, 2) + "\n",
  );
  console.log(JSON.stringify(evidence));
}
