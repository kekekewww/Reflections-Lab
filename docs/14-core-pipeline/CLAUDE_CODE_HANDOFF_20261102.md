# Claude Code 接手：核心管線、全部可見功能與 UI 驗證

更新：2026-11-02。本輪Codex有限工程已完成本機main整合；全217family有限收據、新五WAV與一次完整check均PASS，僅字面原生操作方法仍受外部URLpolicy阻擋。main已證整合截點為 `fe663ca9f384d247bcd89b331936f6be202c761f`，見[實際本機整合收據](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/529524649ac8b7fbff91d919bf6dcab6403b7865)；後續純文件／記憶bookkeeping的最終HEAD由Root實際Git讀取，不猜自身commit。產品程式固定於 `5010685ebfd6bb482aa37e1d82e5f64418b55d9b`，實際 production entry 為 `index-Nm7oRfzL.js`，SHA-256 `baf2542885944b5becf2138fa40e13831d04a1ce7dc1b9f03d3a845d6731706a`。最新完整 runtime **1536／1536、0 fail／skip**，分開的 global format／type／build／licenses 均 exit0；新[完整 `npm run check` 收據](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/2f387d58e834799d809cbbdaab03e2afd2cb4194)已實際exit0：8個TAP群組均0fail／skip、runtime1536／1536、當時English417／417及0missing／stale／errors，14個重建檔與501archive exact。見[建置收據](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/0f74154f68ef29cd28e9c92043b29cdbdcf118e7)及[讀核](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/3e3f490e543511fc9820d959c37cbcde7647e4a1)：14 個封存檔 hash 全符，8 個實際 HTTP200/hash、6 個 source maps 未請求。

## 接手範圍與順序

使用者已確認 R18／R21 基本功能正常，再授權六項核心、專案內平行工作樹、本機 main 合併、長期記憶／英文／Claude 交接、實際操作匯出每一個音檔；後續追加全部 UI 參數測試與「也實作尚未支援的選項」。以[核心契約](IMPLEMENTATION_CONTRACT.md)、[UI 契約](../15-ui-parameter-audit/CONTRACT.md)、[未支援選項補充](../15-ui-parameter-audit/AMENDMENT_UNSUPPORTED_OPTIONS_20261102.md)及[正式驗收補充](../11-v1/ACCEPTANCE_AMENDMENTS.md)為準。

1. 讀 AGENTS → knowledge/schema → wiki/index → now，再讀 Task0023..0031及本頁直接證據。舊十月 handoff 保留歷史，不能代替現在的 source 與 task。
2. 先核對實際 Git branch／HEAD／status／worktree list；整合工作區為 `D:/Developing/Meta Hack/.worktrees/integration`，接收根目錄為 `D:/Developing/Meta Hack`。已證main整合截點為 `fe663ca9f384d247bcd89b331936f6be202c761f`；之後bookkeeping HEAD以最後實際Git為準，不猜文件自身commit。
3. Node22.17.0／npm11.4.2，沿鎖版工具鏈。保留原始失敗與 source pins，不重標舊 browser PASS 為501重跑。
4. Claude 獨立重新驗證與調整是下一階段；其後由使用者人工測試新增功能。這兩項目前 NOT RUN，不是個別核心 task 結案的額外前置。原基本真人確認不重開；完整 V1、科學／裝置／聽測、600秒性能與 Meta live 仍分開。

## 已實作的核心與新增能力

