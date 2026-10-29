# Translation worker instructions

This file coordinates the English documentation task. The user requested an English interface and **all project documentation**. Your parent owns the inventory, manifest, link rewriting and final validation. You own only the targets listed in your assignment JSON and your assignment's report.

1. Read the assignment under `.cache/docs-en/assignments/`. Read each source completely, using bounded reads for large files. Do not read or reproduce any key file. Do not edit originals, source code, active Wiki/tasks, package files, other translations or shared manifests.
2. Translate the **complete document**, including headings, prose, tables, labels and qualifications. Do not replace it with a summary, index, placeholder, or a promise to translate later. English that is already present can stay as written. Source dates and historical statements stay historical; do not silently update facts or declare new tests passed.
3. Keep technical IDs, paths, URLs, citations, numerical values, units, equations, hashes, statuses and acceptance conditions intact. Preserve fenced code blocks **byte-for-byte in content**, including original example inputs/comments; they are verbatim technical examples, not a claimed English model response. Translate explanatory prose around them. Keep required license/copyright notices. Do not reproduce remote papers or SDK manuals.
4. Preserve original relative link **targets** for now, while translating link labels. The parent will rewrite local links using the full source-to-English mapping after all targets exist. Do not invent anchors or paths. Raw task JSON, schemas, source, fixtures and results remain shared; do not create another task registry.
5. Capture the actual source bytes/hash **before** translating. Put this first-line marker in each output, before the translated document (including before any original frontmatter):

   `<!-- english-source: {"path":"SOURCE_PATH","sha256":"ACTUAL_SHA256","translated_at":"ISO_UTC","executor":"Codex","model_id":null,"links":"source-relative"} -->`

   This is provenance, not a model/version guess. An English-readable source notice will be added by the parent. Retain the translated document's original section structure. For Wiki frontmatter, preserve IDs/status/source references and translate only human-readable title/text; English mirrors are outside the active Wiki parser.
6. For very large, mostly ASCII manifests, you may copy the source and apply a finite, reviewed set of translated prose/table-cell replacements. Ensure every remaining Han occurrence is intentional verbatim code, data, original proper title or metadata—not untranslated project prose. Do not use a remote translation API or Muse.
7. Write your report to the exact `report` path in your assignment, with:

   ```json
   {
     "assignment": "GROUP_ID",
     "executor": "Codex",
     "model_id": null,
     "completed_at": "ISO_UTC",
     "files": [
       {
         "source": "ORIGINAL_PATH",
         "source_sha256": "HASH_OF_ACTUALLY_READ_BYTES",
         "source_sha256_after": "CURRENT_HASH_AT_COMPLETION",
         "target": "ASSIGNED_ENGLISH_PATH",
         "target_sha256": "ACTUAL_OUTPUT_HASH",
         "status": "TRANSLATED_OR_SOURCE_CHANGED",
         "notes": []
       }
     ]
   }
   ```

8. Verify that all your assigned targets exist, complete content is translated, numeric/ID/code-fence invariants are preserved, and no source was changed by you. If a source changed concurrently, retain the translated snapshot/hash, report it and wait for a specific refresh request; do not overwrite the original or fabricate a matching hash. Do not run browser/build/model calls or heavyweight tests. Do not write Wiki or Git. Send the parent your report path, completed count and any limits.

Scientific language must retain analytical/numerical/perceptual approximation and unverified distinctions; Measured/Derived/Tuned/Synthetic labels; energy/power/pressure distinctions; dBFS versus dB SPL; Computed versus Measured; live versus mock/fixture provenance; all NOT RUN and external gates. Translation must not convert research, a spike, or one passing test into a completed product claim.
