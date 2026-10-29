import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import ts from "typescript";
import { ExperimentRecorder } from "../../src/experiments/recorder.js";
import { canonicalStringify } from "../../src/experiments/hash.js";
import { createDefaultScene } from "../../src/app/defaults.js";
import type {
  ExperimentRecorderOptions,
  RecordingFrameInput,
} from "../../src/experiments/types.js";
import type { Vec3 } from "../../src/scene/types.js";

const require = createRequire(import.meta.url);
const experiments = new URL("../../src/experiments/", import.meta.url);
const baseline = new URL("../../artifacts/v1/capture-cost-baseline-20261027/", import.meta.url);
const baselineHashes = {
  "hash.ts": "0676be2ea96571b604f926b803b5e574b09ee73bda799c6779d0e1d07054be42",
  "recorder.ts": "4a4d8956e5625bf501de21642a36a917e81fe13eac0c1a8c582da4cd1c80a469",
};

/** Execute the preserved old append implementation, resolving only local existing dependencies. */
async function loadBaseline(): Promise<{ ExperimentRecorder: typeof ExperimentRecorder }> {
  const compile = (name: keyof typeof baselineHashes, oldHashUrl?: string): string => {
    const bytes = readFileSync(new URL(name, baseline));
    assert.equal(createHash("sha256").update(bytes).digest("hex"), baselineHashes[name]);
    const javascript = ts.transpileModule(bytes.toString("utf8"), {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
    }).outputText;
    const resolved = javascript.replace(
      /(from\s+["'])([^"']+)(["'])/g,
      (_all, prefix: string, specifier: string, suffix: string) => {
        let target: string;
        if (specifier === "./hash.js" && oldHashUrl) target = oldHashUrl;
        else if (specifier.startsWith(".")) {
          const url = new URL(specifier, experiments);
          if (url.pathname.endsWith(".js")) {
            const source = new URL(url.href.replace(/\.js$/, ".ts"));
            if (existsSync(source)) target = source.href;
            else target = url.href;
          } else target = url.href;
        } else target = pathToFileURL(require.resolve(specifier)).href;
        return `${prefix}${target}${suffix}`;
      },
    );
    return `data:text/javascript;base64,${Buffer.from(resolved).toString("base64")}`;
  };
  const oldHashUrl = compile("hash.ts");
  return import(compile("recorder.ts", oldHashUrl));
}

const oldRecorder = loadBaseline();

function options(): ExperimentRecorderOptions {
  return {
    runId: "run.canonical-equivalence",
    runEpoch: "epoch.canonical-equivalence",
    createdAt: "2026-10-27T00:00:00.000Z",
    sceneSnapshot: createDefaultScene(),
    sourceConfig: { label: "聲音🧪", gain: -0, waveform: "sine" },
    behaviorConfig: { label: "中文／Unicode", value: "\ud800" },
    solverConfig: { maxReflectionOrder: 1 },
    atmosphere: { medium: "air", speedOfSoundMps: 343 },
    materialRegistry: [],
    assetManifest: [],
    physicsVersion: "rapier-0.21.0",
    backendVersion: "web-geometric-1.0.0",
    fixedDtS: 1 / 60,
    sampleRateHz: 48000,
  };
}

function frame(tick: number): RecordingFrameInput {
  const scene = createDefaultScene();
  return {
    tick,
    sceneRevision: scene.sceneRevision,
    poses: scene.objects.map((object) => ({
      objectId: object.id,
      positionM: [...object.positionM] as Vec3,
      orientationQuaternion: [...object.orientationQuaternion] as [number, number, number, number],
      linearVelocityMps: [object.id === "ball" ? 1 : 0, -0, 0] as Vec3,
      angularVelocityRadps: [0, 0, 0] as Vec3,
    })),
    listener: structuredClone(scene.listener),
    physicsEvents:
      tick === 1
        ? [
            {
              eventId: "impact.one",
              tick,
              sequence: 0,
              objectId: "ball",
              type: "OnImpact",
              accepted: true,
            },
          ]
        : [],
    behaviorDecisions: [
      {
        tick,
        description: "碰撞🧪／中文",
        unicode: "\ud800",
        ordered: { z: 0, a: [true, null, "é"] },
      },
    ],
    audioEvents: [],
    behaviorSnapshot: { diagnostic: { label: "相位資料缺失明示", finite: -0, unicode: "\udfff" } },
  };
}

