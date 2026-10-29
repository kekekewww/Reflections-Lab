<!-- english-source: {"path":"tests/wiki/README.md","sha256":"6da3f2832b2898c5f89fb1df0e78738b18800aa2c5ec5b765bedb13015b90da0","translated_at":"2026-10-27T03:37:39.8945606Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`tests/wiki/README.md`](../../../../tests/wiki/README.md). Source SHA-256: `6da3f2832b2898c5f89fb1df0e78738b18800aa2c5ec5b765bedb13015b90da0`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="wiki-cli-回歸驗證"></a>
# Wiki CLI Regression Validation

Run: `node --test tests/wiki/*.test.mjs`.

All cases create separate, unique repository fixtures in the ignored `.cache/wiki-tests/`; they do not rewrite the formal `knowledge/`. The local sandbox returns EPERM for atomic rename replace in the operating system's temporary directory, so an isolated directory in the authorized workspace is used; deleting the old file first does not replace atomic rename. The tests create sources, synthesized pages, tasks, validation artifacts, and ingest plans in open formats. Before cleanup, they confirm that the directory is inside the test root; after testing, they remove only their own fixtures. The handoff case creates a Git repository without a commit and verifies that the branch comes from Git and revision is recorded as `null`.

The tests execute the CLI directly without mocking the file system. Concurrent cases start two Node child processes at the same time to check that exclusive claims and manifests/pages/events are not silently lost. If an ingest fails explicitly because of locking, the case executes that proposal again, then checks that both pieces of content and their histories exist.

Current coverage:

- Synthesized ingest, source hashes, and page and index updates; idempotence of identical ingest; no persistent changes in dry run.
- Invalid links, orphan pages, duplicate IDs, missing citations, and source and artifact hashes invalidated after changes.
- Stale expected hashes, multi-page preflight rejection, and preservation of the complete proposal; structured ACCEPTED assertion conflicts; preservation of the original conflict after explicit reconcile.
- Actual cross-process concurrent ingest/claim; claim token, heartbeat, and release; an expired lease does not transfer ownership automatically.
- DONE must have an actual artifact hash and verified acceptance criteria; superseding decisions preserve the old body and bidirectional metadata.
- Length-limited lexical queries with source citations; manual creation of a handoff containing Git, hashes of the modification scope, commands, risks, and next steps; rerunning read-only commands does not rewrite content.
- Invalid output formats must be rejected first; YAML aliases, duplicate keys, and oversized or overly deep metadata must be rejected; Windows ADS paths must not enter the write workflow.
- Simulated journals with some files already written, validating explicit complete/rollback and reruns; external modifications and journal hash corruption must preserve the state at failure; symlink/junction boundary-crossing cases are explicitly listed as NOT RUN if the local environment does not permit fixture creation.
- ADR heading IDs in the existing `docs/02-architecture/adr/` can serve as formal decision references without requiring changes to authoritative document filenames.
- A leftover writer lock must be released using the original token, an explicit reason, and evidence that the actual child process has exited; release is refused for a live owner, query refuses to read knowledge being modified by a writer, and status can display diagnostic information.
- A source version change at the same path uses a new Source ID and explicit supersedes; the old hash is retained as historical. A version change with a missing predecessor, a different path, a cycle, or undeclared supersession must not rewrite the manifest/pages. Retaining an old hash does not mean that the tool separately saved the complete original text; the old version's content still requires the original file or Git traceability.
- Accepted assertions on the same page must also be compared against their old values; providing the correct expected hash must not allow silently changing an assertion to the opposite claim.
- Historical Source IDs cannot be reactivated; restoring old content also requires a new version. Source provenance fields of existing IDs are frozen; lint must report cycles in source/page supersession graphs.
- Page domain IDs remain stable; evidence for VERIFIED pages must conform to the structure and have its artifact hash checked, and arbitrary strings cannot masquerade as evidence; invalid URI encoding must still return the complete lint issues.
- A recovery journal must not modify locks or other transactions through mixed slashes; different slash forms and Windows case aliases of the same file are treated as duplicate targets and rejected before writing.
- Content written by an external editor after expected-hash preflight must still be preserved: a dedicated child process wraps only the first read of the target file to arrange precise timing, while actual reads and writes still use the file system, confirming that commit does not mistake an external modification for a new valid preimage. No test hook has been added to the formal tool.

These validations demonstrate the local tool's data and protocol behavior. They do not determine the scientific correctness of free text or imply that automatic Session Hooks for all Agents have been fully integrated.
