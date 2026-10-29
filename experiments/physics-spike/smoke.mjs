import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import RAPIER from '@dimforge/rapier3d-compat';

// Isolated V1/API feasibility checks, not a production physics interaction layer.
const packageMetadata = JSON.parse(await readFile(new URL('./node_modules/@dimforge/rapier3d-compat/package.json', import.meta.url)));
const scriptBytes = await readFile(new URL(import.meta.url));
const lockBytes = await readFile(new URL('./package-lock.json', import.meta.url));
const lockMetadata = JSON.parse(lockBytes);
const packageSource = lockMetadata.packages['node_modules/@dimforge/rapier3d-compat'];
const runtimeEntryUrl = new URL(import.meta.resolve('@dimforge/rapier3d-compat'));
const runtimeEntryBytes = await readFile(runtimeEntryUrl);
const shippedWasmBytes = await readFile(new URL('./node_modules/@dimforge/rapier3d-compat/dist/rapier_wasm3d_bg.wasm', import.meta.url));
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const wasmHeader = Buffer.from([0, 97, 115, 109, 1, 0, 0, 0]);
const embeddedWasmCandidates = [...runtimeEntryBytes.toString('utf8').matchAll(/[A-Za-z0-9+/]{1000,}={0,2}/g)]
  .map(match => Buffer.from(match[0], 'base64'))
  .filter(bytes => bytes.subarray(0, 8).equals(wasmHeader));
assert.equal(embeddedWasmCandidates.length, 1, 'Exactly one embedded base64 WebAssembly payload must be identified in this pinned compat ESM artifact');
const embeddedWasmBytes = embeddedWasmCandidates[0];
assert.ok(embeddedWasmBytes.equals(shippedWasmBytes), 'Decoded compat payload must equal the separately shipped WASM artifact for this pinned build');
const dt = 1 / 60;
await RAPIER.init({});

const executedAt = new Date().toISOString();
const archiveRequested = process.argv.includes('--archive');
const archiveTimestamp = executedAt.replace(/[-:.]/g, '');
const archivePlatform = process.platform === 'win32' && process.arch === 'x64' ? 'win64' : `${process.platform}-${process.arch}`;
const archiveFileName = `rapier-${archivePlatform}-${archiveTimestamp}.json`;
const results = {
  schemaVersion: 2,
  executedAt,
  node: process.version,
  platform: process.platform,
  arch: process.arch,
  package: { name: packageMetadata.name, version: packageMetadata.version, license: packageMetadata.license },
  provenance: {
    hashAlgorithm: 'SHA-256',
    script: { path: 'experiments/physics-spike/smoke.mjs', sha256: sha256(scriptBytes), byteLength: scriptBytes.length },
    lockfile: { path: 'experiments/physics-spike/package-lock.json', sha256: sha256(lockBytes), byteLength: lockBytes.length },
    packageSource: { resolved: packageSource.resolved, npmIntegrity: packageSource.integrity, integrityMeaning: 'npm tarball source integrity from the installed lockfile; not the SHA-256 of an unpacked file' },
    runtimeEntry: { path: 'experiments/physics-spike/node_modules/@dimforge/rapier3d-compat/dist/rapier.mjs', sha256: sha256(runtimeEntryBytes), byteLength: runtimeEntryBytes.length },
    wasm: {
      shippedArtifact: { path: 'experiments/physics-spike/node_modules/@dimforge/rapier3d-compat/dist/rapier_wasm3d_bg.wasm', sha256: sha256(shippedWasmBytes), byteLength: shippedWasmBytes.length },
      embeddedPayload: { containerPath: 'experiments/physics-spike/node_modules/@dimforge/rapier3d-compat/dist/rapier.mjs', encoding: 'base64', identification: 'Unique base64 token decoding to WebAssembly magic and version 1; compared byte-for-byte with the shipped .wasm file', sha256: sha256(embeddedWasmBytes), byteLength: embeddedWasmBytes.length, matchesShippedArtifact: true }
    }
  },
  archivalSnapshot: archiveRequested ? { path: `experiments/physics-spike/results/${archiveFileName}`, writePolicy: 'Exclusive create (wx); existing snapshots are never overwritten by this script' } : null,
  timestepSeconds: dt,
  checks: [],
  limitations: [
    'Node.js CPU/WASM smoke only; no browser, pointer lock, audio, FPS camera or interaction UX was run.',
    'No production grab, wall-safe target clamp, rotation servo, throw, CCD stress or mass-range tuning is implemented.',
    'Results show this pinned build on this machine; no cross-platform deterministic replay guarantee is established.',
    'Force-event and manifold samples are copied inside their callbacks; temporary Rapier objects are never retained.'
  ]
};

const near = (actual, expected, tolerance, description) => assert.ok(Math.abs(actual - expected) <= tolerance,
  `${description}: expected ${expected} +/- ${tolerance}, received ${actual}`);
