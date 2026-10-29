import { expect, test, type Page } from "@playwright/test";
import type { LabAction } from "../../src/ui/contracts.js";

interface RaceEvidence {
  phase: string;
  time: number;
  trusted?: boolean;
  lock: string | null;
  code?: string;
  action?: LabAction;
}
interface RaceHarness {
  evidence: RaceEvidence[];
  queued(): number;
  flush(): void;
}
declare global {
  interface Window {
    __pointerLockRace?: RaceHarness;
  }
}

async function openWithDelayedListener(page: Page) {
  await page.addInitScript(() => {
    const evidence: RaceEvidence[] = [];
    const queued: { listener: EventListenerOrEventListenerObject; event: Event }[] = [];
    const replacements = new Map<EventListenerOrEventListenerObject, EventListener>();
    let delayed = true;
    const add = document.addEventListener.bind(document);
    const remove = document.removeEventListener.bind(document);
    const record = (phase: string, event: Event) => {
      evidence.push({
        phase,
        time: performance.now(),
        trusted: event.isTrusted,
        lock: document.pointerLockElement?.tagName ?? null,
        ...(event instanceof KeyboardEvent ? { code: event.code } : {}),
      });
    };
    add("pointerlockchange", (event) => record("native-event", event), true);
    add("keydown", (event) => record("native-keydown", event), true);
    document.addEventListener = (type, listener, options) => {
      if (type !== "pointerlockchange" || !listener) return add(type, listener, options);
      const wrapped: EventListener = (event) => {
        if (delayed) {
          if (queued.length >= 16) throw new Error("POINTER_LOCK_RACE_QUEUE_OVERFLOW");
          queued.push({ listener, event });
          record("application-listener-delayed", event);
        } else if (typeof listener === "function") listener.call(document, event);
        else listener.handleEvent(event);
      };
      replacements.set(listener, wrapped);
      return add(type, wrapped, options);
    };
    document.removeEventListener = (type, listener, options) =>
      remove(type, listener ? (replacements.get(listener) ?? listener) : listener, options);
    window.__pointerLockRace = {
      evidence,
      queued: () => queued.length,
      flush: () => {
        delayed = false;
        for (const { listener, event } of queued.splice(0)) {
          record("application-listener-delivered", event);
          if (typeof listener === "function") listener.call(document, event);
          else listener.handleEvent(event);
        }
      },
    };
  });
  await page.goto("/");
  await expect(page.getByRole("button", { name: "開始運算", exact: true })).toBeVisible();
  await expect(page.locator("canvas")).toBeVisible();
  await page.evaluate(() => {
    const runtime = window.__reflectionLab;
    if (!runtime || !window.__pointerLockRace) throw new Error("E2E runtime unavailable");
    const dispatch = runtime.dispatch;
    runtime.dispatch = (action) => {
      window.__pointerLockRace!.evidence.push({
        phase: "application-dispatch",
        time: performance.now(),
        lock: document.pointerLockElement?.tagName ?? null,
        action: structuredClone(action),
      });
      return dispatch.call(runtime, action);
    };
  });
}

const snapshot = (page: Page) => page.evaluate(() => window.__reflectionLab!.getSnapshot());
const confirmationCount = (page: Page) =>
  page.evaluate(
    () =>
      window.__pointerLockRace!.evidence.filter(
        (entry) => entry.action?.type === "pointerLockChanged" && entry.action.locked,
      ).length,
  );

test.afterEach(async ({ page }, info) => {
  if (page.isClosed()) return;
  await info.attach("native-listener-delivery-fault.json", {
    body: JSON.stringify(
      await page.evaluate(() => ({
        classification: "CONTROLLED_APPLICATION_LISTENER_DELIVERY_LAG_WITH_REAL_NATIVE_LOCK",
        syntheticNativeEvents: false,
        pointerLockAPIReplaced: false,
        fault:
          "The application's pointerlockchange callback is held until explicit flush; the original trusted native event and actual document ownership remain intact.",
        queued: window.__pointerLockRace?.queued(),
        evidence: window.__pointerLockRace?.evidence,
        final: window.__reflectionLab?.getSnapshot(),
      })),
      null,
      2,
    ),
    contentType: "application/json",
  });
});

