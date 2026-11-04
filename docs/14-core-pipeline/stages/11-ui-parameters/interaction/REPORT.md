# 互動控制與參數實測交接

責任範圍：Toolbar、工作區／版面、專案儲存與匯入匯出、SceneList／primitive 建造、編輯觀察相機、全部可見 gizmo handle、FPS 與免鎖定操作、快捷鍵、共用 NumberField／HelpTip。聲學材質數值、聲音行為、Zone、錄放／分析及音訊輸出由其他 lane 整合。

本分項共有 **59 個 interaction family、58 個不同 case ID 的最新分項結果為 PASS**；每個 family 都有實際收據，無未映射 family。這是分版本組合證據，不能稱為單一 49 build 完整重跑 58 組，也不是全部數值／狀態的 Cartesian 組合驗證。機器對照見 [FAMILY_COVERAGE.json](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/1a7e11e76b40fc8bd2a359f9780f7624b113e37a)。

最終指定回歸使用 `49bde82be6f9def5058bc8f3076e105fcdfd535d`、production entry `index-C4qRBPy8.js`、Chrome `156.0.8078.75` headed。兩個指定 case 均有 PASS，unexpected console error 為零；Chrome 已正常關閉並釋放 lease。

## 最終兩項回歸

- [final-49bde82/receipt.json](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/197fac0c61bd8974bc200f8d133d42e2c31223be)：`native-paused-click-resume` PASS。Held 時按下左鍵仍暫停，放開只恢復、不投擲。Ghost 按較新政策在 Pause 取消，不放置；恢復不重建預覽，物件數不變。
- [final-49bde82-gizmo/receipt.json](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/dc0de0b19ec3bd7e66a6914fbb4936f504ab2d43)：`gizmo-group-lifecycle` PASS／exit 0。Box、Sphere、Capsule 分別執行 Add→Undo→Redo→Delete，之後原 ball 的 gizmo 仍可提交且只增加一個 revision。`consoleErrors=[]`。
- 第一輪 final 的 gizmo case 因讀取不存在的 DOM `aria-label` 得到 null，產生七列 strict-locator 錯誤。該輪 production 沒有 TC console error；原 FAIL、畫面與 exact runner 保留。重驗改從真 UI 匯出 Scene 取得穩定 object ID，再以可及名稱選取；沒有修改產品來迎合測試。

## 分階段原始結果

| 收據 | 實際結果 | 解讀 |
| --- | --- | --- |
| `serialized-old-bundle/receipt.json`／19db9f9 | 14/19 PASS | 真 Alt/gizmo 缺陷及四個測試前提失敗保留。另有 Held Place 初始失敗的 `priority-held-initial.json`。 |
| `full-253852f-initial/receipt.json` | 32/38 PASS | 完整首輪；所有十個額外 handle、取消、物件／求解聲線選取、native pointer 動作、輕放及 WebGL fallback 已測。六個失敗未覆寫。 |
| `six-d9dc624-initial/receipt.json` | 5/6 功能 PASS，整體 FAIL | 修正 Help／Look／Rotate X／F 非同步前提後通過；Pause 保留 ghost 的舊 oracle 錯誤仍保留；另捕到真 TC console error。 |
| `old19-d9dc624-initial/receipt.json` | 19/19 功能 PASS，整體 FAIL | 所有原 19 組重測通過，包括真 Ctrl+Z；整體因相同 TC console error 失敗。 |
| `final-49bde82/receipt.json` | 1/2 PASS，整體 FAIL | 正確 Pause／Resume case 通過，gizmo 測試因 DOM aria-label 前提失敗。 |
| `final-49bde82-gizmo/receipt.json` | 1/1 PASS，整體 PASS | 修正 locator 後，僅重跑三形狀卸載回歸；0 unexpected console error。 |

各原始 FAIL、TAP、trace、source preimage 均保留其原狀。舊 19db serialized runner 的 exact source bytes 無法從既有 hash 還原，其限制另見 [HISTORICAL_SOURCE_NOTE.json](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/ef2173b26b40718a62c3d36d32cbd12d371d2b49)；不以後來修正腳本冒充原稿。

## 已修復的產品問題

