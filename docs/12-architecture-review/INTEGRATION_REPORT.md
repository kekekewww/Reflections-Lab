# 架構研究整合報告

2026-10-29。唯一任務：[RLAB-TASK-0021](../../knowledge/tasks/RLAB-TASK-0021.json)。實際 Git、命令／exit、Gate、merge／publication 狀態集中於 [integration-state.json](integration-state.json)，未執行不記 PASS。

## Repository 與保護

原 branch codex/sound-behavior-research／baseline c210ca882ca8503b322c28884bf1e9f6e9fe126d；research branch research/architecture-review-20261029。[baseline](baseline.json)保存實際路徑、HEAD、clean status、原無 remote 與分開的鎖版 npm ci 收據。原生 worktree 首次因 Windows 長路徑失敗，此倉庫 core.longpaths=true 後成功。研究修改只在新 worktree；不 reset／clean／stash／force push／刪分支。

## 相容性與測試

[Architecture Review](ARCHITECTURE_REVIEW.md)與[Gap](ARCHITECTURE_GAP_ANALYSIS.md)逐領域列出實作／近似／後續能力。Category A 為研究、時態修正、ADR-015、roadmap／Wiki；Category B 為共用 5 秒上限、六個新 regression、types-only RenderBackend、成本及公開掃描工具。無依賴升級、Scene／Project／Recording migration、UI 像素修改或 Category C。

[獨立審查](INDEPENDENT_REVIEW.md)對窄修／契約 PASS；整體及公開原歷史限制保留。新 delay 測試先 RED 4/6，再 GREEN 6/6，另有 185 聲學／音訊、668 一般與 100 組解析幾何分項收據，均不取代 root 統一驗證。

產品 browser 首輪 3 PASS／1 FAIL（原 8 次 capture recovery budget 耗盡）；相同條件單獨重跑 4/4 PASS，兩次 source／bundle stable。FAIL 保留，不放寬測試，不宣稱負載可靠性已修。完整 check／其餘 browser／合併前後命令與差異以機器結果為準。

合併前重查最新原 HEAD、merge-base 與兩邊變更；不只比起始 baseline。R17 性能 FAIL、正常 100% 實體 FPS／IME與裝置聽測 NOT RUN、未實作 Worklet／stems／ADM、無新 paid calls 仍成立。

## 公開範圍與結果

目標：[kekekewww/Reflections-Lab](https://github.com/kekekewww/Reflections-Lab)。重查時為公開空倉庫。原完整歷史有三個 >100 MiB blobs 與禁止產物，直接 push 保持 BLOCKED，見[公開審查](PUBLICATION_AUDIT.md)。

使用者另[授權乾淨快照](../00-project/ARCHITECTURE_REVIEW_AMENDMENTS.md)，保留全部本地歷史。新快照需 exact payload manifest、無原祖先、真正小型 evidence／fixtures、明示本地 archive 參照、乾淨安裝／驗證與完整落盤 scan。不能用假 placeholder、改 frozen oracle 或放寬 validator 掩蓋缺證據。

實際 research／merge／public branch、snapshot／remote SHA、檔案與 CI 狀態記於 integration-state.json。原始 branch／history不自動上傳或改寫，研究 worktree／branch 保留。未推送不填成功。
