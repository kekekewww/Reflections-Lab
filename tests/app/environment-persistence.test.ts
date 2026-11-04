import assert from "node:assert/strict";
import test from "node:test";
import { LabRuntime } from "../../src/app/runtime.js";
import type { LabAction } from "../../src/ui/contracts.js";

const storage = () => {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
};
const savedEnvironment = (app: LabRuntime) => JSON.parse(app.exportProject()).atmosphere;
async function command(app: LabRuntime, action: LabAction) {
  await app.dispatch(action);
  assert.equal(app.getSnapshot().error, "", action.type);
}

test("vacuum Save survives a fresh runtime Load and independent import", async () => {
  const durable = storage();
  const app = await LabRuntime.create({ storage: durable, useWorker: false });
  const fresh = await LabRuntime.create({ storage: durable, useWorker: false });
  const independent = await LabRuntime.create({ useWorker: false });
  try {
    await command(app, { type: "setAtmosphere", medium: "air", temperatureC: 35.5 });
    await command(app, { type: "setAtmosphere", medium: "vacuum" });
    const expected = savedEnvironment(app);
    assert.equal(expected.medium, "vacuum");
    assert.equal(expected.temperatureC, 35.5);
    await command(app, { type: "save" });
    await command(fresh, { type: "load" });
    assert.deepEqual(savedEnvironment(fresh), expected);
    assert.equal(fresh.getSnapshot().acoustic.medium, "vacuum");
    assert.equal(fresh.getSnapshot().acoustic.temperatureC, 35.5);
    await independent.importProject(app.exportProject());
    assert.deepEqual(savedEnvironment(independent), expected);
  } finally {
    app.dispose();
    fresh.dispose();
    independent.dispose();
  }
});

test("invalid imported atmosphere preserves all authored data and environment", async () => {
  const app = await LabRuntime.create({ useWorker: false });
  try {
    await command(app, { type: "setAtmosphere", medium: "air", temperatureC: 9.75 });
    const prior = JSON.parse(app.exportProject());
    for (const atmosphere of [
      { medium: "air", temperatureC: 101 },
      { medium: "vacuum", speedOfSoundMps: null },
      { medium: "vacuum", bandAbsorptionDbPerM: [0] },
    ]) {
      await assert.rejects(app.importProject(JSON.stringify({ ...prior, atmosphere })));
      const next = JSON.parse(app.exportProject());
      for (const key of ["scene", "soundBehaviors", "assets", "atmosphere"])
        assert.deepEqual(next[key], prior[key]);
      assert.equal(app.getSnapshot().acoustic.temperatureC, 9.75);
    }
  } finally {
    app.dispose();
  }
});

test("legacy import restores exact defaults, while ordinary Scene Undo retains later environment", async () => {
  const app = await LabRuntime.create({ useWorker: false });
  try {
    const legacy = JSON.parse(app.exportProject());
    delete legacy.atmosphere;
    await command(app, { type: "setAtmosphere", medium: "air", temperatureC: 40 });
    await app.importProject(JSON.stringify(legacy));
    assert.deepEqual(savedEnvironment(app), {
      medium: "air",
      speedOfSoundMps: 343,
      temperatureC: 20,
      bandAbsorptionDbPerM: [0, 0, 0, 0, 0, 0, 0],
      dataClass: "Synthetic",
    });
    await command(app, { type: "patchObject", objectId: "ball", patch: { massKg: 2 } });
    await command(app, { type: "setAtmosphere", medium: "air", temperatureC: -5.5 });
    const environment = savedEnvironment(app);
    await command(app, { type: "undo" });
    assert.deepEqual(savedEnvironment(app), environment);
  } finally {
    app.dispose();
  }
});

test("illegal atmosphere commands never mutate, pause or interrupt an accepted recording", async () => {
  const app = await LabRuntime.create({ useWorker: false });
  try {
    await command(app, { type: "run" });
    await command(app, { type: "recordToggle" });
    const tick = app.getSnapshot().tick;
    for (const temperatureC of [NaN, Infinity, -81, 101]) {
      await app.dispatch({ type: "setAtmosphere", medium: "air", temperatureC });
      assert.ok(app.getSnapshot().error);
      assert.equal(app.getSnapshot().recording.state, "recording");
      assert.equal(app.getSnapshot().simulationState, "running");
      assert.equal(app.getSnapshot().tick, tick);
      assert.equal(savedEnvironment(app).temperatureC, 20);
    }
  } finally {
    app.dispose();
  }
});

