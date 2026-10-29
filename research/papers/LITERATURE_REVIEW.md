# 科學文獻評估與工程結論

查核：2026-10-26。完整書目／存取程度見 [PAPER_INDEX](PAPER_INDEX.md)。本檔是原創方法評估；原文未能取得的公式、數字與實驗設定明寫未核實，不把摘要擴寫成已閱讀全文。碰撞與 wave sources 的逐篇 13 欄分析見 [COLLISION_WAVE_NOTES](COLLISION_WAVE_NOTES.md)，是本 review 的必要組成。

## 幾何聲學與動態路徑

### P01 — Allen & Berkley，1979

**問題／方法／模型**：在長方體中以 image expansion 建立點對點時域 RIR；每個 image 提供距離衰減與到達延遲，audio 以卷積渲染。**資料／實驗**：可檢索正文含 FORTRAN 實作與模態／image 方法比較，但本次未完整讀取全部例子。**假設／限制**：矩形房間、點源；不能由此認定任意牆阻抗與低頻都精確。**工程／重現／本案**：適合作 shoebox 解析 oracle；固定 c、反射階數與 gain convention，逐 arrival 比較；原程式未執行。**證據**：PARTIAL_TEXT，作者 PDF 直接請求 403。[原始來源](https://jontalle.web.engr.illinois.edu/Public/AllenBerkley79.pdf)

### P02 — Borish，1984

**問題／貢獻**：將 image model 推廣到任意多面體。**方法／數學／資料**：本次只核實書目，沒有取得足夠正文，不聲稱逐式讀過 visibility procedure 或實驗結果。**假設／限制**：任意形狀不代表包含 diffraction、散射或移動牆；有限面仍需獨立幾何驗證。**工程／重現／本案**：保留此歷史入口；鏡像、面內、遮擋與二階回溯由 P05 全文＋本案幾何推導交叉支持，不能只以本論文標題擔保。**證據**：METADATA_ONLY；全文待合法取得。[DOI](https://doi.org/10.1121/1.390983)

### P03 — Funkhouser et al.，1998

**問題／方法**：互動 VR 的多次反射路徑成本；預先把空間分成 convex cells，以 cell adjacency graph／pyramidal beam tree 表達可達序列。**數學／資料**：幾何可達區域剪裁；可讀摘要說明 reflection／transmission 結構，全文實驗表未核實。**假設／限制**：預處理幾何與空間分割有成本；不能由早期 hardware 結果推論本機 latency。**工程／重現／本案**：支持靜態幾何 acceleration 與 endpoint update 分離；先實作有限的一階路徑 oracle，再評估 beam tree。未重跑作者程式。**證據**：PARTIAL_TEXT。[ACM 原始頁](https://doi.org/10.1145/280814.280818)

### P04 — Funkhouser, Min & Carlbom，1999

**問題／方法**：來源與接收者同時移動；利用 avatar positions 的限制，以 priority-driven、bidirectional 等 beam tracing 加速。**數學／資料**：作者摘要描述 cell graph best-first search 與 early-reflection termination，詳細式／實驗表未核實。**假設／限制**：場景的 avatar 使用情境不等於任意可變形幾何。**工程／重現／本案**：可研究以聽者重要性、距離及能量限制 path budget；門檻與漏路徑必須可觀測，不能因 ranking 交換重置 path identity。這一 identity proposal 是本案設計，未宣稱是作者方案。**證據**：ABSTRACT_ONLY，未重現。[作者頁](https://pixl.cs.princeton.edu/gfx/pubs/Funkhouser_1999_RAM/index.php)

### P05 — Siltanen et al.，2008

**問題／方法／模型**：視覺模型過密；以 octree 容積重建及共平面合併減少 acoustic geometry，注意體積與吸收面積。**資料／實驗**：以原模型／縮減模型在 ODEON 的 room metrics 比較；正文限制包含表面方向受損、窄通道被切斷。**假設／限制**：靜態幾何，評估案例有限；總體 metrics 接近不能保證每條 early path。**工程／重現／本案**：visual mesh 與 acoustic mesh 分離，保留 portal／材質邊界；縮減率不作本案性能承諾。方法可重作，未取得並執行作者 scene／solver。**證據**：FULL_TEXT_REVIEWED，§1–4。[作者全文](https://users.aalto.fi/~ktlokki/Publs/siltanen_aaua_2008.pdf)

### P06 — Schissler & Manocha，2018

**問題／方法／模型**：動態多 source 的完整 convolution 成本；ray-derived 低時間解析度 IR 估 RT／DRR，再驅動 spherical-harmonic reverb，early paths 用 delay taps。**資料／實驗**：desktop／mobile scene、計時與主觀比較；本案未重跑。**假設／限制**：人工混響無法保留完整 IR 細部；幾何低頻誤差、SH 方向解析度、平滑造成動態反應延遲。**工程／重現／本案**：支持 early geometry＋parameterized late reverb 的分層表示；能量直方圖不可當 pressure RIR。重現需同場景、ray settings、HRTF 與 hardware。**證據**：FULL_TEXT_REVIEWED，§3–4、§7–10。[預印本全文](https://arxiv.org/pdf/1803.00430)

## 房間聲學與 DSP

### P07 — Schroeder，1962

**問題／方法／模型**：簡單 feedback delay 容易 coloration／echo density 不足；comb 與級聯 all-pass，並分析 `H=(z^-m−g)/(1−g z^-m)` 和 delay／loop-gain 衰減。**資料／實驗**：電子混響設計與聽覺觀察，並非真實房間全面校準資料。**假設／限制**：穩定固定係數結構；「自然」不等於幾何路徑準確。**工程／重現／本案**：可做廉價 late-reverb fallback，以 impulse／spectrum 驗證；本次只分析，未實作該 reverberator。**證據**：FULL_TEXT_REVIEWED，方程 1–15 與 echo-density 討論。[公開全文](https://hajim.rochester.edu/ece/sites/zduan/teaching/ece472/reading/Schroeder_1962.pdf)

### P08 — Schroeder，1965

**問題／方法／模型**：noise decay 逐次波動；積分 impulse response 的平方取得 ensemble-average decay，允許觀察非單指數衰減。**資料／實驗**：可讀正文含白噪音假設與量測動機，完整實驗程序本次未核實。**假設／限制**：線性、穩定 room response；有限 IR、noise floor 與 truncation 會污染積分。**工程／重現／本案**：以 synthetic exponential 驗證 metric 算法，再到量測 RIR；EDC 正確不等於房間 solver 正確。**證據**：PARTIAL_TEXT；原 PDF timeout；本案 EDC 離散式與 fitting contract 明載於 DSP_MODELS。[DOI](https://doi.org/10.1121/1.1909343)

### P09 — Jot & Chaigne，1991

**問題／方法**：把 reverberator structure 和頻率衰減控制分離；摘要支持 unitary feedback delay network 及 frequency-response compensation。**數學／資料**：詳細 damping 設計與實驗未取得，禁止補寫成已核實原式。**假設／限制**：讀摘要不能判斷任意 filter interpolation 穩定。**工程／重現／本案**：作 FDN 歷史依據；目前方程與穩定約束改由 P10 全文支持。重現要合法取得完整論文或使用獨立有授權實作。**證據**：ABSTRACT_ONLY，AES 需訂閱；未繞過限制。[AES 原始頁](https://aes2.org/publications/elibrary-page/?id=5663)

### P10 — Schlecht & Habets，2016 預印本

**問題／方法／模型**：完整刻畫對不同 delay lengths 仍無損的 feedback matrices；以 FDN characteristic polynomial 證明條件，提出 eigenvalue-only 檢查不足的反例。**資料／實驗**：數學證明與小矩陣反例，不是房間量測。**假設／限制**：離散固定線性系統，無損 pole condition 不是時變參數穩定保證。**工程／重現／本案**：先用 orthogonal matrix 與被動 damping 的可檢查原型；含所有 delay 的系統需再做 long-tail 測試。可獨立重算反例，本次尚未執行。**證據**：FULL_TEXT_REVIEWED，§II–III。[全文](https://arxiv.org/pdf/1606.07729)

### P11 — Laakso et al.，1996

**問題／貢獻**：fractional sample delay 的 FIR／all-pass 設計入口。**方法／數學／資料**：本次僅核實 Aalto／IEEE 書目，未核實全文圖表與性能數字。**假設／限制**：帶限插值不是無條件完美 delay；固定與時變 filter 不可混用驗證結論。**工程／重現／本案**：本案 linear interpolation 的 transfer function 直接推導並測試；升級 windowed-sinc／all-pass 前另查全文或官方教材，不能憑論文存在便宣告高頻誤差合格。**證據**：METADATA_ONLY。[作者機構頁](https://research.aalto.fi/en/publications/splitting-the-unit-delay-tools-for-fractional-delay-filter-design/)

## 正式量測標準與介質

這五份 ISO 均僅讀官方公開範圍，不保存付費正文。它們是正式技術來源，但本案未宣告照標準完成量測、完整公式實作或合規認證。

### S01 — ISO 9613-1:1993

**問題／方法**：在氣象條件下計算大氣吸收；頻率、溫度、RH、壓力為輸入。**數學／資料**：公開範圍核實，完整公式／係數表未取得。**假設／限制**：不是對每個室內 near-field 情境的全傳播模型，也不包含所有反射與幾何衰減。**工程／重現／本案**：air-loss module 分開 c 與 absorption；僅驗證 `α d → 10^(-αd/20)` 轉換與單位，數值 ISO 係數留待合法完整參考。**證據**：ABSTRACT_ONLY。[官方頁](https://www.iso.org/standard/17426.html)

### S02 — ISO 354:2003

**問題／方法／資料**：混響室量測材料吸音或物件等效吸音面積；官方範圍明列不適用弱阻尼共振器。**數學**：完整程序與不確定度式未讀，未聲稱已重現。**假設／限制**：安裝與測試場條件是結果的一部分，不能與正入射數字直接互換。**工程／本案**：保存 mounting、thickness、frequency bands、method；不從「木頭」名稱生成 Measured 系數。**重現**：需要合適量測設備與授權標準；本次未做。[官方頁](https://www.iso.org/standard/34545.html)

### S03 — ISO 10534-2:2023，2025 corrected

**問題／方法／資料**：阻抗管兩麥克風技術求正入射 absorption 與 surface impedance。**數學**：未讀完整 transfer-function／校正程序。**假設／限制**：官方明說局部反應材料才可由此估 diffuse-incidence；與混響室法有條件差異。**工程／本案**：import record 要保留 normal incidence、複數阻抗與背襯；1998 年舊版不能誤標最新。**重現**：本次未量測；完整標準及設備校正待取得。[官方頁](https://www.iso.org/standard/81294.html)

### S04 — ISO 17497-1:2004，Amd 1:2014

**問題／方法／資料**：在混響室量測粗糙表面的 random-incidence scattering，表示偏離 specular 的程度。**數學**：完整測試公式未讀。**假設／限制**：官方特別說不評估散射空間均勻性；不能把 scattering 直接當 diffusion uniformity。**工程／本案**：資料 schema 分開 `scatteredFraction` 和 scattering direction distribution，跨引擎對照需查定義。**重現**：本次未做房間／scale-model 測試。[官方頁](https://www.iso.org/standard/31397.html)

### S05 — ISO 3382-1:2009

**問題／方法／資料**：performance spaces 的 RT 及其他 RIR room parameters 量測／報告。**數學**：公開摘要不含完整分析規定，本案 metric 定義是顯式 contract，尚非 ISO 合規重現。**假設／限制**：裝置、coverage、data evaluation、報告都是量測的一部分；單一漂亮 RT 值不足。**工程／本案**：保存頻帶、time zero、noise handling、fit 範圍，缺動態範圍回傳 insufficient data。**重現**：synthetic metric 可先測，真實標準量測另需完整參考與設備。[官方頁](https://www.iso.org/standard/40979.html)

### T01 — NASA Glenn，2021 更新

**問題／方法／模型**：由質量、動量、等熵與理想氣體關係導出 `c²=γRT`。**資料／實驗**：理論教材，沒有本案濕空氣量測資料。**假設／限制**：小擾動、固定組成理想氣體；濕度／組成另影響參數。**工程／重現／本案**：嚴格 Kelvin、specific gas constant 單位；固定 c 的測試與環境模型分離，避免先把 343 當普遍量測真值。**證據**：OFFICIAL_DOCUMENTATION，完整短頁。[NASA](https://www.grc.nasa.gov/www/k-12/BGP/snddrv.html)

### T02 — OpenStax University Physics §17.7，2016

**問題／方法／模型**：從波峰的發射／接收時間求 moving source／observer Doppler，介質靜止且 source 亞音速。**資料／實驗**：教科書解析例題，非 Reflection Lab 實測。**假設／限制**：簡化一維徑向運動；一般加速軌跡要 retarded-time 幾何。**工程／重現／本案**：以符號明確的解析匀速例題測正負方向；本案向量式由 retarded equation 微分獨立推導。**證據**：FULL_TEXT_REVIEWED。[原始教材](https://openstax.org/books/university-physics-volume-1/pages/17-7-the-doppler-effect)

### T03–T04 — pyroomacoustics 0.10.0 官方文件

**問題／方法／模型**：提供可編程 shoebox／general room ISM 與實驗性 ray hybrid、頻帶材質及 RIR。**資料／實驗**：文件例子可重作，尚未執行或取得本案 V3 數字。**假設／限制**：官方 warning 明列舊 `absorption` 與現在 energy absorption 不同；hybrid 尚有實驗性，RIR 有 fractional delay offset 與預設 filtering。**工程／本案**：適合作獨立參考，不作唯一真值；關閉／報告 randomization、濾波、offset，固定版本與 seeds。**重現**：依 catalog 取得並記錄版號與參數；不可把自身 simulator 生成資料稱 measured。[Parameters](https://pyroomacoustics.readthedocs.io/en/pypi-release/pyroomacoustics.parameters.html)、[Room](https://pyroomacoustics.readthedocs.io/en/pypi-release/pyroomacoustics.room.html)

## 綜合判斷與研究邊界

優先驗證靜態幾何、動態 Source／Listener、有限一階反射、明確材質能量定義與持續播放音訊。late reverb、低頻波動、真實 modal impact 是分層能力，不能以一個「物理音效」開關混在一起。幾何路徑正確、DSP 正確、獨立 solver 相符、真實量測與聽覺可接受度是不同證據層級。

公開全文已有足夠方法基礎建立前期解析 benchmarks；尚待補強的是受限文獻全文、完整 ISO 數值程序、個別量測資料授權與實際 V3–V5 結果。所有 engine 效能、perceptual quality、頻帶轉換誤差與動態 crossfade 時間都仍需測量，不能從舊文獻直接繼承數字。
