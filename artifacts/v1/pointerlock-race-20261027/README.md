# Pointer Lock 首次 Enter 通知競態修補

範圍僅為原生 canvas 已擁有 Pointer Lock、應用程式尚未收到 `pointerlockchange` 時，首次明示 Enter 無法恢復的錯誤。原始自然失敗保留於 `../ui-current-functional-20261027T084051223Z/`；本目錄不代表完整第一版完成。

| Before | After | Why |
| --- | --- | --- |
| Enter 直接要求 host Run，但 host 尚未確認鎖定 | 有效 Enter 在既有 IME／輸入欄／修飾鍵／repeat／原生擁有權檢查後，同步實際 canvas 擁有權 | 接受首次獨立明示 Resume；不以呼叫 request 充作成功 |
| 遲到的相同通知再次清掉 host keys／buttons 並重設 release barrier | 擁有權相同即在所有副作用前返回 | 保留已按住的移動及真實 release 責任 |

`red/results.json` 是修補前 `920aafb9…` bundle 的可控通知延遲回歸：1 案如預期 FAIL、1 案 PASS。故障注入只保留應用程式 callback 的交付；實際 Chrome 擁有權與原始 trusted 原生事件均保留，沒有替換 getter/API 或派送假事件。原始 RED report 因 reporter 相對路徑寫入 `tests/browser/test-results/`，保留原檔與此處 portable copy；只在 GREEN 前把 reporter 目的地改成絕對路徑，斷言不變。

`green/results.json`：同一測試 2／2 PASS，確認首次 Enter、跨遲到通知持續按住 W、取得 lock 不投擲、暫停期間按住左鍵的 release barrier、放開後新點擊只投擲一次、無原生擁有權或 Ctrl+Enter 不恢復，以及 Tab 退出。`original/results.json`：未修改的原始 UI 案例 1／1 PASS；其真實事件仍是 Enter 早於原生通知約 150 ms，並非只靠注入案例通過。GREEN 與原始案例均綁定相同 `5e7c61be…` source／bundle，前後來源穩定；`tested-bytes-archive.json` 索引可攜 bundle 與固定 harness bytes。

型別檢查、3 檔 ESLint／Prettier、相鄰 8 項 input policy／release ledger 測試均 exit 0。隔離唯讀 review 見 `independent-review.json`。之後經 root 明確授權，只更新 `interaction-host.ts` 的確認來源註解；`host-comment-equivalence.json` 證明精確單一註解替換且 TypeScript 去註解編譯結果完全相同。上述真 browser 證據仍指向修改註解前的固定歷史 bytes；目前版本的完整 check 與全部功能回歸由 root 後續執行。

`infrastructure-sandbox-attempt1/` 保留 sandbox 啟動逾時且未執行斷言的紀錄；`original-no-tests-found/` 保留首次 title selector 因 Playwright 前置檔名而選到 0 案的失敗。兩者不算通過。`cleanup-final.json` 確認此任務自有程序及 5174 listener 均已關閉。診斷曾有一次範圍過廣的唯讀程序工具輸出；該輸出未轉存為專案檔案，後續僅查此任務的精確 PID，不納入來源證據。

完整 UI 27 案、全量 npm check、效能、OS IME、人工聽測與完整 V1 完成狀態均不由本切片宣稱。最終詳細綁定見 `verification.json` 與 `proof-receipt.json`。
