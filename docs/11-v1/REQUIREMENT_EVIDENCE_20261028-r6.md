# 第一版需求證據 r6：持久化與 Git provenance 已驗證

記錄日期：2026-10-28（台北）。本次只將原51列中的 **V1-OPS-01** 由PARTIAL改為有範圍PASS；合計 **43 PASS／8 PARTIAL**，**完整第一版仍未完成**。其餘50列沿用[r5的原條件、證據及限制](REQUIREMENT_EVIDENCE_20261028-r5.md)，[完整共用JSON](REQUIREMENT_EVIDENCE_20261028-r6.json)仍包含全部51列，不建立另一任務系統。

[凍結清單](REQUIREMENTS.json)SHA256仍為`7506d24fa30acca446a517c4a9660ee53b62928ab0047048151583c8de5c6a3c`；全部ID／priority／通過條件／evidence methods與原Task dependencies不變。

## 原OPS01條件與直接證據

1. 沿用同一Task/Wiki：criteria實際有hash證據才DONE；claims釋放、來源版本/現況/限制/下一步更新。

2. 保留未提交變更及舊證據，checkpoint/handoff帶真正commands/Git provenance；本地commit可恢復，不擅自push/deploy。

原evidence methods：wiki lint/status、task/evidence hashes、fresh handoff reader、git diff/log。

- [真實Git及provenance紀錄](../../artifacts/v1/git-checkpoint-r11-20261028/git-and-qualified-provenance.json)：本地commit `aec0604b4a2e139ca2b6324ab2be92cf92a4e100`，parent `f006b0e60db18450bdfcbcf22d790b9913724b1e`；捕捉時工作樹乾淨、0 staged、3591 committed paths。可由實際Git還原，不預填本次metadata未來hash。
- [fresh receiver](../../artifacts/v1/git-checkpoint-r11-20261028/fresh-receiver.json)已從AGENTS／schema／Index／Now／handoff獨立找到狀態、scope、命令及下一工作，明確區分舊PRE-Git截點與其後真實收據。
- [最後完整品質](../../artifacts/v1/clean-quality-pinned-20261027213004429/verification.json)實際check／offline benchmark PASS，runtime917/917、1884份來源穩定、61份保護檔相同；[英文261鏡像](../en/_reports/delta-r11-current-corpus-20261027T212950525Z.json)及獨立語義／31測試／5926links通過。
- [production12檔](../../artifacts/v1/bundle-notice-pack-20261027-1914-r10/fullcheck-production-byte-confirmation-r11.json)與NOTICE候選逐byte相同；未解除六項來源／closure缺口或根LICENSE未選。
- Task0006／0017／0018／0019已DONE且owner=null；Task0012／0020進行中claim正常保留。Task0016原AC03加入真實Git／receiver證據並核實，AC04維持true；AC01／02與原依賴未完成，整體維持BACKLOG。

## 其餘八項門檻

V1-PHY-03、V1-PHY-05、V1-PHY-06、V1-UX-03、V1-UX-05、V1-VAL-03、V1-VAL-04、V1-COM-01。目前原生200%／320CSS／Pointer Lock仍NOT RUN，實機聽測／actualroute／sampleRate／block仍未知，正式600秒profile保留FAIL／負載不完整／main occupancy NOT RUN；授權來源、根LICENSE／本人資格／登入條款及發布決策保留。

效能active-rule投影僅是未套用候選：12項與預設App等價案例PASS，大型案例因舊fixture pin前置檢查未執行，原native1／13PASS1FAIL保留。不能把候選operation counts稱為正式產品或速度通過。

本文件與Now／Task followup以已存在的aec0604為base；本次新增metadata與英文delta仍需檢查後另存本機commit。沒有新Muse／付費Meta請求，未push／部署。
