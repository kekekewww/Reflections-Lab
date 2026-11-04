# Task0030 曲面與遮蔽幾何最終複核

狀態：此有限數學／整合複核 PASS，未發現已確認的阻斷缺陷；不是完整產品或聲學科學驗收。記錄時間：2026-11-02T09:27:55.716Z。

## 方法與獨立性

本複核者曾實作 primitive 與 OBB 數學核心，故本次是隔離的整合複核，不能冒稱整個實作的完全獨立碼審。另由其他代理撰寫的九項獨立 reference，使用預先指定反射點與等角方向構造答案，以及全圓周 value-only 掃描／golden search，沒有以產品回傳值作預期值。本次重新執行其測試，保留原 reference 收據不變。

唯讀範圍為 solver、primitive／OBB、request builder、共用角色／模型能力與 delivery 身分接線。未修改產品 source、測試、Wiki 或 Git index。複核期間 lead 僅補共享模型推導、service pin 與 builder 字串 pose gate；已重新讀取該接線。數學核心在本輪測試期間未改。

## 查核結果

| 項目 | 本輪結果與證據範圍 |
| --- | --- |
| 曲面幾何 | 球體共同可見弧導數二分；膠囊兩端球面與側面候選，側面軸向有解析解。真徑向法向、capsule 接縫只發布單一 body path。球最多48次二分、膠囊總上限144，不用 tessellation。 |
| 閉體與端點 | Sphere／capsule 解析體積區間；OBB 真 inverse-normalized quaternion 後三軸 slab。實際端點以1e-7m排除；閉體切線保守算遮蔽；內部代表點只供 blocked boolean，不成為表面法向或反射頂點。 |
| 容量與退階 | planar、primitive、boxOccluder 合計仍受原 maxSurfaces 預算；每次可見性測試受 maxSegmentTests 約束，不完整時 fail closed 並標 budgetExceeded。超 maxPaths 明示截斷，不以缺少路徑證明實際沒有聲路。 |
| 混合105物件 | Builder僅在 extended model 且未壓縮項超預算時，將 dynamicOccluder 方塊改一筆 OBB；reflecting boxes仍六個精確面。不刪物件、不升高256容量。已讀獨立 mixed105 fixture 與精確124／123容量正負案例；該組執行收據屬 lead 的其他回歸，非本次24案。 |
| 角色與姿態 | dynamicOccluder 永不進入 reflection loop；dynamicReflector 使用該 tick 真 pose 的 snapshot。moving staticSurface仍不被偷偷升級；所有新輸入均有有限／非退化驗證。 |
| 身分與所有權 | path ID由模型／scene topology／source／listener／geometry domain ID形成，不含rank、pose、候選索引或 Rapier handle。Builder cache區分 faces／volume，跨 source皆深複製；detached emitter不誤刪 binding owner 的幾何。 |
| 舊資料與模型 pin | legacy planar-only省略 primitives／boxOccluders／modelVersion；未改原平面公式與 reference tolerance。scene-wide model pin不因一個emitter自體排除而混版本；legacy pin帶新幾何拒絕。已讀service核對backendVersion與path ID prefix的新身分 gate，未於本輪另做transport fault injection。 |
| 能量與時間 | 原 A/R/T 能量和、sqrt((1-s)R) 壓力與單次 absolute delay語意保持；未把 scattering 加入吸收。曲面只解幾何位置，1/pathLength幅度未加入曲率 divergence/focusing/caustic 補償；solid transmission能力仍false，不造穿透聲。 |

## 本輪執行

`node --import tsx --test tests/acoustics-runtime/primitives.test.ts tests/acoustics-runtime/box-volume.test.ts tests/acoustics-runtime/curved-reference.test.ts`

退出碼0；24／24 PASS、0 FAIL、0 SKIP。組成為 primitive8＋OBB7＋獨立 reference9。TAP duration 289.5623ms只是這次小型測試耗時，沒有性能通過含義。

原始輸出：[`math-final-review.txt`](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/c55040d7224e98e6f7750d4aa4f0e785d7152e6e)，SHA256 `b6aa4cd7fe0d52c762068e93687108900225216e5ac29298f38938eef7cad6f2`。

## Source pins

實際 HEAD為 `f6abb936a8c7c87ff8eb5e6587260b837e6b67ae`，是分支基底；本輪檢查的是尚未提交的新 working-tree bytes，以以下SHA256為準，不捏造最終commit。

| Path | SHA256 |
| --- | --- |
| `src/acoustics/types.ts` | `b63c408f7567483716625cf614524a7064a31a4700e307fd6968d107ef2e34c3` |
| `src/acoustics/geometry.ts` | `d6f32a043e29794d08b950f50addfb7841673a441723cde3fc3674e930929dd4` |
| `src/acoustics/primitives.ts` | `1194f590e30dc52ee33683e2b052674f2673287fb59f02b933d88242bbc9f702` |
| `src/acoustics/box-volume.ts` | `012692cde885e28cf3b7023c8201c2dab9249e2a0d851a8b1d6872b267bf852f` |
| `src/acoustics/solver.ts` | `bb06e300ba9528306c6d1420ef7a15c77fbaaa4d1ba7c4c226399a4144fcf20f` |
| `src/capabilities/acoustic-geometry.ts` | `13309dc0b4e75aa169777404f39a16d1b6359bbd6e4b961622433aa709f4e9e9` |
| `src/app/acoustic-input.ts` | `f9c6cc11e12676aea45c2bd09ce238faec3bc3ed347359acbe290fbfa72c9a5b` |
| `src/app/acoustic-service.ts` | `a41bcf0ed33fda8b5183cd9ed29b69e9841d5b6b3ea4262bd8abbaae774f0ed3` |
| `tests/acoustics-runtime/primitives.test.ts` | `46234fb4f703950c30c2bd10ffc3d0f5f440bfadfe5070987031b337689b4949` |
| `tests/acoustics-runtime/box-volume.test.ts` | `c6a6825939ba574fbcedce5e598f3c222f218aefa76b4a3d8aa7500030a33965` |
| `tests/acoustics-runtime/curved-reference.test.ts` | `dbaade7a63ac53b912387f1c9709b0ad119c14ea9883ea8b2be2fde126f11fc1` |
| `tests/acoustics-runtime/curved-solver.test.ts` | `7ac0bf387b2d482331e69ced132e851e191bf65410795a488335c5c2cffbd30c` |
| `tests/app/acoustic-primitives-input.test.ts` | `85a46ccb1304f0ffe9d126d81a49f33dccbe7f163cfb4806195f7b1d329aeb58` |

## 限制與未執行

- 此24案支持 V0／V1 的型別、幾何與合成參考範圍；未以此填完整V2 renderer／V3房間量測／V4聽感／V5實體裝置。
- 未做 curvature focusing、diffraction、surface waves、phase-correct wave interference、retarded-time moving-boundary 或獨立 Doppler 模型的正確性主張。
- 未執行 browser Worker、UI、Zone最後合併、WAV／硬體輸出、真人或正式600秒性能；由 root 另以真正流程驗證。
- 任意無窮輸入、所有極端 condition number 與所有場景組合未窮舉；grazing與近界面依明示EPS／模型限制處理。
