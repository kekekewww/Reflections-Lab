# 公開發佈獨立審查

查核日期：2026-10-29（台灣）。執行者：Codex publication_audit 子代理；第三方權利另由 rights_inventory 子代理唯讀複核。這是公開推送範圍的審查，不是完整第一版、法律資格、真人聽測或性能通過證明。

## 範圍與結論

基準為 `codex/sound-behavior-research` 的 `c210ca882ca8503b322c28884bf1e9f6e9fe126d` 與所有祖先。原始工作區只讀；沒有修改原歷史、刪除證據、選定根 LICENSE、commit、push、部署或修改遠端設定。

**此基準完整歷史的公開 push：BLOCKED。** 原因是已入庫的超大檔與使用者明確排除的 build/cache/封存產物。只在新 commit 刪檔或合併新分支，都仍會把祖先中的 Git objects 推送出去。LFS 也不能解除使用者本次「不公開這些產物」的範圍限制。

秘密規則與壓縮容器掃描結果見下節；不能把初步路徑清單或 metadata inventory 稱為完整安全證明。

| 實際量測 | 結果 |
| --- | ---: |
| 可達 commits | 13 |
| 可達 Git objects | 8,774 |
| 唯一 blob | 6,758 |
| 唯一 blob 未壓縮 bytes | 2,579,720,986 |
| HEAD tracked paths | 10,926 |
| HEAD `artifacts/` paths | 8,755 |
| HEAD `artifacts/` path bytes 加總 | 3,146,695,174 |

唯一 blob 計數會合併相同內容；path bytes 則重複計入同內容的多個路徑，因此二者不矛盾。

## 秘密掃描

狀態：**完整規則掃描完成，未確認到真實憑證；公開 push 仍因產物／大檔 BLOCKED。** 兩次完整掃描均取得相同收據：6,758 個唯一 Git blobs、包含 ZIP/GZIP 展開共 8,571,358,844 input bytes、2,891 個 archive members、2,329 個含 binary bytes 的 payload 未做文字語義分析，errors 為空。先前一次 Python 試跑未完成且已中止，不列為驗收證據。

**收據保存限制與補件：** 當時完整 scanner JSON 經 PowerShell 摘要後只回傳工具，未保存原始 stdout JSON；因此這兩次執行的「獨立原始 raw 檔核對」維持 PARTIAL。已將實際完成工具結果轉記為 [run 1 收據](../../artifacts/architecture-review-20261029/publication-audit/full-scan-run-1-tool-receipt.json)／[run 2 收據](../../artifacts/architecture-review-20261029/publication-audit/full-scan-run-2-tool-receipt.json)，不是冒稱原始 raw。後續只對既有候選位置做定點重核，讀取 102 blobs／464,583,578 bytes，完整重現 99 候選及 58／20／21 分類，保存 [候選分類 JSON](../../artifacts/architecture-review-20261029/publication-audit/candidate-classification.json)。[第三方 review metadata](../../artifacts/architecture-review-20261029/publication-audit/rights-review.json) 亦明示為已完成唯讀審查的事後重記。[收據摘要與 hash](../../artifacts/architecture-review-20261029/publication-audit/summary.json)集中記錄命令、基準、方法與缺口；所有 JSON 都不含候選值。

使用者後續已授權「保留全部原本機歷史，另建乾淨公開 snapshot」。原 full-history push 的 BLOCKED 結論不變；新 snapshot 尚未由本報告證明安全或測試通過，亦未 push。建議以真正公開 ref 的無原祖先檢查、精確 allowlist、fresh-clone 驗證與落盤的完整 redacted scan JSON 作為公開 gate；原 8.57GB 完整歷史 raw 重跑可另作歷史證據補強，不是省略新 snapshot 安全檢查的理由。

