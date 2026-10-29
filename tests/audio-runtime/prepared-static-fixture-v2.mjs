import { createHash } from "node:crypto";
import { createServer as createHttpServer } from "node:http";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve, relative, dirname, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { runProcess } from "../../scripts/agents/process-runner.mjs";
import { NATIVE_AUDIO_SUITES } from "./cross-engine.config.mjs";

export const PREPARED_STATIC_VERSION = "ORIGINAL25_VIA_PREPARED_STATIC_V2";
const helperPath = fileURLToPath(import.meta.url);
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const urls = [
  "/tests/audio-runtime/cross-engine-harness.ts",
  ...NATIVE_AUDIO_SUITES.map((suite) => suite.module),
];
const expectedExports = Object.fromEntries([
  [urls[0], ["awaitNativeSuite", "nativeCapabilities", "nativeDiagnostics", "prepareNativeSuite"]],
  ...NATIVE_AUDIO_SUITES.map((suite) => [suite.module, [suite.exportName]]),
]);
export const PREPARED_STATIC_BUILD_OPTIONS = Object.freeze({
  bundle: true,
  splitting: false,
  format: "esm",
  platform: "browser",
  target: "es2022",
  minify: false,
  treeShaking: false,
  keepNames: true,
  sourcemap: "external",
  sourcesContent: true,
});
const html =
  '<!doctype html><meta charset="utf-8"><title>Native audio only</title><button id="run-native-audio">Run native audio suite</button>';
const writeJson = (path, value) => writeFile(path, JSON.stringify(value, null, 2) + "\n");
function within(directory, path) {
  const full = resolve(path),
    base = resolve(directory);
  if (full !== base && !full.startsWith(base + sep))
    throw new Error(`Prepared path escaped its directory: ${path}`);
  return full;
}
export function verifyPreparedBytesV2(bytes, expected, label = "payload") {
  if (typeof expected !== "string" || sha(bytes) !== expected)
    throw new Error(`Prepared ${label} hash mismatch`);
  return true;
}
export function validatePreparedFixtureMetadataV2(manifest) {
  if (manifest?.version !== PREPARED_STATIC_VERSION || manifest.esbuildVersion !== "0.28.2")
    throw new Error("Prepared version/compiler mismatch");
  if (JSON.stringify(manifest.buildOptions) !== JSON.stringify(PREPARED_STATIC_BUILD_OPTIONS))
    throw new Error("Prepared build options changed");
  if (
    !Array.isArray(manifest.entries) ||
    manifest.entries.length !== urls.length ||
    new Set(manifest.entries.map((entry) => entry.url)).size !== urls.length
  )
    throw new Error("Prepared requires exactly seven unique entries");
  for (const [index, url] of urls.entries()) {
    const entry = manifest.entries[index];
    if (
      entry.url !== url ||
      entry.source !== url.slice(1) ||
      JSON.stringify([...entry.exports].sort()) !== JSON.stringify([...expectedExports[url]].sort())
    )
      throw new Error("Prepared entry URL/order/export mismatch");
    if (!Array.isArray(entry.imports) || entry.imports.length !== 0)
      throw new Error("Prepared bundle contains an external runtime import");
  }
  if (!manifest.originalSources || Object.keys(manifest.originalSources).length !== 23)
    throw new Error("Prepared original23 source closure missing");
  if (!manifest.actualBuildInputs || Object.keys(manifest.actualBuildInputs).length === 0)
    throw new Error("Prepared actual input closure missing");
  for (const [path, hash] of Object.entries(manifest.actualBuildInputs)) {
    if (
      manifest.originalSources[path] !== hash ||
      !/^(src\/audio\/[^/]+\.ts|tests\/audio-runtime\/[^/]+\.ts)$/.test(path)
    )
      throw new Error(`Unexpected prepared build input: ${path}`);
  }
  return true;
}
export async function verifyPreparedStaticFixtureV2(
  manifestPath,
  { root, expectedOriginalSources } = {},
) {
  root ??= resolve(dirname(helperPath), "../..");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  validatePreparedFixtureMetadataV2(manifest);
  if (
    expectedOriginalSources &&
    JSON.stringify(manifest.originalSources) !== JSON.stringify(expectedOriginalSources)
  )
    throw new Error("Prepared original source binding mismatch");
  const directory = dirname(resolve(manifestPath));
  for (const [path, hash] of Object.entries(manifest.originalSources)) {
    verifyPreparedBytesV2(
      await readFile(within(root, resolve(root, path))),
      hash,
      `source ${path}`,
    );
    verifyPreparedBytesV2(
      await readFile(within(directory, resolve(directory, "sources", path))),
      hash,
      `snapshot ${path}`,
    );
  }
  verifyPreparedBytesV2(
    await readFile(resolve(root, "tsconfig.json")),
    manifest.tsconfigSha256,
    "tsconfig",
  );
  verifyPreparedBytesV2(
    await readFile(within(directory, resolve(directory, "sources", "tsconfig.json"))),
    manifest.tsconfigSha256,
    "tsconfig snapshot",
  );
  for (const entry of manifest.entries) {
    const bytes = await readFile(within(directory, resolve(directory, entry.file)));
    verifyPreparedBytesV2(bytes, entry.sha256, entry.url);
    if (bytes.length !== entry.bytes) throw new Error("Prepared byte length mismatch");
    verifyPreparedBytesV2(
      await readFile(within(directory, resolve(directory, entry.mapFile))),
      entry.mapSha256,
      `${entry.url} map`,
    );
  }
  const require = createRequire(import.meta.url);
  const binaryPath = require.resolve("@esbuild/win32-x64/esbuild.exe");
  verifyPreparedBytesV2(
    await readFile(binaryPath),
    manifest.esbuildBinarySha256,
    "esbuild executable",
  );
  const metafileBytes = await readFile(within(directory, resolve(directory, manifest.metafile)));
  verifyPreparedBytesV2(metafileBytes, manifest.metafileSha256, "metafile");
  const metafile = JSON.parse(metafileBytes.toString("utf8"));
  const snapshot = resolve(directory, "sources");
  if (
    Object.keys(metafile.outputs).length !== 14 ||
    Object.keys(metafile.inputs).length !== Object.keys(manifest.actualBuildInputs).length
  )
    throw new Error("Prepared metafile closure/output count changed");
  for (const path of Object.keys(metafile.inputs))
    if (!manifest.actualBuildInputs[path])
      throw new Error(`Prepared metafile has unexpected input: ${path}`);
  const permittedOutputs = new Set(
    manifest.entries.flatMap((entry) => [
      resolve(directory, entry.file),
      resolve(directory, entry.mapFile),
    ]),
  );
  for (const path of Object.keys(metafile.outputs))
    if (!permittedOutputs.has(resolve(snapshot, path)))
      throw new Error(`Prepared metafile has an extra chunk: ${path}`);
  for (const entry of manifest.entries) {
    const output = Object.entries(metafile.outputs).find(
      ([path]) => resolve(snapshot, path) === resolve(directory, entry.file),
    )?.[1];
    if (
      !output ||
      resolve(snapshot, output.entryPoint) !== resolve(snapshot, entry.source) ||
      output.imports.length !== 0 ||
      JSON.stringify([...output.exports].sort()) !== JSON.stringify([...entry.exports].sort())
    )
      throw new Error("Prepared metafile entry/export/import mismatch");
  }
  return manifest;
}

