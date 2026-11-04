# 原生 WebAudio render trace 能力查證（來源研究，未量測）

本次已確認固定 Chromium producer 有 render 範圍事件，並有條件提供 thread CPU 時間。因此不能無證斷言「原生 WebAudio CPU 都不可量」。但這只是來源能力，未取得本次音訊 trace 的 CPU 欄位、完整覆蓋與身分證據；`nativeDspCpuMs` **維持 null／NOT_MEASURED**。本文件不構成 DSP CPU、deadline、probe overhead、硬體聽音或 600 秒資格通過。

固定 Chromium：`861389936bf33ea77529ee5dcc0605e68f6bb620`；其 DEPS L2843–2844 固定 Perfetto：`403906f4adfbf287a02e5546f8430dcc9d56b649`。[官方 DEPS](https://chromium.googlesource.com/chromium/src/+/861389936bf33ea77529ee5dcc0605e68f6bb620/DEPS#2843)

本次唯讀 HEAD：`94cb2c49b5b00be5c777978b660eb1f9cf4c5f3e`，同次實讀時間 `2026-11-03T00:24:07.4734199+00:00`。這是研究時的 checkout HEAD，不是新的 benchmark run sourceCommit。未啟動 browser，未重新驗證 executable，因此此研究的 executable SHA 為 null。完整來源 URL、decoded-source SHA-256、bytes、行號與本地引用 pin 見 [JSON](10-audio-render-trace-capability.json)。

## 已確認的 CPU 語義

- Chromium 的 legacy TraceConfig 轉換明設 thread-time sampling=true、timestamp multiplier=1000（L802–833）；track-event adaptation 在未指定時亦啟用 sampling（L190–201）。這證明設定能力，不能取代 raw event 欄位驗證。[TraceConfig](https://chromium.googlesource.com/chromium/src/+/861389936bf33ea77529ee5dcc0605e68f6bb620/base/trace_event/trace_config.cc#802)；[AdaptTrackEventConfig](https://chromium.googlesource.com/chromium/src/+/861389936bf33ea77529ee5dcc0605e68f6bb620/services/tracing/public/cpp/perfetto/perfetto_config.cc#190)
- Perfetto 定義 thread time 為該執行緒自建立以來累計的 CPU 時間；僅在啟用 sampling、且 event 位於 current-thread track 時讀取計數器與輸出差值。subsampling 可使個別事件缺值。[TrackEventConfig L87–100](https://chromium.googlesource.com/external/github.com/google/perfetto/+/403906f4adfbf287a02e5546f8430dcc9d56b649/protos/perfetto/config/track_event/track_event_config.proto#87)；[producer L598–614](https://chromium.googlesource.com/external/github.com/google/perfetto/+/403906f4adfbf287a02e5546f8430dcc9d56b649/src/tracing/internal/track_event_internal.cc#598)
- Windows 非 ARM64 分支以 QueryThreadCycleTime 與校準的 TSC 頻率換算；ARM64 分支使用 kernel+user GetThreadTimes。本研究未證實這台機器的實際取樣成功率或誤差。[Windows 實作 L126–159](https://chromium.googlesource.com/external/github.com/google/perfetto/+/403906f4adfbf287a02e5546f8430dcc9d56b649/src/base/time.cc#126)
- JSON `ts/dur/tts/tdur` 是從 ns 除以 1000 的整數 **µs**；`dur` 是 wall duration。完成的正 duration thread slice 可輸出 `X/dur`；`tts/tdur` 另需實際 thread-time 資料。未完成 slice 會輸出 `B`，不能補造 duration。缺少 `tdur` 是 unknown，不能冒成 0，也不能用 `dur` 替代；欄位真的為 0 仍受整數 µs 量化限制。[export L799–804](https://chromium.googlesource.com/external/github.com/google/perfetto/+/403906f4adfbf287a02e5546f8430dcc9d56b649/src/trace_processor/export_json.cc#799)；[export L851–914](https://chromium.googlesource.com/external/github.com/google/perfetto/+/403906f4adfbf287a02e5546f8430dcc9d56b649/src/trace_processor/export_json.cc#851)

`TRACE_EVENT` 在離開 scope 時關閉 slice。因此下表各層是 inclusive 範圍；不得把父子 CPU durations 相加，也不能把子 wall duration 從父 CPU duration 扣掉。這是 scope 與兩種 clock 語義所導出的計算限制；實際 nesting／tid 仍需從 raw trace 驗證。[scope 巨集 L391–393](https://chromium.googlesource.com/external/github.com/google/perfetto/+/403906f4adfbf287a02e5546f8430dcc9d56b649/include/perfetto/tracing/track_event.h#391)

## Render 事件與可歸屬範圍

| category／事件 | 固定來源 | 能力與限制 |
|---|---|---|
| `webaudio`／`AudioDestination::Render` | [L125–153](https://chromium.googlesource.com/chromium/src/+/861389936bf33ea77529ee5dcc0605e68f6bb620/third_party/blink/renderer/platform/audio/audio_destination.cc#125) | output callback：frames 取自實際 output bus，delay 參數標 ms；包括 FIFO／輸出工作。原碼指出 AudioDeviceThread，Worklet 設定可把 graph render 送往另一執行緒。不是一個固定 128-frame graph quantum；該事件沒有 context/node UUID。 |
| `webaudio`／`AudioDestination::RequestRender` | [L681–716、747–828](https://chromium.googlesource.com/chromium/src/+/861389936bf33ea77529ee5dcc0605e68f6bb620/third_party/blink/renderer/platform/audio/audio_destination.cc#681) | 有 request/render/FIFO frames 與 delay 資訊；以實際 `render_quantum_frames_` 迴圈，可處理多個 quantum，範圍含 graph、resampler、FIFO push。不能假定和輸出 callback 同 thread。 |
| `webaudio`／`RealtimeAudioDestinationHandler::Render` | [L216–298](https://chromium.googlesource.com/chromium/src/+/861389936bf33ea77529ee5dcc0605e68f6bb620/third_party/blink/renderer/modules/webaudio/realtime_audio_destination_handler.cc#216) | context graph render inclusive 範圍，含 pre/post/deferred tasks、graph/automatic pulls、copy/silence、audibility/volume、clock 更新；不能直接命名「純 native DSP」。args 僅 frames/delay，沒有 context UUID。 |
| `disabled-by-default-webaudio.audionode`／`AudioHandler::ProcessIfNecessary` | [L298–339](https://chromium.googlesource.com/chromium/src/+/861389936bf33ea77529ee5dcc0605e68f6bb620/third_party/blink/renderer/modules/webaudio/audio_handler.cc#298) | args 含 handler `this` 與 node type；scope 包住 cached 判斷及 upstream pull，巢狀範圍重疊。不能累加為獨占 node CPU。 |
| 同上／`AudioWorkletHandler::Process` | [L114–118](https://chromium.googlesource.com/chromium/src/+/861389936bf33ea77529ee5dcc0605e68f6bb620/third_party/blink/renderer/modules/webaudio/audio_worklet_handler.cc#114) | Worklet handler wrapper；TRACE_EVENT0，未帶 processor name／node UUID。 |
| `disabled-by-default-audio-worklet`／`AudioWorkletProcessor::Process` | [L472–477](https://chromium.googlesource.com/chromium/src/+/861389936bf33ea77529ee5dcc0605e68f6bb620/third_party/blink/renderer/modules/webaudio/audio_worklet_processor.cc#472) | 完整 processor wrapper；TRACE_EVENT0，未帶 processor name／node UUID。 |
| 同上／`AudioWorkletProcessor::Process (author script execution)` | [L563–569](https://chromium.googlesource.com/chromium/src/+/861389936bf33ea77529ee5dcc0605e68f6bb620/third_party/blink/renderer/modules/webaudio/audio_worklet_processor.cc#563) | 較窄的作者 script 執行，不能代表全部 Worklet 包裝成本；亦無 processor identity。 |

Inspector graph 事件可以提供 node/context UUID、拓樸，及 context 的 sampleRate、callbackBufferSize、renderQuantumSize；UUID 是另外產生的識別字。已查 native render 事件未帶這些 UUID，graph 事件未提供 handler address。已查 `SetHandler` 的 node/context/handler pointer 對應只在 `DEBUG_AUDIONODE_REFERENCES` 的 stderr 區塊。因此不能僅憑 event name／graph UUID，把 handler `this` 或 Worklet 範圍歸屬到本案 PCM tap；這不是宣稱所有其他映射機制都不可行。[Inspector L153–164](https://chromium.googlesource.com/chromium/src/+/861389936bf33ea77529ee5dcc0605e68f6bb620/third_party/blink/renderer/modules/webaudio/inspector_web_audio_agent.cc#153)；[context metadata L238–248](https://chromium.googlesource.com/chromium/src/+/861389936bf33ea77529ee5dcc0605e68f6bb620/third_party/blink/renderer/modules/webaudio/inspector_web_audio_agent.cc#238)；[UUID L12–16](https://chromium.googlesource.com/chromium/src/+/861389936bf33ea77529ee5dcc0605e68f6bb620/third_party/blink/renderer/modules/webaudio/inspector_helper_mixin.cc#12)；[SetHandler L95–110](https://chromium.googlesource.com/chromium/src/+/861389936bf33ea77529ee5dcc0605e68f6bb620/third_party/blink/renderer/modules/webaudio/audio_node.cc#95)

本地 attribution fixture 的 `reflection-performance-pcm-probe-v1` 是額外 Worklet probe branch（`tests/browser/performance-audio-attribution-v1.mjs:389–402`）。原生 Worklet 事件不自動附上此 JS processor name。獨立且可驗證的單一 Worklet fixture 可協助建立身分，但正式多節點 graph 仍需證據；probe on/off 差值只能估整體擾動，不能自行等同 tap 獨占 CPU 或 native-only DSP。

## 後續可量測接點與必需證據

可另建版本化 diagnostic method，候選類別為 `webaudio`、`disabled-by-default-webaudio.audionode`、`disabled-by-default-audio-worklet`。**本次未更改任何正式 category 或 qualification registry。** 目前 `performance-profile-v3.mjs:783–798` 的正式 category 列表未包含這些 WebAudio 類別，不能推稱原 trace 已覆蓋音訊 render。

真正量測前須具備：

1. exclusive machine lease 與明確 method 版本；保留原 600 秒 wall workload、voices、paths、geometry、capture 負載、資格、門檻及原拒收。短 trace 不冒作正式 600 秒證據。
2. browser/revision、executable path+SHA、hardware/OS/architecture、實際 device/rate/buffer/quantum、source archive、context/document lifetime 與 exporter pins。不能由事件名稱推定 48kHz／128 frames。
3. 全 raw stream、loss／closure、事件 category/name/schema、原 ordinal、pid/tid 與 context/graph 歸屬；精確量測窗與完成 scope，未知／未完成事件保留。不能剪 trace 換 PASS。
4. 實際 `tts/tdur`、有限非負值、所需 endpoints 與 CPU coverage。列 sample／missing／unfinished 數量、量化與單位；source defaults 不能使 coverage 自動完整。
5. 先報已驗證的 inclusive output callback／context render／Worklet scope；若無獨立且完整分離證據，不能把其值改名 native-exclusive DSP。父子跨 thread 不做任意相減。
6. 同條件 probe-free／probe-on 比較，量化 tracing 與 PCM tap 的擾動；這次來源研究沒有量到 overhead。

目前產品 `src/audio/diagnostics.ts:88–92,318–322` 與 attribution 輸出的 `nativeDspCpuMs` 保持 null。若之後能實際量到 inclusive render CPU，應先用精確的新 scope 名稱輸出，再由獨立驗證決定是否滿足 native DSP 欄位語義；不能先填值後補證。

## 來源 pins 與作業範圍

以下 SHA-256 全為官方 Gitiles `format=TEXT` 正常 TLS 取得並 base64 decode 後的 source bytes；不是 HTML／base64 response hash。僅保存來源身分、行號與本報告自己的改寫，未將官方全文入庫。

| ID／官方來源 | bytes | decoded source SHA-256 |
|---|---:|---|
| [deps](https://chromium.googlesource.com/chromium/src/+/861389936bf33ea77529ee5dcc0605e68f6bb620/DEPS) | 192396 | `8778ffaa9a30b9e825b291978804c6c2e55a3ae829ff387b025592ffb9090e8e` |
| [trace-config](https://chromium.googlesource.com/chromium/src/+/861389936bf33ea77529ee5dcc0605e68f6bb620/base/trace_event/trace_config.cc) | 28773 | `285160223ccfed0b3226d2d475d091f7a785cf463fda36e63a38ae7b5daa733c` |
| [config](https://chromium.googlesource.com/chromium/src/+/861389936bf33ea77529ee5dcc0605e68f6bb620/services/tracing/public/cpp/perfetto/perfetto_config.cc) | 15307 | `0ed33bef6db1d5d665d78dc6ccb78f242424f461bac9721565da8560ee7e7f62` |
| [track-config](https://chromium.googlesource.com/external/github.com/google/perfetto/+/403906f4adfbf287a02e5546f8430dcc9d56b649/protos/perfetto/config/track_event/track_event_config.proto) | 3880 | `f5b6e905c4de95510d078444691f9698ab1f49d39dccd552129b545df16da256` |
| [internal](https://chromium.googlesource.com/external/github.com/google/perfetto/+/403906f4adfbf287a02e5546f8430dcc9d56b649/src/tracing/internal/track_event_internal.cc) | 25078 | `c2939b1663639427d51fd8f940490cce478f9c21e691810192dbf05e57195fde` |
| [time](https://chromium.googlesource.com/external/github.com/google/perfetto/+/403906f4adfbf287a02e5546f8430dcc9d56b649/src/base/time.cc) | 8279 | `e0f427cb33997802685f58b813c2648cbd70ac009c7fcd21f81d8841ed37d0c6` |
| [export](https://chromium.googlesource.com/external/github.com/google/perfetto/+/403906f4adfbf287a02e5546f8430dcc9d56b649/src/trace_processor/export_json.cc) | 66822 | `dc3a3b53cc2df3cd66be8b331b805d31331c2a8dbcf42e3f58d6fe8a05377667` |
| [track-macro](https://chromium.googlesource.com/external/github.com/google/perfetto/+/403906f4adfbf287a02e5546f8430dcc9d56b649/include/perfetto/tracing/track_event.h) | 19991 | `0eefec965318a2208af955531eb84b7c3e2f321401ea3098f5bf98dcf678d3a8` |
| [destination](https://chromium.googlesource.com/chromium/src/+/861389936bf33ea77529ee5dcc0605e68f6bb620/third_party/blink/renderer/platform/audio/audio_destination.cc) | 35592 | `0d22eca8967d74437ed409181ccb5b4ec98b0c2dd6b0ddb52a86f4892194d26f` |
| [context-render](https://chromium.googlesource.com/chromium/src/+/861389936bf33ea77529ee5dcc0605e68f6bb620/third_party/blink/renderer/modules/webaudio/realtime_audio_destination_handler.cc) | 22572 | `736ffc8352d6e47ee866f0cb02616aac235a078a9b3f9802458d4b96c90ac9af` |
| [node-render](https://chromium.googlesource.com/chromium/src/+/861389936bf33ea77529ee5dcc0605e68f6bb620/third_party/blink/renderer/modules/webaudio/audio_handler.cc) | 21247 | `7b1d1f545444db1bf51a701b6134ec67d2a25f2c496336518e5fc7fd4ba337e1` |
| [worklet-handler](https://chromium.googlesource.com/chromium/src/+/861389936bf33ea77529ee5dcc0605e68f6bb620/third_party/blink/renderer/modules/webaudio/audio_worklet_handler.cc) | 12821 | `cf2da22d88fbaf7cfc90297a5268cfcbe9452f07f05b3afed18b0fa1df42e38c` |
| [worklet-process](https://chromium.googlesource.com/chromium/src/+/861389936bf33ea77529ee5dcc0605e68f6bb620/third_party/blink/renderer/modules/webaudio/audio_worklet_processor.cc) | 25632 | `aa24eba9a0121cca6e98b9f7e25e8fb91b9b03123d9f6d70031b0af406d04c0b` |
| [audio-context](https://chromium.googlesource.com/chromium/src/+/861389936bf33ea77529ee5dcc0605e68f6bb620/third_party/blink/renderer/modules/webaudio/audio_context.cc) | 91806 | `980f46243fb40b306fb49ef18408716ad65723b6adf39ed801c0f30d0c266ad3` |
| [inspector](https://chromium.googlesource.com/chromium/src/+/861389936bf33ea77529ee5dcc0605e68f6bb620/third_party/blink/renderer/modules/webaudio/inspector_web_audio_agent.cc) | 8980 | `eaec841fc4ea0053ad7e8ec34377bb37a974b69433d5a008483c65e46f1fef1c` |
| [inspector-uuid](https://chromium.googlesource.com/chromium/src/+/861389936bf33ea77529ee5dcc0605e68f6bb620/third_party/blink/renderer/modules/webaudio/inspector_helper_mixin.cc) | 754 | `0522f0efee81f650b901905e01c44fba683d893ec170de440b4837e8a4ab5980` |
| [node-identity](https://chromium.googlesource.com/chromium/src/+/861389936bf33ea77529ee5dcc0605e68f6bb620/third_party/blink/renderer/modules/webaudio/audio_node.cc) | 22717 | `c158acb7bb03920f2fc24e156de13ef36e8bc3b298b36fd8579b5cdecbfe9e53` |

本次僅新增本 MD 與 JSON。未跑 Node、unit、typecheck、build、browser、benchmark 或硬體量測；未改 product source、frozen27、正式 categories、registry 或 shared memory。來源能力不等於 shipped binary 等價、實際 CPU 取樣、音訊送達、hardware hearing 或正式資格。
