# Task0029 給整合與 Claude 的交接

這一串提交在 codex/pipeline-zones 完成真正 Zone 核心，不只把 unsupported option 啟用。Root 最後 merge／browser／WAV 與 Wiki/task/英文由各 owner 統一處理。

| 截點 | 實作與結果 | 正式階段來源 |
| --- | --- | --- |
| fa4c314 | optional Scene AABB/sphere、原子作者 UI、真 fixed-step occupancy→raw/normalized→record/replay、共用能力與 AI/Host references；501/501＋build | REPORT.md、evidence.json |
| d35112f | detached zone/fixed source 不排遠端 owner geometry，維持 stem/budget owner；Project zone references 持久化；92/92＋build | DETACHED.md、detached-evidence.json |
| a22c978 | editor-only 名義 wireframe，enabled/disabled tokens、raycast 穿透、memoize/dispose；Three/SSR 6/6 | volumes.md、volumes-verification.json |
| 20bf09a | 同 revision 不同內容 import 的 stale-draft 原子拒絕；UI/Runtime registry pin 與 Scene identity；57/57、tsc/lint | BASELINE.md、baseline-evidence.json |
| 本檔同提交 | Zone-only position discontinuity 保 Motion release 真正跨界；RED 4 FAIL→新案 PASS、相關76/76、含上述所有 source 的最終 build 0 | POSITION.md、position-marker-evidence.json、final-source-pins.json |

這些測試集合彼此重疊，不能相加成新的總驗收數。每個舊收據都固定原 source，最新 working source 不同時不能冒用舊 PASS。Root 合曲面 builder 後的 source/bundle 還需建立自己的新 pins。

## 接線

SceneSpec.zones optional；沒有時不插預設[]。最多16個 region。Sound discrete trigger 產品必須明示 zoneId，預設 emitter 仍 object。Static volume 只作 Derived 固定步 body-center 採樣，非 collider-overlap 或 swept；start/reset/new/enable/作者transform/registry變更 baseline，連續 mode-change 不 baseline。內縮 enter／外擴 exit；disabled 只停 occupancy、保留 ID 與明示 zone-center anchor。

UI「區域」tab；zone.browser AABB 中心(-.8,1,0)、半尺寸(.5,.4,.5)、h=.02 可讓預設 ball 下落跨入/跨出。選 ball 新增進入／離開規則並選 zone.browser。ZonePanel 新 saveZone/removeZone action 須帶 expectedSceneRevision 及 zoneRegistryPin(current zones)；draft 必須用建立時 pin，不能在 Save 當下重新 pin 舊草稿。

同 motion B 不得換 registry geometry/enabled/h；要新 physics。Scene 配置含 Zone 後，source-phase 重建真 registry 並核 raw/normalized zoneId；Zone 不算 acoustic geometry。Emitter geometry 三態為 undefined→legacy owner exclusion、null→detached、string→explicit real body；Root 採曲面分支完整 builder，勿以本分支 legacy box builder 蓋回新版。

## 仍待整合 gate

真 browser 含新增/編輯/刪除/disabled、非法數值、同 metadata import stale、ZONE_IN_USE、Project 帶規則保存/重載、editor wireframe 與後方 picking、FPS/replay 不殘留，以及完整 record-replay／WAV 與 manifest。新功能不代表真人聽測、Meta live、formal performance 或 V1 全數通過。所有 source/失敗/Git 歷史已留，沒有 push。
