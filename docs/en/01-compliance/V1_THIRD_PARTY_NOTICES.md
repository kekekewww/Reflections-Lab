<!-- english-source: {"path":"docs/01-compliance/V1_THIRD_PARTY_NOTICES.md","sha256":"b7555bdf4d52f8d4d50182e5b8efd386d8b03e7890c67ba328acb69972c58bf6","translated_at":"2026-10-27T23:18:50.000436Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/01-compliance/V1_THIRD_PARTY_NOTICES.md`](../../01-compliance/V1_THIRD_PARTY_NOTICES.md). Source SHA-256: `b7555bdf4d52f8d4d50182e5b8efd386d8b03e7890c67ba328acb69972c58bf6`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="第一版第三方聲明索引"></a>
# Version 1 Third-Party Notices Index

<!-- english-original-anchor --> <a id="2026-10-28-r12-當前-production-candidate"></a>
## 2026-10-28 r12 Current Production Candidate

The [r12 pack](../../../artifacts/v1/bundle-notice-pack-20261028-active-rule-r12/manifest.json) and [current byte binding and independent review](../../../artifacts/v1/bundle-notice-current-qualification-r12-20261028/qualification-seal.json) check the latest 12 production resources, 149 installed manifests, 173 legal payloads, and 113 module occurrences / 15 packages from four source maps, file by file. The JSON fields / ordering in Root's build receipt differ from those in the assembler, so comparison uses path-keyed bytes / SHA-256; whole-document digests from different schemas are not treated as identical values.

The six original gap records are retained unchanged; only the "complete official MIT source text" substatus for `@esbuild/win32-x64@0.28.2` is separately recorded as RECOVERED, with the byte-exact 1069-byte original text and pinned source / lockfile evidence. The child package root still has no license file, and binary/source, native closure, redistribution review, and the root LICENSE remain unapproved. Only one `17cfa80e…` WASM is counted, actually decoded and checked in two containers. The notice pack is outside `dist` and must not be described as a completed public distribution package; rebuilt bytes must still be checked after the full check.

<!-- english-original-anchor --> <a id="r10-歷史-production-candidate-截點"></a>
## r10 Historical Production Candidate Cutoff

The [new pack manifest](../../../artifacts/v1/bundle-notice-pack-20261027-1914-r10/manifest.json) retains 158 whole originals + 15 original byte ranges, totaling 173 legal payloads / 1,079,808 bytes, 149 installed package manifests, and 15 source-map observed package names. The [independent production binding](../../../artifacts/v1/bundle-notice-pack-20261027-1914-r10/production-candidate-binding.json) compares each of the 12 bundle files from this round's actual production capture with the current dist bytes; the generator's original HISTORICAL_BUILD_CAPTURE label is not rewritten. Byte equality must still be checked separately after the final full check rebuild.

There is only one product WASM hash record: the same 17cfa80e…bytes were verified in two containers, installed rapier.mjs and the current bundled JS; these must not be described as two different WASM binaries. Six gaps remain: R3F published-source lineage, Rapier's exact Rust / WASM transitive closure, and gaps in obtaining the complete original texts for @esbuild/win32-x64, @humanfs/types, @rolldown/binding-win32-x64-msvc, and natural-compare. Metadata, the MIT abbreviation, or the latest text has not been used to fill gaps for unverified versions. This is an engineering provenance collection and candidate binding, not a public distribution, compliance determination, or root LICENSE decision.

<!-- english-original-anchor --> <a id="原依賴清冊與來源範圍"></a>
## Original Dependency Inventory and Source Scope

2026-10-27 local engineering dependency verification. See [V1_DEPENDENCY_LICENSE_INVENTORY-r2.json](../../01-compliance/V1_DEPENDENCY_LICENSE_INVENTORY-r2.json) for pinned versions, npm integrity, SHA-256 of original license / NOTICE files, and complete locations. This index is not yet a complete `THIRD_PARTY_NOTICES` for a public distribution package; before release, generate original-language notices that can accompany the package based on the actual bundle, WASM, tool binaries, and assets. The initial inventory is retained as a historical snapshot; the r2 validator additionally checks README / embedded notices without overwriting the old records.

All 149 locally installed packages have versions matching the root lockfile. The lockfile contains 199 package locations; the remaining 50 are all uninstalled optional platform packages. Installed license metadata is MIT 110, Apache-2.0 19, BSD-2-Clause 6, BSD-3-Clause 4, ISC 7, MPL-2.0 2, and BlueOak-1.0.0 1; no license metadata is blank. These counts are a metadata inventory and do not imply that each package contains only one license.

<!-- english-original-anchor --> <a id="必須保留的具體來源"></a>
## Specific Sources That Must Be Retained

| Scope | Pinned version / local original text | Handling status |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| React / React DOM | 19.3.1; `LICENSE` in each package | MIT; retain Meta's original copyright and full permission text. |
| R3F | 9.8.2; see the current pack's provenance / manifest for the complete official MIT text and the fixed acquisition record | The full permission text has been retained; the lineage connecting the acquired official source to npm's published 9.8.2 / tag has not yet been verified, so the tag correspondence must not be described as confirmed. |
| React reconciler included in R3F | `node_modules/@react-three/fiber/react-reconciler/index.js` | Contains a Meta MIT header, and the original file hash is listed in the inventory; do not omit Meta attribution because the outer package has a different author. |
| Three | 0.186.1; `node_modules/three/LICENSE` | MIT; does not include external models / textures from examples that have not been adopted. |
| Rapier JS / WASM | 0.21.0; `node_modules/@dimforge/rapier3d-compat/LICENSE` | Apache-2.0; the actual distributed WASM / Rust combination and applicable notices still require package-specific review. |
| Vite | 8.3.5; `node_modules/vite/LICENSE.md` | The file contains original bundled BSD-2 / CC0 / ISC / MIT and other texts; the MIT in the outer manifest cannot replace the full contents. |
| Rolldown | 1.2.15; `node_modules/rolldown/LICENSE`, `THIRD-PARTY-LICENSE` | Retain both its own license and third-party notices; the Windows native binding is a separate package location. |
| Playwright | 1.64.1; each `LICENSE` / `NOTICE` in `@playwright/test`, `playwright`, and `playwright-core` | Retain the actual NOTICE when distributing these tools; local or CI execution does not mean browser binaries are packaged into the product. |
| Lightning CSS / Windows binary | 1.33.0; `LICENSE` in each package; [official pinned-version MPL-2.0](https://raw.githubusercontent.com/parcel-bundler/lightningcss/v1.33.0/LICENSE) | Currently used for building. If tools / binaries are distributed, handle the applicable covered-source and notice obligations together; do not treat it as MIT-only. |
| esrecurse | 4.3.0; beginning of `node_modules/esrecurse/esrecurse.js` | No root license file was detected; the actual JS contains the full BSD notice, and the inventory retains the original file hash. |
| imurmurhash | 0.1.4; end of `node_modules/imurmurhash/README.md` | No root license file was detected; the README contains the full MIT text, and the inventory retains the original file hash. |
| natural-compare | 1.4.0; README copyright / MIT link | Attribution and license metadata have been seen; the full original text still needs to be retrieved and checked before release. |

No root LICENSE / NOTICE was detected for `@esbuild/win32-x64`, `@humanfs/types`, or `@rolldown/binding-win32-x64-msvc` either. Their manifests contain MIT / Apache-2.0 / MIT, but this does not remove the work of confirming the original texts and bundled components for distribution. Other uninstalled platform optional packages record only lockfile metadata; no local file hashes have been fabricated for them.

<!-- english-original-anchor --> <a id="發行邊界"></a>
## Distribution Boundaries

This engineering work has not distributed `node_modules`, browsers, the Steam Audio cache, third-party sound packs, or HRTF data. Inputs to the formal product build may still contain code from `devDependencies`; for example, Three, Rapier, and AJV are imported by `src` and should be checked separately against the actual bundle. Package classifications in source code cannot replace an inventory of distributed artifacts.

The user has not yet chosen a root LICENSE for Reflection Lab. This work did not accept competition / model service terms or decide an external license on the user's behalf, and did not apply the same license to the project merely because third parties use MIT / Apache. The development license inventory, product API service rights, and competition compliance are separate evidence.
