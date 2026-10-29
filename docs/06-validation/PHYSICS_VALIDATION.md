# 物理驗證狀態

Rapier 0.21.0 的實際 Node/WASM 隔離 smoke 已執行；不是正式 FPS／grab／throw 產品。來源、API 與互動設計見 [PHYSICS_ARCHITECTURE](../04-physics/PHYSICS_ARCHITECTURE.md)。

```powershell
npm ci --prefix experiments/physics-spike --ignore-scripts
npm run test:physics
```

實作與 input／expected／tolerance 位於 [`smoke.mjs`](../../experiments/physics-spike/smoke.mjs)，實際結果位於 [`results.json`](../../experiments/physics-spike/results.json)。固定 dt=1/60 s；長度 m、時間 s、質量 kg、速度 m/s、force N、impulse N·s，Y-up、重力 -9.81 m/s²。

| Runtime fixture          | 真正檢查內容                                                                          | 容差／限制                                                             |
| ------------------------ | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| freefall                 | 0.5 s 後 v=-4.905、解析 y=8.77375 m；實際有 integrator position error                 | y 0.05 m、v 0.001 m/s；不是連續解完全一致                              |
| dynamicNoGravity         | gravityScale=0 保留 x 慣性，再恢復 gravityScale=1                                     | 初始 y 1e-5 m、vx 1e-5 m/s；恢復 vy 0.001 m/s                          |
| fixed→dynamic            | Fixed 忽略 impulse，明確零速度策略後恢復 Dynamic 並指定速度                           | 不依賴 engine 隱含舊速度還原                                           |
| impulse／force           | m=2 kg，12 N·s impulse 立即 Δv=6；12 N force 累積，resetForces 後停止加速             | vx 1e-4 m/s；addForce 不是每步自動清空                                 |
| collision event／contact | 真正發生 dynamic ball 與 fixed floor 碰撞；讀 force event 與 geometric contactImpulse | force 與 impulse 為不同 API／單位；不假設 solverContact index 一一對應 |
| spring／kinematic anchor | spring 接 position kinematic anchor，測單一質量與參數收斂                             | 0.05 m；未含牆、旋轉、大 mass ratio、target teleport 或 force cap      |

這六項 smoke 只支持這個版本與本機 runtime。`npm run smoke:dependencies` 另外確認 Three 0.186.1 數學 ray/plane 操作及 Rapier initialize/free；沒有建立 WebGL renderer 或瀏覽器互動。

## 尚未驗證

Character controller／坡面／台階、pointer lock、真正第一人稱抓取、wall-safe target clamp、抓取旋轉 servo、release／throw pipeline、CCD 壓力測試、FPS build collision-aware placement、impact sound synth／音量映射仍為 NOT RUN。碰撞 event 可讀取不等於聲音已生成。

跨平台完全 deterministic replay 未建立。正式驗證需保存初始 state、dt、seed、Rapier build、scene revision，以及 authoritative transform／velocity／contact trace；A/B 以同一 motion trace 為基準。只記鍵鼠事件不足以證明跨 CPU／browser 完全一致。

未來最小驗收需納入：dynamic/fixed/no-gravity/kinematic 切換矩陣、不同質量 grab、物體與牆／角色同時接觸、throw→impact event 包含時間／位置／相對速度／impulse／材質、事件去重及資源 dispose。這些是下一階段驗收條件，沒有將其列為本次 PASS。
