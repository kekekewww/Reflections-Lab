# Task0030 曲面與移動反射器交付階段

本工作樹已完成可工作的有限核心及基本驗證，尚未宣稱整體 V1、人工測試或使用者的全介面驗收完成。根分支會先合併 Zone caller 接線，再合併本分支，統一做完整 check／browser／錄製與逐檔 WAV 匯出。

## 實作內容

- Sphere/capsule Inspector 材質與聲學角色可編輯，沿用既有樣式、run-state 編輯鎖與 fixed/static 角色條件。UI 測試為真 React SSR 及語義斷言，未冒充 browser 點擊。
- 解析球／膠囊閉體遮蔽與一階鏡面位置，實際幾何與有限迭代；平面與曲面的 dynamicReflector 依當次真 pose 反射。沒有把角色改成 enabled 後忽略 solver。
- 所有幾何共用原 maxSurfaces=256；混合 105 物件案例以解析箱體遮蔽物保持 124 項，未放寬 cap／reference／容差。
- 新 request/worker 邊界支援 primitives／boxOccluders／modelVersion，精確驗證 backend、model version、path prefix、identity 與 budget；錯誤回覆整批 fail closed 並終止 transport。
- 同 Scene 所有 source 都 pin 真模型；舊平面 request 保原版本與省略空新欄位。舊已存 AudioReplay 保留原 paths，重新評估必須相同模型。
- 音源 ownership 與實體 self-exclusion 分離：省略 emitterObjectId 沿原 owner、null 為 detached、字串指可信且存在的實體；動態明示 emitting body 不能略過有效 pose。
- 所有新錄製加相同 caller policy explicit-emitter-body-v1。舊 fixed/zone baseline 缺 pin 拒新重評；同新版 object→fixed 行為比較保原契約，policy 不同由既有 solver hash 明確 mismatch。
- 正式 Evidence Ledger 只新增 6 來源與 CG-REF-001～005，沒有覆寫舊主張；完整條件見 [MODEL_CONTRACT](MODEL_CONTRACT.md)。

## 實際驗證

| 執行                                                                                                         | 已讀結果                                                                                                                                | 原始收據                                                                                        |
| ------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| 最終受影響 suite（全 acoustics-runtime、service、builder、model/replay、Host、processor、ownership、policy） | 171/171 PASS，0 skip，exit 0                                                                                                            | [focused-delivery-final](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/23b5864e15eb719bc12e0cfbe4c12d6d109d8870)                                   |
| 原有聲學解析 reference                                                                                       | 17/17 PASS，exit 0；舊公式／容差未改                                                                                                    | [analytic-final](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/e1ccdaa2db670a36837c1be35f7a866f94ee63cd)                                                   |
| 獨立精確／value-only 曲面參考 9 + kernel/OBB 15                                                              | 24/24 PASS；來源及作者關係見 review                                                                                                     | [math-final-review](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/c55040d7224e98e6f7750d4aa4f0e785d7152e6e)                                             |
| 原混合105-object performance regression，fixture未改                                                         | 1/1 PASS，14.06 s；僅該例，不當整體性能 gate                                                                                            | [mixed105-regression](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/0140a9727b79c8ab975889d125ae4f9073c385bb)                                         |
| 新資料／worker fault contract                                                                                | 13/13 PASS                                                                                                                              | [geometry-contract](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/c6aa748d62476a7e013be07d3c5c5811444368cb)                                             |
| Pure-box fixed legacy replay／policy拒絕／同新版行為比較                                                     | 10/10 PASS；真 Rapier/Behavior/solver/Recorder；Replay 使用 FakeAudioContext，不當 native PCM                                           | [policy-final](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/45c7d5c1cc335ab741fafeb04be5e36670974bb3)                                      |
| 正式 build（含 tsc）                                                                                         | exit 0；Vite 原有大 chunk 提示保留                                                                                                      | [build-final](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/5aa37cca69f499922fe38a59c542dbc04b56ef46)                                                         |
| 全 repo ESLint／受影響 Prettier                                                                              | exit 0                                                                                                                                  | [lint-final](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/e6a9874850b905a86429255b297609bf5ab81ecc)、[prettier-final](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/8bd88548b1f53ae8837325bfd8b859dbe57b4a24)            |
| Research metadata                                                                                            | PASS：88 sources／79 claims／13 fixture references                                                                                      | [ledger-final](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/985eba48ac71a10f58e6b17477123b3427850f55)                                                       |
| 擴大 npm test                                                                                                | 650 PASS／12 FAIL，exit 1；全為此 sparse worktree 的歷史 artifact ENOENT（英文原收據／context pin），不當 PASS                          | [research-regression-final](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/9c12a67cabd06c5fe67debd174a61b1bbc916680)                             |
| 初輪 full test:runtime                                                                                       | PARTIAL／中止：真105 budget回歸、舊metadatafixture誤pin及長時間無完成；無總PASS，原TAP及owned進程終止紀錄保留；最終全量由Root整合樹重跑 | [runtime-initial](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/1725af67bba946d2de7650cef62d7a6a947f2d3a)、[stop-owner](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/4deb357cf216a8c2900a588d7b2596449a443520) |

