# 第一版與雙語整合 checkpoint r2

本頁是進行中的直接證據索引，**不是整體第一版完成報告**；原[51項驗收](ACCEPTANCE.md)與[英文補充驗收](ENGLISH_ACCEPTANCE.md)都須持續核對。前一版[checkpoint](SESSION_PROGRESS_20261027.md)保持原文及歷史scope。

## 已完成的可追溯工作

- 核心程式與既有證據已存本地Git `e6b898c30193e8cd9e5ef9ddc2f1e6bcb8aee313`：888檔、216,207,895 bytes；未push／部署。後續雙語UI、文件與新增驗證仍有未提交變更。
- [獨立Root整合v7](../../artifacts/v1/integration-review-v7/verification.json)：38項整合＋8項metric cases、tsc／lint／format通過，149個來源前後hash相同。舊v6因最後band-key guard造成的source drift保留，不冒充同版本通過。
- [錄製輸入優化](CAPTURE_INPUT_OPTIMIZATION.md)：53項回歸＋12項獨立等價檢查；單次canonical serialization與同快照面幾何重用不改raw artifact／fingerprints／UTF8 bytes／budget界線。沒有以此宣稱效能達標。
- [A/B母體修復](AB_METRIC_POPULATION_AUDIT.md)：保留原停止聲源的診斷路徑，physical aggregate只取相同eligible來源／方法／band條件。真Root同材質B的delay／energy差為0；只改材質時delay差為0，energy改變。缺相同support的metric回null／reason，不把差異誤稱材質效果；原fixture／tolerance未放寬。
- 固定`22ca0c47…`中文產品bundle的[完整4案](../../artifacts/v1/product-e2e-chrome-20261027T033616Z/verification.json)通過：3次乾淨context的scene→throw→impact→sound→capture→A/B／reload，加獨立儲存區missing／wrong／right WAV relink。實際GPU為RTX4070 D3D11；3個主流程明確恢復次數0／2／7，均在8次上限內且所有tick／epoch／hash保留。這是功能通過，**不是流暢度／長時間性能通過**。
- 雙語UI已落地：繁中預設、English選擇／本機偏好／document.lang、902個顯式翻譯鍵；已知錯誤翻譯，未知原始backend細節明示保留，使用者名稱不變。固定`9ae2ca2e…`雙語bundle的[英文8案＋原繁中13案](../../artifacts/v1/ui-localization-20261027/README.md)通過，獨立封存稽核確認source／bundle／report／附件hash。真continuous native source、AudioContext／world／canvas／run／文件identity不變，tick及audio time自然前進、語言操作dispatch為空。62項Node結果為已觀測摘要，未另存原stdout；最終完整gate會另補直接紀錄。
- 既有[音訊99 Node／25 Chromium native](../../tests/audio-runtime/README.md)、[Worker46 Node／4正式bundle](ACOUSTIC_DELIVERY.md)、[遲滯67＋隔離29項](MOTION_HYSTERESIS.md)等scope保留，不用它們代替整體產品／聽測。

## 跨引擎與原生輸入的真實邊界

[跨音訊引擎](../../tests/audio-runtime/CROSS_ENGINE.md)實際執行：Firefox157有8 PASS／1 FAIL／9 blocked capability／7未跑aggregate dependency；此Windows WebKit27.2 build的25項均blocked capability，不能推論全部Safari。缺OfflineAudioContext.suspend阻擋的是該離線oracle，不等於產品live pause不支援。

Firefox原energy FAIL保留原`<1e-5`門檻。另建的[9圖Float32 Delay參考](../../artifacts/v1/audio-delay-reference-v1-run-20261027054851146/compatibility-summary.md)取得完整PCM並獨立逐sample核對：`.075s`的原生有效值造成分數取樣線性插值；零Convolver組符合獨立模型，雙路圖精確重現原energy。這解釋原oracle的整數delay假設，不改原FAIL／產品code／tolerance，也不是裝置或聽感通過。

原生200% zoom、真visibility／focus／Pointer Lock／composition測試仍在收斂。已保留實際失敗與工具邊界：同window的tab仍因Playwright預設focus emulation顯示visible，不能用synthetic hidden替代。最新物理matrix／slope／doorway／CCD／contact邊界與最終browser lifecycle仍待完成。

## Meta、開發資源與來源

真Meta Sound最小切片已獨立通過：`muse-spark-1.3` RemoveBinding／AssignBinding→Host Apply→本機180ticks／181frames、兩次pitch+2碰撞；[結果](../../research/v1/meta-live-validation-20261027-r3-minimal/summary.json)。Scene Live／Meta規劃Run／產品UI Live及PCM聽測未通過。US$1授權內3個請求已用完、共預留US$0.75；成功usage估價US$0.0073235，實際帳單／前兩次400費用／餘額未知，不再呼叫；app預設gate0。

Codex主導，沒有Muse Code模型呼叫。Muse US$150是使用者回報，不冒充billing；[資源狀態](../09-agents/RESOURCE_STATUS.json)另保留Codex app官方唯讀時間點quota觀察，不換算credit為USD、不reset／提額／切帳號。金鑰仍server-only、Git忽略、HTTP403；未將key或key hash入庫。

使用者已明確要求英文介面與**所有專案文件**。Markdown全套英文正文、來源／翻譯hash／code-fence／technical ID與語義審查正在完成，中文canonical與machine data／task／schema共用；完整current/stale與link驗證仍須finalize，不以字典或索引宣告全套完成。

## 下一個可執行工作

先完成原生輸入／zoom及物理邊界，驗證新雙語版本的整體產品鏈；停止全部owned server後乾淨`npm ci`、完整runtime／legacy reprocess／UI單元／check／build／license gate。收斂英文current來源與links，再在quiet window執行10分鐘UI／physics／worker／consumer profile。最後同步逐項矩陣、Task／Wiki、最新handoff與Git；人工耳機聽測、本人資格／條款／根LICENSE保留外部門檻，不代為確認。