const copy = vector => ({ x: vector.x, y: vector.y, z: vector.z });
const makeWorld = (gravity = { x: 0, y: 0, z: 0 }) => {
  const world = new RAPIER.World(gravity);
  world.timestep = dt;
  return world;
};
function makeBall(world, { x = 0, y = 0, z = 0, mass = 2, dynamic = true } = {}) {
  const desc = dynamic ? RAPIER.RigidBodyDesc.dynamic() : RAPIER.RigidBodyDesc.fixed();
  desc.setTranslation(x, y, z).setCanSleep(false);
  const body = world.createRigidBody(desc);
  const collider = world.createCollider(RAPIER.ColliderDesc.ball(0.25).setMass(mass), body);
  return { body, collider };
}
const step = (world, count, queue) => { for (let i = 0; i < count; i++) world.step(queue); };
async function check(name, execute) {
  const entry = { name, status: 'FAIL' };
  results.checks.push(entry);
  try { Object.assign(entry, await execute(), { status: 'PASS' }); }
  catch (error) { entry.error = error.message; throw error; }
}

try {
  await check('freefall_matches_analytic_velocity_and_bounded_position_error', () => {
    const world = makeWorld({ x: 0, y: -9.81, z: 0 });
    try {
      const { body } = makeBall(world, { y: 10 });
      const seconds = 0.5;
      step(world, 30);
      const expectedY = 10 - 0.5 * 9.81 * seconds ** 2;
      near(body.linvel().y, -9.81 * seconds, 0.001, 'freefall linear velocity');
      near(body.translation().y, expectedY, 0.05, 'freefall position');
      return { actual: { y: body.translation().y, vy: body.linvel().y }, expected: { y: expectedY, vy: -4.905 }, tolerance: { yMetres: 0.05, vyMetresPerSecond: 0.001 } };
    } finally { world.free(); }
  });

  await check('dynamic_zero_gravity_retains_inertia', () => {
    const world = makeWorld({ x: 0, y: -9.81, z: 0 });
    try {
      const { body } = makeBall(world, { y: 10 });
      body.setGravityScale(0, true);
      body.setLinvel({ x: 2, y: 0, z: 0 }, true);
      step(world, 60);
      near(body.translation().y, 10, 1e-5, 'zero-gravity height');
      near(body.linvel().x, 2, 1e-5, 'zero-gravity inertial velocity');
      near(body.translation().x, 2, 1e-4, 'zero-gravity travel');
      body.setGravityScale(1, true);
      step(world, 30);
      near(body.linvel().y, -4.905, 0.001, 'restored gravity velocity');
      return { gravityScaleRestored: body.gravityScale(), actual: { position: copy(body.translation()), velocity: copy(body.linvel()) }, tolerance: { yMetresBeforeRestore: 1e-5, vxMetresPerSecond: 1e-5, restoredVyMetresPerSecond: 0.001 } };
    } finally { world.free(); }
  });

  await check('fixed_ignores_impulse_then_explicit_dynamic_restore_moves', () => {
    const world = makeWorld({ x: 0, y: -9.81, z: 0 });
    try {
      const { body } = makeBall(world, { y: 5, dynamic: false });
      body.applyImpulse({ x: 100, y: 100, z: 0 }, true);
      step(world, 60);
      near(body.translation().x, 0, 1e-6, 'fixed x');
      near(body.translation().y, 5, 1e-6, 'fixed y');
      body.setBodyType(RAPIER.RigidBodyType.Dynamic, true);
      body.setGravityScale(0, true);
      body.setLinvel({ x: 2, y: 0, z: 0 }, true);
      body.setAngvel({ x: 0, y: 0, z: 0 }, true);
      body.wakeUp();
      step(world, 60);
      near(body.translation().x, 2, 1e-4, 'dynamic restored motion');
      near(body.translation().y, 5, 1e-5, 'dynamic zero-gravity height');
      return { actual: { position: copy(body.translation()), velocity: copy(body.linvel()), sleeping: body.isSleeping(), bodyType: body.bodyType() }, policy: 'Explicitly chose zero velocity at Fixed entry and explicit 2 m/s at Dynamic restore; engine history is not treated as a restore policy.' };
    } finally { world.free(); }
  });

  await check('impulse_is_instantaneous_and_addForce_persists_until_reset', () => {
    const world = makeWorld();
    try {
      const impulse = makeBall(world, { x: -10 });
      const force = makeBall(world, { x: 10 });
      impulse.body.applyImpulse({ x: 12, y: 0, z: 0 }, true);
      force.body.addForce({ x: 12, y: 0, z: 0 }, true);
      step(world, 30);
      const afterHalfSecond = { impulseVx: impulse.body.linvel().x, forceVx: force.body.linvel().x };
      near(afterHalfSecond.impulseVx, 6, 1e-4, 'J/m');
      near(afterHalfSecond.forceVx, 3, 1e-4, 'F*t/m after first half second');
      step(world, 30);
      const afterOneSecond = { impulseVx: impulse.body.linvel().x, forceVx: force.body.linvel().x };
      near(afterOneSecond.impulseVx, 6, 1e-4, 'impulse is not applied twice');
      near(afterOneSecond.forceVx, 6, 1e-4, 'force persists after second half second');
      force.body.resetForces(true);
      step(world, 30);
      near(force.body.linvel().x, 6, 1e-4, 'force reset stops acceleration');
      return { massKg: force.body.mass(), impulseNs: 12, forceN: 12, afterHalfSecond, afterOneSecond, afterResetVx: force.body.linvel().x, toleranceVxMetresPerSecond: 1e-4 };
    } finally { world.free(); }
  });

  await check('collision_force_and_solved_contact_impulse_are_separate_apis', () => {
    const world = makeWorld({ x: 0, y: -9.81, z: 0 });
    const queue = new RAPIER.EventQueue(true);
    try {
      const floor = world.createCollider(RAPIER.ColliderDesc.cuboid(5, 0.1, 5).setTranslation(0, -0.1, 0));
      const { body, collider } = makeBall(world, { y: 1.5, mass: 1 });
      collider.setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS | RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS);
      collider.setContactForceEventThreshold(0);
      const collisions = [];
      const forceSamples = [];
      const contactSamples = [];
      for (let tick = 0; tick < 180; tick++) {
        world.step(queue);
        queue.drainCollisionEvents((a, b, started) => collisions.push({ tick, a, b, started }));
        queue.drainContactForceEvents(event => {
          if (forceSamples.length < 4) forceSamples.push({ tick, totalForce: copy(event.totalForce()), totalForceMagnitudeN: event.totalForceMagnitude(), maxForceMagnitudeN: event.maxForceMagnitude(), hasContactImpulseField: typeof event.contactImpulse === 'function' });
        });
        world.contactPair(collider, floor, (manifold, flipped) => {
          for (let i = 0; i < manifold.numContacts(); i++) {
            if (manifold.contactImpulse(i) > 0 && contactSamples.length < 4) contactSamples.push({ tick, flipped, normal: copy(manifold.normal()), normalImpulseNs: manifold.contactImpulse(i), localContactPoint1: copy(manifold.localContactPoint1(i)), localContactPoint2: copy(manifold.localContactPoint2(i)), solverContactPoint: manifold.numSolverContacts() > 0 ? copy(manifold.solverContactPoint(0)) : null });
          }
        });
      }
      assert.ok(collisions.some(event => event.started), 'collision-start event expected');
      assert.ok(forceSamples.some(event => event.totalForceMagnitudeN > 0), 'contact force event expected');
      assert.ok(contactSamples.some(event => event.normalImpulseNs > 0), 'solved manifold impulse expected');
      assert.ok(forceSamples.every(event => !event.hasContactImpulseField), 'force events are not impulse events');
      assert.ok(Number.isFinite(body.translation().y), 'final body pose finite');
      return { collisionEvents: collisions, forceSamples, contactSamples, finalY: body.translation().y, evidence: 'contactImpulse(i) reads geometric contact index; solverContactPoint(i) uses a distinct solver-contact index. This smoke does not assume a one-to-one index mapping.' };
    } finally { queue.free(); world.free(); }
  });

  await check('spring_joint_to_position_kinematic_anchor_api_smoke', () => {
    const world = makeWorld();
    try {
      const anchor = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(2, 0, 0));
      const { body } = makeBall(world, { mass: 1 });
      const joint = world.createImpulseJoint(RAPIER.JointData.spring(0, 40, 8, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }), anchor, body, true);
      let maxAbsX = 0;
      for (let tick = 0; tick < 180; tick++) {
        anchor.setNextKinematicTranslation({ x: 2, y: 0, z: 0 });
        world.step();
        const x = body.translation().x;
        assert.ok(Number.isFinite(x) && Math.abs(x) < 10, 'spring body pose finite and bounded for this case');
        maxAbsX = Math.max(maxAbsX, Math.abs(x));
      }
      near(body.translation().x, 2, 0.05, 'spring converges in this unloaded 1 kg case');
      return { jointType: joint.type(), massKg: body.mass(), spring: { restLengthMetres: 0, stiffnessNPerMetre: 40, dampingNsPerMetre: 8 }, finalX: body.translation().x, maxAbsX, toleranceMetres: 0.05, limitation: 'No wall, gravity, orientation constraint, force cap, mass-ratio sweep or FPS target discontinuity is tested; this does not establish a collision-safe production grab.' };
    } finally { world.free(); }
  });
} finally {
  results.status = results.checks.every(result => result.status === 'PASS') ? 'PASS' : 'FAIL';
  const serializedResults = `${JSON.stringify(results, null, 2)}\n`;
  await writeFile(new URL('./results.json', import.meta.url), serializedResults);
  if (archiveRequested) {
    await mkdir(new URL('./results/', import.meta.url), { recursive: true });
    await writeFile(new URL(`./results/${archiveFileName}`, import.meta.url), serializedResults, { flag: 'wx' });
    console.log(`ARCHIVED experiments/physics-spike/results/${archiveFileName}`);
  }
  for (const result of results.checks) console.log(`${result.status} ${result.name}`);
  console.log(`${results.status}: ${results.checks.length} checks, @dimforge/rapier3d-compat ${packageMetadata.version}, dt=${dt}s`);
}
