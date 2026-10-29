# 聲學參數至音訊處理模型

查核：2026-10-26。這是前期設計與數學規格；沒有正式 AudioWorklet、native mixer 或聽覺合格結果。來源代號見 [PAPER_INDEX](../papers/PAPER_INDEX.md)。

## 1. RIR、BRIR、HRTF 的角色

LTI 場景可寫 `y[n]=Σ h[k]x[n-k]`。RIR 是聲源至接收點的 room response；BRIR 是兩耳 response，已含房間與頭部方向效應；HRIR 是 HRTF 的時間域表示。未確認內容前，不能將 HRTF 再套一次到已經包含頭部的 BRIR。SOFA 是資料與座標 metadata 的交換格式，不代表資料免費、個人化、無響室或符合特定頻率解析度；逐資料集檢查。[P06 §2–4；資料集的個別來源見 DATASET_CATALOG]

早期鏡面路徑以 `pathId, delaySeconds, arrivalDirection, departureDirection, bandResponse, provenance` 表達，後期混響可為 decay / direction / energy parameters 或完整 IR。沒有 path export 的 backend 只能傳實際可取得的表示；不能由 late-reverb 參數虛構幾條科學上可驗證的 ray。

每個 renderer 明確宣告 source input 正規化、pressure/energy domain、是否已含距離衰減、directivity、air absorption、HRTF、propagation delay。相同效果只能有一個責任模組，避免重複衰減或雙重空間化。

## 2. 三種不同的延遲

```text
propagationDelay = physicalPathLength / speedOfSound
algorithmicDelay = fractionalFilterGroupDelay + convolutionSchedulingDelay + ...
deviceLatency = audioBuffering + driver + DAC (+ downstream device processing)
```

它們分欄記錄；若要 total perceived latency，還要處理跨 clock 的 event scheduling。裝置回報值未必涵蓋所有耳機 processing。不可為了呈現漂亮的 impulse arrival，把 propagation 與 compensated DSP latency 混為零。pyroomacoustics 生成 RIR 的 fractional-delay filter 有全域 delay（文件為 `frac_delay_length // 2` samples）；V3 比較需報告移除量，不能把該延遲當房間多出的距離 [T03–T04；DSP-005]。

## 3. Fractional delay 與 Doppler

延遲通常不是整數 sample：`D=τ fs=N+μ`，`0≤μ<1`。最簡單的獨立插值契約：

```text
y[n] = (1-μ) x[n-N] + μ x[n-N-1]
H(e^jω) = e^(-jωN) [(1-μ)+μe^(-jω)]
```

由式可知 linear interpolation 在高頻不保幅；此結論可直接計算，不借未讀的 P11 宣稱某誤差數字。windowed-sinc FIR 提高帶內準確度但增加長度與 delay；all-pass 可保靜態幅度但 group delay 有頻率相依，時變係數的狀態處理還需測試。P11 是方法入口，目前只核實書目，不能當作特定實作性能已驗證。

`delay(t)` 改變會改變讀取速度與音高；對 retarded source buffer 的讀取率應符合 `dte/dtr`（ACOUSTIC_THEORY §7）。跳改 delay 可能 click；大幅度變更也可能變成不想要的 pitch glide。兩條固定 delay line crossfade 與連續 delay modulation 具有不同聲音結果，應依用途分開模式並用 sine sweep／impulse／moving source fixtures 驗證。History underrun 不能讀未初始化記憶體。

## 4. Early reflections、卷積與時變 IR

稀疏低階 early paths 可用持續 delay taps＋每頻帶濾波＋方向渲染。完整 RIR 可用 partitioned FFT convolution；IR 長度、partition 大小與更新率必須列入 CPU／memory／latency budget。這是設計取捨，尚未測得本機 capacity。

P06 §2 提及兩個卷積輸出並行後做時間域插值；此法避免直接突換，但切換期間成本增加。若 incoming IR 使用不同 time-zero、filter delay 或 normalization，crossfade 仍會產生重複 transient／梳狀濾波。因此應先對齊 acoustic time、保留 filter state，並測試 correlated signals。[DSP-004]

採樣率低的 ray-energy histograms 可估 RT／DRR 驅動晚期效果，P06 §4 提供例子；這些能量統計沒有保留 sample 級相位，不能當壓力 IR 精確卷積。其平滑可能造成快速場景反應變慢；P06 §8 明確列出細部 IR、低頻、方向解析度與 temporal lag 限制。Reflection Lab 可採其分層概念，不能把論文的硬體數字寫成專案效能。

## 5. Schroeder 與 FDN

Schroeder 的 comb／all-pass 結構與衰減關係由 P07 正文核實；all-pass 會增加 echo density，不代表它預測實際牆面的每次反射。單純人工混響應標成 `EstimatedLateReverb`。

基本 FDN [P10 §II，DSP-003]：

```text
s_i[n+m_i] = Σ_j A_ij s_j[n] + b_i x[n]
y[n] = Σ_i c_i s_i[n] + d x[n]
```

`m_i` 是整數 delay length。unitary／real orthogonal `A` 可構成對任意正整數延遲的無損原型；P10 也給出更一般條件與反例。**只有 `A` 的 eigenvalues 在單位圓內，不足以保證任意延遲 FDN 穩定**。不要只檢查矩陣 eigenvalues 就宣告通過。

