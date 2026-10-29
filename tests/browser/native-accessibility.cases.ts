import { expect, type Page } from "@playwright/test";
import { test } from "./native-accessibility-native-test.js";

type Snapshot = {
  simulationState: string;
  interactionMode: string;
  tick: number;
  listener: { positionM: [number, number, number] };
  objects: { id: string; held?: boolean }[];
  events: { type: string; objectId?: string; ruleId?: string }[];
};
async function snapshot(page: Page): Promise<Snapshot> {
  return page.evaluate(() =>
    (
      window as unknown as { __reflectionLab: { getSnapshot(): Snapshot } }
    ).__reflectionLab.getSnapshot(),
  );
}
async function open(page: Page) {
  await page.goto(
    new URL("/", process.env.NATIVE_ACCESSIBILITY_BASE_URL ?? "http://127.0.0.1:5174").href,
  );
  await expect(page.getByRole("button", { name: "開始運算", exact: true })).toBeVisible();
  await expect(page.locator("canvas")).toBeVisible();
}
async function lockAndRun(page: Page) {
  await page.getByRole("button", { name: "進入第一人稱", exact: true }).click();
  await expect.poll(() => page.evaluate(() => document.pointerLockElement?.tagName)).toBe("CANVAS");
  await page.keyboard.press("Enter");
  await expect.poll(async () => (await snapshot(page)).simulationState).toBe("running");
}
test("composition boundary fixture releases actual pointer lock, pauses and preserves Unicode text ownership", async ({
  page,
}, info) => {
  await open(page);
  await lockAndRun(page);
  await page.evaluate(() => {
    const events: unknown[] = [];
    (window as unknown as { __compositionEvidence: unknown[] }).__compositionEvidence = events;
    for (const type of ["compositionstart", "compositionupdate", "compositionend", "keydown"])
      document.addEventListener(type, (event) => {
        events.push({
          type: event.type,
          isTrusted: event.isTrusted,
          code: (event as KeyboardEvent).code ?? null,
          composing: (event as KeyboardEvent).isComposing ?? null,
        });
      });
    document
      .querySelector("canvas")!
      .dispatchEvent(new CompositionEvent("compositionstart", { data: "中", bubbles: true }));
  });
  await expect.poll(() => page.evaluate(() => document.pointerLockElement === null)).toBe(true);
  await expect.poll(async () => (await snapshot(page)).simulationState).toBe("paused");
  const before = await snapshot(page);
  const input = page.getByRole("searchbox", { name: "篩選事件", exact: true });
  await input.focus();
  await page.keyboard.insertText("中文組字");
  await page.keyboard.press("e");
  await page.keyboard.press("b");
  await page.keyboard.press("Delete");
  await page.evaluate(() => {
    document.activeElement!.dispatchEvent(
      new CompositionEvent("compositionupdate", { data: "中文組字", bubbles: true }),
    );
    document.activeElement!.dispatchEvent(
      new CompositionEvent("compositionend", { data: "中文組字", bubbles: true }),
    );
  });
  await expect(input).toHaveValue("中文組字eb");
  const after = await snapshot(page);
  expect(after.objects.map((object) => object.id)).toEqual(
    before.objects.map((object) => object.id),
  );
  expect(after.interactionMode).toBe(before.interactionMode);
  expect(after.tick).toBe(before.tick);
  expect(after.events.filter((event) => event.type === "OnThrow")).toHaveLength(0);
  await info.attach("composition-evidence.json", {
    body: JSON.stringify(
      {
        class: "SCRIPTED_COMPOSITION_BOUNDARY_IN_REAL_BROWSER; not OS IME",
        events: await page.evaluate(
          () => (window as unknown as { __compositionEvidence: unknown[] }).__compositionEvidence,
        ),
        before,
        after,
      },
      null,
      2,
    ),
    contentType: "application/json",
  });
});

