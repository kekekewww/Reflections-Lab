# 尾響草稿無效時阻止產生音檔

範圍：Task0028 的 Render 尾響草稿流程。新工作樹位於專案內 `D:/Developing/Meta Hack/.worktrees/render-tail-validation`，基準為 `b6fec5b012f6491feeded81d63d43ca04d185a52`（產品與 `9fcf3f0` 相同）。整合工作樹、正在執行的瀏覽器與共用 Git index 未修改。

## 問題與結果

原先非法值 10.5 已被 NumberField 正確拒絕；最後已提交的 0 沒有被覆寫，manifest 使用 0 的資料完整性正確。不過畫面仍顯示紅色 10.5，使用者仍能產生採用舊 0 的音檔，造成 P2 操作意圖歧義。原 Render 測試與其 PASS 不改寫，本修補額外處理操作回饋。

| Before | After | Why |
| --- | --- | --- |
| 無效尾響草稿仍可按「產生音檔」，作業採用舊已提交值。 | 無效草稿即時停用產生按鈕；handler 同樣檢查同步 ref；顯示修正或 Esc 還原提示。 | 避免畫面參數與本次輸出意圖不同。 |
| 共用欄位只向外提交有效數字。 | 新增選用的 raw 草稿有效性通知，只有 Render 消費。 | 保留其他欄位的 Enter、blur、locale、IME 與 Esc 政策。 |

## 實作邊界

- 有效性沿用有限值、min/max 與 truthy `invalidReason`；不看會被輸入清除的 `invalid` 旗標。
- 不用 HTML `stepMismatch`；0.25 秒仍合法，0.5 只是增減步距。
- input、提交及 Esc 同步通知；props 更新依 `dirty ? draft : String(value)` 判定，避免使用舊字串。
- Render 使用穩定 callback、state 與 ref；不改已提交值、不夾值、不重設欄位。錄製三秒仍可獨立操作。
- 沒有新增設計 token、套件、序列化欄位或全站提交政策。

## 已執行的有限驗證

| 命令／範圍 | 結果 | 原始收據 |
| --- | --- | --- |
| NumberField policy＋pipeline SSR | 14/14 PASS、0 skip；含新增 2 個 raw 有效性案例及原提交／locale／IME 案例 | [focused](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/60083e85c21fa88349f5a63387fe39c2783734ea) |
| TypeScript `tsc --noEmit` | exit 0 | [typecheck](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/e69de29bb2d1d6434b8b29ae775ad8c2e48c5391) |
| 四檔 ESLint／Prettier | exit 0 | [lint](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/e69de29bb2d1d6434b8b29ae775ad8c2e48c5391)、[format](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/8bd88548b1f53ae8837325bfd8b859dbe57b4a24) |

固定來源／preimage hashes 與命令在 [verification](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/3525028d6abccbb14170d66539b5986d7ad33281)。獨立 review 為靜態來源審查，不冒充瀏覽器測試。

## 整合後必驗

主代理需在新 bundle 實際操作 10.5／空值／非有限值、持續修改仍非法的草稿、Esc 還原、合法 0／0.25／10、locale 切換及忙碌狀態；確認非法草稿不發布新 job、恢復後 manifest 使用真正提交值。此分支未開 Chrome，以上真 DOM 驗證為 NOT RUN；也不代表聲學、聽測或性能驗收。
