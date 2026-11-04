import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { PerspectiveCamera, Vector3 } from "three";
import type { LabViewModel } from "../../src/ui/contracts.js";
import type { ObjectTrajectory } from "../../src/scene/types.js";
import type { RecordingArtifact } from "../../src/experiments/types.js";

type Vec3 = [number, number, number];

const canvasSelector = ".viewport-canvas-wrap canvas";
const objectRow = (page: Page, id: string) =>
  page.locator(".object-row").filter({ has: page.locator(`[title='${id}']`) });
const snapshot = (page: Page): Promise<LabViewModel> =>
  page.evaluate(() => window.__reflectionLab!.getSnapshot());
const ballOf = (model: LabViewModel) => model.objects.find((object) => object.id === "ball")!;
const ballRun = (model: LabViewModel) => model.pathRuns.find((run) => run.objectId === "ball");
const curveCount = async (page: Page) =>
  Number(await page.locator(".viewport-canvas-wrap").getAttribute("data-trajectory-curves"));
/** The live physics body mode; the view model's `mode` is the configured (scene) mode. */
const liveBallPose = (page: Page) =>
  page.evaluate(() => {
    const runtime = window.__reflectionLab as unknown as {
      latest: {
        poses: {
          objectId: string;
          mode: string;
          positionMetres: Vec3;
          linearVelocityMetresPerSecond: Vec3;
        }[];
      };
    };
    return runtime.latest.poses.find((pose) => pose.objectId === "ball")!;
  });
const attach = (info: TestInfo, name: string, value: unknown) =>
  info.attach(name, { body: JSON.stringify(value, null, 2), contentType: "application/json" });

/** Inner faces of the default bay: walls at x = ±3.0 and z = -4.0, open front past the floor. */
const insideRoom = ([x, , z]: readonly number[]) => Math.abs(x!) < 2.8 && z! > -3.8 && z! < 4;

async function open(page: Page) {
  await page.route("**/api/agent/propose**", (route) => route.abort("blockedbyclient"));
  await page.route("https://api.meta.ai/**", (route) => route.abort("blockedbyclient"));
  await page.goto("/");
  await expect(page.getByRole("button", { name: "開始運算", exact: true })).toBeVisible();
  await expect(page.locator(canvasSelector)).toBeVisible();
  await expect.poll(() => page.evaluate(() => !!window.__reflectionLab)).toBe(true);
}

/** Screen position of a world point under the documented default observer camera. */
async function project(page: Page, world: Vec3) {
  const bounds = (await page.locator(canvasSelector).boundingBox())!;
  const camera = new PerspectiveCamera(50, bounds.width / bounds.height, 0.05, 250);
  camera.position.set(8, 6, 10);
  camera.lookAt(0, 1, 0);
  camera.updateMatrixWorld();
  const projected = new Vector3(...world).project(camera);
  return {
    x: bounds.x + ((projected.x + 1) * bounds.width) / 2,
    y: bounds.y + ((1 - projected.y) * bounds.height) / 2,
  };
}

/** World X/Y/Z of one Inspector point row, read from its own fields. */
async function pointRowWorld(page: Page, label: number): Promise<number[]> {
  const row = page.locator(`.trajectory-point[data-trajectory-point="${label}"]`);
  const values: number[] = [];
  for (const axis of ["X", "Y", "Z"])
    values.push(
      Number(await row.getByRole("spinbutton", { name: axis, exact: true }).inputValue()),
    );
  return values;
}

