# Task0029：靜態區域作者設定與真固定步進出事件

日期：2026-11-02。分支：codex/pipeline-zones；實作起點：f6abb936a8c7c87ff8eb5e6587260b837e6b67ae。執行者：Codex capability_core，另有 zone_domain、zone_ui 實作與 bounce_review 只讀核查。

本階段完成區域核心串接與 Node／Rapier／worker 驗證。**production browser UI、實際監聽、WAV 匯出與整合後重驗交由 Root 在最新唯一 4173 bundle 上執行；此分支沒有啟動瀏覽器或宣稱該門檻通過。** 不代表整體第一版、效能、聽測或 Meta live 通過。

## 作者資料與命令

- SceneSpec 新增 optional zones，最多 16 個靜態 region。沒有 zones 的舊資料不注入空陣列，因此舊 canonical bytes／hash 保持；明示 zones:[] 仍保存，Undo 可回到原來缺省。
- SceneZone 共用 id、name、enabled、centerM、hysteresisM；shape=aabb 帶 halfExtentsM，shape=sphere 帶 radiusM。名稱 1–80 字；中心各軸 ±200 m；半尺寸／半徑 0.05–50 m；遲滯 0–0.25 m 且嚴格小於最小半尺寸／半徑。ID 與 Scene 其他 entity 跨類別唯一。
- SceneOperation 新增 AddZone、UpdateZone、RemoveZone、SetZones。沿用 expected revision、隔離副本、驗證後原子提交；SetZones 的 null 表示缺省、陣列表示明示資料，inverse 保持完整作者順序／值。
- 閉合 JSON/schema 拒絕未知欄位、錯 shape 參數、NaN／Infinity、稀疏陣列、無效尺寸／遲滯、跨類別重複 ID 與第 17 個 region。
- 不創建 phantom object、Rapier sensor body 或 acoustic surface，不改物件的物理／聲學角色。

## 真 producer 與明示語意

PhysicsWorld 在 Rapier 完成固定步後，依真 BodyPose 執行 PhysicsZoneProducer；zone events 排在既有事件與 bounce 後，fixedStep afterStep observers 之前。因此錄製、behavior bridge 與觀察者看到同一批 raw events。

- DerivedFixedStepBodyCenterWithHysteresis：只分類物件中心，不是整個 collider overlap，也不是 continuous swept crossing／CCD。單一步內快速 outside→outside 穿越可無事件。
- 名義體積 signed boundary：sphere 使用歐氏距離減半徑；AABB 使用最大軸距減半尺寸。原本在外時 distance <= -h 進入；原本在內時 distance > +h 離開。
- 開始／reset 的第一個穩定完成步、generation 改變、teleport discontinuity、停用後恢復、區域幾何／enabled／hysteresis 改動、epoch 或時間不連續，只建立 occupancy baseline，不假造 enter／exit。
- held 與 kinematic 的正常固定步移動仍會產生跨界；普通 dynamic motion、grab／release 或 trajectory 沒有 blanket suppression。停用／刪除／inactive 不發 fabricated exit。
- enabled 只控制 occupancy。disabled region 保留 ID／中心與規則引用；明示 zone emitter 仍可使用該中心，Live 與 StaticPreview 一致。區域 trigger 的預設 emitter 仍是物件實際中心，沒有把物件聲源默默移到區域中心。
- 每步上限 16 regions、256 poses、2048 既有＋新事件；排序以 stable zone／object ID 決定，event ID 含 epoch／tick／zone／object／generation／edge。超出預算明確拒絕。

## 共用規則、UI、AI 與信任入口

- Discrete trigger optional zoneId 向後相容；產品 OnEnterZone／OnExitZone 必須明示現有 region ID。raw PhysicsEvent 與 normalized input 都保存 source=zone、zoneId 與真物件中心。
- 單一 getSoundBehaviorCapabilities 投影現在 zoneProducer=true，但 registry 空時仍回 ZONE_REGISTRY_EMPTY，Host 沒有 producer 時仍回 ZONE_PRODUCER_UNAVAILABLE。限制包含 Derived／sampled／baseline／停用語意。
- ProfileRegistry／Sound Host／BehaviorEditor／Offline planner 使用同一可信 context。未知 ID、非 zone trigger 夾帶 zoneId、產品 zone trigger 缺 ID、偽造 source／normalized metadata 都被拒絕；Offline planner 需要 prompt 明確包含恰好一個已知 zone ID，不猜測區域。
- Meta strict wire 會將新 optional zoneId 宣告為 required nullable；decoder 只為舊 discrete wire 的缺省 zoneId 補 null，再經 strict schema 與還原後的原始 schema 驗證，沒有放寬未知欄位或 operation。
- AnalysisDock 新增「區域／Zones」tab，沿用既有元件、HelpTip、字型與 tokens。可新增、修改 AABB／sphere、啟用／停用、刪除；數字使用 raw draft、有限值／範圍驗證與 step=any，錯誤不退回舊數值。
- RuleCard／Inspector 新增明示事件區域 selector；新規則只能選 enabled regions，既有 disabled region 顯示停用狀態並保留引用。切換非 zone trigger 清除 zoneId，dirty／ack 比較包含 zone ID。
- saveZone／removeZone LabAction 帶 expectedSceneRevision；必須暫停、結束 recording／replay 並回 Editor。非同步 commit 前重驗 revision／模式。刪除被 trigger 或 zone emitter 引用的 region 原子拒絕 ZONE_IN_USE，列出 profileId/ruleId，不靜默修改規則。
- project save/load、JSON export/import、Undo/Redo 沿用同一 Scene 來源；replay view 的 zones 取 displayScene，事件詳細資訊帶 Zone ID。

