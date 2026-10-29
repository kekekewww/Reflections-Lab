# 研究狀態

日期：2026-10-26。完整主張與來源在 `research/EVIDENCE_LEDGER.json`；source access與validation status分欄，未把API文件當執行證據。

| 領域 | 已完成研究 | 保留問題 |
| --- | --- | --- |
| 幾何聲學 | Image source、finite polygon、ray/beam、動態path identity、hybrid | 低頻／繞射／散射與general mesh未實作 |
| 材質 | A/R/T、scattering、impedance、角度／band／measurement條件 | 沒有通用跨引擎係數等價，未有實測材質庫 |
| 空氣／移動 | c、ISO9613來源、air dB、Doppler／retarded time | ISO全文／完整reference point有限；高速動態未求解 |
| DSP／room | RIR/BRIR、HRTF/SOFA、EDC/RT/clarity、FDN/conv/fractional delay | actual graph聽測與ISO量測一致性未驗 |
| Collision／wave | excitation、modal/sample、rolling/friction、FDTD/FEM/BEM與room modes | 數據驅動／modal成本，資料權利與即時性需後續spike |
| SDK | 4.8.1授權/API/五方案比較/native最小驗證 | 動態／browserWASM／individual-path capability限制 |
| Physics | Rapier/Three官方API、FPS/build/grab state與事件 | 牆角與重物穩定性／browser整合未測 |
| UX | 8產品對照、workspace/flows/components/design system | 部分只有索引／舊版；未訪談／實機 |
| Meta | 官方模型／tools／strict／pricing/privacy | 實際帳號／推論未驗，零費用預設 |
| 規則 | Meta/CV官方waiver／日期／權利／評審 | 賽前程式、Codex、商業SDK、提交欄位待確認 |

研究涵蓋已達 bootstrap 可交接範圍；不能把所有來源寫成全文已讀。每篇的貢獻、方法、公式、實驗、限制、可重現性見 LITERATURE_REVIEW／COLLISION_WAVE_NOTES。
