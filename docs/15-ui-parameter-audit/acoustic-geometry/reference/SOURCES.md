# 曲面幾何聲學：來源與主張界線

查核時間：2026-11-02T07:24:44Z。本文件只核對 Task0030 的科學來源與適用範圍，不是程式、音訊或真實房間驗收。機讀版本見 [SOURCES.json](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/22a499b577dc5129b1d62c906a4f455b66c8e8b6)；既有背景見 [ACOUSTIC_THEORY](../../../../research/theory/ACOUSTIC_THEORY.md) 與 [PAPER_INDEX](../../../../research/papers/PAPER_INDEX.md)。

## 原始來源與實際讀取範圍

| ID                      | 來源、版本與定位                                                                                                                                                                                                                                                                              | 本次可支持的範圍                                                                                 |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| CG-SRC-FERMAT-CALTECH26 | [Caltech《Feynman Lectures》I §26-3、§26-5](https://www.feynmanlectures.caltech.edu/I_26.html)，官方線上章節；本次未另外核實網頁版出版年。                                                                                                                                                    | Fermat 的精確條件是一階行時駐值，不是所有可想像路徑的無條件全域最短。                            |
| CG-SRC-FANG2014         | [Nick Fang，MIT 2.71/2.710，2014-02-10 講義](https://ocw.mit.edu/courses/2-71-optics-spring-2014/d558a4fabb2cc2eee8f864d3928b31f6_MIT2_71S14_lec2_notes.pdf)，相關印刷頁 1、4–6。                                                                                                             | 幾何路徑近似、Fermat、平面/曲面反射的適用原理；不是本專案特定演算法的原始碼或測試。              |
| CG-SRC-LYNCH2012        | [MIT 2.682，Lecture #4–5](https://ocw.mit.edu/courses/2-682-acoustical-oceanography-spring-2012/912f81a910bbd70f22a2be6e25113d09_MIT2_682S12_lec04.pdf)，相關印刷頁 3–6；[課程頁](https://ocw.mit.edu/courses/2-682-acoustical-oceanography-spring-2012/)列教師 James Lynch。PDF 未另列作者。 | 強度需射線管擴散/transport 資訊，焦散與陰影區有射線近似病態；不能只由單一路長證明完整振幅。      |
| CG-SRC-BREMMER1982      | [H. Bremmer、S. W. Lee，Radio Science 17(5)，1117–1131，1982](https://agupubs.onlinelibrary.wiley.com/doi/abs/10.1029/RS017i005p01117)，DOI 10.1029/RS017i005p01117。**只讀官方摘要與書目**。                                                                                                 | 反射波前曲率與反射面、入射波前曲率有關，摘要涉及 divergence coefficients；未核對全文公式或數值。 |
| CG-SRC-SFU-REFLECTION   | [Simon Fraser University，Handbook for Acoustic Ecology：Reflection](https://www.sfu.ca/sonic-studio-webdav/cmns/Handbook5/handbook/Reflection.html)，無標示出版年，讀取短頁全文。                                                                                                            | 聲反射角度法則及波長相對表面尺度的條件；不證明低頻小物體的實際響應。                             |

本庫只保存原創摘要與連結，不保存或重散布第三方 PDF、圖片或全文；遠端內容未固定原始 bytes，因此第三方全文 SHA256 為 null。查核日不冒充出版年；來源可公開閱讀不代表可任意再散布。

## 本專案可採用的主張

- **CG-REF-001／Derived + V0 來源範圍**：均勻介質下，受表面約束的反射候選應符合路徑長度一階駐值及局部法向反射法則。只有在另已證明的外部凸體共同可見域，才可將特定候選的駐值問題化為最短有效反射路徑；不能把這個特例當成一般 Fermat 的全域最短定理。[Caltech §26-5](https://www.feynmanlectures.caltech.edu/I_26.html)、[MIT 2014](https://ocw.mit.edu/courses/2-71-optics-spring-2014/d558a4fabb2cc2eee8f864d3928b31f6_MIT2_71S14_lec2_notes.pdf) 支持原理，具體球/膠囊化簡由本案推導與 V1 fixture 支持。
- **CG-REF-002／V0**：曲面路徑是幾何近似，不是全波遮蔽/反射。特別在波長與物體尺度相近或更大時，不以此宣稱低頻真實精度。[SFU 反射教材](https://www.sfu.ca/sonic-studio-webdav/cmns/Handbook5/handbook/Reflection.html)。
- **CG-REF-003／V0**：反射位置與延遲的幾何正確性，不足以證明振幅正確。振幅/強度另依賴幾何擴散/射線管傳輸。[MIT 2012，pp.3–6](https://ocw.mit.edu/courses/2-682-acoustical-oceanography-spring-2012/912f81a910bbd70f22a2be6e25113d09_MIT2_682S12_lec04.pdf)。
- **CG-REF-004／工程限制**：沿用 `1/pathLength × sqrt((1-s)R)` 是有界射線路徑幅值近似，**未包含曲率發散、聚焦或焦散**。這是依 [MIT transport 討論](https://ocw.mit.edu/courses/2-682-acoustical-oceanography-spring-2012/912f81a910bbd70f22a2be6e25113d09_MIT2_682S12_lec04.pdf)及 [Bremmer/Lee 官方摘要](https://agupubs.onlinelibrary.wiley.com/doi/abs/10.1029/RS017i005p01117)作出的本案限制判斷，不冒充已實作其係數。
- **CG-REF-005／Derived，V1 結果另列**：共同可見弧二分法、膠囊側面/端帽候選分解、epsilon、迭代上限與 stable path ID 都是本案工程內容；外部來源不直接證明其收斂、容量、邊界或實作。數學參考 runner 應另列原輸入、預期、容差及結果。

## V0–V5 與未做項目

| 層級                        | 本來源查核的範圍                                                                   |
| --------------------------- | ---------------------------------------------------------------------------------- |
| V0 Model Contract           | 相關來源與模型條件已查；產品 schema/capability 測試另附。                          |
| V1 Analytical / Numerical   | 本來源查核未跑。由獨立解析/數值 fixture 收據另判，不以本文替代。                   |
| V2 DSP Correctness          | NOT RUN；沒有聲音圖或 OfflineAudioContext 驗證。                                   |
| V3 Independent Solver       | NOT RUN；沒有外部全波/聲學 solver 的同場景比較。另一套自有數值最佳化只屬 V1 參考。 |
| V4 Runtime / Performance    | NOT RUN；沒有正式 runtime/性能或裝置 deadline 量測。                               |
| V5 Perceptual / Measurement | NOT RUN；沒有真人聽測、校準 SPL、實體 RIR 或真房間量測。                           |

未宣稱新增 solid transmission、繞射、相干波動干涉、移動反射面的 retarded-time/Doppler 解；平面 image-source 文獻 P01/P05 不能直接當成曲面幅值已驗證的證據。
