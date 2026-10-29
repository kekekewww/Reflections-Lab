# 錄製前處理的語義等價整理

本次只移除可從來源確認的重複工作，**沒有量測或宣稱產品效能提升**。固定60Hz、最大4步catch-up、錄製過載暫停、所有路徑／相位／容量驗證與凍結驗收均保留。此頁不代表完整產品E2E或效能通過。

`src/app/acoustic-input.ts`對已驗Scene建立object-ID Set，每次呼叫只排序一次物件；同一呼叫內，同一box快照只建立一次面幾何。第一個request取得新面資料，後續request取得其獨立clone。快取不跨tick／revision／函式呼叫；source owner仍先排除，不能因另一source或預先建構而錯誤要求其缺少的moving pose。每個request的geometry、materials、atmosphere與端點仍與其他request及caller隔離。原`createScene`、solver與identity／surface caps不省略。

`src/experiments/hash.ts`新增`immutableCloneWithByteLength`：同一個已驗canonical字串用於parse／deepfreeze及UTF-8 byte accounting；原`immutableClone`維持不做UTF-8編碼。`ExperimentRecorder.appendFrame`使用新helper，避免把同一個完整frame再canonical遍歷一次。domain validation、budget檢查、累計bytes、event去重與提交順序保留；不省略聲學或來源證據。

修改前的[hash來源](../../artifacts/v1/capture-cost-baseline-20261027/hash.ts)與[recorder來源](../../artifacts/v1/capture-cost-baseline-20261027/recorder.ts)保存原始bytes。獨立測試載入這些本機舊實作作為reference，沒有網路或模型呼叫，也沒有重寫舊source來假造baseline。

## 已執行驗證

- [53項回歸與靜態檢查](../../artifacts/v1/capture-cost-validation-20261027/verification.json)：hash clone／bytes、原錄製／RecordingHost／RecordingProcessor／ReplayAudio測試全部通過；global TypeScript、限定ESLint／Prettier通過。61個原保護檔hash未變，來源前後一致。
- [隔離review的12項測試](../../artifacts/v1/capture-cost-independent-20261027-r2/verification.json)全部通過：8項acoustic request資料所有權／動態pose／排序／owner排除／錯誤與容量案例，以及4項封存舊recorder的artifact／fingerprint／UTF-8 byte budget／不可變性／錯誤順序等價案例。完整artifact JSON、fingerprints、SHA及traceBytes與舊版相同；exact byte boundary與少一byte的拒絕／保留狀態亦相同。strict test types、ESLint及Prettier通過，來源前後hash一致。第一次測試12案已通過，但測試mutation的readonly casts未通過strict；原失敗保留，r2只修測試寫法，不改正式來源。

原本單一source不增加幾何clone；多source重用與native clone的實際成本仍需browser量測。這次沒有修改renderer設定、降低聲學頻率、跳過tick、刪除測試或提高預算。正式10分鐘profile、聽測與整體第一版完成仍由原驗收逐項判定。
