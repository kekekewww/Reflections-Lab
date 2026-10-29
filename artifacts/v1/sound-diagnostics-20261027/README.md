# Sound Behavior 診斷切片

日期：2026-10-27。executor：Codex；沒有 Muse／Meta／其他付費模型呼叫，沒有啟動 server、browser 或部署。這是 V1-UX-04 的聲音決策診斷切片，不代表完整第一版或 UX04 全部通過。

`review-freeze.json` 固定初次獨立審查的 12 份實作／新增測試來源；`review-freeze-r2.json` 固定兩項獨立發現修復後的最終交付版本。`preimage.json` 與 `preimage/` 保留本次修改前的 6 份既有檔案；工作區有其他代理與既有未提交變更，不能將整個 Git diff 都歸因於本切片。基線 HEAD 是 `e6b898c30193e8cd9e5ef9ddc2f1e6bcb8aee313`，沒有新增 commit 或 push。

## 範圍

- 未錄製時，將引擎實際 `BehaviorStepResult.decisions` 投影到事件表與最新規則診斷。保留 tick、sequence、binding/rule/input/instance IDs、原始 reason；只從真 AudioEvent 取實際發聲位置。
- 拒絕列的 ID 由 epoch 與語意身份產生；同一步相同語意重複項合併並保留 occurrences。continuous update 更新最新規則狀態，不逐步填滿事件表；事件歷史與最新規則快取各有 512 筆上限。
- disabled 是既有作者設定，顯示 RULE_DISABLED／BINDING_DISABLED，沒有捏造引擎拒絕事件。缺接觸的 EMITTER_UNAVAILABLE 保留原碼，沒有用 COM 補發聲位置。
- 輸入接觸資料與實際發聲位置分開呈現。冷卻／整體、物件、規則 voice limit 原碼皆有繁中／英文說明，未知 reason 原文保留。
- replay 從已錄製 decision/config/input/audio 投影，不重評規則；原始 physics/audio event、錄製 hash 和 schema 沒有改寫。新 epoch 清除最新規則狀態。

## 執行與證據

| 命令／證據 | 結果與限制 |
| --- | --- |
| `node --import tsx --test tests/app/behavior-diagnostics.test.ts`，`red.log` | RED：真 17 個 AlwaysOn 綁定超出 16 voice 上限，但舊 UI read model 沒有拒絕列。 |
| 同命令，`green-initial.log` | GREEN：最小案例 1/1。 |
| `node --import tsx --test tests/app/behavior-diagnostics.test.ts src/ui/behavior-diagnostic-text.test.ts src/ui/locale-model.test.ts`，`green-expanded.log` | 11/11；真 Rapier 再次碰撞冷卻、原始碰撞／contact、captured replay、disabled、實際 evaluator 缺接觸、語意身份／快取上限、雙語／未知原文。 |
| 上述再加 `tests/app/runtime.test.ts tests/app/defaults.test.ts`，`green-adjacent.log` | 26/26；包含其他代理修正後的 support contact adapter 回歸。 |
| owned 12 files 的 `eslint`，`lint.log` | PASS。 |
| `node node_modules/@playwright/test/cli.js test --config tests/browser/sound-diagnostics.config.ts --list`，`browser-list-only.log` | 2 個新案例可列出，沒有啟動 browser/server；真 browser **NOT RUN**。 |
| `node scripts/setup/emil-skills.mjs --check`／`--standards` | PASS；僅固定技能／設計規範靜態驗證，不是畫面或效能通過。 |
| `protected-comparison.json` | 原凍結 61 份既有驗收檔 SHA256 全部相符；沒有以本次修改放寬原測試。 |
| `review.json`／`independent-review.log` | 隔離代理 fresh 26/26 與原 12 hash 相符，但兩項額外 probe 找到停用原因不顯示、unknown prototype key 污染，因此初審 NEEDS_REPAIR。 |
| `review-repair-red.log` → `review-repair-green.log` | 新增可重現 regression，修復前 1 PASS／2 FAIL，修復後 3/3。停用原因真正可見；constructor／toString／__proto__ 都保留為未知原始字串。 |
| `review-r2.json`／`independent-review.log` | 最終隔離審查 PASS_SCOPED：fresh 27/27、修復檔 lint PASS、12 份 r2 hash 於測試及額外 probe 前後相符。額外驗證雙語 visible disabled reason 4 例、未知 prototype keys 6 例、null stop context 與不修改原輸入。 |

先前失敗有保留：`initial-invalid-fixture.log` 是誤用 AlwaysOn/contact 的非法測試設定，被正式驗證器以 CONTACT_EMITTER_REQUIRED 拒絕，之後改用合法的 17 綁定案例；沒有放寬驗證。擴充測試第一次有一個 assertion 將既有空字串 error 預期成 undefined，已改為「沒有 error」，命令輸出在本次工具對話；`intermediate-failures.json` 記錄該失敗。`typecheck-initial.log` 保留本切片 optional 欄位型別錯誤，已修正；`typecheck.log` 的後續錯誤只列當時另一代理正在實作的 static-preview.ts，不可視為完整 typecheck PASS。完整 check/build 由 root 在整合凍結後執行。

## 瀏覽器補充案例

`tests/browser/sound-diagnostics.spec.ts` 以公開 runtime API 設定真 17 綁定或 230 個真 Rapier 固定步，再操作真 UI 的 filter、event selection、接觸資訊與語言選擇，驗證 ID／tick／文件不因 locale 改變。沒有 mock decision、DOM 或聲音。root 需先建置同一份固定 bundle 再排程執行；目前只有 list/parse 證據，不能寫成真 browser PASS。

## 尚未宣稱

沒有真 hearing／PCM／效能量測，沒有靜態 3D preview，本代理不更動 acoustic/math/physics/audio core 或 frozen acceptance。完整產品、性能、外部權利與 paid live 門檻仍由原驗收個別追蹤。

最終審查後已將 runtime/UI/contracts 的寫入權交還 root 並串行轉交 static preview 整合代理。r2 hash 是這個診斷切片交付邊界的來源證據，後續整合可改寫已轉交檔案；之後的全域 check、bundle 與真 browser 證據由 root 另存，不覆蓋本次有限範圍證據。
