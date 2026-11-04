# Zone UI 參數驗證收據

本 lane 以 Chrome **156.0.8078.75** 操作 production preview 4173，六個不同案例均已通過。方法為 **scripted DOM／非原生滑鼠鍵盤**：只用實際輸入、按鈕、檔案匯入與下載；evaluate 只讀 DOM，沒有 HostInternal／runtime bridge、付費模型、部署或產品修改。

實測來源為 `9fcf3f0657813f5aa07bf936a1cb6a50f2628f30`。六份成功收據都從 HTTP 收到同一 `index-DO7iDxDy.js`，SHA-256 **5c75259d334399afeab1c53a5d32e0e7a3b4067f862b245836fdd542b96e7819**。後續 Tail 修補／新 build 不借用此來源截點。設定為正常100%、1440×1100；沒有重加已移除的200%必要門檻。

## 實際通過範圍

| 案例 | 成功收據 | 實際結果 |
| --- | --- | --- |
| 01：八頁籤與作者欄位 | final-9fcf3f0-02 | 8 個 stable tab IDs、逐一 pointer、唯一可見 panel、Home／End／左右 wrap；ID／名稱 native 長度上限與自訂 invalid；三軸中心及半尺寸的 min／max／blank／越界、sphere radius、hysteresis嚴格關係；中心 X 原生方向鍵與實按 spinner；Enter 儲存、名稱 trim、ID不可改、Escape／取消、重複 zone ID、跨 entity ball ID 的 Host 原子拒絕。 |
| 02：歷史與持久化 | final-9fcf3f0-02 | 新增後 Undo 恢復沒有 zones property 的舊資料，Redo；加入 Zone 規則後 save/load/export/import；相同 projectId／sceneId／revision 但 registry 內容不同的匯入不能被舊草稿覆蓋；另一個真正 Scene revision 變更也禁止舊草稿提交。 |
| 03：容量與匯入負例 | final-9fcf3f0-02 | 16 個區域合法且新增入口停用；第17個、跨 entity ID、錯 shape 欄位、未知欄位均在實際匯入 UI 原子拒絕，保留原場景與16筆區域。 |
| 04：規則與引用 | final-9fcf3f0-02 | 空 registry 時 Zone triggers 停用；有 enabled zone 後真 DOM option.disabled=false 才選取。新增規則須明選 zoneId；預設 object attachment。ZONE_IN_USE 列真 rule refs，disabled 現有引用保留，新規則只列 enabled zone；切非zone trigger清除ID，retarget後可刪除及 Undo。 |
| 05：真事件、重播、A/B | final-9fcf3f0-03 | UI Capture3s 取得180幀、真 raw OnEnterZone／OnExitZone 各一；normalized source=zone／zoneId／eventId逐筆一致；兩筆 logical audio start 與 parent raw body center相同，未移到zone中心。live/replay都按下載raw ID逐UI列讀詳情核對；重播後下載的錄製 SHA完全相同。registry不變的behavior B成功；改zone center後拒用舊物理。 |
| 06：停用體積與明示錨點 | final-9fcf3f0-04 | 透過實際UI匯出／合法Project JSON作者修改／UI匯入，設定新增AlwaysOn rule的明示zone attachment；介面沒有此可編輯control。區域disabled時物件仍跨越名義體積、raw zone事件0，但 logical audio位置維持zone中心。仍有引用時刪除被拒；replay／running／recording作者入口停用，結束後恢復。 |

以上是 **六個不同案例逐案通過，並非一輪乾淨6/6**。沒有為了漂亮數字重跑未受影響的已通過案例。逐欄位／方法／狀態與未覆蓋分支見 `parameter-inventory.json`；六份成功來源與實際值見 `verification-summary.json`。

## 事件與來源資料

實際垂直落球 fixture：

