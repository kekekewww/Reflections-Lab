import { test as base } from "@playwright/test";
import { guardBrowser } from "./s4-browser-guard.mjs";
export * from "@playwright/test";
export const test = base.extend<{ s4LegacyProvenance: void }>({
  s4LegacyProvenance: [
    async ({ browser, context }, use) => {
      const guard = await guardBrowser(browser);
      await guard.registerContext(context);
      try {
        await use();
      } finally {
        await guard.flush();
      }
    },
    { auto: true },
  ],
});
