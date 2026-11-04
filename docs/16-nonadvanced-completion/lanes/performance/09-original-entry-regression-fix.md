# 原完整性能回歸恢復：V2 preimage 與 probe-on 測試環境

Root在整合入口實跑826項，824PASS／2FAIL。這兩個失敗保留於original-entry-regression-red-r1.tap，沒有修改原reference的固定SHA或行為斷言取得PASS。

我先前將attribution metric衍生行為放入必須保持immutable的原V2來源，是本批實作錯誤。現以git show e25f9f4:tests/browser/performance-profile.mjs取得明確preimage bytes，寫回前後都驗SHA為df86db94c6654399851ec1e3a4a240bc5821aee8dfa0745180d404c8cdf23c9c，不用reset或clean。新metric搬至performance-attribution-metrics-v1.mjs，僅新attribution測試改import；原V2及原數值／reference core保持精確原bytes。

另一個失敗是原exact-wrapper測試host未提供新probesEnabled外部環境。只在env加probesEnabled:true及destructure，執行真probe-on分支，原callback bits／handle／cancel／invoke-once／restoration所有斷言原樣保留。

單工重驗原integration入口加七個新spec，共826/826PASS、0skip，raw為original-entry-plus-seven-green-r1.tap。scope格式／lint亦通過。精確preimage、before/after SHA及原失敗收據見original-v2-preimage-restoration-receipt.json。

Semantic V2的27個frozen source pins逐檔仍相同，本修正不改它們；舊bd64及attempt01 raw／拒收結果不回寫。PCM source-v1 receipt內的舊源SHA是歷史截點，已由本修正supersede其metric所在檔；真PCM、fresh semantic、20秒wiring及正式600秒仍NOT RUN。
