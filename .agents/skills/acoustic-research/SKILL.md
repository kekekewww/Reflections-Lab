---
name: acoustic-research
description: 查證 Reflection Lab 聲學理論、材質資料、論文與科學主張；用於研究與來源更新，不代替數值驗證。
---

# 聲學研究

## Trigger / Purpose

新增聲學模型、材料數據、重要公式或研究結論時，建立可追溯證據，避免把摘要／模型推論當成量測。

## Inputs

具體問題、模型適用範圍、現有 Claim IDs、預計工程用途。

## Workflow

1. 先讀 PAPER_INDEX、相關 theory 與 ledger，避免重做既有研究。
2. 查 primary papers／官方標準頁／作者公開資料；區分全文、摘要、metadata。付費全文不可取得時記限制。
3. 核對作者／年份／DOI，分析方法、數學、實驗、假設、誤差、可重現性與本案用途。
4. 把工程推導標 Derived，把演算法近似與真正數值結果分開。材料逐筆記 measured/derived/tuned/synthetic、頻率與安裝條件。
5. 更新原始索引、文獻分析與 ledger，使用穩定 claim IDs；非必要不複製第三方內容。

## References

- `research/papers/PAPER_INDEX.md`、`LITERATURE_REVIEW.md`
- `research/theory/ACOUSTIC_THEORY.md`、`DSP_MODELS.md`
- `research/EVIDENCE_LEDGER.json`

## Outputs

附來源與條件的研究結論、版本化 claim、可驗證的工程建議與未決問題。

## Validation

`npm run validate:research`；重要公式送 acoustic-validation，索引通過不代表物理正確。

## Failure Handling

來源互相矛盾／無全文／授權未明就記 PARTIAL/UNKNOWN 與可讀證據，不編造數值；繼續無相依研究。
