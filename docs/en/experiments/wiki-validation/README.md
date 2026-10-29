<!-- english-source: {"path":"experiments/wiki-validation/README.md","sha256":"87ecfd4336b42ddb8ae5f67b005906d1f2c743f0e218c1731ad7fe2c0c45f4d0","translated_at":"2026-10-27T03:37:39.8945606Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`experiments/wiki-validation/README.md`](../../../../experiments/wiki-validation/README.md). Source SHA-256: `87ecfd4336b42ddb8ae5f67b005906d1f2c743f0e218c1731ad7fe2c0c45f4d0`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="persistent-wiki-隔離驗證"></a>
# Persistent Wiki Isolated Validation

This validates the project memory tool's local file protocol. It is not a formal Reflection Lab product feature and does not validate acoustic or physics models.

Run `node --test tests/wiki/*.test.mjs`. The tests use real Node child processes, Git, and file operations to create a separate fixture for each case inside the ignored `.cache/wiki-tests/`; they do not modify the formal `knowledge/`. The local sandbox's virtual system temporary directory rejects rename operations that replace existing files, while the same probe succeeds in the working directory. Therefore, the tests use an isolated temporary directory within the project without falling back to deleting files before overwriting them.

The entry point is `node scripts/wiki/cli.mjs help --format json`; `knowledge/schema.md` describes the formal data and operating rules. `ingest` must receive actual synthesized content and source metadata supplied by an Agent; the tool does not call a model, download original texts, or generate fake summaries.

<!-- english-original-anchor --> <a id="實際保證與邊界"></a>
## Actual Guarantees and Boundaries

- Cooperating writers are serialized through exclusive mkdir at `knowledge/.locks/writer/`; failure to acquire it within 4 seconds produces an explicit failure. Task ownership must include agent, session, and token; an expired lease does not transfer ownership automatically.
- A writer lock left behind by a crash can be handled explicitly with `unlock --token <owner token> --reason <reason> --agent <ID> --session <ID>`. This is permitted only on the same host, with a matching token and after the owning process has exited; a live process is not terminated. An exclusive recovery guard serializes unlock operations. If there is no owner, or the guard itself was interrupted, a person must first check the processes and files rather than guessing that deletion is safe.
- Page patches use a SHA-256 `expected_hash`, with `null` for a new page. Application begins only after preflight checks for all pages have completed; a stale version or an explicit assertion conflict preserves the complete proposal and existing body text.
- Each file uses a temporary file in the same directory, fsync, and rename; events are saved with a UUID and exclusive create. Multiple files **are not a globally atomic transaction**. A transaction journal stores the preimage/proposal/hash; after an interruption, `recover <UUID> --action complete|rollback` performs explicit recovery. A journal hash mismatch, external modification, or unknown path causes overwriting to be refused.
- Journals and events are traceable data; do not submit conversation transcripts, secrets, or unauthorized original texts to pages. Credential-pattern screening is only a conservative aid and does not replace human review.
- `lint` and `query` refuse to read when there is an active writer and check the journal stamp before and after reading; `query` rejects transactions awaiting recovery. `status` is the diagnostic entry point and displays the writer, pending transactions, and expired leases.
- YAML uses the pinned `yaml` 2.x and rejects duplicate keys, aliases, and unknown tags; each page is limited to 1 MiB and metadata depth to 64. Paths reject traversal, symbolic links/junctions, Windows alternate data streams, and device names.
- Query is lexical retrieval, limited to 10 results and 800 characters per result, with source ID/version/hash. It does not claim to have answered a semantic question or verified facts.
- Source ID provenance cannot be rewritten; the same path/hash/version retains only one canonical ID. A new version must use a new ID and `supersedes`, preserving the old hash and marking it historical. A historical ID cannot be reactivated; restoring old content also requires creating a new version. Cyclic source or decision supersession relationships are rejected. A historical hash is not a backup of the original content: the old body still requires a legally retained original file or Git revision; a source currently without a commit cannot be restored from its hash.
- Query citations include `snapshot_mode` and `current_hash_match`. A file referenced by a historical citation may have changed; compare its hash with the retained original version before making a judgment. Even with the correct page hash, an accepted/verified assertion must not be silently replaced through ordinary ingest; a conflict record and reconcile with a stated reason are required.
- Lint can compare structured assertions that have the same key and different accepted or verified values; it cannot automatically identify arbitrary natural-language contradictions. DONE requires an actual artifact hash and verified acceptance criteria; the operator declares commands and results, and the tool does not falsely claim that it executed the supplied commands itself.
- A manual CLI-only workflow can complete checkpoint/handoff; no automatic Session Hook is installed or claimed. Source and evidence hashes are local pins; they do not automatically query newer remote versions or prove scientific truth.

<!-- english-original-anchor --> <a id="可重現案例與結果"></a>
## Reproducible Cases and Results

See `tests/wiki/README.md` for the case list. The tests also cover repeated ingest, supersede, dry run, invalidated sources, invalid links, orphan pages, conflicts and reconcile, cross-process claim/updates, DONE evidence, manual handoff, Git HEAD without a commit, journal interruption complete/rollback, external modification, and corrupt journals.

If a local symlink/junction fixture cannot be created because of EPERM, the Node test runner reports an explicit SKIP/NOT RUN; this does not justify claiming that symbolic-link rejection behavior was tested on this platform. The validation report for this phase retains the complete test count, commands, exit codes, and execution times.
