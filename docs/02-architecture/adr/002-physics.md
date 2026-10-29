# ADR-002：Physics Engine

- 狀態：Accepted for preproduction，2026-10-26。
- Context：需 dynamic/no-gravity/fixed/kinematic、collision、raycast、character controller 與 WASM 部署。
- Decision：Rapier JS compat pinned package，60 Hz fixed step；render interpolation。初版允許 main-thread physics，profile 後再移 worker。
- Alternatives：Ammo/Bullet、Cannon、Unity PhysX；本次未做全面速度評比，不能聲稱 Rapier 最快。Fallback 為限制 bodies 與用錄製 trajectory 重播，不自行寫不完整剛體引擎。
- Evidence：[Rapier Rigid Bodies](https://rapier.rs/docs/user_guides/javascript/rigid_bodies/)、[Character Controller](https://rapier.rs/docs/user_guides/javascript/character_controller/)、隔離 experiments/physics-spike 的執行結果。
- Trade-offs：WASM 初始化、型別／query pipeline 與 timestep 管理；spike 不等於穿牆風險全排除。
- Risks：CCD 有限制、high mass ratio／剛性 grab 可能不穩。官方 determinism 說明附嚴格相同初始化與運算順序條件；本案沒有跨機 bit-exact 證據。
- Reversibility：所有 handles 留 runtime mapping；Scene IDs 與 physics engine 無關。
