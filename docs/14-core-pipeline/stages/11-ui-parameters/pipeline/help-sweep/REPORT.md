# 最後 Help／表格捲動／Zone overlay 實測

方法為 **Playwright CLI scripted DOM／headless Chrome**，不是 native app、MCP、真人鍵鼠或聽測。產品固定 `5010685ebfd6bb482aa37e1d82e5f64418b55d9b`；HTTP entry `index-Nm7oRfzL.js` SHA-256 `baf2542885944b5becf2138fa40e13831d04a1ce7dc1b9f03d3a845d6731706a`。恢復既有 preview 後，8個實際HTTP檔案均200且hash符合原501建置；見 `PREVIEW_RECOVERY_5010685.json`。

最終窄重驗 `final-5010685-04` **1／1 PASS，約1.1分鐘，CLI exit0**。`FINAL_SCOPE_JOIN.json` 逐筆串回20個reachable caller的真PASS，以及本輪最後4個semantic family；它合併的是固定原始觀測，不宣稱一次乾淨完整全產品UI都在501重跑。

## 真正操作與可觀察結果

- Help：20個本lane caller各自有非空內容、自己的aria-describedby與pointer／focus／Escape證據；部分亦有hover。來源分別是attempt02／03／04。六個原缺內容caller已實際準備：paused Replay中的Start recording disabled info、Independent preview metadata、OnBounce draft、binding.enabled=false、空Scene／空query、ready原創WAV的dry audition。Comparison、Performance、Path、Monitor等方法缺口亦有自己的觀測。不是借generic HelpTip成功補填每個caller。
- Dock collapse是會移動本身位置的真動作。點擊後pointer可離開移動的控制並關閉tooltip；記錄真click、更新狀態及關閉時仍存在的accessible description，再獨立移焦／focus顯示非空tooltip，不把閉合誤判成產品壞掉。
- Paths table：100%正常顯示、1600×1200 viewport，inner區域的scrollLeft **0 → wheel 6 → ArrowLeft 0**。
- Events table：100%正常顯示、1000×620 viewport，inner區域的scrollLeft **0 → wheel 191 → ArrowLeft 151**。兩者均讀取focus後的新baseline，避免把focus自動捲動冒成鍵盤效果；DOM `elementFromPoint`確認wheel座標確實在可見inner區域內。
- 兩個inner table高度等於自身scrollHeight，垂直clip由outer `.dock-content`擁有；原始收據分開記錄outer的clientHeight／scrollHeight／scrollTop，不將其當inner垂直捲動PASS，也沒有改CSS／DOM style製造overflow。
- Zone overlay：透過正式Project UI合法匯入固定球、enabled sphere與disabled box。Frame selection後的實際畫布可見大sphere wireframe與較淡box範圍；點空白取消選取，再以實際pointer `(793,550)`穿過wireframe選回ball。公開slider End→Home開啟paused Replay，作者停用並截圖，End replay恢復；FPS模式有實際crosshair／mode與作者停用，截圖後正常退出。
- `ZONE_OVERLAY_VISUAL_REVIEW.json` 是另外讀取5張真正PNG的有限目視紀錄：Editor大volume wires存在、Replay／FPS沒有大volume wires、End replay恢復。小型物理球的debug wire仍存在，沒有誤當Zone；不是數值pixel-absence或opacity量測。原raw中的visualPending不覆寫成事後自動PASS。

## 保留的非可達條件

兩個native拒絕caller `ff9b12f624`／`d773ccb4d7` 在這段bounded flow沒有真正native拒絕，明列NOT_OBSERVED；不注入假的拒絕、CPU過載或私有狀態。Comparison `c7bbe36cfd` 只在status空值時顯示，正式RecordingHost所有分支都供非空status，未偽造model。這三個條件不計為一般公開UI可達PASS。

## 原失敗與修正

1. attempt01在 `page.goto` 前遇到4173 connection refused，未進產品操作；重啟同一501 dist preview並重新核8個HTTP後另開attempt。
2. attempt02有多個caller真PASS，但collapse布局移動不符合舊tooltip假設；舊harness又等待Replay期間本來disabled的header Pause，短Replay自然結束後錯按了Start。以Ctrl+C停止本人CLI、保留raw／trace與 `STOP_REASON.json`，CIM確認Chrome0。
3. attempt03保留更多caller／Editor pickthrough PASS，但wheel點落被outer裁切的位置；slider原值已0，單按Home不會觸發onChange，尚未開paused Replay。原raw仍FAIL。
4. 只修harness：wheel使用可見交集並DOM只讀命中確認、slider真End→Home、已PASS caller以固定raw refs跳過；attempt04只補最後phase並PASS。**沒有修改產品、guard或驗收數值。**

CLI stdout／exit及小型收據在各attempt目錄。大型trace與原始Project／自製WAV留在 `.cache/pipeline-help-sweep/`，未冒稱全數入Git。`HARNESS_FROZEN_QUALITY.json` 固定最後spec/config SHA與strict TypeScript／ESLint／Prettier exit0；`BROWSER_CLOSED_FINAL.json`確認本lane Chrome／CLI皆0並釋放lease。正式600秒性能、原生工具存取、Meta live、裝置聽測及完整V1門檻不由本案判通過。
