# 正式物理邊界驗證（2026-10-27）

本次只新增 `tests/physics/v1-boundaries.test.ts` 與本目錄證據；核心、既有 matrix、套件與凍結驗收沒有修改。這是 Node／實際 Rapier 0.21.0 WASM 的分項證據，不表示完整第一版、browser、聽測或效能已通過。

最終執行：`node artifacts/v1/physics-boundaries-20261027/run.mjs combined-final --combined`。實際子程序為 `node --import tsx --test --test-concurrency=1 tests/physics/v1-matrix.test.ts tests/physics/v1-boundaries.test.ts`；2026-10-27 06:10:36.265Z–06:10:41.301Z，38／38 PASS（既有 matrix 29＋新增 9），FAIL／SKIP 0，exit 0。每個測試模擬迴圈最多 240 ticks；程序 deadline 55 秒，未逾時。

[最終 verification](combined-final/verification.json) 保存 command／時間／exit／完整 before-after hashes、61 個 protected expected／actual hashes、raw TAP／stderr hash，以及兩份新鮮 measurement 的 hash。所有 source stable、protected stable／match、counts valid、measurement freshness 均為 true。[獨立語義審查](independent-review.json) 由另一個唯讀 Codex subagent 完成，沒有執行／修改核心；最終測試及 runner SHA 與審查一致。

| 新增案例 | 實際量測／判定 |
| --- | --- |
| 20°斜坡 | 實際 45° climb 設定；90 ticks 前進 2.571926 m，上升 0.925472 m |
| 60°斜坡 | 90 ticks 最大上坡位移 0.021937 m，小於實際半徑 0.25 m；沒有攀越 |
| 0.7 m 門洞 | 實際半徑 0.25 m、skin 0.01 m，單側淨空 0.09 m；通過，z 從 1 到 -1.877539 m |
| 0.4 m 門洞 | 單側淨空 -0.06 m；停在 z=0.266063 m，沒有穿越門柱近側面 |
| 小球高速 Throw／CCD | 球直徑 0.02 m、牆厚 0.01 m，12 m/s 每 tick 0.2 m；一次 1.2 Ns COM impulse，CCD enabled，30 ticks 後 x=-0.014999 m，仍在牆近側；重新抓取後重送 command ID 保持 Held／原速度 |
| 旋轉面，support 排序在前 | 30°旋轉固定表面，世界法線約 [-0.5,0.8660254,0]；靜態表面 witness 的解析平面條件與 pre-step v+ω×r 皆吻合 |
| 旋轉面，body 排序在前 | canonical normal 反向，點位／量值不變；接點切向速度約 0.8000005 m/s，與 COM-only 0.5 m/s 有實質差異 |
| 多接點 box face | 實際 4 個正 impulse，總和 2.104348302 Ns；COM 動量變化 2.104348354 Ns；獨立正 impulse 加權固定表面 witness 與事件位置一致；120 ticks 僅一 impact |
| 同 tick 牆角 | tick 10 同時撞 floor／wall；兩個 domain pairs／episodes、各自法線，120 ticks 總共兩個 impact，法線沒有混合 |

`1e-5` absolute 只適用本案例中 Float32 WASM 複製值與解析向量／轉換／動量計算的比較；沒有新增物理穿透通用容差。原 matrix 的穿透與 tracking 量測沿用原有判定，沒有放寬。

第一輪 [RED](boundaries-red/stdout.tap) 是新增測試錯把平面接觸的正 impulse 權重視為必然對稱，要求 weighted x／z=0；實際迭代求解的權重不對稱（x=-0.006241885 m）。它不是產品缺陷。修正 oracle 改成從原始 manifold 讀取各正 impulse 與固定表面 witness，獨立計算 Σ(J·witness)/ΣJ；仍保留 y=0、原始 J 總和及真 COM 動量斷言。RED 的原始測試 source、stdout／stderr、before-after hashes 完整保留，沒有覆寫。`boundaries-v2`、`combined-v1` 留為中間歷史，`combined-final` 是當前最終證據。

[靜態檢查](static-checks/verification.json) 的四個獨立程序皆 exit 0／未逾時：全專案 `tsc --noEmit`、新增測試 strict 型別檢查（含 noUncheckedIndexedAccess／exactOptionalPropertyTypes）、新增測試 eslint、Prettier check。各自 raw stdout／stderr 都在 `static-checks/`。

最終重要 SHA256：

- `tests/physics/v1-boundaries.test.ts`：`ca07b4182943e0a3475f7750d75136e64e1262126c081b24b7e58e47e3b3636e`
- 原 `tests/physics/v1-matrix.test.ts`：`8c04776ba0ab6ba618a1d8ac30042f34ab6403c7a484187a44896d6428d57e81`
- `src/physics/physics-world.ts`：`071adc79ac6a0b7f12b7dade2994e7d4ae0df07c40899eaae547fd45a764dcc4`
- `src/physics/character-motor.ts`：`5e3d29d2e0d71c6ae0b4a87f3bb944bd123ebe0402220e574859421fddd4a8f9`
- `src/app/runtime.ts`：`691c62a6307911dd0a92b87be58710131ec6b06f7bd404a6b8a4d6c9fc7bfc40`
- `combined-final/verification.json`：`bb9755a7a92ce65e4c82a4e81fae50b1f1c10759e9bc5e32a94fc1787ba005e4`

限制：斜坡測試從坡面合法出生點開始，尚不涵蓋進坡接縫；牆角使用分離凸體 domain objects，未聲稱任意複合形狀的同 pair 多 patch 完整性；公開事件有 Ns，沒有匯出 N force，force equivalent 明示為 J/dt；CCD 中間接觸不一定保留於步後 manifold，未聲稱完整微接觸時序。沒有 browser／CI／安裝／Git 寫入／Meta／Muse 呼叫。Wiki 由 root 單一 writer 接手更新。