test("contenteditable owns actual browser keys and modal Escape returns focus", async ({
  page,
}, info) => {
  await open(page);
  await lockAndRun(page);
  await page.evaluate(() => {
    const editable = document.createElement("div");
    editable.contentEditable = "true";
    editable.id = "native-accessibility-editable";
    editable.setAttribute("role", "textbox");
    editable.setAttribute("aria-label", "Contenteditable fixture");
    editable.style.cssText =
      "position:fixed;left:20px;top:120px;z-index:999;background:white;color:black;padding:12px";
    document.body.append(editable);
    editable.focus();
  });
  await expect.poll(() => page.evaluate(() => document.pointerLockElement === null)).toBe(true);
  await expect.poll(async () => (await snapshot(page)).simulationState).toBe("paused");
  const before = await snapshot(page);
  await page.keyboard.type("wasdeb");
  const editable = page.getByRole("textbox", { name: "Contenteditable fixture", exact: true });
  await expect(editable).toHaveText("wasdeb");
  await page.keyboard.press("Control+z");
  await expect(editable).not.toHaveText("wasdeb");
  const undone = await editable.textContent();
  await page.keyboard.press("Control+y");
  await expect(editable).toHaveText("wasdeb");
  expect((await snapshot(page)).objects.map((object) => object.id)).toEqual(
    before.objects.map((object) => object.id),
  );
  expect((await snapshot(page)).interactionMode).toBe("fps-interact");
  await page.evaluate(() => document.getElementById("native-accessibility-editable")!.remove());
  await page.getByRole("button", { name: "離開第一人稱", exact: true }).click();
  const trigger = page.getByRole("button", { name: "匯入專案 JSON", exact: true });
  await trigger.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog", { name: "匯入專案 JSON", exact: true })).toBeVisible();
  await page.keyboard.press("Tab");
  expect(await page.evaluate(() => document.activeElement?.closest("dialog") !== null)).toBe(true);
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
  await info.attach("contenteditable-focus-evidence.json", {
    body: JSON.stringify({
      class: "REAL_BROWSER_KEYBOARD_WITH_CONTENTEDITABLE_FIXTURE",
      before,
      after: await snapshot(page),
      textTyped: "wasdeb",
      textAfterUndo: undone,
      textAfterRedo: "wasdeb",
      modalFocusReturned: true,
    }),
    contentType: "application/json",
  });
});

