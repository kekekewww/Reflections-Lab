# 物理互動實作

```json
{{TASK_CONTRACT_JSON}}
```

先讀 AGENTS.md、physics-interaction Skill、有效 FPS／Build／Listener 規範及 task relevant_files。physics 固定步、render 插值；穩定 domain ID 與 Rapier handle 分離。gravity=0 仍是 dynamic，fixed 不受力，kinematic 依明確命令控制；序列化 Scene 不包含 runtime engine object。

抓取保留接觸求解與有限 impulse，不 parent 到 camera，不以瞬移穿牆達到投擲效果。模式切換要處理 grab／joint、速度政策、wake 與 listener discontinuity。退出 FollowPlayer 依有效決策還原 saved ScenePinned；不要用舊摘要覆蓋已解決決策。

只修改 allowed_files，保留 protected acceptance 與既有變更。回報 ImplementationResult，分開列純數學 fixture、Rapier WASM、browser 輸入／pointer lock、碰撞音訊與效能證據。任何未跑的層級寫 NOT RUN；已完成 checkpoint 經核對後延續，不重建整套場景。
