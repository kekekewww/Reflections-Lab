import { createHash } from "node:crypto";
import { createServer as createHttpServer } from "node:http";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve, relative, dirname, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { runProcess } from "../../scripts/agents/process-runner.mjs";
import {
  PREPARED_STATIC_BUILD_OPTIONS,
  verifyPreparedBytesV2,
} from "./prepared-static-fixture-v2.mjs";

export const PREPARED_IR_VERSION = "NATIVE_IR_STATE_VIA_PREPARED_STATIC_V1";
const helperPath = fileURLToPath(import.meta.url);
const IR_PROFILES = Object.freeze({
  v1: Object.freeze({
    id: "v1",
    preparedVersion: PREPARED_IR_VERSION,
    referenceVersion: "native-ir-state-reference-v1",
    entryUrl: "/tests/audio-runtime/native-ir-state-reference-v1.ts",
    exportName: "runNativeIrStateReferenceV1",
    fixtureSha256: "ea3dfb59556d5ee58877d7d807854d5881f87c80fb10038fc2af9a158b43c607",
  }),
  v2: Object.freeze({
    id: "v2",
    preparedVersion: "NATIVE_IR_STATE_VIA_PREPARED_STATIC_V2",
    referenceVersion: "native-ir-state-reference-v2",
    entryUrl: "/tests/audio-runtime/native-ir-state-reference-v2.ts",
    // Keep the original timed callback/export binding; the reference version is explicit metadata.
    exportName: "runNativeIrStateReferenceV1",
    fixtureSha256: "05b7940ca4b16f77e3ef20861429529a7e6b39e7466b49e64f356e4b897a778e",
  }),
});
export function resolveIrStaticProfile(id = "v1") {
  if (typeof id !== "string" || !Object.hasOwn(IR_PROFILES, id))
    throw new Error("Unknown prepared IR reference profile");
  return IR_PROFILES[id];
}
const actualPathsFor = (profile) =>
  [
    "src/audio/band-filter.ts",
    "src/audio/control.ts",
    "src/audio/routes.ts",
    "src/audio/types.ts",
    "tests/audio-runtime/ir-state-reference-v1-data.ts",
    profile.entryUrl.slice(1),
  ].sort();