test("repeated trusted E keydown does not toggle grab into drop", async ({ page }, info) => {
  await open(page);
  await page.evaluate(async () => {
    const app = (
      window as unknown as { __reflectionLab: { dispatch(action: unknown): Promise<void> } }
    ).__reflectionLab;
    await app.dispatch({
      type: "patchObject",
      objectId: "ball",
      patch: { positionM: [0, 1.6, 2], mode: "dynamicNoGravity" },
    });
  });
  await lockAndRun(page);
  await page.evaluate(() => {
    const events: { repeat: boolean; isTrusted: boolean }[] = [];
    (window as unknown as { __repeatEvidence: typeof events }).__repeatEvidence = events;
    document.addEventListener("keydown", (event) => {
      if (event.code === "KeyE") events.push({ repeat: event.repeat, isTrusted: event.isTrusted });
    });
  });
  const baseline = await snapshot(page);
  const grabCount = baseline.events.filter(
    (event) => event.type === "OnGrab" && !event.ruleId,
  ).length;
  const derivedGrabCount = baseline.events.filter(
    (event) => event.type === "OnGrab" && event.ruleId,
  ).length;
  const dropCount = baseline.events.filter(
    (event) => event.type === "OnDrop" && !event.ruleId,
  ).length;
  await page.keyboard.down("e");
  await expect
    .poll(async () => (await snapshot(page)).objects.find((object) => object.id === "ball")?.held)
    .toBe(true);
  await expect
    .poll(
      async () =>
        (await snapshot(page)).events.filter((event) => event.type === "OnGrab" && !event.ruleId)
          .length,
    )
    .toBe(grabCount + 1);
  await expect
    .poll(
      async () =>
        (await snapshot(page)).events.filter((event) => event.type === "OnGrab" && event.ruleId)
          .length,
    )
    .toBe(derivedGrabCount + 1);
  for (let index = 0; index < 4; index++) {
    const tick = (await snapshot(page)).tick;
    await page.keyboard.down("e");
    await expect.poll(async () => (await snapshot(page)).tick).toBeGreaterThan(tick);
    const current = await snapshot(page);
    expect(current.objects.find((object) => object.id === "ball")?.held).toBe(true);
    expect(current.events.filter((event) => event.type === "OnGrab" && !event.ruleId)).toHaveLength(
      grabCount + 1,
    );
    expect(current.events.filter((event) => event.type === "OnGrab" && event.ruleId)).toHaveLength(
      derivedGrabCount + 1,
    );
    expect(current.events.filter((event) => event.type === "OnDrop" && !event.ruleId)).toHaveLength(
      dropCount,
    );
  }
  await page.keyboard.up("e");
  await page.keyboard.press("e");
  await expect
    .poll(async () => (await snapshot(page)).objects.find((object) => object.id === "ball")?.held)
    .toBe(false);
  await expect
    .poll(
      async () =>
        (await snapshot(page)).events.filter((event) => event.type === "OnDrop" && !event.ruleId)
          .length,
    )
    .toBe(dropCount + 1);
  const keyEvents = await page.evaluate(
    () =>
      (window as unknown as { __repeatEvidence: { repeat: boolean; isTrusted: boolean }[] })
        .__repeatEvidence,
  );
  expect(keyEvents.map((event) => event.repeat)).toEqual([false, true, true, true, true, false]);
  expect(keyEvents.every((event) => event.isTrusted)).toBe(true);
  await info.attach("repeat-evidence.json", {
    body: JSON.stringify({
      class: "REAL_CHROME_KEYBOARD_REPEAT",
      keyEvents,
      result: await snapshot(page),
      firstPressGrabbed: true,
      everyRepeatedDownKeptHeld: true,
      nextFreshPressDropped: true,
    }),
    contentType: "application/json",
  });
});

test("native tab visibility loss pauses a moving locked player and never automatically resumes", async ({
  page,
  context,
}, info) => {
  await open(page);
  await lockAndRun(page);
  await page.keyboard.down("w");
  const before = await snapshot(page);
  await expect
    .poll(async () => (await snapshot(page)).listener.positionM[2])
    .toBeLessThan(before.listener.positionM[2] - 0.01);
  const other = await context.newPage();
  await other.goto("about:blank");
  const originalSession = await context.newCDPSession(page);
  const otherSession = await context.newCDPSession(other);
  const originalWindow = await originalSession.send("Browser.getWindowForTarget");
  const otherWindow = await otherSession.send("Browser.getWindowForTarget");
  expect(otherWindow.windowId).toBe(originalWindow.windowId);
  const originalTarget = await originalSession.send("Target.getTargetInfo");
  const otherTarget = await otherSession.send("Target.getTargetInfo");
  expect(otherTarget.targetInfo.targetId).not.toBe(originalTarget.targetInfo.targetId);
  await other.bringToFront();
  await expect.poll(() => page.evaluate(() => document.hidden)).toBe(true);
  await expect.poll(async () => (await snapshot(page)).simulationState).toBe("paused");
  const stopped = await snapshot(page);
  await page.bringToFront();
  await expect.poll(() => page.evaluate(() => document.hidden)).toBe(false);
  expect((await snapshot(page)).simulationState).toBe("paused");
  expect((await snapshot(page)).tick).toBe(stopped.tick);
  await other.close();
  await originalSession.detach();
  await page.getByRole("button", { name: "啟用滑鼠控制", exact: true }).click();
  await expect.poll(() => page.evaluate(() => document.pointerLockElement?.tagName)).toBe("CANVAS");
  await page.keyboard.press("Enter");
  await expect.poll(async () => (await snapshot(page)).tick).toBeGreaterThan(stopped.tick + 6);
  const resumedWithoutRelease = await snapshot(page);
  expect(
    Math.abs(resumedWithoutRelease.listener.positionM[0] - stopped.listener.positionM[0]),
  ).toBeLessThan(1e-6);
  expect(
    Math.abs(resumedWithoutRelease.listener.positionM[2] - stopped.listener.positionM[2]),
  ).toBeLessThan(1e-6);
  await page.keyboard.up("w");
  await page.keyboard.down("w");
  await expect
    .poll(async () => (await snapshot(page)).listener.positionM[2])
    .toBeLessThan(stopped.listener.positionM[2] - 0.01);
  await page.keyboard.up("w");
  await info.attach("visibility-evidence.json", {
    body: JSON.stringify({
      class: "NATIVE_BROWSER_TAB_VISIBILITY",
      originalWindow,
      otherWindow,
      originalTarget,
      otherTarget,
      before,
      stopped,
      resumedWithoutRelease,
      after: await snapshot(page),
      releaseThenFreshPressMoves: true,
    }),
    contentType: "application/json",
  });
});

