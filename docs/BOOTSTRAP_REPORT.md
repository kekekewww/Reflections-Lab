# Reflection Lab Bootstrap Report

完成查核日：2026-10-26（Asia/Taipei）。階段：Research / Preproduction / Engineering Preparation。**研究交接與隔離驗證已建立；正式產品功能尚未開發。**完整需求見 docs/00-project/MASTER_REQUEST.md；所有新增／修改檔案見 [FILE_MANIFEST](00-project/FILE_MANIFEST.md)。

## 1. 執行結論

以可由評審開啟的 Web Demo、第一人稱物理互動、可檢視反射路徑為主要需求，採 TypeScript＋Three.js＋Rapier WASM＋Web Audio 作十日主線，React 僅面板候選；Steam Audio 4.8.1 原生後端已完成 Windows x64 可行性驗證，保留 capability-aware adapter。沒有同時開始 Unity、Tauri、WASM Steam 三條產品線。

最重要的模型限制：幾何聲學不是完整低頻波動；合成材質不是量測資料；SDK 有反射不等於提供個別路徑；計算 IR 不等於實際房間量測；不具校準的 dBFS 不能當 dB SPL；AI 只能引用求解與實驗 artifact，不產生聲學真值。

官方資料列作品提交為 2026-11-04 21:00 ET＝**11/05 10:00 台北**；申請期限與資格是另一件事。CV waiver 已有自稱 Official Rules 的條文，不能說完全無正式規則；但賽前程式、Codex、商業 SDK 與完整提交欄位尚未取得明確答案。依使用者要求，本次停在研究、環境、資料契約與隔離 spike。詳 [規則與權利](01-compliance/HACKATHON_RULES.md)，未代行接受／申請／提交。

## 2. 起始盤點

工作目錄 `D:\Developing\Meta Hack` 起始完全為空，沒有 Git、舊原型、研究資料、lockfile 或可恢復的未提交內容。不能推論使用者其他位置沒有 Reflections／Echo Canvas，也未擴大搜尋私人目錄。現已初始化本地 `main`，沒有 commit／remote／push；所有本次成果均為新建。

- [PROJECT_BASELINE](00-project/PROJECT_BASELINE.md)：環境、檔案／Git 起始觀察。
- [EXISTING_ASSETS_AUDIT](00-project/EXISTING_ASSETS_AUDIT.md)：需求逐項 PLANNED/UNVERIFIED，沒有捏造既有功能。
- [PROJECT_PROVENANCE](00-project/PROJECT_PROVENANCE.md)：需求、AI協助、上游SDK／依賴與本次時點。

環境已實際檢查 Windows x64、Node22.17.0、npm11.4.2、Python3.12.11、CMake4.3.1、Git2.49.0；CPU由Node `os`取得 i9-13980HX／32 logical CPUs，CIM受限。SDK使用既有MSYS2 GCC15.2.0。Rust／Cargo不在PATH；Emscripten未找到，未安裝大型原生工具鏈。

## 3. 科學研究與證據

[PAPER_INDEX](../research/papers/PAPER_INDEX.md) 收錄 **27項核心論文／標準／正式技術來源**，包括11篇主要幾何/DSP、7篇碰撞／wave、5項ISO及4份官方理論／參考實作。每筆可讀程度明示 FULL_TEXT_REVIEWED、PARTIAL_TEXT、ABSTRACT_ONLY、METADATA_ONLY 或 OFFICIAL_DOCUMENTATION。沒有繞過paywall或重散布全文；原實驗皆未宣稱已重現。

主要可採用結論：

- Allen/Berkley與有限多邊形ISM研究支援specular path；本庫以獨立幾何fixture檢查有限表面／遮蔽，不用無限鏡面假裝可見。
- A/R/T能量與反射pressure magnitude分開；scattering是反射能量內分配，不額外消失；measurement方法／角度／厚度／頻帶不可跨engine等同。
- NASA／OpenStax提供聲速與Doppler條件；retarded-time精確模型與逐更新quasi-static近似分開。
- Schroeder EDC／FDN／fractional-delay來源支援DSP設計；RT regression需足夠decay，不能從短RIR虛構RT60。
- FoleyAutomatic／FEM／modal contact研究區分excitation、resonance、radiation、sample-based playback；接觸impulse不是完整音色模型。
- FDTD/FEM/BEM與room modes用於低頻／離線／hybrid評估；本次沒有實作wave solver。

逐篇貢獻、模型、資料、假設、誤差、工程用途與可重現性見 [LITERATURE_REVIEW](../research/papers/LITERATURE_REVIEW.md)、[COLLISION_WAVE_NOTES](../research/papers/COLLISION_WAVE_NOTES.md)；三份theory集中公式。中央 [Evidence Ledger](../research/EVIDENCE_LEDGER.json) 包含 Claim ID、source/access/locator、證據型態、條件、狀態與相關實作；本地一致性驗證不等於科學內容自動正確。

## 4. 資料集