const v2HelperSha = "d6acb640f0f034863daf7ab79273ac41c4ab980961a29932bd3ad40f5afef1a7";
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const writeJson = (path, value) => writeFile(path, JSON.stringify(value, null, 2) + "\n");
function within(directory, path) {
  const base = resolve(directory),
    full = resolve(path);
  if (full !== base && !full.startsWith(base + sep))
    throw new Error("IR prepared path escaped directory");
  return full;
}
export function validateIrStaticFixtureMetadataV1(manifest, { irProfile } = {}) {
  const profile = resolveIrStaticProfile(manifest?.irProfile ?? "v1");
  if (irProfile !== undefined && profile.id !== resolveIrStaticProfile(irProfile).id)
    throw new Error("Prepared IR manifest/profile mismatch");
  if (
    manifest?.version !== profile.preparedVersion ||
    manifest.esbuildVersion !== "0.28.2" ||
    manifest.v2HelperSha256 !== v2HelperSha
  )
    throw new Error("Prepared IR version/compiler/V2 helper mismatch");
  if (JSON.stringify(manifest.buildOptions) !== JSON.stringify(PREPARED_STATIC_BUILD_OPTIONS))
    throw new Error("Prepared IR build options changed");
  if (!Array.isArray(manifest.entries) || manifest.entries.length !== 1)
    throw new Error("Prepared IR requires exactly one entry");
  const entry = manifest.entries[0];
  if (
    entry.url !== profile.entryUrl ||
    entry.source !== profile.entryUrl.slice(1) ||
    JSON.stringify(entry.exports) !== JSON.stringify([profile.exportName]) ||
    !Array.isArray(entry.imports) ||
    entry.imports.length
  )
    throw new Error("Prepared IR URL/export/import mismatch");
  if (!manifest.originalSources || Object.keys(manifest.originalSources).length !== 21)
    throw new Error("Prepared IR original21 source closure missing");
  if (
    !manifest.actualBuildInputs ||
    JSON.stringify(Object.keys(manifest.actualBuildInputs).sort()) !==
      JSON.stringify(actualPathsFor(profile))
  )
    throw new Error("Prepared IR actual build closure mismatch");
  for (const [path, hash] of Object.entries(manifest.actualBuildInputs))
    if (manifest.originalSources[path] !== hash)
      throw new Error("Prepared IR source binding mismatch");
  return true;
}
export async function verifyIrStaticFixtureV1(
  manifestPath,
  { root, expectedOriginalSources, irProfile } = {},
) {
  root ??= resolve(dirname(helperPath), "../..");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")),
    directory = dirname(resolve(manifestPath)),
    snapshot = resolve(directory, "sources");
  validateIrStaticFixtureMetadataV1(manifest, { irProfile });
  const profile = resolveIrStaticProfile(manifest.irProfile ?? "v1");
  if (
    expectedOriginalSources &&
    JSON.stringify(manifest.originalSources) !== JSON.stringify(expectedOriginalSources)
  )
    throw new Error("IR original source manifest changed");
  if (manifest.originalSources[profile.entryUrl.slice(1)] !== profile.fixtureSha256)
    throw new Error("Prepared IR fixture hash is outside the fixed reference profile");
  verifyPreparedBytesV2(
    await readFile(resolve(root, IR_PROFILES.v1.entryUrl.slice(1))),
    IR_PROFILES.v1.fixtureSha256,
    "immutable IRv1 fixture",
  );
  for (const [path, hash] of Object.entries(manifest.originalSources)) {
    verifyPreparedBytesV2(
      await readFile(within(root, resolve(root, path))),
      hash,
      `IR source ${path}`,
    );
    verifyPreparedBytesV2(
      await readFile(within(snapshot, resolve(snapshot, path))),
      hash,
      `IR snapshot ${path}`,
    );
  }
  verifyPreparedBytesV2(
    await readFile(resolve(root, "tests/audio-runtime/prepared-static-fixture-v2.mjs")),
    v2HelperSha,
    "qualified V2 helper",
  );
  verifyPreparedBytesV2(
    await readFile(resolve(root, "tsconfig.json")),
    manifest.tsconfigSha256,
    "IR tsconfig",
  );
  verifyPreparedBytesV2(
    await readFile(resolve(snapshot, "tsconfig.json")),
    manifest.tsconfigSha256,
    "IR tsconfig snapshot",
  );
  const entry = manifest.entries[0],
    bytes = await readFile(within(directory, resolve(directory, entry.file)));
  verifyPreparedBytesV2(bytes, entry.sha256, "IR bundle");
  if (bytes.length !== entry.bytes) throw new Error("IR byte length mismatch");
  verifyPreparedBytesV2(
    await readFile(within(directory, resolve(directory, entry.mapFile))),
    entry.mapSha256,
    "IR source map",
  );
  const metaBytes = await readFile(within(directory, resolve(directory, manifest.metafile)));
  verifyPreparedBytesV2(metaBytes, manifest.metafileSha256, "IR metafile");
  const meta = JSON.parse(metaBytes.toString("utf8"));
  if (
    JSON.stringify(Object.keys(meta.inputs).sort()) !== JSON.stringify(actualPathsFor(profile)) ||
    Object.keys(meta.outputs).length !== 2
  )
    throw new Error("IR metafile input/output mismatch");
  const allowed = new Set([resolve(directory, entry.file), resolve(directory, entry.mapFile)]);
  for (const path of Object.keys(meta.outputs))
    if (!allowed.has(resolve(snapshot, path))) throw new Error("IR metafile extra chunk");
  const output = Object.entries(meta.outputs).find(
    ([path]) => resolve(snapshot, path) === resolve(directory, entry.file),
  )?.[1];
  if (
    !output ||
    resolve(snapshot, output.entryPoint) !== resolve(snapshot, entry.source) ||
    JSON.stringify(output.exports) !== JSON.stringify(entry.exports) ||
    output.imports.length
  )
    throw new Error("IR metafile entry/export mismatch");
  verifyPreparedBytesV2(
    await readFile(createRequire(import.meta.url).resolve("@esbuild/win32-x64/esbuild.exe")),
    manifest.esbuildBinarySha256,
    "IR compiler executable",
  );
  return manifest;
}
export async function prepareIrStaticFixtureV1(
  output,
  { root, timeoutMs = 60000, originalSources, irProfile = "v1" },
) {
  const profile = resolveIrStaticProfile(irProfile);
  if (originalSources[profile.entryUrl.slice(1)] !== profile.fixtureSha256)
    throw new Error("Prepared IR fixture source does not match selected fixed profile");
  const directory = resolve(output, "prepared-ir-static-v1"),
    snapshot = resolve(directory, "sources");
  await mkdir(snapshot, { recursive: true });
  for (const [path, hash] of Object.entries(originalSources)) {
    const bytes = await readFile(within(root, resolve(root, path)));
    verifyPreparedBytesV2(bytes, hash, `IR source ${path}`);
    const target = within(snapshot, resolve(snapshot, path));
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, bytes);
  }
  const tsconfig = await readFile(resolve(root, "tsconfig.json"));
  await writeFile(resolve(snapshot, "tsconfig.json"), tsconfig);
  const spec = resolve(directory, "build-spec.json");
  await writeJson(spec, {
    root,
    directory,
    originalSources,
    irProfile: profile.id,
    tsconfigSha256: sha(tsconfig),
  });
  const preparationProcess = await runProcess({
    file: process.execPath,
    args: [helperPath, "--build-worker", spec],
    cwd: root,
    timeoutMs,
    maxOutputBytes: 262144,
  });
  await writeFile(resolve(directory, "build.stdout.txt"), preparationProcess.stdout);
  await writeFile(resolve(directory, "build.stderr.txt"), preparationProcess.stderr);
  await writeJson(resolve(directory, "build-process.json"), {
    command: [process.execPath, helperPath, "--build-worker", spec],
    timeoutMs,
    nativeExitProvenance: "Retained Node ChildProcess close via runProcess",
    ...preparationProcess,
  });
  if (
    preparationProcess.exit_code !== 0 ||
    preparationProcess.signal ||
    preparationProcess.timed_out ||
    preparationProcess.cancelled ||
    !preparationProcess.process_stopped ||
    preparationProcess.spawn_error ||
    preparationProcess.output_limit
  )
    throw new Error("IR build worker failed; native launch prohibited");
  const manifestPath = resolve(directory, "manifest.json"),
    manifest = await verifyIrStaticFixtureV1(manifestPath, {
      root,
      expectedOriginalSources: originalSources,
      irProfile: profile.id,
    });
  return { manifestPath, manifest, preparationProcess };
}
async function buildWorker(specPath) {
  const spec = JSON.parse(await readFile(specPath, "utf8")),
    snapshot = resolve(spec.directory, "sources");
  const profile = resolveIrStaticProfile(spec.irProfile ?? "v1");
  const esbuild = await import("esbuild"),
    ts = await import("typescript");
  if (esbuild.version !== "0.28.2") throw new Error("IR compiler changed");
  verifyPreparedBytesV2(
    await readFile(resolve(spec.root, "tests/audio-runtime/prepared-static-fixture-v2.mjs")),
    v2HelperSha,
    "qualified V2 helper",
  );
  const captured = new Map();
  for (const [path, hash] of Object.entries(spec.originalSources)) {
    const bytes = await readFile(within(snapshot, resolve(snapshot, path)));
    verifyPreparedBytesV2(bytes, hash, path);
    captured.set(resolve(snapshot, path), bytes);
  }
  const config = await readFile(resolve(snapshot, "tsconfig.json"));
  verifyPreparedBytesV2(config, spec.tsconfigSha256, "IR worker tsconfig");
  const actualBuildInputs = {},
    findings = [];
  const outdir = resolve(spec.directory, "bundles");
  await mkdir(outdir, { recursive: true });
  try {
    const result = await esbuild.build({
      ...PREPARED_STATIC_BUILD_OPTIONS,
      entryPoints: [resolve(snapshot, profile.entryUrl.slice(1))],
      outdir,
      absWorkingDir: snapshot,
      tsconfigRaw: JSON.parse(config.toString("utf8")),
      write: false,
      metafile: true,
      plugins: [
        {
          name: "verified-ir-source-snapshot-only",
          setup(build) {
            build.onLoad({ filter: /\.(?:[cm]?js|tsx?)$/ }, (args) => {
              const bytes = captured.get(resolve(args.path));
              if (!bytes) throw new Error("Uncaptured IR build input");
              const path = relative(snapshot, args.path).split(sep).join("/");
              const source = ts.createSourceFile(
                  path,
                  bytes.toString("utf8"),
                  ts.ScriptTarget.Latest,
                  true,
                  ts.ScriptKind.TS,
                ),
                semantics = {
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
                if (
                  ts.isCallExpression(node) &&
                  node.expression.kind === ts.SyntaxKind.ImportKeyword
                )
                  semantics.dynamicImport = true;
                ts.forEachChild(node, inspect);
              };
              inspect(source);
              if (Object.values(semantics).some((value) => value === true))
                throw new Error(`Unsupported IR import/asset semantics in ${path}`);
              findings.push(semantics);
              actualBuildInputs[path] = sha(bytes);
              return {
                contents: bytes.toString("utf8"),
                loader: "ts",
                resolveDir: dirname(args.path),
              };
            });
          },
        },
      ],
    });
    for (const file of result.outputFiles)
      await writeFile(within(outdir, file.path), file.contents);
    const metafilePath = resolve(spec.directory, "metafile.json");
    await writeJson(metafilePath, result.metafile);
    const file = resolve(outdir, profile.entryUrl.split("/").at(-1).replace(/\.ts$/, ".js")),
      bytes = await readFile(file),
      map = await readFile(file + ".map");
    const metadata = Object.values(result.metafile.outputs).find((value) => value.entryPoint);
    const binaryPath = createRequire(import.meta.url).resolve("@esbuild/win32-x64/esbuild.exe");
    const manifest = {
      version: profile.preparedVersion,
      irProfile: profile.id,
      createdAt: new Date().toISOString(),
      buildWorkerPid: process.pid,
      esbuildVersion: esbuild.version,
      esbuildBinaryPath: binaryPath,
      esbuildBinarySha256: sha(await readFile(binaryPath)),
      v2HelperSha256: v2HelperSha,
      buildOptions: PREPARED_STATIC_BUILD_OPTIONS,
      plugin: "verified-ir-source-snapshot-only: unchanged UTF8 captured bytes",
      tsconfigSha256: spec.tsconfigSha256,
      originalSources: spec.originalSources,
      actualBuildInputs,
      importSemanticsInspection: {
        findings,
        moduleIdentity:
          "One nativeIR entry; original direct module imports become one native-reference module instance in the single original page",
      },
      entries: [
        {
          url: profile.entryUrl,
          source: profile.entryUrl.slice(1),
          file: relative(spec.directory, file).split(sep).join("/"),
          bytes: bytes.length,
          sha256: sha(bytes),
          mapFile: relative(spec.directory, file + ".map")
            .split(sep)
            .join("/"),
          mapSha256: sha(map),
          exports: metadata.exports,
          imports: metadata.imports,
        },
      ],
      metafile: "metafile.json",
      metafileSha256: sha(await readFile(metafilePath)),
    };
    validateIrStaticFixtureMetadataV1(manifest, { irProfile: profile.id });
    await writeJson(resolve(spec.directory, "manifest.json"), manifest);
    console.log(
      JSON.stringify({
        status: "PREPARED_IR_STATIC_V1",
        buildWorkerPid: process.pid,
        inputs: Object.keys(actualBuildInputs).length,
        entries: 1,
      }),
    );
  } finally {
    esbuild.stop();
  }
}
export async function createServer(config) {
  if (!process.env.PREPARED_IR_STATIC_MANIFEST) throw new Error("IR static manifest missing");
  if (config.server.host !== "127.0.0.1" || config.server.port !== 0 || config.server.hmr !== false)
    throw new Error("Unexpected IR server configuration");
  const path = resolve(process.env.PREPARED_IR_STATIC_MANIFEST),
    profile = resolveIrStaticProfile(process.env.PREPARED_IR_STATIC_PROFILE ?? "v1"),
    manifest = await verifyIrStaticFixtureV1(path, {
      root: resolve(config.root),
      irProfile: profile.id,
    }),
    entry = manifest.entries[0];
  const bytes = await readFile(within(dirname(path), resolve(dirname(path), entry.file)));
  verifyPreparedBytesV2(bytes, entry.sha256, "served IR bundle");
  const served = Buffer.from(bytes),
    sockets = new Set();
  const html =
    '<!doctype html><meta charset="utf-8"><title>Native IR state reference v1</title><button id="run-reference">Run native IR reference</button>';
  const httpServer = createHttpServer((request, response) => {
    const url = new URL(request.url, "http://127.0.0.1");
    if (request.method !== "GET") {
      response.writeHead(405);
      response.end();
      return;
    }
    if (url.pathname === "/__ir_state_reference_v1__") {
      response.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      });
      response.end(html);
      return;
    }
    if (url.pathname !== profile.entryUrl) {
      response.writeHead(404);
      response.end();
      return;
    }
    response.writeHead(200, {
      "Content-Type": "text/javascript; charset=utf-8",
      "Content-Length": served.length,
      "Cache-Control": "no-store",
    });
    response.end(served);
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
        reject(new Error("IR static close exceeded7000ms"));
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
