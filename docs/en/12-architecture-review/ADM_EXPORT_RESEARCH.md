<!-- english-source: {"translated_at":"2026-10-29T05:24:50.5856206Z","path":"docs/12-architecture-review/ADM_EXPORT_RESEARCH.md","sha256":"91824af97ff836d23667ae1c0700c4b3d9b48b2a46b35f50391bfc9a33123913","links":"english-relative","model_id":null,"executor":"Codex"} -->
<!-- english-notice:start -->
> English translation of [`docs/12-architecture-review/ADM_EXPORT_RESEARCH.md`](../../12-architecture-review/ADM_EXPORT_RESEARCH.md). Source SHA-256: `91824af97ff836d23667ae1c0700c4b3d9b48b2a46b35f50391bfc9a33123913`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="admbw64-匯出標準資料契約與驗證研究"></a>
# ADM/BW64 Export: Research on Standards, Data Contracts, and Validation

Access date: 2026-10-29 (Asia/Taipei). Research baseline: `c210ca882ca8503b322c28884bf1e9f6e9fe126d`. This is the English translation of the Traditional Chinese canonical research. It adds no ADM exporter, dependency, or external delivery, and claims no Dolby, DAW, or platform compatibility. `CR-ADM-*` are local Claim IDs for this review and have not been registered in the central Ledger.

<!-- english-original-anchor --> <a id="1-結論與現況"></a>
## 1. Conclusion and Current State

A separate export pipeline could build on the existing stable source IDs, recording timeline, and asset provenance. For now, retain a minimal data contract and validation plan; do not add an ADM serializer to the realtime audio path. General ADM metadata, the BW64 container, the Dolby Atmos Master ADM Profile, and consumer playback codecs are four different layers.

**CR-ADM-001 / VERIFIED fact (code):** Production code currently has no ADM/BW64 exporter. `src/audio/wav.ts` performs bounded import preflight for uncompressed RIFF/WAVE PCM/float32. Its header check rejects BW64/RF64, but skips unknown RIFF chunks. Some RIFF-container ADM BWF PCM files might therefore be accepted as ordinary WAV. It would be wrong to state that every WAV containing ADM is rejected; the actual limitation is that `axml`, `chna`, and ADM semantics are neither interpreted nor retained.

The source phase/AudioEngine epoch cursors in `src/experiments/types.ts` and `src/experiments/recorder.ts` explicitly are not hardware PCM read pointers; the archive is canonical JSON. `src/app/replay-audio.ts` separates source seconds from propagation and replays captured decisions through the existing SourceGraph. These provide provenance and replay inputs for a future exporter, not evidence of independently rendered stem PCM. Searches for ADM/BW64/RF64/`audioTrackUID`/`audioBlockFormat` across `src/`, `server/`, `schemas/`, and `package.json` found no production implementation. Existing recording JSON or stereo renders are not ADM objects.

In this report, **VERIFIED fact** refers only to official specification or code facts that were read; **analytical** identifies project derivations; **PROPOSED** identifies work not adopted or implemented; **UNVERIFIED** identifies missing evidence. A parser accepting XML does not establish complete standard/profile conformance or destination acceptance.

<!-- english-original-anchor --> <a id="2-標準容器與互通層次"></a>
## 2. Standards, Containers, and Interoperability Layers

| Claim/layer | Verified fact | Project implication |
| --- | --- | --- |
| CR-ADM-002 / ADM model | ITU-R BS.2076-3 (02/2025) is officially In force; Objects, DirectSpeakers, HOA, and Binaural have different semantics | Declare the version; do not label all spatial audio as objects |
| CR-ADM-003 / BW64 container | ITU-R BS.2088-2 (11/2025, with 2026 editorial amendments) is In force; BW64 uses `BW64` magic and a first `ds64` chunk; `axml` carries XML and `chna` maps PCM tracks to ADM IDs | Separate the serializer from the PCM writer; renaming an ordinary RIFF file does not make it BW64 |
| CR-ADM-004 / Data graph | ADM programme/content/object/pack/channel/track references must agree with PCM allocation | Map stable domain IDs to legal ADM IDs; do not silently omit missing references |
| CR-ADM-005 / Profile | General ADM/BW64 compatibility does not imply the additional Dolby master profile constraints | Require independent gates for `targetProfile`, version, and destination; do not promise Atmos in advance |

