---
name: reflection-lab-design-system
description: 在 Reflection Lab 規劃、實作或審查 UI、元件、動畫、FPS/Build、聲學圖表時使用；按需讀正式設計規範、Emil skills、狀態及驗證要求，避免把靜態審查當成實機通過。
---

# Reflection Lab 設計工程

## 入口與範圍

先讀 `docs/05-ux/DESIGN_SYSTEM.md`。本專案仍為 research/preproduction；本技能不構成正式產品開發、安裝 UI 依賴或部署授權。最新使用者要求、已採納 ADR、數值／DSP 契約優先。

## 按需讀取

- 視覺值只改 `docs/05-ux/DESIGN_TOKENS.json`，格式由同目錄 schema 管理；不在 Wiki 或 CSS 建立另一套權威值。
- 元件讀 `COMPONENT_SPEC.md`、`COMPONENT_STATES.json` 及 `COMPONENT_STATES.md`；七態與 async 狀態正交。
- 工作區／selection 讀 `WORKSPACE_ARCHITECTURE.md`；FPS/Build 讀 `FPS_INTERACTION_UX.md`、`docs/04-physics/INPUT_CONTROLS.md`、`docs/04-physics/FPS_INTERACTION_SPEC.md`。
- 動態讀 `MOTION_GUIDELINES.md`；效能讀 `PERFORMANCE_STANDARDS.md`；極端資料／失敗復原讀 `UI_STRESS_TESTS.md`。
- 上游來源／MIT／版本／指令差異讀 `EMIL_SKILLS.md` 與 `third_party/emil-skills.manifest.json`。Emil 原文位於 `.agents/skills/`；按元件設計用 emil-design-eng、動畫實作 animate、單次審查 review-animations、整體 audit improve-animations、量測 animation-performance、選庫 pick-ui-library、獲授權原型 prototype、壓測 break-ui。不需每次載入全部八項。

## 工作流程

1. 查當前 Wiki task、最新 ADR／功能狀態與既有 component pattern；確定本次已有 UI 實作授權。
2. 列 workspace、input owner、stable selection、backend capability、scene/result revision、七態／async 態及錯誤復原；高頻資料與 keyboard 操作立即呈現。
3. 用同一份 tokens；3D 只畫 solver 提供的 paths；source/listener、模型與單位可追溯。UI spring 不等於物理 grab，動畫不驅動 audio clock。
4. 保留 Tab／IME／Esc／blur、可見 Mute/Pause、非 pointer-lock 操作、Reduced Motion；workspace 切換不 reset run／recording。
5. 靜態驗證執行 `node scripts/setup/emil-skills.mjs --check` 與 `--standards`；再依本次實際修改執行 UI、物理、DSP 對應測試，保存命令與結果。六項效能預算各自量測，不用 FPS 推 audio deadline。
6. 真實瀏覽器中檢查七態、鍵盤、縮放、長繁中、快速中斷／重試；保存畫面／frame trace／裝置資訊。缺 UI 或畫面能力填 `NOT RUN` 或 `STATIC REVIEW`，不能寫 visual PASS。
7. 更新相關 Wiki task、設計決策／review history、證據與 handoff，具體數值只在 docs/05-ux 維護。

## 失敗與回復

上游 hash 不符保留 diff、不覆蓋；restore 僅補缺檔。找不到某技能時先查 manifest／本地路徑，不能以 latest 自動升級。設計與已採納 physics/DSP 契約衝突時保留來源並記 conflict，不以外觀猜測正解。上游 bare greeting／等待選擇依實際使用者已授權範圍套用，不重複要求一般可逆工作的許可。
