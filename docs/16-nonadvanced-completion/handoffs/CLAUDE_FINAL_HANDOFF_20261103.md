# Claude 接手結果與人工測試交接（2026-11-03）

執行者 Claude Code（claude-opus-5-5），實作分工使用 Codex（gpt-6.1-sol，xhigh）。接手來源是 [Codex 交接報告](CLAUDE_CODE_HANDOFF_20261103.md)。這份文件說明接手後完成了什麼、仍未通過什麼，以及人工測試怎麼開始。**這不是整個第一版完成的宣告。**

## 版本

| 項目 | 值 |
| --- | --- |
| 凍結的產品來源 | `544d8d9fe7d4c87a62e093a64fb54eb2584826d7`（src tree `0d9554956dec35b1b7d340f8ad7c206147e1cbd4`）；之後的提交只改測試與文件，例外是下兩列 |
| 人工測試前介面整理 | `1be15d5c6c4694e419c091e79754ef999ec6cab6`：只改 `src/ui/styles.css`、`src/ui/top-monitor.css`（src tree `3924149dff4e79a6c08da785f098975cf7e77d11`），DOM／role／文案不變；見下方「人工測試前的介面整理」 |
| 人工測試回報修正 | `c1002ac7`（第一人稱視角跳動、預設球偶爾無聲，src tree `6cb3d25a`）、`2f2aa2c7`（抓取在快轉時鬆脫，src tree `c4bab9cb`）；之後 `15e0282f`、`956ee761`、`f04fbbf8` 只改瀏覽器測試。見下方「人工測試回報與修正」 |
| 整合分支 | `codex/nonadvanced-integration-20261103`（`.worktrees/nonadvanced-20261103/integration`） |
| 本機 Main | `D:/Developing/Meta Hack` 的 `main` 合併此整合分支（merge commit 記在 Wiki 交接）；沒有 push、沒有部署 |

## 已完成且有證據

| 項目 | 結果 | 證據 |
| --- | --- | --- |
| 完整 `npm run check` | 研究回歸、lint／型別／格式、runtime 2270／2270、build、授權全部通過；英文鏡像當時待補，之後補到 0 缺漏、0 過期 | [check-05 摘要](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/05b93659973a4e404060aaf5180bef2962a50c90) |
| 7 項 runtime 失敗 | 4 項是測試沒跟上已定規則；1 項是產品 bug（未啟用聲音時暫停後永遠停住，已修）；2 項是測試時序競爭 | [原因與修正](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/1434c948f5030cc7ed4187865fe3a52101a73d96) |
| 長輸出 | whole63 原門檻通過（58／58），master／mix／dry 與獨立參考逐位元相同；原因是 Chrome 多輸入相加順序不固定，改為兩兩相加 | [attempt05](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/d9337a881741f4aff6dc71b3c3389693220a9b58) |
| 產品 E2E（維護中的 refined v3） | 三次乾淨啟動＋遺失 WAV 重新連結 4／4 通過，來源與 bundle 全程一致 | `artifacts/v1/product-e2e-chrome-20261103T100747Z/` |
| 十次 reset／import 與 dispose | 2／2 通過 | `artifacts/v1/physics-acceptance-20261103/browser-20261103100843747/` |
| 聲學／voice／資產同條件比較 | 四種聲學傳輸與兩種聲音資源政策在 Node 與 Chrome 結果一致；預設維持 reference | [ABCD](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/c15bc23c848d345b18bc4e001c6d098ec2a7fc55)、[資源](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/9e6c4c833844049cfae8d367090c556897850688) |
| 錄製吞吐改善 | 儲存與求解都改為兩段管線、批次化，每格只編碼一次，UI 重繪減少 | [IDB 收據](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/a1f1c741f21c9cf68cd69cbbef15af6a4c529d8e) |
| 需求對照 51 列 | 見 [對照表](../requirements/REQUIREMENT_CROSSWALK_20261103.md)：PASS 列只代表有當前直接證據 | 同左 |

