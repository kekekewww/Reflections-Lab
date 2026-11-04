# Public source snapshot (2026-11-04)

This repository is an independent public source snapshot. Its history is separate from the project's full local history, which stays on the local machine and is not rewritten. The snapshot is taken from local commit `f95431483db0bf48e7fc86fc630179a73ed810ff` and added on top of the previous public commit `879c2a75ae24c7286cd9051689a32887a2dd8bb4`.

## What is included

- All product source, server code, tests, schemas, scripts, benchmarks, skills and configuration.
- The documents, English mirrors, project notes, source records and tasks.
- Small evidence: the receipts that were already public, the files that tasks, source records and tests depend on, and the Muse scene builder results. Some of these are raw text logs, and a few are small compressed traces or screenshots that tests pin by hash.

## What is left out

| Left out | Why |
| --- | --- |
| Most of `artifacts/` | Run outputs, bundles, traces and screenshots, about 3 GB |
| Most raw run evidence under `docs/14-core-pipeline`, `docs/15-ui-parameter-audit` and `docs/16-nonadvanced-completion` | Logs, captures and screenshots |
| `knowledge/transactions/` | Recovery journals for local Wiki edits |
| Audio captures, source maps, binaries and all other archives and traces | Not source, and not reviewed for redistribution |

The exact file list, with sizes and hashes, is in the [manifest](PUBLIC_SNAPSHOT_MANIFEST_20261104.json). The project still has no root LICENSE, because the owner has not chosen one.

## What was changed from the local source

Only record-keeping changed, apart from the short README entry and these two files. No claim, result or translation was rewritten.

- **Links to left-out files** now use `archive://<commit>/<git-blob-sha1>`. Those bytes exist only in the local archive and cannot be downloaded from here. Links written as `archive://uncommitted-local/<path>` point at evidence that was never committed to the local history either.
- **Source records and task evidence hashes** that pin an edited document now pin the edited version. The original hashes are kept in the manifest.
- **English mirrors** follow the same links and hashes.

## What this does not claim

It is not a complete first version, a performance pass, a human listening pass or a legal approval. Evidence that was left out cannot be reproduced from this snapshot. Acoustics are a real-time approximation, not a measurement. The [scene builder record](MUSE_SCENE_BUILDER_20261104.md) lists known limits and unfixed problems.
