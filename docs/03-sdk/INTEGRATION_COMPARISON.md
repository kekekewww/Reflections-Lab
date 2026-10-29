# 聲學後端整合架構比較

查核：2026-10-26。以下成本／十天可行性是依本專案需求的工程判斷，並非各套件的效能保證。現階段只執行 Windows C API smoke，沒有實作完整前端、Tauri、Unity 或 WASM 應用。

## 建議

若評審必須直接開啟網址、操作第一人稱物理沙盒並檢視一階幾何反射，建議 MVP 採 A：Three.js + Rapier + TypeScript／Web Audio，另建有分析解的受限 ISM solver；Steam Audio 保留為獨立原生比較／高品質殘響後端。這是一項以部署與可檢視路徑為條件的決策，不代表自製 solver 比 Steam Audio 更精確。

若以 Windows 可安裝 Demo 為主，且卷積殘響／現有 C API 成熟度優先於純瀏覽器，B（Rust/C++ + Tauri）是可採納的替代方案。此時把聲學與 PCM rendering 放在 native runtime，WebView 傳控制／telemetry；不應透過一般 JSON IPC 每個 frame 搬 PCM。混合 D 應等 B 已有穩定獨立 runtime 再投入，避免第一天同時承擔本機服務、瀏覽器、IPC 與音訊 clock 整合。

Steam Audio 官方已提供 `lib/wasm/libphonon.a`，因此 E 具真實起點；本機沒有 `emcc`，尚未連結或執行。將 WASM 列為有時限的 P2 spike，未通過完整 browser smoke 前不放在十天 MVP 的關鍵路徑。

## 五方案對照

| 面向 | A Web-native | B Native + Tauri | C Unity + Steam Audio | D Web + Native service | E Steam Audio WASM |
| --- | --- | --- | --- | --- | --- |
| Implementation complexity | 中高；自有聲學／DSP 是主成本 | 高；C ABI、安全生命週期、native audio | 中；引擎成熟，研究 UI 另建 | 最高；兩 runtime 加協定／時鐘 | 高且尚不確定；link、依賴、Worker／Worklet |
| Browser support | 最佳；仍需測 WebGL／音訊啟動／Pointer Lock | UI 是 WebView；不等於可用網址直接執行 | Unity editor/native 成熟；不可假設 plugin WebGL 可用 | Browser UI 可用但需安裝／啟動本機服務 | 目標可在 browser；完整 Steam pipeline 尚未驗證 |
| Native dependency | 無平台 DLL；Rapier 的 WASM 仍是依賴 | 必須配送每 OS／arch 的 SDK 與 app | Unity runtime + plugin／平台 artifact | 本機 service、SDK、生命週期管理 | 無 native DLL；仍有編譯後 module、port dependencies |
| Latency | Web Audio 與 Worker 頻率分開；需量測 | native audio clock 最直接；UI IPC 不走 PCM | 引擎 mixer callback；需量測 DSP buffer | IPC／網路／緩衝增加 clock 設計成本 | AudioWorklet quantum 適配與內存拷貝需實測 |
| Performance | 受限 ISM 較可控；高階路徑爆炸需裁剪 | 本機 1-source smoke 反射 5.27–5.81 ms；未 benchmark | plugin 可利用 SDK，場景 export／physics 也耗時 | 原生運算能力在，序列化可成瓶頸 | SIMD／threads／瀏覽器 quota、link 選項待測 |
| Debuggability | TypeScript、數值 fixture、Web tools 方便 | FFI／音訊 callback 崩潰較難 | Editor profiler 與場景檢查方便 | 多進程 trace／sequence／timeout 必要 | C++→WASM stack、heap、音訊 underrun 更難 |
| Deployment | HTTPS 靜態站點最簡單 | OS 安裝包、簽章／runtime 驗證 | 平台 player，較大；引擎條款另查 | 網頁以外還需本機服務／配對 | 可靜態托管；pthread 需 COOP/COEP 等條件 |
| Licensing | 各 web lib／資料／HRTF 逐項查 | Apache code + SDK 第三方 binary 條款 | 前項外再加 Unity 當期條款 | 與 B 相同，再列 service dependencies | 仍受原始 code／靜態連結 dependencies 條款約束 |
| First-person physics | Rapier + custom controller／grab；高 web 重用 | 可重用 web controller，native pose 同步 | Character／rigidbody 工具成熟，需自有互動規格 | Web physics 與 native acoustic scene revision 同步 | 可同 A physics，solver 在 Worker |
| Dynamic geometry | 自有有限幾何更新，需自行做 acceleration | SDK instanced mesh + commit；本次未動態實測 | plugin 提供 dynamic geometry；仍有 export 成本 | 同 B，還須確保 revision 配對 | C API 理論能力在；threads／budget 尚待驗證 |
| Reflection path inspection | 自有 ISM 可提供反射點／Path ID | SDK 不提供個別鏡面路徑；需 companion solver | plugin 不會因此自動提供此資料 | 同 B；不可由 UI 補造路徑 | API 表示與 B 相同，不會因 WASM 增加路徑資料 |
| Future Reflections reusability | SceneSpec／solver／DSP 合約可獨立重用 | C API adapter 與 native service 可重用 | Unity-specific glue 較難移植，domain schema 仍可重用 | 合約重用高、維運面較多 | 成功後可重用 browser SDK wrapper；成本未知 |
| Ten-day MVP feasibility | 條件最佳：限一階、簡單房間、來源數封頂 | 條件可行：只做 Windows、native audio 優先 | 已熟悉 Unity 的團隊可行；本 repo 尚無專案 | 偏低；需證明 service 已成熟 | 尚未證實；不能承諾十天完成 |