1. **Held 輕放入口**：原 Place 僅按 ghost-valid 判斷，Held 時被停用。現在顯示「輕放／Gentle place」，走原有有界 Host。正常支撐面實際釋放成功；缺支撐時保留 Held 並顯示拒絕原因，沒有放寬碰撞／支撐政策。
2. **Alt 相機與 gizmo 搶同一手勢**：原 Alt 左拖改到 ball 的 Scene transform。現在 capture-phase ownership 排除 TransformControls；Alt 中途放開、native capture loss、分頁切換取消與下一次 gizmo 均驗。取消不提交 Scene。
3. **Runtime error 無法關閉**：App 的 Dismiss 同時支援本地與 Runtime error，使用 `clearError`；實際非法專案匯入後可關閉錯誤且 Scene 不變。Runtime action 由 Events owner 整合。
4. **Save 成功被舊暫停原因遮蔽**：狀態 presenter 同時顯示最新 notice 與仍有效的 pause reason，按本地化文字去重。實際 Save 可見成功確認，Scene／暫停原因不變。[來源與單元收據](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/1dffde830ebc37a6595429f8abea996a30392bd2)。
5. **Undo 移除選取物件後 TC 更新已脫離的 Group**：兩個獨立 production runner 都捕到 `TransformControls: The attached 3D object must be a part of the scene graph.`。原 PhysicalObject／TC 以 passive effect 清理，Group 已移除後可能先 render helper。現在 stable callback ref 同步 retire 匹配的 TC，layout effect 在 ref 提交後附掛；保留 pending、owner、disposed 交易守門。真 Three 負例／回歸與最終 production 三形狀 Undo／Redo／Delete 全通過。[修正收據](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/08550289757d25dee57f173e504628cd691e283e)。
6. **Record 被 pending placement 的新 Resume guard 吞掉**：全量 Runtime 的原 race case 顯示 rev 1。真 gate 診斷確認 Record 根本未開始，晚到 placement 因而提交。依 Root 確認的既有 Record 優先政策，現在在既有 stopPreviews await 前同步取消 pending placement，再保留 FPS input／focus／pause／replay guards 啟動錄製；重用已本地化的 `PLACEMENT_TRANSPORT`。原 rev 0 不放寬，新增 recording 已開始、pending 已清與 late result 不破壞 take 的斷言。[修正收據](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/1830df34d60cd3a36705c3db0859c372299073ab)。

## 實際操作範圍

- 三個工作區；中英 locale 切換與資料保留；Start／Pause／Resume／Reset；Scene／Inspector 隱藏、tab exclusion；兩個 divider 的拖曳、左右方向鍵、Home、double click、min/max clamp；900px 正常 100% pane 切換。
- 真 file chooser 匯入、有效／畸形 JSON、原文 disclosure／鍵盤捲動、Cancel／Escape 與焦點回復；Save／Load／Export、Ctrl+S、reload persistence；primitive 三形狀、逐 object-list row、搜尋、Duplicate／Delete、Undo／Redo 與 Ctrl+Z／Ctrl+Shift+Z、文字欄 Delete 隔離。
- Move／Rotate／Scale／Frame、Alt 左拖／中途放 Alt／中右拖／wheel、Ctrl/Meta wheel browser ownership、空白取消選取、三維 ball 選取與真求解 path 選取。
- **19 個可見 gizmo handle**：translate 的 X/Y/Z、XY/YZ/XZ、XYZ；scale 同七個；rotate 的 X/Y/Z、E、XYZE。軸／平面分量、不變欄位、單 revision、sphere uniform scale、Box plane scale、screen/free rotation 與 Undo 均有對應 observation。Rotate X 額外以目標轉黃、其他軸保色確認真正 picker，避免把可見 RGB 線等同重疊的不可見 torus picker。
- 真 browser Pointer Lock、WASD／Shift、Enter、Tab／Shift+Tab／Escape、明示重新取得滑鼠；免鎖定 opt-in、八個移動／視線按鈕與箭頭，核對 Listener 實際位置角度；native／按鈕 grab／drop／throw、E／R／wheel／F／B／L；preview start／valid place／cancel／right-release atomic place；Gentle place 與 G 成功及無 support 安全拒絕。
- 共用 NumberField 的 Enter／blur commit、Escape revert、空值／負值拒絕、locale 切換草稿保留、明確標示的 DOM isComposing guard。Mass／Friction 是共用行為代表；各 caller range 與 Host 語意由相應 lane 的參數測試補齊。
- HelpTip hover／focus／Escape／真 browser touch、disabled adjacent info 共用契約；另七個狀態掃描共 394 raw observations。11 個負責 caller及4個 Listener incidental caller 有 exact source-site 映射，80 raw→66 去重 caller/scope occurrence；不是394個不同 caller。[對照與未測分支](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/3fa219aec43c3fb2139f387e039e7c683edbecfd)。

