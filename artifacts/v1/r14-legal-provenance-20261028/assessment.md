# R14 第三方來源與發布鏈補查

查核日期：2026-10-28；工程證據，非法律核准。補充而不覆寫 `artifacts/v1/tooling-license-recovery-20261028/summary.json`、`.cache/v1/resume-license-closure-terra-20261028/assessment.md` 與 `exact-upstream-followup.md`。

## Rapier 0.21.0

npm 版本 metadata 的 gitHead `b716d375efc0201003f0cd9ef7168eee0b62c177` 與 [官方 js-v0.21.0 tag](https://api.github.com/repos/dimforge/rapier/git/ref/tags/js-v0.21.0) 同 commit。該 commit [固定遞迴 Git tree](https://api.github.com/repos/dimforge/rapier/git/trees/b716d375efc0201003f0cd9ef7168eee0b62c177?recursive=1) 回傳 `truncated:false`，未列任何 Cargo.lock；唯一名稱含 NOTICE 的檔案是 C testbed 的 THIRD_PARTY_NOTICES，不可視為 JS/WASM 的完整 notice。Tree 是受版本控制檔案清單，不能排除建置時產生的 lock。

[固定 workflow](https://github.com/dimforge/rapier/blob/b716d375efc0201003f0cd9ef7168eee0b62c177/.github/workflows/typescript-bindings.yml) 定義 Ubuntu compat build、上傳 pkg、發布工作下載 Ubuntu pkg 後發行；[tag workflow run 36112107426](https://github.com/dimforge/rapier/actions/runs/36112107426) 為 push、head branch js-v0.21.0、同一 SHA、結論 success，其 jobs 中 Ubuntu compat build、upload、publish release 均 success。公開 [artifact metadata](https://api.github.com/repos/dimforge/rapier/actions/runs/36112107426/artifacts) 列 `pkg compat ubuntu-latest` ID 10854062892、ZIP SHA-256 `d781fd4f56bb06d05b26af3e0dbf94e8671c226b53a548c93b7ce5f5a3e1526f`、到期 2026-12-24T08:17:20Z。下載工具回傳暫時性檔案參照，但本次沒有取得可讀本地 ZIP、未驗其 hash 或比較包內 binary；metadata digest 不是本機重算。workflow upload path 限 pkg，並未宣告上傳 workspace Cargo.lock 或 SBOM。尚不能排除 pkg 包含其他有用 metadata。

[模板](https://github.com/dimforge/rapier/blob/b716d375efc0201003f0cd9ef7168eee0b62c177/bindings/typescript/builds/prepare_builds/templates/Cargo.toml.tera) 表示 JS 0.21.0 使用本倉庫 patch 的 Rapier 0.36.0，並指定 parry 0.31、wasm-bindgen 0.2.109 等版本需求；它們是範圍而非解出確切版本。Workflow cache 可影響構建環境；沒有構建時 lock、編譯器解析結果、crate notices 及來源到所發 npm binary 的逐位元核對，完整 Rust closure、NOTICE 和 reproducibility 均 UNVERIFIED。此為可持續研究的技術缺口，不是要求使用者決定授權即可解除的人工作業。

後續可用具備 artifact ZIP 讀取能力的授權執行環境，於到期前驗官方 artifact SHA-256、列檔並比較其 3d compat 成員與 lock tarball，查 npm provenance subject 及該次 Actions logs / cache 是否含實際 lock 或解析版本。取得實際 lock 後按 wasm 目標及 features 解析完整 build graph、逐 crate 取得指定版本 license/NOTICE、查建置依賴與靜態連結範圍，再由獨立審查確認。任何重新解析的當前 Cargo graph 只能標候選，不能冒稱歷史 build graph。

## 兩個補充原文

`@humanfs/types` 0.15.0 的固定 commit package.json 明示 Apache-2.0，該 commit sibling core/LICENSE 全文已回收、SHA-256 `c71d239df91726fc519c6eb72d318ec65820627232b2f796219e87dcf35d0ab4`；原 types 包沒有該文件。可作來源清楚的標準條款補充，不得稱為 types 隨附原文。`natural-compare` 1.4.0 的固定 commit README 版權 2012–2015 與現行作者網址完整 MIT 文字 SHA-256 `353fe762ba595bf1ffe786acf0f5984bb164205901d74f258af195fc8228c67d` 可分別附錄並標示兩個來源；不能宣稱後者為當時歷史原文。固定上游及原始檔 hash 的具體鏈見先前 `exact-upstream-followup.md`；實際分發是否涵蓋及 notice 足夠性尚待逐件審查，不宣告 COM01 PASS。

## 最終 build 重綁

正式 final build 穩定後，使用已保存 generator `artifacts/v1/bundle-notice-pack-20261028-active-rule-r12/generator-source.txt` 對照現行 `.cache/v1/assemble-bundle-notice-pack.mjs` SHA-256 `3fec940706ca271a58bad8286c1642f038ca257710e32c267313fd35a0bdc483`；核對 lock 與固定 inventory hash 後，依 generator 的 usage 執行 `node .cache/v1/assemble-bundle-notice-pack.mjs artifacts/v1/bundle-notice-pack-<unique> dist [r3f-acquisition.json]`，保留新 pack manifest、dist 每檔 hash、source map 範圍與已知 gaps。再比較最後交付的實際 bytes；任何後續 build 需重綁。Generator 為既有 conservative superset，不自動補上述新來源或解除 Rust closure。

根 LICENSE、使用者資格／條款及發布決定仍由本人處理；本次無接受條款、發布或 push。

## R14 後續：官方 artifact 逐檔核對（取代上文未取得本地 ZIP 的敘述）

Root 取得官方 tag run Ubuntu compat artifact，`.cache/v1/r14-legal-20261028/artifact-byte-verification.json` 記錄 ZIP 26,998,227 bytes、SHA-256 `d781fd4f56bb06d05b26af3e0dbf94e8671c226b53a548c93b7ce5f5a3e1526f`，吻合 GitHub artifact metadata。以 Python `zipfile` 只讀 ZIP、不執行程式或完整解壓：321 個 entries 中，名稱無 Cargo.lock、SBOM 或 NOTICE。`3d/pkg/` 的 54 個檔案與 lock integrity 對應本機 npm cache tarball 54 個檔案，以及 node_modules 對應檔案逐檔 byte 相同，無缺漏與差異；結果見 [artifact-member-comparison.json](artifact-member-comparison.json)。其中 `dist/rapier_wasm3d_bg.wasm` SHA-256 `17cfa80eebd8de0291b948496dbffba724b98b489687f8272ca236a7bbf1dd4b`。這是三份完整包成員相符與發行流程證據，不是完整 Rust crate graph 或 source-to-binary 可重現證據。ZIP binary 保留在 cache，未納入正式 artifacts。

官方 Ubuntu compat job ID `107997688579` 的 GitHub log connector 連續兩次回報 `Transport closed`，沒有取得 log，故不得斷言 logs 無可用版本資料。可在具備該官方 log 存取能力的環境重試、檢查 Cargo resolution/cache 訊息是否能恢復完整版本；即便有部分 `Compiling` 行，也須判明目標、features 與完整性，不能直接等同所有實際連結 crate。Python 首次使用隔離環境 LOCALAPPDATA 查 cache 路徑失敗，改用先前核對的實際 npm cache 路徑後成功；保留此失敗記錄。