| 範圍 | 實際行為與證據入口 | 能力界線 |
| --- | --- | --- |
| 錄製／A-B | [Stage01](stages/01-recording.md)：8frames／32MiB有界 evaluation Worker、drain／cancel／epoch、固定 source phase、B重算；[Stage08](stages/08-motion-experiment.md)安裝真 Motion 到實驗 world | 不是總 heap 或原600秒性能保證；背壓可在完整 tick 邊界暫停 |
| 音訊與觀測 | [Stage02](stages/02-audio.md)：關閉 diagnostics 真停觀測、128 ring、unknown/null，gain／delay／shape／方向更新分開；同 AudioEngine 真 OfflineAudioContext | control-thread 觀察不是 audio callback CPU、裝置校準或人耳連續性 |
| 共用能力／Bounce | [Stage03](stages/03-capabilities.md)：同源 capability 與真 Rapier 靜態支撐 Bounce | Bounce 為 Tuned 有限分類，不是任意動態接觸完備模型 |
| Meta 實驗流程 | [Stage04](stages/04-meta.md)、[真 UI 閉環](stages/04-meta-ui-workflow-receipt.md)：持久 budget、request identity／取消、baseline→分析→candidate→compare、preview／apply／undo及 grounded table | 實際 UI 為 offline；網路關、預算0、Meta live NOT RUN |
| Motion | [Stage05](stages/05-motion.md)、[generation 修補](stages/05-motion-generation-fix.md)、[cadence](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/4d9a298a737c1e12b78a8c21caee7a8bda740acf)：真 controller／kinematic／impulse／trajectory，原子 Scene sidecar／Undo、generation rebind；30／60／144 render cadence 各240 fixed ticks exact | dynamic servo 為 Tuned；不以 teleport 代替動作，碰撞／掃掠條件依正式契約 |
| 短 take mix／stems | [Stage06](stages/06-render.md)、[缺資產直接負例](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/55c1a91660460455f240ed6cc24004d1136084a0)：同 AudioEngine native OAC、共同時基、mix／master／dry／owner stems、job hashes／cancel／atomic publication | 30秒 take、45秒 context、16 outputs、256MiB工作估算／192MiB輸出；不是 ADM、無限長 take 或完整 chunk carry |
| Zone | [實作綜合](../15-ui-parameter-audit/ZONE_IMPLEMENTATION_20261102.md)、[六案真 UI 讀核](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/7d7f65aa520947ef3e2cacb5acfa69eb999c6b83)：AABB／sphere、穩定 ID、作者設定／Undo／持久化、真 fixed-step OnEnterZone／OnExitZone、Host／AI／Preview／replay 接線 | max16；body center＋hysteresis、初始 baseline 不冒 enter；沒有 outside-to-outside swept detection。停用 volume 不產 occupancy，仍可作明示 emitter anchor |
| 球／膠囊與動態反射 | [方法契約](../15-ui-parameter-audit/acoustic-geometry/MODEL_CONTRACT.md)、[讀核](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/f4319fba1b61aec937fde6ed87ecc03e61123542)、[真 UI](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/659ad53aec37d16b40be70a3d5991fd7b3a89cde)：解析遮擋、真法線／當前 pose、有界一階反射、明確 backend/version/emitter policy，真 solver paths | 準靜態與射線幅值近似；不含曲率聚焦／caustics、移動邊界波動／Doppler、實體穿透；256共享預算顯式拒絕，舊105物件fixture仍保留 |
| Project 環境 | [component](../15-ui-parameter-audit/environment/REPORT.md)、[a10 真 UI 四案](../15-ui-parameter-audit/ENVIRONMENT_UI_RETEST_20261102.md)：medium／temperature 正式保存、載入、匯入／匯出與缺欄 legacy 預設 | 原 vacuum35.5→air20 FAIL保留；一般 Scene Undo 不回復獨立環境設定，錄製與 A/B 沿各自固定環境來源 |

Task0024..0031（含0028）均按原有限criteria與直接收據結案；Task0023只因字面nativeAC04外部方法gate列BLOCKED。沒有加上Claude已執行的前置，也沒有改原criteria。唯一任務系統仍為 knowledge/tasks；14項較廣 PERF BACKLOG 與7份 PROPOSED ADR 未全部啟動，custom Worklet／GPU／cloud／simulation Worker 不自動成為本輪全部實作範圍。

## 全 UI 的實際證據

中央盤點在[stages/11-ui-parameters](stages/11-ui-parameters/INVENTORY.md)：最新 AST **275 sites／217 semantic families／71 Help caller sites**，217／217families已join有限操作／可達收據，0pending。最後真DOM補證確認Paths scrollLeft0→6→0、Events0→191→151（wheel／ArrowLeft），Zone Editor線框顯示／穿透選取及Replay／FPS隱藏有五張真圖有限目視。71Help中68公開可達caller均有非空內容；兩個真nativeRejection條件及一個Host不可達空comparison.status分支仍明列未觀測，20個定向caller逐02／03／04原PASS觀測串接，不冒單一clean全量run。見[最後Help報告](stages/11-ui-parameters/pipeline/help-sweep/REPORT.md)及[Root圖／raw讀核](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/af0cee341db1385f595c0abb1e2cb9bc308b0d7d)。這是有限操作／合法狀態矩陣，不宣稱每個無限值組合、所有OS輸入或全V1。

