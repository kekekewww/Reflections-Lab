<!-- english-source: {"path":"experiments/dataset-fetch-spike/README.md","sha256":"1cbb283319012ff8b33ecb8c43b24489dedf4d69dc80fea5c2e3055e4ab54c53","translated_at":"2026-10-27T03:38:48.938350Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`experiments/dataset-fetch-spike/README.md`](../../../../experiments/dataset-fetch-spike/README.md). Source SHA-256: `1cbb283319012ff8b33ecb8c43b24489dedf4d69dc80fea5c2e3055e4ab54c53`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="資料取得隔離驗證"></a>
# Isolated Dataset Acquisition Validation

This tool supplies the reproducible acquisition script missing from Phase H. It has not downloaded any third-party data, accepted terms, created a production importer, or performed acoustic V2 / V3 / V5 validation. All test content is original in-memory text created by this project; the `VERIFIED` / Zenodo URL in tests exists only in an injected synthetic fixture and does not indicate that the URL actually hosts data or that third-party authorization has been obtained.

Node is pinned to **22.17.0**. Only built-in modules are used, with no additional dependencies. Run from the repository root:

```powershell
node scripts/setup/datasets.mjs
node --test experiments/dataset-fetch-spike/dataset-fetch.test.mjs
```

The first command defaults to dry-run: it does not call fetch or create a cache. The real example is catalog D05 dEchorate v1: its data license is `UNKNOWN`, and the exact filename, download URL, bytes, and SHA-256 have not been obtained and remain `null`, so it should report `BLOCKED` and exit with code **2**. This faithfully preserves the gaps; it is not a download failure. The tool does not treat the code's MIT license as the data license.

Only after reviewing each individual pinned file should you create a separate manifest and use:

```powershell
node scripts/setup/datasets.mjs --manifest research/datasets/your-reviewed-manifest.json --fetch
```

`--fetch` is an explicit execution option, not a legal terms acceptance process; there is no support for terms-page interaction, accounts, cookies, authentication headers, or login. The input `dry_run` must always be `true`, preventing a manifest from initiating network access on its own; only the command-line option enables acquisition.

The tool requires the catalog's source, version, license ID / URL / scope / review date, attribution, subset IDs, test IDs, exact bytes, and SHA-256, plus `license_evidence_url` pointing to evidence of the terms for that pinned file. `VERIFIED` is a declaration that the maintainer has reviewed the individual file, intended use, and notices; the tool validates only metadata and file integrity and cannot itself establish authorization, competition eligibility, or citation sufficiency. `UNKNOWN`, `REFUSED`, and `VERIFIED_PAGE_ONLY` all block acquisition. Do not derive an expected hash from newly downloaded content and then claim it was checked against an independent source.

Each run accepts only one pinned file, with no archive extraction or batch external scripts. `max_download_bytes` must not exceed **50,000,000 bytes**, and `size_bytes` must not exceed that limit; Content-Length, if present, must match. The stream is also checked against the limit chunk by chunk, and size and SHA-256 are checked again at the end. Transfer is limited to identity encoding, with a 30-second timeout for the entire request and stream.

Downloads accept only HTTPS on the standard 443 port, reject userinfo, query, and fragment, and require the host to match exactly one of: `www.york.ac.uk`, `zenodo.org`, `depositonce.tu-berlin.de`, `www.openslr.org`, `github.com`, `codeload.github.com`, `raw.githubusercontent.com`. Arbitrary subdomains and other mirrors are not included; if a source requires a signed query, login, or a new mirror, reassess it before changing the tool. At most 3 redirects are followed manually, with the same restrictions checked again at every step; Location is not implicitly trusted.

Output is fixed at the Git-ignored `.cache/datasets/<dataset_id>/<sha256>/<file_name>`, with no custom output path. Filenames must start with an ASCII letter or digit, followed only by ASCII letters, digits, periods, underscores, or hyphens, with a maximum length of 180 characters. The tool rejects traversal, Windows drives / ADS / reserved names, a target symlink, and symlinks / junctions in the cache path components. Streaming writes use a `wx` file in an adjacent temporary directory, then atomically publish it through directory rename after verification; an existing cache directory is not overwritten, and a nonempty directory created by a competing writer cannot be overwritten by rename either. Temporary bytes are removed on failure. Size and hash are checked again before cache reuse; an existing corrupt cache is retained for manual review, and the tool does not delete or repair it.

Filesystem checks target ordinary local working directories; this Node spike does not provide an OS sandbox that prevents a malicious local user from swapping directories between checks and writes. Do not run it alongside a process that moves cache directories. Tests cover static junctions and competing targets without overwrite; if the local machine cannot create the junction fixture, that case is explicitly listed as `NOT RUN` / skip rather than claimed as passed. No claim is made that all TOCTOU scenarios are prevented.

Exit codes: **0** means `READY` / `ACQUIRED` / `CACHED`, **2** means metadata `BLOCKED`, and **1** means an input, I/O, or network error. `READY` means only that dry-run metadata passed; no remote data has been acquired or verified.

Offline regression covers: CLI and manifest parsing, no network access by default, unknown / refused licenses, missing metadata, negative path / URL cases, oversized streams, size and hash errors, redirect hosts / loops, cache revalidation, junctions, competing writes, and a successful synthetic cache. Test fetch is entirely injected through local mocks; these passing results must not be labeled as dataset `ACQUIRED`, an independent solver comparison, or successful acoustic measurement.

The next steps remain: obtain explicit authorization for individual data files, pin subsets / URLs / independent SHA-256 and bytes, and then acquire them when needed; read original headers / metadata, retain raw and processed hashes, and finally perform the scientific validation defined in the catalog. This spike does not change the catalog's `NOT RUN`.
