# Independent English-documentation validator review

Result: **SCOPED PASS — CAPABILITY EXPLICIT** for the repaired frozen validator. The one finding is resolved and independently rechecked. The full documentation corpus was not accepted by this review.

The reviewer fully read `scripts/validation/english-docs.mjs` and `tests/integration/english-docs.test.mjs`, then used Node v22.17.0 on Windows in independent processes. The coordinator's frozen hashes matched:

| File | SHA-256 |
| --- | --- |
| Validator | `0b4f6887eebb4bf78a399bf0e73d704c579fcdd7826aa7fb4cbd0b68a78f1e89` |
| Test suite | `aa200b80f490939d22039fcb841ea7294d8dd5061a62fa0941569fb8417365c1` |

`node --test tests/integration/english-docs.test.mjs` passed **14/14**, exit 0. All fifteen original bounded fixture cases were rerun, and the repaired nested-link case was added: **16/16 PASS**. Their setup, observations, baseline stdout/stderr, and before/after input hashes are preserved in [the JSON report](independent-validator.json). All seven reviewed input hashes remained stable. The first frozen review and its original false-pass evidence remain under `initial_frozen_review`.

| Independent checks | Result |
| --- | --- |
| Missing translation, stale source marker, unreviewed Chinese body, `.en.md` suffix bypass | PASS: rejected |
| README with valid provenance but missing sections/code | PASS: rejected |
| README canonical drift and English prose drift after finalization | PASS: rejected |
| Missing/duplicate recorded manifest | PASS: rejected |
| Actual sibling file reached by raw/encoded Windows traversal or encoded absolute path | PASS: rejected |
| Shared JSON links, English Markdown destinations, fenced/inline examples, encoded filenames | PASS: preserved |
| Escaped/mismatched backticks around actual missing navigation | PASS: rejected |
| Unsupported local nested image-link outer destination | PASS: explicitly rejected |
| Repeated finalization and standalone CLI check | PASS: page bytes remained identical; canonical/data bytes remained unchanged; all eight fixture-file hashes remained unchanged during CLI check |

## Resolved finding: EN-VALIDATOR-001 — nested image-link destination

Original priority **P2**; final status **RESOLVED / CAPABILITY_EXPLICIT**. At [the link extraction expression (review snapshot line 276)](../../../scripts/validation/english-docs.mjs), a nested label stops the expression from capturing the outer destination. [The rewrite expression (review snapshot line 251)](../../../scripts/validation/english-docs.mjs) has the same supported-syntax boundary. The repaired [link-error check (review snapshot line 286)](../../../scripts/validation/english-docs.mjs) explicitly rejects an unrecognized local closing-link destination.

The independent fixture used a valid provenance marker, an existing `assets/logo.png`, and this English body:

```markdown
# Original

[![badge](../../assets/logo.png)](missing.md)
```

Initial observation: **PASS**, `errors: []`, `warnings: []`; only the inner image was checked. Independent recheck of the repaired freeze: **INCOMPLETE**, with `UNSUPPORTED_LOCAL_LINK_SYNTAX` for `missing.md`, and no warnings. The validator now fails explicitly rather than pretending to support or rewrite every CommonMark label form. The JSON report retains both the original false pass and the successful rejection.

No current-corpus local occurrence was found. The same syntax in [the third-party skills README (review snapshot line 8)](../../../third_party/emil-skills.README.md) has a remote outer destination. No broader Markdown-parser capability is claimed.

## README companion audit

Both complete README files were read and semantically compared. All paragraphs, both command blocks, versions and dates, 15/8 skill counts, budget defaults, historical/NOT RUN statements, rights restrictions, and dBFS/SPL boundaries were retained. Both code fences match byte-for-byte.

| File | SHA-256 |
| --- | --- |
| [Canonical README](../../../README.md) | `21b52b98793d071ea78f1633d8acaaf1096a8b4eb73eba9c7b4e6064d47f7b03` |
| [English README](../../../README.en.md) | `1d65ca7e24e1c91cbb6072ef7145ce44c5b2b330948be358cf58aaa81820561c` |

The English source marker matches the canonical path and current source hash. This is a full comparison of this pair, not a full semantic review of every translation.

## Read-only integration and limits

The standalone `check` command sets `verifyRecorded: true` and leaves `finalize` false. The isolated CLI run passed with identical before/after hashes for every fixture file, including manifest and index. Finalization inside the existing test suite writes only isolated `.cache` fixtures. Production sources and translations were untouched by this reviewer.

At the reviewed package/runner snapshot, the English corpus check remains standalone: `validate:all` does not yet call it. The coordinator explicitly plans a read-only npm gate after the interim manifest freeze. **The complete `validate:all`, corpus finalization, browser, build, API, remote availability, and anchor identity checks were NOT RUN by this reviewer.**

Structural checks and immutable hashes cannot establish every sentence's meaning or independently validate the source's scientific, legal, product, or live-service claims.