export async function prepareStaticFixtureV2(output, { root, timeoutMs = 60000, originalSources }) {
  const directory = resolve(output, "prepared-static-v2"),
    snapshot = resolve(directory, "sources");
  await mkdir(snapshot, { recursive: true });
  for (const [path, expected] of Object.entries(originalSources)) {
    const bytes = await readFile(within(root, resolve(root, path)));
    verifyPreparedBytesV2(bytes, expected, path);
    const target = within(snapshot, resolve(snapshot, path));
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, bytes);
  }
  const tsconfig = await readFile(resolve(root, "tsconfig.json"));
  await writeFile(resolve(snapshot, "tsconfig.json"), tsconfig);
  const specPath = resolve(directory, "build-spec.json");
  await writeJson(specPath, { root, directory, originalSources, tsconfigSha256: sha(tsconfig) });
  const preparationProcess = await runProcess({
    file: process.execPath,
    args: [helperPath, "--build-worker", specPath],
    cwd: root,
    timeoutMs,
    maxOutputBytes: 262144,
  });
  await writeFile(resolve(directory, "build.stdout.txt"), preparationProcess.stdout);
  await writeFile(resolve(directory, "build.stderr.txt"), preparationProcess.stderr);
  await writeJson(resolve(directory, "build-process.json"), {
    command: [process.execPath, helperPath, "--build-worker", specPath],
    timeoutMs,
    nativeExitProvenance: "Retained Node ChildProcess close event via runProcess",
    ...preparationProcess,
  });
  if (
    preparationProcess.exit_code !== 0 ||
    preparationProcess.signal ||
    preparationProcess.timed_out ||
    !preparationProcess.process_stopped ||
    preparationProcess.output_limit ||
    preparationProcess.spawn_error
  )
    throw new Error("Owned prepared build worker failed; native browser launch prohibited");
  const manifestPath = resolve(directory, "manifest.json");
  const manifest = await verifyPreparedStaticFixtureV2(manifestPath, {
    root,
    expectedOriginalSources: originalSources,
  });
  return { manifestPath, manifest, preparationProcess };
}

