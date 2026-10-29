import test, { after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer, loadConfigFromFile, resolveConfig } from "vite";

const root = fileURLToPath(new URL("../../", import.meta.url));
const cacheRoot = path.join(root, ".cache/v1/vite-dev-policy-tests-20261028");
await mkdir(cacheRoot, { recursive: true });
const evidenceRoot = await mkdtemp(path.join(cacheRoot, "fixture-run-"));
const evidence = { scope: "Node/Vite fixture only; no browser or real credentials", fixtures: [] };
const configs = [
  ["main", "vite.config.ts", 5173],
  ["physics", "tests/browser/physics-lifecycle.vite.config.ts", 5176],
  ["persistence", "tests/browser/persistence.vite.config.ts", 5178],
];
const physicsIncludes = [
  "react",
  "react-dom/client",
  "react/jsx-runtime",
  "@react-three/fiber",
  "three",
  "@dimforge/rapier3d-compat",
];

after(async () => {
  await writeFile(
    path.join(evidenceRoot, "fixture-evidence.json"),
    JSON.stringify(evidence, null, 2),
  );
});

async function load(relative) {
  // Vite's runner loads the real TS config and its .js -> .ts imports without
  // a copied config, an extra Node loader, or bundle-loader temporary files.
  const loaded = await loadConfigFromFile(
    { command: "serve", mode: "test", isSsrBuild: false, isPreview: false },
    path.join(root, relative),
    root,
    "silent",
    undefined,
    "runner",
  );
  assert.ok(loaded, `Vite loaded ${relative}`);
  return loaded.config;
}

async function bounded(operation, label, milliseconds = 8_000) {
  let timeout;
  try {
    return await Promise.race([
      operation,
      new Promise((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error(`${label} exceeded ${milliseconds}ms`)),
          milliseconds,
        );
      }),
    ]);
  } finally {
    clearTimeout(timeout);
  }
}

async function exerciseFixture(name, actual, unsafeDefaultControl = false) {
  const fixtureRoot = path.join(evidenceRoot, name);
  const extension = "test-results/device-hearing-profiles/Fake/Extensions/example/extension.html";
  const fakePrivateName = "fixture api key.txt";
  const fakePrivateBody = "FAKE_FIXTURE_CREDENTIAL_SENTINEL_NO_REAL_KEY";
  const publicBody = "ordinary fixture file";
  for (const [relative, content] of [
    ["index.html", '<!doctype html><script type="module" src="/src/main.js"></script>'],
    ["src/main.js", 'import "react"; export const fixture = true;'],
    [extension, '<!doctype html><script type="module">import "chrome";</script>'],
    [".gitignore", "test-results/\n"],
    [fakePrivateName, fakePrivateBody],
    ["ordinary.txt", publicBody],
  ]) {
    const file = path.join(fixtureRoot, relative);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, content);
  }
  const logs = [];
  const scanImports = [];
  const logger = {
    info(message) {
      logs.push({ level: "info", message });
    },
    warn(message) {
      logs.push({ level: "warn", message });
    },
    warnOnce(message) {
      logs.push({ level: "warn", message });
    },
    error(message) {
      logs.push({ level: "error", message });
    },
    clearScreen() {},
    hasErrorLogged() {
      return false;
    },
    hasWarned: false,
  };
  const optimizeDeps = { ...actual.optimizeDeps };
  if (unsafeDefaultControl) delete optimizeDeps.entries;
  const record = {
    name,
    unsafeDefaultControl,
    fakeFilesOnly: true,
    optimizeDeps,
    logs,
    scanImports,
    port: null,
    serverClosed: false,
    httpServerListeningAfterClose: null,
  };
  evidence.fixtures.push(record);
  // The tested entries, include list, and deny rules come from the actual
  // config. Only fixture location, loopback port and external routing change.
  const server = await createServer({
    ...actual,
    configFile: false,
    envFile: false,
    root: fixtureRoot,
    cacheDir: path.join(fixtureRoot, ".vite-cache"),
    customLogger: logger,
    optimizeDeps,
    plugins: [
      ...(actual.plugins ?? []),
      {
        name: "fixture-scan-observer",
        enforce: "pre",
        resolveId(id, importer, options) {
          if (options?.scan) {
            scanImports.push({
              id,
              importer: importer ? path.relative(fixtureRoot, importer) : null,
            });
          }
        },
      },
    ],
    server: {
      ...actual.server,
      host: "127.0.0.1",
      port: 0,
      strictPort: false,
      open: false,
      hmr: false,
      proxy: undefined,
      fs: {
        ...actual.server?.fs,
        strict: true,
        allow: [fixtureRoot, path.join(root, "node_modules")],
      },
    },
  });
  try {
    await bounded(server.listen(), `${name}: listen`);
    const address = server.httpServer.address();
    assert.ok(address && typeof address === "object");
    record.port = address.port;
    const optimizer = server.environments.client.depsOptimizer;
    assert.ok(optimizer, "the real dependency optimizer remains enabled");
    await bounded(optimizer.init(), `${name}: optimizer init`);
    await bounded(optimizer.scanProcessing, `${name}: dependency scan`);
    record.optimizerInitState = optimizer.initState;
    record.discoveredDependencies = [
      ...Object.keys(optimizer.metadata.discovered),
      ...Object.keys(optimizer.metadata.optimized),
    ];
    record.scanErrors = logs.filter((entry) => entry.level === "error");
    for (const relative of ["ordinary.txt", fakePrivateName]) {
      const response = await fetch(
        `http://127.0.0.1:${address.port}/${encodeURIComponent(relative)}`,
        {
          signal: AbortSignal.timeout(2_000),
        },
      );
      const body = await response.text();
      record[relative] = {
        status: response.status,
        containsFixturePrivateSentinel: body.includes(fakePrivateBody),
        matchesPublicBody: body === publicBody,
      };
    }
  } finally {
    await bounded(server.close(), `${name}: server close`);
    record.serverClosed = true;
    record.httpServerListeningAfterClose = server.httpServer.listening;
  }
  return record;
}

