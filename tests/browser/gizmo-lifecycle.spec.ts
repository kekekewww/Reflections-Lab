import { expect, test, type Page } from "@playwright/test";

/** R18 review: gizmo gestures commit once, and cancellations or overlaps never leak a commit. */
async function open(page: Page) {
  await page.goto("/");
  await expect(page.locator(".viewport-canvas-wrap canvas")).toBeVisible();
  await expect(page.getByRole("button", { name: "開始運算", exact: true })).toBeVisible();
  await page.evaluate(() =>
    window.__reflectionLab!.dispatch({ type: "selectObject", objectId: "ball" }),
  );
  await expect
    .poll(() => page.evaluate(() => window.__reflectionLab!.getSnapshot().selectedObjectId))
    .toBe("ball");
  await page.waitForTimeout(500);
}
const ball = (page: Page) =>
  page.evaluate(() => {
    const view = window.__reflectionLab!.getSnapshot();
    const object = view.objects.find((entry) => entry.id === "ball")!;
    return {
      revision: view.sceneRevision,
      selected: view.selectedObjectId,
      positionM: object.positionM,
      dimensionsM: object.dimensionsM,
    };
  });
/** Screen point on the gizmo's red X handle, found in the rendered canvas pixels. */
async function redHandle(page: Page) {
  const box = (await page.locator(".viewport-canvas-wrap canvas").boundingBox())!;
  const png = await page.screenshot({ clip: box });
  const point = await page.evaluate(async (data) => {
    const image = new Image();
    image.src = `data:image/png;base64,${data}`;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext("2d")!;
    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const red: [number, number][] = [];
    for (let i = 0; i < pixels.length; i += 4)
      if (pixels[i]! > 230 && pixels[i + 1]! < 40 && pixels[i + 2]! < 40)
        red.push([(i / 4) % canvas.width, Math.floor(i / 4 / canvas.width)]);
    red.sort((a, b) => a[0] - b[0]);
    return red.length ? red[Math.floor(red.length * 0.7)]! : null;
  }, png.toString("base64"));
  if (!point) throw new Error("Gizmo X handle not rendered");
  return { x: box.x + point[0], y: box.y + point[1] };
}
async function dragFrom(page: Page, start: { x: number; y: number }, steps = 10) {
  await page.mouse.move(start.x, start.y);
  await page.waitForTimeout(150);
  await page.mouse.down();
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(start.x + i * 8, start.y + i * 1.5);
    await page.waitForTimeout(25);
  }
}

test("a finished gizmo drag commits once; pointercancel and window blur abandon a drag without any commit", async ({
  page,
}) => {
  await open(page);
  const initial = await ball(page);
  await dragFrom(page, await redHandle(page));
  await page.mouse.up();
  await expect.poll(async () => (await ball(page)).revision).toBe(initial.revision + 1);
  const moved = await ball(page);
  expect(moved.positionM[0]).toBeGreaterThan(initial.positionM[0] + 0.05);
  expect(moved.selected).toBe("ball");
  for (const cause of ["pointercancel", "blur"] as const) {
    const before = await ball(page);
    await dragFrom(page, await redHandle(page));
    await page.evaluate((cause) => {
      if (cause === "blur") window.dispatchEvent(new Event("blur"));
      else
        document
          .querySelector(".viewport-canvas-wrap canvas")!
          .dispatchEvent(new PointerEvent("pointercancel", { pointerId: 1, bubbles: true }));
    }, cause);
    for (let i = 11; i <= 14; i++) await page.mouse.move(400 + i * 8, 400);
    await page.mouse.up();
    await page.waitForTimeout(600);
    const after = await ball(page);
    expect(after.revision, `${cause}: abandoned drag commits nothing`).toBe(before.revision);
    expect(after.positionM, `${cause}: preview restored`).toEqual(before.positionM);
    expect(after.selected).toBe("ball");
  }
  // The gizmo is not stuck: a fresh drag still commits exactly once.
  const before = await ball(page);
  await dragFrom(page, await redHandle(page));
  await page.mouse.up();
  await expect.poll(async () => (await ball(page)).revision).toBe(before.revision + 1);
});

