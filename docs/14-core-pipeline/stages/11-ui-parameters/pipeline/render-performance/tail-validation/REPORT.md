# 無效尾響護欄 focused UI 回歸

方法為 **Playwright CLI scripted DOM / headless Chrome**，唯一 scenario，**1／1 PASS，45.2 秒**。實際候選為 `5010685ebfd6bb482aa37e1d82e5f64418b55d9b`；lease 環境傳入的入口 `index-Nm7oRfzL.js`，HTTP SHA-256 與 `baf2542885944b5becf2138fa40e13831d04a1ce7dc1b9f03d3a845d6731706a` 完全匹配。這是原 9fc P2 發現後的獨立新來源回歸，原四案沒有重寫。

先以真 UI 建立一個程序音來源、stems OFF，按「錄製3秒」取得完整 take。全部後續動作使用畫面欄位、Enter、Escape 與下載按鈕；沒有 handler 直接呼叫、HostInternal、bridge、reset Scene 或 guard bypass。

| 次序 | 實際結果 |
| --- | --- |
| baseline tail 0 | 真產生 mix/master/dry 並各自下載，再下載 manifest。WAV 各 3 秒，tailFrames=0。 |
| 10.5 | aria-invalid=true，Generate disabled；可見欄位原因；舊輸出按鈕與 manifest hash 保持原樣。 |
| 10.50 | 同樣 false validity 的第二個 raw draft仍 Generate disabled；沒有因數值相同或重複無效狀態重新啟用。 |
| 空白 | Generate 仍 disabled，原完整輸出與 manifest 保持不變。 |
| Escape | 欄位還原最後已提交 0，aria-invalid=false，Generate enabled。 |
| 有效 0.25 | 原生 input.validity.stepMismatch=true／valid=false，但 app 的有限值範圍政策允許它；Generate enabled，真產生並逐檔下載 3.25 秒 WAV，manifest tailFrames=12000。 |
| 有效 10 | 正常產生並逐檔下載 13 秒 WAV，manifest tailFrames=480000。 |

三次無效 draft 的 manifest SHA 均為 baseline 的 `e1f4b65120db830c510e44aa1f443a849d4d535f8604a15f2fd97c3892c3d374`。總共 9 WAV 與 6 次 manifest UI 下載，各檔 SHA 與實際 manifest 相符；WAV 格式／48kHz／雙聲道／float32 與輸出時基均有硬斷言。這個 focused 案例沒有新增 DSP、聽測或效能通過主張。

新的中央 source-site 對照：

- Generate：`ui.renderpanel.renderpanel.button.8540c33586`。
- Tail NumberField：`ui.renderpanel.renderpanel.numberfield.1723b03d62`。
- 對應 `render.execute`、`render.tail`，以及實際 outputId 的 `render.download.{outputId}`／`render.manifest`。原 9fc source-site 保留其舊版本意義。

原始證據在 `attempts/final-5010685-01/`：`tail-validation-receipt.json`、`candidate-preflight.json`、stdout／process、兩張實際畫面及 `browser-closed-cim.json`。主收據 SHA-256 為 `88bd2f41751e2084357d2f7950ab13d554197f481404d7c3d690388820a6e441`。CLI exit0；11:42:57 UTC CIM 確認工作 PID92720 已退出、headless Playwright Chrome 數為0，之後才整理報告。

page errors、agent requests、被阻擋的外部／付費要求、browser dialogs 均為0。所有 source/test harness 已 freeze；此回歸不修改產品或 Git index。

重現需新的 `PIPELINE_TAIL_AUDIT_ATTEMPT`、lease 提供的 `PIPELINE_RENDER_EXPECTED_ENTRY`／`PIPELINE_RENDER_EXPECTED_SHA256`，對 production preview4173 執行唯一 config：`tests/browser/parameter-audit/pipeline-render-performance-tail-validation.config.ts`。同一 attempt 使用 wx 防止覆寫，失敗保留原 cause；不要為通過而重設場景或改控制時鐘保護。
