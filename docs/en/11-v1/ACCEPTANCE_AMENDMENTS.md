<!-- english-source: {"path":"docs/11-v1/ACCEPTANCE_AMENDMENTS.md","sha256":"562045b77e16aeb452ab85005e54e526423931bc13a37b070cfdb8808133229e","translated_at":"2026-10-28T10:00:01.837Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/11-v1/ACCEPTANCE_AMENDMENTS.md`](../../11-v1/ACCEPTANCE_AMENDMENTS.md). Source SHA-256: `562045b77e16aeb452ab85005e54e526423931bc13a37b070cfdb8808133229e`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="第一版驗收補充"></a>
# First-version acceptance amendments

This page records changes the user explicitly made after the first-version acceptance was frozen. The original `ACCEPTANCE.md`, `REQUIREMENTS.json`, and historical tests are retained; the confirmed changes below take precedence when interpreting current gates. This does not permit implementers to relax tests on their own.

<!-- english-original-anchor --> <a id="2026-10-28正常顯示比例"></a>
## 2026-10-28: Normal display scale

The user confirmed: “Native 200% scaling does not need to be verified. This scale is too extreme; we only need to ensure that the product is usable at normal scale.”

- Remove the pre-delivery human verification gate for “native browser 200% scaling” from V1-UX-05. Do not schedule that test or list it as a required item awaiting the user.
- Current acceptance checks readability, access to primary controls, layout and operation at normal 100% display scale. Existing responsive, keyboard, focus and Reduced Motion automated regressions and historical results remain in place.
- First-person entry, movement, mouse lock and safe exit, and actual-device listening requirements remain valid. Automated tests cannot replace these human observations.
- This change does not mark the unrun native 200% test PASS or declare the complete first version finished.

Original pinned source SHA-256: `ACCEPTANCE.md` = `9a7355656a1fdb734a4261cd525f25baaad99664bbe876952087026b2ab6e406`; `REQUIREMENTS.json` = `7506d24fa30acca446a517c4a9660ee53b62928ab0047048151583c8de5c6a3c`.
