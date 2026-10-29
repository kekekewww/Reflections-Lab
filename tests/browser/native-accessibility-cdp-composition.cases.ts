import { expect, test, type Page } from "@playwright/test";

type App = {
  getSceneDocument(): unknown;
  getBehaviorDocument(): unknown;
  getSnapshot(): {
    tick: number;
    simulationState: string;
    interactionMode: string;
    events: { type: string; ruleId?: string }[];
  };
};
type CompositionRecord = {
  type: string;
  isTrusted: boolean;
  data: string | null;
  inputType: string | null;
  isComposing: boolean | null;
  value: string;
  selectionStart: number | null;
  selectionEnd: number | null;
};
async function state(page: Page) {
  return page.evaluate(() => {
    const app = (window as unknown as { __reflectionLab: App }).__reflectionLab;
    return {
      scene: app.getSceneDocument(),
      behavior: app.getBehaviorDocument(),
      view: app.getSnapshot(),
    };
  });
}

test("CDP browser IME candidate update, commit and cancel preserve app input ownership", async ({
  page,
  browser,
}, info) => {
  const evidence: {
    schemaVersion: number;
    status: "IN_PROGRESS" | "PASS" | "FAIL" | "NOT_RUN";
    evidenceClass: string;
    browserVersion: string;
    protocolReferences: string[];
    commands: { method: string; parameters: unknown; phase: string; result: string }[];
    events: CompositionRecord[];
    error?: string;
    before?: unknown;
    after?: unknown;
    candidateValues: string[];
    pageErrors: string[];
    limitations: string[];
  } = {
    schemaVersion: 1,
    status: "IN_PROGRESS",
    evidenceClass:
      "CDP_BROWSER_WIDGET_COMPOSITION; not JavaScript CompositionEvent fixture; not Windows OS IME",
    browserVersion: browser.version(),
    protocolReferences: [
      "https://chromedevtools.github.io/devtools-protocol/tot/Input/#method-imeSetComposition",
      "https://chromedevtools.github.io/devtools-protocol/tot/Input/#method-insertText",
      "https://chromium.googlesource.com/chromium/src/+/master/content/browser/devtools/protocol/input_handler.cc",
    ],
    commands: [],
    events: [],
    candidateValues: [],
    pageErrors: [],
    limitations: [
      "CDP controls Chromium's focused widget composition pipeline; it does not operate an OS IME candidate window or validate a physical keyboard/input locale.",
      "Input.imeSetComposition is experimental. Unsupported method is NOT_RUN with its actual protocol error; no synthetic fallback is used.",
      "The focused field is the real event-filter input. Its focus first exits Pointer Lock; no claim that an uneditable canvas hosts an OS IME.",
    ],
  };
  page.on("pageerror", (error) => evidence.pageErrors.push(error.message));
  await page.goto("/");
  await expect(page.getByRole("button", { name: "開始運算", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "進入第一人稱", exact: true }).click();
  await expect.poll(() => page.evaluate(() => document.pointerLockElement?.tagName)).toBe("CANVAS");
  await page.keyboard.press("Enter");
  await expect.poll(async () => (await state(page)).view.simulationState).toBe("running");

  const input = page.getByRole("searchbox", { name: "篩選事件", exact: true });
  await input.focus();
  await expect.poll(() => page.evaluate(() => document.pointerLockElement === null)).toBe(true);
  await expect.poll(async () => (await state(page)).view.simulationState).toBe("paused");
  await input.fill("");
  await input.evaluate((element) => {
    const events: CompositionRecord[] = [];
    const capture = { events, truncated: false };
    (window as unknown as { __cdpCompositionEvidence: typeof capture }).__cdpCompositionEvidence =
      capture;
    for (const type of [
      "compositionstart",
      "compositionupdate",
      "compositionend",
      "beforeinput",
      "input",
    ]) {
      element.addEventListener(type, (event) => {
        if (events.length >= 128) {
          capture.truncated = true;
          return;
        }
        const inputEvent = event as InputEvent;
        const target = element as HTMLInputElement;
        events.push({
          type: event.type,
          isTrusted: event.isTrusted,
          data: typeof inputEvent.data === "string" ? inputEvent.data : null,
          inputType: typeof inputEvent.inputType === "string" ? inputEvent.inputType : null,
          isComposing: typeof inputEvent.isComposing === "boolean" ? inputEvent.isComposing : null,
          value: target.value,
          selectionStart: target.selectionStart,
          selectionEnd: target.selectionEnd,
        });
      });
    }
  });
  const before = await state(page);
  evidence.before = before;
  const session = await page.context().newCDPSession(page);
  let supported = false;
  let compositionActive = false;
  const setComposition = async (
    text: string,
    selection: number,
    phase: string,
    replacement?: { start: number; end: number },
  ) => {
    const parameters = {
      text,
      selectionStart: selection,
      selectionEnd: selection,
      ...(replacement
        ? { replacementStart: replacement.start, replacementEnd: replacement.end }
        : {}),
    };
    const command = { method: "Input.imeSetComposition", parameters, phase, result: "PENDING" };
    evidence.commands.push(command);
    try {
      await session.send("Input.imeSetComposition", parameters);
      command.result = "OK";
      supported = true;
      compositionActive = text !== "";
    } catch (error) {
      command.result = "ERROR";
      throw error;
    }
  };
  try {
    await setComposition("中", 1, "candidate-start");
    await expect(input).toHaveValue("中");
    evidence.candidateValues.push(await input.inputValue());
    await setComposition("中文", 2, "candidate-update");
    await expect(input).toHaveValue("中文");
    evidence.candidateValues.push(await input.inputValue());
    let capture = await page.evaluate(
      () =>
        (
          window as unknown as {
            __cdpCompositionEvidence: { events: CompositionRecord[]; truncated: boolean };
          }
        ).__cdpCompositionEvidence,
    );
    expect(capture.truncated).toBe(false);
    expect(capture.events.filter((event) => event.type === "compositionstart")).toHaveLength(1);
    expect(
      capture.events
        .filter((event) => event.type === "compositionupdate")
        .map((event) => event.data),
    ).toEqual(["中", "中文"]);
    expect(
      capture.events
        .filter((event) => event.type.startsWith("composition"))
        .every((event) => event.isTrusted),
    ).toBe(true);
    expect(
      capture.events.some(
        (event) => event.type === "input" && event.isComposing === true && event.isTrusted,
      ),
    ).toBe(true);

    // The installed protocol has no Input.imeCommitComposition command. Chromium's
    // InputHandler::InsertText uses ImeCommitText, so exercise that real commit path.
    evidence.commands.push({
      method: "Input.insertText",
      parameters: { text: "中文" },
      phase: "commit",
      result: "PENDING",
    });
    await session.send("Input.insertText", { text: "中文" });
    evidence.commands.at(-1)!.result = "OK";
    compositionActive = false;
    await expect(input).toHaveValue("中文");
    capture = await page.evaluate(
      () =>
        (
          window as unknown as {
            __cdpCompositionEvidence: { events: CompositionRecord[]; truncated: boolean };
          }
        ).__cdpCompositionEvidence,
    );
    expect(
      capture.events.filter((event) => event.type === "compositionend").map((event) => event.data),
    ).toEqual(["中文"]);

    await input.evaluate((element) => {
      const target = element as HTMLInputElement;
      target.setSelectionRange(target.value.length, target.value.length);
    });
    await setComposition("取消", 2, "candidate-to-cancel", { start: 2, end: 2 });
    await expect(input).toHaveValue("中文取消");
    evidence.candidateValues.push(await input.inputValue());
    await setComposition("", 0, "cancel");
    await expect(input).toHaveValue("中文");
    evidence.candidateValues.push(await input.inputValue());
    await page.keyboard.press("e");
    await page.keyboard.press("b");
    await expect(input).toHaveValue("中文eb");
    const after = await state(page);
    evidence.after = after;
    expect(after.scene).toEqual(before.scene);
    expect(after.behavior).toEqual(before.behavior);
    expect(after.view.simulationState).toBe("paused");
    expect(after.view.tick).toBe(before.view.tick);
    expect(after.view.interactionMode).toBe(before.view.interactionMode);
    expect(after.view.events).toEqual(before.view.events);
    capture = await page.evaluate(
      () =>
        (
          window as unknown as {
            __cdpCompositionEvidence: { events: CompositionRecord[]; truncated: boolean };
          }
        ).__cdpCompositionEvidence,
    );
    expect(capture.truncated).toBe(false);
    const compositions = capture.events.filter((event) => event.type.startsWith("composition"));
    expect(compositions.every((event) => event.isTrusted)).toBe(true);
    expect(compositions.filter((event) => event.type === "compositionstart")).toHaveLength(2);
    expect(compositions.filter((event) => event.type === "compositionend")).toHaveLength(2);
    evidence.events = capture.events;
    expect(evidence.pageErrors).toEqual([]);
    await page.screenshot({ path: info.outputPath("cdp-browser-composition.png") });
    evidence.status = "PASS";
  } catch (error) {
    evidence.error = error instanceof Error ? error.message : String(error);
    const methodUnavailable =
      !supported &&
      /Input\.imeSetComposition[^\n]*(?:wasn't found|not found|does not exist)/i.test(
        evidence.error,
      );
    evidence.status = methodUnavailable ? "NOT_RUN" : "FAIL";
    if (methodUnavailable)
      test.skip(
        true,
        "Browser does not expose Input.imeSetComposition; actual error retained, no synthetic fallback.",
      );
    throw error;
  } finally {
    if (compositionActive) {
      try {
        await setComposition("", 0, "failure-cleanup");
      } catch (error) {
        evidence.commands.push({
          method: "Input.imeSetComposition",
          parameters: { text: "" },
          phase: "failure-cleanup",
          result: error instanceof Error ? error.message : String(error),
        });
      }
    }
    if (evidence.status !== "PASS") {
      try {
        evidence.events = await page.evaluate(
          () =>
            (window as unknown as { __cdpCompositionEvidence: { events: CompositionRecord[] } })
              .__cdpCompositionEvidence.events,
        );
      } catch {
        /* Playwright's primary failure remains the authority. */
      }
    }
    try {
      await session.detach();
    } catch (error) {
      evidence.status = "FAIL";
      evidence.error = `CDP detach failed: ${String(error)}`;
      throw error;
    } finally {
      await info.attach("cdp-browser-composition-evidence.json", {
        body: JSON.stringify(evidence, null, 2),
        contentType: "application/json",
      });
    }
  }
});
