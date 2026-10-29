# ADR-011：獨立作品、Web Acoustic Core 與 R3F view

- 狀態：Accepted，2026-10-26；依最新 Phase3 使用者需求。此為架構決策，正式產品尚未實作。
- Context：Reflection Lab 是獨立新作品；過往研究可引用，Echo Canvas／Reflections 核心程式不直接沿用。現有 ADR-005 已採 Web direct／一階核心，但 Rendering 的 ADR-001 仍以直接 Three runtime 為初版。
- Decision：產品主方向為 React／TypeScript、Three.js／React Three Fiber、Rapier WASM、自行開發 Geometric Acoustic Core、Web Audio／AudioWorklet、server Meta Model API。R3F 是 view adapter 的預定整合方向，尚未安裝或驗證；固定步 physics、solver 與音訊 clock 不經 React state 驅動。
- Acoustic scope：direct propagation、distance attenuation、occlusion、有限一階 Image Source Method、穩定 path IDs、具來源／頻帶的材質與空氣衰減、spatial rendering parameters。各項公式依原科學／驗收契約逐項實作，不能因本 ADR 宣稱已完成或擴大精度。
- Steam Audio：保留既有原生 smoke／SDK hash／授權、optional capability adapter 與 independent benchmark 候選；不是 MVP 強制依賴。SDK 與 Web solver 模型不同，不能直接當同模型 ground truth。
- Supersedes：ADR-001 的「初版不採 R3F」部分；ADR-005 的 Web solver 與 ADR-008 的 Meta host 安全界線維持。新 [Harness ADR](012-development-harness.md) 管理開發代理，不能替代產品 Meta 整合。
- Provenance：來源與既有成果用固定 artifact／Git 紀錄區分；初始 checkout 無 HEAD，記 null，不能為未提交成果補造歷史。首次本機 commit 需將既有研究與本次基礎設施範圍寫清楚，不推送。
- 保留功能：Scene Editor、FPS Simulation／Build、Grab／Drop／Throw／Rotate、四 body modes、dynamic／collision audio、listener sync、聲學視覺化、record/replay、A/B 實驗與 Meta Experiment Agent。
- Risks：R3F lifecycle 與 imperative poses／dispose 的接線需正式 milestone 驗證；API／套件版本要在安裝當下查官方文件與鎖定，不能把架構名單當整合證據。
- 依據：[使用者原始需求](../../00-project/PHASE3_REQUEST.md)、[ADR-001](001-rendering.md)、[ADR-005](005-acoustic-backend.md)、[原正式任務](../../NEXT_ENGINEERING_TASK.md)。
