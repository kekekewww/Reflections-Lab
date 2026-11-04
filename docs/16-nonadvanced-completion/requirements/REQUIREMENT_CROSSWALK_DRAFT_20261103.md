# 非進階51列驗收對照草稿（2026-11-03）

本稿保留原51個ID與102條原文條件，只投影既有Task16/20/32與PERF001–008/011/014的受影響範圍。**所有51列本輪判定均未裁決**；原literal條件、數值reference、負載、容差和外部gate未改。完整原文、逐conditionoverlay、來源hash、歷史R17scope及新task原criteria見[JSON](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/195b1de848ab3b5496a5a362d45bde0f8006cded)。

本輪final產品source/bundle未freeze。舊501的1536/217/五個5秒WAV、e25兩次完整1535/1536 exit1、目前incrementalSHA3GREEN與voicecursor5GREEN各有不同scope；任何一種都不能冒完整新產品、native操作、長PCM或正式性能PASS。原315mockJSON仍FAIL/PASSflaky，根因未證；沒有新付費。

Root同意的[長輸出v2](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/8bde27d90c0715399501ae6d2de1e43100433e85)保留v1，增加每jobWAV192MiB/manifest2MiB/aggregate384MiB/max64jobs及公開archive/recover/download/delete/discardUI；都是待實作驗證規格，不把IDB實體page overhead當已量。

