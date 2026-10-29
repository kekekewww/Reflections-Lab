<!-- english-source: {"path":"research/datasets/DATASET_CATALOG.md","sha256":"6409763e9fb8c7fe1d1c4b312f068cff3b025b383d0e71f8679d5498fef5d3ca","translated_at":"2026-10-27T03:42:10Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`research/datasets/DATASET_CATALOG.md`](../../../../research/datasets/DATASET_CATALOG.md). Source SHA-256: `6409763e9fb8c7fe1d1c4b312f068cff3b025b383d0e71f8679d5498fef5d3ca`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="dataset-catalog"></a>
# Dataset Catalog

Review date: 2026-10-26 (Asia/Taipei). This table covers dataset selection and validation design; **no third-party audio data has been downloaded, reproduced or executed**. `PAGE_VERIFIED` means that the official dataset page has been read; `FULL_TEXT_VERIFIED` applies only to the full text of a paper that was explicitly opened. Public availability for download and permission to redistribute are different conditions; `UNKNOWN` must not be filled in using another dataset's license, a code license or Zenodo defaults.

<!-- english-original-anchor --> <a id="優先選用"></a>
## Priority selections

| ID | Dataset / reference implementation | Category | Individual license review | First validation use | Acquisition status |
|---|---|---|---|---|---|
| D01 | pyroomacoustics | Independent geometrical acoustics reference implementation / synthetic RIR | MIT; official README reviewed | V3: shoebox direct-sound and first-order reflection arrival times | NOT RUN |
| D02 | SADIE II | HRIR, BRIR, SOFA | Apache-2.0, explicitly stated on the official page | V2: SOFA coordinates, left/right ears, direction and sampling rate | NOT RUN |
| D03 | BRAS v3 | Reflection, scattering, diffraction and measurement benchmark scenes | CC BY-SA 4.0, explicitly stated in the complete official metadata | V3/V5: select one reference scene and compare frequency response / RIR | NOT RUN |
| D04 | Acoustic screens and two-layer systems | Absorption, complex reflection and normalized surface impedance | Official page explicitly states CC BY; version number not displayed in the text | V1/V5: complex reflection and absorption conversion, measurement variability | NOT RUN |
| D05 | dEchorate | Measured RIR with early-echo annotations | Data UNKNOWN; accompanying code MIT | V5: early-reflection annotations and geometrical arrival times | NOT RUN; license pending |
| D06 | RealImpact | Real-object impact sound fields and contact force | Code MIT; individual licenses for external audio files UNKNOWN | V5: relationship of impact force to sound modes / directivity | NOT RUN; license pending |
| D07 | OpenAIR | Measured RIR from different spaces | Individual item licenses not obtained in this review; UNKNOWN | V2/V5: convolution, EDC, decay and differences between spaces | NOT RUN; file-by-file review pending |
| D08 | OpenSLR SLR26 | Synthetic RIR | Apache-2.0, explicitly stated on the official page | V2: batch RIR import and resampling | NOT RUN |
| D09 | RIEC HRTF | Human HRTF | Limited to academic / research / educational use; commercial use requires permission; modified data must not be made public again | Excluded from default competition assets | NOT RUN; restricted |

D01–D04 have traceable license statements and explicit validation uses, sufficient to establish an acquisition list of at least three practical validation sources. Files must still be acquired, accompanying terms checked, SHA-256 calculated and tests executed before the status can become `ACQUIRED` or `TESTED`. This table does not mean that any competition rules have approved third-party data; competition applicability should also be linked to the project's compliance review.

<!-- english-original-anchor --> <a id="d01--pyroomacoustics"></a>
## D01 — pyroomacoustics

- **Source / version**: EPFL LCAV's [official repository](https://github.com/LCAV/pyroomacoustics) and [Room Simulation documentation](https://pyroomacoustics.readthedocs.io/en/pypi-release/pyroomacoustics.room.html). The documentation was marked 0.10.0 in this review; no package artifact has been installed or pinned yet.
- **Method / environment**: 2D / 3D image-source and ray tracing, producing synthetic RIR. Suitable for static indoor geometry comparisons; it is not measured ground truth.
- **Frequency / sampling rate / configuration**: The experiment must explicitly specify the sampling rate, room dimensions, sources / microphones and reflection order. This project recommends `fs=48000 Hz`, `max_order=1` and disabling randomized ISM to compare direct and first-order arrival times first; these are this project's test settings.
- **Metadata / limitations**: Retain the version, geometry, material energy absorption, speed of sound, order and seed. The documentation warns that the old `absorption` is not the current energy absorption; the hybrid solver is still labeled experimental.
- **License / competition / redistribution**: MIT; retain the copyright and permission notice. It may serve as a reference implementation for the competition. The built-in material table must not uniformly be labeled as measured values; material provenance needs a separate review.
- **Acquisition / testing**: Pin a release or commit and package hash before installation; generate only small synthetic RIRs. When comparing arrival times, first record the global additional fractional-delay latency of `frac_delay_length // 2` samples; this must not be counted as acoustic propagation time. `PAGE_VERIFIED`; execution `NOT RUN`.

<!-- english-original-anchor --> <a id="d02--sadie-ii"></a>
## D02 — SADIE II

- **Source / version**: [University of York official SADIE II page](https://www.york.ac.uk/sadie-project/database.html), which lists the latest release as `v2-2 (18-06-2024)`. The complete page text was readable through the official index in this review; direct opening previously returned 403, and no data was downloaded.
- **Method / environment**: HRIR measured using a Genelec 8010 at a 1.2 m radius from the head center; BRIR measured using Genelec 8030/40 at 1.5 m with a 50-point Lebedev configuration. Human subjects and dummy heads must be identified separately.
- **Frequency / sampling rate / configuration**: WAV is available at 44.1 kHz / 16 bit, 48 kHz / 24 bit and 96 kHz / 24 bit, as well as AES69 SOFA. The usable acoustic frequency band must be read from each file's metadata; the Nyquist frequency must not be treated as a guaranteed bandwidth.
- **Metadata**: Includes measurement directions and head and ear data. Official azimuth uses forward as 0° and increases counterclockwise toward the left. Import must explicitly convert this to the project coordinates.
- **License / competition / redistribution**: The official page explicitly states Apache-2.0 and requires citation of the original data; retain notices and mark modifications. Source: [Apache terms](https://www.apache.org/licenses/LICENSE-2.0). Head scans or photographs are not needed for testing.
- **Validation / acquisition**: First select a small dummy-head SOFA file and check the release, left/right ears, directions, `Data.SamplingRate` and terms; use known directions to test ITD / ILD and rotation mapping. Avoid mixing the old SADIE Database with SADIE II. `PAGE_VERIFIED`; `NOT RUN`.

<!-- english-original-anchor --> <a id="d03--bras--benchmark-for-room-acoustical-simulation"></a>
## D03 — BRAS — Benchmark for Room Acoustical Simulation

- **Source / version**: Aspöck, Brinkmann, Ackermann, Weinzierl, Vorländer, 2020 v3; [DOI 10.14279/depositonce-6726.3](https://doi.org/10.14279/depositonce-6726.3), [complete official metadata and license](https://depositonce.tu-berlin.de/items/38410727-febb-4769-8002-9c710ba393c4/full). Paper: [10.1016/j.apacoust.2020.107867](https://doi.org/10.1016/j.apacoust.2020.107867).
- **Method / environment**: Seven reference scenes isolate phenomena such as reflection, scattering and diffraction; four complex rooms are appended. The official description specifically notes higher measurement uncertainty in the latter, so they cannot serve as direct references.
- **Frequency / sampling rate / configuration**: Each scene has separate geometry and source / receiver descriptions, plus surface descriptions. **The original Documentation.pdf was not read in this review, so each scene's sampling rate, effective frequency band, calibration and scattering-coefficient definition cannot be confirmed**; retain UNKNOWN and complete the review before acquisition.
- **Metadata / limitations**: Closer to a solver benchmark than a general RIR library. Source directivity, receiver response, environment and boundary conditions must be included; comparing only uncalibrated peak values is insufficient.
- **License / competition / redistribution**: The metadata explicitly states CC BY-SA 4.0; cite the source and comply with the same license conditions when redistributing modified data. See [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).
- **Validation / acquisition**: Obtain the official documentation first, then select the smallest suitable reference-scene archive. Retain a dependency list of geometry, RIR, materials and sources / receivers. The smaller RS6 / RS7 archives are not necessarily more suitable for a first-order reflection test; read the scene definitions first. `PAGE_VERIFIED`; paper reviewed only through the publisher preview; `NOT RUN`.

<!-- english-original-anchor --> <a id="d04--statistical-characterisation-and-responses-of-acoustic-screens-and-two-layers-systems"></a>
## D04 — Statistical characterisation and responses of acoustic screens and two-layers systems

- **Source**: Gaborit, Jaouen, Dazel, Göransson, 2019; [Zenodo pinned version 10.5281/zenodo.3967083](https://zenodo.org/records/3967083). The author page requires citation of the concept DOI `10.5281/zenodo.3358921`.
- **Method / environment**: Three-microphone impedance tube with 44.44 mm internal diameter; woven / nonwoven film and melamine / glass wool backing, including cavity and rigid-backing configurations. Recalibrated for every session; repeated samples can be used to observe measurement variability.
- **Frequency / sampling rate / configuration**: The page lists a measurement sweep of `[4,4520] Hz`; this does not guarantee reliability over the entire range. The sampling rate is in the `.irk` metadata for each measurement; files were not acquired in this review, so the value is UNKNOWN.
- **Metadata**: `.irk` contains thickness, cavity, temperature, pressure and humidity; `.rok` contains absorption, complex reflection and normalized surface impedance; YAML characterization is also included.
- **License / competition / redistribution**: Official text explicitly states CC BY and requires citation, but the page does not display a version number. It may be listed as a validation candidate; resolve the record's license URI before redistribution and do not fill in `CC-BY-4.0` independently.
- **Validation / acquisition**: The official `dataset.zip` is about 40 MB; obtain only the README / metadata first, then select one measurement group. Tests of `alpha = 1 - abs(R)^2` and `R=(z-1)/(z+1)` must be limited to normal incidence, the same medium and the corresponding backing conditions with no energy transmission. These are not indoor diffuse-field absorption or scattering data. `PAGE_VERIFIED`; `NOT RUN`.

<!-- english-original-anchor --> <a id="d05--dechorate"></a>
## D05 — dEchorate

- **Source**: [Zenodo v1 10.5281/zenodo.4626590](https://zenodo.org/records/4626590), [official code](https://github.com/Chutlhu/dEchorate), [authors' full-text paper](https://arxiv.org/html/2104.13168); Di Carlo et al., 2021. The accompanying repository already lists a v3.0.0 update; the v1 DOI must not be mixed with newer data.
- **Method / environment**: A cuboid room with adjustable wall conditions and multichannel RIR, with annotations of actual sources, microphones, image sources and early-echo timing.
- **Frequency / sampling rate / configuration**: Must be checked against the selected HDF5 / SOFA version; no files were acquired for this table, so sampling rate and effective frequency band are UNKNOWN. The single v1 HDF5 is about 83.9 GB and is unsuitable as a default bootstrap download.
- **Metadata / limitations**: Echo annotations suit reflection-arrival-time validation. The paper also lists annotation limitations; annotations do not mean every peak is an exact true value. Static measurements moved to different positions cannot directly serve as continuous Doppler recordings.
- **License / competition / redistribution**: The code README / repository is MIT; the Zenodo Rights section did not display an identifiable license in this review, and the API domain failed local resolution. **The data license is UNKNOWN; neither the code's MIT license nor a default Zenodo CC BY license can replace it.** Use of the audio in the competition and redistribution are paused for now.
- **Validation / acquisition**: After resolving the data terms, prioritize a small official SOFA subset; record the exact DOI, echo IDs, coordinates and processing. `FULL_TEXT_VERIFIED`: paper readable; `PAGE_VERIFIED`: data / code; data `NOT RUN`.

<!-- english-original-anchor --> <a id="d06--realimpact"></a>
## D06 — RealImpact

- **Source**: Clarke et al., CVPR 2023; [authors' official page](https://samuelpclarke.com/realimpact/), [official repository](https://github.com/samuel-clarke/RealImpact), [download script](https://raw.githubusercontent.com/samuel-clarke/RealImpact/main/dataset/download.sh).
- **Method / environment**: Controlled impact-hammer strikes on real objects; 15 measurement microphones move with a gantry to sample the sound field around each object. Includes contact-force curves, impact locations, microphone positions, materials and RGBD annotations.
- **Frequency / sampling rate / configuration**: Original audio files were not read in this review; sampling rate, calibration and usable frequency band are UNKNOWN. Demo audio must not be treated as measurement files.
- **Metadata / limitations**: Can compare modal frequencies, decay, angular differences and force-profile excitation. Does not cover all actual free falls, breakage, rolling or scraping. The repository states that raw data and the remaining code are still being organized.
- **License / competition / redistribution**: The repository is labeled MIT, but the script downloads compressed audio from an external Stanford host. This review did not find separate terms explicitly placing that audio under MIT, so **audio UNKNOWN, code MIT**. It must not directly be treated as a competition sound-effects library.
- **Validation / acquisition**: Clarify the external audio license first, then pin object ID / impact ID / mic ID and acquire a single-object subset. The official script fetches all objects in a batch and deletes archives; it should not be executed without review. `PAGE_VERIFIED`; paper reviewed only through abstract / index, PDF access failed; `NOT RUN`.

<!-- english-original-anchor --> <a id="d07--openair"></a>
## D07 — OpenAIR

- **Source**: [University of York official project page](https://www.york.ac.uk/physics-engineering-technology/research/communication-technologies/projects/open-acoustic-impulse-response-library/); the data site `openair.hosted.york.ac.uk` timed out during this review.
- **Method / environment**: Collects acoustic surveys of real spaces and model results; provides formats including stereo, B-format and 5.1, plus some raw data. Not all items can be called measured RIRs.
- **Frequency / sampling rate / configuration / metadata**: Room geometry, sources / receivers, excitation, sampling rate, channel ordering and measurement calibration must be read for each item. None were confirmed file by file in this review; UNKNOWN.
- **License / competition / redistribution**: The official project page mentions commercial audio applications, but that is insufficient to establish redistribution permission for any audio file. Individual terms are UNKNOWN in this review; do not download into Git.
- **Validation / acquisition**: Once an item's license review is complete, it can be used for convolution, EDC, T20 / T30 and C50 / C80 pipeline tests. Without exact geometry / boundary conditions, it must not serve as a standard for solver error at individual peaks. `PAGE_VERIFIED`: project page; data site inaccessible; `NOT RUN`.

<!-- english-original-anchor --> <a id="d08--openslr-slr26"></a>
## D08 — OpenSLR SLR26

- **Source**: [OpenSLR 26 official page](https://www.openslr.org/26/), associated with data-augmentation research.
- **Method / environment**: **Synthetic** RIRs for different room configurations, originally intended for reverberant-speech / ASR data augmentation.
- **Frequency / sampling rate / configuration**: Available as two packages, 8 kHz and 16 kHz. Room geometry and processing details must be read after acquisition. Upsampling cannot generate real higher-frequency reflection data.
- **Metadata / limitations**: Only the official dataset page was reviewed; metadata within the archives was not inspected. Cannot serve as measured validation or directly prove that low-frequency modes, scattering and diffraction are correct.
- **License / competition / redistribution**: The official page explicitly states Apache-2.0; retain terms / notices and modification records. Competition use must still comply with the overall rules.
- **Validation / acquisition**: Pin the mirror, filename and checksum first; select only a few RIRs for V2 parsing, convolution and resampling regression. The two packages are about 128 MB / 178 MB respectively; there is no need to fetch everything by default. `PAGE_VERIFIED`; `NOT RUN`.

<!-- english-original-anchor --> <a id="d09--riec-hrtf保留作受限來源示例"></a>
## D09 — RIEC HRTF: retained as an example of a restricted source

- **Source**: [Tohoku University official dataset page](https://www.riec.tohoku.ac.jp/pub/hrtf/) (official indexed text was readable during this review; direct opening returned 404), related to Watanabe et al. 2014.
- **Method / configuration**: Human HRTF; the official page lists 105 subjects, 865 directions per ear and some anthropometric data. Sampling rate and frequency band were not verified in this review; UNKNOWN.
- **License / competition / redistribution**: Official terms permit research, academic and educational use and require citation. Commercial use requires prior permission, and modified data must not be made public again. A competition with prize money cannot automatically be inferred to be noncommercial; excluded from default artifacts and demo assets.
- **Validation value**: With the corresponding permission, it could be used to compare individual differences and HRTF interpolation. SADIE II already offers clearer licensing, so acquisition is unnecessary at this time. `PAGE_VERIFIED`: official index; `NOT RUN`.

<!-- english-original-anchor --> <a id="sofa-匯入規約"></a>
## SOFA import conventions

The [official SOFA specification entry point](https://www.sofaconventions.org/mediawiki/index.php/SOFA_(Spatially_Oriented_Format_for_Acoustics)) explains that the format is used for HRTF, BRIR and SRIR and is standardized by AES69. **SOFA is a format, not a content license**; terms must still be checked for every dataset mirrored on the same site.

When reading, retain `SOFAConventions` / version, `Data.SamplingRate` / Units, `Data.Delay`, `SourcePosition` / Type / Units, `ReceiverPosition`, `ListenerView` / `ListenerUp`, `Data.IR` dimensions, left/right ear ordering and original `License` / `References`. These are this project's importer validation requirements; each convention's required fields and meanings are governed by that version of the specification. Do not assume all SOFA files are SimpleFreeFieldHRIR.

<!-- english-original-anchor --> <a id="可重現取得與驗證契約"></a>
## Reproducible acquisition and validation contract

An [acquisition tool](../../../../scripts/setup/datasets.mjs), [actual example manifest](../../../../research/datasets/acquisition-manifest.example.json) and [offline validation](../../experiments/dataset-fetch-spike/README.md) have been established in this work. The tool defaults to dry-run and returns BLOCKED for UNKNOWN / missing pins. This catalog still has not acquired real data; mock tests are not promoted to measurement evidence. The specification example below explains the fields; actual execution requires the complete example format and file-by-file evidence.

1. First establish a manifest containing at least `dataset_id`, `record_doi`, `version`, `source_url`, `download_url`, `license_id`, `license_url`, `license_scope`, `accessed_at`, `file_name`, `size_bytes`, `sha256`, `subset_ids`, `modifications`, `attribution` and `test_ids`. Use `null` for unknown fields; do not guess values.
2. Only pinned files with `license_status=VERIFIED` may be passed to the acquisition tool. Default to dry-run, limit total bytes and restrict downloads to a single subset. Stop and repeat the review if the URL, license or file hash changes. External download scripts must not execute by default.
3. Store original files in a data directory ignored by Git; manifests, original parsing code and result metrics may be version-controlled. Before redistributing a data subset, complete that subset's terms, attribution and modification record.
4. Tests must first read headers / metadata and check units, channels, finite values, sample length, signal delay and normalization. Retain raw and processed SHA-256. Record all resampling / deconvolution / cropping / gain normalization.
5. Use V2 to check DSP, V3 to compare against an independent solver and V5 to compare against measurements. Do not promote synthetic data or self-comparison using formulas from the same source to V5. RIR peak errors require calibration of source / receiver response, start time and bandwidth first. Report T30 as invalid when the required decay range is insufficient.

The following is a **specification example expected by the acquisition tool; it does not yet correspond to any downloaded file**:

```json
{
  "dataset_id": "D02",
  "record_doi": null,
  "version": "v2-2",
  "source_url": "https://www.york.ac.uk/sadie-project/database.html",
  "download_url": null,
  "license_id": "Apache-2.0",
  "license_status": "VERIFIED_PAGE_ONLY",
  "license_scope": "SADIE II database official page; verify accompanying file notices",
  "file_name": null,
  "sha256": null,
  "subset_ids": [],
  "max_download_bytes": 50000000,
  "dry_run": true,
  "acquisition_status": "NOT_RUN"
}
```

<!-- english-original-anchor --> <a id="待完成項目"></a>
## Outstanding items

- Complete the frequency band, sampling rate, environment, calibration and material-coefficient definitions for each scene from the original BRAS documentation; the official PDF endpoint was inaccessible during this review.
- Complete D04's license version / URI, and the license scope for dEchorate and RealImpact external measurement files.
- Review OpenAIR file by file instead of applying a generic license from the website or someone else's list.
- Actually acquire three small pinned subsets, enter them in a SHA-256 / attribution manifest, then run independent comparisons. **Completion of this catalog does not mean that data download or measurement validation is complete.**