[DATASET_CATALOG](../research/datasets/DATASET_CATALOG.md) 評估9項RIR、HRTF、碰撞／參考資料。每筆記原始來源、用途、授權與大小／版本可知程度。尚未下載真實資料集／音效，部分license與外部素材權利UNKNOWN；不將repository code license套到音訊檔案。取得工具預設dry-run、檢查授權狀態、來源host、size與hash；真實下載需完整manifest，不能填假的archive hash。

實際工具在 [datasets.mjs](../scripts/setup/datasets.mjs)，範例manifest刻意保留UNKNOWN/null並回BLOCKED／exit2；[離線驗證](../experiments/dataset-fetch-spike/README.md) 使用本地mock，不取得第三方內容。固定host allowlist不包含所有GitHub release CDN／signed URL，遇到時拒絕；這不是通用任意網址下載器。

## 5. Steam Audio

官方最新穩定C API **4.8.1** ZIP 已取得並校驗：

`4a0aa5ec1176f38f0b0993a37c2259d9e86f27e22d5e24f83ec4c3cb9a1d5449`

另校驗header、DLL、WASM archive、THIRDPARTY四項。SDK/build只在忽略cache，不入Git。主程式碼Apache-2.0與IPP／CIPIC等第三方條款分開盤點，不能把整套binary稱Apache-only。詳 [SDK_LICENSE](03-sdk/SDK_LICENSE.md)。

**已執行原生C API三個cycle並通過**：context／scene／14-triangle mesh／synthetic material／simulator／source，2m距離attenuation=.5，clear/blocked occlusion=1/0，穿透三band符合輸入，parametric reflections為有限正值，convolution四channel有限且非零，完整release後重新初始化。反射運算約5.27–5.81ms只是小型smoke觀察，不能推成產品P95／總音訊延遲。null handles不證明零memory leak。

重要發現：4.8.1含`lib/wasm/libphonon.a`，但沒有執行Emscripten連結／browser／worklet。公開simulator沒有個別鏡面reflection point/path ID清單；pathing callback是probe連結資料。capability分開，UI不能自造路徑。官方band centers為400/2500/15000Hz，與canonical octave資料不可直接視為等價。

結果、完整設定、hash與命令見 [SDK_VALIDATION](03-sdk/SDK_VALIDATION.md)；五種架構逐面向比較見 [INTEGRATION_COMPARISON](03-sdk/INTEGRATION_COMPARISON.md)。

主代理另執行一次最終確認，三cycle仍PASS，反射觀察5.135–6.018ms、convolution energy `0.071112539573`；[確認結果](../experiments/sdk-smoke-tests/results/native-win64-confirmation-2026-10-26.json) 與同名JSONL獨立保存，不覆寫首次證據。兩次隨機反射結果不同符合本次不宣稱bit-exact的限制。

## 6. 物理互動與UX

[docs/04-physics](04-physics/PHYSICS_ARCHITECTURE.md) 五份規格定義capsule FPS、collision-safe target、bounded impulse/torque grab、throw/drop、gravity0/fixed/kinematic轉換、staged placement及physics→audio事件。實測Rapier顯示靜置支撐仍有約9.81N／每步impulse，不能以「有力」觸發impact；handle是opaque，持久資料只存domain IDs。

[docs/05-ux](05-ux/COMPETITIVE_UX_RESEARCH.md) 六份規格比較Unity、Blender、Sound Particles、Treble、Wwise、FMOD、ODEON、Garry’s Mod及Emil技能授權。部分正文受限／舊版有明示；沒有實機UX測試。三Workspace與Ready/Running/Paused分離；Tab保留focus、B Build、gesture進lock不兼投擲，Esc/blur凍結並保留interaction快照，Resume重驗。Raw是dry-centered同一刺激，Simulated才套傳播與HRTF。Pause採明示Freeze-and-fade，20ms為待驗設計值，截尾記marker，未到達arrival只重排一次。

## 7. AI、實驗與架構決策

Meta官方模型、tool calling、structured output、pricing/privacy均查閱；Spark/Wonder的官方能力與帳號實際可用性分開。**未使用憑證、未呼叫推論API、未產生費用，沒有live Meta整合。**12個工具契約為原文11項＋安全PreviewSceneChanges；host驗證registry、domain、revision、budget後stage/preview/undo。provider strict schema子集合與本地JSON Schema分開，不能直接傳union給provider。

實驗以scene/snapshot＋motion/contacts/source trace＋版本／hash作A/B；物理材質改變要新run，不能沿用舊contact trace宣稱單一聲學因素。錄製過載pause不丟tick；互動非錄製模式才允許顯示telemetry後丟wall-time。完整錄放與AI executor均未實作。

詳 [10 ADR](02-architecture/ADR_INDEX.md)、[contracts](02-architecture/DATA_CONTRACTS.md)、[AI研究](08-ai/META_MODEL_RESEARCH.md)、[錄放](07-experiments/RECORD_REPLAY.md)。獨立審閱已修正多聲源frame延遲歧義：每份AcousticFrame只對一組source/listener，附頻帶中心／pressure gain，並驗證path一致。

## 8. Agent Harness 與環境