| 原ID | 原標題 | R17歷史範圍 | 連結PERF（受影響領域，非dependency修改） | 明確amendment數 | 本輪判定 |
| --- | --- | --- | --- | --- | --- |
| V1-SYS-01 | 可重現的正式Web app | 歷史工程有限接受 | 001／014 | 1 | 未裁決 |
| V1-SCN-01 | Scene v1與domain正負例 | 歷史工程有限接受 | 005 | 1 | 未裁決 |
| V1-SCN-02 | 原子交易、revision與Undo | 歷史工程有限接受 | 004／005 | 1 | 未裁決 |
| V1-SCN-03 | 匯入/匯出、Reset與資源清理 | 歷史工程有限接受 | 002／004／005／007／008／014 | 2 | 未裁決 |
| V1-PHY-01 | 固定步與過載政策 | 歷史工程有限接受 | 002／008／014 | 1 | 未裁決 |
| V1-PHY-02 | 四body modes與切換 | 歷史工程有限接受 | 014 | 2 | 未裁決 |
| V1-PHY-03 | FPS角色碰撞與移動 | 歷史工程接受／人工未驗 | 001／014 | 3 | 未裁決 |
| V1-PHY-04 | 有限且壁安全的抓取 | 歷史工程有限接受 | 002／014 | 3 | 未裁決 |
| V1-PHY-05 | Drop/Throw語意與去重 | 歷史工程接受／人工未驗 | 002／004／014 | 3 | 未裁決 |
| V1-PHY-06 | Pause/focus與Listener還原 | 歷史工程接受／人工未驗 | 002／004／006／008／014 | 3 | 未裁決 |
| V1-BLD-01 | Ghost/Staged/Active三階段 | 歷史工程有限接受 | 004／005／014 | 3 | 未裁決 |
| V1-EVT-01 | 可靠正規化物理事件 | 歷史工程有限接受 | 002／004／008 | 1 | 未裁決 |
| V1-EVT-02 | Impact去重與invalidations | 歷史工程有限接受 | 002／004／006／008 | 1 | 未裁決 |
| V1-SND-01 | 排序/去重與正交狀態 | 歷史工程有限接受 | 002／004／006／008 | 2 | 未裁決 |
| V1-SND-02 | 有界映射與合法引用 | 歷史工程有限接受 | 006／007 | 3 | 未裁決 |
| V1-SND-03 | 聲音預算與deterministic admission | 歷史工程有限接受 | 001／003／004／006／007／014 | 1 | 未裁決 |
| V1-SND-04 | 快照/epoch與決策重播 | 歷史工程有限接受 | 002／004／006／008／011／014 | 2 | 未裁決 |
| V1-SND-05 | 接觸/有界latch/material pair layers | 歷史工程有限接受 | 002／006／008 | 2 | 未裁決 |
| V1-SND-06 | 可信資產匯入/選擇與生成 | 歷史工程有限接受 | 006／007／011 | 2 | 未裁決 |
| V1-SND-07 | 安全手動作者與Apply/Undo | 歷史工程有限接受 | 004／006／007／014 | 3 | 未裁決 |
| V1-ACO-01 | 真direct path/occlusion | 歷史工程有限接受 | 004／005／011 | 2 | 未裁決 |
| V1-ACO-02 | 有限一階ISM反射與path identity | 歷史工程有限接受 | 004／005／011 | 2 | 未裁決 |
| V1-ACO-03 | 材質/大氣/模型標籤 | 歷史工程有限接受 | 004／005／011 | 3 | 未裁決 |
| V1-ACO-04 | AcousticFrame與worker邊界 | 歷史工程有限接受 | 001／002／004／005／014 | 2 | 未裁決 |
| V1-AUD-01 | 統一SourceGraph與一次處理 | 歷史工程有限接受 | 003／004／006／011／014 | 1 | 未裁決 |
| V1-AUD-02 | 持續聲源與平滑更新 | 歷史工程有限接受 | 001／003／004／006／007／011／014 | 1 | 未裁決 |
| V1-AUD-03 | Pause/Resume音訊時間 | 歷史工程有限接受 | 004／006／008／011／014 | 1 | 未裁決 |
| V1-AUD-04 | Raw/Simulated與基本reverb | 歷史工程有限接受 | 003／007／011／014 | 1 | 未裁決 |
| V1-UX-01 | Workspace/Transport與資料權威 | 歷史工程有限接受 | 002／006／007／008／011／014 | 6 | 未裁決 |
| V1-UX-02 | 共享選取與真資料可視化 | 歷史工程有限接受 | 004／005／006 | 3 | 未裁決 |
| V1-UX-03 | FPS輸入仲裁與安全退出 | 歷史工程接受／人工未驗 | 014 | 3 | 未裁決 |
| V1-UX-04 | Sound Inspector作者/診斷 | 歷史工程有限接受 | 006／007／011 | 4 | 未裁決 |
| V1-UX-05 | 可及性/reflow/motion | 歷史工程接受／人工未驗 | 014 | 5 | 未裁決 |
| V1-UX-06 | Monitor與音訊暴露狀態 | 歷史工程有限接受 | 001／003／006／014 | 3 | 未裁決 |
| V1-RPL-01 | 可追溯capture與finalization | 歷史工程有限接受 | 002／004／008／011／014 | 3 | 未裁決 |
| V1-RPL-02 | Authoritative replay與seek | 歷史工程有限接受 | 002／006／007／008／011／014 | 3 | 未裁決 |
| V1-RPL-03 | Pinned resimulation證據 | 歷史工程有限接受 | 002／004／008／014 | 1 | 未裁決 |
| V1-AB-01 | Acoustic A/B固定條件 | 歷史工程有限接受 | 002／003／004／005／007／008／011／014 | 3 | 未裁決 |
| V1-AB-02 | Behavior A/B自變項 | 歷史工程有限接受 | 002／006／007／008／011 | 3 | 未裁決 |
| V1-MET-01 | Grounded metrics與無資料拒絕 | 歷史工程有限接受 | 001／011／014 | 2 | 未裁決 |
| V1-AI-01 | 原12工具的安全host | 歷史工程有限接受 | — | 3 | 未裁決 |
| V1-AI-02 | Behavior提案的安全host | 歷史工程有限接受 | 007 | 3 | 未裁決 |
| V1-AI-03 | Provider邊界、預算及錯誤 | 歷史工程有限接受 | — | 1 | 未裁決 |
| V1-AI-04 | 模型說明只引用真結果 | 歷史工程有限接受 | — | 2 | 未裁決 |
| V1-AI-05 | 真Meta產品整合 | 歷史Meta最低範圍 | — | 3 | 未裁決 |
| V1-VAL-01 | 凍結驗收與獨立審查 | 歷史工程有限接受 | 001／002／003／004／005／006／007／008／011／014 | 1 | 未裁決 |
| V1-VAL-02 | Browser/DSP/E2E與乾淨重開 | 歷史工程有限接受 | 001／002／003／004／005／006／007／008／011／014 | 3 | 未裁決 |
| V1-VAL-03 | 實際裝置聽測與跨browser | 歷史工程接受／人工未驗 | 001／003／006／007／011／014 | 3 | 未裁決 |
| V1-VAL-04 | 正式性能profile與退階 | 歷史負面量測／非性能PASS | 001／002／003／004／005／006／007／008／011／014 | 2 | 未裁決 |
| V1-OPS-01 | Wiki/Task/交接/Git持久化 | 歷史session持久化gate | 001／002／003／004／005／006／007／008／011／014 | 3 | 未裁決 |
| V1-COM-01 | 權利/規則/發布授權 | 歷史工程接受／人工未驗 | 007／011 | 3 | 未裁決 |

CON05是REQUIREMENTS既有scope_conflict，不是第52個requirement；11/1建造修訂有效。200%只移除原生真人必要gate，320CSSpx/鍵盤/focus/reduced-motion回歸保留。BLD01保留ack前無active物件，ack後自動啟用，合法空中放置是surface-support例外；PHY06只改暫時ghost取消，Held及Listener安全規則保留。P2dynamicreflectors只被明確授權部分覆寫，不整批啟動進階Task15/009/010/012。

Task16/20須待最終產品freeze後按各自字面criteria對帳；Task32S0scope通過不等於任何產品列PASS。EN01–06原補充亦保留，完整英文與獨立忠實度審查排在finalsourcefreeze。ComputerUse與Playwright全矩陣、nativeDSP數位檔、科學/正式性能與Claude/人工各自分開。下一個候選milestone再批次source/task/Wiki/checkpoint；本輪草稿準備不做新checkpoint、產品測試、英文生成或Git提交。
