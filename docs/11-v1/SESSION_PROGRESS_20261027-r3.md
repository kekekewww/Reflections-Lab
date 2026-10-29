# 第一版整合 checkpoint r3：固定驗收修補中

日期：2026-10-27。延續原 goal、Task、Git 與驗收；**第一版尚未完成**。開發由 Codex 主導，沒有使用 Muse Code 或新增付費 Meta 請求。核心恢復點仍為 `e6b898c30193e8cd9e5ef9ddc2f1e6bcb8aee313`，後續雙語及修補尚未提交；沒有 push／部署。

## 已執行結果與版本

- [乾淨品質檢查第三輪](../../artifacts/v1/clean-quality-20261027064454319/verification.json)：root 與 physics spike 的鎖定離線 `npm ci` 均 exit 0；完整 `check` 在 lint 的 9 個錯誤停止。來源前後一致、61 個受保護檔案相符；runtime／build／license／English 在該完整命令內尚未執行，不能標整體通過。
- [lint／格式窄修](../../artifacts/v1/lint-repair-20261027/run-20261027T065502400Z/final-proof.json)：移除兩個未使用 import，七處 null／undefined 比較保留語義，六個維護檔案僅格式化。lint、格式、型別檢查通過；相關回歸 61/62，一個既有 support anchor 缺陷亦由修改前副本重現。原始失敗與 byte preimage 保留。
- [support anchor 修補](../../artifacts/v1/support-anchor-20261027/final-receipt.json)：持續聲源保留 producer 的 `pose.contact`，較強 impact 保留自己的瞬時接觸；既有與新增 17/17、相鄰 50/50、獨立審查通過。這不是 browser／DSP／聽測通過。
- [物理邊界完整結果](../../artifacts/v1/physics-boundaries-20261027/combined-final/verification.json)：29 個既有案例加 9 個坡面、門口、CCD、旋轉點速度／接觸 normal／多接點案例，38/38；61 個保護 hash 相符。舊對稱性 oracle 的 RED 與更正理由保留，核心 Physics 沒有因此改寫。
- 固定中文產品 `22ca…` 四案及雙語 `9ae2…` 英文 8／繁中 13 的歷史 PASS 繼續有效於各自 tested bytes，詳見 [r2](SESSION_PROGRESS_20261027-r2.md)。新 head／favicon 與後續修補需當前 bundle 複驗。

## 最新獨立審查發現與執行中修補

依原 `V1-UX-04`，需要把實際 evaluator 的 cooldown／voice-limit 等決策投影到診斷介面，顯示 rule、event、接觸 emitter 與原因；Replay 使用已保存決策，不能重評後冒充原結果。此投影與專用回歸正在獨立驗證。

同項原驗收亦要求 Ready／Paused 的靜態場景 3D 預聽。現有乾音預聽不足以解除此條件；正在加入真 Custom Acoustic Core → 同一 AudioEngine 路由、獨立預聽時鐘／epoch、明示停止與來源 metadata。缺真接觸資料要拒絕，不捏造撞擊；不能改原 run、錄製或 metrics。

英文需求為「介面＋所有專案文件」。原清冊 247 份通過的範圍外另漏掉 6 篇人工中文證據說明；已擴大納入完整英譯，原始 JSON／PCM／trace、精確 source snapshot 與 browser-generated error context 逐項分類為共享原始證據，不能整個排除人工報告。

正式性能入口的獨立審查發現，需加強 actual voice／current path／retired route、capture debt、physics 負載與 RAF coverage 的有效性判定，並真正執行 active warmup。量測工具修補中；不修改性能門檻、產品 cap 或用較少負載製造 PASS。

## 授權與後續驗收

使用者已明確允許開啟只載入本機 Reflection Lab 的可見 Chrome，供原生 200% 縮放與 Pointer Lock 驗證。舊嚴格 FAIL 仍保留；新版本需驗實際 Mute、Pause、退出、表單與 320 CSS px reflow，自有程序測完清理。

下一步依序為：完成互不重疊的修補與獨立審查 → 固定來源跑完整 `check`／離線 prompt benchmark → 新雙語 UI／診斷／預聽及產品四案、physics lifecycle、storage → 互斥窗口的 600 秒性能 profile → 最新逐項驗收表、既有 Tasks、Wiki、英文 freshness、handoff 與本地 Git。

真 Meta 最小 Sound 切片沿用原始成功證據；本次 US$1 授權的三次請求已用完，不再呼叫。實際 billing／餘額未知。人工耳機／裝置聽測、本人資格／條款／根 LICENSE 及發布仍各有外部門檻；不能由 Mock、PCM 或本文解除。
