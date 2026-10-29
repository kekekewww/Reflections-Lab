# 第一版整合 checkpoint r7：效能修補已建置，音訊準備逾時另行驗證

日期：2026-10-27。完整第一版 goal 仍為 ACTIVE；原 51 項需求、EN01–06、Task criteria、效能負載及數值門檻未放寬。Codex 持續負責實作及協調，使用凍結測試、獨立程序、reference 與隔離審查驗證；本次未使用 Muse Code，也未新增付費 Meta 請求。

## 已核實的新版範圍

- 以明確指定的 Node `22.17.0` 與 npm CLI `11.4.2`，完成主專案及 physics spike 的 offline `npm ci`；兩份 lockfile 未變，1734 項來源前後一致。[鎖版安裝收據](../../artifacts/v1/qualification-locked-offline-ci-20261027144405972/verification.json)。這份證據取代早先無法證明 npm PATH 版本的安裝紀錄；原紀錄保留。
- 安裝後重新執行 `typecheck`、`lint`、`test:runtime`，實際各 exit 0；runtime **900/900 PASS**，沒有 fail、cancel、skip 或 todo，1734 項來源前後一致。[post-CI 收據](../../artifacts/v1/qualification-post-ci-explicit-node-20261027145219929/verification.json)。這不是完整 `npm run check` 或 browser／裝置驗收。
- 正式候選建置成功，input digest `a699b0b4dbcb53227ec76124b782641ae2ba7685b76f03878e045feb311f5637`；170 項建置輸入、12 份 bundle。此步沒有啟動 preview 或 browser。[建置封存收據](../../artifacts/v1/ui-qualification-fixed-build-20261027T145717497Z/proof-receipt.json)。

## 效能修補及證據界線

UI／physics／interaction 修補避免窄相機、Listener 與 mode 讀取觸發整份 world 投影；contact 投影改用每次呼叫建立的索引。作者資料以實際 document identity 維護分離且凍結的 view template；公開 DTO 仍保持獨立，原始權威 Scene 不被凍結。事件投影保留原排序與 512 筆界線。RED／GREEN、原投影 reference、mutation／保留快照／相同 revision 匯入與獨立審查證據見 [UI 修補封存](../../artifacts/v1/ui-performance-candidate-sourceend-20261027T143736524Z/EXPORT_RECEIPT.json)。Node 量測不代表 browser p95 達標。

音訊 band filter 保留運算順序，使用有界 FFT layout／workspace 與精確 IEEE-754 normalized-response memo；最多 512 entries、1 MiB key/kernel payload，不宣稱總 heap 只有 1 MiB。12480 份舊／新輸出逐 byte 相同。Route 只在 desired IR 與目前 active target bank 完全相同時重用，仍保留 scale、delay、direction、gate、ramp、epoch 與 dispose 語義。[音訊修補收據](../../artifacts/v1/audio-delivery-candidate-sourceend-20261027143309508/sourceend-proof.json)。重用會保留 convolution history，不能宣稱與舊版冗餘重建附近的 PCM 逐 byte 相同；新增獨立 native state reference 尚未執行。

效能 harness 的 RAF collection provenance 與 marker 邊界分開驗證，保留原 native task duration／邊緣工作；physics 每個量測步前喚醒既有 255 個 Dynamic bodies，原 30 步 impulse、1 Fixed／64 CCD、geometry、solver、dt 及負載不變，wake 成本另列。146/146 Node 測試及獨立靜態審查通過；新 profile 仍 NOT RUN。[harness 修補收據](../../artifacts/v1/performance-boundary-awake-sourceend-20261027.json)。

唯一已完成的正式 600 秒首輪保留 [r6](SESSION_PROGRESS_20261027-r6.md) 與原始 FAIL／UNVERIFIED：physics native p95 2.10 ms、delivery 15.10／51.10 ms、UI RAF p95 66.60 ms，另有 cadence／負載與 trace 起始邊界問題。原 raw／trace 不重寫、不離線重分箱成 PASS。

## 當前音訊驗證阻礙

新版兩次原 25 項 Chromium 驗證皆為 **18 PASS／0 numerical FAIL／7 NOT RUN**；七項停在 baseline 模組準備階段，沒有進入 DSP 判定。具被動觀測的第二次，prepare evaluate 實際耗時 17731.0554 ms，超過原 15000 ms；十四個本機請求全部 HTTP 200，最後回應晚於期限，觀察到 Vite source transform／delivery 延遲。底層 Windows／Vite 延遲原因尚未確定；觀測本身有成本，不能宣稱 timing-neutral。[診斷](../../artifacts/v1/audio-qualification-original25-observed-20261027151352235/diagnosis-summary.json)、[原結果](../../artifacts/v1/audio-qualification-original25-observed-20261027151352235/verification.json)。

原 23 份輸入、oracle 與 15 秒／2 秒限制未改；實際 Node exit 1，已知自有 Node／browser／server 清理完成。另一次 Windows `--import` URL 格式錯誤發生在 runner／browser 啟動前，獨立保留為 transport error，不算 native trial。

已核准另建 prepared-static V2：先建置相同六套件及 harness，使用固定 bytes 的本機靜態伺服器，保留原 per-suite 流程、gesture、capability、classifier、oracle 及時間上限，加入凍結來源／bundle hash、AST conformance 與負例檢查。**目前僅進入實作，尚無 V2 native PASS。** 舊錯誤不被覆蓋。

## 待完成及下一步

1. prepared-static V2 conformance／獨立審查後執行一次原 25 項；通過及清理後，執行新的 IR state native reference，再進行短 smoke。短 smoke 不能代替正式 600 秒 profile。
2. 以新版固定來源重驗 UI／真 native zoom／physics／storage／產品 E2E；先前 `0eef…` 的功能 PASS 只證該版，不能直接移作 `a699…` 通過。
3. 確認負載／邊界與成本後再授權新正式 profile，保留所有既有失敗。
4. 使用者回報耳機 **Austrian Audio Hi-x65**、喇叭 **ADAM Audio D3V**。實際輸出路由、sample rate、block、click/pop、volume jump、移動定位、dropout 及 Pause/Resume 聽測仍 NOT RUN；同 context 靜音 block helper 只有 18 項 synthetic PASS，不代表 native、hearing、Worklet p99 或 SPL。
5. 更新最終狀態、需求證據、Task／Wiki／handoff、全部英文 freshness、完整品質檢查及本地 Git checkpoint；不 push／部署。英文原 243 份鏡像是先前快照，不能宣稱已涵蓋新 checkpoint。

Task0006／0017／0019 維持已有證據的 DONE；Task0020 維持 IN_PROGRESS。Meta 已完成的最小產品 sound live slice 保留；三次授權 request slots 用盡，billing 未查證，不新增付費呼叫。資格／登入後條款、根 LICENSE 與發布決定仍保留外部門檻。現有本地 Git 恢復點為 `f006b0e60db18450bdfcbcf22d790b9913724b1e`，本輪修補及證據尚未提交。