- Behavior／assets 57不同案例、44 families，固定原19db來源；Scene舊27項正常操作、後續a10環境4案，原unsupported與環境FAIL各另續證。
- Interaction59 families／58case IDs跨253／d9／49來源；最後49 paused-click與gizmo兩個指定情境重驗，保留原receipt整體失敗及個案結果，不重寫成單次全PASS。
- 曲面8組由原4PASS及同49四組harness-only重驗構成；原4FAIL保留。實際 sphere硬／軟頻帶、capsule與box動態姿態／法線／path／材質角色、Undo／持久化／policy限制可核。
- Pipeline主22案例已各有版本化有限PASS：Events1、Comparison1、Agent3、Motion6、Render4、Zones6、Combined1。Motion5在49、affected第6案在9fc；Zones6在9fc跨02／03／04，不能冒單次clean6/6；Combined為501新單案。
- [Tail501 focused回歸](stages/11-ui-parameters/pipeline/render-performance/tail-validation/REPORT.md)另1／1PASS、45.2秒：10.5／10.50／空白草稿均擋Generate且保留舊manifest；Esc回復0；0.25合法產生3.25秒／tail12000frames，10合法產生13秒／tail480000frames。0.5只是spinner增量，不能把0.25原生stepMismatch誤當應拒絕的domain值。

目前缺陷修復入口為[FINAL_FINDINGS](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/8469bfd6009ac9f4d664456a2efb99a161148dfd)，逐項固定九個已修問題的25個原始證據hash；舊ACTIVE_FINDINGS是a10時的interim歷史，不是仍待修清單。已修的真產品缺陷包含monitor啟用前偏好失效、gizmo與camera gesture／生命期、replay stale frame與seek、sealed take busy匯出、Save回饋、Zone context／position continuity、曲面backend reply／emitter policy、Record於await前取消placement及controlled take欠帳。9fc修補後真 UI 先Stop5ticks過載前綴、再新run180ticks6..185、Replay正常；不清除／消耗既有wall-time debt、不放寬ordinary advance overload或精確tickguard，見[修補](../15-ui-parameter-audit/controlled-capture-clock/REPORT.md)及[真重驗讀核](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/ecd811173ef0e90e9b65991611725f831cf998ef)。原自然過載／queue-full pause仍保留為限制，不冒性能健康。

Ghost文件衝突已按已確認政策reconcile：held快照保留；未提交ghost在pause／blur／lockloss取消，不放置；明示Resume後重建preview。原oracle FAIL／精確preimage／[Conflict](../../knowledge/conflicts/78d81bb5-7d39-426e-8394-8cc5838ee626.json)均留存，不為錯誤oracle改正確產品。

## 最新實際音檔與來源

新Combined501真DOM **1／1PASS、35.7秒**，實際作者／import→Motion移動→Zone enter30／exit62→非線性gain→動態球反射→3秒／180連續ticks19..198→Render→逐檔下載。9個原UI下載包含兩份Project、recording、5WAV和manifest；[主收據](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/279a3bceb606308c1da386fa7b2eeee93117a258)、[recording proof](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/9e39064bc4b42d2dfb9de8e5458a9162f16c4246)、[raw／normalized事件與180個非stale球面path補充](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/459705281b425073833f90a14d88323fe6069d81)及[Tail／Combined獨立bytes讀核](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/efd3cfa307e790ee20adcbec228c810ac6b6a5ce)可核。讀核已確認Tail15＋Combined9個下載及9個Root原檔副本bytes／SHA全符；不是再次執行browser或獨立RIFF的替代品。

固定job為 `render-37c82ed6-7aaf-4b4a-9537-a718b75b46ab`，實體交付目錄：

`D:/Developing/Meta Hack/exports/core-pipeline-20261102/integrated-final/render-37c82ed6-7aaf-4b4a-9537-a718b75b46ab/`

內含 `-mix.wav`、`-master.wav`、`-dry.wav`、`-stem-46219de459d8-ball.wav`、`-stem-be569a2d963a-speaker.wav`及實際 `<job>.manifest.json`。`UI_ORIGINALS_MANIFEST.json`保留label-prefixed原下載path→原suggested filename→副本的bytes/hash；兩Project同名各存project-origin／project-final，沒有改音檔bytes。原始downloads及大型trace部分是ignored本機產物，並非全在Git；bundle封存在旁邊source-bundle-5010685。搬機重驗需要同時帶這些明列的實體檔案。

