# 最終模型 metadata／Worker／重播相容性獨立審查

日期：2026-11-02。方法：唯讀碼審、受控 Worker 回覆故障注入、兩個新 helper／測試檔及其小型純方塊參考。沒有 Chrome、沒有全 runtime／效能或裝置／聽感測試。工作樹基底 HEAD 為 f6abb936a8c7c87ff8eb5e6587260b837e6b67ae；新實作在當時未提交，來源以同目錄 metadata-review-pins.json 的實際檔案雜湊為準，不能將基底 HEAD 冒充新實作提交。

## 一項已確認且已修正的問題

AcousticService 原本只 pin request/source/listener/revision/tick，backendVersion 只被當成長度有界字串。獨立故障注入對明確要求 web-geometric-primitives-1.0.0 的請求，將真正 solver 結果的 frame.backendVersion 單獨改成舊版 web-geometric-1.0.0，舊 Service 仍 completedBatches=1。

- 原始證據：[model-version-fault-probe-original.txt](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/67629c40ad7efb855991f297d8d5e0d86fbe105f)。
- 修正：solver／service 共用 acousticRequestSolverVersion；pending pin expected backendVersion，回覆核對 backendId、版本及 path ID 的版本前綴。
- 相同故障重測：[model-version-fault-probe-final.txt](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/46593d7e2766352ac293f65f7caa120d6b416c78)，**ACOUSTIC_REPLY_IDENTITY 拒絕、completedBatches=0、failedBatches=1、Worker terminated=true**。
- 本審查沒有修改 Service；修正由 lead 實作。受控 protocol fault injection 不是實際瀏覽器或網路完整性測量。

## 本次查核結論

1. **場景模型識別**：acousticSceneSolverVersion 根據完整作者場景，不只根據單一已排除 emitter 的 request。新場景透過 modelVersion pin，即使某個 source 排除後只剩平面，也不會讓同錄製的 frame 混用 backendVersion。只有 legacy planar-only 且無新能力的 request 保留舊序列化欄位／版本。
2. **固定容量**：Service 在 Worker dispatch 前合計 surfaces、primitives、boxOccluders，產品上限仍為 256；solver 再執行自己的共同幾何／segment／path／時間預算。解析 box compaction 只轉換本來不產生反射的遮蔽體，不丟物件、不把它們偷偷升成反射器，也不替舊平面-only 場景解除舊預算。
3. **重播與重評分開**：ReplayAudioHost 使用封存 frame，不重新求解，也不把新 policy／預設欄位塞進原 artifact。RecordingProcessor 和實驗 Host 的重評則檢查模型／發聲幾何政策，受影響的舊 fixed／zone 基準必須先 fresh capture，不能因 geometry 全是 box 就漏掉語義變更。
4. **新錄製政策**：所有新 capture 都由 emitterGeometryPolicyPin() pin explicit-emitter-body-v1，包含 object-only A，因此 A→fixed／zone B 不會只因條件式欄位有無而誤變 solver hash。hasCurrentEmitterGeometryPolicy 是相容性檢查，並不取代正式 document/config validator；未知 present policy（包括明示 undefined）拒絕，舊 object/contact 可省略且原始資料不變。
5. **三態 emitter API**：undefined 保留 legacy owner 排除；null 表示 detached 位置，保留 binding-owner 的遮蔽幾何；明示 object ID 只排除實際 emitter body；未知 owner/emitter ID 拒絕。這個 builder API 已有直接測試。

目前沒有發現另一項可在本分支內確認、尚未處理的 metadata 阻斷；下節跨分支接線仍是 Root 合併驗證責任。

## 跨分支接線界線

此聲學分支當時的 runtime.requests／ExperimentToolHost／RecordingProcessor source map 尚未依 rule emitter 寫入三態 emitterObjectId；不能因加上 policy pin 就宣稱這些 caller 已真的保留遠處 owner 遮蔽物。Zone 分支另有 trusted behavior-acoustic-source helper：fixed／zone 應傳 null；object／contact 沿既有物件附著政策。Lead 已確認由 Root 先合 Zone，再合本分支並跑該分支五項 caller proof。**本審查不將未合併程式或未執行的 combined browser 閉環標成 PASS。**

## 新政策的獨立小測

新檔 tests/app/emitter-geometry-policy.test.ts：

- **10/10 PASS、0 skip、exit 0**：[emitter-geometry-policy-final.txt](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/45c7d5c1cc335ab741fafeb04be5e36670974bb3)。
- 前六案核對 unconditional new pin、舊 object/contact omission 不插資料、fixed/zone 要求 current pin、unknown/undefined present 拒絕、invalid shape 與 accessor 不執行。
- 後四案使用原創純方塊場景、真 Rapier 固定步／Behavior／solver／ExperimentRecorder 封存，不手改 artifact hash。fixed fixture 透過公開 builder 實際使用 emitterObjectId:null；owner 設 acousticRole:none，故該對照**不證明 runtime caller 的遠端 owner 遮蔽接線**。
- 純 box／舊版 backend 的 fixed missing-policy baseline 重評拒絕；原樣 ReplayAudioHost＋FakeAudioEngine 可播放／stop，artifact bytes 不變。
- 同 current policy 的 object A→fixed B 可作 matched behavior comparison；missing/current policy 的真正 solverConfigHash 不同且 comparison unmatched。
- 首輪 9/10 中，新 fixture 從 tick0 捕捉導致 pre-step tick0 不符合既有 audio replay 前一步契約；[原始輸出](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/fd5d39479960cbe74cf1a2e768f185005ddf76f3)保留。修 fixture 為真正 world.step() 後從 tick1 捕捉，沒有修改或放寬產品時鐘驗證。
- 兩檔 ESLint、Prettier 及全工作樹 tsc --noEmit 均已執行、exit 0；未重跑全 check／全 runtime。

FakeAudioEngine 的作用是 metadata／錄製相容與 graph 控制驗證，不是 native PCM、硬體聲音或真人聽感。幾何數學與來源仍看 reference/ 的獨立九組及 V0–V5 限制。
