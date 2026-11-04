# Runtime audio resource policy：限定來源審查

結論為 NO_P1_P2_REMAINING_SOURCE_REVIEW_ONLY。此輪只讀 src/app/runtime.ts 相對 eb45d19aee08a3b68a768c82af4fa192ea0b26fc 的限定 diff、實際 AudioEngine／diagnostics 來源及已有收據。未執行 Node、測試、typecheck、format／lint、build 或 browser；未修改產品或測試。完整來源 SHA、原始 fixture、TAP 雜湊與本次觀測 HEAD 見同名 JSON。

## 選項與原配置

新增 audioResourcePolicy 只接受 false，或必填五個／選填兩個有限數字的原生 policy record。外層選項及 policy 欄位以 own descriptor 讀取，accessor 不會被當成一般取值執行；symbol、unknown key（含不可列舉的 budget／context）、array、class／custom prototype 會拒絕。Object.prototype 與 null prototype 的純資料 record 可用。保留 required 欄位存在性、數字 primitive／finite 與 validateNativeVoicePolicy 的範圍驗證，之後只將七個 scalar 的自有副本凍結保存。

驗證是 constructor 第一個動作，早於 RecordingEvaluationClient、AcousticService 與其他 owner 的建立。若 constructor 拒絕，原 create 的 app?dispose:world.dispose catch 保持，可釋放已建立的 Rapier owner；此輪未新增測試專用 factory 或產品 API。

省略或 explicit undefined 沿用原行為：enableAudio 不加 virtualization key；explicit false 則真正傳 false。原 bufferPreset、monitorGain、headroomGain、outputSafetyClip 四個 allocation option 保留，只條件加入 policy 值，沒有 spread 任意 AudioEngineConfiguration，也沒有覆蓋 budget、context、source content、limiter 或 output tap。原 default budget 全13值及 nativeReference content 語義維持；聲學仍是原 clone／cache-off 路徑，本次未加聲學選項。

## 兩個公開端點的真成本

getAudioResourceObservation 是 ACTIVE shared benchmark／control endpoint，並非 passive cache 或零成本 query。它在 disposed／未分配 engine 時先回 null；有 engine 時讀取真 getTelemetry 與 getNativeResourceSnapshot，再 structuredClone 回傳 DTO，不外洩 engine／native objects 或可修改的原 budget。

getTelemetry 會遍歷既有 voices／routes，更新 maximumFilterDelay 歷史，再呼 diagnostics.snapshot；snapshot 可能讀 clock 並依原頻率輪詢 native playbackStats。resource snapshot 會遍歷 bounded source owner／role 並以 native currentTime 判 pending。關閉 diagnostics 只會停止診斷輪詢，不會讓這些遍歷、clock／metadata 存取或 DTO 配置消失。on／off 若使用端點，須在方法中列為共同且有成本的控制端點；不能冒稱 TopMonitor 被動 getter。

setAudioDiagnosticsEnabled 嚴格要求 boolean primitive；disposed 或尚無 engine 會明確拒絕，不建立 engine／context。實際 engine setter 只切換 observer 狀態並重設診斷 baseline，沒有變更 policy／voices／routes／capacity。disposed getter 的先行 guard 不會觸碰已保留 native context。第二位獨立來源 reader 核對兩端點與實際 getter 副作用，亦未發現 P1／P2。

## Fixture 修正與真 RED／GREEN 分層

原 fixture v1 SHA4556f53f0a24941f9fd474f8a193ae8b4f888fe9545a197f252af8a53e7b40ea／12248B 完整保存，原22 FAIL不刪除。它把 bufferPreset 錯誤預期為 interactive，是測試作者的假設，不能宣稱22項全為產品缺陷。原 src/audio/buffer-preset.ts 自始 default playback；本 Node setup 未設 window／audio storage，RuntimeOptions.storage 僅供 ProjectStore，不是 audio preference 注入。monitorGain=1、headroom=0.5、安全上限 true、simulated monitoring 與原13項 budget 則已由來源交叉確認。

獨立核對 v2 frozen copy 確實只有該一個 assertion 的 interactive→playback 替換，產品預設未改。版本化更正收據保留撰寫當時的 pending 狀態；後續實際 TAP 將各階段清楚分開：

| 階段 | tests | pass | fail | 原始 TAP |
| --- | ---: | ---: | ---: | --- |
| v1 原 fixture | 22 | 0 | 22 | runtime-performance-options-red-r1.tap |
| v2 更正 fixture、產品尚缺功能 | 22 | 2 | 20 | runtime-performance-options-fixture-v2-red-r1.tap |
| 加入已授權的3個公開端點案例 | 25 | 2 | 23 | runtime-performance-options-endpoints-red-r1.tap |
| 限定產品實作後 | 25 | 25 | 0 | runtime-performance-options-green-r1.tap |

25項 GREEN 的 TAP 實際 duration=1750.8608ms，由 parent 執行；本 reviewer 僅讀回，沒有重跑。這些測試使用真 Runtime／AudioEngine 搭配既有 control graph fake context，支持選項、安全邊界與控制圖資料行為，不證明 PCM、DSP CPU、native hardware rendering、裝置輸出、聽感或正式600秒。

## 範圍限制

這是新增 runtime source，不能將原03d665 native semantic run／凍結44 inputs 的證據範圍回填到本次新程式。後續 source freeze、原負載 before／after、20秒 wiring、PCM、600秒與外部硬體門檻仍各自取真資料；本審查不改任何既有 FAIL 或整體第一版狀態。