test("real Chrome rejects pointer lock without transient activation and alternative controls remain available", async ({
  page,
}, info) => {
  await open(page);
  // Runtime.evaluate(userGesture:false) must not grant the activation under test.
  // Chromium owns the rejection; requestPointerLock is not replaced by a fixture.
  const session = await page.context().newCDPSession(page);
  const result = await session.send("Runtime.evaluate", {
    userGesture: false,
    awaitPromise: true,
    returnByValue: true,
    expression: `(async () => {
      await new Promise(resolve => setTimeout(resolve, 6000));
      const activeBefore = navigator.userActivation.isActive;
      await window.__reflectionLab.dispatch({ type: 'enterFPS' });
      let errorName = null;
      try { await document.querySelector('canvas').requestPointerLock(); }
      catch (error) { errorName = error.name; }
      return { activeBefore, errorName, pointerLocked: document.pointerLockElement !== null };
    })()`,
  });
  expect(result.exceptionDetails).toBeUndefined();
  expect(result.result.value.activeBefore).toBe(false);
  expect(result.result.value.errorName).toBe("NotAllowedError");
  expect(result.result.value.pointerLocked).toBe(false);
  await expect.poll(async () => (await snapshot(page)).simulationState).not.toBe("running");
  const deniedTick = (await snapshot(page)).tick;
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  expect((await snapshot(page)).tick).toBe(deniedTick);
  await expect(
    page.getByText("瀏覽器未提供滑鼠鎖定，仍可使用下方按鈕操作。", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "啟用免鎖定操作", exact: true }).click();
  await page.getByRole("button", { name: /^(開始運算|繼續運算)$/ }).click();
  await expect.poll(async () => (await snapshot(page)).simulationState).toBe("running");
  expect(await page.evaluate(() => document.pointerLockElement === null)).toBe(true);
  const beforeMove = (await snapshot(page)).listener.positionM[2];
  await page.getByText("免鎖定移動與視角", { exact: true }).click();
  await page.getByRole("button", { name: "前進", exact: true }).click();
  await expect
    .poll(async () => (await snapshot(page)).listener.positionM[2])
    .toBeLessThan(beforeMove - 0.01);
  expect((await snapshot(page)).events.filter((event) => event.type === "OnThrow")).toHaveLength(0);
  await info.attach("native-denial-evidence.json", {
    body: JSON.stringify({
      class: "NATIVE_CHROME_USER_ACTIVATION_DENIAL; no permission override",
      result: result.result.value,
      recovered: await snapshot(page),
      alternativeMoveChangedActualListener: true,
      protocol: "https://chromedevtools.github.io/devtools-protocol/tot/Runtime/#method-evaluate",
      pointerLockSpec: "https://www.w3.org/TR/pointerlock-2/",
    }),
    contentType: "application/json",
  });
});