官方依據：[Steam Audio C API](https://valvesoftware.github.io/steam-audio/doc/capi/index.html)、[Simulation](https://valvesoftware.github.io/steam-audio/doc/capi/simulation.html)、[Unity integration](https://valvesoftware.github.io/steam-audio/doc/unity/index.html)、[Tauri process model](https://tauri.app/concept/process-model/)、[Emscripten pthreads](https://emscripten.org/docs/porting/pthreads.html)、[Web Audio specification](https://www.w3.org/TR/webaudio/)。A 的 solver 成本及 B–E 的完成率為本專案推論。

## WASM 可行性：已知與未知

已直接檢查下載的 4.8.1 archive：`lib/wasm/libphonon.a` 為 ar archive，大小 7,082,068 bytes，SHA-256 `a3811b5da2bc5000449148b994c95285f53ba3a3470d2bb6f5f1e8cafbb0634d`。固定版 [CMake](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/CMakeLists.txt) 有 Emscripten／WASM／SIMD 處理，[dependencies.json](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/build/dependencies.json) 有相關依賴的 wasm 配置。因此不是從零移植整個引擎，也不能把 Windows DLL 直接交給 browser 呼叫。

仍需完成：(1) 固定 Emscripten toolchain 與取得／建立所需 MySOFA、PFFFT、zlib 等 wasm dependency；(2) link 最小 C API context／scene／direct simulation；(3) Worker 執行反射且不阻塞 UI；(4) 若使用 pthreads，設定 COOP／COEP 並測 SharedArrayBuffer；(5) DSP 放 AudioWorklet，處理 browser quantum 與 SDK frame 的適配；(6) 測 Chrome／Firefox／Safari 的記憶體、SIMD、thread、音訊啟動及失敗回退；(7) 依實際連結元件產生 notices。

官方 repo 的 [issue #496](https://github.com/ValveSoftware/steam-audio/issues/496) 記錄 4.7.0 使用者曾遇到未解析的 MySOFA/PFFFT symbols；這是過往環境的失敗報告，不能當作 4.8.1 必定失敗的證據。本次沒有 link 執行結果，狀態為 NOT RUN。WASM 成功也不會提供 SDK 原本沒有的個別鏡面路徑資料。

## 下一階段決策閘門

1. 首個正式實作先交付 A 的單房間、固定材料、可移動 source/listener、一階 reflection fixture；先過解析路徑與到達時間，再接音訊。
2. B 的退出／啟用條件：原生平台 Demo 可接受，且需超過 Web MVP 的卷積殘響。另以 1／8／32 sources、場景 triangles、動態門測 P50/P95 與記憶體；音訊零阻塞仍為硬要求。
3. E 最多投入獨立 spike 的預算，通過完整 browser 初始化＋direct＋reflections＋音訊無 underrun 才能改 ADR。若未通過，保留 A／B，不讓展示依賴未完成的 SDK port。

所有方案都須使用能力感知合約，將「可檢視幾何路徑」與「產生有方向的反射音場」分開。此處是架構建議，最終採納狀態以專案 ADR 為準。
