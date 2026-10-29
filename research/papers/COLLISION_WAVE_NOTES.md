# 碰撞聲音與波動求解研究筆記

查核日：2026-10-26（Asia/Taipei）。本檔是原創研究摘要，不保存論文全文、圖表或音訊；線上可閱讀不等於可再散布。`FULL_TEXT_REVIEWED` 表示已開啟正文並查閱方法與結果段落，並非逐式重現；`PARTIAL_TEXT_REVIEWED` 表示僅能取得可檢索的部分正文；`ABSTRACT_ONLY` 不支撐未讀到的演算法細節。此處沒有執行任何論文程式或聽覺實驗。

## CW01 — FoleyAutomatic

| 欄位 | 查核結果 |
|---|---|
| Title / Authors / Year | *FoleyAutomatic: Physically-based Sound Effects for Interactive Simulation and Animation*；Kees van den Doel、Paul G. Kry、Dinesh K. Pai；2001 |
| DOI / Publication Type | [10.1145/383259.383322](https://doi.org/10.1145/383259.383322)；SIGGRAPH 2001 同行審查會議論文，537–544 |
| Access / Evidence | `FULL_TEXT_REVIEWED`；[UBC 作者公開 PDF](https://www.cs.ubc.ca/labs/lci/papers/docs2001/van-foleyautomatic.pdf)，§2–5；[作者 BibTeX](https://www.cs.mcgill.ca/~kry/pubs/foleyautomatic/vandenDoelKryPai01bibtex.htm) 核對 DOI |
| Research Problem | 如何由低更新率剛體接觸資料連續產生敲擊、刮擦與滾動聲音。 |
| Methodology / Mathematical Model | 阻尼振盪器模態庫由接觸位置決定激發權重；另以音訊取樣率產生微觀接觸力。衝擊以有限持續時間力脈衝表達硬度；刮擦以沿表面移動的粗糙度激發，摩擦功率作強度依據。 |
| Data / Experiment | 實物 wok 模態量測、石頭落入 wok、球在有紋理表面滾動與互動 bell 示範；§5.1 明言聲音品質以非正式方式比較。 |
| Assumptions / Limitations | 小振幅模態疊加；粗糙度及 audio-force 是物理啟發近似。作者明言並非從第一原理完整導出；rolling 模型及其知覺改善仍待進一步評估。 |
| Engineering Applicability / Reproducibility | 分離固定步長 dynamics 與 audio-rate excitation；記錄位置、速度、平均法向力及衝量。可依公式重作簡化版本；本次未確認原始程式／量測音訊之再散布授權。 |
| Reflection Lab | 支持連續摩擦狀態與瞬時 impact event 分流；屬 P2 模態聲音研究，P0 使用樣本觸發時必須標記為 approximation。 |

## CW02 — 從可變形運動產生聲音

| 欄位 | 查核結果 |
|---|---|
| Title / Authors / Year | *Synthesizing Sounds from Physically Based Motion*；James F. O’Brien、Perry R. Cook、Georg Essl；2001 |
| DOI / Publication Type | [10.1145/383259.383321](https://doi.org/10.1145/383259.383321)；SIGGRAPH 2001 同行審查會議論文，529–536 |
| Access / Evidence | `FULL_TEXT_REVIEWED`；[作者頁](https://jamesobrien.com/papers/Obrien-SSF-2001-08/index.html)、[作者公開 PDF](https://jamesobrien.com/papers/Obrien-SSF-2001-08/Obrien-SSF-2001-08.pdf)，§3–5。Berkeley 原 URL 曾 timeout；改用作者頁既有下載連結。 |
| Research Problem | 如何將固體表面微小振動與聲音建立連結，而不只根據剛體位移播放預錄樣本。 |
| Methodology / Mathematical Model | 非線性四面體 FEM 產生形變；表面法向速度轉成壓力近似，再帶限／降採樣。局部關係使用 `p ≈ ρ c v_n`；向接收點累加帶傳播延遲、可見性與方向權重的面片貢獻。 |
| Data / Experiment | 金屬 bowl 落下、受激 bar 的頻譜與理論模態對照，以及其他形變例子；並非 Reflection Lab 的量測驗證。 |
| Assumptions / Limitations | 線性空氣聲學；輻射步驟假設無反射並忽略障礙繞射，面片方向性是粗略近似。固體高頻振動需要遠細於一般遊戲 physics step 的時間解析度。 |
| Engineering Applicability / Reproducibility | 有方程、網格／時間步與示例方法可供重作；未確認可再散布的原始程式。不能把該面片輻射公式當完整 FEM/BEM 耦合聲場，亦不能宣稱剛體引擎直接提供真實振動。 |
| Reflection Lab | 明確區分 `RigidBodyMotion`、`VibrationExcitation`、`Radiation`、`RoomPropagation`；用作離線研究參考。 |

## CW03 — 模態與接觸耦合

| 欄位 | 查核結果 |
|---|---|
| Title / Authors / Year | *Toward High-Quality Modal Contact Sound*；Changxi Zheng、Doug L. James；2011 |
| DOI / Publication Type | [10.1145/1964921.1964933](https://doi.org/10.1145/1964921.1964933)；ACM TOG 30(4), Article 38，SIGGRAPH 2011 |
| Access / Evidence | `PARTIAL_TEXT_REVIEWED`；[Cornell 作者專案頁](https://www.cs.cornell.edu/projects/Sound/mc/)、[作者 PDF](https://www.cs.cornell.edu/projects/Sound/mc/ModalContactSound2011.pdf) 的可檢索正文 §1–2／Fig.3；完整 PDF 抓取因 12 MB 上限失敗。DOI 亦由 [Stanford 作者資料](https://profiles.stanford.edu/doug-james) 核對。 |
| Research Problem | 為何直接把剛體接觸衝量送入模態濾波器會出現嗡聲、接觸不連續與漏掉微碰撞。 |
| Methodology / Mathematical Model | 將模態形變納入摩擦接觸；修改 Staggered Projections，採模態適應的非同步積分、衝量重分配及接觸相關阻尼。概念上為剛體自由度與線性模態座標共同解接觸；完整離散式本次未逐式核實。 |
| Data / Experiment | 作者頁與可讀正文展示多物體 clatter／微碰撞、桌面振動傳遞等離線情境；未讀取完整數值表與補充影片。 |
| Assumptions / Limitations | 小模態形變；目標是高品質離線合成。本次證據不能支持瀏覽器即時效能或特定精度數字。 |
| Engineering Applicability / Reproducibility | 支持將接觸 chatter 視為需要驗證的 solver artifact；完整重現仍需取得全文、實作 contact solver，並核對附屬資產授權。 |
| Reflection Lab | P0 在樣本層需事件去重、靜止閾值與接觸狀態；這些是工程防護，不能冒稱已重現該論文。 |

## CW04 — 隱式 FDTD 與 GPU

| 欄位 | 查核結果 |
|---|---|
| Title / Authors / Year | *Revisiting Implicit Finite Difference Schemes for 3-D Room Acoustics Simulations on GPU*；Brian Hamilton、Stefan Bilbao、Craig J. Webb；2014 |
| DOI / Publication Type | DOI 本次未確認；DAFx-14 同行審查會議論文；[官方 proceedings PDF](https://www.dafx.de/paper-archive/2014/dafx14_brian_hamilton_revisiting_implicit_finit.pdf) |
| Access / Evidence | `FULL_TEXT_REVIEWED`；§2–9 與 Appendix，八頁。 |
| Research Problem | 3D 波動網格的數值色散與空間細化成本，能否以較準確的隱式 stencil 改善。 |
| Methodology / Mathematical Model | 常數聲速標量波動方程；27-point 空間離散及隱式時間更新，每步用 Jacobi 解稀疏線性系統；分析色散、穩定性與殘差。 |
| Data / Experiment | 立方室模態與理論頻率比較、固定 Jacobi 次數殘差、有限精度穩定性；另報 Tesla K20 CUDA 計時。原文硬體數字不外推到現代 WebGPU／瀏覽器。 |
| Assumptions / Limitations | 文中此版本主要為規整網格與頻率無關損耗邊界；穩定性不等於低色散，浮點捨入仍需長時間測試。 |
| Engineering Applicability / Reproducibility | 給出 stencil、邊界矩陣與求解形式，可獨立重作立方室小案例；本次未編譯 CUDA 或重跑數值實驗。 |
| Reflection Lab | 適合離線低頻交叉驗證；不足以據此承諾全頻、動態幾何、即時波動 solver。 |

## CW05 — 一般阻抗邊界 FVTD

| 欄位 | 查核結果 |
|---|---|
| Title / Authors / Year | *Finite Volume Time Domain Room Acoustics Simulation under General Impedance Boundary Conditions*；Stefan Bilbao、Brian Hamilton、Jonathan Botts、Lauri Savioja；2016 |
| DOI / Publication Type | [10.1109/TASLP.2015.2500018](https://doi.org/10.1109/TASLP.2015.2500018)；IEEE/ACM TASLP 24(1), 161–173。DOI 的 2015 不等於正式刊期年份。 |
| Access / Evidence | `ABSTRACT_ONLY` 加出版 metadata；[Aalto 官方出版頁](https://research.aalto.fi/en/publications/finite-volume-time-domain-room-acoustics-simulation-under-general/)；[Edinburgh accepted manuscript](https://www.pure.ed.ac.uk/ws/portalfiles/portal/22154168/fv_genimp_final_r3.pdf) 抓取 timeout，另一官方入口 403。 |
| Research Problem | 非規則室內幾何及一般局部反應阻抗牆，如何獲得能量穩定的時間域離散。 |
| Methodology / Mathematical Model | FVTD 及數值能量分析；規整網格特例可落回 FDTD。實際邊界離散式本次未取得全文，不能引用為已核實公式。 |
| Data / Experiment | 官方摘要明列室內模擬及頻率相關模態衰減案例；未核實網格尺寸、誤差或計時數值。 |
| Assumptions / Limitations | 局部反應阻抗；邊界幾何與擬合網格影響模態衰減。摘要不能證明任意測得吸音係數都可無損轉成穩定濾波邊界。 |
| Engineering Applicability / Reproducibility | 下一階段若導入波動 solver，必須合法取得全文、驗證 passivity 並重跑模態衰減；目前僅作研究路線。 |
| Reflection Lab | 提醒材料的複數阻抗、頻帶能量係數與數值濾波器不是同一種資料。 |

## CW06 — 加速 BEM 房間聲學

| 欄位 | 查核結果 |
|---|---|
| Title / Authors / Year | *Fast multipole accelerated boundary element methods for room acoustics*；Nail A. Gumerov、Ramani Duraiswami；2021 |
| DOI / Publication Type | arXiv:2103.16073v1；此處引用 preprint，不將其標為已核實期刊版本；[全文 HTML](https://arxiv.org/html/2103.16073v1) |
| Access / Evidence | `FULL_TEXT_REVIEWED`；§2–4，特別是 §4.1 對照的邊界條件差異。arXiv 頁標示 CC BY-NC-SA 4.0；本專案只保存連結與摘要。 |
| Research Problem | 高波數房間問題的 dense BEM 系統與 fast multipole 遞迴穩定性。 |
| Methodology / Mathematical Model | 頻域 Helmholtz 方程、局部反應複數阻抗、direct／indirect boundary integral，FMM 加速與 flexible GMRES。 |
| Data / Experiment | Shoebox 與 image-source 對照；L 型房間、開口與擋板示例。§4.1 說明兩模型邊界條件不一致，差值不能全歸為 BEM 離散誤差。 |
| Assumptions / Limitations | 均勻常聲速、線性聲學、固定幾何、局部反應邊界；迭代收斂受吸收、幾何與 preconditioner 設定影響。 |
| Engineering Applicability / Reproducibility | 場景與方程足供設計交叉測試；本次未取得／執行作者 solver。比較時固定 source、boundary model、頻帶與時間截斷。 |
| Reflection Lab | 適合獨立離線波動參考；不宣稱可直接作互動 audio callback backend。 |

## CW07 — FEM 室內聲學綜述

| 欄位 | 查核結果 |
|---|---|
| Title / Authors / Year | *A Review of Finite Element Methods for Room Acoustics*；Albert G. Prinn；2023 |
| DOI / Publication Type | [10.3390/acoustics5020022](https://doi.org/10.3390/acoustics5020022)；Acoustics 5(2), 367–395，同儕審查綜述 |
| Access / Evidence | `PARTIAL_TEXT_REVIEWED`；[期刊頁](https://www.mdpi.com/2624-599X/5/2/22)、[XML 正文入口](https://www.mdpi.com/2624-599X/5/2/22/xml) 的可檢索方法段落；直接開啟回傳 429。 |
| Research Problem | FEM 在複雜幾何、波主導頻段、頻率相關複數邊界中的方法與用途。 |
| Methodology / Mathematical Model | 綜述頻域 Helmholtz FEM、特徵值／模態座標等方法；並非新的單一 solver。`(K − ω²M + boundary terms) p = f` 為本專案的概括記法，不是逐字引用原文方程。 |
| Data / Experiment | 此為方法史與研究整理；本次未完整閱讀其引用試驗，不能把二手整理當作自行驗證。 |
| Assumptions / Limitations | 低頻波動問題仍需網格收斂、正確邊界、可追溯輸入；模型複雜度並不自動等於量測準確度。 |
| Engineering Applicability / Reproducibility | 作低頻 FEM 工具選擇與術語入口；正式採用前讀原始驗證論文、固定網格與求解容差。 |
| Reflection Lab | P2／離線參考；P0 不建構全頻 FEM room solver。 |

## 跨來源結論與待查

- `SampleBasedImpact`：以接觸事件選擇樣本，再以經驗規則調整 gain／pitch；能達成互動回饋，未提供物體振動預測。
- `ModalImpact`：需要模態頻率、阻尼、接觸位置權重與激發波形；只有「金屬」字串或衝量不足以決定真實頻譜。
- `CoupledModalContact`：接觸與模態互相影響，成本與數值難度高於把衝量送入濾波器。CW03 為研究支持；本專案尚未實作。
- `WaveRoomSolver`：解空氣聲場；與求固體振動的 FEM 不同。低頻數值參考可用來找出幾何聲學漏掉的模態／干涉，兩者須先對齊邊界條件。
- 未核實：CW03 完整公式與數值表、CW05 全文、CW07 全文、各作者程式／附屬影音授權。這些限制應保留在 evidence ledger，不能因文獻存在就記為 `Technical Spike Verified`。
