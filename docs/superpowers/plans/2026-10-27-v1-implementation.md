# Reflection Lab 第一版實作計畫

> **For agentic workers:** Use superpowers:subagent-driven-development with separate file ownership and independent acceptance review. 使用者已明確要求直接實作直到第一版完成；不另等待計畫批准。

**Goal:** 完成可執行的三維物理、可追溯聲學、Sound Behavior 創作與實驗第一版，按既有驗收提供測試、獨立審查、Wiki、交接與Git證據；不使用Muse額度。

**Architecture:** Scene document與原子命令是作者資料權威；Rapier固定步管理runtime pose。Behavior產生有界audio intents，Custom Acoustic Core計算實際path，WebAudio只渲染；React/R3F呈現與操作。Meta server adapter保留產品模型整合，離線工具明示來源。

**Tech Stack:** 既有pinned Three.js、Rapier、TypeScript、AJV，加精確鎖定React19/R3F9/Vite及tsx/Playwright。

**Spec:** [Roadmap](../../ROADMAP.md)、[Scene/Physics切片](../../NEXT_ENGINEERING_TASK.md)、[Sound架構](../../10-sound-behaviors/SOUND_BEHAVIOR_ARCHITECTURE.md)、[M0驗收](../../10-sound-behaviors/NEXT_AUDIO_MILESTONE.md)、[Design System](../../05-ux/DESIGN_SYSTEM.md)。第一版整體範圍不能被單一Scene切片的排除條件縮限。

## 全域限制

- 不改既有schema/fixture/reference放寬驗收；新增明確版本的產品host adapter。
- SI、stable IDs、fixed physics step、獨立render/acoustic/audio clocks、無任意JS規則。
- 所有3D聲源經統一propagation；delay/distance/HRTF各計一次，contact位置不是一律物件中心。
- 禁止secret入庫、Muse quota呼叫、付費上限提高、push、部署或代接受條款。
- 產品Meta API無已驗證帳號／明確非零預算時不得呼叫；offline/fixture不可冒充Meta。無法完成的live驗收不設DONE。

## Review Focus

- 無效／stale命令、檔案匯入、undo/redo與partial failure不能破壞目前資料。
- 抓取時仍碰撞；Throw一次；mode/pause/blur/input focus切換不能留下力或誤觸。
- Continuous與one-shot共存，極值/缺資產/重複event/voice burst有確定結果。
- 被遮擋direct、反射arrival與gain/delay不能被UI或audio另路繞過。
- 錄放/比較不能悄悄改無關物理條件；缺結果回unavailable，AI不生成測量數字。

## 分工與交付順序

- [ ] Task0006：`src/scene/`、`src/physics/`、既有`src/scene-host.mjs`驗收入口；純domain與真WASM，再browser。
- [ ] Task0011：`src/audio-behavior/`，固定fixtures、epoch/snapshot/replay、bounded voices與獨立review。
- [ ] Task0012：`src/acoustics/`、`src/audio/`、`src/ui/`與`src/app/`串接成可實際操作的垂直功能；numeric/OfflineAudioContext/browser驗收。
- [ ] Task0013：FPS/build/grab/throw、狀態與material rules、timeline、`src/experiments/`/`src/persistence/`與兩類A/B。
- [ ] Task0014：`src/ai/`、`server/`，Meta provider與安全工具host，實際手動fallback。外部live門檻保留Task0007；不虛報完成。
- [ ] 第一版整合：freeze acceptance矩陣、完整回歸、瀏覽器操作/音訊/效能各自記證據、隔離review與repair、更新status/limits/Wiki、handoff與本地Git。

Root專有package/config、app controller、Wiki/task及最終整合；各子代理僅寫其模組/測試。先寫有意義的失敗案例，再實作、讀取實際測試結果；每個milestone獨立驗收。下一階段持續到原目標達成，不以M0或僅綠燈的離線測試當第一版全部完成。
