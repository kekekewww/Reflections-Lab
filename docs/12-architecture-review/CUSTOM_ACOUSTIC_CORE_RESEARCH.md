# Custom Web Acoustic Core：研究、實作邊界與最小調整

查閱日期：2026-10-29（Asia/Taipei）。研究基準為使用者指定的 `c210ca882ca8503b322c28884bf1e9f6e9fe126d`；後述五秒契約修正在獨立研究分支執行，最終提交與整合測試由總報告綁定。本文是繁體中文 canonical 研究文件，沒有宣告正式 Web 第一版完成。

## 1. 判讀方式與結論

既有純 Web 路線適合保留為可追溯、受預算限制的互動幾何聲學核心；不需要為目前聲線視覺化改寫成全波動求解器。正式 runtime 的有效能力是 direct＋一階有限凸平面鏡射＋snapshot dynamic occlusion。多階、solid transmission、繞射、漫反射路徑、複數材質相位與完整房間 RIR 均尚未實作；合成 late reverb 是另一個明標的聽感層。這些能力必須逐項宣告，不能由畫面上有聲線或耳機有立體感推得科學完整性。

標籤含義：**VERIFIED fact** 指讀到的程式、明列測試或原始來源事實；**analytical** 指在列明假設下的解析推導；**engineering approximation** 指工程選擇；**PROPOSED** 未採納的後續建議；**UNVERIFIED** 尚缺證據。文件引述標準或論文，不代表重現其實驗或取得合規認證。本地 claim IDs `CR-ACO-*` 僅供此次審查，未冒充中央 Ledger 已登錄主張。

先核對的既有來源為 [PAPER_INDEX](../../research/papers/PAPER_INDEX.md)、[EVIDENCE_LEDGER](../../research/EVIDENCE_LEDGER.json)、[聲學理論](../../research/theory/ACOUSTIC_THEORY.md)、[DSP 模型](../../research/theory/DSP_MODELS.md)。既有 `ACO-001..005`、`MAT-001`、`AIR-001/003` 與 DSP claims 已涵蓋大部分基本原理，本輪不重建第二份量測材質庫。

## 2. 實際程式與證據地圖

| 範圍 | 實際來源／證據 | 本輪可支持的判斷 |
| --- | --- | --- |
| 幾何與求解 | `src/acoustics/geometry.ts`、`solver.ts`、`types.ts` | VERIFIED fact：有限、凸、共平面 polygons；實際線段 visibility；一階；顯式預算；壓力比 |
| 場景轉換 | `src/app/acoustic-input.ts` | VERIFIED fact：box 六面有穩定 object ID 後綴；非 box 不會被捏造成精確曲面；moving bodies 只作遮擋快照；source owner box 排除 |
| Worker 邊界 | `src/app/acoustic-service.ts`、`acoustic-worker.ts` | VERIFIED fact：有 request/revision/tick、來源與 payload/path 上限、timeout、late reply 拒收；不是無限可擴展求解服務 |
| 原始解析 oracle | `tests/acoustics-runtime/solver.test.ts` | direct 3-4-5、一階面內／面外／遮擋、material、air、stable IDs、budget／NaN／退化幾何等；未使用本輪修正改動其 oracle |
| Audio routes | `src/audio/routes.ts`、`engine.ts`、`band-filter.ts` | VERIFIED fact：每 path 一個 delay、一個 panner；距離 rolloff=0；band FIR 為有界近似；有 path birth/death fade |
| late | `src/audio/late-reverb.ts` | VERIFIED fact：原創 deterministic mono 合成 IR、30ms 零前綴、unit energy、normalize=false、雙 bank；不是求解器房間回應 |
| native 證據 | `tests/audio-runtime/README.md`、`native-audio-bank-verified-20261027.json` | 歷史 Chromium 25 項分項通過；Firefox 原能量 FAIL／WebKit API 阻擋仍保留；不等於本輪重跑或真人聽測 |
| 現行限制／性能 | `docs/KNOWN_LIMITATIONS.md`、`docs/11-v1/BROWSER_PERFORMANCE.md` | 既有 600 秒量測保留負面性能結論；Worklet／裝置 latency／實房間及真人 gate 不能由純函式測試代替 |

`docs/02-architecture/AUDIO_RUNTIME.md` 與 `docs/06-validation/ACOUSTIC_VALIDATION.md` 起首仍含前期「尚無產品 runtime」敘述；讀取時必須連同當前 code／有 hash 的結果判斷。這是文件時態不一致，不能把舊文字當作現在完全沒有 audio graph，也不能因此抹除舊結果。