test("a second gizmo drag cannot start while the first drag's commit is still pending", async ({
  page,
}) => {
  await open(page);
  await page.evaluate(() => {
    const runtime = window.__reflectionLab!;
    const dispatch = runtime.dispatch.bind(runtime);
    runtime.dispatch = (action) =>
      action.type === "patchObject"
        ? new Promise<void>((resolve) => setTimeout(resolve, 1200)).then(() => dispatch(action))
        : dispatch(action);
  });
  await page.getByRole("button", { name: "縮放", exact: true }).click();
  await page.waitForTimeout(300);
  const initial = await ball(page);
  const handle = await redHandle(page);
  await dragFrom(page, handle);
  await page.mouse.up();
  // Drag B starts while A's single commit is still in flight.
  await dragFrom(page, handle, 6);
  await page.mouse.up();
  await page.waitForTimeout(2600);
  const after = await ball(page);
  expect(after.revision, "exactly one commit for A; B never started").toBe(initial.revision + 1);
  expect(after.dimensionsM[0]).not.toBe(initial.dimensionsM[0]);
  await expect(page.locator(".error-banner")).toHaveCount(0);
});

test("changing gizmo mode while a commit is pending cannot open a second drag", async ({
  page,
}) => {
  await open(page);
  await page.evaluate(() => {
    const runtime = window.__reflectionLab!;
    const dispatch = runtime.dispatch.bind(runtime);
    runtime.dispatch = (action) =>
      action.type === "patchObject"
        ? new Promise<void>((resolve) => setTimeout(resolve, 4000)).then(() => dispatch(action))
        : dispatch(action);
  });
  const initial = await ball(page);
  await dragFrom(page, await redHandle(page));
  await page.mouse.up();
  // The long delay keeps A pending for the whole of B's attempt.
  // The mode switch recreates the controls while A's commit is still in flight.
  await page.getByRole("button", { name: "縮放", exact: true }).click();
  await page.waitForTimeout(300);
  await dragFrom(page, await redHandle(page), 6);
  await page.mouse.up();
  await page.waitForTimeout(4500);
  const after = await ball(page);
  expect(after.revision, "exactly one commit for A; B never started").toBe(initial.revision + 1);
  expect(after.dimensionsM[0], "B (scale) did not apply").toBe(initial.dimensionsM[0]);
  expect(after.positionM[0]).toBeGreaterThan(initial.positionM[0] + 0.05);
  // Once A settled, the replacement controls are usable again: one more commit.
  await dragFrom(page, await redHandle(page), 6);
  await page.mouse.up();
  await expect.poll(async () => (await ball(page)).revision).toBe(initial.revision + 2);
  await expect(page.locator(".error-banner")).toHaveCount(0);
});

test("a lost-capture cancellation queued before controls are disposed does not throw", async ({
  page,
}) => {
  await open(page);
  await dragFrom(page, await redHandle(page));
  // Hold back only the microtask the lost-capture handler queues, change mode so
  // the controls are disposed, then run it: the cancellation now follows disposal.
  await page.evaluate(() => {
    const held: (() => void)[] = ((window as unknown as { __held: (() => void)[] }).__held = []);
    const original = window.queueMicrotask.bind(window);
    window.queueMicrotask = (callback) => void held.push(callback);
    document
      .querySelector(".viewport-canvas-wrap canvas")!
      .dispatchEvent(new PointerEvent("lostpointercapture", { pointerId: 1, bubbles: true }));
    window.queueMicrotask = original;
    // A scripted click keeps the pointer held, so the drag is still live.
    [...document.querySelectorAll("button")].find((b) => b.textContent === "縮放")!.click();
  });
  await page.waitForTimeout(1000);
  const failures = await page.evaluate(() => {
    const held = (window as unknown as { __held: (() => void)[] }).__held;
    const errors: string[] = [];
    for (const callback of held.splice(0)) {
      try {
        callback();
      } catch (error) {
        errors.push(String(error));
      }
    }
    return errors;
  });
  await page.mouse.up();
  expect(failures).toEqual([]);
});

