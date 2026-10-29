# 聲學理論與可驗證的模型契約

查核：2026-10-26。來源代號對應 [PAPER_INDEX](../papers/PAPER_INDEX.md) 與 `research/EVIDENCE_LEDGER.json`。本文件把原始文獻內容、獨立數學推導與工程選擇分開。數值 fixture 使用固定 `c=343 m/s` 是 **Synthetic / Computed** 參數，不是假裝量得的當日聲速。

## 1. 單位、振幅與範圍

空間 m、時間 s、頻率 Hz、速度 m/s、壓力 Pa；頻帶中心與 band edges 需保存。採線性、小擾動、均勻靜止介質。3D 點聲源自由場 Green function 的壓力因子為 `1/(4πr)`，到達時間 `τ=r/c` [P01；ACO-001]。若輸入已定義在參考距離 `r_ref`，相對振幅可用 `r_ref/r`，不得再套一次 `1/(4π)` 或引擎的重複距離衰減。

`pressure ∝ 1/r`；同介質遠場 `intensity ∝ pressure² ∝ 1/r²`。兩倍距離的相對壓力是 `1/2`；不是音訊振幅乘 `1/4`。`r=0` 是點源奇異值，應回傳無效或顯式 finite-source / minimum-distance 模型；夾限半徑必須記錄且不能宣稱在近場準確。

`dB SPL=20 log10(p_rms/20 µPa)` 需要真實壓力校準；`dBFS` 僅對數位滿刻度。HRTF、素材音量、耳機與 DAC 增益未校準前，面板只能標示 relative dB / dBFS [DSP-006]。

## 2. 有限面鏡射：路徑必須通過幾何驗證

平面以單位法向 `n` 與平面上一點 `p0` 表示。鏡像：

```text
mirror(s) = s - 2 n dot(n, s-p0)
x(u) = receiver + u (mirror(s)-receiver)
u = dot(n,p0-receiver) / dot(n,mirror(s)-receiver)
```

這是平面幾何的獨立推導；P01 奠定 shoebox，P02 是非長方體的歷史擴充，P05 §1 全文確認遞迴鏡射與可見性需求。**無限平面交點並不足以產生有效有限牆反射** [ACO-002]：

1. 分母近零時視為 parallel / degenerate，不可除以零。
2. 必須 `0<u<1`（端點另以尺度相依 tolerance 處理）。
3. 交點在有限 polygon 內；凹多邊形需可靠 point-in-polygon 或正確 triangulation。
4. 所有實際線段可見；不能穿過遮蔽物、牆背或不允許反射的一側。
5. 驗證入射角等於反射角；每段長度正值；總長不得短於直接歐氏距離。

二階與多階：以聲源至接收者順序記錄 surface sequence `(P1,…,Pk)`，逐面鏡射得到 `s1,…,sk`；從接收者沿 `sk` 方向與 `Pk` 相交，再由該交點朝 `s(k-1)` 與 `P(k-1)` 相交，依序回溯到真實聲源。逐一檢查面內與遮擋，累加**實際折線**長度 [ACO-003]。不能把任意鏡像點可見當作多階路徑正確。

工程邊界：反射頂點的 self-intersection tolerance 必須按房間尺度設計，並排除正接觸面的一小段；不能整面永久忽略，否則會漏掉其他遮擋。雙面薄片、閉體外法向、洞、重疊面、T-junction 必須在 acoustic geometry contract 定義。測試時保存 polygon ID、交點、長度、角度與每段遮擋結果。

## 3. 動態場景與成本

樸素鏡像樹對 `M` 個面、反射階數 `K` 有約 `Σ M^k` 候選，實際可由排除不可能的連續鏡射、beam clipping、可見性與距離／能量門檻剪枝 [P05 §1；ACO-004]。BVH 加快交點與遮擋查詢，不能消除組合成長。三角面數不是物理反射表面數；同材質的共平面 acoustic patches 可合併，但窄門、洞與材質邊界必須保留。P05 的 octree reduction 只在所評估模型成立，不能直接套用其縮減比例作為本案保證。

P03 的 beam tree 以空間分割和預計算可達區域降低搜尋；P04 針對同時移動的來源／接收者提出 priority、bidirectional 等加速。已讀證據不足以重建其全部實作，故初版適用範圍為**靜態房間＋動態 Source / Listener**：保留靜態拓樸與 BVH、重算端點對應交點及可見性；有物體移動時才以 scene revision 失效相關快取。不能聲稱單純移動 Listener 永遠不需重新評估反射可見性。