## 錄製與 A/B

- raw／normalized coreEvent 比對條件式帶 zoneId；source phase 從記錄的 sceneSnapshot 重建 zoneIds／zonePositions。含 region 時同時使用產品 producer capability，raw 與 normalized 同時移除 ID 仍會被拒絕。
- 非空 registry 與 Derived producer policy 納 physicsConfig fingerprint；zones 不納 acoustic geometryHash。缺省與空 registry 不污染 legacy physics fingerprint。
- 更動 geometry、enabled 或 hysteresis 的 A/B 重評回 ZONE_REGISTRY_CHANGED，必須重新物理錄製。未更動 region 的同 motion behavior B 可在 yielding client 與真正 Node worker 重評並保留 raw trace。缺 baseline 的 zone input 回 ZONE_BASELINE_REQUIRED。
- 真 Rapier trace 已穿過 AABB，錄得 OnEnterZone／OnExitZone，與 normalized metadata 相同；序列化、verify、MotionReplay 保持 raw trace，沒有重算 producer 造新事件。

## 驗證與保留失敗

最終較廣 regression-final.txt：**501/501 PASS，0 skipped，exit 0**；build-final.txt：TypeScript＋Vite 正式 production build exit 0。工具鏈為 Node 22.17.0／npm 11.4.2。逐檔來源與收據 SHA-256 見 evidence.json。已完成的分項收據：

- domain-tests.txt：Scene 32/32（新 14）；domain-checks.json 是 domain 子代理當時的 checkpoint，schema 格式後改動可使其早期 hash 成為歷史值，最終 source hash 看 evidence.json。
- focused-final.txt：44/44，包含真 Rapier、source-phase、實際 worker reprocess、AI wire 與 capability 負例。
- anchor-consistency-final.txt：10/10，包含原 StaticPreview 負例與 disabled anchor 的真 BehaviorRuntime 一致性。
- rapier-lifecycle.txt：11/11；rapier-lifecycle-and-budget.txt：12/12。包含真 Rapier authoring teleport、registry 改動、disable/re-enable、刪除重建、reset 無假事件，以及 2048 精確容量與超額拒絕。
- typecheck-final.txt、lint.txt、format.txt：型別、scoped ESLint、所有變更程式／schema 的 Prettier check 完成。
- schemas.txt：既有 schema validation 19 schemas／3 examples PASS。

保留 tests-initial-fail.txt（新錄製 fixture 的 reflectionOrder=0 不符既有 processor 範圍）、regression-first.txt（473/482）、fixture-contract-recheck.txt、review-gaps-regression.txt、anchor-consistency.txt、lint-initial-fail.txt 與 format-initial-fail.txt，沒有刪除失敗或改寬 assertion／tolerance。

較廣首回 9 FAIL 中：strict wire 的 discrete trigger 正例需明示新 nullable zoneId（兩個 literal，影響三個案例）；原「缺 producer」負例現在明示 zoneProducer=false；5 個 capture baseline ENOENT 是 sparse checkout 沒有 materialize，從起點固定 Git blob 還原同 hash，未修改 reference。StaticPreview 原缺 zone 負例保留，只將新能力下精確拒絕原因改為 ZONE_REFERENCE_UNAVAILABLE。舊測試 preimages 留在 preimages/。

## 整合操作交接

- 開「區域」tab →「新增區域」→ ID／名稱／形狀／中心／尺寸／遲滯 →「儲存區域」。例：zone.browser，AABB center=(-0.8,1,0)，halfExtents=(0.5,0.4,0.5)，h=0.02；預設 ball 從 y=2 下落會在穩定步後穿越，無須編造事件。
- 選 ball →新增 OnEnterZone 及 OnExitZone →事件區域選 zone.browser。規則預設 oscillator 與物件 emitter；需要 recording／replay／raw metadata／聲音證據時，在最新 production bundle 操作並保存收據。
- 可用 selectors：getByRole('tab',{name:'區域',exact:true})；region(name:'區域')；button(name:'新增區域')；form(name:/編輯 zone\./)；textbox(name:'區域 ID'/'名稱')；combobox(name:'形狀')；spinbutton prefix「中心位置 X/Y/Z m」「半尺寸 X/Y/Z m」「半徑 m」「邊界遲滯 m」；button(name:'儲存區域'/'取消草稿')；Esc 放棄草稿。
- Root 擁有最終 browser lease、integration merge、Wiki/task/sources 與英文文件。此階段未 push、未加依賴、未呼叫付費或外部 API。

## 後續跨模組修補

整合審查確認舊 AcousticSourceInput.objectId 同時用於 voice owner 與 geometry self-exclusion；明示 zone／fixed anchor 遠離 owner 時，該 owner 不應被自動排除。已與 acoustic_geometry_core 協調新增 optional emitterObjectId 三態（undefined 舊 owner fallback、null detached 不排除、string 明示實體）。本次 501 PASS／build 的固定截點尚未含該補丁；下一個限定補丁會維持 ownership／stem／budget ID，另作真 solver 遮擋對照。此已知跨模組項目不冒稱關閉。