BS.2076-3 supports decimal and sample-based time. Declare `audioFormatExtended.version` explicitly; omission identifies the initial BS.2076-0 version. These standard features do not mean every existing library or DAW supports them. An initial exporter should select a fixed common subset rather than silently writing newer fields into an older profile. [ITU BS.2076-3 official status](https://www.itu.int/rec/R-REC-BS.2076-3-202502-I/en), [official PDF](https://www.itu.int/dms_pubrec/itu-r/rec/bs/R-REC-BS.2076-3-202502-I!!PDF-E.pdf)

`chna.trackIndex` starts at 1 and corresponds to the channel order in interleaved PCM. ADM UIDs and physical tracks need not remain one-to-one; a track may be reused at different times, but allocation must be explicit. The proposed minimal exporter avoids track reuse and uses independent complete stems with fixed mappings for easier verification. [BS.2088 official status](https://www.itu.int/rec/R-REC-BS.2088/en), [official PDF](https://www.itu.int/dms_pubrec/itu-r/rec/bs/R-REC-BS.2088-2-202511-I!!PDF-E.pdf), [EBU CHNA explanation](https://adm.ebu.io/guidelines/reference/excursions/chna_chunk.html)

<!-- english-original-anchor --> <a id="3-三種出口先明確選擇"></a>
## 3. Choose Explicitly Between Three Export Types

**CR-ADM-006 / VERIFIED fact (standard semantics) + PROPOSED (project classification):** Object-based delivery requires independently processable audio channels and metadata. XML alone cannot recover individual sources after mixing them into binaural stereo. Ordinary stereo DirectSpeakers and headphone Binaural also have different meanings. [EBU audio types](https://adm.ebu.io/background/audio_types.html)

| Export | Required PCM | Supported claim and limits |
| --- | --- | --- |
| `dryObjectMaster` | An independent dry stem per logical source/instance; explicit gain/pitch/envelope responsibilities | Exchanges an authoring scene; a general ADM renderer will not automatically reproduce this project's room reflections, materials/atmosphere, occlusion, or late reverb |
| `bakedBinaural` | Final stereo PCM for a selected listener trace and renderer | Preserves that listening result; does not recover objects or retain a scene with a freely moving listener |
| `bakedSpeaker` / future HOA | Multichannel PCM with a specified layout/HOA conventions | Preserves a baked spatial result; is not the original emitter/acoustic simulation graph |

Do not promote every transient acoustic path directly to an ADM object. Path birth/death, approximation budgets, and source semantics occupy different layers, and doing so could duplicate source/direct sound. Any later research on baked reflection objects needs an explicit export contract and receiver reference, evidence that direct and reflected components each occur once, and acknowledgement that this is a particular rendering representation rather than a room model that can be recomputed. Keep room geometry, material provenance, solver configuration, and listener traces in a versioned sidecar. ADM does not replace Scene/Experiment.

<!-- english-original-anchor --> <a id="4-明確座標轉換"></a>
## 4. Explicit Coordinate Conversion

**CR-ADM-007 / VERIFIED fact (official axes):** ADM Objects Cartesian uses +X right, +Y front, and +Z up, commonly with a normalized cube. HOA uses +X front, +Y left, and +Z up. Reflection Lab uses SI metres, +X right, +Y up, and -Z front. Its `[x,y,z]` values cannot be copied directly. [EBU coordinate systems](https://adm.ebu.io/guidelines/reference/excursions/coordinate_system.html)

The following is a **PROPOSED/analytical** Objects conversion, assuming the reference frame follows Reflection Lab's forward/up definitions:

```text
r = inverse(R_reference) * (p_world_m - referenceOriginWorldM)
positionADMObjects = [r.x, -r.z, r.y] / metersPerNormalizedUnit
metersPerNormalizedUnit = D > 0
```

`[x,-z,y]` is a proper rotation; division by D is an explicit scale policy. Do not apply this to HOA. A future HOA study must separately define axes, ACN/order/normalization, and the selected ADM subset. A source quaternion also cannot be copied into unspecified ADM fields.

The minimal contract should include:

```typescript
interface ExportSpatialReference {
  coordinatePolicy: "fixedReference" | "listenerRelativeBaked";
  referenceOriginWorldM: [number, number, number];
  referenceOrientationQuaternion: [number, number, number, number]; // [x,y,z,w]
  metersPerNormalizedUnit: number;
  outOfRangePolicy: "fail" | "explicitUniformRescale";
  coordinateAdapterVersion: string;
}
```

This is a data design proposal with no schema or implementation. Values outside the selected subset/profile should fail, or use an explicit uniform scale across the whole scene. Do not silently clamp individual axes or objects. Start with a fixed reference and keep the listener trajectory in a sidecar. `listenerRelativeBaked` is a policy for a particular listening result, not a complete moving-listener scene exchange.

Required analytical fixtures include all six cardinal directions, a nonzero reference origin, reference yaw/pitch, round-trip conversion, scale, out-of-range values, and NaN. For example, project forward `[0,0,-D]` must become Objects `[0,1,0]`, and up `[0,D,0]` must become `[0,0,1]`. These are hand-calculated expectations only; **exporter coordinate tests were not run in this review**.

<!-- english-original-anchor --> <a id="5-時間獨立-stems-與一次性烘焙責任"></a>
## 5. Timing, Independent Stems, and Once-Only Baking Responsibilities

**CR-ADM-008 / VERIFIED fact (official semantics):** `audioObject.start` is relative to file start; `audioBlockFormat.rtime` is relative to object start. EBU guidance recommends chronological, contiguous blocks and a first block starting at zero. Durations must agree with actual PCM intervals. [Timing guide](https://adm.ebu.io/guidelines/tutorial/timing.html), [Dynamic metadata](https://adm.ebu.io/guidelines/tutorial/dynamic.html)

**PROPOSED:** Use integer sample indices in the export file as the timing authority, with a rational tick-to-sample mapping and explicit origin/rounding policy. Compute sample placement from the absolute tick; do not round each tick and accumulate the result, which causes long-term drift. Define loops, one-shots, pitch automation, fades, pause/seek, resampling, trimming, and tails explicitly. The existing logical cursor is not a full recording of all past audio automation or filter state.

```typescript
interface ExportStemContract {
  logicalSourceId: string;
  instanceId: string;
  pcmAssetSha256: string;
  generatorVersion: string | null;
  seed: number | null;
  sampleRateHz: number;
  pcmEncoding: string;
  channelCount: number;
  totalSampleFrames: number;
  fileStartSample: number;
  sourceStartSample: number;
  durationSamples: number;
  tailSamples: number;
  gainApplied: boolean;
  pitchApplied: boolean;
  envelopeApplied: boolean;
  propagationApplied: boolean;
  hrtfApplied: boolean;
  lateReverbApplied: boolean;
}
```

These are draft minimum fields. IDs/references, metadata blocks, versions, source rights, hashes/dither/normalization, `sourceToTrackMap`, `admIdMap`, and export policies still require a formal schema. A physical PCM track index is its position inside the container, not a source domain ID. Do not truncate according to the active voice budget, mix sources, and continue to describe the tracks as independent objects. Insufficient capacity should fail explicitly or require a baked export type.

**CR-ADM-009 / analytical + PROPOSED:** A dry object stem follows the emission clock; an arrival render includes propagation. If PCM already contains propagation delay, HRTF, or late reverb, later stages must not apply them again. Flags such as `propagationApplied` describe export responsibilities; they do not mean ADM provides room simulation. To preserve a particular Reflection Lab listening result, first produce verifiable PCM and record renderer/browser version, sample rate, listener trace, and acoustic configuration hashes. Dry audio plus positions alone cannot reproduce the original SourceGraph.

<!-- english-original-anchor --> <a id="6-可研究的工具與部署邊界"></a>
## 6. Candidate Tools and Deployment Boundaries

| Tool | VERIFIED fact (official README) | Still required before adoption |
| --- | --- | --- |
| [EBU libadm](https://github.com/ebu/libadm) | C++11 ADM XML parsing/creation/writing; README identifies incomplete revision/element support and no S-ADM support | Pin release/commit and selected subset; do not assume complete BS.2076-3 support |
| [EBU libbw64](https://github.com/ebu/libbw64) | Header-only BW64 reader/writer listing ds64/axml/chna and integer PCM16/24/32 | Verify actual writer features, chunk order, large-file and encoding behavior; it is not a general codec |
| [EBU EAR](https://github.com/ebu/ebu_adm_renderer/blob/master/README.md) | Independent ADM/BW64 rendering/dumping, with strict and overload-related options | Its documentation still references older ADM; qualify the subset/version first; rendering does not establish full profile compatibility |

The official libadm/libbw64 repositories identify Apache-2.0. No dependencies were downloaded, compiled, or added in this review. Future adoption requires pinned versions, a complete dependency/notice inventory, and a decision between a C++ server/offline helper and a verified WASM build. Do not force a native SDK into the realtime audio callback for export. Use a separate cancellable export job with bounded memory/disk/duration, explicit errors, and preservation of the old project on failure.

<!-- english-original-anchor --> <a id="7-dolby-與-consumer-playback-分開"></a>
## 7. Separate Dolby from Consumer Playback

**CR-ADM-010 / VERIFIED fact (limited public evidence):** The Dolby Atmos Master ADM Profile adds constraints that do not follow from general BS.2076 or BW64 validity. An official v1.0 PDF URL exists. Search-index excerpts identify 2019-07-22, BS.2076-0, and additional constraints, but direct fetching returned 502 and excerpts included a Confidential header. This review did not read or redistribute the full profile, and does not treat the old index excerpts as the latest complete requirements. [Official Dolby profile URL](https://developer.dolby.com/globalassets/documentation/technology/dolby_atmos_master_adm_profile_v1.0.pdf)

Dolby's public workflow describes ADM BWF as a production/delivery master that is subsequently encoded into a distribution format; the stereo master is delivered separately. Producing an ADM file therefore does not establish consumer Atmos playback or music-platform release eligibility. [Dolby Music workflow](https://professionalsupport.dolby.com/s/article/Getting-Started-with-Dolby-Atmos-Music)

**UNVERIFIED:** The latest complete Dolby profile, vendor extensions, selected DAW importer, actual destination acceptance, playback codecs, certification/trademark/licensing requirements. This review accepts no third-party terms on the user's behalf. A future export manifest should at least record `targetProfile`, `profileVersion`, `validatorVersion`, destination, and actual result. Do not relabel a failed destination test as general ADM PASS and present it as success against the same target.

<!-- english-original-anchor --> <a id="8-可重現驗證計畫與本輪狀態"></a>
## 8. Reproducible Validation Plan and Actual Review Status

This review performed read-only code and official-source research only. **No ADM serializer, PCM export, libadm/libbw64, EAR, DAW, or Dolby compatibility tests were run.** There is no exporter, so no empty tests mirroring a draft contract were added. All gates below are PROPOSED:

1. Fix the standard/profile/subset and negative fixtures: XML version/schema, reference graph, duplicate IDs, missing references, unknown attributes. Separate parsing success from complete conformance.
2. Validate real PCM interleaving, sample count, bit depth, endianness, chunk sizes/padding, `ds64`, `axml`, and `chna`; track indices start at 1, and UID allocation must agree exactly with PCM. Include large-file and truncation failures.
3. Use different impulses and source IDs per stem. Position blocks and PCM share a sample origin. Test six axes, round-trip conversion, nonzero references, integer time, loops/pitch/fades, trimming, pause/seek, and tails.
4. Verify dry/baked responsibilities: no duplicate gain, propagation, HRTF, or late reverb. Stereo input must not masquerade as object decomposition; insufficient capacity fails explicitly.
5. Round-trip through two independent parsers. Render the selected subset with EAR, checking overload and measuring/listening for direction. Import and re-export in the selected DAW. Record versions, flags, and hashes; self-round-trip through one serializer is insufficient.
6. Measure peak memory for large exports, cancellation/crash recovery, atomic completion/failure preservation, rights provenance, dependency notices, and sidecar completeness. Validate the actual final destination against its requirements separately.

A reasonable next step is to choose an export type and a public, fixed minimal ADM subset, then design offline capture of independent mono stems. Choose a writer after actual PCM/sample-origin evidence exists. This remains a future feature proposal; it is not automatically part of the frozen V1 gates and is not implemented.

<!-- english-original-anchor --> <a id="9-官方來源與存取紀錄"></a>
## 9. Official Sources and Access Record

All access dates are 2026-10-29. Only original summaries and links are retained, not third-party full texts.

| ID | Official source/version | Review access |
| --- | --- | --- |
| ADM-S01 | [ITU BS.2076-3 status](https://www.itu.int/rec/R-REC-BS.2076-3-202502-I/en) / [PDF](https://www.itu.int/dms_pubrec/itu-r/rec/bs/R-REC-BS.2076-3-202502-I!!PDF-E.pdf) | In force; relevant PDF sections 5, 5.13, and 6–9 readable; not a claim that every paragraph was fully reviewed |
| ADM-S02 | [ITU BS.2088](https://www.itu.int/rec/R-REC-BS.2088/en) / [BS.2088-2 PDF](https://www.itu.int/dms_pubrec/itu-r/rec/bs/R-REC-BS.2088-2-202511-I!!PDF-E.pdf) | Current edition and relevant container/chunk rules readable; superseded 2088-1 is not treated as current authority |
| ADM-S03 | [EBU coordinates](https://adm.ebu.io/guidelines/reference/excursions/coordinate_system.html) / [types](https://adm.ebu.io/background/audio_types.html) | Official explanations readable; project matrix/scale separately labeled analytical/proposed |
| ADM-S04 | [EBU timing](https://adm.ebu.io/guidelines/tutorial/timing.html) / [dynamic](https://adm.ebu.io/guidelines/tutorial/dynamic.html) / [CHNA](https://adm.ebu.io/guidelines/reference/excursions/chna_chunk.html) | Official guidelines readable; guidance does not replace formal selected-profile constraints |
| ADM-S05 | [libadm](https://github.com/ebu/libadm) / [libbw64](https://github.com/ebu/libbw64) / [EAR](https://github.com/ebu/ebu_adm_renderer/blob/master/README.md) | Official READMEs, capabilities, and limits; no library pinning, installation, build, or execution |
| ADM-S06 | [Dolby profile v1.0](https://developer.dolby.com/globalassets/documentation/technology/dolby_atmos_master_adm_profile_v1.0.pdf) | Official URL/search-index excerpts; direct fetch returned 502; full/latest complete requirements UNVERIFIED |
| ADM-S07 | [Dolby Music workflow](https://professionalsupport.dolby.com/s/article/Getting-Started-with-Dolby-Atmos-Music) | Public official workflow; no account, DAW, submission, or playback test |