| 候選規則 | 命中數 | 人工判讀 |
| --- | ---: | --- |
| `meta-token` | 58 | 全部為同一 SHA-256 `09987ad5eaeb25c3dc9993cd8b7e2fc99c7c4dd5fa6c77b82b61e8c167957b63`；位於 bundle／map／ZIP 內的 WASM base64。另以 tracked 檔案路徑逐一查核 108 個出現位置，皆在 WASM 字串內；與唯一 Git blob 命中數的差異來自重複 path。不是 Meta key。 |
| `url-password` | 20 | 19 處為同一個 loopback `...:port/@...` 開發網址被廣泛規則誤判；候選 hash `2897097508da069e44c6f1aea1b4b5b7f71bf01fc4fd4e51825ce7255762f629`。另 1 處在 `experiments/dataset-fetch-spike/dataset-fetch.test.mjs`，是拒絕 URL userinfo 的負面 fixture，hash `ec25b8fa54a9d7a878a86e6f38233af24d5d27d184b396136d6d7f0251d33c19`。 |
| `literal-secret-assignment` | 21 | 20 處為 `tests/agents`、`tests/ai-runtime`、`tests/integration` 的遮蔽／拒絕／schema 負面 fixtures 或測試程式字串；剩餘 `server/meta-live-payload-preview.ts:47` 是含 preview/review/non-secret 標記的合成 preview 設定，hash `b025c80322000d1899f9cee4c33fd737108e050a8045b078c3e13ecb9d447a21`，不是載入的使用者 key。 |
| 私鑰／AWS／GitHub／OpenAI／Slack／Google／Stripe／JWT／literal Bearer | 0 | 沒有規則命中；不代表能證明所有形式的秘密皆不存在。 |

新增的唯讀工具為 [`scripts/validation/publication-audit.mjs`](../../scripts/validation/publication-audit.mjs)。從 repository 根目錄執行：

```powershell
node scripts/validation/publication-audit.mjs --ref c210ca882ca8503b322c28884bf1e9f6e9fe126d
```

它檢查指定 ref 的全部唯一 blobs，並展開 ZIP/GZIP 的文字內容。結果只記錄 path、rule、blob SHA、位移、候選長度與候選 SHA-256，不記錄秘密值。規則涵蓋私鑰標記、常見 provider token、JWT、帶密碼 URL、literal secret assignment 及 Bearer 候選；placeholder/code-expression 只是人工判讀提示，不會自動證明候選安全。

最終研究 commit 形成後，可加 `--since c210ca882ca8503b322c28884bf1e9f6e9fe126d --ref <final-commit>` 只檢查基準以後的新 blobs；這是補充掃描，不能代替本次全部祖先掃描。`--ref HEAD --since HEAD --metadata-only` 已實跑並正確回報零 commits／objects／blobs。

`--metadata-only` 已實際執行成功並重現上表與下列大檔。`--self-test` 的 split-token 與 GZIP synthetic token 案例、單檔 ESLint／Prettier check 皆 PASS。工具不掃其他 refs、reflogs、untracked/ignored 本機秘密；不解碼任意 base64，不對媒體或加密資料做語義分析。即使規則零命中，仍不能推論不存在任何秘密。工具的結束碼僅表示掃描程序是否有錯，不會自動裁定所有命中或授權。

## 確認的阻擋項目

### GitHub 單檔大小

基準可達歷史有三個超過 100 MiB 的 blobs：[GitHub 官方限制](https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-large-files-on-github)明示一般 Git repository 阻擋超過 100 MiB 的檔案。

| 路徑 | Bytes | Git blob SHA |
| --- | ---: | --- |
| `artifacts/v1/active-rule-projection-candidate-r2-20261028/candidate/app-workload-runs/20261027214417921/large-baseline.json` | 125,089,335 | `a88f002b54f1014fef9069b4570cf6a9a0558a5d` |
| `artifacts/v1/active-rule-projection-candidate-r2-20261028/candidate/app-workload-runs/20261027214417921/large-candidate.json` | 125,089,336 | `7050cdf408483f84aaf143e210915b95e129f674` |
| `artifacts/v1/browser-performance-20261027T183039817Z/ui.trace.json.gz` | 108,682,397 | `042a2fa858bc2330f46356c9c447e315698a8c75` |

另有 31 個 blobs 超過 10 MiB；以可重跑工具的完整清單為準。未壓縮總 bytes 不能直接當成 Git 網路傳輸量，故不依此聲稱已超過單次 push 傳輸上限。

### 使用者排除的建置與封存內容

HEAD 的 `artifacts/` 含 677 個 JS/MJS/CSS/map 路徑，其中 233 個 source maps。實際內容包括 `compiled/assets/`、多種 `bundles/`、`web/assets/`、payload/cache 與測試 trace 封存，而不只是手寫原始碼或小型收據。