對欲達到指數壓力包絡的 `T60(f)>0`，每條回授 delay 的簡化衰減目標：

```text
g_i(f) = 10^[-3 m_i / (fs T60(f))]
```

這可由「每 `T60` 秒壓力降低 `10^-3`」獨立推得，P07/P06 亦有對應衰減關係。頻率相依 attenuation filter 要保持被動與穩定；time-varying reverb、modulated delays、filter coefficient interpolation 另有穩定性問題。無損原型可持續響，不等於 BIBO stability。應做長 impulse tail、極端 T60、零輸入、參數跳變、NaN／energy-growth 測試。

P09 的摘要支持將衰減控制與 reverberator structure 分離，但未讀全文；本案 FDN 方程與穩定性只以已讀 P10 及獨立數學為依據。材質吸收不能單靠一個全室平均值重建特定 path 的相位與方向。

## 6. EDC 與 room metrics 的計算契約

Schroeder 反向能量積分法 P08 是 EDC 的歷史／理論來源；本次只能讀可檢索部分正文。下列是本專案明訂的離散 metric contract，尚不是取得完整 S05 後的標準量測認證：

```text
E[n] = Σ_(k=n)^(N-1) h[k]^2
EDC_dB[n] = 10 log10(E[n]/E[0])
T60_est = -60 / fittedSlope_dB_per_second
EDT: fit 0..-10 dB, extrapolate to -60 dB
T20: fit -5..-25 dB, extrapolate to -60 dB
T30: fit -5..-35 dB, extrapolate to -60 dB
```

先以明確頻帶濾波，再計算 EDC；保留濾波器設計、前後 ringing、tail padding、sample rate、noise floor、noise compensation 與 fitting window [DSP-001–002]。零訊號、短 IR、尚未衰減至所需區間、飽和錄音、低 SNR 都應產生 `INSUFFICIENT_DATA`；不能強行給 RT。回歸輸出 slope、範圍、樣本數、residual／fit quality，雙斜率衰減不能只報一個看似精確的 T60。

Clarity 以**相對 direct arrival time 的**窗口，`t0` 需先定義：

```text
C_T = 10 log10( Σ_(t0≤t<t0+T) h(t)^2 / Σ_(t≥t0+T) h(t)^2 )
C50: T=0.050 s; C80: T=0.080 s
DRR = 10 log10(E_direct / E_reverberant)
```

DRR 的 direct window 並無對任何輸入都適用的自動選法；必須標出 window 長度與到達點、是否含地面近反射、兩耳／單耳、頻帶。窗口邊界的 sample rounding 亦要固定。零分母回傳顯式 infinity / invalid，不能默默 clamp 後讓資料看似有限。

LTI metrics 只對固定場景／短時間 stationary 假設成立。移動 Source 的單一長 RIR 不能同時代表整段運動；按 snapshot／窗口比較，或採明確的 time-varying model。A/B 必須使用同一運動 trace、source signal、random seeds、metric settings，且將模型差異與量測／隨機差異分開。

## 7. 連續 Source 與 Collision Source

連續音訊保有獨立 playback phase，物理 body mode／抓取／投擲只更新位置與速度。CollisionEvent 在接觸點建立短音效 source，可與同一物體的 loop 同時存在。先產生 dry sound，後通過同一 room propagation／spatial rendering contract，避免 impact 預先混響樣本又套一次房間。

physics event 是 simulation clock；DSP 是 sample clock。控制更新與音訊 block 之間使用帶 timestamp、版本的有界資料交接，audio thread 不等待 solver。缺更新使用最後有效參數並依顯式 stale policy 處理；錯誤、queue overflow、late event、source removal 要有可記錄且有界的 fallback。這些是工程安全需求，尚未完成 runtime 驗證。

## 8. 最小 V2 計畫

| Fixture | Oracle | 尚須確認的誤差／行為 |
|---|---|---|
| Integer／fractional impulse delay | 已知 delay 與獨立插值式 | arrival、amplitude／phase、DSP compensation |
| Static sine＋moving source | 解析 retarded 匀速 Doppler | 頻率估計誤差、重複 pitch shift、buffer bounds |
| Exponential synthetic tail | 已知衰減率 | EDC、EDT/T20/T30 fitting；只驗證 metric 演算法 |
| Two analytic taps | 已知能量與時間 | C50/C80 邊界、DRR window、zero denominator |
| FDN impulse | contractivity／pole 分析及長時間輸出 | NaN、無界增長、finite precision、切參數 |
| Path birth/death、ranking swap | 同一 stable path identity | click、gain discontinuity、tail truncation、CPU upper bound |
| Continuous loop＋impact | 已知 source timeline | loop phase 不中斷、impact 在接觸點、事件去重 |

以上是驗收規格。部分數學參考與 synthetic EDC／RT 已由隔離 kernel 測試，紀錄在 `benchmarks/results/validation-local.json`，ledger 的 `validation_evidence` 連結對應 fixtures；尚未執行產品音訊、fractional-delay renderer、FDN、crossfade 或聽測。文獻存在及 synthetic metric 通過，都不等於完整 V2 音訊系統已通過。