初版建議低階 deterministic early paths，加上 bounded rays 或參數式 late reverb；最大 order、path budget、energy threshold、maximum propagation time 都是**可見的近似設定**。未採樣到的 ray 不是不存在的反射。有限接收球的半徑、射線數、PDF／solid-angle normalization、seed 會改變偏差與變異，需記錄；receiver connection 需另測 visibility，能量直方圖不可冒充有相位的壓力 RIR。反射、傳輸、繞射與漫反射必須各自宣告 backend capability，無繞射模型時低頻遮蔽不可稱全物理解。

## 4. Path identity 與音訊連續性

以下是本專案**工程提案**，由幾何路徑與時變渲染文獻啟發，尚未通過產品 DSP／聽覺驗證 [ACO-005；P06 §2、§4、§8]：

- `pathId = sourceId + listenerId + orderedStableSurfaceIds + interactionTypes`。碰到的 triangle index、rank 或座標不適合作為唯一 identity；幾何 revision 改變時明確失效。
- 每個 audio block 對既有 path 做 gain／filter／delay 的時間插值。ranking swap 只換 budget 選擇，不重新命名物理 path。
- birth 由零增益淡入、death 保留短暫 tail 後淡出；門檻用 hysteresis 避免反覆閃爍。具體淡變長度必須經 transient、rapid motion、many-path 測試選出，不臆定普遍聽不見的毫秒數。
- 區分幾何真的 discontinuity（路徑跨牆緣）與 solver undersampling。平滑改善 click 但引入 temporal lag，不能改寫科學原始路徑；原始幾何 trace 和 rendered parameters 分別保存。
- 可比較雙 renderer 輸出 crossfade 或 persistent path delay lines；完整時變卷積若只線性混 IR，容易把延遲中的同一事件變成兩個事件。由變動 delay 自然產生的 Doppler 與額外 pitch-shift 只能選擇一致模型，避免加兩次。

## 5. 材質是量測條件與係數定義，不是名稱

對同一頻帶、入射條件、被動界面與一致能量正規化，採本案守恆契約：

```text
A + R + T = 1,       0 ≤ A,R,T ≤ 1
R_specular = (1-s) R
R_diffuse  = s R,    0 ≤ s ≤ 1
TL_dB = -10 log10(T)
```

此處 `A` 是耗散吸收、`T` 是穿透能量比、`R` 是全部反射能量比；`s` 是**已反射能量中**離開鏡面成分的比例 [MAT-001，獨立能量推導；S04 的 random-incidence scattering 不等於散射方向均勻度]。`T=0` 的 TL 為正無限；不得用未註明的有限數值假裝完全阻隔。

同一介質、對應角度／能流條件下 `|r_pressure|=sqrt(R)`；對不透射表面才可用 `sqrt(1-A)`。不同介質的 transmission 振幅需阻抗與角度因子，不能直接 `sqrt(T)`。非複數吸收資料只能提供幅值，不能推回反射相位；負反射係數、相位轉動與多層干涉另需複數 impedance / transfer model。

對局部反應、平面邊界、平面波、角度從法向量起算，在無透射的阻抗邊界可推導：

```text
r(θ,f) = [Zs(f) cosθ - ρc] / [Zs(f) cosθ + ρc]
A(θ,f) = 1 - |r(θ,f)|²
```

這是所述理想邊界的解析模型，不是由任一混響室係數自動得到的數據。材料厚度、背後 air gap、安裝、表面粗糙度、含水率、頻率、入射角會改變資料適用性；只有「木頭／混凝土」名稱不能決定任何實測頻譜。

S02 混響室法與 S03 阻抗管正入射法是不同量測情境。S03 官方頁僅允許對**局部反應材料**估算 diffuse-incidence 情況；不能宣稱正入射數字就是 random-incidence。混響室表觀係數可能因測試定義／邊緣效應等與本案 0–1 界面分配不同；保留 raw measurement 與 uncertainty，backend adaptation 另存，不能靜默夾限後稱原始量測。

每個 material record 至少保存 `provenanceKind: Measured|Derived|PerceptuallyTuned|Synthetic`、來源、授權、版本、`centerFrequenciesHz`、edges、coefficientMeaning、incidence、sampleThicknessM、backing、mounting、measurementMethod、uncertainty。頻帶轉換需在能量／複數響應等正確域操作；沒有對照資料時標示 Estimated。不能用取樣點插值捏造量測精度。

pyroomacoustics 的 `Material.energy_absorption` 明定能量；舊 `absorption` 曾用不同定義且 deprecated [T03–T04；MAT-002]。Steam Audio 等 backend 的頻帶與 transmission convention 應以該版官方 API 逐一映射；本研究不假設所有 scattering 同義。材質 adapter 必須有 conservation 與 round-trip fixtures。

