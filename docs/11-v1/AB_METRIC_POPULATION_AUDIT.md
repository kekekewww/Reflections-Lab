# A/B 指標取樣母體修復與稽核

2026-10-27；適用 `V1-AB-01`、`V1-MET-01`。這是 Computed 幾何查詢的統計修復，不是新聲學模型、聽測或 Meta live 證據。原驗收、解析 expected 與 tolerance 均未放寬。

## 已確認的原因

舊 browser diagnostic 的 A 保留 stop/fading 事件的聲學診斷查詢，B 重評只對 post-step `playbackState=playing` 的來源求解。原指標把所有可用查詢都平均，兩邊實際採用了不同母體。原始 trace 沒有刪除；停止階段的診斷仍可追查。

獨立讀取舊 archive 的 81 個 frame，window=tick 4..84、fixedDt=1/60 s：

| 取樣集合 | 筆數 | 直達延遲算術平均（s） |
| --- | ---: | ---: |
| 所有可用直達查詢 | 118 | 0.01592289576547707 |
| post-step 邏輯 playing 來源 | 116 | 0.016036576002133818 |

多出的兩筆在 tick 25、39，皆為 fading/stop 診斷。兩種平均之差 `0.0001136802366567477 s` 恰等於舊 UI 的 B−A，殘差 0。它不能解釋為只改材質造成的直達傳播時間變化。[原始 archive 與本次獨立重算](../../artifacts/v1/metrics-population-audit-20261027.json)固定 input hashes、原始 artifact canonical hash、取樣及限制。舊 archive 沒有保存 raw B；本稽核沒有將推論冒稱成讀取了 raw B。

## 現行統計契約

`src/experiments/metrics.ts` 是 domain 與 AI 分析共用的 collector：

- 有完整同 tick/revision/epoch 的來源狀態時，採 post-step 邏輯 playing 查詢；排除 stop/fading／非 playing 診斷。這不是實際 native PCM admission 或人耳可聽性的判定。
- 一筆取樣由 tick、穩定語意來源與 listener 決定，不使用 array rank 或 engine handle。重複而有歧義的查詢全部排除，不依陣列順序選一筆。
- 直達延遲只取真正可用的 order-0 路徑。路徑平方壓力比指標是對 returned paths 的 `mean_actual_frame_bands(gain²)` 求和，再對查詢平均；沒有 authored gain、pitch、waveform、PCM、SPL 或完整聲場能量的主張。available 空路徑查詢的 returned-path 空集合和為 0，不代表物理上絕無聲音。
- 每個指標保存 method、population kind/policy、sample count、eligible/excluded/invalid query counts、backend declaration mismatch count、band 與 tick window。aggregate path-energy 的取樣鍵包含實際頻帶集合，避免比較不同頻率加權。
- 缺少可信發聲資格的 legacy 資料只使用明示的 geometric-query diagnostic 方法；其 backend declaration 未核實／不符的數量保留，不能冒稱已驗證的 emitted-source aggregate。AI 工具原有 backend ID/version 守門仍保留。
- A/B 的 source/motion 等固定條件守門維持原規則。只有某個指標的方法／取樣 support 不相容時，該指標保留 A、B 原值，但 delta/percent 為 null 並回具體原因；不將可合法改變的路徑可見性誤判為整組實驗失效。

## 驗證與邊界

真 Root 3 秒 Rapier capture 含 impact 與 one-shot expiry，原始 stop diagnostics 保留；相同材質 B 的 delay/energy delta 為 0，只改材質 B 的 direct-delay delta 為 0、幾何路徑平方壓力比下降。AI Analyze 與同一 collector 的值一致。獨立回歸另涵蓋缺少／重複 query support、legacy、AI paired delta、頻帶基礎不同時只停用受影響指標。

[獨立 7/7 原始驗證](../../artifacts/v1/metrics-population-review-20261027/1793071935418/verification.json)與相鄰 stdout/stderr 以原 bytes 保存；JSON 中的 `.cache` 路徑是原執行位置，持久副本在同名 artifact 目錄。前一次第 7 測試因 fixture 沒有同步限制 material bands 而遭既有 `BAND_MISMATCH` 正確拒絕，[失敗輸出亦保留](../../artifacts/v1/metrics-population-review-20261027/1793071880399/verification.json)；只修正新 fixture，沒有放寬 core validator 或容差。

本報告不取代修復後的 current-source browser/E2E gate。最終 browser harness 應保存 raw A、raw B 與完整比較結果，核對共同的 logical-playing 取樣及 material-only direct delay，另列裝置、聽測、效能與 live 的未驗項。
