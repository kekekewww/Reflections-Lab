# ADR-PERF-07：DSP 圖更新的準備、接納與退役

- 狀態：**PROPOSED／未採納**；2026-11-01。沒有新增 Worklet／DSP backend，或改既有路由、公式、品質與驗收。
- 程式基準：`05d40fd2d52f4b737f6acac61fa00356403c0038`；新 graph-update benchmark／輸出驗證均 **NOT RUN**。
- 依據：[音訊契約](../../02-architecture/AUDIO_RUNTIME.md)、[ADR-015](../../02-architecture/adr/015-client-first-and-render-contract.md)、[DSP 審查](../AUDIO_GRAPH_DSP_REVIEW.md)、[Buffer 審查](../BUFFER_ARCHITECTURE_REVIEW.md)。

## 問題與已實作保護

[band-filter.ts](../../../src/audio/band-filter.ts) 已有精確 response key、normalized kernel cache、layout／transform plan、bounded scratch、private output copy 與 reentrant fallback；不是每次都從零建 FIR。[routes.ts](../../../src/audio/routes.ts) 已按 stable path ID 重用 delay／panner，對 FIR 使用雙 convolver bank、bitwise kernel equality、gain/delay/direction smoothing 與 crossfade admission gate。[LateReverbBus](../../../src/audio/late-reverb.ts) 已有雙 IR bank、預算、priming／crossfade 與單一 coalesced pending settings；不是缺少雙緩衝。

但 cache hit 不代表 graph control 成本為零：仍有 response snapshot/key、copies、AudioBuffer 建立、node control／validation 與 route churn。`AudioEngine.updateFrame` 在主緒 clone frame 並套用所有相關 voices。需要把 kernel 計算、buffer 準備、native graph 控制與 retire 分開量，不能把 FIR 微基準改善直接稱完整 delivery／音訊品質改善。

## 候選決策

先 instrument 現有 prepare／apply／retire 分項，只針對已量到的昂貴部分 spike 「不可變 prepared response＋有界提交」。優先保留現有 exact cache、native routes 與雙 bank，不先全面改 Worklet、粗化 gains 或增加容忍 epsilon。較新 dirty R21 的 target suppression／onset lookahead 另有來源，不能當此 commit 結果或保證收益。

1. Prepare 是純資料工作：固定 bands、gains、sample rate、tap count、model/operator version 與 exact response identity；回傳 owned coefficients、scale、group delay。若 Worker 候選值得測，只傳此資料，不傳 AudioNode／AudioBuffer／context 或 Scene 權威。
2. Apply 在 native graph owner 的 control thread 完成；先驗 runEpoch／scene+geometry revision／source+path ID／response generation，並 reserve incoming bank、routes／bytes。舊 generation 的 prepare completion 只釋放，不改正在發聲的 graph。
3. 連續參數（delay、direction、pressure scale）與昂貴 response replacement 分開排程；不可因 FIR queue 忙就永久凍結方向／delay。只有仍屬同一 identity 的未接納 response 可合併為最新；所有 skipped/coalesced update 計數並可量 age。
4. bank 忙碌時沿用 last complete response 與既有平滑，明示 pending／stale；不覆寫 active／fading coefficients，不建立無界第三、第四個 bank。新增策略不得弱化現行 admission gate 或讓 scale-only update 重建完全相同 kernel。
5. Retire 依 audio clock 的 fade／tail 邊界及 graph reference 完成後 disconnect；wall timer 只負責觸發回收檢查。tail／retiring route 仍占 budget；pause／seek 的 interrupted tail 政策保持，不能聲稱 click-free 已驗。

## 容量、時鐘與取消

準備 queue 分別限 jobs、responses、coefficient bytes、最大 taps／bands；graph 分別限 active／fading／retired routes、late sends、AudioBuffer／IR bytes 與同時 transitions。pool／queue 容量由 cache hit／miss、source burst、prepare service time 與峰值重疊量測推導，不由 schema hard maximum 推論可用效能，也不在本頁任選數字。

prepare 的 wall duration、採用的 acoustic snapshot tick、native apply AudioContext time 與 recording emission timeline 各自標示。FIR group delay 必須隨 response metadata 一起發布；不能當成 propagation d/c 再扣除，或讓 direct／early／late 多算一次延遲。native HRTF／limiter 的未知 latency 保持 unknown。

cancel／run reset／scene commit／source removal 使 pending preparation generation 失效；已交給 AudioBuffer 的資料不當作 scratch 重寫。pause/resume 不重發原 emission；dispose 拒絕所有 late completions，清除 pending、disconnect graph 與釋放 pins。未知／非法 prepared response 拒絕並保留舊有效 graph，不能部分套用後報成功。

## 替代與品質風險

保留現有 cache／bank 是對照；若 graph 控制而非 FIR compute 主導，搬 kernel 到 Worker 可能增加 latency／copy。進一步 cache AudioBuffer 須考慮 context／sample rate ownership 與 retained memory，不能先假設原生物件可跨 context／thread 重用。量化 gains 以提高 hit rate 會改聲學輸出，必須另有誤差／科學標示，不能作 exact optimization。

自訂 convolution／Worklet 可控制 callback 工作，但需重做 HRTF／filter／state／tail 等價及真正 underrun／deadline 測量；[固定 Web Audio Recommendation](https://www.w3.org/TR/2021/REC-webaudio-20210617/#rendering-loop)不等於產品 callback 已驗證。任何新 callback 必須依實際 block length，預配置且不等 geometry／network／AI／physics，不在 callback 生成 kernel。

## 採納條件與回復

[量測計畫](../MEASUREMENT_PLAN.md)先報 exact cache hit/miss、kernel preparation、copy/createBuffer、route create/reuse／retire、native apply、coalesced age、node／bytes 峰值與完整 delivery，分開 cold/warm 與 steady/burst。固定 input reference 比較 impulse arrivals、band magnitudes、scale、FIR group delay、delay ramps、path birth/death、crossfade／tail；沒有輸出證據不能標 click/pop 或 continuity 通過。

必測 prepare 亂序／重複／舊 epoch、bank 忙、response 不變／scale-only、拓樸切換、source removal、cancel／pause/resume／seek／dispose、退役洪峰與資源耗盡；數學 tolerance 沿用已固定 reference，不為候選放寬。只有目標成本改善、完整 output oracle 與有界性通過、跨 browser 相容風險可接受，才採納具體實作。

回復時停新 prepare jobs、使候選 generation 失效，經既有 fade／drain 安全邊界返回原 `createBandFilterKernel`／`PathRoute.update`／`LateReverbBus`；保留原 formula、cache key、artifact／資產 refs 與原品質。回復不是把尚有讀者的 bank 立即覆寫。
