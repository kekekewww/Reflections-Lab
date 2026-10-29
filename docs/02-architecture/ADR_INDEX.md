# 架構決策索引

日期：2026-10-29。ADR 為設計權威，實際能力由程式與可重現測試判定；舊 preproduction 敘述保留歷史範圍。正式 Web 已實作並持續驗收，完整 V1 尚未完成。研究分支新增 ADR 於安全合併後才適用原分支。

| ADR | 主方案 | Fallback |
| --- | --- | --- |
| [001 Rendering](adr/001-rendering.md) | 歷史 preproduction 決策；Rendering 部分由 ADR-011 取代 | 保留原始理由與可逆 adapter |
| [002 Physics](adr/002-physics.md) | Rapier WASM 固定步 | 減量 bodies，受控 trajectory |
| [003 FPS](adr/003-first-person.md) | Pointer Lock＋Rapier character controller | 無鎖定 orbit／keyboard 視角 |
| [004 Grab](adr/004-grab-throw.md) | 有界 impulse／torque servo | 受限 kinematic anchor joint |
| [005 Acoustics](adr/005-acoustic-backend.md) | Web 有限幾何 direct／一階 | Native Steam Audio capability adapter |
| [006 Audio](adr/006-audio-backend.md) | Web Audio，逐步 worklet | 簡化 early bank／native full audio |
| [007 Contracts](adr/007-scene-material.md) | SI／right-handed／versioned JSON | 顯式 adapter migration |
| [008 AI](adr/008-ai-integration.md) | server Meta adapter＋validated commands | 明示離線 fixture，AI demo 不冒充 live |
| [009 Replay](adr/009-recording.md) | motion trace＋snapshot＋manifest | 同機 pinned runtime resimulation |
| [010 Deployment](adr/010-deployment.md) | HTTPS web＋same-origin AI endpoint | 本地展示＋獨立 native spike |
| [011 Web Core / Rendering](adr/011-web-core-and-rendering.md) | 獨立作品、React/R3F view＋自製 Web acoustic core | Steam Audio optional；Web runtime 已實作、完整驗收未完成 |
| [012 Development Harness](adr/012-development-harness.md) | 歷史／Optional；角色政策由ADR-013取代 | 保留互斥／驗收／預算與歷史證據 |
| [013 Codex Primary](adr/013-codex-primary-development.md) | Codex主導架構／實作／獨立驗收；MuseCode選用 | Meta產品Agent與開發工具分開 |
| [014 Sound Behavior](adr/014-sound-behavior-system.md) | EventRules＋正交states＋Inspector＋統一傳播；runtime 已實作，逐 producer 能力另查 | Graph/modal 為 P2；完整 V1 未完成 |
| [015 Client-first / Render Contract](adr/015-client-first-and-render-contract.md) | 維持 client 主線，portable types-only RenderJob／RenderBackend、5 秒共用傳播上限 | cloud render／auth／ADM 後續，不冒充已實作 |