- zone.browser：AABB center=(-0.8,1,0)，halfExtents=(0.5,0.4,0.5)，hysteresis=0.02。
- 選真 ball，透過UI新增OnEnterZone與OnExitZone，各明選zone.browser，保留object emitter。
- Captured run：`recording.eb5dfa7f-85f7-4ddb.capture.1`；180幀；raw與normalized各2個zone事件，ID為 `zone-46b003b364564c12`、`zone-b062948aacbef57e`。
- 錄製與重播後下載 SHA-256 均為 `736803addad5d8bd65288897b04237a8a866a67918b788d13850edc3274c91b1`。
- 含Zone規則的UI-exported Project SHA為 `fdb0f365b696bc61ecd68fd0f5e250b1a272bc7480f42b798c846fa9c3d539a5`。原本與新增Zone+rule後的Scene objects完全相同，均6個，沒有phantom object。
- disabled fixture的實際body Y範圍約0.221939–1.998297 m，確實跨過名義體積；zone事件0，明示anchor仍在(-0.8,1,0)。

Project／錄製原檔放在專案忽略的 `.cache/parameter-audit-pipeline-zones/<attempt>/`，路徑、bytes、hash在各receipt的artifacts及總manifest。這些是實際UI下載，不是合成成功收據。此垂直fixture提供Renderer owner作備用；最終水平 Zone＋curve＋dynamic＋個別WAV輸出由Root另排Combined lane，本lane未執行或宣稱WAV／聽測通過。

## HelpTip caller實證

3個source callsites、4個caller實例，共8筆focus／實際pointer click啟用記錄，每筆都有Escape關閉、topic、sourceCallsiteRef、actual aria-describedby與tooltip ID：

- `ui.zonepanel.zonepanel.helptip.2a43c2d943`：區域標題。
- `ui.zonepanel.zonepanel.helptip.cb7efbc36a`：新增區域；實測draft存在時的disabled-control helper。
- `ui.rulecard.rulecard.helptip.e2595a7002`：事件區域；兩個真enter／exit rule實例分別測。

沒有把generic HelpTip一次成功冒充所有caller／所有條件內容通過。predicate分支與未測方法分開記。

## 原始失敗與護欄觀察

1. attempt01：Add action切換為disabled helper後，harness先移走pointer關閉tip，再對已聚焦helper呼叫focus，沒有真正focus事件。保留FAIL；修正為真Tab離焦並確認不再focus，再進focus，沒有改產品或fake DOM事件。
2. attempt02：以OnEnterZone字樣點first，選到同trigger的audio LIFETIME_EXPIRED row，非raw Zone row。保留FAIL；改依實際下載raw.eventId逐UI列讀詳情ID定位，live與replay均核對同ID。
3. attempt03：harness regex誤加雙重backslash，使tick解析永遠-1。原畫面另真實顯示tick201與「錄製評估佇列已滿，已在完整tick邊界暫停」；此背壓保護觀察保留，**不稱性能健康或無背壓**。只修regex，先對原failureBody自檢解析201，再僅重驗case6。沒有reset、跳過guard或造資料。

最後一次CLI exit0；fixture teardown完成；2026-11-02 11:27:32 UTC只讀CIM為headlessChrome[]／matchingNodeCli[]。此時已RELEASED，後續沒有啟Chrome。成功六案的agent API要求、被阻擋外部／規劃要求、page errors均0。

## 限制與Claude重驗

區域事件是 **Derived固定步物件中心＋hysteresis**，不是整個collider overlap、swept／CCD或實體聲學量測。UI數字／事件／logical audio不代替硬體PCM、聽測、Meta live或600秒效能。

Overlay只有editor截圖離線檢視，未做canvas picking、FPS／replay像素隱藏的完整browser gate；沒有讀Three物件繞過UI。FPS非editor作者限制、故障注入pending/no-ack、fast outside→outside／teleport/generation等實體邊界未由此browser強造；對應Node核心證據仍屬capability_core。A/B完整canonical registry（連name/order）保守拒絕的契約保留，本browser只實測center變更拒絕。

重驗先讀三次FAIL與成功raw receipts，再用實際新版preview／唯一browser lease設定：

```powershell
$env:PIPELINE_ZONES_BROWSER_LEASE='granted'
$env:PIPELINE_ZONES_ATTEMPT='<new-attempt>'
$env:PIPELINE_ZONES_CANDIDATE='<actual-source>'
node node_modules/@playwright/test/cli.js test --config tests/browser/parameter-audit/pipeline-zones-audit.config.ts
```

單案／受影響重驗可用原test title grep；不要覆寫舊attempt。Root擁有Git／Main合併與長期記憶／英文鏡像，本lane未改產品、Git index或Wiki。
