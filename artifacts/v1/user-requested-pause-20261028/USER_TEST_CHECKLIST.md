# 待使用者測試／User tests for a later session

狀態：依使用者要求暫停；以下皆為尚未執行／延期，沒有新增 PASS 或 FAIL。現在不需操作。舊 localhost 網址、預覽視窗與 PowerShell 指令已失效，請勿重用。

Status: paused at the user's request. These tests remain NOT RUN / DEFERRED; no new pass or failure is inferred. No action is needed now. Previous localhost URLs, preview windows and PowerShell instructions have expired and must not be reused.

## 1. 原生桌面互動／Native desktop interaction

- [ ] 日後明確恢復此項測試時，先重新準備與核對目前 build、獨立 Chrome 測試視窗、有效網址及測試指令；桌面需解鎖、螢幕喚醒。現在沒有可用的測試窗口。
- [ ] 實際驗證瀏覽器原生 200% 縮放、焦點與可操作性；確認 320 CSS px 視口的版面及控制項可及性。視口模擬需獨立標記，不等於原生縮放。
- [ ] 實際進入／退出 Pointer Lock，記錄結果、錯誤與畫面；程式碼審閱與 hidden 視窗不能代替此項證據。

When this test is explicitly resumed, prepare and verify a fresh build, isolated visible Chrome window, URL and command. With the desktop unlocked and awake, verify actual native 200% browser zoom, focus, reachability and the 320 CSS px viewport case (label viewport emulation separately). Enter and exit Pointer Lock and record the observed results. No test window is currently available.

## 2. 裝置聽測／Device listening

- [ ] 使用者先前提供的裝置：Austrian Audio Hi-x65 耳機、ADAM Audio D3V 喇叭；日後方便時分別記錄實際使用的裝置。
- [ ] 重新準備與核對目前版本的聽測頁；先保持暫停、由低裝置音量開始，再啟用聆聽。依既有聽測 protocol 執行，不使用舊網址。
- [ ] 記錄 Windows 輸出路徑、DAC／音效介面及音量；可觀測時記錄 AudioContext sample rate／block size，無法得知就填 UNKNOWN。
- [ ] 記錄方向／距離、反射／遮蔽、碰撞／連續音源、A/B 與播放／暫停時的實際觀察及異常。比較時保存場景與條件，區分 acoustic A/B 與 behavior A/B。

Reported devices: Austrian Audio Hi-x65 headphones and ADAM Audio D3V speakers. Later, prepare a freshly verified listening page, begin paused at low device volume, and follow the existing listening protocol. Record the actual Windows output route, DAC/interface, volume, and observable sample rate/block size; use UNKNOWN when unavailable. Record spatial, reflection/occlusion, contact/continuous-source, A/B and playback observations, preserving comparison conditions and distinguishing acoustic from behavior A/B.

Actual output route, sample rate, block size and hearing observations remain UNKNOWN. Automated graph/DSP checks do not establish human listening quality or calibrated SPL.

## 暫停邊界／Pause boundary

目前保存的正式 Git checkpoint 為 `6aafa976c96c810027153eae214a47c0a2a4dd87`；暫停交接與後續 metadata 尚未提交。第一版仍未完成：正式效能、部分驗收及外部權利／競賽門檻仍須另外處理，不因留下使用者測試而視為只剩人工測試。所有自動工程、代理及測試已停止；沒有排程自動恢復。

The saved implementation checkpoint is `6aafa976c96c810027153eae214a47c0a2a4dd87`. Later metadata and this pause handoff remain uncommitted. V1 acceptance is still incomplete: performance and external rights/competition gates also remain. All automatic engineering, agents and tests are stopped; no automatic resume is scheduled.
