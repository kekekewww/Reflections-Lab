# 51 列需求證據裁定（2026-11-03）

第二次裁定時間（UTC）：2026-11-03T11:12:45.633Z。逐一重審 51 列、102 個原始條件與追加門檻。產品來源 544d8d9f，src tree 0d9554956dec35b1b7d340f8ad7c206147e1cbd4。完整原文與逐條英文理由見 [JSON](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/196c159b6edeb69067a1d83c878f29a9f543dad1)。原欄位、FAIL、NOT_RUN、null 與歷史證據保留；第一次裁定的完整 summary 與各列 final 欄位另存 final_adjudication_history[0]，本次結果讀目前 final 欄位。

S4 已結束於 2026-11-03T11:00:17.282Z：22 條路徑均有 actual-exit，11 條 exit 0、11 條 exit 1。每個案例按本身結果採證；失敗路徑內的通過不被抹去，通過路徑也不代表整列或全部 native／科學驗證通過。current-results 的 249 個規劃列含 148 個 scoped evidence pending review、100 個 NOT_RUN 與 1 個移除項，不能當成 249 個通過控制。

| 裁定 | 列數 | 原始條件數 |
| --- | ---: | ---: |
| PASS_CURRENT | 22 | 64 |
| FAIL_CURRENT | 8 | 3 |
| PARTIAL_CURRENT | 17 | 30 |
| NOT_RUN | 1 | 2 |
| HUMAN_GATE_NOT_RUN | 1 | 1 |
| EXTERNAL_GATE | 2 | 2 |
| PENDING_RUN_IN_PROGRESS | 0 | 0 |

第一次列數為 PASS 16／FAIL 2／PARTIAL 6／NOT_RUN 1／HUMAN 1／EXTERNAL 2／PENDING 23；本次 23 列改判，沒有保留進行中結論。原始條件與追加 UI 門檻分開；reverb 鍵盤步進失敗不等於 IR／DSP 失敗，公開 60 秒 render 停用不自行證明 Captured manifest 損毀。

Computer Use [attempt-01](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/03fe9a8f8bcfded0e9e6978019204f6f07f06edd) 完整報告存在，但結果為 BLOCKED：工具因 Windows browser URL-confidence policy 在任何產品輸入或截圖前停止。固定九組為 PASS 0／FAIL 0／BLOCKED 1／NOT_RUN 8；所有必要產品操作方法維持 NOT_RUN。原生 200% 不再要求；專項聽測／實體輸入、真 Meta／法律及正式 600 秒門檻不變。

保留的具體失敗包括 Gizmo 取消、Observer blur、Zone checkbox、wet 0.12→預期 0.13、seek 預期 0 卻為 2.983，以及公開 60 秒錄製後 Render audio files 持續停用。根因未因此全部確診。已移除步驟導覽、Resume／Resume simulation、重複 Pause 或 help trigger 屬清楚的定位／標籤漂移時，以 PARTIAL／NOT_RUN 記錄，不當產品 PASS；其餘不明 help 前置失敗保守保留，不能宣稱所有 help 入口均缺失。

本輪只讀既有收據、stdout、Playwright JSON 與檔案，不啟動產品測試、建置、伺服器或瀏覽器，不操作 Git index。先前 check-05 整體 exit 1 與當時英文 INCOMPLETE 保持歷史原值；長輸出 attempt05 58/58 仍因 28 個 src pin 不同而不升級為凍結來源全面 native PASS。英文文件的本次獨立 validator 結果另列，不回寫成過去產品 check 成功。

