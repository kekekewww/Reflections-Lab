import path from "node:path";
import { expect, test as base } from "@playwright/test";
import { launchExternalNativeBrowser } from "./native-accessibility-external-browser.mjs";

/** Native visibility requires no Playwright focus-emulation capture handle.
 * Use a new owned process/profile and its default context for each test.
 */
export const test = base.extend({
  context: async ({ baseURL }, use, info) => {
    const native = await launchExternalNativeBrowser({
      profile: path.resolve(`.cache/v1/native-input-${Date.now()}-${info.workerIndex}`),
      executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    });
    const provenance = {
      evidenceClass: "EXTERNAL_HEADED_BROWSER_NO_DEFAULT_FOCUS_EMULATION",
      baseURL,
      pid: native.pid,
      executable: native.executable,
      args: native.args,
      browserVersion: native.browser.version(),
      noDefaults: true,
      defaultContextOnly: true,
      reference:
        "https://playwright.dev/docs/api/class-browsertype#browser-type-connect-over-cdp-option-no-defaults",
      cleanup: null as unknown,
    };
    try {
      await use(native.context);
    } finally {
      provenance.cleanup = await native.close();
      await info.attach("native-browser-process.json", {
        body: JSON.stringify(provenance, null, 2),
        contentType: "application/json",
      });
      expect((provenance.cleanup as { ownedProcessExited: boolean }).ownedProcessExited).toBe(true);
    }
  },
  page: async ({ context }, use) => {
    const page = context.pages()[0] ?? (await context.newPage());
    await page.bringToFront();
    await use(page);
  },
});