async function buildWorker(specPath) {
  const spec = JSON.parse(await readFile(specPath, "utf8")),
    snapshot = resolve(spec.directory, "sources");
  const esbuild = await import("esbuild"),
    require = createRequire(import.meta.url),
    ts = await import("typescript");
  if (esbuild.version !== "0.28.2") throw new Error("Prepared compiler version changed");
  const binaryPath = require.resolve("@esbuild/win32-x64/esbuild.exe");
  const actualBuildInputs = {},
    captured = new Map(),
    findings = [];
  for (const [path, expected] of Object.entries(spec.originalSources)) {
    const bytes = await readFile(within(snapshot, resolve(snapshot, path)));
    verifyPreparedBytesV2(bytes, expected, `captured ${path}`);
    captured.set(resolve(snapshot, path), bytes);
    if (path.endsWith(".ts")) {
      const text = bytes.toString("utf8");
      const source = ts.createSourceFile(
        path,
        text,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TS,
      );
      const semantics = {
        path,
        importMeta: false,
        newUrl: false,
        viteAssetQuery: false,
        dynamicImport: false,
      };
      const inspect = (node) => {
        if (ts.isMetaProperty(node) && node.keywordToken === ts.SyntaxKind.ImportKeyword)
          semantics.importMeta = true;
        if (
          ts.isNewExpression(node) &&
          ts.isIdentifier(node.expression) &&
          node.expression.text === "URL"
        )
          semantics.newUrl = true;
        if (
          (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
          node.moduleSpecifier &&
          ts.isStringLiteral(node.moduleSpecifier) &&
          /[?&](?:url|raw|worker)\b/.test(node.moduleSpecifier.text)
        )
          semantics.viteAssetQuery = true;
        if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
          semantics.dynamicImport = true;
          if (
            path !== "tests/audio-runtime/cross-engine-harness.ts" ||
            node.arguments.length !== 1 ||
            node.arguments[0].getText(source) !== "suite.module"
          )
            throw new Error(`Unexpected dynamic import in ${path}`);
        }
        ts.forEachChild(node, inspect);
      };
      inspect(source);
      if (Object.values(semantics).some((value) => value === true)) findings.push(semantics);
      if (semantics.importMeta || semantics.newUrl || semantics.viteAssetQuery)
        throw new Error(`Unsupported preparation import/asset semantics in ${path}`);
    }
  }
  const tsconfigBytes = await readFile(resolve(snapshot, "tsconfig.json"));
  verifyPreparedBytesV2(tsconfigBytes, spec.tsconfigSha256, "worker tsconfig");
  const tsconfigRaw = JSON.parse(tsconfigBytes.toString("utf8"));
  const entryPoints = Object.fromEntries(
    urls.map((url) => [
      url.split("/").at(-1).replace(/\.ts$/, ""),
      resolve(snapshot, url.slice(1)),
    ]),
  );
  const bundleDirectory = resolve(spec.directory, "bundles");
  await mkdir(bundleDirectory, { recursive: true });
  try {
    const result = await esbuild.build({
      ...PREPARED_STATIC_BUILD_OPTIONS,
      absWorkingDir: snapshot,
      entryPoints,
      outdir: bundleDirectory,
      metafile: true,
      write: false,
      tsconfigRaw,
      plugins: [
        {
          name: "verified-source-snapshot-only",
          setup(build) {
            build.onLoad({ filter: /\.(?:[cm]?js|tsx?)$/ }, (args) => {
              const bytes = captured.get(resolve(args.path));
              if (!bytes) throw new Error(`Build attempted an uncaptured input: ${args.path}`);
              const path = relative(snapshot, args.path).split(sep).join("/");
              actualBuildInputs[path] = sha(bytes);
              return {
                contents: bytes.toString("utf8"),
                loader: args.path.endsWith(".ts") ? "ts" : "js",
                resolveDir: dirname(args.path),
              };
            });
          },
        },
      ],
    });
    for (const file of result.outputFiles)
      await writeFile(within(bundleDirectory, file.path), file.contents);
    const metafilePath = resolve(spec.directory, "metafile.json");
    await writeJson(metafilePath, result.metafile);
    const entries = [];
    for (const url of urls) {
      const source = url.slice(1),
        outputName = source.split("/").at(-1).replace(/\.ts$/, ".js"),
        file = resolve(bundleDirectory, outputName);
      const outputMetadata = Object.entries(result.metafile.outputs).find(
        ([, value]) =>
          value.entryPoint && resolve(snapshot, value.entryPoint) === resolve(snapshot, source),
      )?.[1];
      if (!outputMetadata) throw new Error(`Prepared output missing: ${url}`);
      const bytes = await readFile(file),
        map = await readFile(file + ".map");
      entries.push({
        url,
        source,
        file: relative(spec.directory, file).split(sep).join("/"),
        bytes: bytes.length,
        sha256: sha(bytes),
        mapFile: relative(spec.directory, file + ".map")
          .split(sep)
          .join("/"),
        mapSha256: sha(map),
        exports: outputMetadata.exports,
        imports: outputMetadata.imports,
      });
    }
    if (Object.keys(result.metafile.outputs).length !== 14)
      throw new Error("Unexpected prepared chunks/output count");
    for (const path of Object.keys(result.metafile.inputs))
      if (!actualBuildInputs[path]) throw new Error(`Unobserved build input: ${path}`);
    const manifest = {
      version: PREPARED_STATIC_VERSION,
      createdAt: new Date().toISOString(),
      buildWorkerPid: process.pid,
      esbuildVersion: esbuild.version,
      esbuildBinaryPath: binaryPath,
      esbuildBinarySha256: sha(await readFile(binaryPath)),
      buildOptions: PREPARED_STATIC_BUILD_OPTIONS,
      plugin: "verified-source-snapshot-only: unchanged UTF8 bytes from captured buffers",
      tsconfigSha256: spec.tsconfigSha256,
      tsconfigRaw,
      originalSources: spec.originalSources,
      actualBuildInputs,
      importSemanticsInspection: {
        findings,
        dynamicHarnessImportPreserved: true,
        moduleIdentity:
          "One harness ESM URL instance per fresh browser context; each suite remains a separately isolated original entry",
      },
      entries,
      metafile: "metafile.json",
      metafileSha256: sha(await readFile(metafilePath)),
    };
    validatePreparedFixtureMetadataV2(manifest);
    await writeJson(resolve(spec.directory, "manifest.json"), manifest);
    console.log(
      JSON.stringify({
        status: "PREPARED_STATIC_V2",
        buildWorkerPid: process.pid,
        entries: entries.length,
        actualBuildInputCount: Object.keys(actualBuildInputs).length,
        esbuildVersion: esbuild.version,
      }),
    );
  } finally {
    esbuild.stop();
  }
}

