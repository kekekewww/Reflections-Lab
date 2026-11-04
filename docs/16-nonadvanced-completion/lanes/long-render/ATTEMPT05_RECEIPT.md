# 長輸出 attempt05：原 whole63 master gate 通過（2026-11-03）

執行者 Claude Code（claude-opus-5-5）。來源 `89f65e4d`（offline-render 分支，含 `ca8fb1b7` 決定性 2 輸入混音加總與 parser 修補），本機 Chrome 156.0.8078.75（exe SHA `7c2fe774…cf50fa`），Node 22.17.0。命令 `node tests/browser/nonadvanced/long-render/run.mjs`，所有 deadline 與 2e-6 容差不變。原始結果 [native-2026-11-03T064120504Z.json](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/41f271177d0487c0691756b731752e5553b23b09)（SHA `bb1d4867…cc7ab0`）、[stdout](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/53f6296f0406381c99fef70fc2f79648d06b6e24)、[exit](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/fa872bb7f38cc189c3099ab3997b612e89b65d12)。

**結果 PASS**：58/58 component checks、16 個下載、獨立 Node parser 全部通過，owned browser／Vite 清理完成，追蹤來源前後不變。

| 階段 | 實測 | 原 deadline |
| --- | ---: | ---: |
| renderer crash 檢查 | 8.4 s | 45 s |
| store | 0.16 s | 45 s |
| DSP（全部原生 graph） | 155.0 s | 300 s |
| 16 個下載 | 62.8 s | 90 s |
| 獨立 parser | 2.3 s | 45 s |

| 比較（原 2e-6） | 最大誤差 | 超出數 |
| --- | ---: | ---: |
| 產品 master vs 獨立 whole63 reference | 0 | 0 |
| 產品 mix vs whole63 reference | 0 | 0 |
| 產品 dry vs whole63 reference | 0 | 0 |
| 產品 master vs 62 秒 reference | 0 | 0 |
| frozen input A62 vs B62 vs C63 | 0 | 0 |
| 兩個 owner stems 相加 vs mix | 8.94e-8 | 0 |

## 產品輸出（本機，未入 Git）

`offline-render/.cache/nonadvanced-long-render/2026-11-03T064120504Z/`：五個 float32 雙聲道 48 kHz WAV，各 2,976,000 frames（60 秒訊號＋2 秒尾）、23,808,056 B，合計 119,040,280 B，加 manifest（SHA `a9b3ab49…182fd4`）。

| 檔案 | SHA-256 前 16 碼 | 峰值 |
| --- | --- | ---: |
| master.wav | 319376174b393bce | 0.9645（0 個超出 ±1） |
| mix.wav | b291f2871d433267 | 0.5182 |
| dry.wav | 993c4d4ab96392e5 | 1.4024（pre-master 原始內容可 >1，manifest 照實記錄） |
| stem-46219de459d8-ball.wav | ba045040f17838d6 | 0.4142 |
| stem-be569a2d963a-speaker.wav | bec7f31d0d6d882f | 0.2741 |

五個 WAV 的 SHA 與 attempt03 完全相同，兩次全新執行輸出逐 byte 一致。

## 解讀與限制

失敗原因已由 [fan-in 實測](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/d1ee05606871ab839e006dd0aa83120e00bf37ac)確認並修正：Chrome 對超過兩個輸入的加總點會在每個新 graph 用不同順序加總，修正後每個加總點最多兩個輸入。attempt03（parser 比對鍵順序）與 attempt04（parser Worker 缺 helper）的 FAIL 都是 harness 本身的問題，原始紀錄保留；[attempt03 獨立全檔分析](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/6ca21cc8894647d0d4278197e31dcb4e5dd00bc7)也得到同樣的 0 誤差。

這是 Vite fixture 驅動的原生 OfflineAudioContext 方法，使用固定錄製輸入（3601 tick、2 個 owner）；不是產品 UI 的 60 秒錄製→render→下載（那是 S4 pipeline lane），也不是硬體聽測、SPL、Computer Use 或 600 秒效能。