test("editor: T, two floor clicks, Strength 4 and Start run the ball's path and hand it back to physics; Shift+T toggles every curve", async ({
  page,
}, info) => {
  await open(page);
  await objectRow(page, "ball").click();
  await expect.poll(async () => (await snapshot(page)).selectedObjectId).toBe("ball");
  await page.keyboard.press("t");
  await expect(page.locator(".viewport-path-hint")).toBeVisible();
  const rows = page.locator(".trajectory-point");
  await expect(rows).toHaveCount(0);
  // Floor the default observer camera sees through the bay's open front (its right wall hides
  // the rest). Acoustic path lines cross this area. The second target is far enough on screen
  // from the first that the new point's move gizmo does not take the click.
  const floorTargets: Vec3[] = [
    [-0.5, 0, 1.2],
    [-2, 0, 3.5],
    [-2.4, 0, 3],
    [-1.5, 0, 3.5],
    [-0.3, 0, 2.2],
  ];
  const onFloorInRoom = (world: readonly number[]) =>
    insideRoom(world) && Math.abs(world[1]! - 0.26) < 0.01;
  const attempts: {
    target: Vec3;
    screen: { x: number; y: number };
    world?: number[];
    selectedPathId: string | null;
  }[] = [];
  for (const target of floorTargets) {
    const count = await rows.count();
    if (count >= 2) break;
    const screen = await project(page, target);
    await page.mouse.click(screen.x, screen.y);
    let added = true;
    try {
      await expect(rows).toHaveCount(count + 1, { timeout: 3000 });
    } catch {
      added = false;
    }
    const attempt: (typeof attempts)[number] = {
      target,
      screen,
      selectedPathId: (await snapshot(page)).selectedPathId ?? null,
    };
    attempts.push(attempt);
    if (!added) continue;
    attempt.world = await pointRowWorld(page, count + 1);
    if (onFloorInRoom(attempt.world)) continue;
    // Not the room's floor: the new point is the selected one, so Delete removes only it.
    await page.keyboard.press("Delete");
    await expect(rows).toHaveCount(count);
  }
  await attach(info, "floor-click-attempts.json", attempts);
  // While the editor is open, a click on a surface never selects an acoustic path line instead.
  expect(attempts.map((attempt) => attempt.selectedPathId)).toEqual(attempts.map(() => null));
  await expect(rows).toHaveCount(2);
  const points = [await pointRowWorld(page, 1), await pointRowWorld(page, 2)];
  for (const point of points) {
    expect(insideRoom(point), `point ${JSON.stringify(point)} lies inside the room`).toBe(true);
    // A floor click lands one radius plus 1 cm above the floor (the ball's radius is 0.25 m).
    expect(point[1]).toBeCloseTo(0.26, 2);
  }
  const edited = await snapshot(page);
  const stored = ballOf(edited).trajectory!;
  expect(stored.offsetsM).toHaveLength(2);
  stored.offsetsM.forEach((offset, index) =>
    offset.forEach((value, axis) =>
      expect(value + ballOf(edited).positionM[axis]!).toBeCloseTo(points[index]![axis]!, 2),
    ),
  );
  const status = edited.trajectoryStatus.ball!;
  await attach(info, "edited-path.json", { trajectory: stored, status, points });
  expect(status.problem, `path status ${JSON.stringify(status)} at ${JSON.stringify(points)}`).toBe(
    undefined,
  );
  expect(status.valid).toBe(true);
  // Editing open on the ball draws its curve only.
  expect(await curveCount(page)).toBe(1);

  const strength = page.getByRole("spinbutton", { name: "強度 m/s", exact: true });
  await strength.fill("4");
  await strength.press("Enter");
  await expect.poll(async () => ballOf(await snapshot(page)).trajectory?.strengthMps).toBe(4);
  const durationS = (await snapshot(page)).trajectoryStatus.ball!.durationS;
  expect(durationS).toBeGreaterThan(0);
  expect(durationS).toBeLessThan(2.5);

  await page.getByRole("button", { name: "開始運算", exact: true }).click();
  const started = Date.now();
  await expect
    .poll(async () => ballRun(await snapshot(page))?.status, { timeout: 3000, intervals: [50] })
    .toBe("finished");
  const finishedAfterMs = Date.now() - started;
  // Only the ball has a path, so it is the take's first run.
  expect((await snapshot(page)).pathRuns[0]).toMatchObject({
    objectId: "ball",
    status: "finished",
  });
  // The hand-over restores the configured dynamic mode with the path's exit speed.
  const handedOver = await liveBallPose(page);
  expect(handedOver.mode).toBe("dynamicGravity");
  const speed = Math.hypot(...handedOver.linearVelocityMetresPerSecond);
  expect(speed).toBeGreaterThan(0.5);
  // A dynamic body keeps moving under physics after the path ended.
  await expect
    .poll(async () => {
      const later = await liveBallPose(page);
      return Math.hypot(
        ...later.positionMetres.map((value, axis) => value - handedOver.positionMetres[axis]!),
      );
    })
    .toBeGreaterThan(0.05);
  await attach(info, "hand-over.json", {
    finishedAfterMs,
    durationS,
    handedOver,
    run: ballRun(await snapshot(page)),
  });
  await page.screenshot({ path: info.outputPath("after-take.png") });

  // Shift+T: with a second path stored, the toggle shows both curves, then only the edited one.
  await page.getByRole("button", { name: "暫停", exact: true }).first().click();
  await expect.poll(async () => (await snapshot(page)).simulationState).not.toBe("running");
  await page.evaluate(() =>
    window.__reflectionLab!.dispatch({
      type: "setTrajectory",
      objectId: "speaker",
      trajectory: {
        offsetsM: [
          [-0.5, 0.4, 0.8],
          [-1.2, 0.4, 1.6],
        ],
        strengthMps: 3,
        startDelayS: 0,
        faceAlongPath: false,
      },
    }),
  );
  await expect.poll(async () => (await snapshot(page)).trajectoryStatus.speaker?.valid).toBe(true);
  await expect.poll(() => curveCount(page)).toBe(1);
  await page.keyboard.press("Shift+T");
  await expect.poll(() => curveCount(page)).toBe(2);
  await page.screenshot({ path: info.outputPath("show-all-curves.png") });
  await page.keyboard.press("Shift+T");
  await expect.poll(() => curveCount(page)).toBe(1);
  await page.keyboard.press("Escape");
  await expect.poll(() => curveCount(page)).toBe(0);
  await page.keyboard.press("Shift+T");
  await expect.poll(() => curveCount(page)).toBe(2);
});

