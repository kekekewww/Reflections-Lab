import { expect, test, type Locator } from "@playwright/test";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

type Json = ReturnType<typeof JSON.parse>;
const attempt = (process.env.PIPELINE_COMBINED_AUDIT_ATTEMPT ?? "initial").replace(
  /[^A-Za-z0-9_.-]/g,
  "-",
);
const reportRoot = fileURLToPath(
  new URL(
    "../../../docs/14-core-pipeline/stages/11-ui-parameters/pipeline/render-performance/render/",
    import.meta.url,
  ),
);
const evidence = join(reportRoot, "combined-attempts", attempt);
const cache = join(
  fileURLToPath(new URL("../../../.cache/ui-parameter-audit-combined/", import.meta.url)),
  attempt,
);
const sha = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
const span = (values: number[]) => (values.length ? Math.max(...values) - Math.min(...values) : 0);

function wavStats(bytes: Buffer) {
  const header =
    bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WAVE";
  let rate = 0,
    channels = 0,
    bits = 0,
    format = 0,
    dataStart = 0,
    dataBytes = 0;
  for (let offset = 12; offset + 8 <= bytes.length; ) {
    const id = bytes.toString("ascii", offset, offset + 4);
    const length = bytes.readUInt32LE(offset + 4);
    if (id === "fmt ") {
      format = bytes.readUInt16LE(offset + 8);
      channels = bytes.readUInt16LE(offset + 10);
      rate = bytes.readUInt32LE(offset + 12);
      bits = bytes.readUInt16LE(offset + 22);
    }
    if (id === "data") {
      dataStart = offset + 8;
      dataBytes = length;
      break;
    }
    offset += 8 + length + (length % 2);
  }
  let peak = 0,
    squares = 0,
    nonfinite = 0;
  for (
    let offset = dataStart;
    dataStart > 0 && offset + 4 <= Math.min(bytes.length, dataStart + dataBytes);
    offset += 4
  ) {
    const value = bytes.readFloatLE(offset);
    if (!Number.isFinite(value)) {
      nonfinite++;
      continue;
    }
    peak = Math.max(peak, Math.abs(value));
    squares += value * value;
  }
  return {
    header,
    format,
    rate,
    channels,
    bits,
    frames: dataBytes / 4 / Math.max(1, channels),
    durationS: dataBytes / 4 / Math.max(1, channels) / Math.max(1, rate),
    peak,
    rms: Math.sqrt(squares / Math.max(1, dataBytes / 4)),
    nonfinite,
  };
}

