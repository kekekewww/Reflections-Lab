# 第一版整合 checkpoint r4：完整品質檢查通過，縮放版面修補中

日期：2026-10-27。原 goal、Task 依賴、51 項固定驗收及 EN01–06 繼續有效；**第一版尚未完成**。Codex 主導開發，沒有使用 Muse Code 或增加付費 Meta 請求。本機 Git 最新恢復點為 `f006b0e60db18450bdfcbcf22d790b9913724b1e`；之後的原生音訊診斷、輸入競態與新證據尚未提交，沒有 push 或部署。[r3](SESSION_PROGRESS_20261027-r3.md) 保留當時的失敗與修補狀態。

## 已實際執行的結果

- [完整品質檢查](../../artifacts/v1/clean-quality-20261027091558838/verification.json)：`npm run check` 與離線 `npm run benchmark:muse` 均 exit 0；runtime 849/849，來源前後一致，61 個受保護檔案相符。沿用已實際完成、相依輸入未變的 root／spike 乾淨鎖定安裝證據。這不包含 browser、人工聽測、600 秒效能或遠端 CI。
- [當前 UI 27 案](../../artifacts/v1/ui-post-race-functional-20261027T092244732Z/proof-receipt.json)：英文 8、原繁中 13、聲音診斷 2、靜態 3D 預聽 2、原生音訊拒絕來源 2 全部通過，沒有 skip／retry；1667 個輸入前後相同。測試 bundle 輸入 digest 為 `2bb716aa5b5a91be9ed8cce846a764a1e262aa94f2f2922fd9d562f80c1f5067`，後續 CSS 修補需重新建置驗證。
- [Pointer Lock 競態修補](../../artifacts/v1/pointerlock-race-20261027/proof-receipt.json)：首次 Enter 早於原生 lock 通知時，依實際原生 ownership 協調輸入；遲到通知不再清除仍按住的輸入。新回歸 RED 1 FAIL／1 PASS → GREEN 2/2；未修改的原案例 1/1 與相鄰 8 案、獨立審查通過。原失敗與真實通知延遲保留。
- [原生拒絕來源](../../artifacts/v1/native-admission-20261027/node-verification.json)：保存 enqueue 時的 intent／event／rule／frame 關係，與 logical voice 分開顯示；Node 35/35、獨立 20/20，browser 另見上述 2 案。拒絕投影暫存上限 64，預設音訊預算仍為 24 voices／32 sources；測試的 8 sources 限制只屬該 fixture，沒有降低產品負載。
- [物理 38/38](../../artifacts/v1/physics-boundaries-20261027/combined-final/verification.json) 與 [support anchor 修補](../../artifacts/v1/support-anchor-20261027/final-receipt.json) 保留原證據範圍；新的 managed physics lifecycle、storage 及產品四案仍待當前修補固定後執行。

## 真實縮放測試找到的問題

使用者已允許只載入本機 Reflection Lab 的可見測試視窗。[本輪原生測試](../../artifacts/v1/native-zoom-reachability-2026-10-27T09-51-22.380Z-1c73b87a/summary.json) 在 200% 與 320 CSS px 均真正取得 CANVAS Pointer Lock；事件的 trusted、focus、user activation 均為 true。手勢明確記為 [BROWSER_PROTOCOL_GESTURE／NOT_OS_KEYBOARD](../../artifacts/v1/native-zoom-reachability-2026-10-27T09-51-22.380Z-1c73b87a/gesture-method.json)，不是 OS 鍵盤或 IME 證據。

兩案各四項 Mute／Pause／dialog／form 檢查通過，但整體仍 FAIL：200% 的退出按鈕 viewport intersection ratio 為 0.988636374，未完全顯示；320 CSS px 的替代控制中心被另一個 DOM 元素遮擋，該次未保存遮擋元素身分，不能猜測。正依原始 JSON／畫面與 CSS 診斷並窄修；原斷言、門檻及失敗證據保留。API 已恢復 1×，兩個測試自有 browser PID 均退出，舊預覽另由所有者清理。

此前兩次 OS 工具視窗 binding 失敗亦保留，不能稱為原生鍵盤通過，也不再重複同一失敗方法。本輪原生 lock 已成功，故 stderr 的 sandbox warning 本身不能充作 lock 失敗原因。

## 音訊、英文與來源限制

- [Chromium 156 原生音訊](../../artifacts/v1/audio-chromium-final-20261027082344120/final-proof.json) 原 25/25 通過；[Firefox 157](../../artifacts/v1/audio-firefox-final-20261027083454680/final-proof.json) 為 8 PASS／1 原能量 FAIL／9 能力阻擋／7 aggregate 未執行，兩輪 23 份追蹤輸入相同。原誤差約 `3.05176e-5 > 1e-5` 不放寬；獨立分數延遲 reference 解釋不能覆寫原 FAIL。這些不證明裝置聽感、Worklet deadline、underrun 或校準 SPL。
- [完整英文清冊](../en/_reports/corpus-validation-20261027T091512784Z.json) 在該時間點為 262 份原文、243/243 鏡像、零缺漏／stale／error，3704 個維護文件連結通過。此後新增 checkpoint／Wiki／正式文件仍需補譯並重驗 freshness。原始 JSON／PCM／trace 與逐項固定的原始快照共用，不冒充英譯敘述。
- [授權原文包](../../artifacts/v1/bundle-notice-pack-20261027-0823-r3/manifest.json) 保存 173 份原文與限定 bundle 對照；六項來源／tooling 缺口及根 LICENSE 未選保留。它是歷史 build capture，最終 bundle 需重新綁定，不能宣稱法律合規已完成。
- 一次過寬的唯讀進程查詢曾意外返回無關連接器憑證參數；輸出未寫入專案，沒有複製其值或雜湊。之後只查已知自有 PID，禁止再次進行全域 CommandLine 列舉。

## 下一個可執行工作

先完成窄範圍 reflow 修補及獨立審查，再固定新 bundle 跑原縮放／UI、managed physics lifecycle、storage 與產品四案。全部自有測試程序結束後，安排互斥窗口真正執行 `node tests/browser/performance-profile.mjs --phase all --seconds 600`；工具已通過 109 項有效性回歸，實際 600 秒尚未執行，不能用 CLI exit 0 取代量測判定。完整 canonical delivery 中瀏覽器 pre-handler dispatch／deserialization 與 LabRuntime bookkeeping 仍未量測。

最後核對逐項驗收與既有 Tasks，更新正式文件、來源、Wiki、完整英文、handoff 及本機 Git。人工耳機／裝置觀察、本人資格／條款、根 LICENSE 與發布仍分別需要其實際證據或使用者決定。真 Meta 最小 Sound 切片保留原 PASS；US$1 授權的三次請求已用完、US$0.75 預留，成功 usage 估價 US$0.0073235，實際 billing／餘額未知，不再呼叫，也不把開發 executor 當產品 Meta 證據。
