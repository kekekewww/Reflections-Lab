# 驗證與重現計畫

本目錄是研究準備與隔離驗證，沒有正式聲學引擎、瀏覽器介面或音訊產品。合成資料與解析算式通過，只能支持對應的條件，不能升級成實測或已完成產品功能。

## 重現

環境固定 Node 22.17.0、npm 11.4.2；Python 3.12.11 僅供 SDK／其他研究腳本，Node 測試不依賴 Python。

```powershell
npm ci --ignore-scripts
npm ci --prefix experiments/physics-spike --ignore-scripts
npm run check
npm run benchmark
npm run validate:all
```

`package-lock.json` 固定實際解析版本及 npm integrity。`npm run environment -- --strict --output benchmarks/results/environment-local.json` 保存無機密的版本／硬體資訊；`validate:all` 保存每個命令、exit code、stdout/stderr、時間及版本雜湊。CI 同樣使用 lockfile 安裝；原生 Steam Audio smoke 另見 SDK 文件，沒有在 Linux CI 虛稱執行 Windows binary。

CI actions 固定至官方 [checkout commit](https://github.com/actions/checkout/commit/11bd71901bbe5b1630ceea73d27597364c9af683) 與 [setup-node commit](https://github.com/actions/setup-node/commit/49933ea5288caeca8642d1e84afbd3f7d6820020)，已於 2026-10-26 查核 commit 存在；GitHub Actions 遠端工作本次尚未觸發。`typecheck` 目前涵蓋 fixture metadata 的 TypeScript adapter／未來 src，JavaScript kernel 的 correctness 由 Node tests 與 lint 檢查，沒有宣稱整個 repository 已有 TypeScript 靜態型別覆蓋。

## 驗證層級

| 層級                        | 本次狀態              | 具體證據與界線                                                                                                                                     |
| --------------------------- | --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| V0 Model Contract           | PASS（隔離契約）      | 8 份 Draft2020-12 schema 編譯、正反例；quaternion、能量和、capability、ID 參照有 test-only domain checks。正式 host transaction validator 待實作。 |
| V1 Analytical / Numerical   | PASS（限定 fixtures） | 13 份 fixture ＋邊界／連續性測試；解析、合成與 Rapier 數值結果各自標示。                                                                           |
| V2 DSP Correctness          | PARTIAL               | EDC 與合成 decay regression 可重跑；未測 AudioWorklet、fractional delay、filter、HRTF、click-free crossfade。                                      |
| V3 Independent Solver       | NOT RUN               | 尚未與 pyroomacoustics／獨立 wave solver 做相同場景數值比較。Steam Audio 初始化不能替代此項。                                                      |
| V4 Runtime / Performance    | PARTIAL               | Three 數學操作、Rapier WASM／固定步進、Node 解析 kernel 已跑；browser／Worker／GPU／audio deadline 尚未跑。                                        |
| V5 Perceptual / Measurement | NOT RUN               | 未做受試聆聽、校準 SPL、真實 RIR 或量測室比較。                                                                                                    |

## Fixture 與追溯

完整 input、units、expected、referenceClaimIds、tolerance、重現命令保存在 [`analytical.json`](../../benchmarks/fixtures/analytical.json)。聲學結果測試位於 [`analytical.test.mjs`](../../tests/acoustics/analytical.test.mjs)，kernel 位於 `scripts/validation`，不放進正式產品目錄。

| Fixture 範圍                    | 主要期望                                                                           | 絕對容差               |
| ------------------------------- | ---------------------------------------------------------------------------------- | ---------------------- |
| 3-4-5 free-field                | 5 m、5/343 s、1 m 參考壓力比 0.2                                                   | 1e-12                  |
| 有限一階／二階鏡射              | 一階 hit (3,0,0)、長度 √20 m；二階長度 5 m                                         | 1e-10 m                |
| 有限 polygon／遮蔽              | 平面有效而 polygon 外拒絕；直達與反射每段 interior blocker 拒絕                    | 1e-9 m 幾何 epsilon    |
| 材質                            | 每 band A+R+T=1；等介質反射壓力 magnitude √R                                       | 1e-12                  |
| 空氣 dB 轉換                    | **合成** alpha=0.1 dB/m、10 m，壓力比 0.8912509381                                 | 1e-12                  |
| Doppler                         | 靜止／同速 1；10 m/s 接近為 1030.03003 Hz                                          | 1e-9 Hz                |
| Shoebox mode                    | 5×4×3 m 剛性房間 (1,0,0) = 34.3 Hz                                                 | 1e-10 Hz               |
| arrival／EDC                    | 48 kHz、3.43/6.86 m = 480/960 samples；反向平方能量和                              | sample 0；EDC 1e-10 dB |
| 合成 EDT／T20／T30              | exponential amplitude，三種 regression 的 extrapolated RT60 = 0.6 s                | 5e-5 s                 |
| path continuity／dynamic update | 相同 surface sequence ID 穩定；source 平移 1 mm 長度變化 ≤1 mm；blocker 新增可拒絕 | 1e-12 m 浮點餘量       |

無重力、固定、自由落體、impulse／force、碰撞事件、spring joint 的真實 WASM smoke 見 [PHYSICS_VALIDATION](PHYSICS_VALIDATION.md)。Throw audio 事件、跨平台 replay、完整動態幾何 broad phase 與音訊 path birth/death crossfade 只有設計，不能將上述幾何測試當作已交付互動功能。

## 後續驗證順序

先以相同幾何、聲速、材質和階數與獨立 ISM 比對路徑／IR arrival，再測實際 fractional delay 與統一 direct/early time base；最後才使用合法小型 RIR／HRTF 子集和校準量測。資料集選擇與授權條件見 [DATASET_CATALOG](../../research/datasets/DATASET_CATALOG.md)。

不同 backend 無逐路徑 capability 時回傳 unsupported，不以空陣列、杜撰路徑或推測統計充當數值比較。每次結果需固定 scene／material／motion revision、backend version、seed、dt、sample rate 與檔案 SHA-256。

## 最後整合補充

Phase 1 的 `check`／`validate:all` 為11個命令，歷史結果保存於 `benchmarks/results/phase1-validation-preserved.json`。Phase 2 加入Wiki／設計／來源驗證後目前為16個命令，新的總結果另存 `benchmarks/results/phase2-validation-local.json`，不改寫Phase 1證據。核心 `npm test` 仍為30個解析／契約組，另跑資料取得工具18案例（17 PASS／1 junction fixture因EPERM而SKIP／0 FAIL）與Rapier6項。取得工具測試只用本地mock；範例UNKNOWN授權／null pins的dry-run回BLOCKED／exit2是預期結果，不代表已取得真實資料。完整限制與重跑命令見 [dataset spike](../../experiments/dataset-fetch-spike/README.md)。

Skills可另跑 `scripts/setup/validate-skills.ps1 -PythonPath <有pip的Python執行檔>`；首次可加 `-InstallDependency` 將固定PyYAML6.0.3放入忽略cache，並以本機Codex skill-creator的quick_validate.py檢查8個Skills。本機實際使用bundled Python，官方validator8/8 PASS；此檢查不在跨平台npm CI內。
