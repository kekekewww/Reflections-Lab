# 物理與 Scene 生命週期驗證

## 2026-10-28當前來源補充

[當前physics2 browser收據](../../artifacts/v1/physics-current-operation-20261027T175652Z/operation-end.json)與其172份來源前後核對、實際exit0及5176清理已完成；採軟體ANGLE的功能結果不代表硬體效能或完整heap無洩漏證明。最新physics650233ed／runtimec3437ecd的窄history／renderer DTO修補共有391項相關回歸通過，完整公開插值本體維持原bytes；原WASM矩陣29＋邊界9共38項的較早範圍保留，不混加不同suite數量。

本輪正式256body性能profile負載有效，但native WASM step p95為2.2ms，未達小於2ms初始目標；完整fixed tick含copies p95為12.5ms。功能矩陣PASS不代替性能PASS。全部原始結果、原61保護集合與整體未完成狀態見[r10](SESSION_PROGRESS_20261028-r10.md)。以下保留既有矩陣與當時的來源／方法。

本頁只報告第一版矩陣的物理／Scene 範圍，不代表整體第一版完成。原驗收、reference 與容差未修改；實作與此頁的測試／審查由不同代理負責。

## 固定步、同機重跑與抓取矩陣

`node --import tsx --test tests/physics/v1-matrix.test.ts` 實際測試如下：

- 兩個分別建立的真 Rapier World，以相同初始 Scene、seed、建立順序、固定步和 tick-indexed intents 各跑 120 ticks；先比對初始公開 `PhysicsSnapshot`，再比對每 tick 全部公開 snapshot 欄位的 SHA-256。本機觀察到的位置／速度差為 0，不推論原生 WASM binary snapshot 或跨平台 determinism。
- 30／60／144 Hz render cadence 的 120 個真 solver states 完全相同；讀取插值 pose 不改 solver state。
- 四質量 0.1／1／5／20 kg × 薄牆／角落／動態堆疊 × Gravity／NoGravity，共 24 案。每案 15 Hz render、240 個固定步；保留真 mass／body type／gravity scale／collision／solver groups，控制 impulse／torque 不超過既定上限。實際 collider sweep 命中、水平位移、非零 impulse、blocked／saturation 與 tracking error 皆有記錄。
- 追加十次真 LabRuntime Run／Pause／Reset→export／import 回歸：序列化為 fresh-world generation pins，不修改 live authoring pins；匯入後 Scene metadata 保留。
- 另以實際 `InteractionHost.handleKey("KeyF")` 複驗既有 Lock／Unlock：會記住原 NoGravity、清 Held、將 linear／angular velocity 寫零，且不會穿過第一個阻擋形狀操作記憶中的目標；沒有為測試新增 mode metadata。正向回歸已通過。依 `OBJECT_STATES.md` §3 追加的「交疊目標不可解除固定」負例曾重現失敗；owner 已補 actual-pose shape query 與 trusted apply-boundary guard，獨立 targeted case 已通過。最終完整矩陣為 29 案，尚待新固定證據。

抓取最大觀察牆面 penetration 約 0.607 mm、動態堆疊約 0.440 mm。這些是本組 fixture 的量測；未採用通用 penetration／tracking 容差，不宣稱零穿透。Pass invariant 包含不穿越障礙、動態身份不變、控制有界及確實涉及障礙 query。

最新 **27／27 PASS、exit 0、sourceStable:true** 的固定證據為 [matrix-v2/matrix-verification.json](../../artifacts/v1/physics-acceptance-20261027/matrix-v2/matrix-verification.json)，內含 stdout／stderr／來源、套件 lock 與實際 WASM hash。原 26 案 [先前版本](../../artifacts/v1/physics-acceptance-20261027/matrix-verification.json) 留存，沒有覆寫舊記錄。

## 真瀏覽器四 mode 與資源釋放

實際命令：

```powershell
node tests/browser/run-physics-lifecycle.mjs
# 保存不可覆寫的正式證據版本：
node tests/browser/run-physics-lifecycle.mjs --evidence
```