for (const [name, relative, port] of configs) {
  test(`${name}: resolve the actual dev config and preserve its runtime contract`, async (t) => {
    const actual = await load(relative);
    const resolved = await resolveConfig(
      { ...actual, root, configFile: false, envFile: false, logLevel: "silent" },
      "serve",
    );
    await t.test("dependency discovery is explicitly limited to the application HTML", () => {
      assert.deepEqual(resolved.optimizeDeps.entries, ["index.html"]);
      assert.notEqual(resolved.optimizeDeps.noDiscovery, true);
    });
    await t.test(
      "loopback port, build target, and executor-specific settings remain intact",
      () => {
        assert.equal(resolved.server.host, "127.0.0.1");
        assert.equal(resolved.server.port, port);
        assert.equal(resolved.server.strictPort, true);
        assert.equal(resolved.build.target, "es2022");
        if (name === "physics") {
          assert.deepEqual(actual.optimizeDeps.include, physicsIncludes);
          assert.ok(
            physicsIncludes.every((entry) => resolved.optimizeDeps.include.includes(entry)),
          );
          assert.equal(resolved.server.hmr, false);
          assert.equal(resolved.server.proxy, undefined);
        }
        if (name === "persistence") {
          assert.equal(resolved.server.hmr, false);
          assert.equal(resolved.server.proxy["/api"], "http://127.0.0.1:8787");
        }
      },
    );
  });

  test(
    `${name}: real optimizer excludes ignored extension HTML and HTTP denies fake credentials`,
    {
      timeout: 15_000,
    },
    async (t) => {
      const result = await exerciseFixture(name, await load(relative));
      await t.test("ordinary files remain readable", () => {
        assert.equal(result["ordinary.txt"].status, 200);
        assert.equal(result["ordinary.txt"].matchesPublicBody, true);
      });
      await t.test("a fake credential filename is denied inside the allowed fixture root", () => {
        assert.equal(result["fixture api key.txt"].status, 403);
        assert.equal(result["fixture api key.txt"].containsFixturePrivateSentinel, false);
      });
      await t.test(
        "the enabled optimizer scanned the app without the ignored chrome import",
        () => {
          assert.equal(result.optimizerInitState, "initialized");
          assert.ok(result.discoveredDependencies.includes("react"));
          assert.ok(result.scanImports.some((entry) => entry.id.endsWith("/src/main.js")));
          assert.equal(
            result.scanImports.some((entry) => entry.id === "chrome"),
            false,
          );
          assert.deepEqual(result.scanErrors, []);
        },
      );
      await t.test("the loopback server closed", () => {
        assert.equal(result.serverClosed, true);
        assert.equal(result.httpServerListeningAfterClose, false);
      });
    },
  );
}

test(
  "positive control: Vite's default HTML inference reaches the ignored fake extension",
  {
    timeout: 15_000,
  },
  async () => {
    const result = await exerciseFixture(
      "unsafe-default-control",
      await load("vite.config.ts"),
      true,
    );
    assert.ok(
      result.scanErrors.some((entry) => /chrome/.test(entry.message)),
      "the fixture must expose the original unwanted scan when explicit entries are absent",
    );
    assert.ok(result.scanImports.some((entry) => entry.id === "chrome"));
    assert.equal(result.serverClosed, true);
  },
);

test("the installed Vite API version used by the regression is recorded", async () => {
  const installed = JSON.parse(
    await readFile(path.join(root, "node_modules/vite/package.json"), "utf8"),
  );
  evidence.viteVersion = installed.version;
  assert.equal(installed.version, "8.3.5");
});