test("first Enter reconciles actual native ownership before delayed notification and late delivery preserves held movement", async ({
  page,
}) => {
  await openWithDelayedListener(page);
  // A real scene transaction places a grabbable, stationary object in front of the player.
  await page.evaluate(() =>
    window.__reflectionLab!.dispatch({
      type: "patchObject",
      objectId: "ball",
      patch: { positionM: [0, 1.6, 2], mode: "dynamicNoGravity" },
    }),
  );
  await page.getByRole("button", { name: "進入第一人稱", exact: true }).click();
  await expect.poll(() => page.evaluate(() => document.pointerLockElement?.tagName)).toBe("CANVAS");
  await expect.poll(() => page.evaluate(() => window.__pointerLockRace!.queued())).toBe(1);
  expect(await confirmationCount(page)).toBe(0);
  expect((await snapshot(page)).simulationState).not.toBe("running");
  await page.keyboard.press("Enter");
  await expect.poll(async () => (await snapshot(page)).simulationState).toBe("running");
  expect(await confirmationCount(page)).toBe(1);
  const start = await snapshot(page);
  await page.keyboard.down("w");
  await expect
    .poll(async () => (await snapshot(page)).listener.positionM[2])
    .toBeLessThan(start.listener.positionM[2] - 0.01);
  const beforeDelivery = await snapshot(page);
  await page.evaluate(() => window.__pointerLockRace!.flush());
  expect(await confirmationCount(page)).toBe(1);
  await expect
    .poll(async () => (await snapshot(page)).listener.positionM[2])
    .toBeLessThan(beforeDelivery.listener.positionM[2] - 0.01);
  await page.keyboard.up("w");
  await page.keyboard.press("e");
  await expect
    .poll(async () => (await snapshot(page)).objects.find((object) => object.id === "ball")?.held)
    .toBe(true);
  expect((await snapshot(page)).events.filter((event) => event.type === "OnThrow")).toHaveLength(0);
  await page.keyboard.press("Enter");
  await expect.poll(async () => (await snapshot(page)).simulationState).toBe("paused");
  await page.mouse.down();
  await page.keyboard.press("Enter");
  await expect.poll(async () => (await snapshot(page)).simulationState).toBe("running");
  expect((await snapshot(page)).objects.find((object) => object.id === "ball")?.held).toBe(true);
  expect((await snapshot(page)).events.filter((event) => event.type === "OnThrow")).toHaveLength(0);
  await page.mouse.up();
  await page.mouse.click(400, 400);
  await expect
    .poll(
      async () =>
        (await snapshot(page)).events.filter((event) => event.type === "OnThrow" && !event.ruleId)
          .length,
    )
    .toBe(1);
  await page.keyboard.press("Tab");
  await expect.poll(() => page.evaluate(() => document.pointerLockElement === null)).toBe(true);
  await expect.poll(async () => (await snapshot(page)).simulationState).toBe("paused");
  const native = await page.evaluate(() =>
    window.__pointerLockRace!.evidence.filter((entry) => entry.phase === "native-event"),
  );
  expect(native.length).toBeGreaterThanOrEqual(1);
  expect(native.every((entry) => entry.trusted)).toBe(true);
});

test("Enter without native ownership and modified Enter during delayed notification cannot resume; Tab still releases native ownership", async ({
  page,
}) => {
  await openWithDelayedListener(page);
  await page.locator("canvas").focus();
  await page.keyboard.press("Enter");
  expect((await snapshot(page)).simulationState).not.toBe("running");
  expect(await confirmationCount(page)).toBe(0);
  await page.getByRole("button", { name: "進入第一人稱", exact: true }).click();
  await expect.poll(() => page.evaluate(() => document.pointerLockElement?.tagName)).toBe("CANVAS");
  await expect.poll(() => page.evaluate(() => window.__pointerLockRace!.queued())).toBe(1);
  await page.keyboard.press("Control+Enter");
  expect((await snapshot(page)).simulationState).not.toBe("running");
  expect(await confirmationCount(page)).toBe(0);
  await page.keyboard.press("Tab");
  await expect.poll(() => page.evaluate(() => document.pointerLockElement === null)).toBe(true);
  await page.evaluate(() => window.__pointerLockRace!.flush());
  expect((await snapshot(page)).simulationState).not.toBe("running");
  expect(await confirmationCount(page)).toBe(0);
});