| 模型／backend | 頻帶與意義 | 轉換限制 |
|---|---|---|
| 本案 canonical material | 明記任意量測 bands、複數 impedance 或 A/R/T 定義；raw metadata 不丟失 | 只有必要條件成立才導出 `sqrt(R)`；phase UNKNOWN 必須保留 |
| pyroomacoustics 0.10.0 文件 | `energy_absorption`、`scattering` 可含 `coeffs`／`center_freqs`，內部可重採樣到 octave bands [T03] | 舊 `absorption` 不能直接搬值；固定內部 band settings，不能假設與外部查表中心完全一致 |
| Steam Audio 4.8.1 預編譯三頻帶版 | 400 Hz、2.5 kHz、15 kHz；absorption 為吸收能量比例，scattering 為已反射能量中散射比例；transmission 僅用於 direct occlusion [SDK-07] | 三點不是標準 octave bands；引擎 transmission 的用途不能當一般多次穿透／能量閉合求解。詳見 `docs/03-sdk/STEAM_AUDIO_RESEARCH.md` 的已查 header |

本案尚未量得任一跨頻帶 adapter 的誤差。以 log-frequency 內插有限能量資料可以作顯式 `Derived` 候選，但不能把 125 Hz–4 kHz 的量測外插到 15 kHz 後標 `Measured`，也不能從三個頻點恢復 narrow-band resonance。

## 6. 空氣、聲速與延遲

NASA 小擾動理想氣體推導 `c=sqrt(γ R_specific T_K)` [T01；AIR-003]。此式固定氣體組成時聲速隨絕對溫度平方根變化，不能從壓力單獨推得聲速改變；濕度改變組成時需額外模型。`T_K=T_C+273.15`；壓力統一 Pa，外部需要 kPa 時只在 adapter 換算；RH 的 fraction／百分比需明記。

S01 官方範圍：大氣吸收取決於頻率、溫度、濕度、壓力，典型範圍 50 Hz–10 kHz、−20…50 °C、RH 10…100%，另有擴展計算。未取得標準完整式與表格，不宣稱 ISO 9613-1 conformity，也不發布貌似標準驗證的係數表。

若給定已驗證或明確 Synthetic 的 `α_dB_per_m(f)`：

```text
airLossDb = α(f) × pathLengthM
pressureGain = 10^(-airLossDb/20)
energyGain = 10^(-airLossDb/10)
```

這是 dB 定義的代數轉換 [AIR-001]；不混入幾何 `1/r`。同一 α 下 100 m 的額外 dB 損失為 1 m 的 100 倍，是路長比例，非固定可聽差異。室內短距離通常更容易受到牆面與早期反射影響，但不能未計算就把空氣吸收設為普遍可忽略；較長路徑、高頻與多次反射的總長仍會累積。

## 7. Retarded time 與 Doppler

靜止空氣、亞音速、直接路徑，發射時間 `te` 與接收時間 `tr` 應滿足：

```text
tr - te = |receiver(tr) - source(te)| / c
n = [receiver(tr)-source(te)] / distance
fo/fs = dte/dtr = (c - dot(v_receiver(tr),n)) / (c - dot(v_source(te),n))
```

第二式由第一式對 `tr` 微分得出，是**本庫獨立推導**；其一維匀速極限符合 OpenStax §17.7 [T02；AIR-002]。`n` 從發射時聲源指向接收時 listener；聲源朝 listener 移動時分母減少、接收頻率升高。不要只把兩端當下相對速度塞進無條件公式；有限傳播時間下方向要使用 retarded geometry。

只用 `|receiver(t)-source(t)|/c` 更新 delay 是 quasi-static approximation；不能宣稱一般加速、快速運動時等同 retarded 解。線性匀速可解析求根；一般軌跡可在有界歷史 transform buffer 中求 `te`，需單調性、容許誤差與 history underrun handling。多反射與移動反射面有自己的時間相依路徑問題；本案初版不宣稱處理移動鏡面的完整 Doppler。

## 8. 可驗證層級與實作邊界

先做 V1：距離、有限面交點、遮擋、鏡射法向不變性、反射階數、守恆、retarded 匀速根、Doppler 正負號、頻帶與單位。再做 V2：delay interpolation、gain／filter smoothing、arrival sample、path birth/death、失去 geometry update 仍音訊連續。V3 使用獨立 solver 並報告 normalization／fractional-delay offset／filtering 差異；V5 才能由合法量測資料討論真實房間誤差。

完整可重現紀錄需要 source／listener 軌跡、scene/material revisions、solver build、幾何 tolerance、ray seed、sample rate、聲速、band definition、IR trimming／filtering／delay compensation。`RIR metric looks plausible` 不足以證明個別早期反射正確，反過來低階到達時間正確也不等於房間 late decay 或低頻準確。