## 3. 幾何、有限 visibility 與多階

**CR-ACO-001／analytical**：均勻靜止介質、線性點聲源遠場中，path length `L` 對應 `tau=L/c`，參考距離 1m 的相對壓力 `1/L`。實際物理 Green function 的 `1/(4*pi*L)` 與本案相對源定義不可再乘一次。`r=0` 無定義；runtime 會拒絕 coincident endpoints，近距離由明示 `minimumDistanceM` 夾限，屬 finite-source 工程近似，並非近場或 SPL 校準。[Allen–Berkley 原文](https://jontalle.web.engr.illinois.edu/Public/AllenBerkley79.pdf)

**CR-ACO-002／VERIFIED fact＋analytical**：平面鏡像 `s'=s-2*n*dot(n,s-p0)` 必須再求 listener→image 與實體有限面的交點，驗面內、同側／允許側與每一段遮擋。runtime 的 `segmentIntersection` 只排除實際端點的小範圍，沒有永久忽略整個反射面；不把無限平面交點直接列為聲線。`EPSILON_M=1e-7` 是固定工程 tolerance；coincident/coplanar grazing 明示 unsupported。

**CR-ACO-003／VERIFIED fact（文獻）＋PROPOSED（擴充）**：高階鏡像需要遞迴反射並從最後一面向前回溯，每個有限面與真實 segment 都檢查。候選數隨面數及階數組合成長；BVH 加速 visibility，無法單獨消除鏡像樹的組合成本。Siltanen 等的原始文章 §1.1 支持這個區分，研究中的幾何縮減結果不能當本案效能保證。[Siltanen 等，2008](https://users.aalto.fi/~ktlokki/Publs/siltanen_aaua_2008.pdf)

第一個後續擴充應是隔離的二階 shoebox／有限牆 fixture，證明反射順序、每個反射點、角度、長度與遮擋，再考慮 `maxOrder` API。現在不能僅修改 `order` 欄或 schema 上限就宣稱多階可用。複雜 mesh 可將共平面 acoustic patches 合併，但不能跨洞口、材質邊界或穩定 surface identity 合併。beam tracing 是可研究的剪枝方向；作者研究的預計算條件不能直接當成任意 moving geometry 的承諾。[Funkhouser 等，作者出版頁](https://pixl.cs.princeton.edu/gfx/pubs/Funkhouser_1998_ABT/index.php)

## 4. 材質、頻帶、傳輸與大氣

**CR-ACO-004／analytical＋VERIFIED fact（code）**：同介質／一致能量條件下，`A+R+T=1`，`Rspec=(1-s)R`、`Rdiff=sR`；鏡射壓力幅值為 `sqrt(Rspec)`。runtime 驗守恆且只渲染鏡射部分，`sR` 明示「未渲染的散射能量」，不改稱吸收。這不等於全場能量已重建。`phaseModel=zeroPhaseMagnitudeOnly` 也不提供複數阻抗、反射相位或低頻干涉。

`transmissionEnergy` 目前只是材質分配契約的一部分；穿過 blocker 的 direct path 會被移除，沒有另外產生 solid transmission path。不可用一個非零 T 值宣稱穿牆已實作。後續若加厚牆路徑，要選擇並記錄 entry/exit、厚度、介質／角度、wall transfer phase、交互次序、雙界面與重複計數政策。由牆體 TL 資料取 `10^(-TL/10)` 是能量；只有適用的等阻抗條件才能取平方根作壓力。量測 absorption 若含透射損失，不能再重扣 T。所有 Synthetic preset 仍必須標 Synthetic。

**CR-ACO-005／engineering approximation**：solver 的 7 頻帶預設中心是 125..8000Hz，也可明示 1..32 個中心；材質頻帶必須精確對齊，沒有隱含插值。renderer 的 129-tap 預設 Hann frequency-sampling FIR 是另外的頻率重建近似，低頻窄帶可能有較大誤差，群延遲 `64/fs` 不是物理傳播時間。不應把 band center 上的材料係數當作整個 octave 頻帶都精準，也不應把 FIR 固有相位當作量測材料相位。

後續資料契約應保留 band edges、coefficient meaning、incidence、厚度／背腔／安裝、uncertainty、raw source/version/license、adapter version；Measured、Derived、Tuned、Synthetic 分別可追溯。頻帶合併或重採樣要在能量或複數響應等正確域定義，不能靜默插值後仍稱量測。

**CR-ACO-006／VERIFIED fact（code與官方範圍）**：已供應 `alpha_b`（dB/m）時，壓力 loss 為 `10^(-alpha_b*L/20)`，只套一次。省略 alpha 是零損 Synthetic 假設；乾空氣聲速 `sqrt(1.4*287.05*T_K)` 是固定組成 ideal-gas Derived 模型，沒有濕度、壓力與成分修正。ISO 9613-1 官方摘要確認其範圍包含頻率與氣象條件；本輪未取得完整標準公式與授權 reference tables，不能稱目前實作符合 ISO。[ISO 官方 scope](https://www.iso.org/standard/17426.html)

## 5. 穩定 paths 與時間基準

**CR-ACO-007／VERIFIED fact（code）**：path identity 是 `solverVersion|topologyId|sourceId|listenerId|orderedSurfaceIds-or-direct`，不含座標、rank、request ID、poseTick 或一般 revision。這讓同一拓樸路徑在端點移動時重用 route。材質改變不需要重命名 path；物理表面 ID 被刪除後重新使用則可能造成錯誤延續，因此未來拓樸編輯需保證 identity/generation 政策，不應只靠數字 geometryRevision 充當 path ID。

**CR-ACO-008／engineering approximation**：source/listener 同一 tick 快照的 `L/c` 是 quasi-static；精確運動傳播應在 emission/arrival 關係求 retarded time，例如 direct path 需滿足 `t_arr-t_emit=|x_l(t_arr)-x_s(t_emit)|/c`。反射還涉及各反射時刻與幾何。現在沒有 pose history root solve，不能把快速移動稱精確動態聲學。

音訊 epoch 是 `(simEpoch,audioEpoch)`：generator emission 排在 `audioEpoch+(t_emit-simEpoch)`，path DelayNode 再施加 `absoluteDelayS` 一次；`relativeDelayS=(L-Ldirect)/c` 僅是相對直達的數值，不可再相加。HRTF 從 listener 指向前一個 path vertex，panner 置於 `listenerPosition+arrivalDirection` 且關閉距離 rolloff。這與 Web Audio 的節點／距離模型相容；裝置 output time 仍不等於 AudioContext currentTime。[固定 Web Audio 2021 REC](https://www.w3.org/TR/2021/REC-webaudio-20210617/)

routes 以約 30ms delay ramp、20ms gain／direction ramp 和 bounded 雙 FIR banks 改善連續性；這些常數是工程選擇。可變 delay 會造成 frequency shift，若另加相同運動的 pitch shift 就可能雙算 Doppler。`y(t)=x(t-D(t))` 導出局部頻率比 `1-D'(t)`，這是解析關係，不表示本案平滑已達物理正確 Doppler。急變／teleport 時 delay ramp 可能產生明顯重採樣；應把 continuous motion、路徑出生死亡與編輯 teleport 分開測。[Julius O. Smith，作者教材](https://www.dsprelated.com/freebooks/pasp/Doppler_Simulation.html)

**PROPOSED**：對 stale frames、packet coalescing、ranking swaps、visibility 邊界加 hysteresis 與 raw/rendered 分離紀錄；hysteresis 不可改寫 raw solver truth。無新 frame 時沿用有效參數的時間上限應可觀察，不能把任何舊 frame 永遠當 current。現有 Worker identity／runtime stale checks 是正確基礎，但不證明高負載下 20Hz update 與聽感連續性已達標。

## 6. RIR、late、HRTF 與數值穩定性

**CR-ACO-009／VERIFIED fact（code）**：solver `impulseResponseArtifactId=null`，RT60／DRR／C50 回 null 與 insufficient reason。有限一階、非複數壓力 magnitude paths 不構成完整相位正確 RIR。反向平方積分可求 EDC，仍需足夠 decay range、noise-floor、band filtering 與 fit 品質，才可外推 EDT/T20/T30；不能將 null 補成 RT60=0。

未來 pressure RIR 與 energy histogram 必須是不同 artifact types，保留 sample rate、absolute/relative origin、direct inclusion、fractional-delay kernel、group delay、normalization、phase assumptions、band/direction representation、truncation 與 solver version。獨立 solver 比較必須先對齊 fractional-delay global delay；pyroomacoustics 官方文件明示其 fractional-delay filter 會引入全域 delay。[pyroomacoustics RIR 文件](https://pyroomacoustics.readthedocs.io/en/pypi-release/pyroomacoustics.room.html)

**CR-ACO-010／engineering approximation**：目前 late 是合成 mono response，由最早有效 solver route 送入，沒有額外求解 late rays。它改善聽感但不能推出房間 RT、方向擴散或 diffuse energy conservation；先 HRTF 後進 mono convolution 也不能當方向解析的 late BRIR。若未來採參數式 reverb，應先固定模型與時間／能量接縫，避免與 early 重疊雙算。Schissler–Manocha 的研究展示以低率 IR 驅動方向性 reverb 的另一種取捨，同時明列細節與快速動態限制，不能移植其性能或聽測結果為本案證據。[原文 §4／§8](https://arxiv.org/html/1803.00430v1)

若未來選 FDN，先用已證明的 lossless／contractive 結構再加明示衰減；不能只檢查 feedback matrix 的 eigenvalue magnitude<1 就宣稱任意 delay lengths 下穩定。Schlecht–Habets 給出這種不足條件的反例；LTV 更新、濾波器插值與有限精度仍需另證。[原文 §II–III](https://arxiv.org/html/1606.07729v1)

**UNVERIFIED**：native HRTF 的 finite/nonzero render sanity 不是個人化 HRTF、前後／高低定位、頭轉、耳機校準或聽感認證；browser native HRTF／limiter 內部延遲未直接量得。全 callback deadline、underrun、真實裝置 latency 與房間量測尚不能由這份研究解除。

## 7. 本輪真正缺陷與 Category B 最小修正

**CR-ACO-011／VERIFIED fact（修改前重現；修正後回歸）**：基準 solver 接受 `maxPropagationSeconds=10`，routes 驗證與 native DelayNode 僅 5s。Synthetic 輸入 source `[-200,-200,-200]`、listener `[200,200,200]`、`c=100m/s`、cap10 產生 `L=692.8203230275509m`／`tau=6.928203230275509s`，`validateFrame` 拋 `INVALID_AUDIO_VALUE`。這是跨層 configuration 不相容；不是預設 2s 場景已發生故障的證據。

最小修正把 [shared limit](../../src/acoustics/limits.ts) 定為 5s，solver 在 configuration 邊界用原 `INVALID_BUDGET` early reject 超界值，routes 的 allocation／validation 共同引用。**Category B：縮窄原本無法被 audio renderer 接受的 configuration**；不靜默 clamp、不修改 scene schema／幾何／units、不改原 tests/reference/tolerance。既有預設 2s 不變；在有效 cap 下過長 path 仍依原政策 drop 並標 `budgetExceeded`，不假裝不存在物理反射。數值 `directDelayS` 可仍記幾何直達時間，只有 admitted `paths` 能進 audio。

新 [propagation-limit.test.ts](../../tests/acoustics-runtime/propagation-limit.test.ts) 先證明 `5+1e-9`／10 原本不拋錯，RED 為 4PASS／2FAIL；修後六案 PASS，另保留 0.001／5 configuration 接受、恰好 5s path 可 render、超過 5s path 顯式退階。這不構成多階、完整傳輸或新的性能能力。

## 8. 本輪實際命令、數值證據與後續 gate

工作目錄為獨立研究 root；Node v22.17.0。收據在 [acoustics-propagation](../../artifacts/architecture-review-20261029/acoustics-propagation/)。只列本代理實際執行；最終整體 check 由總報告補列。

| 命令 | 本輪實際結果／範圍 |
| --- | --- |
| `node --import tsx --test tests/acoustics-runtime/propagation-limit.test.ts`（改前） | RED：6案，4PASS／2FAIL；`red.tap`，預期 missing exception |
| 同上（改後） | GREEN：6PASS；`green.tap` |
| `node --import tsx --test tests/acoustics-runtime/*.test.ts tests/audio-runtime/*.test.ts` | PASS：185 tests；`targeted.tap`；控制圖／domain 範圍，不是 native render |
| `npm run typecheck` | PASS；`typecheck.txt` |
| `npm test` | PASS：668 tests；`project-tests.tap` |
| `node --import tsx artifacts/architecture-review-20261029/acoustics-propagation/rigid-transform-probe.mjs` | PASS：100個一階 fixture 剛體座標變換；absolute tolerance `1e-10`；`rigid-transform-result.json` |

100-case probe 的基準為 source `[1,1,0]`、listener `[5,1,0]`、有限 floor，獨立 expected hit `[3,0,0]`、length `sqrt(20)`、delay `sqrt(20)/343`、final direction `[-2,-1,0]/sqrt(5)`；每次整體繞 Z 旋轉並平移 `[0,2,-3]`。`R=.64,s=.25,alpha=.1dB/m` 是 Synthetic；expected pressure 為 `sqrt(.64*.75)/sqrt(20)*10^(-.1*sqrt(20)/20)`。它測剛體不變性、finite polygon、ID與壓力／時間語義；沒有用 solver helpers 產生 expected，也沒有量測真實材料。

建議依序補證（均 PROPOSED／未跑）：

1. 二階獨立解析場景；有限小面、遮擋兩段、coplanar／grazing、尺度 sweep、正反面與 mirror reciprocity。
2. 頻率響應 oracle：DC／Nyquist、低頻斜率、每 band 與 band-edge 誤差，48/44.1/96kHz、非整數 delay 的跨引擎 impulse／sine；傳播、FIR group delay、native HRTF latency 分開。
3. 動態穩定性：同一 path 的連續運動、排名交換、反覆遮擋、birth/death、teleport、stale／out-of-order、pause/seek；輸出 PCM 的 peak、finite、energy、調變與 discontinuity，聽感另外測。
4. 固定同材質／同大氣／同 epsilon 定義的獨立 solver V3 對照，先比 geometry/delay，再比 amplitude；完整 RIR 指標須達模型適用條件。
5. 原負載及門檻的長時間 browser/audio delivery、裝置與 V5 實房間／人耳；保留所有既有 FAIL/UNKNOWN。禁止以本輪微修或100-case數值 PASS代替這些 gate。

## 9. 本輪外部來源存取紀錄

所有來源 access date 為 2026-10-29；不保存或重散布第三方全文。表內「可讀」只指相關章節，非逐字完整審讀。

| 來源 | 存取與使用邊界 |
| --- | --- |
| [Allen–Berkley 1979](https://jontalle.web.engr.illinois.edu/Public/AllenBerkley79.pdf)，DOI 10.1121/1.382599 | 搜尋可檢索原文片段；保留既有 PARTIAL_TEXT，不提升為已完整讀全文 |
| [Siltanen 等 2008](https://users.aalto.fi/~ktlokki/Publs/siltanen_aaua_2008.pdf)，DOI 10.3813/AAA.918049 | 公開作者 PDF 可讀；本輪查 §1.1 與方法／限制，不重現 ODEON 實驗 |
| [Funkhouser 等 1998](https://pixl.cs.princeton.edu/gfx/pubs/Funkhouser_1998_ABT/index.php) | 作者摘要可讀；PDF直接403，細節仍 PARTIAL，不冒稱已重建完整 beam implementation |
| [Schissler–Manocha 2018 v1](https://arxiv.org/html/1803.00430v1) | 原始預印本 HTML 相關章節可讀；只作模型取捨依據 |
| [Schlecht–Habets 2016 v1](https://arxiv.org/html/1606.07729v1) | 原始預印本 §II–III 可讀；FDN反例／條件，不是本案實測 |
| [Web Audio 2021 REC](https://www.w3.org/TR/2021/REC-webaudio-20210617/) | 固定版本技術規格可讀；[目前1.1](https://www.w3.org/TR/webaudio-1.1/)是2026-09-22 Working Draft，未據此擴大browser承諾 |
| [ISO 9613-1](https://www.iso.org/standard/17426.html) | 官方摘要／狀態；完整公式與表未取得，不重散布或宣稱ISO一致 |
| [pyroomacoustics room](https://pyroomacoustics.readthedocs.io/en/pypi-release/pyroomacoustics.room.html) | 官方0.10.0文件可讀；未新增依賴／未跑獨立solver對照 |
| [Smith Doppler 教材](https://www.dsprelated.com/freebooks/pasp/Doppler_Simulation.html) | 作者教材可讀；Stanford原URL本輪cache miss；局部delay推導另明標analytical |
| [Schroeder 1965作者／大學PDF](https://labrosa.ee.columbia.edu/~dpwe/papers/Schro65-reverb.pdf) | 本輪直接timeout；EDC沿既有Ledger與獨立解析，不新增全文已讀聲稱 |
