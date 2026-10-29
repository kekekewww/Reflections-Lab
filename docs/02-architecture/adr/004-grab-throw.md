# ADR-004：Grab / Throw

- 狀態：Accepted for preproduction；完整牆角互動尚待驗證。
- Context：抓取須保留動量、mass、collision；相機 transform parenting 不符需求。
- Decision：Dynamic body 上每固定步施加有界 impulse／torque servo；target 先 shape sweep 與 overlap 限制。以接觸後的實際 pose 作聲源；drop 保留當下速度，gentle drop 需明示阻尼政策。throw 使用 impulse Ns，有總速度上限。
- Alternatives：spring/joint 到 kinematic anchor（fallback，但 cap API 需證實）；velocity servo（容易破壞接觸解）；直接 teleport（只限 preview，不可用於 hold）。
- Evidence：[Rapier forces／impulses](https://rapier.rs/docs/user_guides/javascript/rigid_body_forces_and_impulses/)、[physics docs](../../04-physics/PHYSICS_ARCHITECTURE.md)。
- Trade-offs：控制增益／最大力／可抓質量是設計參數，不能稱來自材料量測；重物可追不上 target。
- Risks：牆角、薄牆、高速／高質量比、旋轉慣量、睡眠。超限 release 並記原因，禁止瞬間拉過牆。
- Reversibility：GrabController adapter 可換 joint；Scene／record 格式僅保留 intent 與可重播運動。