function inspectRecording(recording: Json) {
  const frames = (recording.frames ?? []) as Json[];
  const positions = new Map<number, number[]>();
  const rawZoneEvents: Json[] = [];
  const zoneVoiceEvents: Json[] = [];
  const curveSamples: Json[] = [];
  const speakerIds = new Set<string>();
  const curveRule = "rule.pipeline-always";
  for (const frame of frames) {
    const pose = (frame.poses as Json[]).find((item) => item.objectId === "ball");
    if (pose) positions.set(frame.tick, pose.positionM);
    for (const event of (frame.physicsEvents ?? []) as Json[]) {
      if (
        event.objectId === "ball" &&
        event.source === "zone" &&
        event.zoneId === "zone.pipeline" &&
        event.accepted === true &&
        ["OnEnterZone", "OnExitZone"].includes(event.type)
      )
        rawZoneEvents.push({ recordedFrameTick: frame.tick, ...event });
    }
    const behavior = frame.behaviorSnapshot ?? {};
    const input = ((behavior.inputFrame?.objects ?? []) as Json[]).find(
      (item) => item.objectId === "ball",
    );
    const speed = input?.metrics?.sourceSpeedMetresPerSecond;
    const events = [
      ...((behavior.voiceIntents ?? []) as Json[]).map((intent) => intent.event),
      ...((frame.audioEvents ?? []) as Json[]),
    ];
    for (const event of events) {
      if (!event) continue;
      if (event.objectId === "speaker" && event.ruleId === "rule.pipeline-speaker")
        speakerIds.add(event.instanceId);
      if (
        event.objectId === "ball" &&
        ["rule.pipeline-enter", "rule.pipeline-exit"].includes(event.ruleId)
      )
        zoneVoiceEvents.push({
          recordedFrameTick: frame.tick,
          ruleId: event.ruleId,
          instanceId: event.instanceId,
          trigger: event.trigger,
        });
      if (
        event.objectId === "ball" &&
        event.ruleId === curveRule &&
        Number.isFinite(speed) &&
        Number.isFinite(event.gainLinear)
      ) {
        const x = Math.max(0, Math.min(1, speed / 1.5));
        const y = x <= 0.5 ? 0.5 * x : 0.25 + 1.5 * (x - 0.5);
        const expected = 0.05 + 1.95 * y;
        curveSamples.push({
          tick: frame.tick,
          speed,
          gain: event.gainLinear,
          expected,
          linearReference: 0.05 + 1.95 * x,
          error: Math.abs(event.gainLinear - expected),
          normalizedInput: x,
        });
      }
    }
  }
  type Reflection = {
    pathId: string;
    poseTick: number;
    ballPositionM: number[];
    vertexM: number[];
    lengthM: number;
    absoluteDelayS: number;
    sphereSurfaceErrorM: number;
  };
  const reflectionSamples: Reflection[] = [];
  let missingPoseMatches = 0;
  for (const frame of frames) {
    for (const acoustic of (frame.acousticFrames ?? []) as Json[]) {
      if (!speakerIds.has(acoustic.sourceId)) continue;
      for (const path of (acoustic.paths ?? []) as Json[]) {
        if (
          path.order !== 1 ||
          !(path.surfaceIds ?? []).includes("ball.body") ||
          !Array.isArray(path.verticesM?.[1])
        )
          continue;
        const pose = positions.get(acoustic.poseTick);
        if (!pose) {
          missingPoseMatches++;
          continue;
        }
        const vertex = path.verticesM[1] as number[];
        const distance = Math.hypot(
          vertex[0]! - pose[0]!,
          vertex[1]! - pose[1]!,
          vertex[2]! - pose[2]!,
        );
        reflectionSamples.push({
          pathId: path.id,
          poseTick: acoustic.poseTick,
          ballPositionM: pose,
          vertexM: vertex,
          lengthM: path.lengthM,
          absoluteDelayS: path.absoluteDelayS,
          sphereSurfaceErrorM: Math.abs(distance - 0.25),
        });
      }
    }
  }
  const groups = new Map<string, Reflection[]>();
  for (const sample of reflectionSamples)
    groups.set(sample.pathId, [...(groups.get(sample.pathId) ?? []), sample]);
  const changingStablePaths = [...groups].filter(
    ([, samples]) =>
      new Set(samples.map((sample) => sample.poseTick)).size >= 2 &&
      span(samples.map((sample) => sample.vertexM[0]!)) > 1e-4 &&
      span(samples.map((sample) => sample.lengthM)) > 1e-5 &&
      span(samples.map((sample) => sample.absoluteDelayS)) > 1e-8,
  );
  const ball = ((recording.configuration?.sceneSnapshot?.objects ?? []) as Json[]).find(
    (object) => object.id === "ball",
  );
  const mapping = ((recording.configuration?.behaviorConfig?.profiles ?? []) as Json[])
    .flatMap((profile) => profile.rules ?? [])
    .find((rule: Json) => rule.ruleId === curveRule)?.mappings?.[0];
  const enter = rawZoneEvents.find((event) => event.type === "OnEnterZone");
  const exit = rawZoneEvents.find((event) => event.type === "OnExitZone");
  const ticks = frames.map((frame) => frame.tick as number);
  const xs = [...positions.values()].map((position) => position[0]!);
  const ys = [...positions.values()].map((position) => position[1]!);
  const interior = curveSamples.filter(
    (sample) =>
      sample.normalizedInput > 0.1 &&
      sample.normalizedInput < 0.9 &&
      Math.abs(sample.expected - sample.linearReference) > 1e-4,
  );
  return {
    method: "Read ordinary UI-downloaded recording JSON; no HostInternal or bridge",
    modelLimits: [
      "Quasi-static snapshot first-order analytic curved reflection",
      "No Doppler, focusing/caustics or physical hearing claim",
      "Logical mapped gain is not instantaneous hardware PCM amplitude",
    ],
    frameCount: recording.frameCount,
    startTick: recording.startTick,
    endTick: recording.endTick,
    ballConfiguration: ball,
    backendVersion: recording.configuration?.backendVersion,
    capabilities: recording.configuration?.backendCapabilities,
    poseSummary: {
      count: positions.size,
      first: [...positions].at(0),
      last: [...positions].at(-1),
      xRangeM: span(xs),
      yRangeM: span(ys),
    },
    rawZoneEvents,
    zoneVoiceEvents,
    persistedMapping: mapping,
    curveSamples,
    curveSummary: {
      count: curveSamples.length,
      interiorCount: interior.length,
      maxError: Math.max(0, ...curveSamples.map((sample) => sample.error)),
      gainRange: span(curveSamples.map((sample) => sample.gain)),
    },
    speakerInstanceIds: [...speakerIds],
    reflectionSamples,
    missingPoseMatches,
    changingStablePaths: changingStablePaths.map(([pathId, samples]) => ({
      pathId,
      count: samples.length,
      ticks: [...new Set(samples.map((sample) => sample.poseTick))],
      vertexXRangeM: span(samples.map((sample) => sample.vertexM[0]!)),
      lengthRangeM: span(samples.map((sample) => sample.lengthM)),
      delayRangeS: span(samples.map((sample) => sample.absoluteDelayS)),
      maxSphereSurfaceErrorM: Math.max(...samples.map((sample) => sample.sphereSurfaceErrorM)),
    })),
    invariants: {
      bounded180Frames:
        recording.frameCount === 180 &&
        frames.length === 180 &&
        recording.endTick - recording.startTick + 1 === 180,
      contiguousTicks: ticks.every((tick, index) => index === 0 || tick === ticks[index - 1]! + 1),
      curvedDynamicReflectorConfigured:
        ball?.shape === "sphere" &&
        ball?.mode === "dynamicNoGravity" &&
        ball?.acousticRole === "dynamicReflector" &&
        ball?.acousticMaterialId === "material.metal",
      actualHorizontalMovement: span(xs) > 2 && span(ys) < 0.1,
      acceptedZoneEnterAndExit: Boolean(
        enter && exit && enter.recordedFrameTick < exit.recordedFrameTick,
      ),
      bothZoneSoundRulesFired:
        zoneVoiceEvents.some((event) => event.ruleId === "rule.pipeline-enter") &&
        zoneVoiceEvents.some((event) => event.ruleId === "rule.pipeline-exit"),
      nonlinearCurvePersisted:
        mapping?.input === "sourceSpeedMetresPerSecond" &&
        mapping?.target === "gainLinear" &&
        JSON.stringify(mapping?.curve) ===
          JSON.stringify([
            { x: 0, y: 0 },
            { x: 0.5, y: 0.25 },
            { x: 1, y: 1 },
          ]),
      nonlinearCurveActuallyResolved:
        interior.length > 0 &&
        curveSamples.length > 1 &&
        curveSamples.every((sample) => sample.error < 1e-7) &&
        span(curveSamples.map((sample) => sample.gain)) > 0.1,
      actualMovingSphereReflection: changingStablePaths.length > 0,
    },
  };
}

