# 第一版實作進度與驗收邊界

此為2026-10-27進行中的checkpoint，**不是第一版完成報告**。目標仍是[完整51項驗收](ACCEPTANCE.md)，Codex主導且沒有Muse Code模型呼叫；原61份保護驗收不放寬。

正式`src/`／`server/`已包含Scene交易、真Rapier固定步／FPS／Grab／Build、Sound Behavior、有限一階聲學Worker、Web Audio、Inspector、IndexedDB資產、錄放／v2來源相位與安全Meta工具。原research／spike／Optional Harness證據保留為歷史，不冒充產品。

## 已有直接證據

- [M0](M0_IMPLEMENTATION.md)：原純domain40及當時作者20測試；後續作者擴充另有31回歸，不改舊證據。
- [音訊](../../tests/audio-runtime/README.md)：99 Node／25真Native OfflineAudioContext檢查；不是人工聽測或裝置latency證據。
- [聲學傳輸](ACOUSTIC_DELIVERY.md)：46 Node／4正式bundle Chrome；p95往返8.1ms、worker3.9ms、service handler0.8ms。先前dev／負載失敗及離群值保留；不等於整體consumer delivery或10分鐘profile。
- [獨立整合v4](../../artifacts/v1/integration-review-v4/verification.json)：35／35、TypeScript通過，146來源前後hash一致；含真Root命令、EditorMetadata、資產重新載入、renderer onended不改logical state、重播／游標與NoGravity持續音修復。
- UI固定feature bundle13／13 Chrome通過；文案修正版另1／1。原生200% zoom、完整跨browser與裝置仍另驗；原始結果與bundle manifests在`test-results/ui-final-handoff.json`，待整體結案時歸檔索引。
- [物理驗收](PHYSICS_ACCEPTANCE.md)：已有真WASM／browser分項與資源清理觀察；新KeyF／clearance／bootstrap改動的完整29案與最終browser複驗尚待執行，不拿舊版結果代替。
- [Meta Live](../../research/v1/meta-live-validation-20261027-r3-minimal/summary.json)及[獨立接收](../../research/v1/meta-live-validation-20261027-r3-minimal/independent-live-review.json)：真`muse-spark-1.3` RemoveBinding／AssignBinding→Host Apply→本機180ticks／181frames，兩次真碰撞pitch+2。只屬API／Host／logicalIntent來源；不是產品UI Live、Scene live、Meta規劃Run或PCM／聽測通過。

## 當前修復與未完成項目

錄製過載依原規格pause並保留固定步欠帳，讓使用者明確Resume或Stop封存；[RED](../../artifacts/v1/recording-overrun-red-20261027/verification.json)／[GREEN](../../artifacts/v1/recording-overrun-green-20261027/verification.json)驗證30tick完整無跳號。完整產品首個Chrome流程曾因冷啟動過載安全pause而未完成Grab；[失敗archive](../../artifacts/v1/product-e2e-chrome-20261027T021924Z)保留。下一次採可觀察的真graph預熱與有界、明確的使用者恢復；不改catch-up上限或隱藏失敗。

乾淨`npm ci`／完整`check`、最新全產品鏈三次啟動、native zoom與輸入、跨browser、10分鐘profile／實際consumer成本、人工聽測及外部權利門檻尚未全部完成。優先完成這些，不增加Graph／複雜合成等P2。

## 資源、秘密與來源

[資源狀態](../09-agents/RESOURCE_STATUS.json)區分開發Muse Code使用者回報US$150與產品Meta API。產品本次明確授權總額US$1；三次請求共預留US$0.75，成功usage估算US$0.0073235，前兩次400實際費用與餘額未知。已達三次驗證請求上限，不再呼叫模型；預設app付費gate仍0。

`uniqueItems`已確認是Meta provider不支援的wire keyword；只改provider adapter，原本地AJV／domain唯一性驗收保留。兩次400、重整ledger與精確payload保留；第一次400原始錯誤body及所有中間程式完整版本未保存，不能宣稱可還原它們。[操作說明](../../server/META_LIVE_VALIDATION.md)。

金鑰只由server從使用者指定的本機檔讀取，檔案已被Git忽略，HTTP一般／大小寫／`/@fs/`路徑均403。未將key、key hash或Authorization寫進Wiki／Git。Codex CLI新觀察為0.164.0；Muse版本probe被本機updater timestamp寫入權限阻擋，不誤判為quota耗盡。

Git基線仍為`2662bc8ee3976280c5c14f619ff798570f035f14`；V1修改尚未commit，完成適當gate與持久記憶後建立本地checkpoint。未push／部署／接受條款或決定根LICENSE。