新[Stage12報告](stages/12-final-integrated-ui-audio.md)與[獨立RIFF收據](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/fd0e82716a062ccf7d6eb9e68742ae21806f2d64)已PASS／exit0：5檔48kHz／stereo／240000frames＝5秒，各1920056bytes；stem sum最大誤差1.1420343071222305e-6，小於原2e-6。Master peak0.00924539566040039／0超界；獨立peak／outsidecounts精確符合manifest，float32轉換clippedSampleCount全部0。原不分tap一律±1錯oracle的RED及7項工具正負回歸另存，未改產品或音檔。既有contract讓pre-master mix／dry／stems以IEEEfloat32保留真樣本，可以超過±1且不hidden normalize／clip；獨立peak／outside counts必須精確核manifest，安全Master另驗有限範圍、所有樣本finite及原2e-6 stems sum容差不得放寬。本批all5 `historyIncomplete=true`、preRoll0須明示：這不是完整重建take開始前所有native DSP history。09／10兩批舊音檔與獨立parser收據保留原42d／b41來源，不能借作501新WAV驗證。

## 驗證與外部限制

原完整check的Wiki7 metadata errors exit1、type/eslint0後format1、runtime1522中1511PASS／11FAIL，以及9fc1532PASS後harness syntax導致format2均保留固定raw。後續5011536／format／build／licenses的exit0是新命令，不能改寫舊FAIL。[新完整check](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/2f387d58e834799d809cbbdaab03e2afd2cb4194)已實際exit0，觀測HEAD fad14cc6ae4a521c23876e3833200e3d8e98a4c8與501產品程式相同；8TAP群組全0fail／skip、runtime1536PASS、14個重建檔exact。這是新通過命令，不改寫先前失敗。

前三次原生ComputerUse是appapprovaltimeout／0input的固定歷史；第四輪依使用者明確允許只建立獨立視窗，真Ctrl+N成功，隨後工具因WindowsURL可信度policy停止整turn，未完成產品導覽／匯出。不得稱第四次timeout或所有嘗試零nativeinput；Task23AC04仍false／PARTIAL_EXTERNAL_NATIVE_URL_POLICY，見[最新實際收據](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/7592a80024b7c1f8d94c546048a7b3e5b5bcd463)。實際產品操作是Playwright CLI scripted DOM／headless Chrome，不能叫native、MCP或真人鍵鼠。Task0023 AC04原文字維持verified=false／PARTIAL_EXTERNAL_NATIVE_URL_POLICY；所有不受影響工作與本機Main均已完成；Task0023只因這個外部方法gate維持BLOCKED。沒有使用者已接受改方法的推定；日後真正native成功或使用者明確修訂方法才重新判定。詳[分類](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/860995b740a800388f031fffdbd71a27d5f39ab6)。

[R21最新唯讀檢查](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/40904c40d5748768fb545181a7eb777f326c2066)於14:03UTC僅broker20952仍存活、descendants空；[歷史檢查](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/3313b25b5a75e35c160ae96e7580199e15c5703c)的舊subtree不再冒當現況。Active jobs仍未知；先前automatic approval review拒絕刪除占用中的樹，未發shutdown IPC／kill／move／delete，C primary仍是本chat attachment。原檔／已核backup均保留，不能說舊樹已全刪。

原根記憶snapshot分支 `codex/pre-main-memory-20261102`、commit `4ba43781bebbe7f93e4c66075019cb1371befa35`須保留；它包含舊Wiki，不能merge覆蓋新記憶。Root已完成授權本機main正常整合：`fe663ca9f384d247bcd89b331936f6be202c761f`、129原untracked逐bytes／SHA保留、4ba snapshot分支不變、11個feature／integration tips皆ancestor；原根freshbuild0且8個runtime檔exact，另outDir的maps路徑不同不聲稱map bytes相同。未reset／clean／push／部署。Meta key只在server、網路gate關、費用預算0；不代接受條款或決定root LICENSE。正式600秒性能FAIL、科學reference／V3外部solver或全波、V4長時deadline、V5裝置／聽測／校準與Meta live仍各自未通過。

Claude接手後依最後source／bundle及task criterion重跑受影響unit/runtime、真production UI與OAC、record/replay/A-B、Zone／曲面及音檔鏈；發現問題保留原FAIL與oracle／source條件再修根因。先看每份收據方法與scope，不用internal API或fixture transport代替真UI／Meta live，也不重設使用者已完成的基本人工gate。

既有Task0022仍有原R19字面AC06／BLOCKED歷史metadata，需由Claude依既有來源reconcile；最新使用者基本功能確認已解除本輪前置，不向使用者再索取R19／R21基本測試，也不把未知bundle的概括回報冒成R19三項逐項獨立量測。