test("fresh UI zone nonlinear curve moving sphere reflector pipeline downloads each WAV", async ({
  page,
  browser,
}) => {
  await mkdir(evidence, { recursive: true });
  await mkdir(cache, { recursive: true });
  const receipt: Json = {
    schemaVersion: 1,
    attempt,
    status: "RUNNING",
    startedAtUtc: new Date().toISOString(),
    method: "Playwright CLI scripted DOM / headless Chrome",
    browser: browser.version(),
    baseURL: "http://127.0.0.1:4173",
    operationsBoundary:
      "Only actual DOM controls and ordinary project import/export, recording export and output downloads; JSON analysis is outside the app; no HostInternal/bridge/direct dispatch",
    stages: [],
    downloads: [],
    servedAssets: [],
    blockedRequests: [],
    agentRequests: [],
    pageErrors: [],
    dialogs: [],
    notVerified: [
      "Native/MCP computer use",
      "Hearing",
      "600-second performance",
      "Doppler/focusing/caustics",
      "Meta live",
    ],
  };
  await writeFile(join(evidence, "combined-receipt.json"), JSON.stringify(receipt, null, 2), {
    flag: "wx",
  });
  const tasks: Promise<void>[] = [];
  const seen = new Set<string>();
  page.on("response", (response) => {
    const url = new URL(response.url());
    if (
      url.origin !== "http://127.0.0.1:4173" ||
      (!/\.(js|css)$/.test(url.pathname) && url.pathname !== "/") ||
      seen.has(url.href)
    )
      return;
    seen.add(url.href);
    tasks.push(
      response
        .body()
        .then((bytes) => {
          receipt.servedAssets.push({ url: url.href, bytes: bytes.length, sha256: sha(bytes) });
        })
        .catch((error) => {
          receipt.servedAssets.push({ url: url.href, readError: String(error) });
        }),
    );
  });
  page.on("pageerror", (error) => receipt.pageErrors.push(error.message));
  page.on("dialog", async (dialog) => {
    receipt.dialogs.push({ type: dialog.type(), message: dialog.message() });
    await dialog.dismiss();
  });
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/api/agent/"))
      receipt.agentRequests.push(request.method() + " " + request.url());
  });
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (
      (url.protocol.startsWith("http") && url.origin !== "http://127.0.0.1:4173") ||
      url.pathname.startsWith("/api/agent/propose")
    ) {
      receipt.blockedRequests.push(route.request().method() + " " + url.href);
      await route.abort("blockedbyclient");
    } else await route.continue();
  });
  async function download(button: Locator, label: string) {
    const pending = page.waitForEvent("download");
    await button.click();
    const result = await pending;
    const path = join(cache, label + "-" + result.suggestedFilename());
    await result.saveAs(path);
    const bytes = await readFile(path);
    const item = {
      label,
      filename: result.suggestedFilename(),
      path,
      bytes: bytes.length,
      sha256: sha(bytes),
      ...(result.suggestedFilename().endsWith(".wav") ? { wav: wavStats(bytes) } : {}),
    };
    receipt.downloads.push(item);
    return { bytes, item };
  }
  try {
    await page.goto("/");
    await expect(page.locator("canvas")).toBeVisible();
    const base = await download(
      page.getByRole("button", { name: "匯出專案", exact: true }),
      "base-ui-project",
    );
    const contractBytes = await readFile(join(reportRoot, "final-combined-contract.json"));
    const contract = JSON.parse(contractBytes.toString("utf8"));
    const template = contract.fixtureTemplate;
    const project = JSON.parse(base.bytes.toString("utf8"));
    project.revision++;
    project.scene.sceneRevision++;
    project.name = "區域・非線性曲線・動態球反射完整管線";
    project.updatedAt = new Date().toISOString();
    for (const object of project.scene.objects as Json[]) {
      const patch = template.objectsById[object.id];
      if (patch) Object.assign(object, structuredClone(patch));
      if (object.id === "ball") {
        object.acousticRole = "none";
        object.acousticMaterialId = "material.hard";
      }
    }
    project.scene.listener.positionM = [...template.listenerPositionM];
    project.scene.listener.attachment = "independent";
    project.scene.zones = structuredClone(template.sceneZones);
    project.scene.sources = [];
    project.soundBehaviors = structuredClone(template.soundBehaviors);
    project.assets = [];
    project.recordings = [];
    delete project.activeRecordingId;
    delete project.editorMetadata;
    const fixtureBytes = Buffer.from(JSON.stringify(project, null, 2) + "\n");
    const fixturePath = join(cache, "combined-ui-project-fixture.json");
    await writeFile(fixturePath, fixtureBytes);
    receipt.stages.push({
      kind: "fresh-ui-export-and-pure-data-fixture",
      base: base.item,
      fixturePath,
      fixtureSha256: sha(fixtureBytes),
      contractSha256: sha(contractBytes),
      configuredByNormalUIProjectImport: [
        "body mode/positions",
        "zone",
        "oscillators",
        "nonlinear mapping",
      ],
      authoredAfterImportThroughUI: [
        "acoustic role dynamicReflector",
        "material.metal",
        "Motion last",
      ],
      noSampleAssets: true,
    });
    await page.getByRole("button", { name: "匯入專案 JSON", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "匯入專案 JSON", exact: true });
    await dialog.getByLabel("選擇專案 JSON 檔案", { exact: true }).setInputFiles({
      name: "combined.project.json",
      mimeType: "application/json",
      buffer: fixtureBytes,
    });
    const preview = dialog.getByRole("region", { name: "專案匯入預覽", exact: true });
    await expect(preview).toContainText(project.name);
    await expect(dialog.getByRole("button", { name: "套用並開啟專案", exact: true })).toBeEnabled();
    receipt.stages.push({ kind: "project-import-preview", text: await preview.innerText() });
    await page.screenshot({ path: join(evidence, "01-import-preview.png"), fullPage: true });
    await dialog.getByRole("button", { name: "套用並開啟專案", exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(page.locator(".project-name strong")).toHaveText(project.name);
    const gain = page.getByRole("slider", { name: "監聽音量", exact: true });
    await gain.press("Home");
    await expect(gain).toHaveValue("-40");
    await expect(page.getByRole("button", { name: "啟用聆聽", exact: true })).toBeVisible();
    await page
      .locator(".object-row")
      .filter({ has: page.locator('[title="ball"]') })
      .click();
    const inspector = page.locator(".inspector");
    await expect(inspector.getByRole("combobox", { name: "剛體模式", exact: true })).toHaveValue(
      "dynamicNoGravity",
    );
    const role = inspector.getByRole("combobox", { name: "聲學角色", exact: true });
    await expect(role).toBeEnabled();
    const publishedRevision = page.locator(".project-name").getByText(/場景版本/);
    const beforeRoleRevision = await publishedRevision.innerText();
    await role.selectOption("dynamicReflector");
    await expect(publishedRevision).not.toHaveText(beforeRoleRevision);
    await expect(role).toHaveValue("dynamicReflector");
    const material = inspector.getByRole("combobox", { name: "聲學材質", exact: true });
    await expect(material).toBeEnabled();
    const beforeMaterialRevision = await publishedRevision.innerText();
    await material.selectOption("material.metal");
    await expect(publishedRevision).not.toHaveText(beforeMaterialRevision);
    await expect(material).toHaveValue("material.metal");
    const rule = page.locator(".behavior-card").filter({
      has: page.locator(".rule-identity code").filter({ hasText: /^rule\.pipeline-always$/ }),
    });
    const mapping = rule.locator(".mapping-card");
    await expect(
      mapping.getByRole("combobox", { name: "映射輸入 metric", exact: true }),
    ).toHaveValue("sourceSpeedMetresPerSecond");
    for (const [name, value] of [
      ["曲線點 1 x", "0"],
      ["曲線點 1 y", "0"],
      ["曲線點 2 x", "0.5"],
      ["曲線點 2 y", "0.25"],
      ["曲線點 3 x", "1"],
      ["曲線點 3 y", "1"],
    ])
      await expect(mapping.getByRole("spinbutton", { name: name!, exact: true })).toHaveValue(
        value!,
      );
    receipt.stages.push({
      kind: "curved-role-and-mapping-dom",
      inspector: await inspector.innerText(),
      mapping: await mapping.innerText(),
    });
    await page.screenshot({ path: join(evidence, "02-curved-role-and-curve.png"), fullPage: true });
    await page.getByRole("tab", { name: /^區域/ }).click();
    const zones = page.locator(".zone-panel");
    await zones.getByRole("button", { name: "編輯 管線跨界區域", exact: true }).click();
    const zoneForm = zones.locator("form");
    await expect(zoneForm.getByRole("textbox", { name: "區域 ID", exact: true })).toHaveValue(
      "zone.pipeline",
    );
    for (const [label, value] of [
      ["中心位置 X", "0.2"],
      ["中心位置 Y", "2"],
      ["中心位置 Z", "0"],
      ["半尺寸 X", "0.4"],
      ["半尺寸 Y", "0.5"],
      ["半尺寸 Z", "0.5"],
      ["邊界遲滯", "0.05"],
    ])
      await expect(
        zoneForm.getByRole("spinbutton", { name: new RegExp("^" + label + "\\s*m$") }),
      ).toHaveValue(value!);
    receipt.stages.push({ kind: "imported-zone-dom", text: await zones.innerText() });
    await zones.getByRole("button", { name: "取消草稿", exact: true }).click();
    await page.getByRole("tab", { name: "動作", exact: true }).click();
    const motion = page.locator(".motion-panel");
    const rebase = motion.getByRole("button", { name: "重新綁定目前場景", exact: true });
    if (await rebase.isEnabled()) await rebase.click();
    await motion
      .getByRole("textbox", { name: "動作 ID", exact: true })
      .fill("motion.pipeline.pass");
    await motion.getByRole("combobox", { name: "動作種類", exact: true }).selectOption("moveTo");
    const target = motion
      .locator("fieldset.vector-fields")
      .filter({ has: page.locator("legend").filter({ hasText: /^目標位置/ }) });
    for (const [axis, value] of [
      ["X", "2.5"],
      ["Y", "2"],
      ["Z", "0"],
    ]) {
      const input = target.getByRole("spinbutton", { name: axis!, exact: true });
      await input.fill(value!);
      await input.press("Enter");
    }
    for (const [name, value] of [
      ["最大速度 m/s", "1.5"],
      ["動態控制最大加速度 m/s²", "12"],
      ["最大衝量 N·s", "10"],
      ["逾時 s", "10"],
    ]) {
      const input = motion.getByRole("spinbutton", { name: name!, exact: true });
      await input.fill(value!);
      await input.press("Enter");
    }
    await motion.getByRole("button", { name: "儲存動作", exact: true }).click();
    const action = motion.locator(".motion-actions li").filter({ hasText: "motion.pipeline.pass" });
    await expect(action).toBeVisible();
    receipt.stages.push({ kind: "motion-authored-last", text: await action.innerText() });
    await page.screenshot({ path: join(evidence, "03-motion-ready.png"), fullPage: true });
    const authoredProject = await download(
      page.getByRole("button", { name: "匯出專案", exact: true }),
      "final-authored-ui-project",
    );
    receipt.stages.push({
      kind: "final-authored-ui-project-export",
      actualUiDownload: authoredProject.item,
      note: "Read-only normal project export after role/material/Zone/curve/Motion authoring, before starting Motion",
    });
    await action.getByRole("button", { name: "執行", exact: true }).press("Enter");
    await page
      .getByLabel("模擬控制", { exact: true })
      .getByRole("button", { name: "暫停", exact: true })
      .press("Enter");
    receipt.stages.push({
      kind: "run-then-immediate-pause",
      atUtc: new Date().toISOString(),
      text: await action.innerText(),
      note: "Actual keyboard controls; no target wait before capture",
    });
    await page.getByRole("tab", { name: "音訊匯出", exact: true }).click();
    const renderPanel = page.locator(".render-panel");
    await renderPanel.getByRole("button", { name: "錄製3秒", exact: true }).click();
    await expect(renderPanel.getByRole("button", { name: "產生音檔", exact: true })).toBeEnabled({
      timeout: 60_000,
    });
    await page.getByRole("tab", { name: /^事件與錄放/ }).click();
    const recordingPanel = page.getByRole("tabpanel", { name: /^事件與錄放/ });
    await expect(
      recordingPanel.getByRole("button", { name: "OnEnterZone", exact: true }).first(),
    ).toBeVisible();
    await expect(
      recordingPanel.getByRole("button", { name: "OnExitZone", exact: true }).first(),
    ).toBeVisible();
    receipt.stages.push({ kind: "actual-zone-events-dom", text: await recordingPanel.innerText() });
    const recorded = await download(
      recordingPanel.getByRole("button", { name: "匯出已封存錄製", exact: true }),
      "recorded-zone-curve-moving-reflector",
    );
    const recording = JSON.parse(recorded.bytes.toString("utf8"));
    const proof = inspectRecording(recording);
    receipt.recordingProof = proof;
    await writeFile(join(evidence, "recording-proof.json"), JSON.stringify(proof, null, 2) + "\n");
    await page.screenshot({ path: join(evidence, "04-zone-events.png"), fullPage: true });
    await page.getByRole("tab", { name: "音訊匯出", exact: true }).click();
    const tail = renderPanel.getByRole("spinbutton", { name: "保留尾響 s", exact: true });
    await tail.fill("2");
    await tail.press("Enter");
    await renderPanel.getByRole("checkbox", { name: "各聲源分軌", exact: true }).check();
    await renderPanel.getByRole("button", { name: "產生音檔", exact: true }).press("Enter");
    await expect(renderPanel.getByText("可下載", { exact: true })).toBeVisible({ timeout: 90_000 });
    const buttons = renderPanel.locator(".render-output-list button");
    await expect(buttons).toHaveCount(5);
    const wavs = [];
    for (let index = 0; index < (await buttons.count()); index++) {
      const button = buttons.nth(index);
      const stableId = (await button.getAttribute("aria-label"))!.replace(/^下載\s+/, "");
      wavs.push(await download(button, stableId));
    }
    const manifestDownload = await download(
      renderPanel.getByRole("button", { name: "下載來源與雜湊清單", exact: true }),
      "manifest",
    );
    const manifest = JSON.parse(manifestDownload.bytes.toString("utf8"));
    receipt.renderSummary = {
      jobId: manifest.job.jobId,
      window: manifest.job.window,
      outputs: manifest.job.outputs,
      master: manifest.configuration.master,
    };
    expect(manifest.job.outputs).toHaveLength(5);
    expect(manifest.job.window.tailFrames).toBe(96000);
    expect(manifest.configuration.master.monitorGain).toBeCloseTo(0.01, 12);
    for (const file of manifest.files as Json[]) {
      const actual = wavs.find((downloaded) => downloaded.item.filename === file.filename);
      expect(actual).toBeTruthy();
      expect(actual!.item.sha256).toBe(file.sha256.replace(/^sha256:/, ""));
      const stats = (actual!.item as { wav: ReturnType<typeof wavStats> }).wav;
      expect(stats.header).toBe(true);
      expect(stats.format).toBe(3);
      expect(stats.rate).toBe(48000);
      expect(stats.channels).toBe(2);
      expect(stats.bits).toBe(32);
      expect(stats.durationS).toBe(5);
      expect(stats.nonfinite).toBe(0);
      expect(stats.peak).toBeGreaterThan(0);
    }
    await page.screenshot({
      path: join(evidence, "05-individual-wav-exports.png"),
      fullPage: true,
    });
    for (const [name, passed] of Object.entries(proof.invariants)) expect(passed, name).toBe(true);
    expect(receipt.agentRequests).toEqual([]);
    expect(receipt.blockedRequests).toEqual([]);
    expect(receipt.pageErrors).toEqual([]);
    expect(receipt.dialogs).toEqual([]);
    receipt.status = "PASS";
  } catch (error) {
    receipt.status = "FAIL";
    receipt.error = error instanceof Error ? error.stack : String(error);
    receipt.failureDom = await page
      .locator("body")
      .innerText()
      .catch(() => "");
    await page.screenshot({ path: join(evidence, "failure.png"), fullPage: true }).catch(() => {});
    throw error;
  } finally {
    await Promise.allSettled(tasks);
    receipt.finishedAtUtc = new Date().toISOString();
    await writeFile(
      join(evidence, "combined-receipt.json"),
      JSON.stringify(receipt, null, 2) + "\n",
    );
  }
});
