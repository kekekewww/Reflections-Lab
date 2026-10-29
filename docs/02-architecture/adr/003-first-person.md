# ADR-003：First-person Controller

- 狀態：Accepted for preproduction；瀏覽器互動 NOT RUN。
- Context：需要 WASD、camera wall collision、build／grab 與 listener 同步；editor camera 不能改量測 listener。
- Decision：Three PointerLockControls 僅管理視角，Rapier capsule character controller 處理位移／slide；head pose 由 character 決定。進入 FPS 需 gesture；Esc／blur 釋放 held inputs、暫停並明示 resume。
- Alternatives：自由飛行 camera（只供 editor）；dynamic rigid body 玩家（推碰自然，但斜坡／樓梯調校較多）；fallback 不鎖定滑鼠＋keyboard camera／orbit。
- Evidence：[PointerLockControls](https://threejs.org/docs/pages/PointerLockControls.html)、[Rapier controller](https://rapier.rs/docs/user_guides/javascript/character_controller/)。
- Trade-offs：kinematic controller 的推力與 mass 互動需明確政策，不能當成完整人形動力學。
- Risks：pointer lock 瀏覽器支援、鍵盤布局、focus 搶佔。B 為 build、Tab 保留焦點；UI typing 不觸發世界動作。
- Reversibility：input intent、character movement、view、listener attachment 分層，可換 controller。