## 基本驗證與重跑

本分項實際執行的 focused Node 命令：

- `node --import tsx --test src/ui/viewport/observer-gesture.test.ts src/ui/viewport-controls-review.test.ts src/ui/viewport-gentle-placement.test.ts`：5/5。
- `node --import tsx --test src/ui/status-feedback.test.ts`：3/3。
- `node --import tsx --test src/ui/viewport/gizmo-group-lifecycle.test.ts src/ui/viewport/observer-gesture.test.ts src/ui/viewport/gizmo-commit.test.ts`：11/11；包含原 Three 錯序的預期負例診斷，正確路徑沒有攔截 console。
- `node --import tsx --test tests/app/fps-review.test.ts tests/app/replay-lifecycle.test.ts tests/app/recording-export-lifecycle.test.ts`：34/34。

以上命令有重疊測試，不相加當作獨立數量。窄檔 ESLint／Prettier 通過；gizmo 修正後 typecheck 通過。Root 的全 Runtime／build／license 與 HTTP artifact 主收據獨立保存於 stage 15，這裡保留本分項執行範圍。

Browser 指令在實際 production preview 4173 執行；每次單一 Chrome，結束關閉。最終精準命令：

```powershell
$env:INTERACTION_HEADED = '1'
$env:INTERACTION_RUN_LABEL = 'final-49bde82'
node tests/browser/parameter-audit/interaction-completion.mjs gizmo-group-lifecycle,native-paused-click-resume
# 原第一輪兩案收據保留；修正測試 locator 後只重跑缺的 gizmo 案：
$env:INTERACTION_RUN_LABEL = 'final-49bde82-gizmo'
node tests/browser/parameter-audit/interaction-completion.mjs gizmo-group-lifecycle
```

重跑應使用新的 run label，保留既有資料。完整 `interaction-audit.mjs` 與 `interaction-completion.mjs` 可重演其各自 scope。fixture 從真 UI 匯出後編輯，再由真 file chooser 匯入；Browser 沒有 test bridge 或直接呼叫內部 Runtime。

## 後續驗證界線與文件衝突

- Native Web Pointer Lock 與 browser pointer/keyboard 有實證。測試環境的分頁切換未發出 native window blur／visibilitychange，不能出具 Windows OS 焦點／hidden 或真人操作證據。明確 DOM blur／composition 分支已驗且沒有自動恢復；OS IME、原生 Computer Use、聽測與長時間效能由主驗收另列。
- WebGL Retry 在真正禁用 WebGL 的環境有明確 fallback，不能視為 GPU 已恢復。無效 placement、忙碌及 unsupported gate 保留安全拒絕與原因。
- HelpTip 的每個未測狀態與其他 lane 的 conditional caller 由整合對照補齊；共用一次 hover/touch 不冒充所有動態資料列。
- FPS UX 舊9／107／125行的 ghost-preservation 泛文與較新33／65及實作矛盾。Root已確認較新取消政策；[原 bytes／hash 與衝突交接](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/623d31129b970ee65e30b614ceb5b8e0303fbeab)已交唯一 memory writer 建 ConflictRecord、精準修 canonical／English。原錯 oracle FAIL 保留，沒有為舊泛文改產品。
- 本分項交接給 Claude Code 的重點：核對 family-map 的版本／caller scope、Undo 的同步清理及 late pending finalizer、Record 優先取消 placement 的 race、各安全拒絕與原生輸入限制；再與其他 lane 的 pipeline／audio／geometry 證據合併。所有 source／test／記憶與 Git 整合由 Root 統一收尾。