# 區域名義範圍線框視圖

日期：2026-11-02（台灣）。分支：codex/pipeline-zones。此切片以 metadata 提交 d35112f 為基準，新增 editor 的 Zone volume 視圖；不修改 Camera、Gizmo、物理、聲學求解或作者資料序列化。

## 實作

- 新增 src/ui/viewport/ZoneVolumes.tsx；Viewport.tsx 僅增加 import 與一個元件呼叫。
- AABB 由作者 halfExtentsM 轉換為完整寬、高、深；sphere 使用作者 radiusM，位置使用 centerM。這些 Three geometry 只供視圖，不進 Scene object、Rapier collider 或聲學面資料。
- 僅 editor 模式顯示。FPS 隱藏；重播時隱藏目前作者區域，避免把當前 regions 疊在可能不同的歷史場景上。
- 啟用使用 canonical accent、停用使用 canonical textMuted，並以不透明度區別。只有線框、無實體填色，不增加動畫或新的設計 token。
- Mesh 的 raycast 明確不產生 hits，不註冊 pointer handlers；仍可點擊後方物件。線框不寫入 depth，維持可辨識的作者 overlay；原有 Camera/Gizmo selection 控制未更動。
- geometry 依形狀／尺寸 memoize，primitive 替換或卸載時 dispose；材料交由既有 R3F 宣告式生命週期管理。不序列化 Three engine object。
- ZonePanel 雙語 HelpTip 明示：線框為名義 volume，實際進入用內縮界、離開用外擴界；這是固定步中心採樣，非連續掃掠，一步中外側穿越到外側可不產生事件。停用 occupancy 與已作者化的 zone-center anchor 語意維持原 metadata 切片。

## 基本驗證

node --import tsx --test src/ui/viewport/zone-volumes.test.ts：6/6 PASS。

1. Three AABB vertex bounds 與作者半尺寸一致，沒有修改輸入。
2. sphere 所有頂點半徑與作者資料一致。
3. enabled／disabled 呈現不同且保留可見的狀態。
4. 真 Three Raycaster 在有抑制前能命中測試 overlay；安裝 ignoreZoneRaycast 後只命中其後方物件。
5. FPS、replay 與沒有 zones 的 SSR 輸出為空。
6. editor 保留每個 zone 的 stable ID／enabled 狀態，不改原 region 資料。

npm run typecheck：exit 0。四個受影響 TS／TSX 檔的 scoped ESLint：exit 0。Prettier 已套用；來源與命令結果記於 volumes-verification.json。

未啟動 browser、Computer Use、production build 或 GPU profiler；Node geometry／SSR／raycast 不代表真人畫面、GPU 資源穩態或完整物件點選驗收通過。整合後 production build 與真 browser 操作由父代理持獨佔 lease 補驗。

## 整合與後續複核

檢查 editor 的 enabled／disabled AABB 和 sphere 是否都出現在正確中心及名義尺寸；切換 FPS、重播、載入舊專案、Undo／Redo 後不殘留線框；直接點選線框後方物件仍使用原 selection／Gizmo 路徑。修改尺寸時舊 geometry 必須釋放。大量區域的實際可讀性與 GPU 行為尚待真 browser 複核。