/** Minimal Vite-compatible lifecycle consumed by the byte-preserved original driver. */
export async function createServer(config) {
  if (!process.env.PREPARED_STATIC_FIXTURE_MANIFEST)
    throw new Error("Prepared static manifest missing");
  if (config.server.host !== "127.0.0.1" || config.server.port !== 0 || config.server.hmr !== false)
    throw new Error("Unexpected original server configuration");
  const manifestPath = resolve(process.env.PREPARED_STATIC_FIXTURE_MANIFEST),
    root = resolve(config.root);
  const manifest = await verifyPreparedStaticFixtureV2(manifestPath, { root });
  const directory = dirname(manifestPath),
    buffers = new Map();
  for (const entry of manifest.entries) {
    const bytes = await readFile(within(directory, resolve(directory, entry.file)));
    verifyPreparedBytesV2(bytes, entry.sha256, `served ${entry.url}`);
    buffers.set(entry.url, Buffer.from(bytes));
  }
  const sockets = new Set();
  const httpServer = createHttpServer((request, response) => {
    const path = new URL(request.url, "http://127.0.0.1").pathname;
    if (request.method !== "GET") {
      response.writeHead(405);
      response.end();
      return;
    }
    if (path === "/__native_audio__") {
      response.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      });
      response.end(html);
      return;
    }
    const bytes = buffers.get(path);
    if (!bytes) {
      response.writeHead(404);
      response.end();
      return;
    }
    response.writeHead(200, {
      "Content-Type": "text/javascript; charset=utf-8",
      "Content-Length": bytes.length,
      "Cache-Control": "no-store",
    });
    response.end(bytes);
  });
  httpServer.on("connection", (socket) => {
    sockets.add(socket);
    socket.once("close", () => sockets.delete(socket));
  });
  let closing = null;
  const close = () =>
    (closing ??= new Promise((resolveClose, reject) => {
      const timer = setTimeout(() => {
        for (const socket of sockets) socket.destroy();
        httpServer.closeAllConnections();
        reject(new Error("Prepared static close exceeded7000ms"));
      }, 7000);
      httpServer.close((error) => {
        clearTimeout(timer);
        if (error && error.code !== "ERR_SERVER_NOT_RUNNING") reject(error);
        else resolveClose();
      });
      httpServer.closeIdleConnections();
    }));
  return {
    httpServer,
    async listen() {
      await new Promise((resolveListen, reject) => {
        httpServer.once("error", reject);
        httpServer.listen(0, "127.0.0.1", resolveListen);
      });
    },
    close,
    watcher: {
      async close() {
        for (const socket of sockets) socket.destroy();
        httpServer.closeAllConnections();
      },
    },
  };
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === helperPath &&
  process.argv[2] === "--build-worker"
) {
  try {
    await buildWorker(process.argv[3]);
  } catch (error) {
    console.error(error.stack ?? error);
    process.exitCode = 1;
  }
}