test("Record twice from the same layout: the ball's poses through tick 30 are identical", async ({
  page,
}, info) => {
  // Capture evaluation is slow under software WebGL; two short takes still need minutes.
  test.setTimeout(240_000);
  await open(page);
  const path: ObjectTrajectory = {
    // From the ball's start (-0.8, 2, 0) across the room in the air.
    offsetsM: [
      [0.8, -0.5, 1],
      [1.8, -0.8, 0.2],
    ],
    strengthMps: 3,
    startDelayS: 0,
    faceAlongPath: false,
  };
  await page.evaluate(
    (trajectory) =>
      window.__reflectionLab!.dispatch({ type: "setTrajectory", objectId: "ball", trajectory }),
    path,
  );
  await expect.poll(async () => (await snapshot(page)).trajectoryStatus.ball?.valid).toBe(true);
  // The recording controls live in the experiment dock, collapsed by default.
  await page.getByRole("button", { name: "展開實驗面板", exact: true }).click();
  const record = page.getByRole("button", { name: "● 開始錄製", exact: true });
  const stop = page.getByRole("button", { name: "■ 停止錄製", exact: true });
  const recoveries: { take: string; before: unknown; after: unknown }[] = [];
  const stamp = (model: LabViewModel) => ({
    tick: model.tick,
    state: model.simulationState,
    recording: model.recording.state,
    pauseReason: model.pauseReason ?? "",
    runId: model.runId,
    sceneRevision: model.sceneRevision,
  });

  const take = async (label: string) => {
    await record.click();
    await expect.poll(async () => (await snapshot(page)).recording.state).toBe("recording");
    const during = await snapshot(page);
    expect(ballRun(during), `${label}: the ball's path runs in the take`).toBeTruthy();
    // A short take covering tick 30 with margin. Under load a recording may pause at a whole
    // tick without dropping one: the fixed-step guard, or a full evaluation queue ("處理後可繼續").
    // Both are documented resumable pauses; after the queue drains, the product's own Resume
    // continues the take from the same tick (as in product-e2e-refined-v3). Any other stop fails.
    const deadline = Date.now() + 90_000;
    for (;;) {
      const now = await snapshot(page);
      if (now.error) throw new Error(`${label}: ${now.error}`);
      if (now.tick > 32) break;
      if (Date.now() > deadline)
        throw new Error(`${label}: take stalled ${JSON.stringify(stamp(now))}`);
      if (now.simulationState !== "running" && now.recording.state === "recording") {
        expect(now.pauseReason ?? "", `${label}: only a resumable capture pause`).toMatch(
          /固定步.*超限|FIXED_STEP_OVERRUN|錄製評估佇列已滿/i,
        );
        expect(recoveries.length, "explicit Resume budget").toBeLessThan(40);
        await page.evaluate(() => window.__reflectionLab!.flushRecordingEvaluation());
        await page.getByRole("button", { name: "繼續運算", exact: true }).click();
        const after = await snapshot(page);
        recoveries.push({ take: label, before: stamp(now), after: stamp(after) });
        if (after.error) throw new Error(`${label}: Resume refused: ${after.error}`);
        expect(after.tick).toBeGreaterThanOrEqual(now.tick);
        expect(after.recording.state).toBe("recording");
      }
      await page.waitForTimeout(50);
    }
    await stop.click();
    await expect.poll(async () => (await snapshot(page)).recording.state).toBe("finalized");
    const artifact = (await page.evaluate(() =>
      window.__reflectionLab!.getRecordingArtifact(),
    )) as RecordingArtifact | null;
    expect(artifact?.status, `${label}: captured`).toBe("captured");
    const ballPoses = artifact!.frames
      .filter((frame) => frame.tick <= 30)
      .map((frame) => ({
        tick: frame.tick,
        pose: frame.poses.find((pose) => pose.objectId === "ball")!,
      }));
    return { startTick: artifact!.startTick, runEpoch: artifact!.runEpoch, ballPoses };
  };

  const first = await take("first take");
  // The room has run: Record snaps the objects back to the starting layout first.
  expect((await snapshot(page)).tick).toBeGreaterThan(0);
  const second = await take("second take");
  await attach(info, "takes.json", { first, second, recoveries });
  // Both takes start from tick 0: the first fresh, the second after the snap-back.
  expect(first.startTick).toBe(1);
  expect(second.startTick).toBe(1);
  const at30 = (run: typeof first) => run.ballPoses.find((entry) => entry.tick === 30)?.pose;
  expect(at30(first)).toBeTruthy();
  // The path, not gravity, drives the ball at tick 30: it is still near the path's height.
  expect(at30(first)!.positionM[1]).toBeGreaterThan(1);
  expect(at30(second)!.positionM).toEqual(at30(first)!.positionM);
  expect(at30(second)!.orientationQuaternion).toEqual(at30(first)!.orientationQuaternion);
  expect(second.ballPoses.map((entry) => [entry.tick, entry.pose.positionM])).toEqual(
    first.ballPoses.map((entry) => [entry.tick, entry.pose.positionM]),
  );
});

