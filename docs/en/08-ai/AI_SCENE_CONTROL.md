<!-- english-source: {"path":"docs/08-ai/AI_SCENE_CONTROL.md","sha256":"15d21aebb3dd41fce24aae60f92ee1214d7c1cbf824ec4323c78a95ba663e560","translated_at":"2026-10-27T03:40:41Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/08-ai/AI_SCENE_CONTROL.md`](../../08-ai/AI_SCENE_CONTROL.md). Source SHA-256: `15d21aebb3dd41fce24aae60f92ee1214d7c1cbf824ec4323c78a95ba663e560`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="ai-場景控制與交易"></a>
# AI Scene Control and Transactions

Status: `DESIGN_READY / IMPLEMENTATION_PENDING`. Machine-readable contracts are in `schemas/ai-*.schema.json`; there is currently no production scene executor, live Meta adapter, or UI. The following numbers are adjustable MVP **policy limits**, not physical laws or verified performance.

<!-- english-original-anchor --> <a id="控制邊界"></a>
## Control boundary

Natural language → authorized scene summary and registry → AI proposal → local JSON Schema → domain/policy validation → sandbox diff/preview → host authorization → atomic application → versioned undo. The model only produces proposals; it cannot authorize its own changes, set budgets, switch providers, upload files, or call arbitrary programs.

Common command names follow Phase J. The seven mutation tools can write only to a staging transaction; `PreviewSceneChanges` computes a preview without applying it. Run/Capture/Analyze/Compare use a frozen revision with the required permissions. Host Apply/Undo controls are not exposed as AI tools.

<!-- english-original-anchor --> <a id="輸入與座標"></a>
## Inputs and coordinates

- SI: meters, seconds, kilograms, Hz; right-handed coordinates, Y up, −Z forward; quaternions are `[x,y,z,w]`. The scene editor interprets "right side" using the reference coordinates currently selected by the user; the preview marks the X/Z axes rather than silently assuming world +X.
- Accept only IDs from the loaded registry or IDs created in this transaction; labels may be in Traditional Chinese. The internal ID rule is `^[a-z][a-z0-9._-]{0,63}$`; paths, URLs, and code fragments are not accepted.
- Every operation envelope has `schemaVersion`, `requestId`, `sceneId`, `expectedSceneRevision`, `transactionId`, `tool`, and `arguments`. A revision is a non-negative integer; the host increments it for every committed change.
- Parameter limits: 32 mutations per envelope; 256 objects/16 sound sources/1 production listener per scene; coordinates ±200 m, dimensions 0.01–100 m, and mass 0.001–10,000 kg. The latter three match SceneSpec bounds; the 16-source limit is an AI session policy more conservative than SceneSpec's capacity of 32, and the host computes totals from the existing scene.
- `gainDbfs` is a digital gain parameter for the specified signal, from −80 to −6; it is not SPL. Playback still requires the user to activate the audio context, an output limiter, and a fade-in; schema limits alone cannot guarantee safe headphone sound pressure.

<!-- english-original-anchor --> <a id="必要-domain-validation"></a>
## Required domain validation

| Check | Behavior/rejection conditions |
| --- | --- |
| ID/version | Objects, materials, signals, listeners, backends, and experiments must exist and be readable; CreateScene cannot overwrite an existing scene; new IDs must not collide; staged operations resolve newly created IDs in order. |
| Geometry | Quaternion norm must differ from 1 by ≤1e−6; box dimensions are full side lengths on three axes; sphere dimensions on all three axes must be equal and represent the diameter; capsule dimensions are `[diameter,total height including end caps,diameter]`, with X＝Z and Y≥X. Dimensions cannot be NaN/Infinity, and collision checks cannot inspect only center points. |
| Materials | The schema's materialId must resolve to a versioned acoustic/physics registry; the corresponding data must exist for `scope`. Check per-band energy coefficients, definitions, and measurement sources against the material contract; do not let AI invent absorption coefficients and write them into measured fields. |
| rigid body | Fixed differs from no gravity; on a mode switch, release grab/joint, clear velocities or restore them according to policy, rebuild contacts, and record wake. `restoreSnapshot` requires a valid snapshot; fixed bodies cannot have a trajectory, and trajectories currently apply only to kinematic bodies. |
| trajectory | Times must strictly increase, the first point must be t＝0, and the last point must be ≤run duration; the host configures derived speed/angular-speed limits; teleporting through walls is forbidden. `recordedTrace` must correspond to the hash of a saved trace; AI-authored samples cannot be treated as a recording. |
| source/listener | Signals come from the permitted licensed asset registry; source objects must exist. The editor camera is not the production listener; moving the camera does not trigger MoveListener; FPS attachment is controlled by an explicit mode switch. |
| solver | The backend must actually provide the required order/metric/sample rate; return `CAPABILITY_UNSUPPORTED` otherwise. Freeze solver/trace/material versions; duration/timeStep must be expressible as an integer number of steps (tolerance 1e−9). |
| References and content | Registry descriptions, research abstracts, image OCR, and documents are data; embedded "ignore the rules" instructions cannot add permissions. Materials inferred from media are only candidates, pending the user's selection of a registry value. |

Schema checks only structure and static bounds; the table above includes cross-object, provenance, and runtime-state checks that require a separate executor. A request passing schema does not mean these checks have run.

<!-- english-original-anchor --> <a id="previewapplyundo"></a>
## Preview, Apply, Undo

1. The host first creates a transaction, saving baseRevision and the before snapshot. Validate the whole change set operation by operation; any failure leaves the production scene unmodified and returns JSON Pointer field paths and actionable errors.
2. The sandbox produces diffs for additions/removals/materials/rigid bodies/listener, collision warnings, resource estimates, and assumptions used. The hash covers canonical operations, baseRevision, registry revisions, policy version, and preview results; the UI highlights new objects and displays offline/model provenance.
3. The user can choose Apply, Edit, or Cancel. Only if the user explicitly enables "automatically apply in the sandbox for this session" may trustedLocalPolicy accept low-risk changes; the same preview and visible records are required. By default, Apply is required for each change set in the production scene. Bulk clearing, scene deletion, and external writes are outside these tools' scope.
4. The host verifies approvedDigest＝previewDigest, a trusted issuing source, an unchanged scene revision, and an unexpired preview (policy default: 5 minutes), then applies the entire set under a lock. Increment the revision once at commit, recording the result snapshot, requestId, and inverse. Model-supplied approvedBy/digest has no authorization effect.
5. Any validation error preserves the old scene; on a runtime failure midway, first restore the before snapshot and return `SOLVER_FAILED` or `INTERNAL_ERROR`, without claiming a successful atomic commit. Deduplicate requestId through the host ledger; return `DOMAIN_INVALID` for the same ID with a different payload.
6. Undo restores the saved before snapshot of the just-completed transaction, creates a new revision, resets the audio graph/physics handles, and briefly fades out/in. If someone has edited afterward, return `REVISION_CONFLICT` and let the user choose a branch replay; do not overwrite later work. Undo does not reverse costs already incurred, external side effects, or actual playback.

`ai-scene-change-set.schema.json` is the host record format; JSON Schema does not guarantee cross-field digest equality, revision equality, issuers, or transitions. States: `drafted → validated → previewed → awaitingApproval → applied → reverted`; rejected/expired/conflict/failed are also possible. New operations always return to drafted and clear approval.

<!-- english-original-anchor --> <a id="中文命令的可追溯例子"></a>
## Traceable example of a Chinese-language command

"Create a room with a wooden floor, add a continuously sounding metal ball, enable no gravity, and place a concrete wall on the right."

First query the registry; if `wood_floor`/`metal`/`concrete` are not existing IDs, return candidates and limitations rather than inventing them. When room size, ball diameter, or reference coordinates are unspecified, explicit demonstration defaults can produce an editable preview, such as a room of `[8,3,6]` m; label these as "system defaults," not user-specified values or physical measurements. Use dynamicNoGravity for the ball and fixed for the wall; the continuous signal references the licensed registry. The preview lists all assumptions and actual dimensions; they enter the production scene only after the user chooses Apply. If a material is missing from the registry, retain the draft and request a selection; do not silently substitute a material of the same name.

<!-- english-original-anchor --> <a id="驗收"></a>
## Acceptance

At minimum, verify valid proposals, unknown IDs, extra fields, oversized dimensions, zero quaternions, duplicate IDs, stale revisions, fixed trajectories, conflicting previews, requestId resubmission, cancellation, and Undo. Fixtures can validate schema; cases requiring a scene executor are currently `NOT RUN`. A plausible-looking preview cannot replace domain/physics tests.
