# 科學來源索引

查核日期：2026-10-26。此為 Reflection Lab 前期研究，沒有正式產品效能或聲學合格宣告。`P` 為論文、`S` 為正式標準、`T` 為官方技術教材／參考實作；表內 **20 筆**加上 [碰撞與波動研究](COLLISION_WAVE_NOTES.md) 的來源，涵蓋 Phase C。逐篇方法、假設與實驗限制見 [LITERATURE_REVIEW.md](LITERATURE_REVIEW.md)；公式的專案採用條件見 `research/theory/`；可機讀主張見 `research/EVIDENCE_LEDGER.json`。

存取標記：`FULL_TEXT_REVIEWED`＝透過合法公開全文查閱方法與限制相關段落，並非重現其實驗；`PARTIAL_TEXT`＝僅能讀到可檢索全文片段；`ABSTRACT_ONLY`＝官方摘要／適用範圍；`METADATA_ONLY`＝僅核實書目；`OFFICIAL_DOCUMENTATION`＝已讀官方網頁技術內容。可下載不等於可再散布。本庫只保存原創摘要與連結，不收錄第三方論文全文。

| ID | Title、Authors、Year | Publication / DOI 或原始來源 | 已查閱內容 |
|---|---|---|---|
| P01 | *Image method for efficiently simulating small-room acoustics* — Jont B. Allen、David A. Berkley，1979 | JASA 65(4), 943–950；[DOI 10.1121/1.382599](https://doi.org/10.1121/1.382599)；[作者公開 PDF](https://jontalle.web.engr.illinois.edu/Public/AllenBerkley79.pdf) | PARTIAL_TEXT：公開 PDF 的搜尋可檢索內容可讀，直接開啟 403；未宣稱完整閱讀 |
| P02 | *Extension of the image model to arbitrary polyhedra* — Jeffrey Borish，1984 | JASA 75(6), 1827–1836；[DOI 10.1121/1.390983](https://doi.org/10.1121/1.390983) | METADATA_ONLY：書目另由 [INIST](https://pascal-francis.inist.fr/vibad/index.php?action=getRecordDetail&idt=8867916) 核對；有限面演算法以 P05 全文與獨立幾何推導交叉支持 |
| P03 | *A Beam Tracing Approach to Acoustic Modeling for Interactive Virtual Environments* — Thomas Funkhouser、Ingrid Carlbom、Gary Elko、Gopal Pingali、Mohan Sondhi、Jim West，1998 | SIGGRAPH '98, 21–32；[DOI 10.1145/280814.280818](https://doi.org/10.1145/280814.280818)；[作者 PDF](https://www.cs.princeton.edu/~funk/sig98.pdf) | PARTIAL_TEXT：作者 PDF 可檢索片段及 ACM 書目；直接 PDF 403 |
| P04 | *Real-Time Acoustic Modeling for Distributed Virtual Environments* — Thomas A. Funkhouser、Patrick Min、Ingrid Carlbom，1999 | SIGGRAPH '99, 365–374；[DOI 10.1145/311535.311590](https://doi.org/10.1145/311535.311590)；[作者出版頁](https://pixl.cs.princeton.edu/gfx/pubs/Funkhouser_1999_RAM/index.php) | ABSTRACT_ONLY：作者摘要與 ACM 書目 |
| P05 | *Geometry Reduction in Room Acoustics Modeling* — Samuel Siltanen、Tapio Lokki、Lauri Savioja、Claus Lynge Christensen，2008 | Acta Acustica united with Acustica 94, 410–418；[DOI 10.3813/AAA.918049](https://doi.org/10.3813/AAA.918049)；[作者全文](https://users.aalto.fi/~ktlokki/Publs/siltanen_aaua_2008.pdf) | FULL_TEXT_REVIEWED：§1 幾何方法、§2 octree／表面重建、§3–4 限制與評估 |
| P06 | *Interactive Sound Rendering on Mobile Devices using Ray-Parameterized Reverberation Filters* — Carl Schissler、Dinesh Manocha，2018 | [arXiv:1803.00430v1](https://arxiv.org/abs/1803.00430)；[全文](https://arxiv.org/pdf/1803.00430)；本索引以預印本版本為準，不臆填正式 DOI | FULL_TEXT_REVIEWED：§3–4、§7–8、補充材料 §9–10 |
| P07 | *Natural Sounding Artificial Reverberation* — Manfred R. Schroeder，1962 | JAES 10(3), 219–223；[AES](https://aes2.org/publications/elibrary-page/?id=849)；[大學公開全文](https://hajim.rochester.edu/ece/sites/zduan/teaching/ece472/reading/Schroeder_1962.pdf) | FULL_TEXT_REVIEWED：all-pass、comb、衰減與延遲關係；AES 版本另需訂閱 |
| P08 | *New Method of Measuring Reverberation Time* — Manfred R. Schroeder，1965 | JASA 37, 409–412；[DOI 10.1121/1.1909343](https://doi.org/10.1121/1.1909343)；[大學公開 PDF](https://labrosa.ee.columbia.edu/~dpwe/papers/Schro65-reverb.pdf) | PARTIAL_TEXT：可檢索摘要、導論、理論開頭；直接 PDF timeout |
| P09 | *Digital Delay Networks for Designing Artificial Reverberators* — Jean-Marc Jot、Antoine Chaigne，1991 | AES 90th Convention, paper 3030；[AES 原始出版頁](https://aes2.org/publications/elibrary-page/?id=5663)；未找到 DOI，保留 UNKNOWN | ABSTRACT_ONLY：訂閱全文未取得；一般 FDN 方程與穩定條件另用 P10 |
| P10 | *On Lossless Feedback Delay Networks* — Sebastian J. Schlecht、Emanuel A. P. Habets，2016 預印本 | [arXiv:1606.07729v1](https://arxiv.org/abs/1606.07729)；[全文](https://arxiv.org/pdf/1606.07729)；版本依預印本標示 | FULL_TEXT_REVIEWED：§II 方程、反例；§III 無損矩陣條件與證明 |
| P11 | *Splitting the Unit Delay—Tools for Fractional Delay Filter Design* — Timo I. Laakso、Vesa Välimäki、Matti Karjalainen、Unto K. Laine，1996 | IEEE Signal Processing Magazine 13(1), 30–60；[DOI 10.1109/79.482137](https://doi.org/10.1109/79.482137)；[Aalto 出版頁](https://research.aalto.fi/en/publications/splitting-the-unit-delay-tools-for-fractional-delay-filter-design/) | METADATA_ONLY：書目核實；未以此來源單獨支持特定濾波器性能 |
| S01 | *ISO 9613-1:1993 — Attenuation of sound during propagation outdoors — Part 1: Calculation of the absorption of sound by the atmosphere* — ISO，1993 | [官方頁](https://www.iso.org/standard/17426.html) | ABSTRACT_ONLY：標準範圍與氣象參數；未取得授權完整標準 |
| S02 | *ISO 354:2003 — Measurement of sound absorption in a reverberation room* — ISO，2003 | [官方頁](https://www.iso.org/standard/34545.html) | ABSTRACT_ONLY：混響室吸音量測用途及弱阻尼共振器除外範圍 |
| S03 | *ISO 10534-2:2023 — Determination of acoustic properties in impedance tubes — Part 2: Two-microphone technique for normal sound absorption coefficient and normal surface impedance* — ISO，2023，2025-08 corrected version | [官方頁](https://www.iso.org/standard/81294.html) | ABSTRACT_ONLY：兩麥克風法、正入射、局部反應假設；1998 版已撤銷 |
| S04 | *ISO 17497-1:2004 — Sound-scattering properties of surfaces — Part 1: Measurement of the random-incidence scattering coefficient in a reverberation room* — ISO，2004；Amd 1:2014 | [官方頁](https://www.iso.org/standard/31397.html) | ABSTRACT_ONLY：偏離鏡面反射的比例，不等於空間散射均勻程度 |
| S05 | *ISO 3382-1:2009 — Measurement of room acoustic parameters — Part 1: Performance spaces* — ISO，2009 | [官方頁](https://www.iso.org/standard/40979.html) | ABSTRACT_ONLY：RIR 量測與報告範圍；本庫不宣稱 ISO 量測合規 |
| T01 | *Speed of Sound Derivation* — NASA Glenn Research Center，Tom Benson（editor），2021 更新 | [官方教材](https://www.grc.nasa.gov/www/k-12/BGP/snddrv.html) | OFFICIAL_DOCUMENTATION：小擾動、等熵理想氣體聲速推導 |
| T02 | *University Physics Volume 1*, §17.7 *The Doppler Effect* — Samuel J. Ling、Jeff Sanny、William Moebs / OpenStax，2016 | [官方教科書章節](https://openstax.org/books/university-physics-volume-1/pages/17-7-the-doppler-effect) | FULL_TEXT_REVIEWED：移動聲源／接收者、介質靜止、亞音速假設及推導 |
| T03 | *Simulation and Control Parameters* — LCAV / pyroomacoustics contributors，0.10.0 文件，查閱 2026 | [官方文件](https://pyroomacoustics.readthedocs.io/en/pypi-release/pyroomacoustics.parameters.html) | OFFICIAL_DOCUMENTATION：energy_absorption、scattering、頻帶、fractional delay、氣象介面 |
| T04 | *Room Simulation* — LCAV / pyroomacoustics contributors，0.10.0 文件，查閱 2026 | [官方文件](https://pyroomacoustics.readthedocs.io/en/pypi-release/pyroomacoustics.room.html) | OFFICIAL_DOCUMENTATION：ISM／hybrid、deprecated absorption、RIR 處理延遲 |

## 碰撞聲音與波動方法補充索引

以下七筆的完整 C7 欄位分析、取用失敗與重現限制在 [COLLISION_WAVE_NOTES](COLLISION_WAVE_NOTES.md)，合併為本研究的核心來源，不是僅列延伸閱讀。

| ID | Title、Authors、Year | Publication / DOI 或原始來源 | 已查閱內容 |
|---|---|---|---|
| CW01 | *FoleyAutomatic: Physically-based Sound Effects for Interactive Simulation and Animation* — Kees van den Doel、Paul G. Kry、Dinesh K. Pai，2001 | SIGGRAPH 2001；[DOI 10.1145/383259.383322](https://doi.org/10.1145/383259.383322)；[作者全文](https://www.cs.ubc.ca/labs/lci/papers/docs2001/van-foleyautomatic.pdf) | FULL_TEXT_REVIEWED，§2–5；impact／sliding／rolling、模態與粗糙度 |
| CW02 | *Synthesizing Sounds from Physically Based Motion* — James F. O’Brien、Perry R. Cook、Georg Essl，2001 | SIGGRAPH 2001；[DOI 10.1145/383259.383321](https://doi.org/10.1145/383259.383321)；[作者全文](https://jamesobrien.com/papers/Obrien-SSF-2001-08/Obrien-SSF-2001-08.pdf) | FULL_TEXT_REVIEWED，§3–5；固體 FEM、表面輻射近似 |
| CW03 | *Toward High-Quality Modal Contact Sound* — Changxi Zheng、Doug L. James，2011 | ACM TOG 30(4), Article 38；[DOI 10.1145/1964921.1964933](https://doi.org/10.1145/1964921.1964933)；[作者頁](https://www.cs.cornell.edu/projects/Sound/mc/) | PARTIAL_TEXT，作者頁、PDF 索引 §1–2／Fig.3；全文檔案超過工具大小限制 |
| CW04 | *Revisiting Implicit Finite Difference Schemes for 3-D Room Acoustics Simulations on GPU* — Brian Hamilton、Stefan Bilbao、Craig J. Webb，2014 | DAFx-14；[正式 proceedings 全文](https://www.dafx.de/paper-archive/2014/dafx14_brian_hamilton_revisiting_implicit_finit.pdf)；DOI UNKNOWN | FULL_TEXT_REVIEWED，§2–9、Appendix；27-point、Jacobi、色散與穩定 |
| CW05 | *Finite Volume Time Domain Room Acoustics Simulation under General Impedance Boundary Conditions* — Stefan Bilbao、Brian Hamilton、Jonathan Botts、Lauri Savioja，2016 | IEEE/ACM TASLP 24(1), 161–173；[DOI 10.1109/TASLP.2015.2500018](https://doi.org/10.1109/TASLP.2015.2500018) | ABSTRACT_ONLY，Aalto 官方頁；accepted manuscript timeout／403 |
| CW06 | *Fast multipole accelerated boundary element methods for room acoustics* — Nail A. Gumerov、Ramani Duraiswami，2021 | [arXiv:2103.16073v1 全文](https://arxiv.org/html/2103.16073v1)；以預印本版本為準 | FULL_TEXT_REVIEWED，§2–4；FMMBEM、邊界條件對照差異 |
| CW07 | *A Review of Finite Element Methods for Room Acoustics* — Albert G. Prinn，2023 | Acoustics 5(2), 367–395；[DOI 10.3390/acoustics5020022](https://doi.org/10.3390/acoustics5020022) | PARTIAL_TEXT，publisher XML 索引；直接開啟 429 |

## 研究缺口的處理

`METADATA_ONLY`／`ABSTRACT_ONLY` 不足以支持論文內尚未讀到的誤差、性能數字、演算法細節或量測認證。這些來源仍有書目與範圍判斷價值；相關實作必須由已讀的獨立來源、清楚標記的推導與 V1–V5 驗證補強。未讀全文的歷史論文不是阻止建立鏡像幾何解析測試的理由，但也不能把解析測試通過寫成原論文實驗重現。
