<!-- english-source: {"path":"docs/06-validation/PHYSICS_VALIDATION.md","sha256":"c626f6eb4ab07d5cac2f6bc8f42c986c601a4010fcb45d416390215efe249897","translated_at":"2026-10-27T03:39:37.5838541Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/06-validation/PHYSICS_VALIDATION.md`](../../06-validation/PHYSICS_VALIDATION.md). Source SHA-256: `c626f6eb4ab07d5cac2f6bc8f42c986c601a4010fcb45d416390215efe249897`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="物理驗證狀態"></a>
# Physics Validation Status

An actual isolated Node/WASM smoke test of Rapier 0.21.0 has run; this is not a production FPS/grab/throw product. See [PHYSICS_ARCHITECTURE](../04-physics/PHYSICS_ARCHITECTURE.md) for sources, APIs, and interaction design.

```powershell
npm ci --prefix experiments/physics-spike --ignore-scripts
npm run test:physics
```

Implementation and input/expected/tolerance are in [`smoke.mjs`](../../../experiments/physics-spike/smoke.mjs); actual results are in [`results.json`](../../../experiments/physics-spike/results.json). Fixed dt=1/60 s; length m, time s, mass kg, velocity m/s, force N, impulse N·s, Y-up, gravity -9.81 m/s².

| Runtime fixture          | What is actually checked                                                                                 | Tolerance/limitations                                                                                  |
| ------------------------ | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| freefall                 | After 0.5 s, v=-4.905 and analytical y=8.77375 m; actual integrator position error exists                   | y 0.05 m, v 0.001 m/s; not exact agreement with the continuous solution                                  |
| dynamicNoGravity         | gravityScale=0 preserves x inertia, then gravityScale=1 is restored                                       | Initial y 1e-5 m, vx 1e-5 m/s; restored vy 0.001 m/s                                                     |
| fixed→dynamic            | Fixed ignores impulse; Dynamic is restored and velocity assigned after an explicit zero-velocity policy | Does not rely on the engine implicitly restoring old velocity                                          |
| impulse/force            | m=2 kg, a 12 N·s impulse immediately produces Δv=6; a 12 N force accumulates, and resetForces stops acceleration | vx 1e-4 m/s; addForce is not automatically cleared every step                                      |
| collision event/contact  | An actual collision between a dynamic ball and fixed floor; force event and geometric contactImpulse are read | force and impulse are distinct APIs/units; no assumed one-to-one correspondence of solverContact indices |
| spring/kinematic anchor  | A spring connects to a position kinematic anchor; convergence is tested for a single mass and parameter set | 0.05 m; excludes walls, rotation, large mass ratios, target teleport, or force cap                     |

These six smoke tests support only this version and the local runtime. `npm run smoke:dependencies` separately checks Three 0.186.1 math ray/plane operations and Rapier initialize/free; it does not create a WebGL renderer or browser interaction.

<!-- english-original-anchor --> <a id="尚未驗證"></a>
## Not Yet Validated

Character controller/slopes/steps, pointer lock, actual first-person grabbing, wall-safe target clamp, grab rotation servo, release/throw pipeline, CCD stress testing, FPS build collision-aware placement, and impact sound synth/volume mapping remain NOT RUN. Being able to read collision events does not mean sound has been generated.

Fully deterministic cross-platform replay has not been established. Production validation must save the initial state, dt, seed, Rapier build, scene revision, and authoritative transform/velocity/contact trace; A/B comparisons use the same motion trace as their baseline. Recording keyboard/mouse events alone is insufficient to prove complete consistency across CPUs/browsers.

Future minimum acceptance must include: the dynamic/fixed/no-gravity/kinematic transition matrix, grabbing different masses, simultaneous object contact with a wall/character, throw→impact events containing time/position/relative velocity/impulse/material, event deduplication, and resource disposal. These are acceptance conditions for the next phase and are not listed as PASS in this session.