| Row ID | 標題 | 裁定 | 一行理由與證據 |
| --- | --- | --- | --- |
| V1-SYS-01 | 可重現的正式Web app | PARTIAL_CURRENT | 建置與正式產品啟動已證；缺本輪乾淨安裝或完整重用核對。 [證據](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/05b93659973a4e404060aaf5180bef2962a50c90) |
| V1-SCN-01 | Scene v1與domain正負例 | PASS_CURRENT | 現行 Scene schema 與 host 正負例重跑通過；不外推效能容量。 [證據](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/05b93659973a4e404060aaf5180bef2962a50c90) |
| V1-SCN-02 | 原子交易、revision與Undo | PASS_CURRENT | 交易失敗原子回復、穩定 ID、隔離與 Undo revision 均有本輪證據。 [證據](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/05b93659973a4e404060aaf5180bef2962a50c90) |
| V1-SCN-03 | 匯入/匯出、Reset與資源清理 | PASS_CURRENT | 本輪 roundtrip 與十次重設／匯入及 disposal 資源計數通過。 [證據](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/05b93659973a4e404060aaf5180bef2962a50c90) |
| V1-PHY-01 | 固定步與過載政策 | PASS_CURRENT | 固定步與過載保護通過；早期暫停保留，未稱連續錄製吞吐通過。 [證據](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/05b93659973a4e404060aaf5180bef2962a50c90) |
| V1-PHY-02 | 四body modes與切換 | PASS_CURRENT | 真 Rapier 四模式、速度／重力還原與 generation 安全矩陣通過。 [證據](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/05b93659973a4e404060aaf5180bef2962a50c90) |
| V1-PHY-03 | FPS角色碰撞與移動 | PARTIAL_CURRENT | 原條件通過；Windows 工具在產品輸入前受阻，獨立方法仍 NOT_RUN。 [證據](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/03fe9a8f8bcfded0e9e6978019204f6f07f06edd) |
| V1-PHY-04 | 有限且壁安全的抓取 | PARTIAL_CURRENT | 抓取數值矩陣通過；全部受阻原因在正式畫面的呈現證據不足。 [證據](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/c763719ae0dbf55f5d24a3a95b5fc05b194aecba) |
| V1-PHY-05 | Drop/Throw語意與去重 | PARTIAL_CURRENT | Drop／Throw 原條件通過；Windows 原生輸入未執行。 [證據](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/03fe9a8f8bcfded0e9e6978019204f6f07f06edd) |
| V1-PHY-06 | Pause/focus與Listener還原 | PARTIAL_CURRENT | Held／暫停與 Listener 有分項通過；完整原生焦點操作未執行。 [證據](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/03fe9a8f8bcfded0e9e6978019204f6f07f06edd) |
| V1-BLD-01 | Ghost/Staged/Active三階段 | PARTIAL_CURRENT | 放置原條件通過；Windows Ghost／Staged／Active 與 Escape 尚未操作。 [證據](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/03fe9a8f8bcfded0e9e6978019204f6f07f06edd) |
| V1-EVT-01 | 可靠正規化物理事件 | PASS_CURRENT | 旋轉／多接觸真 WASM 正規化與 N／Ns／null 原則通過。 [證據](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/05b93659973a4e404060aaf5180bef2962a50c90) |
| V1-EVT-02 | Impact去重與invalidations | PASS_CURRENT | Impact episode 去重、失效處理與拒音後 raw trace 保留通過。 [證據](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/05b93659973a4e404060aaf5180bef2962a50c90) |
| V1-SND-01 | 排序/去重與正交狀態 | PASS_CURRENT | 原邏輯排序／去重／正交狀態已重跑；不冒原生 PCM 連續性。 [證據](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/05b93659973a4e404060aaf5180bef2962a50c90) |
| V1-SND-02 | 有界映射與合法引用 | PASS_CURRENT | 有界曲線、覆寫與非法／stale 引用拒絕有本輪正負證據。 [證據](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/d18dc26be361653c80334a304af7d73d51df34a0) |
| V1-SND-03 | 聲音預算與deterministic admission | PARTIAL_CURRENT | 各資源 cap 有測試；完整本輪 browser telemetry／原生成本仍不足。 [證據](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/05b93659973a4e404060aaf5180bef2962a50c90) |
| V1-SND-04 | 快照/epoch與決策重播 | PASS_CURRENT | 邏輯快照／epoch 與同 trace 決策重播通過。 [證據](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/05b93659973a4e404060aaf5180bef2962a50c90) |
| V1-SND-05 | 接觸/有界latch/material pair layers | PASS_CURRENT | 接觸分類、unknown、有限 latch 與 material-pair 原條件通過。 [證據](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/05b93659973a4e404060aaf5180bef2962a50c90) |
| V1-SND-06 | 可信資產匯入/選擇與生成 | PARTIAL_CURRENT | 可信真 WAV 與資產拒絕已證；全部 native loop／phase 尚缺本輪證據。 [證據](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/b1b30c335c0b0ed121666ec8ec77f38459acd8f4) |
| V1-SND-07 | 安全手動作者與Apply/Undo | PARTIAL_CURRENT | 作者邏輯有分項通過；原生 fade／drain 與 Windows 操作仍缺證。 [證據](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/03fe9a8f8bcfded0e9e6978019204f6f07f06edd) |
| V1-ACO-01 | 真direct path/occlusion | PASS_CURRENT | 數值求解、真路徑選取／來源及移動／材質變更共同滿足兩條字面條件。 [證據](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/3ab58ac3b0c6692782a34840334da6e28e74d8ac) |
| V1-ACO-02 | 有限一階ISM反射與path identity | PASS_CURRENT | 一階有限面反射、blocker 與穩定 path identity 原參考重跑通過。 [證據](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/05b93659973a4e404060aaf5180bef2962a50c90) |
| V1-ACO-03 | 材質/大氣/模型標籤 | PASS_CURRENT | 頻帶能量、大氣／真空與 Synthetic／近似界線重跑通過。 [證據](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/05b93659973a4e404060aaf5180bef2962a50c90) |
| V1-ACO-04 | AcousticFrame與worker邊界 | PARTIAL_CURRENT | 真空 unavailable／空氣恢復通過；pending／stale／error／unsupported 明載未觀察。 [證據](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/4127dc09b5402b4fda39818f641e163f07cb7b08) |
| V1-AUD-01 | 統一SourceGraph與一次處理 | PARTIAL_CURRENT | 目前真 render／下載通過；全部 native arrival／gain／HRTF／Doppler 尚未獨立量測。 [證據](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/38b9e159e46ed07c4bfaf21cd4a0515915ed0c00) |
| V1-AUD-02 | 持續聲源與平滑更新 | PARTIAL_CURRENT | 輸出生命期與取消／重試有證；完整 phase／fade／callback 有界性仍不足。 [證據](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/fe41413fd3c54de65a9d5d8c2ed56081f5b0d00a) |
| V1-AUD-03 | Pause/Resume音訊時間 | PARTIAL_CURRENT | events 重播／seek 與 tail 通過；完整原生時序／隔離仍不足，復原 locator 漂移。 [證據](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/d1474992717b75bf848f0f9cbd78b31223423bdd) |
| V1-AUD-04 | Raw/Simulated與基本reverb | FAIL_CURRENT | 追加 reverb 控制門檻失敗：wet 鍵盤步進仍 0.12，預期 0.13；不推成 DSP 失敗。 [證據](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/620f817bd089d6580ae326b8281c0f106ae68048) |
| V1-UX-01 | Workspace/Transport與資料權威 | FAIL_CURRENT | Gizmo 取消仍提交位置與 revision；公開 60 秒錄製後 render 停用亦保留失敗。 [證據](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/99e63c9f1534f8bf8223d6b12971749fe70eb991) |
| V1-UX-02 | 共享選取與真資料可視化 | PARTIAL_CURRENT | 已顯示的 path／event 選取與真來源通過；全部跨視圖／stale 狀態與 Windows 仍不足。 [證據](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/03fe9a8f8bcfded0e9e6978019204f6f07f06edd) |
| V1-UX-03 | FPS輸入仲裁與安全退出 | FAIL_CURRENT | Observer blur 後仍移動；其他分項通過保留，Windows 方法未執行。 [證據](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/99e63c9f1534f8bf8223d6b12971749fe70eb991) |
| V1-UX-04 | Sound Inspector作者/診斷 | FAIL_CURRENT | Zone 規則參考的可見啟用 checkbox 無法取消勾選；保留其他通過與後兩例未跑。 [證據](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/34e59c98966bb27603690d27959a3b1791981a23) |
| V1-UX-05 | 可及性/reflow/motion | FAIL_CURRENT | wet 原生鍵盤步進失敗；help 前置狀態與完整可及性仍不足，200% 已移除。 [證據](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/620f817bd089d6580ae326b8281c0f106ae68048) |
| V1-UX-06 | Monitor與音訊暴露狀態 | FAIL_CURRENT | 追加完整 monitor 控制門檻保留 wet 步進失敗；暴露狀態仍部分，標籤漂移不當錄製失敗。 [證據](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/620f817bd089d6580ae326b8281c0f106ae68048) |
| V1-RPL-01 | 可追溯capture與finalization | PARTIAL_CURRENT | 封存／重載／unload 輸出保護通過；Pause 重複定位使完整錄製 crash／finalization 仍不足。 [證據](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/38b9e159e46ed07c4bfaf21cd4a0515915ed0c00) |
| V1-RPL-02 | Authoritative replay與seek | FAIL_CURRENT | 追加 seek-to-zero UI 前置實測為 2.983；保留該失敗，不推成重複 impact 或原生排程缺陷。 [證據](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/4653ed1bdf7c38504bb1f4ec26bd2f7c2ad27f74) |
| V1-RPL-03 | Pinned resimulation證據 | PASS_CURRENT | 同機 pinned WASM 兩次 120 ticks 完整 hash 重跑通過。 [證據](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/05b93659973a4e404060aaf5180bef2962a50c90) |
| V1-AB-01 | Acoustic A/B固定條件 | PASS_CURRENT | 原固定條件／metric 加上真 acoustic 比較、更新、拒絕與 combined artifact，通過有限門檻。 [證據](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/604ebdff8c043f844594d0caecfcb2f0736885fb) |
| V1-AB-02 | Behavior A/B自變項 | PASS_CURRENT | 原固定輸入加上真 behavior 比較與 propagation／geometry 不相容拒絕，通過有限門檻。 [證據](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/604ebdff8c043f844594d0caecfcb2f0736885fb) |
| V1-MET-01 | Grounded metrics與無資料拒絕 | PASS_CURRENT | Grounded metric 與 decay 不足回 null 的原參考已本輪重跑。 [證據](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/05b93659973a4e404060aaf5180bef2962a50c90) |
| V1-AI-01 | 原12工具的安全host | PASS_CURRENT | 原 host 安全條件加上 provider／workflow／離線閉環三例通過；不升級 Meta live。 [證據](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/4385c67da77f0e68336fcb4f06cc790a34375873) |
| V1-AI-02 | Behavior提案的安全host | PASS_CURRENT | host 邊界與明確離線 preview／Apply／Undo／artifact／compare 通過。 [證據](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/4385c67da77f0e68336fcb4f06cc790a34375873) |
| V1-AI-03 | Provider邊界、預算及錯誤 | PASS_CURRENT | Provider 邊界與 host 預算／故障矩陣本輪通過；不當 live／billing。 [證據](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/05b93659973a4e404060aaf5180bef2962a50c90) |
| V1-AI-04 | 模型說明只引用真結果 | PASS_CURRENT | grounding、完整離線流程與 controlled refusal 呈現通過，外部 live 門檻不變。 [證據](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/4385c67da77f0e68336fcb4f06cc790a34375873) |
| V1-AI-05 | 真Meta產品整合 | EXTERNAL_GATE | 保留歷史最小 live；目前凍結來源真 Meta／帳號預算仍為外部門檻。 [證據](../../11-v1/ACCEPTANCE_AMENDMENTS.md) |
| V1-VAL-01 | 凍結驗收與獨立審查 | PARTIAL_CURRENT | 本輪獨立程序有效；三個 protected 契約變更與完整最終複驗尚未對完。 [證據](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/05b93659973a4e404060aaf5180bef2962a50c90) |
| V1-VAL-02 | Browser/DSP/E2E與乾淨重開 | FAIL_CURRENT | 公開 60 秒 capture→render 的真按鈕持續停用而失敗；短管線通過不代表全部原生／方法。 [證據](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/d1474992717b75bf848f0f9cbd78b31223423bdd) |
| V1-VAL-03 | 實際裝置聽測與跨browser | HUMAN_GATE_NOT_RUN | 裝置／耳機／跨 browser 專項真人聽測未執行，數位 PCM 不代替。 [證據](../../11-v1/ACCEPTANCE_AMENDMENTS.md) |
| V1-VAL-04 | 正式性能profile與退階 | NOT_RUN | NOT_RUN_BY_USER_DECISION：今晚不跑正式 600 秒；20 秒污染 pilot 不採證。 [證據](../CONTRACT.md) |
| V1-OPS-01 | Wiki/Task/交接/Git持久化 | PARTIAL_CURRENT | 既有 task／歷史保留；最新來源、英文最終檢核與交接尚未完全收束。 [證據](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/05b93659973a4e404060aaf5180bef2962a50c90) |
| V1-COM-01 | 權利/規則/發布授權 | EXTERNAL_GATE | 依賴授權檢查有限通過；資格／條款／根 LICENSE 等仍需外部確認。 [證據](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/05b93659973a4e404060aaf5180bef2962a50c90) |

exit 0 路徑：interaction-priority、scene-curved、behavior-rules、behavior-assets、pipeline-agent、pipeline-dock、pipeline-events、pipeline-motion、pipeline-tail、pipeline-diagnostics、pipeline-combined。

exit 1 路徑：interaction-main（17/18）、interaction-completion（37/39）、scene-inspector、scene-environment、audio-monitor、audio-monitor-retest、pipeline-zones、pipeline-render、interaction-help、recovery、top-monitor。完整 exit／案例／收據 hash 見 JSON 的 final_summary.s4_snapshot。

這是第二次證據裁定，沒有把原 Task／PERF criteria 改成 DONE，也不宣告整體非進階工程或 V1 完成。