## 仍未通過或有限制

| 項目 | 現況 |
| --- | --- |
| 錄製開始時可能暫停 | 全新瀏覽器 profile 第一筆儲存或單一長幀超過原 8 frames／約 66 ms 上限時暫停；資料不丟，按「Resume processing in batches」可繼續。production 頂列監測 4／5，失敗案例就是這個（錄製 0.07 秒、tick 52）。要完全不暫停只能放大原上限，違反驗收，所以保留 |
| 已在播放的連續聲音 | 按 Record 會先淡出再從原位置重啟，這段錄製只有「歷史不完整」的稽核游標，A/B 不帶原生游標 |
| S4 全 22 路徑 | [s4-final-01](archive://uncommitted-local/docs/16-nonadvanced-completion/lanes/ui/s4/attempts/s4-final-01/)：11 通過、11 失敗；失敗路徑內多數案例仍通過（如 interaction-main 17／18、interaction-completion 37／39）。一類是舊腳本與目前 UI 不符（按鈕改名或重複：「Resume」與「Resume simulation」、兩個 Pause、已移除的「01 建立場景」、重複的說明按鈕）；另一類需要確認產品：gizmo 拖曳取消後位置沒有還原、視窗失焦後環繞沒有停、curved acoustics 停用狀態、zone 規則參考取消勾選無效、找不到 Propagation medium、5 個說明入口、audio-monitor wet 預設步，以及公開 60 秒錄製後「Render audio files」仍停用（可能是已知的錄製暫停）。今晚沒有修，全部保留原失敗 |
| 正式 600 秒效能 | **未執行，使用者 2026-11-03 決定今晚不跑極端情境**；20 秒 pilot 受同時負載污染，不算證據 |
| Windows Computer Use | **BLOCKED**：Codex 的 Computer Use 工具因無法可靠判定 Chrome 目前網址而拒絕操作（與 2026-11-02 同一政策），沒有任何產品步驟執行：0 通過、0 失敗、1 BLOCKED、8 NOT_RUN。拒絕原文見 [attempt-01](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/03fe9a8f8bcfded0e9e6978019204f6f07f06edd)；這部分要由人工測試補上 |
| 真人聽測、實體鍵鼠、Meta live | 需要人或外部帳號，未執行 |

## 人工測試前的介面整理（CSS-only）

依使用者 2026-11-03 要求（必要間距、相似元素不再層層包框、提高可讀性；參考 Emil skills）：互斥模式改為單一外框分段切換、監聽列路由接成一組、頂列量表加框、Inspector 標籤與數值分級、窄寬度工具列改為換行。前後截圖與驗證見 [整理紀錄](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/cf5f2d546af85fd8269ca634ba56f8e8326d633c)。

- 通過：UI 單元 232／232、format、lint、Emil 固定來源；十次 lifecycle 2／2；production 頂列 4／5（標頭 390／929／1440 px 版面通過，失敗仍是原錄製暫停案例）。
- **refined v3 產品 E2E 今晚沒有重現 4／4**：改版前後在同一時段都大多失敗（改版前 1／6、改版後 2／15 個乾淨啟動），失敗都是錄製中暫停；與 10:07 通過那次完全相同的改版前 build 現在也失敗，所以判定為執行環境問題，不是 CSS。當時 C: 只剩約 4.1 GB、記憶體 commit 接近上限。
- S4 全 22 路徑在改版後 NOT RUN。

## 人工測試回報與修正

使用者在人工測試前後回報三個問題，已修正並由使用者實機確認（視角與碰撞音「Both fixed」、抓取「Grab feels good」）。原因、修正、數據與證據見[修正紀錄](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/b51ed8540d551e32d184051a79aef29acc91291b)。

- 第一人稱視角跳動：改用原始滑鼠（`unadjustedMovement`，不支援時回退），並丟棄孤立的錯誤滑鼠位移；靈敏度不變。
- 預設球偶爾無聲：有實際衝量的預測接觸點不再被略過，同一接觸中穩定分離後的新打擊也會發聲；真 Chrome 中每個撞擊都啟動一個聲音、0 個拒絕。
- 抓取鬆脫：目標點與速度前饋 3→20 m/s、伺服 10→20 rad/s、每公斤加速度 20→150 m/s²（絕對手力 150 N 不變），落後超過 1.5 m 持續 0.5 s 或超過 3 m 才放開；172–573°/s 的轉身都不再掉落。
- 驗證：runtime 2284／2284；真 Chrome pointer-lock 2／2、十次 lifecycle 2／2、linked-workflow-v2 8／8；ui-refined-v2 43／47，同樣 4 項在修正前來源也失敗；refined v3 仍受錄製暫停的環境問題影響（1／3）。S4 NOT RUN。

## 人工測試：怎麼開始

1. 在整合樹或本機 Main 執行 `npm run build`，再執行 `npx vite preview --host 127.0.0.1 --port 4173 --strictPort`，用 Chrome 開 `http://127.0.0.1:4173/`（這是測過的 production 版本；`npm run dev` 也可以，但比較慢）。
2. 依 [完整測試程序](../../11-v1/FULL_TEST_PROCEDURE.md) B 節記錄「通過／失敗／未測」；沒看到的寫「未測」。
3. 本輪新功能請特別看：頂列 Levels／Spectrum／Waveform／Load 四種監測與聲道切換、錄製（含暫停後 Resume）、重播與 A/B、長輸出 render 與逐檔下載、中英文切換。

### 3 分鐘展示建議

- 展示前先清出 C: 空間並關閉用不到的大型程式：今晚 C: 只剩約 4 GB、記憶體 commit 接近上限時，錄製暫停比稍早明顯頻繁（確切原因未查明）。
- 先在同一個瀏覽器視窗做一次短錄製暖機，再正式展示；按播放後等 1–2 秒再按 Record，Record 當下不要切換監測模式。
- 先按「啟用監聽」，聲音與 Spectrum／Waveform 才會有資料。
- 若出現「The fixed-step workload limit was exceeded… Recording is paused」，按 Resume 即可，資料保留。
- 暫時不要示範「取消 gizmo 拖曳」或「環繞相機時切換到其他視窗」：S4 這兩項失敗，尚未判定是產品問題還是舊測試腳本。
- 預設房間場景流暢；不要現場加入大量物件。長 render（63 秒素材）約需 2.5 分鐘，短錄製很快。
- Meta 實驗面板是離線示範資料，不會連網。

## 給下一位工程師

1. 逐一判定 S4 失敗路徑是產品回歸還是舊腳本與目前 UI 不符（gizmo 取消、視窗失焦停止環繞、locale 按鈕、Propagation medium 位置、curved acoustics、zones／render 等），產品回歸要修並重跑。
2. 錄製開始的暫停：在不放大原上限的前提下找出第一個長幀的來源（建議 production profile＋Long Animation Frames）。
3. 使用者同意後再跑正式 600 秒 V4。
4. 長輸出 attempt05 跑在 `89f65e4d`：之後 `src/audio`／`src/acoustics` 只多 7 行 `resume()` 修正，但錄製管線與 UI 有改動，所以它不是凍結來源上的重跑；需要時在凍結來源重跑。
5. 同步 Wiki 固定規格：`PHYSICS_ARCHITECTURE.md` 的抓取建議值、`PHYSICS_AUDIO_BRIDGE.md` 的 rearm 說明與 `ACCEPTANCE_AMENDMENTS.md`，數值以[修正紀錄](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/b51ed8540d551e32d184051a79aef29acc91291b)為準；文件程序以外仍用 `locator("canvas")` 的 spec 也要改選擇器。