例如 `artifacts/v1/r17-final-delivery-20261029/web/assets/index-DELE_Xh5.js` 含內嵌 WASM；同交付的 `local-delivery.zip` 為 6,544,048 bytes、279 entries，SHA-256 `145bd22041f5255343e8c8fcfa0433c38b14cc10de566a61250326192085eb59`，最近由 `cde1e2b0ed7c57228bfa64b01c262b6eeab3cba1` 引入。沒有 `.wasm` 路徑不代表沒有散布 WASM。

108 個 ZIP 已全部開啟列名成功；沒有直接命名的研究 PDF、音效、HRTF、SDK binary entry，但 Playwright trace 包含 opaque resources 與來源／bundle，副檔名清單不能取代內容查核。原證據需保存在本機；本審查未刪除它們。

## 第三方來源與誤判區分

| 類別 | 實際查核 | 判讀 |
| --- | --- | --- |
| 憑證檔名 | 全部祖先 path union 只見 `.env.example`；沒有直接追蹤的 `.env`、私鑰或使用者 key 檔名 | 路徑層未發現；不代替秘密內容掃描 |
| node_modules | 全部祖先未見 `node_modules/` tracked paths | 非本輪 blocker；bundle 內第三方程式另算 |
| 研究 PDF、付費音效、HRTF | 全部祖先未見 `.pdf/.wav/.mp3/.ogg/.flac/.sofa` 路徑 | 目前是來源／授權／待取得 metadata；不應誤稱已散布資料集 |
| Steam Audio | `third_party/steam-audio/` 只追蹤 README／manifest，SDK cache 未追蹤 | SDK 下載來源索引不是 SDK binary 發佈 |
| Emil Skills | 16 個固定來源檔全部符合 manifest SHA-256；完整 MIT 與 copyright 保留 | 可辨識的合法第三方複本，授權文字應保留 |
| UNKNOWN remote sources | 10 筆 records 皆 `remote_only:true`、`path:null` | 未隨 repository 散布完整官方文件或 Gist，不能只因 UNKNOWN 就稱已侵權 |
| R3F lineage／Rapier binary closure／tooling 原文缺口 | 現有文件保留 bundle/binary 再散布的未確認條件 | 當真有編譯交付物時仍相關；排除編譯產物後，不直接等同原創 source 公開 blocker |
| 根 LICENSE | 使用者尚未選定專案授權；本輪未添加或代選 | 是使用者 IP 決策，不等同已發現第三方侵權 |

參照：[`LICENSE_REGISTER.md`](../01-compliance/LICENSE_REGISTER.md)、[`V1_THIRD_PARTY_NOTICES.md`](../01-compliance/V1_THIRD_PARTY_NOTICES.md)、[`PROJECT_PROVENANCE.md`](../00-project/PROJECT_PROVENANCE.md)、[`DATASET_CATALOG.md`](../../research/datasets/DATASET_CATALOG.md)、[`SDK_LICENSE.md`](../03-sdk/SDK_LICENSE.md)、[`third_party/emil-skills.manifest.json`](../../third_party/emil-skills.manifest.json)。本輪沒有新增下載素材、接受條款或付費呼叫；沒有重新驗證本人帳號／法律資格。

## 可執行的發佈選項

1. **保留本機合併結果，暫緩公開 push。** 原始歷史與所有測試證據完整保留；這符合本輪不改寫歷史的要求，也是目前無額外決策即可完成的安全交付。
2. **獨立公開匯出已獲使用者授權，待安全／測試與實際 push。** 在另一個乾淨 repository／公開分支建立不帶原祖先的來源 snapshot，以具名 allowlist 排除 build/cache/大型產物／容器，保留來源與必要授權；檢查文件中指向未公開證據的連結及 fresh-clone 可重現性，再重新掃描最終待 push ref。這不改寫或刪除本機原歷史；使用者已授權此公開 ancestry 與原本機研究歷史分開。

不要嘗試以最新刪檔 commit、LFS、`--force` 或 push 全部 refs 來繞過目前的阻擋。新 research worktree 的新增 diff 及最終實際公開 ref 仍需在形成後補做掃描；本基準審查不能預先覆蓋未產生的 commit。

## 乾淨公開 snapshot manifest 草案（尚未執行）

這是**另一個發佈範圍，並非原 full-history merge push 方案**。所有原 branches／commits／研究與測試證據仍保留本機。使用者已明確授權乾淨公開 snapshot 與其不同 ancestry；此審查代理只建立 metadata 草案，沒有建立分支／匯出 repository／push。精確匯出 manifest、實際安全 gate 與 fresh-clone 測試仍待完成。