專用 Vite 設定在 5176 埠提供實際模組、停用 HMR 並使用獨立 dependency cache，避免其他代理的開發伺服器重載打斷驗收。launcher 持有並釋放自己的伺服器程序，120 秒限制整個 Playwright suite，保存 stdout／stderr、前後 source hashes 與原始 JSON；不接管或停止既有未知程序。沒有替換 PhysicsWorld 或 React／R3F；測試未呼叫模型 API。

Chrome 的四 mode 案驗證真 60 Hz WASM 行為：重力／慣性／impulse、Fixed 不受 impulse、Kinematic next pose 與薄牆拒絕、重力切換保留速度、Lock／Unlock 零速，以及 pause 不 step。這是 browser-hosted engine methods 證據，沒有將它稱為 Inspector 點擊驗證。

生命週期案使用正式 `mountReflectionLab` 的預設 React／R3F renderer，先等待真 GPU buffers 與 OrbitControls 的 document capture keydown 註冊，再執行十次 reset／current export／import，及另外九次重新 mount／reset／import／dispose，合計十次 mount／dispose、十九組 reset／import。觀測原生 RAF、Worker、WebGL create／delete／context loss，以及真正 Rapier World／EventQueue 的 free；沒有用手動 cancel 或替代 renderer 製造通過。

目前已保存一次兩案通過、exit 0 的 [瀏覽器結果](../../artifacts/v1/physics-acceptance-20261027/browser-20261027012455939/browser-results.json) 與 [實測資料](../../artifacts/v1/physics-acceptance-20261027/browser-20261027012455939/browser-measurements.json)。該次 World 48／48、Queue 48／48、Worker 18／18 均釋放；最後沒有 pending RAF、canvas 或受監測的全域輸入 listener，等待後 RAF callback count 不再增加；十個 WebGL context 皆失效且受追蹤的 buffers／textures／programs／shaders／framebuffers／renderbuffers／VAOs 歸零。

該次兩個 test-specific source guards 都通過；較廣的 wrapper 在開始測試前後發現 `acoustic-service.ts` 有並行更新，因此 [完整 wrapper](../../artifacts/v1/physics-acceptance-20261027/browser-20261027012455939/browser-verification.json) 如實保留 `sourceStable:false`，不可當作整個來源樹凍結的證據。後續擴充了 visibility／IME／focus 等 listener 觀測；最終全來源凍結重跑尚待記錄。

## 重現缺陷與限制

最初真瀏覽器於 Reset 後 export，重現 `BEHAVIOR_INVALID: STALE_OBJECT_GENERATION`；原始 [失敗結果](../../artifacts/v1/physics-acceptance-20261027/browser-reset-generation-failure.json) 保留。根因是 live runtime generation 被當作 fresh-world Project pin。實作者修正序列化副本，保留 live document 與錄製的實際 generation；追加獨立回歸確認。

隔離 review 另指出主入口原本缺少可顯式卸載的 React root／RAF ownership，以及 OrbitControls detached canvas 的 document listener 釋放風險；bootstrap 與 UI owner 修正後，以以上真瀏覽器 counts 複驗。

實際 KeyF 邊界另重現：固定球的側面加入 0.05 m 交疊障礙，ray 仍先命中球，真 shape query 明確回報 `OVERLAP`，但原 Host 仍提交 Unlock。原始 [RED 證據](../../artifacts/v1/physics-acceptance-20261027/unlock-clearance-red/verification.json) 保存 test exit 1 與前後來源 hash；不得以 mode memory 正向通過取代 clearance 拒絕驗證。

修復版本的互動測試與隔離 review 保存在 [interaction v3](../../tests/interaction-runtime/evidence-20261027-v3/verification.json)。本測試作者另執行原 targeted case，確認不修改 expected 也能通過；完整 29 案與新 bootstrap 的 browser gate 仍以後續固定結果為準。

本組證據限同機 Chrome，使用 ANGLE／SwiftShader；沒有推論硬體 GPU 效能、JS heap 完全無洩漏、所有 DOM listener 類型、HMR／pagehide 自動路徑、音訊聽測或跨瀏覽器表現。World／Queue／原生 GPU ownership 的釋放不等於 JavaScript heap 應下降為零。
