---
name: compliance-and-provenance
description: 查核 Reflection Lab 競賽規則、第三方 license、資料集音效權利與既有成果來源；不代替使用者接受條款或提交。
---

# 規則與來源

## Trigger / Purpose

新增依賴／素材／資料、修改競賽時程或準備提交時，查證條件與來源責任。

## Inputs

官方活動／rules URL、依賴 version/hash、資料用途、來源作者與帳號狀態證據。

## Workflow

1. 先讀 docs/01-compliance 與 PROJECT_PROVENANCE；查官方最新條款，保存查核時間／版本。
2. 分類明確允許／禁止／附條件／未確認；沈默不代表允許。marketing、正式 waiver、登入後 submission 內容分開。
3. 比較申請與作品 deadline、ET/EST/DST，台北轉換保留歧義與較早安全規劃。
4. 逐筆 license／NOTICE／商標／data rights；metadata inventory 不能替代完整再分發審查。
5. 不重散布受限全文、SDK cache 或未授權音效／HRTF；紀錄本次 AI 協助與正式開發前資產。

## References

`docs/01-compliance/`、`docs/00-project/PROJECT_PROVENANCE.md`、`research/datasets/DATASET_CATALOG.md`、`docs/03-sdk/SDK_LICENSE.md`。

## Outputs

更新 register、條款分類、provenance、未確認項目與具體解除條件。

## Validation

核對官方來源可讀內容與目前 lockfile/hash；未查帳號不得推定入選或已接受。依新版本重跑 inventory。

## Failure Handling

存取不通／條款缺漏標 UNKNOWN，繼續研究與隔離 spike；不擅自註冊、接受法律條款或提交，這些由使用者本人處理。