| 範圍 | 草案處理原則 |
| --- | --- |
| `src/` 136、`server/` 13 paths | 保留原始程式；server key 仍由環境／明確 key 檔載入，無真 key 匯出。 |
| `tests/` 415、`schemas/` 31 paths | 保留測試原始碼、合成 fixtures、schema 與數值 reference；排除測試執行產生的截圖／trace／bundle／錄影。不能只為變成綠燈而刪除或放寬原驗收。 |
| `docs/` 543、`knowledge/` 748 paths | 保留繁中 canonical／英文 mirror、ADR、來源 manifest、task／事件／Wiki 與歷史失敗／限制。公開版對未匯出證據標明「本機保存、未公開」，不把路徑存在寫成公開可重現證據。 |
| `.agents/` 30、`.claude/` 1 paths | 保留專案技能與已核對第三方技能；保留 Emil 原 MIT／copyright 與 manifest。 |
| `scripts/`、`examples/`、`prompts/`、`experiments/`、`benchmarks/`、`research/`、`public/` | 保留原始碼、合法摘要、版本與取得 metadata、合成 fixtures；排除任何運行時下載／編譯／cache，逐路徑做最終 manifest。 |
| `third_party/` 5 paths | 保留 Emil LICENSE／README／manifest、Steam Audio README／manifest；不匯出 SDK cache、binary 或未授權原文。 |
| 根目錄設定 | 保留 README 雙語、AGENTS／CLAUDE、精確 package／lockfile、建置／lint／CI 設定及空值 `.env.example`；不添加未獲使用者選定的根 LICENSE。 |
| `artifacts/` 8,755 paths | 預設全部不匯出，再僅依下表具名允許四個小型 JSON 收據。這個預設排除集合含 677 個 JS/MJS/CSS/map（233 maps）、108 ZIP、21 GZIP、所有 3 個 >100 MiB blobs；不是宣稱每個 artifact 都是禁用品。 |
| 其他輸出 | 排除 `node_modules/**`、`**/cache/**`、`**/.cache/**`、`dist/**`、build outputs、test-results／playwright-report、研究 PDF／音效／HRTF／SDK binary、完整聊天與真實 credential files；目前直接 tracked 前述受限 binary 路徑為零。 |

小型原始收據候選如下；四者總計 579,551 bytes，均已在本輪完整內容規則掃描範圍。保留原 bytes 與 SHA，不把它們改成假的公開驗證通過收據。

| 具名允許路徑 | Bytes | SHA-256 |
| --- | ---: | --- |
| `artifacts/v1/r17-final-delivery-20261029/root-verification.json` | 666 | `36fde1457338d539551b7731b3b719cd9a0b0c14a43f62af86e0e25184ba00ca` |
| `artifacts/v1/r17-full-check-2026-10-28T184930416Z-6c1c4c0d/verification.json` | 457,394 | `d2fbe54d68fc98f0a18d903cfdd8ce2b6440b610cd4533b844c5d42cac518c64` |
| `artifacts/v1/r17-browser-verification-20261029/verification.json` | 116,722 | `66b5a19408788615f43bc6024ad8c478951e5e20abdf48fd5d244167e06f0312` |
| `artifacts/v1/device-hearing-v3-frozen-20261029-r6/independent-review.json` | 4,769 | `ed798d5451eedb92626f7b1f532584025cd66c1feac0087164266e6e990917ce` |

本草案的既有數量來自 c210 基準，後續 research 修改會增加檔案。最終仍要產生精確 path／bytes／hash allowlist，審查每個允許例外並掃描真正待 push 的 ref。若只允許四個收據，基準 `artifacts/` 將排除 8,751 paths、3,146,115,623 path bytes；未刪除任何本機資料。

**已知影響：** docs／Wiki／task 的 artifact 相對連結、source hashes 與歷史 Git SHA 仍指向本機原證據；它們不是可供公開 clone 完整下載的證據。需新增公開發佈說明或來源可用性索引，不能批次把缺失證據改成 PASS。原 `npm run check`／Wiki lint／source-manifest validation 可能依賴被排除收據或 artifacts，必須在隔離 fresh clone 實跑；若需要公開套件的驗證設定，應另建明確 scope 的命令並保留原完整研究驗證，不放寬既有 acceptance。根 LICENSE 選擇與任何受限素材新納入仍須使用者決定；snapshot ancestry 已獲授權，精確 manifest／驗證調適仍待實作。
