# 聲學驗證狀態

2026-10-29 範圍註記：下文為早期解析基線，不代表目前只有 spike。正式 solver、Web Audio graph／HRTF 已有 runtime 與分項測試；目前能力及來源見[研究](../12-architecture-review/CUSTOM_ACOUSTIC_CORE_RESEARCH.md)、tests/acoustics-runtime/ 與 tests/audio-runtime/。真實環境／校準、完整性能與聽測仍未通過，不以單元或原生 DSP PASS 取代。`npm test` 仍跑下列解析／契約 regression；原結果 [`validation-local.json`](../../benchmarks/results/validation-local.json)保留歷史。

## 已執行模型

`ACO-001` 使用 SI 單位的 t=r/c、自由場壓力 1/r，參考距離 1 m。這是 point-source 相對量，未定義近場／r=0 行為；r=0 拒絕。壓力比不是能量比，也不是校準 dB SPL。

`ACO-002`／`ACO-003` 將 source 依指定 surface sequence 鏡射，從 listener 反向回推交點，檢查有限凸 polygon 內部及每條實際 segment 的遮蔽。一階、二階、polygon 外拒絕、direct blocker、reflection blocker 均有獨立固定 expected。反射路徑 ID 只含 source/listener/surface IDs，不將座標或排名放進 ID。source 小幅位移與 blocker 新增可重跑；沒有測音訊 crossfade。

目前 kernel 僅接受單位 normal、凸且共平面的 polygon，boundary epsilon=1e-9 m。沒有 diffraction、diffuse scattering、非凸分解、厚牆 transmission、coincident／coplanar grazing 的完整處理，沒有 acceleration structure。不可用此結果承諾一般 mesh 場景精度。

`MAT-001` 對每一個 synthetic band 檢查能量 A+R+T=1、[0,1] 範圍、finite 值，再以相同介質的 magnitude √R／√T 映射。沒有相位、複數 impedance 或角度相關模型。`scatteringFraction` 是反射能量內的分配參數，不能再直接加入 A+R+T。

`AIR-001` 只驗證已知 alpha 的 dB/m→壓力 `10^(-alpha*r/20)`。alpha=0.1 是**合成**測試值，並非 ISO 9613-1 查表值。**ISO 大氣吸收係數公式／reference point：NOT RUN**；需要完整合法標準或獨立可追溯 reference 後，才可增加溫度／濕度／壓力 sweep 與標準一致性宣稱。

`AIR-002` Doppler 的 n 指向 emission source→listener，使用 `f*(c-v_receiver·n)/(c-v_source·n)`，測靜止、同速及 source 徑向接近。條件是均勻介質、已知 emission 方向與 subsonic 速度。超音速拒絕；沒有實作任意移動源的 retarded-time root solve，沒有以 instantaneous direction 假冒精確動態傳播。

`WAVE-001` 是 rigid rectangular Neumann room 的解析 eigenfrequency，只測 5×4×3 m 的 (1,0,0) 軸向 mode。此測試不是 FDTD／FEM／BEM 或低頻 room response 的驗證。

## RIR／DSP 邊界

`DSP-001` 對有限 synthetic pressure samples 做反向平方和並以總能量正規化 EDC。剩餘能量 0 為 -Infinity，JSON fixture 以 null 編碼 expected。silent input 拒絕，不回報任意 RT。

`DSP-002` 用已知 RT60=0.6 s 的 exponential amplitude、8 kHz、2 s synthetic RIR，對 0..-10、-5..-25、-5..-35 dB 做 least-squares slope，再外推至 60 dB；容差 5e-5 s。range 不足或少於三個 fit samples 回傳 null。未實作 noise-floor correction、measurement uncertainty、bandpass integration、ISO 3382 完整量測程序，**不能宣稱 ISO conformity 或真實房間 RT 已驗證**。

Arrival test 是把距離／聲速換為 nearest sample，量化誤差至多半個 sample；未實作 fractional-delay 濾波器。傳播 delay、DSP processing delay 與 device latency 必須分開報告。DRR、C50、C80、BRIR、HRTF、convolution、FDN、Doppler resampling 與 audible click 測試仍為 NOT RUN。

來源與適用條件由 [`EVIDENCE_LEDGER.json`](../../research/EVIDENCE_LEDGER.json) 與 [ACOUSTIC_THEORY](../../research/theory/ACOUSTIC_THEORY.md) 維護。`validate:research` 檢查 metadata、ID 與 fixture claim 追溯；它不會證明論文內容或授權判讀正確。
