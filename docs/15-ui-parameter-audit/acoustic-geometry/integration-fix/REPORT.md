# 整合回歸：測試錄製的真模型標記

Root 首次合併後完整 runtime 出現 11 FAIL；本次只負責其中 6 個重評 metadata failure 與 1 個 metrics duplicate-query fixture failure，不把其他四項或整體全量狀態宣稱通過。

Zone fixture 的真 Scene 包含球，求解模型為 extended；source-phase fixture 只有 floor/speaker，模型為 legacy。兩者原 capture header 都是占位 1.0.0，與實際 web-geometric 版本不同，所以正式 exact-model gate 正確拒絕。只改兩份 fixture 的 config 為 acousticSceneSolverVersion(scene)，並以 emitterGeometryPolicyPin() 標示新 capture caller policy。沒有改時鐘、source phase、motion trace、cursor、數學 expected 或 production gate。

Metrics duplicate fixture 的 baseline 來自 extended Scene，但人工 conflicting query 只有 surfaces:[] 且沒 pin，原本自動成 legacy。正式 collector 先排除 backend 不同 query，因此未形成兩筆同模型的衝突，得到 7。現在該人工 query 明示 pin 原 frame.backendVersion，並新增 backendId/version 一致性斷言，確實測同模型 duplicate；原 sampleCount=6、invalid=2、5/343 與所有容差完全保留。無需 production 修改。

| Focused 整檔                              | 結果              | 原始收據                                  |
| ----------------------------------------- | ----------------- | ----------------------------------------- |
| Zone pipeline（含實際 Node Worker realm） | 8/8 PASS、exit0   | [zone](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/295b8c684d5b6509c5b66221b7747b0e71dec457)           |
| Source phase                              | 12/12 PASS、exit0 | [phase](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/d0a8249ab7ec0ac72c5f99ed62bf04e2fe8aae18)           |
| Metrics population                        | 7/7 PASS、exit0   | [metrics](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/cd12ceb77e64ea0a76aec4a973e1eb99c6e79acf) |
| 三檔 ESLint／Prettier／diff check         | exit0             | scoped-eslint.txt／scoped-prettier.txt    |

原始三檔 preimage、原完整失敗收據、各代理原FAIL與精確 hash 均保留；驗證 pin 見 verification.json。Git index 未修改，Root 統一 stage／commit，沒有另啟 Chrome 或重複全 runtime。最後 merged 全量檢查、真DOM／WAV／人工測試由 Root 接續。