最終 focused command：node --import tsx --test tests/acoustics-runtime/\*.test.ts tests/app/acoustic-service.test.ts tests/app/acoustic-curved-delivery.test.ts tests/app/acoustic-model-recording.test.ts tests/app/acoustic-primitives-input.test.ts tests/app/acoustic-input-ownership.test.ts tests/app/experiment-tools.test.ts tests/app/recording-processor.test.ts tests/app/emitter-geometry-policy.test.ts。

## 原失敗與修正保留

105 物件先出現 289 項真 budget failure，改為 exact OBB occluder 表示後該原例通過，沒有刪球／膠囊。舊 unsupported expectation 依本次使用者新增範圍精確更新；原始內容與原FAIL在 builder/history、builder/legacy-contract-before-update.txt、builder/\*pre-expansion.raw.txt。

Worker 原 backendVersion 錯誤仍被接受的獨立 probe 在 [original](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/67629c40ad7efb855991f297d8d5e0d86fbe105f)，修正後同 probe [final](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/46593d7e2766352ac293f65f7caa120d6b416c78) 明確拒絕、completed=0、failed=1、transport terminated。fixture 的 backendVersion=1.0.0／全域舊版本等占位metadata已改成實際 Scene model，原內容在 evidence/metadata-preimages；首輪8項FAIL保留於 evidence/metadata-final.txt，修正後50/50在 metadata-rerun.txt。沒有改數學答案或容差。

Policy 新 fixture 起初從tick0截取而不符合既有 replay 時鐘，保留 original receipt，改為真 physics.step 從tick1截取；未放寬 replay guard。前述 files 都是本次實作前後的來源快照，不把 f6base Git HEAD 冒充包含當時未提交改動的 commit。

## 整合交界與下一步

1. 必須合併 capability_core 的 Zone caller/helper（Root已取得12786c74）：Runtime、Host fresh/preview、RecordingProcessor 的 trusted rule/profile attachment 決定 null／object exclusion。本工作樹只提供三態 builder 與政策版本，不能獨自把尚未合併 caller 說成已完成。獨立 policy fixture 用真 builder null 明示 detached；新同版本比較證明不因 metadata誤拒，不冒未合併 caller 的閉環驗收。
2. Root 在完整 integration checkout 跑全 runtime/check，包含歷史 artifacts 及 Zone/curves 合併後callerproof；本工作樹的 sparse ENOENT 不改 validator 或 oracle。
3. 舊 browser ui-refined-v2 的 sphere 不支援期待需依user amendment保留preimage/FAIL後更新，實際點擊材質／角色／動態pose／capture/replay/export 全流程。Browser lease 由Root獨占，本分支沒有執行Chrome/nativeaudio/真正WAV匯出。
4. Claude Code再驗證後，仍需使用者人工測試。

## V0–V5與限制

V0 PASS是指定契約/正負例/metadata/schema-compatible shape的本地證據；V1 PASS是指定獨立解析/數值與工程公式子案例。V2只有FakeAudioContext及loopback worker transport接線，真browser PCM波形 NOT RUN。V3外部獨立聲學solver/全波 NOT RUN。V4正式裝置deadline/全量性能 NOT RUN；單一Node案例時間不升格。V5真人聽測、校準RIR/SPL NOT RUN。

曲面幅值仍是有限 ray-path magnitude 1/r×sqrt((1-s)R)；未包含curvature divergence/focusing/caustics、diffraction、厚實體transmission、表面波、相干干涉、低頻全波、retarded-time或moving-boundary Doppler。Scattering分配未渲染，不當額外吸收。
