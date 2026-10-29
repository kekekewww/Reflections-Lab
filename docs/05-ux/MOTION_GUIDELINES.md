# 動畫決策與時間隔離

更新：2026-10-26。狀態：規範／設計初值，實際 UI／裝置動畫測試 **NOT RUN**。依 [Emil 固定版](EMIL_SKILLS.md) 的頻率、目的、成本與中斷原則整理；數值只維護於 [DESIGN_TOKENS.json](DESIGN_TOKENS.json)。本頁不將視覺效果當作聲學或物理證據。

每個新增動畫都在設計 review 留下以下決策欄位；第一項結果為「不需要」時直接呈現靜態回饋。

| 順序 | 必答問題 | Reflection Lab 決策／可驗證結果 |
| --- | --- | --- |
| 1 頻率 | 是否真的需要？一天／一個 session 會出現幾次？ | 鍵盤捷徑、Command Palette、選取、數字與 HUD 更新直接顯示。高頻操作不排隊、不等入場／退場完成。 |
| 2 目的 | 傳達哪個資訊？ | 僅採回饋、來源位置、狀態變化或避免突兀變更；工程圖不使用裝飾性移動。沒有具體目的則移除。 |
| 3 成本 | 最便宜的工具／屬性是什麼？ | 簡單狀態先 CSS transition；需程式控制才 WAAPI；只有真正需要 gesture／spring／exit 才評估 library。預設 transform／opacity，其他屬性逐裝置量測。 |
| 4 曲線／長度 | 是否延後可讀性或操作？ | 使用 `motion.easing` 與 `motion.duration`。進出優先 out；禁止全域 `transition: all`、scale(0)、為等待動畫阻擋輸入。 |
| 5 中斷 | 快速重按、反轉、Esc、pointer cancel 會如何？ | 從目前視覺值 retarget；domain command 不重複；取消不提交；gesture 釋放 pointer capture；離開頁面清理 animation。 |
| 6 替代 | Reduced Motion／keyboard／touch 如何？ | reduced-motion 預設即時狀態變化；必要理解輔助可保留透明度但須列理由。hover 限 fine pointer，focus 不依 hover；keyboard 操作無位移。 |
| 7 證據 | 真實畫面及效能是否量過？ | 記錄 browser/device/zoom、正常／降動態、快速反轉、慢放與 frame trace；只有程式碼時記 STATIC REVIEW。 |

偶發面板可採 `duration.panel`，按壓僅在合適 pointer 動作採 `pressScale`，modal 使用 `duration.dialog` 但焦點立即轉移。Tooltip 第一個可短暫進場，相鄰已開啟時直接顯示。資料錯誤、Pause、Mute 和失去 lock 的回饋立即呈現，不能為了漂亮淡出而推遲安全行為。除明示且量測過的特殊情況，UI 動畫低於 300ms；此為設計審查門檻，不是效能量測結果。

不使用連續 blur、全螢幕 backdrop 動態、每列 stagger、無限制 layer promotion 或每幀 React setState。Accordion 的 layout 動畫只有在 transform 無法表達時採用，需縮小作用域及量測。`will-change` 只在實際 trace 有問題後限制於必要元素，不能加在全域。CSS／WAAPI 使用 transform 也不保證所有 browser 都會 GPU 加速；以 recording 確認，降級時仍須正確。

## 不可共用的時基

| 時基 | 責任 | 不能用它推論 |
| --- | --- | --- |
| UI transition time | 面板、按壓、focus 等呈現 | physics tick、到達延遲或聲音 onset |
| render / requestAnimationFrame | Three 視圖及 fixed-step 插值 | 已完成新 solver frame 或音訊 deadline |
| physics fixed step | 約束、接觸、body 狀態 | 動畫 easing；不能拿 UI spring 當 Rapier grab |
| acoustic solver frame | 一組 source/listener 的結果與 revision | CSS 假補間的路徑；沒個別 paths 就不能畫聲線 |
| audio sample/block clock | 實際 frames/sampleRate、gain/delay smoothing、排程 | 60 FPS 的視覺預算 |
| AI/network completion | 非同步建議／diff／取消 | render/audio callback 可等待網路 |

視圖可平滑 observer camera，但不能回寫量測數值或捏造未求解的反射線。Grab 由有限 impulse/torque 與碰撞求解控制；UI 的 bounce、over-drag、momentum dismissal 不適用於持有剛體的物理限制。音訊淡化與 `Freeze-and-fade` 維持 [Workspace 契約](WORKSPACE_ARCHITECTURE.md)，其 DSP 初值不由 CSS token 管理。六項獨立量測預算見 [PERFORMANCE_STANDARDS.md](PERFORMANCE_STANDARDS.md)。

## 審查與上游差異

使用 `review-animations` 可產生 Before/After/Why 表格；專案另外記錄實際驗證層級。上游有「Reduced Motion 不能為零」、generic drawer／toast 較長時長、強制 press scale、picker width animation 的細節。Reflection Lab 優先採即時、高可讀與必要時零動畫；規範已決定的例外需明示，不能因上游建議而增加依賴、改 FPS 物理或延長高頻操作。原始上游檔案保持不改，差異只記本專案規範。

動畫驗收：迅速開關不跳回起點；Esc／blur 可中斷；focus 不遺失；Reduced Motion 仍有可讀狀態；觸控沒有殘留 hover；solver／audio 結果不隨面板動畫變更。所有項目現階段 **NOT RUN**。
