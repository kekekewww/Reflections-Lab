import { test as base, expect, type Locator, type Page } from "@playwright/test";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve, relative, join, isAbsolute, sep } from "node:path";
import { execFileSync } from "node:child_process";
import { byteSha256 } from "./s4-evidence.js";
import { guardBrowser } from "./s4-browser-guard.mjs";

interface Freeze {
  schemaVersion: 1;
  sourceCommit: string;
  browserExecutable: string;
  browserExecutableSha256: string;
  browserVersion: string;
  htmlSha256: string;
  entry: { path: string; sha256: string };
  assets: { path: string; sha256: string }[];
  sourcePins: { path: string; sha256: string }[];
}
export interface S4Evidence {
  cover(scenarioId: string, step: string, evidence?: unknown): void;
  snapshot(label: string, scope?: Locator): Promise<void>;
  download(
    button: Locator,
    label: string,
  ): Promise<{ bytes: Buffer; path: string; filename: string; sha256: string }>;
  attach(label: string, evidence: unknown): void;
  newPage(): Promise<Page>;
  closePage(page: Page, reason: string): Promise<void>;
}
const safe = (text: string) => text.replace(/[^A-Za-z0-9_.-]/g, "-").slice(0, 120);

export const test = base.extend<{ s4: S4Evidence }>({
  s4: [
    async ({ page, context, browser }, use, info) => {
      const root = process.cwd(),
        outRoot = resolve(process.env.S4_OUTPUT_ROOT!);
      const outputRelative = relative(root, outRoot);
      if (
        !outputRelative ||
        isAbsolute(outputRelative) ||
        outputRelative === ".." ||
        outputRelative.startsWith(".." + sep)
      )
        throw new Error("S4_OUTPUT_OUTSIDE_WORKSPACE");
      const freezeBytes = await readFile(process.env.S4_FREEZE_PATH!);
      const freeze = JSON.parse(freezeBytes.toString("utf8")) as Freeze;
      expect(freeze.schemaVersion).toBe(1);
      const registryPath = "docs/16-nonadvanced-completion/lanes/ui/s4/CURRENT_UI_PLAN.json";
      const registryBytes = await readFile(resolve(root, registryPath));
      expect(byteSha256(registryBytes)).toBe(
        freeze.sourcePins.find((pin) => pin.path === registryPath)?.sha256,
      );
      const registry = JSON.parse(registryBytes.toString("utf8")) as {
        rows: { id: string; currentBrowserStatus: string }[];
      };
      const currentIds = new Set(
        registry.rows
          .filter((row) => row.currentBrowserStatus !== "SUPERSEDED_REMOVED")
          .map((row) => row.id),
      );
      expect(browser.version()).toBe(freeze.browserVersion);
      expect(byteSha256(await readFile(freeze.browserExecutable))).toBe(
        freeze.browserExecutableSha256,
      );
      const observedHead = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
      expect(observedHead).toBe(freeze.sourceCommit);
      const caseDirectory = join(
        outRoot,
        "cases",
        `${safe(info.title)}-${byteSha256(info.testId).slice(0, 10)}-r${info.retry}`,
      );
      await mkdir(join(outRoot, "cases"), { recursive: true });
      await mkdir(caseDirectory, { recursive: false });
      await mkdir(join(caseDirectory, "downloads"));
      const pinMap = new Map(freeze.assets.map((asset) => [asset.path, asset.sha256]));
      pinMap.set(freeze.entry.path, freeze.entry.sha256);
      const record = {
        schemaVersion: 1,
        kind: "CURRENT_PRODUCTION_DOM_S4_CASE",
        title: info.title,
        sourceCommit: freeze.sourceCommit,
        observedHead,
        freezeSha256: byteSha256(freezeBytes),
        browserVersion: browser.version(),
        browserExecutable: freeze.browserExecutable,
        browserExecutableSha256: freeze.browserExecutableSha256,
        method:
          "Production DOM pointer/keyboard, genuine browser downloads; no runtime/controller bridge.",
        viewport: { width: 1600, height: 1100, deviceScaleFactor: 1 },
        startedAt: new Date().toISOString(),
        finishedAt: "",
        status: "RUNNING",
        scenarioSteps: [] as { scenarioId: string; step: string; evidence: unknown }[],
        snapshots: [] as unknown[],
        artifacts: [] as unknown[],
        downloads: [] as unknown[],
        loadedAssets: [] as unknown[],
        blockedRequests: [] as string[],
        pageErrors: [] as string[],
        failures: [] as string[],
        notClaimed: [
          "native Computer Use",
          "native OS IME",
          "hardware hearing or SPL",
          "formal performance",
          "fullDSPreference",
          "all scenario combinations",
          "historical217currentPASS",
        ],
      };
      const publicGuard = await guardBrowser(browser, {
        outputDirectory: process.env.S4_LANE_OUTPUT ?? outRoot,
      });
      await publicGuard.registerContext(context);
      const reads: Promise<void>[] = [];
      const expectedClosedPages = new WeakSet<Page>();
      let entryObserved = false,
        downloadNumber = 0;
      context.on("page", (child) =>
        child.on("pageerror", (error) => record.pageErrors.push(error.message)),
      );
      page.on("pageerror", (error) => record.pageErrors.push(error.message));
      await context.route("**/*", async (route) => {
        const request = route.request(),
          url = new URL(request.url());
        if (
          (/^https?:$/.test(url.protocol) && url.origin !== "http://127.0.0.1:4173") ||
          (request.method() !== "GET" && url.pathname.startsWith("/api/agent/"))
        ) {
          record.blockedRequests.push(`${request.method()} ${url.href}`);
          await route.abort("blockedbyclient");
        } else await route.continue();
      });
      context.on("response", (response) => {
        const url = new URL(response.url());
        if (
          url.origin !== "http://127.0.0.1:4173" ||
          !(url.pathname === "/" || /\.(?:js|css)$/.test(url.pathname))
        )
          return;
        reads.push(
          response
            .body()
            .then((bytes) => {
              const actual = byteSha256(bytes),
                expected = url.pathname === "/" ? freeze.htmlSha256 : pinMap.get(url.pathname);
              record.loadedAssets.push({
                path: url.pathname,
                bytes: bytes.length,
                sha256: actual,
                expected: expected ?? null,
              });
              if (!expected || actual !== expected)
                record.failures.push(`S4_ASSET_PIN_MISMATCH:${url.pathname}`);
              if (url.pathname === freeze.entry.path && actual === freeze.entry.sha256)
                entryObserved = true;
            })
            .catch((error) => {
              let expectedClose = false;
              try {
                expectedClose = expectedClosedPages.has(response.frame().page());
              } catch {
                /* A worker has no page frame. */
              }
              if (expectedClose)
                record.artifacts.push({
                  label: "expected-document-unload-asset-read",
                  path: url.pathname,
                  error: String(error),
                });
              else record.failures.push(`S4_ASSET_READ_FAILED:${url.pathname}:${String(error)}`);
            }),
        );
      });
      const receiptPath = join(caseDirectory, "receipt.json");
      const persist = () => writeFile(receiptPath, JSON.stringify(record, null, 2) + "\n");
      await persist();
      const evidence: S4Evidence = {
        cover(scenarioId, step, data = null) {
          if (!currentIds.has(scenarioId)) throw new Error(`S4_UNKNOWN_SCENARIO:${scenarioId}`);
          record.scenarioSteps.push({ scenarioId, step, evidence: data });
        },
        async snapshot(label, scope = page.locator("body")) {
          const dom = await scope.evaluate((element) => ({
            text: (element as HTMLElement).innerText,
            controls: Array.from(
              element.querySelectorAll("button,input,select,summary,[role=tab]"),
              (control) => {
                const input = control as HTMLInputElement;
                return {
                  tag: control.tagName,
                  label: control.getAttribute("aria-label") ?? control.textContent?.trim(),
                  type: input.type ?? null,
                  value: input.type === "password" ? "REDACTED" : (input.value ?? null),
                  disabled: input.disabled ?? null,
                  ariaInvalid: control.getAttribute("aria-invalid"),
                  describedBy: control.getAttribute("aria-describedby"),
                  min: input.min ?? null,
                  max: input.max ?? null,
                  step: input.step ?? null,
                };
              },
            ),
          }));
          const filename = `${String(record.snapshots.length + 1).padStart(3, "0")}-${safe(label)}.png`;
          await scope.page().screenshot({ path: join(caseDirectory, filename), fullPage: true });
          record.snapshots.push({
            label,
            screenshot: filename,
            dom,
            interpretation: "Screenshot captured; independent visual inspection remains separate.",
          });
          await persist();
        },
        async download(button, label) {
          const pending = button.page().waitForEvent("download", { timeout: 60_000 });
          await button.click();
          const download = await pending;
          const filename = download.suggestedFilename();
          const path = join(
            caseDirectory,
            "downloads",
            `${String(++downloadNumber).padStart(3, "0")}-${safe(label)}-${safe(filename)}`,
          );
          await download.saveAs(path);
          const bytes = await readFile(path),
            sha256 = byteSha256(bytes);
          record.downloads.push({
            label,
            filename,
            path: relative(root, path),
            bytes: bytes.length,
            sha256,
          });
          await persist();
          return { bytes, path, filename, sha256 };
        },
        attach(label, data) {
          record.artifacts.push({ label, evidence: data });
        },
        newPage: () => context.newPage(),
        async closePage(target, reason) {
          expectedClosedPages.add(target);
          record.artifacts.push({
            label: "controlled-document-close",
            reason,
            processCrashClaimed: false,
          });
          await target.close();
        },
      };
      try {
        await use(evidence);
      } catch (error) {
        record.failures.push(String(error));
        throw error;
      } finally {
        await Promise.allSettled(reads);
        try {
          await publicGuard.flush();
        } catch (error) {
          record.failures.push(String(error));
        }
        if (!entryObserved) record.failures.push("S4_FROZEN_ENTRY_NOT_OBSERVED");
        if (record.pageErrors.length) record.failures.push("S4_UNEXPECTED_PAGE_ERROR");
        record.finishedAt = new Date().toISOString();
        record.status =
          info.status === info.expectedStatus && record.failures.length === 0
            ? "SCOPED_CASE_PASS"
            : "FAIL";
        await persist();
        await info.attach("s4-production-case-receipt", {
          path: receiptPath,
          contentType: "application/json",
        });
        expect(record.failures, "S4 actual source/browser/assets and page execution").toEqual([]);
      }
    },
    { auto: true },
  ],
});
export { expect };