- 精簡 [AGENTS.md](../AGENTS.md) 指向研究／決策／狀態，不塞全文。
- `.agents/skills/` 建立8個具frontmatter／trigger／inputs／workflow／references／outputs／validation／failure handling的Skills；官方quick_validate **8/8通過**。系統Python缺yaml，已在忽略cache隔離安裝PyYAML6.0.3，無全域修改。
- npm **8個直接依賴／88個安裝套件**版本與integrity鎖定；license metadata及本地檔案hash登錄。metadata不是全面發行授權審核。
- 建立環境檢查、linter、formatter、typecheck、Node test runner、schema／research-index validator、benchmark runner、CI範本、SDKdownload/hash腳本。遠端CI未觸發。
- 本地Git main初始化；沒有commit、remote、推送或刪除既有資產。根LICENSE留使用者決定，未擅自選開源授權。

## 9. 實測與品質Gate

機讀結果：[validation-local.json](../benchmarks/results/validation-local.json)、[analytic-local.json](../benchmarks/results/analytic-local.json)、[SDK原生結果](../experiments/sdk-smoke-tests/results/native-win64-2026-10-26.json)。檔案各附版本／時間／設定／雜湊；latest與不可變historical證據分開。

| 驗證 | 實際結果／邊界 |
| --- | --- |
| npm ci | 固定鎖檔重新安裝通過 |
| npm run validate:all | 最後整合後 **11/11命令通過**，包含datasets／文件連結；完整stdout、exit與hash已保存 |
| npm test | **30/30通過**：17解析／13資料與研究契約組；13個declared fixtures |
| JSON Schema | 8份strict Draft2020-12編譯通過；12 AI工具正例與有意錯誤輸入拒絕 |
| Rapier smoke | **6/6通過**；不是完整Grab／CCD／FPS實測 |
| dataset acquisition | **17通過／1略過／0失敗**（18案例）；junction fixture被本機EPERM拒絕故NOT RUN，無真實下載 |
| dependency smoke | Three數學ray／Rapier WASM initialize/free通過；不是WebGL／audio |
| typecheck／lint／format | 本地命令通過；typecheck範圍見BENCHMARK_PLAN，不宣稱整庫TS型別覆蓋 |
| research index | source／claim／fixture reference一致性通過；不是內容真實性或授權自動認證 |
| Skills | 官方結構8/8＋獨立靜態情境審閱通過；非所有任務行為實測 |
| native SDK | 三cycle通過；無裝置播放／memory sanitizer／大場景P95 |
| analytical benchmark | 20 batches，Node數學kernel實測；P95是batch平均分位，非audio/frame尾延遲 |
| V2/V3/V5 | DSP合成處理僅PARTIAL；實際audio graph／獨立solver／真實量測與聽測NOT RUN |

| Gate | 狀態 | 判定 |
| --- | --- | --- |
| 1 Research | PARTIAL | 27核心來源與明確模型；部分全文／標準未取得，未重現原研究 |
| 2 Licensing | PARTIAL | 已登錄SDK/依賴；dataset未知、發行組合與競賽細則待核 |
| 3 SDK | PASS | 限目前Windows x64固定版本的最小初始化／場景／求解／釋放 |
| 4 Physics Feasibility | PARTIAL | 官方API＋基本WASM已驗，完整抓取／放置穩定性未跑 |
| 5 Acoustic Feasibility | PARTIAL | 契約／解析／native spike已驗，正式動態audio graph未做 |
| 6 UX | PASS | 指定研究矩陣／流程／元件規格完成；不代表實機可用性通過 |
| 7 Agent Harness | PASS | AGENTS／8Skills／鎖檔／工具實際建立與本地驗證 |
| 8 Reproducibility | PARTIAL | 本地命令／hash可重現；真實datasets／跨平台／browser仍未驗 |

沒有把NOT RUN寫成PASS。這是可開始下一正式階段的研究交接，並非所有產品驗收關卡均已完成。

## 10. 路線與下一個任務

[ROADMAP](ROADMAP.md) 依官方deadline規劃10/26–11/4十日，11/4 18:00台北內部凍結，保留16h到公開截止；P0互動優先，P1聲學/AI後接，P2二階／動態反射／完整replay／WASM後移。

下一任務是 [P0-01最小SceneSpec＋Three room＋Rapier fixed-step](NEXT_ENGINEERING_TASK.md)：一個房間／一顆sphere、四body modes、transaction/domain validation與import/export，6–8h，明確不擴至FPS／AI／audio。此任務已具檔案責任、正負驗收、tests、風險與fallback；本次沒有啟動它。

## 11. 尚未解除的問題

使用者本人資格／入選與條款接受、未公開競賽細則；部分標準與資料權利；Meta帳號存取／實際rate與latency；WebAudio/HRTF/裝置校準；真正牆角抓取／動態scene performance；ISO大氣係數reference；完整recorder；獨立solver與V5量測。每項解除條件見 [KNOWN_LIMITATIONS](KNOWN_LIMITATIONS.md)，不需下次重新研究已知基礎。
