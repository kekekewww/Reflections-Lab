# Steam Audio SDK 研究

查核：2026-10-26（台灣）；固定評估版本：4.8.1。範圍為研究及隔離式驗證，正式產品整合尚未開始。

## 結論與證據等級

Steam Audio 可作為原生聲學與音訊後端。本機已實際通過 Windows x64 的 C API 初始化、場景／材質、遮蔽／穿透、參數式反射、卷積反射及釋放後重建測試；詳見 [SDK_VALIDATION.md](SDK_VALIDATION.md)。這些結果只驗證小型場景的技術路徑，不等於聲學精度或完整 Demo 已驗收。

最重要的架構限制是：公開 `IPLSimulationOutputs` 沒有提供逐條鏡面反射的反射點、表面序列、穩定 Path ID。`IPLPathingVisualizationCallback` 確實存在，但輸出的是 pathing 的 probe 間線段，不能冒充鏡面反射路徑。若產品必須檢視一階／二階幾何反射，需另建可驗證的 Image Source Method 後端，或明確標示該能力不可用。[Simulation](https://valvesoftware.github.io/steam-audio/doc/capi/simulation.html)

| Claim ID | 主張 | 證據與狀態 |
| --- | --- | --- |
| SDK-01 | 最新穩定 release 為 v4.8.1 | 官方下載頁 + GitHub latest API，2026-10-26 查核；VERIFIED |
| SDK-02 | Windows x64 C API 可執行本研究場景 | 本機 GCC 編譯及 3 次完整生命週期，PASS |
| SDK-03 | 公開 simulator 輸出不含 individual specular reflection path list | 固定版 header／官方 simulation 結構檢查；API_INSPECTED |
| SDK-04 | pathing 有線段視覺化 callback | 固定版 header 與官方 API；API_INSPECTED，未執行 pathing |
| SDK-05 | 官方 SDK ZIP 具有 WASM 靜態庫 | 已下載 ZIP 的 `lib/wasm/libphonon.a`，7,082,068 bytes；INSPECTED，瀏覽器執行 NOT RUN |
| SDK-06 | raw energy／IR 有公開 API，但與即時 opaque reflection handle 不同 | 4.7 release notes + 4.8.1 header；API_INSPECTED，baked extraction NOT RUN |

## 版本與取得方式

[官方下載頁](https://valvesoftware.github.io/steam-audio/downloads.html)與 [v4.8.1 Release](https://github.com/ValveSoftware/steam-audio/releases/tag/v4.8.1) 相符；GitHub API 記錄發布時間為 `2026-02-11T18:43:55Z`。C API ZIP 為 `steamaudio_4.8.1.zip`、181,171,027 bytes，SHA-256：

```text
4a0aa5ec1176f38f0b0993a37c2259d9e86f27e22d5e24f83ec4c3cb9a1d5449
```

此值同時出現在 [GitHub 官方資產 digest](https://github.com/ValveSoftware/steam-audio/releases/expanded_assets/v4.8.1)，且已與本機下載檔重新計算的結果比對。固定資訊存於 `third_party/steam-audio/manifest.json`；可重現命令：

```powershell
./scripts/setup/steam-audio.ps1 -Download -Extract
./experiments/sdk-smoke-tests/run.ps1
```

僅原始測試碼、manifest、文件與小型數值結果進版本控制。SDK ZIP、解壓檔、DLL、靜態庫及執行檔保存在忽略的 cache/build 目錄。

## C API 與責任邊界

| 物件／操作 | 用途 | 整合注意事項 |
| --- | --- | --- |
| `IPLContext` | 版本設定、全域配置與資源建立 | `version = STEAMAUDIO_VERSION`；保留／釋放為 reference counted |
| `IPLScene` | 聲學場景容器 | 應與渲染／碰撞幾何區分，保存 scene revision |
| `IPLStaticMesh` | 三角網格、每面材質索引 | 靜態網格不支援直接變形；4.8.1 header 有 `iplStaticMeshSetMaterial`，尚未實測更新 |
| `IPLInstancedMesh` | 子場景及剛體 transform | 可平移／旋轉／縮放；有 `iplInstancedMeshUpdateTransform`，不等於可變形網格 |
| `IPLSimulator` | direct／reflections／pathing 計算 | 建立時的 scene type、reflection type 不可任意切換 |
| `IPLSource` | 發聲位置、各種模擬輸入及結果 | 與 PCM 音訊播放物件分開；物理物件移動不應重建音訊串流 |
| `IPLMaterial` | absorption、scattering、transmission | 官方預編譯版為三頻帶；值須附定義及資料來源 |
| `iplSceneCommit` | 套用 mesh／instance 變更 | 不能與 scene tracing／simulation 任意交錯 |
| `iplSimulatorCommit` | 套用場景／probe／source 集合變更 | 不可在模擬執行中呼叫；一般 source/listener pose 更新使用 SetInputs |

依據：[Programmer’s Guide](https://valvesoftware.github.io/steam-audio/doc/capi/guide.html)、[Scene API](https://valvesoftware.github.io/steam-audio/doc/capi/scene.html)、[固定版 header](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/phonon.h)。完整所有權與並行規則需對照所用 API，不能因 reference counting 推論所有函式皆可無鎖並行。

## 可取得與不可假設的輸出

| 能力 | 4.8.1 公開表示／限制 | 本次狀態 |
| --- | --- | --- |
| 距離衰減、空氣吸收、directivity | `IPLDirectEffectParams` 的 scalar／band coefficients | 距離、空氣有限值通過；directivity 未測 |
| 遮蔽與穿透 | direct occlusion factor、三頻帶 transmission | 同側與穿牆場景通過 |
| 反射與殘響 | convolution IR handle、三頻帶 reverbTimes、hybrid 參數 | parametric 與 convolution 均通過 |
| 即時反射原始 sample | `IPLReflectionEffectIR` 是 opaque handle | 已用 Dirac 輸入 `iplReflectionEffectApply` 取得非零有限輸出；未實作 sample 匯出 |
| Baked energy／IR | `iplProbeBatchGetEnergyField` → `IPLReconstructor` → `IPLImpulseResponseGetData/GetChannel` | API 查驗；未執行 baking／重建 |
| Individual reflection paths | 公開 simulator 結構沒有反射點序列／Path ID | 不支援此公開合約；不可虛構 |
| Pathing 視覺化 | `pathingVisCallback(from,to,occluded,userData)` | probe 路線圖線段；不是反射表面點 |
| HRTF／雙耳 | default HRTF、受支援 SOFA；binaural／Ambisonics decode | 官方 API 支援；本次未渲染雙耳或試聽 |
| 傳播延遲／Doppler | direct effect 結構沒有幾何 delay 或速度欄位 | 應由獨立傳播模型／delay DSP 負責；不能宣稱本次已驗證 |

4.7.0 之後已增加 raw energy、IR、reconstruction API，不能沿用舊版「完全無法取得 IR」的結論。但 `IPLImpulseResponse` 與 `IPLReflectionEffectIR` 是不同的 opaque 型別，禁止強制轉型讀取內部記憶體。以上區分依據 [v4.7.0 Release](https://github.com/ValveSoftware/steam-audio/releases/tag/v4.7.0)、[Reflection Effect](https://valvesoftware.github.io/steam-audio/doc/capi/reflections-effect.html)、[固定版 header](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/phonon.h)。

## 材料、座標與媒介

官方 header 將 absorption 定義為吸收的能量比例；scattering 為反射能量中隨機散射比例；transmission 只用於 direct occlusion。三個頻帶中心為 400 Hz、2.5 kHz、15 kHz。不可直接把任意 octave-band 測量值、振幅反射係數或 transmission loss dB 當成相同欄位。本次使用的 `absorption=[.1,.2,.3]`、`scattering=.1`、`transmission=[.2,.1,.05]` 是人工測試值。SDK 預設 preset 也不自動等於有完整量測條件的材料資料。[Scene/material API](https://valvesoftware.github.io/steam-audio/doc/capi/scene.html)

SDK 為右手座標、+X 右、+Y 上、-Z 前；矩陣為 row-major。adapter 必須明確轉換 world transform、方向向量、單位及材質頻帶。[Geometry](https://valvesoftware.github.io/steam-audio/doc/capi/geometry.html)

空氣吸收可設定 exponential coefficients 或 callback；這提供整合溫濕度模型的入口，不代表 SDK 已提供 Reflection Lab 所需的完整溫濕壓 UI／ISO 9613-1 驗證。Doppler、retarded time 與固定聲速的假設仍需自有模型文件。

## 平台、建置與執行條件

已驗證 ZIP 的 library 目錄為：`windows-x86`、`windows-x64`、`linux-x86`、`linux-x64`、`osx`、`android-armv7`、`android-armv8`、`android-x86`、`android-x64`、`ios`、`wasm`。只有 Windows x64 已執行，其餘是包裝清單，不是本機相容性證明。

[Getting Started](https://valvesoftware.github.io/steam-audio/doc/capi/getting-started.html) 列 Windows／Linux x86/x64、Android 四種架構、iOS ARM64，macOS 頁面仍列 Intel／10.7；[v4.8.1 CMake](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/CMakeLists.txt) 則有 macOS x86_64+arm64、10.13 及其他架構的 source build 判斷。文件最低版本、source build 分支與實際 release artifact 應分開追蹤，尚未針對所有最低 OS 做認證。

預編譯 C API 需對應架構的動態／靜態庫與可相容 runtime；本次既有 GCC 可讀取 header 並以 `LoadLibraryExA/GetProcAddress` 呼叫 Windows x64 DLL，未要求 Visual Studio。這只證明該 DLL/C ABI 在本機可用，不是正式 MSVC／Rust binding 建置已完成。[Source build instructions](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/doc/build-instructions.rst) 使用 CMake、Python、C++14 與個別相依套件；IPP 可選，替代數學／FFT 路徑的效能須重新量測。

## CPU、記憶體與音訊執行緒

direct、反射更新、physics fixed step 與 PCM frame 處理應獨立排程。官方指出啟用遮蔽／穿透的 direct simulation 不應在 audio thread 執行，反射／pathing 應移到背景執行緒。[Simulation](https://valvesoftware.github.io/steam-audio/doc/capi/simulation.html)

本次測試：1 source、14 triangles、4096 rays、8 bounces、2 threads、0.25 s、order 1、48 kHz／512 frame。單個理想 float IR 資料量為 `4 × 12000 × 4 = 192000 bytes`；這不含 FFT、雙緩衝、ray tracing structures 等額外記憶體。反射呼叫約 5.27–5.81 ms 是一次小型 smoke 的觀察值，不能當成 P95、最高 source 數或音訊 latency 保證。512/48000 = 10.67 ms 只是本測試 frame 時長，裝置 I/O、瀏覽器和 IPC 延遲另計。

## 後端合約建議

能力旗標至少分開 `directCoefficients`、`reverbParameters`、`reflectionAudio`、`bakedRawIR`、`individualSpecularPaths`、`probePathSegments`。結果附 backend/version、sceneRevision、inputTimestamp、computedAt、material mapping revision、band centers 與 solver settings。Steam Audio adapter 將 `individualSpecularPaths=false`；視覺化 solver 的路徑須顯示自己的計算來源。不要把獨立 ISM 路徑說成 Steam Audio 內部實際採樣的那條反射。
