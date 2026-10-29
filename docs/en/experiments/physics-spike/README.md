<!-- english-source: {"path":"experiments/physics-spike/README.md","sha256":"986ded76a54d42c1de1b3ce89c20a82b81469fb1bcc876a63022d53b1a1cb821","translated_at":"2026-10-27T03:38:48.978038Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`experiments/physics-spike/README.md`](../../../../experiments/physics-spike/README.md). Source SHA-256: `986ded76a54d42c1de1b3ce89c20a82b81469fb1bcc876a63022d53b1a1cb821`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="rapier-隔離式可行性驗證"></a>
# Isolated Rapier Feasibility Validation

Review date: 2026-10-26 (Asia/Taipei). Status: **6 / 6 PASS**. This is a research-stage Node.js / WASM API and numerical smoke test; production product interaction features have not yet been built.

<!-- english-original-anchor --> <a id="重跑"></a>
## Rerun

Uses Node.js 22.17.0, npm 11.4.2, Windows x64. The dependency is pinned to `@dimforge/rapier3d-compat@0.21.0`, independent of the root package; `package-lock.json` includes npm integrity.

```powershell
Set-Location 'D:\Developing\Meta Hack\experiments\physics-spike'
npm ci --ignore-scripts --no-audit --no-fund
npm test
```

If dependencies are already installed, you can also run from the project root:

```powershell
node experiments/physics-spike/smoke.mjs
```

The script rewrites `results.json` in this directory on each run; it is a **latest / mutable** working result, recording UTC execution time, environment, tolerances, and numerical values. The timestamped snapshot in the next section is the fixed evidence for this run. The physics fixed timestep is `h = 1/60 s`, with units m, kg, s, N, N·s. Numerical tests without contact disable sleeping and use the default zero damping.

<!-- english-original-anchor --> <a id="固定快照與來源雜湊"></a>
## Fixed Snapshot and Source Hashes

Actually executed:

```powershell
node experiments/physics-spike/smoke.mjs --archive
```

```text
ARCHIVED experiments/physics-spike/results/rapier-win64-20261025T192231997Z.json
PASS: 6 checks, @dimforge/rapier3d-compat 0.21.0, dt=0.016666666666666666s
```

The fixed evidence is `results/rapier-win64-20261025T192231997Z.json`, executed at `2026-10-25T19:22:31.997Z`. SHA-256: `bd84d577e09cbfe7155422d4e9d8c23cb17a179fcf70eba66f3652cefc998e9f`. Normal tests do not write to `results/`; `--archive` generates a filename using UTC time and creates it exclusively with `writeFile(..., {flag: 'wx'})`. The script fails on a filename collision rather than overwriting. This is the script's write-once policy; the hash can detect subsequent external changes.

After saving, a normal `node experiments/physics-spike/smoke.mjs` was run once more, and all six checks still passed; the archive SHA-256 was identical before and after execution, and the command output `ARCHIVE_UNCHANGED BD84D577E09CBFE7155422D4E9D8C23CB17A179FCF70EBA66F3652CEFC998E9F`. Thus latest can be updated independently while the fixed snapshot retains its original value.

Schema 2 includes the following source evidence in every result. This table corresponds to the fixed snapshot above; if the script changes, subsequent results record the new source hashes.

| Artifact | SHA-256 |
| --- | --- |
| Execution script `smoke.mjs` | `cd8f6234f7a47b85d734ec6eb37645d297898eb379bca5dcb5ff7b2604f02e83` |
| Independent `package-lock.json` | `33e30676831f0b6d769855183ca812f903d0e4f5875519fd199fce8f48c035b7` |
| Actual ESM import `dist/rapier.mjs` | `02dc6a4e2fffc013bab08fbb44fa68f501d8303615e9afe4c7d89ad4eedda0d0` |
| Package-provided `dist/rapier_wasm3d_bg.wasm` | `17cfa80eebd8de0291b948496dbffba724b98b489687f8272ca236a7bbf1dd4b` |
| WASM payload decoded from the compat ESM's embedded base64 | `17cfa80eebd8de0291b948496dbffba724b98b489687f8272ca236a7bbf1dd4b` |

The Compat execution entry embeds WASM; the presence of a package-provided `.wasm` file alone does not establish that the external file was loaded. This smoke test identifies the only base64 token in the ESM that decodes to WebAssembly magic / version 1, decodes it to 3,082,103 bytes, and confirms byte by byte that it matches the provided `.wasm`. Results separately record the hashes and lengths of the container, decoded payload, and external artifact; the JavaScript hash is not mislabeled as a WASM hash.

The snapshot also retains the npm tarball source `https://registry.npmjs.org/@dimforge/rapier3d-compat/-/rapier3d-compat-0.21.0.tgz` and the lockfile's `sha512-tCl1HPGwOhn5aCQbgqWbOH+Nx/5fnr3IPAnzQuR7zIhC/raqi2yxC6LhvZqjdI2El5hQgY5RDAwDrAjAi2FdPA==`. This is the integrity of the npm source package, separate from the SHA-256 of any single extracted file.

<!-- english-original-anchor --> <a id="已執行命令與結果"></a>
## Commands Executed and Results

In the ordinary sandbox, the first `npm view` and `npm install` failed: `getaddrinfo ENOTFOUND registry.npmjs.org`. After using the tool's network-permission approval process, installation and read-only metadata queries succeeded. The root package was not modified.

```text
npm install --ignore-scripts --no-audit --no-fund --fetch-retries=0 --fetch-timeout=15000
added 1 package in 7s

npm view @dimforge/rapier3d-compat version dist.tarball license --json --fetch-retries=0 --fetch-timeout=15000
{
  "version": "0.21.0",
  "dist.tarball": "https://registry.npmjs.org/@dimforge/rapier3d-compat/-/rapier3d-compat-0.21.0.tgz",
  "license": "Apache-2.0"
}

npm test
PASS freefall_matches_analytic_velocity_and_bounded_position_error
PASS dynamic_zero_gravity_retains_inertia
PASS fixed_ignores_impulse_then_explicit_dynamic_restore_moves
PASS impulse_is_instantaneous_and_addForce_persists_until_reset
PASS collision_force_and_solved_contact_impulse_are_separate_apis
PASS spring_joint_to_position_kinematic_anchor_api_smoke
PASS: 6 checks, @dimforge/rapier3d-compat 0.21.0, dt=0.016666666666666666s
```

First successful execution: `2026-10-25T19:04:42.612Z` (Taiwan 2026-10-26 03:04:42). The numerical values below correspond to that record; use `results.json` for the time of later reruns.

| Check | Actual Observations and Pass Conditions | Supported Conclusion |
| --- | --- | --- |
| Free fall | From y=10 m over 0.5 s, vy=-4.9049964 m/s (analytical value -4.905, tolerance 0.001); y=8.7635317 m (analytical value 8.77375, tolerance 0.05 m) | Basic fixed-timestep dynamic rigid-body and gravity behavior holds; discrete position is not required to equal the continuous analytical solution |
| Dynamic object without gravity | With gravityScale=0, height remains 10 m over 1 s (tolerance 1e-5 m), vx=2 m/s, x≈2 m (tolerance 1e-4 m); after restoring scale=1, vy≈-4.905 at 0.5 s | An object without gravity still has inertia, unlike Fixed |
| Fixed → Dynamic | Under a 100 N·s impulse and gravity, Fixed position remains unchanged for 1 s (tolerance 1e-6 m); after switching to Dynamic, scale=0, explicitly setting vx=2, and waking, x=1.99999845 m at 1 s (tolerance 1e-4 m) | The engine can switch body type; the application must still explicitly decide the restoration policy |
| Force and impulse | m=2 kg; a single 12 N·s impulse produces vx=6; calling addForce(12 N) only once gives vx≈3 at 0.5 s and ≈6 at 1 s; after resetForces, there is no further acceleration over another 0.5 s (tolerance 1e-4 m/s) | `applyImpulse` and `addForce` are not interchangeable; external force persists until reset |
| Collision data | A 1 kg ball drops onto a static floor; collision start occurs at tick30, force≈304.109741 N, manifold normal impulse≈5.068496 N·s; a world-space solver point is readable | Events are accessible, but force events do not include an impulse field; the manifold must be read separately |
| Spring joint | 1 kg ball, zero gravity, kinematic anchor at x=2; rest=0 m, k=40 N/m, c=8 N·s/m; x=1.99999475 m after 3 s (tolerance 0.05 m), with maximum x≈2.1458745 during the run | `JointData.spring` and a position-based kinematic anchor can be created and operate in this single unloaded case |

<!-- english-original-anchor --> <a id="重要-api-限制"></a>
## Important API Limitations

- `TempContactForceEvent.totalForce()`, `totalForceMagnitude()`, and `maxForceMagnitude()` represent force. Their numerical values cannot be directly labeled as impulse in N·s. In this case, `F·h` matches the retrieved contact impulse, but this single-contact case still cannot serve as general proof for all compound collisions.
- `TempContactManifold.contactImpulse(i)` from `world.contactPair(a,b,callback)` can read the solved contact normal impulse. `i` indexes geometric contacts; `j` in `solverContactPoint(j)` indexes solver contacts, and the same index cannot be assumed for both.
- `solverContactPoint(j)` is in world space; `localContactPoint1/2(i)` are in each shape's local space, and the callback's `flipped` must be handled. Temporary event/manifold values must be read and copied inside the callback; object references cannot be retained directly in an asynchronous queue.
- A resting ball continues to produce approximately 9.81 N of support force and 0.1635 N·s of impulse each subsequent step, so `impulse > 0` is insufficient to trigger an impact sound. Conditions such as onset, approach velocity / energy, pair state, and cooldown are needed.
- Rapier collider handles are opaque numerical values; `5e-324` occurred in this run. They must not be assumed to be ordinary incrementing integers or used as long-term Domain IDs. Event records should use stable application Object ID / Collider ID.
- The official package README lists cross-platform determinism for the general build as not guaranteed; this smoke test did not verify bitwise replay across platforms, browsers, or engine versions. A fixed timestep is not a cross-platform replay guarantee.

<!-- english-original-anchor --> <a id="證據與授權"></a>
## Evidence and License

The actually installed package's `package.json` states `0.21.0`, `license: Apache-2.0`, and includes the full `LICENSE`. The dependency remains in the ignored `node_modules/`; the entire third-party package is not copied into the research source repository. Product distribution must still integrate the Apache 2.0 license, applicable notices, and modification disclosure obligations into the license inventory.

Official sources (reviewed 2026-10-26; website API documentation may update with newer releases, so exact APIs are additionally confirmed against this run's pinned-version `.d.ts` and actual tests):

- [Official npm package and version](https://www.npmjs.com/package/@dimforge/rapier3d-compat)
- [Rapier rigid bodies](https://rapier.rs/docs/user_guides/javascript/rigid_bodies/)
- [Rapier rigid-body forces and impulses](https://rapier.rs/docs/user_guides/javascript/rigid_body_forces_and_impulses/)
- [Rapier joints](https://rapier.rs/docs/user_guides/javascript/joints/)
- [Rapier advanced collision detection](https://rapier.rs/docs/user_guides/javascript/advanced_collision_detection/)
- [TempContactManifold API](https://rapier.rs/javascript3d/classes/TempContactManifold.html)
- [TempContactForceEvent API](https://rapier.rs/javascript3d/classes/TempContactForceEvent.html)
- [Official source code and license](https://github.com/dimforge/rapier)

<!-- english-original-anchor --> <a id="尚未驗證"></a>
## Not Yet Validated

Browser initialization, Pointer Lock, FPS capsule movement, camera and Listener, actual sound playback, collision-safe grabbing, angle control, throwing, CCD high-speed / thin-wall scenarios, different mass and inertia ranges, placement overlap checks, large-object-count performance, and cross-platform replay are all **NOT RUN**. Success in a single Spring case cannot determine the product's grab mechanism; production stability requires separate validation of bounded output, collision constraints, and target discontinuities.
