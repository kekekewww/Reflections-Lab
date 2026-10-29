# 第一版 Web 工具鏈與驗證命令

2026-10-27 查核。實際版本由根目錄 `package.json`、`package-lock.json` 及 [V1 依賴清冊 r2](../01-compliance/V1_DEPENDENCY_LICENSE_INVENTORY-r2.json) 固定；舊 SDK／Phase 2 清冊是歷史證據，不能作為本次安裝結果。

Node **22.17.0**、npm **11.4.2**。React／React DOM **19.3.1**、R3F **9.8.2**、Three **0.186.1**、Rapier **0.21.0**、Vite **8.3.5**、React plugin **6.1.2**、TypeScript **5.9.3**、tsx **4.23.15**、Playwright Test **1.64.1**、typescript-eslint **8.72.1**。其餘直接與間接版本、npm integrity、授權檔及 NOTICE hash 見清冊，不在 Wiki 另維護副本。

[R3F 官方文件](https://r3f.docs.pmnd.rs/getting-started/introduction) 說明 R3F 9 配 React 19；[Vite 官方指南](https://vite.dev/guide/) 的 Node 下限涵蓋 22.17.0。這是文件與本機 metadata 相容性查核，不代替正式 build／瀏覽器驗收。

## 本機操作

```powershell
npm ci
npm ci --prefix experiments/physics-spike --ignore-scripts
npm run check
npm run dev
```

`npm ci` 會替換 `node_modules`；多 Agent 執行期間應先停止共用依賴的程序，再由唯一操作者執行。不能在其他測試／dev process 使用依賴時並行重裝。上述是重建流程，不代表本次已跑過乾淨安裝；實際執行結果另列於帶時間與 hash 的驗證 artifact。

`dev` 同時啟動本機 Vite 與 API server；`dev:web`、`dev:api` 可分別啟動。API 以 `node --import tsx server/cli.ts` 直接載入，減少 CLI wrapper 的額外子程序。只使用 localhost；啟動服務不會啟用 Meta 付費模型。

## 各命令的證據範圍

Dev dependency discovery 明確使用 `optimizeDeps.entries: ["index.html"]`，避免把忽略目錄內的 browser profile／extension HTML 當作應用入口。Physics dev 設定只共用主設定的私密文字檔拒絕規則，保留獨立 port／HMR／原六項 include，不繼承 API proxy；persistence 經原有 merge 繼承主設定。Physics 的 `physics-vite-cache-v2` 隔離先前失敗的 cache，未刪除舊 cache，也未證明 EPERM 根因。依據見 [Vite entries](https://vite.dev/config/dep-optimization-options#optimizedeps-entries)。

可用 `node --test --test-concurrency=1 --test-timeout=50000 tests/integration/vite-dev-policy.test.mjs` 重現真 Vite optimizer／HTTP 回歸；全部 fixture 都是假檔案，不讀取實際 key。修復前 RED、修復後 26 PASS 及當前 browser 分項結果見 [r12](../11-v1/SESSION_PROGRESS_20261028-r12.md)。下方連結 r10 的「當前」結果保留其歷史截點。

| 命令                           | 實際範圍                                                                                                                                     | 不包含                                                  |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| `npm run check`                | 保留研究／Optional Harness regression、schema、Wiki、design、lint／format；正式 TypeScript runtime tests、production build、當前依賴清冊核對 | browser、native SDK、人工聽測、Meta live、長時間效能    |
| `npm run test:runtime`         | Scene、真 Rapier WASM、interaction、Behavior、acoustic、audio 控制層、recording／persistence、AI host 與 app integration                     | Node fake context 案例不代表原生音訊渲染或聽測          |
| `npm run build`                | 完整 TypeScript 檢查及 Vite production bundle                                                                                                | 頁面操作、音訊、device latency、物理／聲學精確度        |
| `npm run test:browser:ui`      | 固定 `e2e` bundle 後執行 UI Chrome／Chromium tests；保留 build input digest、JSON 結果與失敗 trace                                           | 不能由畫面推定數值／聽測通過                            |
| `npm run test:browser:storage` | managed runner 在獨立 port 5178／無 HMR Vite 執行 persistence.spec.ts，保存原始結果與受控 process 清理紀錄                                   | 不等於整個產品 save／reload E2E                         |
| `npm run test:browser:physics` | managed evidence runner 執行 browser 真 WASM 四 modes 與產品 lifecycle tests，保存原始結果並清理其 process tree                              | 不宣稱人工輸入／聽測或未執行 profile                    |
| `npm run test:browser`         | 根 Playwright config 只發現 ui.spec.ts；其餘套件使用各自的明確命令                                                                           | 與固定 bundle 的 UI 命令不同，開發 HMR 可影響輸入所有權 |
| `npm run validate:all`         | 逐命令保存 stdout／stderr／exit／時間、source 前後 hash，涵蓋 `check` 的項目及既有 prompt benchmark                                          | 額外測試仍須獨立執行；沒有自動 live API 呼叫            |
| `npm run validate:licenses`    | lockfile、直接依賴、已安裝發行包 metadata／LICENSE／NOTICE hash 與固定清冊一致                                                               | 發行法律核准或所有 bundle 元件權利完整性                |

`npm run test:browser:storage:list` 或 `node tests/browser/run-storage.mjs --list` 只列出五項 persistence cases，不啟動 Vite 或瀏覽器。不要經 Windows npm 額外轉送 `--list`；本機 wrapper 曾吞掉該參數而啟動正式測試。

正式 storage runner 拒絕重用已佔用的 port，只停止自己建立的 Node／Playwright process tree；Windows 以確知PID／ParentPID的provider filter核對身分與受控後代，不讀全域CommandLine。即使停止命令非零，只有 root exit 與 tree 清空均有證據才接受清理；沒有 audit 證據則保留 UNVERIFIED／FAIL。Physics命令使用node tests/browser/run-physics-lifecycle.mjs --evidence。2026-10-28的當前physics2／storage5已實際通過並清理；原storage 15秒稽核逾時保留，另以一次有界同身分查詢確認清理，見[r10](../11-v1/SESSION_PROGRESS_20261028-r10.md)。舊啟動／清理失敗不覆寫。

`npm run test:browser:product` 另建固定 bundle，執行三次乾淨 context 的產品全鏈與獨立儲存區 WAV relink，保留 source／bundle／harness hash；實際是否 PASS 以結果為準。此命令不呼叫模型，也不包含人工聽測或 10 分鐘 profile。

`validate:all` 保留舊工具所要求的 `benchmarks/results/phase3-*.json` 唯一輸出前綴，以免破壞既有防覆寫 regression；報告 `scope` 明確記錄 V1。若前後 source hash 不同，即使子命令全成功，最終仍為 FAIL。這是前後比對，沒有連續檔案監控，無法偵測期間修改又還原；仍須先停止 source writers。歷史報告不可覆寫。

```powershell
node scripts/validation/run-all.mjs --output benchmarks/results/phase3-v1-20261027-unique.json
```

UI 本機 config 預設使用已安裝 Chrome；CI 使用 Playwright 對應 Chromium。安裝瀏覽器的官方方法見 [Playwright 安裝](https://playwright.dev/docs/intro) 與 [CI 指南](https://playwright.dev/docs/ci-intro)。CI workflow 另有 browser job，先安裝固定 Playwright 版本對應的 Chromium，再執行三項獨立 browser 命令。修改 workflow 不等於遠端 CI 已執行；目前遠端結果為 **NOT RUN**。

## 授權及限制

請同時讀 [V1 第三方聲明索引](../01-compliance/V1_THIRD_PARTY_NOTICES.md) 與 [授權登錄表](../01-compliance/LICENSE_REGISTER.md)。直接／間接依賴的 `dev` 標記是 npm 分類，Three、Rapier、AJV 等仍由正式產品程式匯入；不得據此省略產品發行時適用的 notices。瀏覽器自有 HRTF、Steam Audio binary、使用者音檔與 Meta 服務條款各有獨立來源；本清冊不包含它們。


## 2026-10-28 本機版本與獨立命令

本機實際Node為C:/Program Files/nodejs/node.exe（22.17.0）；npm11.4.2 CLI為C:/Users/kevin/AppData/Roaming/npm/node_modules/npm/bin/npm-cli.js。Node隨附的另一個npm版本不作為已驗11.4.2。必要時僅在目前PowerShell程序暫時加入Roaming/npm及Node路徑，保留原PATH並於finally還原；不修改全域PATH。

    $reflectionOriginalPath = $env:PATH
    try {
      $env:PATH = 'C:\Users\kevin\AppData\Roaming\npm;C:\Program Files\nodejs;' + $reflectionOriginalPath
      & 'C:\Program Files\nodejs\node.exe' 'C:\Users\kevin\AppData\Roaming\npm\node_modules\npm\bin\npm-cli.js' --version
      & 'C:\Program Files\nodejs\node.exe' 'C:\Users\kevin\AppData\Roaming\npm\node_modules\npm\bin\npm-cli.js' run check
    } finally {
      $env:PATH = $reflectionOriginalPath
    }

下列原生音訊命令以此機已快取的Windows x64 browser及Root核准的固定source profile執行，預設baseline legacy屬歷史；目前音訊來源使用prefix-f3e5。首次命令自行建立有界static fixture並跑原25項；prepare模式只建置fixture，不執行browser。

    node tests/audio-runtime/run-prepared-native-v2.mjs --prepare --baseline prefix-f3e5
    node tests/audio-runtime/run-prepared-native-v2.mjs --run --baseline prefix-f3e5
    node tests/audio-runtime/run-prepared-ir-v1.mjs --prepare --baseline prefix-f3e5 --ir-profile v2

IRv2實跑還必須給同來源fresh25 wrapper-verification-v2.json的實際路徑及SHA256：選項為--run --baseline prefix-f3e5 --ir-profile v2 --qualified-v2及--qualified-v2-sha256；不將placeholder或prepare成功當作IR執行證據。[本輪原始結果與命令範圍](../11-v1/SESSION_PROGRESS_20261028-r10.md)另列，所有新run使用不同輸出目錄。

性能命令node tests/browser/performance-profile.mjs --phase all --seconds 600執行全部負載；本輪已有FAIL／UNVERIFIED／NOT RUN，來源穩定或程序exit0不等於性能通過。此parser沒有help模式，不用--help當作無副作用查詢。
