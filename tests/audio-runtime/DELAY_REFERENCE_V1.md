# Native Delay Reference v1

狀態：**PREPARED／NATIVE NOT RUN**。這是版本獨立的診斷參考，不是修訂原25項驗收。原 Firefox 157.0 能量 **FAIL**、原 `<1e-5` 門檻，以及 WebKit Windows build 缺少 API 的證據均保留；產品程式與原 suite 不變。本計畫依 `docs/09-agents/VALIDATION_POLICY.md`，根因或 oracle 缺陷需有新原生證據與獨立 review 後才能下結論。

原證據：`artifacts/v1/audio-cross-engine-run-20261027053729781/firefox.baseline.json`。48kHz、unit impulse 在 emission0.05s後第480sample；direct/reflection分別為0.025s／gain0.5、0.075s／gain0.25，中心 equalpower panning。實測峰值為4080／0.3535533845424652及6480／0.17673353850841522；能量0.31246948243551215，理想0.3125。原 artifact 沒有逐 sample PCM，不能宣稱已觀測6481的分數延遲 tail。

單頻帶均勻 gain 會讓 `src/audio/band-filter.ts` 回傳 null，`routes.ts` 因此使用單 tap `[1]`、`normalize=false` 的 identity convolver，gain僅套一次；原 impulse 不在 attack/release或路徑 crossfade 區間。現有資料不支持非均勻 FIR／自動 normalize 是根因。也沒有16-bit PCM或 privacy/dither設定的實證，不能只看能量差就歸因。

更強但尚待 native reference 確認的假說，是原生 DelayNode的Float32秒→frame換算及雙 sample線性插值：

```js
const f = Math.fround;
const c = f(Math.SQRT1_2);
const d = f(f(0.075) * 48000) - 3600; // 1/4096
const a = f(0.5 * c);
const b = f(f(0.25 * (1 - d)) * c);
const s = f(f(0.25 * d) * c);
const E = 2 * a * a + 2 * b * b + 2 * s * s;
```

`a`及`b`與已存峰值逐值相同；`E=0.3124694824355657`，與原實測差5.35682609381638e-14。每聲道6481的`s=0.0000431583721365314`是**預測**。同樣Float32換算，0.025s得到1200整數frames，0.075s得到3600.000244140625frames，0.125s是二進位可精確表示的控制組。

Web Audio 的AudioParam排程值是float，Convolver `normalize=false`使用原IR。Mozilla所索引的DelayNode實作以float計算delayFrames，DelayBuffer對分數位置混合相鄰兩frames；這些原始來源支持模型，但索引revision尚未對應到快取Firefox binary的實際build revision，不能當成執行證明。[W3C AudioParam](https://www.w3.org/TR/2021/REC-webaudio-20210617/#dom-audioparam-setvalueattime)、[W3C Convolver](https://www.w3.org/TR/2021/REC-webaudio-20210617/#dom-convolvernode-normalize)、[Mozilla DelayNode](https://searchfox.org/firefox-main/source/dom/media/webaudio/DelayNode.cpp#104)、[Mozilla DelayBuffer](https://raw.githubusercontent.com/mozilla-firefox/firefox/main/dom/media/webaudio/DelayBuffer.cpp)。

預先固定單一Firefox原生batch，共9個圖；不改prefs、不挑最佳重跑、不修改原資料或門檻：

| 圖                       | Delay          | Unit Convolver         | Gain      |
| ------------------------ | -------------- | ---------------------- | --------- |
| gain-only-zero           | 無             | 無                     | 0.25      |
| convolver-unit-zero      | 無             | `[1]`, normalize=false | 0.25      |
| gain-only-delay-025      | 0.025s         | 無                     | 0.25      |
| convolver-unit-delay-025 | 0.025s         | 同上                   | 0.25      |
| gain-only-delay-075      | 0.075s         | 無                     | 0.25      |
| convolver-unit-delay-075 | 0.075s         | 同上                   | 0.25      |
| gain-only-delay-125      | 0.125s         | 無                     | 0.25      |
| convolver-unit-delay-125 | 0.125s         | 同上                   | 0.25      |
| parallel-original-paths  | 0.025s與0.075s | 兩路同上               | 0.5與0.25 |

全部圖使用相同中心 equalpower Panner（position0,0,-1、rolloff0），避免mono直接送stereo destination的upmix能量差；source、取樣率與輸出長度固定。每圖保存完整2×12000 Float32 PCM、native AudioParam／IR／panner readback、arrival相鄰samples、總能量及native context資料。總output PCM864000bytes，不建立live AudioContext或硬體輸出。

獨立Float32模型不匯入產品DSP；每圖開始渲染前先建立prediction。預先固定`maxSampleAbsoluteError <= 1e-7`僅比較新模型與原生PCM，標示diagnostic，不能取代原`energy error <1e-5`驗收。若無Delay／identity-convolver對照正常、0.025s／0.125s維持單脈衝，而0.075s在有無Convolver都出現預測雙samples，且雙路native圖重現原數值，才有足夠依據把根因限縮到該Windows快取Firefox版本的native Delay精度／插值相容性。若不符合，保存反例與rawPCM，不改原門檻或產品程式。

僅在Root確認English browser slot結束並給GO後執行：

```powershell
$env:PLAYWRIGHT_BROWSERS_PATH = 'C:\Users\kevin\AppData\Local\ms-playwright'
node tests/audio-runtime/run-delay-reference-v1.mjs --run
```

預設`--prepare`不啟動server/browser；actual run僅使用自有random-port Vite／無App或HMR的isolated頁面及Firefox。準備／導入／執行／清理皆有限deadline，before/after hashes涵蓋原15份檔案與新reference。回傳`REFERENCE_MEASURED`只表示取得該獨立參考資料，沒有原25項PASS語義。失敗時保留例外／PCM與cleanup狀態；人工聽測、裝置延遲、AudioWorklet、長時間capacity及Meta API仍不在範圍內。
