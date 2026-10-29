# 正式音訊 Runtime 驗證

本目錄測試 `src/audio/` 的正式 Web Audio renderer；不是研究 spike。產品整合、幾何求解與人工聽測各自有驗收，這裡的通過不能代替它們。

Chromium 原始 native 結果為 [native-audio-bank-verified-20261027.json](native-audio-bank-verified-20261027.json)。它在 Chromium 的獨立 HTML harness 執行，沒有掛載產品 App 或 Vite HMR client，六組共 25 個檢查均通過。原始 tool JSON bytes 另存同名 `.raw`；排版後 JSON 的資料相同。各輸入、測試程式與結果 SHA-256 見 `audio-validation-manifest-20261027.json`。

新增的原樣跨引擎執行整體 **FAIL**：Firefox157.0為8 PASS／1能量FAIL／9 API阻擋／7 aggregate未執行；Windows快取WebKit27.2為25 API阻擋。Firefox缺少測試用Offline suspend不能推論產品live Pause不支援；WebKit的觀測也不代表所有Safari平台。[跨引擎原始報告](../../artifacts/v1/audio-cross-engine-run-20261027053729781/verification.json)、[執行與分類說明](CROSS_ENGINE.md)。

獨立版本的9圖原生參考已保存864000bytes完整PCM，確認此Firefox build的0.075s native Delay行為吻合事先固定的Float32分數延遲插值模型，並重現原能量；原`<1e-5`驗收仍是 **FAIL**。新`1e-7`僅用於模型逐sample診斷，沒有替換舊oracle或放寬門檻。[相容性與限制報告](../../artifacts/v1/audio-delay-reference-v1-run-20261027054851146/compatibility-summary.md)、[完整PCM](archive://14da3d7fdcdb5dc73d69b6420238689e22f3846e/f04028c02f6bb4f2eae35c5c31c7bb8ed3274467)、[執行前v1參考計畫](DELAY_REFERENCE_V1.md)。

Node 控制圖、排程、記憶體及負例結果見 [node-final-20261027.tap](node-final-20261027.tap)。FakeAudioContext 只記錄控制與連線，從未作為 native DSP 通過證據。新增的 pause、late reverb、asset、WAV 及 cursor regression 另由隔離代理實作與獨立執行。

可重現命令：

```powershell
node --import tsx --test tests/audio-runtime/*.test.ts
$audioFiles = @(rg --files src/audio tests/audio-runtime -g '*.ts')
node node_modules/typescript/bin/tsc --noEmit --strict --noUncheckedIndexedAccess --exactOptionalPropertyTypes --skipLibCheck --target ES2022 --module NodeNext --moduleResolution NodeNext --lib ES2022,DOM,DOM.Iterable --types node @audioFiles
node node_modules/eslint/bin/eslint.js src/audio tests/audio-runtime
node node_modules/prettier/bin/prettier.cjs --check src/audio tests/audio-runtime
```

Native harness 需同源載入 `browser.ts`、`native-pause.ts`、`native-reverb.ts`、`native-continuity.ts`、`native-restore.ts`、`native-wave.ts` 的 exported validation 函式；使用真 OfflineAudioContext，以及一項真 AudioContext 時鐘檢查。測試用的衝擊、ramp、sine、WAV 與合成 IR 均為原創程序內容，沒有第三方音檔或 codec。

已確認的範圍：

- Direct／early 每路徑只套一次 absolute delay、頻帶壓力增益與方向渲染；Panner distance rolloff 關閉。literal path fixtures 只驗 renderer，不聲稱它們來自幾何 solver。
- Pause 保持 AudioContext 運作。logical source cursor 保存於 epoch 映射的 pause tick；20 ms 只定義淡出及已聽 cutoff，不會加進 logical age。`pauseClockSkewSeconds` 另外記 actual context time 與 logical 映射時間差。
- Resume 保留 generator 游標，按每條路徑重建尚未到達的片段；未來發聲只排一次。原 synthetic late convolution tail 在邊界截斷，reconstructed early segments 不再重複送 late bus。
- `getVoiceCursor(instanceId, simulationTimeSeconds)` 回傳 epoch 映射與有界 authored pitch ramp 積分得到的 source 秒，排除 sample authored startOffset；它不是硬體讀取游標。`restoreVoiceAtCursor` 只加一次 authored offset，保留未到達的 propagation pipeline，拒絕重複、stale frame 與超額恢復。
- Late reverb 為 **Synthetic／perceptual approximation**。原創 mono IR 沒有 direct，前 30 ms 為零，採明示 unit-energy normalization；Convolver.normalize=false。IR 更新先 prime 30 ms，再以 audio clock crossfade 20 ms。send 使用真正已提供 solver frame 的最早有效路徑，不新增 solver rays 或房間 RT60 主張。
- Voice、source、frame cache、path、late send、IR PCM、asset 數量、decoded PCM、decode concurrency、pending arrival 與 restore dedup 各自有上限；完成／drain／dispose 清理對應資源。drain 保留 decoded assets 與 context。
- 匯入限 uncompressed RIFF/WAVE PCM8/16/24/32 與 finite normalized float32（[-1,1]）。先驗 exact RIFF size、最多 128 chunks、單一 fmt/data、alignment、channels、sample rate、duration，以及 context 重採樣後的 PCM reservation，再呼叫 decodeAudioData。壓縮、WAVE_FORMAT_EXTENSIBLE、多 data、非法及超額輸入會明確拒絕；不包入任意 codec。
- Trusted persistence host 可用 `getAssetBuffer` 取得 PCM、`getAssetBudget` 取得凍結的 budget copy，`getAssetSampleRate` 在尚無 context 時回 null。`replaceAssets` 同步預驗完整 bank 的 IDs／metadata／總量／重複引用，再原子替換；active／retiring／pending／frozen voices、在途 decode 或 builtin generation 均阻止替換。未 enable 時可保存 validated bank，首次 enable 只 attach context 並保留真 PCM，不因此建立硬體裝置。失敗保留舊 bank；clear／dispose 會取消舊 async generation，不能回填新 bank。

驗證層級與限制：

- V1：獨立數值／控制圖／資源及正負案例通過；頻帶 FIR 是有界 approximation，沒有任意 octave 精度主張。
- V2：Chromium上述25個native fixture檢查通過，包含arrival、壓力增益、真HRTF非零／有限輸出、source／path生命週期、IR能量、real WAV decode、pause／seek游標。Firefox／Windows WebKit範圍依上述獨立FAIL／阻擋紀錄，不宣稱跨引擎完整通過。HRTF僅native render sanity，不是個人化或聽感認證。
- V3：此音訊切片未執行獨立 room solver 比對。
- V4：真 native clock 單一案例已觀測；10 分鐘 realtime capacity、裝置 profiling、AudioWorklet underrun 均 **NOT RUN**。
- V5：耳機／人工聽測、裝置 end-to-end latency、SPL 校準與真實房間量測均 **NOT RUN**。

跨 pause／seek 不宣稱波形或 filter state 無縫。未保留完整舊 automation 時，pending history 使用 latest pitch／content／path approximation；不可把三欄 cursor 當完整 sample history。Native decoder 的內部 resident peak 未量測；WAV preflight 限制其輸入與可解碼 frame 數，PCM reservation 代表本 runtime 接受及在途的 PCM 預算。

保留的初期失敗包括 device 啟動前 clock 尚未前進，以及完成 ramp 後缺少新 ramp 起點造成 path death 提早衰減。後者由 native constant-source／path fixture 找出並修正 `smooth` 的 explicit current-time anchor，未放寬 oracle 或能量容差。各引擎／版本以各自artifact及限制為準，不能用Chromium通過或新reference的模型吻合覆蓋Firefox原FAIL。
