---
name: physics-interaction
description: 設計與驗證 Reflection Lab Rapier FPS、抓取投擲、建造放置、剛體狀態與碰撞音訊事件。
---

# 物理互動

## Trigger / Purpose

變更 character、grab、throw、placement、rigid-body mode 或 contacts 時，維持可碰撞、可重播的動態行為。

## Inputs

物件 mass／geometry／mode、fixedDt、input intent、控制上限與目標操作。

## Workflow

1. 讀 docs/04-physics 相應規格；確認 pinned Rapier API，不將 opaque handle 當持久整數 ID。
2. 固定步前套控制，step 後收 pose/contact；render 只插值。
3. 抓取 dynamic body 用有界 impulse/torque servo；target shape sweep／overlap，不能相機 parenting 或 teleport 穿牆。
4. 切換 gravity/fixed/kinematic 記 pose、velocities、sleep、grab 與 restore policy。
5. preview、staged、enabled 三階段分開；place overlap 失敗不能偷偷啟用 physics。
6. collision 開始／持續接觸分開；靜置支撐力不是 impact，dedup/cooldown/voice caps 必須保留。

## References

`docs/04-physics/`、`experiments/physics-spike/`、`docs/06-validation/PHYSICS_VALIDATION.md`。

## Outputs

engine adapter／interaction state、穩定事件 schema、針對穿牆／切換／碰撞的測試證據。

## Validation

`npm run test:physics`；完整 grab/CCD/browser 試驗另列，不以空場 spring 通過代替牆角／高速測試。

## Failure Handling

不可因碰撞阻塞直接改 transform；受限放手並記原因。API 不提供 impulse 時保留 forceN 或 unavailable，不能誤標 Ns。
