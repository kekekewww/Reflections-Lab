<!-- english-source: {"path":"docs/15-ui-parameter-audit/zones/domain.md","sha256":"86ed4eb73d2f2c00575ec6aa8338cdc1af2ffd8f19f54f26318ba8e5f22d7898","translated_at":"2026-11-02T09:10:27.7494975+00:00","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/15-ui-parameter-audit/zones/domain.md`](../../../15-ui-parameter-audit/zones/domain.md). Source SHA-256: `86ed4eb73d2f2c00575ec6aa8338cdc1af2ffd8f19f54f26318ba8e5f22d7898`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="task0029zone-scene-domainschema-與原子交易"></a>
# Task0029: Zone Scene domain, schema and atomic transactions

Date: 2026-11-02. Executor: Codex zone_domain subagent; base branch codex/pipeline-zones (f6abb93). This report covers only the Scene domain and does not establish producer, UI, recording/replay or whole-product acceptance.

<!-- english-original-anchor --> <a id="變更"></a>
## Changes

- Adds SceneZone: explicit static aabb or sphere, stable ID, name, enabled, centerM, hysteresisM and half-extents/radius. Maximum 16; half-extents/radius 0.05–50 m, center ±200 m, hysteresis 0–0.25 m and strictly below the minimum half-extent/radius.
- SceneSpec.zones is optional. Create/serialize/deserialize insert no default value; legacy scenes without zones keep exactly the same canonical JSON string and SHA-256. An explicit empty array remains distinct from omission.
- SceneOperation adds AddZone, UpdateZone, RemoveZone and SetZones. Every operation retains revision checks, original-object isolation, step-by-step validation and atomic transactions. The inverse uses SetZones to restore full ordering and authored values. SetZones null deletes the optional property, allowing Undo back to legacy omission; [] restores an explicit empty set.
- Zone IDs join the global uniqueness set for objects/sources/listener; new objects and sources also cannot reuse a zone ID.
- Closed schemas reject unknown shapes/fields, Infinity/NaN, invalid ranges and parameters for the wrong shape. JSON entry points reject sparse arrays and extra array properties to avoid losing metadata during serialization.

<!-- english-original-anchor --> <a id="驗證"></a>
## Validation

- `node --import tsx --test tests/scene/*.test.ts`: 32/32 PASS (original 18, new 14); original TAP is in domain-tests.txt. Covers absent/[] distinctions, legacy bytes/hash, both volumes, hysteresis boundaries, capacity, duplicate/cross-entity IDs, atomic rollback, add/update/remove Undo and a complete inverse for a maximum 64-operation transaction.
- Scoped ESLint: exit 0; scoped Prettier --check: exit 0.
- `npm run typecheck` exited 1 while UI files were still being created. The sole message was AnalysisDock failing to find ZonePanel.js. This is not a whole-tree TypeScript PASS; the lead must rerun after UI/runtime connections are complete.
- Independent read-only domain_review checked the assigned domain/schema/tests above and found no confirmed major or minor defects; it did not independently rerun tests.

<!-- english-original-anchor --> <a id="界線與交接"></a>
## Boundaries and handoff

No fixtures, physics, acoustic roles, runtime, AI, behavior, UI, package, Wiki or generated English files were changed. This domain slice did not stage/commit. The Task0029 lead integrates and verifies Derived body-center crossing, initial-inside handling, hysteresis events, delete/reset/generation boundaries and raw/normalized/replay behavior. This domain creates no phantom Rapier bodies or acoustic surfaces and does not label authored volumes measured sensors.