test("a canvas remount while a commit is pending cannot open a second drag", async ({ page }) => {
  await open(page);
  await page.evaluate(() => {
    const runtime = window.__reflectionLab!;
    const dispatch = runtime.dispatch.bind(runtime);
    runtime.dispatch = (action) =>
      action.type === "patchObject"
        ? new Promise<void>((resolve) => setTimeout(resolve, 4000)).then(() => dispatch(action))
        : dispatch(action);
  });
  const initial = await ball(page);
  await dragFrom(page, await redHandle(page));
  await page.mouse.up();
  // Fail the canvas boundary, then use its real Retry button to rebuild the subtree.
  await page.evaluate(() => {
    const host = document.querySelector(".viewport-canvas-wrap canvas")!;
    const key = Object.keys(host).find((name) => name.startsWith("__reactFiber$"))!;
    let fiber = (host as unknown as Record<string, { return: unknown; stateNode: unknown }>)[key];
    while (fiber) {
      const node = fiber.stateNode as { setState?: (state: unknown) => void; props?: object };
      if (node && typeof node.setState === "function" && node.props && "retry" in node.props) {
        node.setState({ failed: true });
        return;
      }
      fiber = fiber.return as typeof fiber;
    }
    throw new Error("CanvasBoundary not found");
  });
  await page.locator(".viewport-fallback button").click();
  await expect(page.locator(".viewport-canvas-wrap canvas")).toBeVisible();
  await page.waitForTimeout(800);
  await dragFrom(page, await redHandle(page), 6);
  await page.mouse.up();
  await page.waitForTimeout(4500);
  const after = await ball(page);
  expect(after.revision, "exactly one commit for A; B never started").toBe(initial.revision + 1);
  await dragFrom(page, await redHandle(page), 6);
  await page.mouse.up();
  await expect.poll(async () => (await ball(page)).revision).toBe(initial.revision + 2);
  await expect(page.locator(".error-banner")).toHaveCount(0);
});

test("selection clicks are ignored while a gizmo commit is pending, then work again", async ({
  page,
}) => {
  await open(page);
  await page.evaluate(() => {
    const runtime = window.__reflectionLab!;
    const dispatch = runtime.dispatch.bind(runtime);
    runtime.dispatch = (action) =>
      action.type === "patchObject"
        ? new Promise<void>((resolve) => setTimeout(resolve, 4000)).then(() => dispatch(action))
        : dispatch(action);
  });
  const initial = await ball(page);
  await dragFrom(page, await redHandle(page));
  await page.mouse.up();
  // Past the 300 ms post-drag suppression window, A is still committing.
  await page.waitForTimeout(600);
  const box = (await page.locator(".viewport-canvas-wrap canvas").boundingBox())!;
  await page.mouse.click(box.x + 12, box.y + 12);
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(300);
  expect((await ball(page)).selected, "pending commit keeps the selection").toBe("ball");
  await page.waitForTimeout(4500);
  const settled = await ball(page);
  expect(settled.revision).toBe(initial.revision + 1);
  await expect(page.locator(".error-banner")).toHaveCount(0);
  // Nothing pending and past the window: clicking empty background deselects again.
  // The commit status banner changes the viewport origin. Use its current bounds.
  const settledBox = (await page.locator(".viewport-canvas-wrap canvas").boundingBox())!;
  await page.mouse.click(settledBox.x + 12, settledBox.y + 12);
  await expect.poll(async () => (await ball(page)).selected).toBeNull();
});
