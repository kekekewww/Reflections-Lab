# 資料契約

Draft 2020-12。本地 schema 與 provider strict tool schema 分開；`ai-*` 見 docs/08-ai。

`examples/` 是合成測試輸入，不是運行中的場景／量測結果。空 IR/path 欄位不得當作成功模擬。`npm run validate:schemas` 以 AJV 執行正負案例；跨 ID、quaternion norm、A+R+T、capability consistency、ordered timestamps、scene bounds、artifact existence／hash 需 domain validation。domain checks 只在驗證器／測試中實作時才能標 VERIFIED；產品 host validator 仍待實作。

幾何 `dimensionsM` 定義為 object-local bounding dimensions `[width,height,depth]`；sphere 必須三值相同，radius=width/2；capsule height 包含兩端球帽，radius=width/2、width=depth、height>=2*radius。非等比 sphere scale 拒絕。AI tools 經 adapter 轉入此 Scene，不能直接當 Scene patch。

API schema 輸入空間可大於當次 scene 的工程上限；host domain validator 必須收窄至 scene bounds／capability／budget。schemas 不宣稱提供任意 mesh，初版只定義 primitives，未來另建 versioned mesh asset schema。