test("first person: Ctrl+press on the ball paints its path in the frozen room; Enter starts the take", async ({
  page,
}, info) => {
  await open(page);
  // A real scene command places the ball, floating, in front of the first-person player.
  await page.evaluate(() =>
    window.__reflectionLab!.dispatch({
      type: "patchObject",
      objectId: "ball",
      patch: { positionM: [0, 1.6, 2], mode: "dynamicNoGravity" },
    }),
  );
  const enter = page.getByRole("button", { name: "進入第一人稱", exact: true });
  const button = (await enter.boundingBox())!;
  await enter.click();
  await expect.poll(() => page.evaluate(() => document.pointerLockElement?.tagName)).toBe("CANVAS");
  await expect.poll(async () => (await snapshot(page)).simulationState).toBe("running");
  await expect.poll(async () => (await snapshot(page)).tick).toBeGreaterThan(5);
  expect(ballOf(await snapshot(page)).trajectory).toBeUndefined();

  // Movement continues from where the entry click left the pointer.
  let x = button.x + button.width / 2;
  const y = button.y + button.height / 2;
  await page.keyboard.down("Control");
  await page.mouse.down();
  await expect.poll(async () => (await snapshot(page)).paint?.objectId).toBe("ball");
  await page.keyboard.up("Control");
  const frozen = await snapshot(page);
  expect(frozen.simulationState).toBe("ready");
  expect(frozen.tick).toBe(0);
  for (let step = 0; step < 30; step++) {
    x += 10;
    await page.mouse.move(x, y);
  }
  await expect
    .poll(async () => (await snapshot(page)).paint?.pointsM.length ?? 0)
    .toBeGreaterThan(2);
  const stroke = (await snapshot(page)).paint!;
  await page.screenshot({ path: info.outputPath("painting.png") });
  await page.mouse.up();
  await expect.poll(async () => (await snapshot(page)).paint).toBeNull();
  const painted = await snapshot(page);
  const trajectory = ballOf(painted).trajectory;
  await attach(info, "painted.json", { stroke, trajectory, status: painted.trajectoryStatus.ball });
  expect(trajectory?.offsetsM.length ?? 0).toBeGreaterThan(0);
  expect(painted.simulationState).toBe("ready");
  expect(painted.trajectoryStatus.ball?.valid).toBe(true);
  expect(painted.pathRuns).toEqual([]);

  await page.keyboard.press("Enter");
  await expect.poll(async () => (await snapshot(page)).simulationState).toBe("running");
  await expect.poll(async () => (await snapshot(page)).pathRuns.length).toBeGreaterThan(0);
  await expect.poll(async () => ballRun(await snapshot(page))?.elapsedS ?? 0).toBeGreaterThan(0.1);
  await attach(info, "take.json", { run: ballRun(await snapshot(page)) });
  await page.keyboard.press("Escape");
  await expect.poll(() => page.evaluate(() => document.pointerLockElement)).toBeNull();
});