test("loaded atmosphere pins captured configuration and real propagation delay", async () => {
  const author = await LabRuntime.create({ useWorker: false });
  const fresh = await LabRuntime.create({ useWorker: false });
  try {
    await command(author, { type: "setAtmosphere", medium: "air", temperatureC: 35.5 });
    const expected = savedEnvironment(author);
    await fresh.importProject(author.exportProject());
    await fresh.captureShortTake(0.1);
    const artifact = fresh.getRecordingArtifact()!;
    assert.deepEqual(artifact.configuration.atmosphere, expected);
    const frames = artifact.frames.flatMap((frame) => frame.acousticFrames);
    assert.ok(frames.length);
    for (const frame of frames)
      if (frame.directDelayS !== null && frame.paths[0])
        assert.ok(
          Math.abs(frame.directDelayS - frame.paths[0].lengthM / expected.speedOfSoundMps) < 1e-9,
        );
  } finally {
    author.dispose();
    fresh.dispose();
  }
});

test("a valid new environment remains uncommitted when project asset preparation fails", async () => {
  const app = await LabRuntime.create({ useWorker: false });
  try {
    await command(app, { type: "setAtmosphere", medium: "air", temperatureC: 5 });
    const prior = JSON.parse(app.exportProject());
    const candidate = structuredClone(prior);
    candidate.atmosphere = { medium: "vacuum", temperatureC: 35.5 };
    candidate.assets.push({
      assetId: "asset.environment-missing",
      revision: 1,
      sha256: "f".repeat(64),
      hashKind: "encodedBytesSha256",
      name: "Unavailable original",
      mimeType: "audio/wav",
      byteLength: 44,
      storage: "externalFile",
      rights: { license: "Synthetic test fixture", source: "local-test" },
    });
    const pin = { assetId: "asset.environment-missing", revision: 1, sha256: "f".repeat(64) };
    candidate.soundBehaviors.assets.push(pin);
    candidate.soundBehaviors.profiles.find(
      (profile: { profileId: string }) => profile.profileId === "profile.interactive-tone",
    ).rules[0].generator = { kind: "sample", asset: pin, loop: false, startOffsetSeconds: 0 };
    await assert.rejects(app.importProject(JSON.stringify(candidate)), /ASSET_/);
    const after = JSON.parse(app.exportProject());
    for (const key of ["scene", "soundBehaviors", "assets", "atmosphere"])
      assert.deepEqual(after[key], prior[key]);
    assert.equal(app.getSnapshot().acoustic.temperatureC, 5);
  } finally {
    app.dispose();
  }
});

test("partial optional atmosphere keeps the temperature control reachable without inventing an explicit sound speed", async () => {
  const app = await LabRuntime.create({ useWorker: false });
  try {
    const supplied = JSON.parse(app.exportProject());
    supplied.atmosphere = { medium: "air" };
    await app.importProject(JSON.stringify(supplied));
    assert.equal(app.getSnapshot().acoustic.temperatureC, 20);
    assert.equal(savedEnvironment(app).temperatureC, 20);
    assert.equal(savedEnvironment(app).speedOfSoundMps, undefined);
    assert.notEqual(app.getSnapshot().acoustic.speedOfSoundMps, 343);
  } finally {
    app.dispose();
  }
});

test("disposing while an environment transaction drains cannot commit the prepared environment", async () => {
  const app = await LabRuntime.create({ useWorker: false });
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const internal = app as unknown as { drain(): Promise<void> };
  internal.drain = () => gate;
  const pending = app.dispatch({ type: "setAtmosphere", medium: "air", temperatureC: 40 });
  await Promise.resolve();
  app.dispose();
  release();
  await pending;
  assert.equal(savedEnvironment(app).temperatureC, 20);
});