test("recorder optimization seals byte-identical artifacts and fingerprints against the preserved old implementation", async () => {
  const OldRecorder = (await oldRecorder).ExperimentRecorder;
  const previous = new OldRecorder(options());
  const current = new ExperimentRecorder(options());
  for (let tick = 0; tick < 3; tick++) {
    const input = frame(tick);
    previous.appendFrame(input);
    current.appendFrame(input);
    assert.deepEqual(current.getTelemetry(), previous.getTelemetry());
  }
  const oldArtifact = await previous.finish();
  const newArtifact = await current.finish();
  assert.deepEqual(newArtifact, oldArtifact);
  assert.equal(JSON.stringify(newArtifact), JSON.stringify(oldArtifact));
  assert.equal(newArtifact.artifactSha256, oldArtifact.artifactSha256);
  assert.deepEqual(newArtifact.fingerprints, oldArtifact.fingerprints);
  assert.equal(
    newArtifact.traceBytes,
    Buffer.byteLength(canonicalStringify(newArtifact.frames), "utf8"),
  );
  assert.equal(newArtifact.sourcePhaseEvidence?.evidenceClass, "missing");
});

test("exact UTF-8 byte budgets and the second-frame comma retain the original acceptance boundary", async () => {
  const OldRecorder = (await oldRecorder).ExperimentRecorder;
  const probe = new OldRecorder(options());
  probe.appendFrame(frame(0));
  probe.appendFrame(frame(1));
  const exact = probe.getTelemetry().traceBytes;
  for (const limit of [exact, exact - 1]) {
    const previous = new OldRecorder({ ...options(), budget: { maxBytes: limit } });
    const current = new ExperimentRecorder({ ...options(), budget: { maxBytes: limit } });
    for (const recorder of [previous, current]) {
      recorder.appendFrame(frame(0));
      if (limit === exact) recorder.appendFrame(frame(1));
      else assert.throws(() => recorder.appendFrame(frame(1)), { code: "RECORDING_BUDGET" });
    }
    assert.deepEqual(current.getTelemetry(), previous.getTelemetry());
    assert.deepEqual(await current.finish(), await previous.finish());
  }
});

test("input mutation and deep immutability match the preserved recorder after append", async () => {
  const OldRecorder = (await oldRecorder).ExperimentRecorder;
  const previous = new OldRecorder(options());
  const current = new ExperimentRecorder(options());
  const original = frame(0);
  previous.appendFrame(original);
  current.appendFrame(original);
  assert.equal(Reflect.set(original.poses[0]!.positionM, "0", 90), true);
  (original.behaviorDecisions[0] as { description: string }).description = "caller edited";
  const saved = await current.finish();
  assert.deepEqual(saved, await previous.finish());
  assert.notEqual(saved.frames[0]!.poses[0]!.positionM[0], 90);
  assert.ok(Object.isFrozen(saved.frames));
  assert.ok(Object.isFrozen(saved.frames[0]!.poses[0]!.positionM));
  assert.equal(Reflect.set(saved.frames[0]!.poses[0]!.positionM, "0", 12), false);
});

test("JSON rejection precedes tick validation and failed append retains identical state", async () => {
  const OldRecorder = (await oldRecorder).ExperimentRecorder;
  const previous = new OldRecorder(options());
  const current = new ExperimentRecorder(options());
  for (const recorder of [previous, current]) {
    recorder.appendFrame(frame(0));
    const invalid = frame(2);
    (invalid.behaviorSnapshot as { diagnostic: { finite: number } }).diagnostic.finite = Infinity;
    assert.throws(() => recorder.appendFrame(invalid), { code: "NONFINITE" });
    assert.throws(() => recorder.appendFrame(frame(2)), { code: "TICK_GAP" });
    recorder.appendFrame(frame(1));
  }
  assert.deepEqual(current.getTelemetry(), previous.getTelemetry());
  assert.deepEqual(await current.finish(), await previous.finish());
});
