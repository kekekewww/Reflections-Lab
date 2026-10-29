# ADR-001：3D Rendering Framework

> 歷史決策：初版直接 Three 而不採 R3F 的部分已由 [ADR-011](011-web-core-and-rendering.md) 依新需求取代；以下保留原始理由。沒有把 R3F 方向宣稱為已安裝／驗證。

- 狀態：Accepted for preproduction，2026-10-26。
- Context：空專案；十日 Demo 以物理直接操作、path selection 與可量測 runtime 優先。
- Decision：TypeScript＋Three.js；React 負責 UI，physics poses 在 Three runtime 更新，不逐步回 React state。Three 已隔離驗證的版本以 lockfile 為準；React 待第一任務整合時精確鎖版。
- Alternatives：R3F（宣告式較易 UI 組合，但多一層生命週期）；Unity（成熟 editor，但 web／原生包與現有網頁評審流程成本不同）；純 DOM（不符需求）。
- Evidence：[Three 官方 API](https://threejs.org/docs/)、[R3F 官方說明](https://r3f.docs.pmnd.rs/getting-started/introduction)；未實測 R3F，不能宣稱它一定較慢。
- Trade-offs：直接管理資源 dispose／selection／scene mapping，減少 runtime 抽象但需自建 editor 操作。
- Risks：React state 與 runtime diverge；以 command＋revision 明確同步。
- Reversibility：SceneSpec／backend 與 renderer 無關，可將 view adapter 改為 R3F；不把 Three Object3D 序列化進檔案。
