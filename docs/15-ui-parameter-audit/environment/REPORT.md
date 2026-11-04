# Project 環境設定持久化修復

任務：RLAB-TASK-0031，承接 Task0028 的全產品參數操作審核。實作分支 codex/pipeline-environment；產品來源固定在 59360da1b3e513fa7b80ca881d5214cf694867e4。本頁不是完整 V1、全參數審核、原生桌面操作或效能結案。

## 原始問題與根因

真 production UI 在 vacuum／35.5 °C 儲存專案後，下載的 Project 沒有 atmosphere 欄位。重載頁面並載入已儲存專案，設定回到 air／20 °C。原始 FAIL、專案 JSON 與截圖逐 bytes 保存於 original-ui-failure/；原觀察來源是 19db9f9／index-BDGeI4Sd。

根因是 runtime 的 atmosphere 只存在執行中記憶體，ProjectDocument、封閉 validator 與 currentProject() 未攜帶它。

## 實際修復

- Project v1 新增可選 atmosphere，使用既有 Atmosphere 資料契約。medium 必須是 air 或 vacuum；溫度 −80～100 °C；明示聲速 100～1000 m/s；七個產品頻帶的吸收量各為 0～10 dB/m；dataClass 僅接受既有四種分類。欄位缺席與合法的可選欄位不由純 validator 填預設。
- Save／Export 明確複製目前環境，避免 project 內的舊值蓋回 runtime。Import／Load 先驗證整份 Project、資產與候選物理世界，再於既有成功提交點一次套用環境；非法環境與缺少必要音檔不先修改舊設定。
- 舊檔沒有 atmosphere 時，runtime 恢復原 air／343 m/s／20 °C／零合成頻帶損耗／Synthetic。保留 343 的原值，不在載入時偷偷重算而改變既有數位結果。純舊檔驗證與序列化仍沒有新增欄位，保持原 bytes。
- 合法的部分 atmosphere 未提供溫度時，runtime 補 20，使既有溫度控制可達；不補明示聲速，因此仍沿用 solver 原有的溫度推導語義。
- setAtmosphere 在 drain 前先驗證候選值，非法輸入不污染環境、不暫停／中斷有效錄製；drain 後檢查 dispose，避免清理期間提交設定。
- 環境依 PARAMETER_REFERENCE 第 3 節仍不進一般 Scene Undo；復原物件編輯不回滾後來環境。新錄製 configuration 與實際聲學延遲均使用載入後的同一環境。

這不是 ISO 大氣吸收模型、新公式或量測證據。保留原 solver／recording 的模型與宣告範圍，沒有把 runtime engine object 序列化到 Scene。

## 驗證

完整機讀命令、退出碼、來源與原始輸出 hashes 見 VERIFICATION.json。

- 新增專項：11／11 PASS，0 skip。
- 相關 Project／persistence／app-control／錄放環境／實驗流程回歸：51／51 PASS，0 skip；包含上述 11 項，不能加總成 62 個不同測試。
- TypeScript、指定 ESLint、Prettier、正式 build 與 diff check 全部 exit 0。
- 獨立唯讀審查未發現阻斷問題；審查者讀取 source 與原始測試輸出，未獨立重跑。
- Node dispose 案例使用 drain 故障注入以測交易生命期；不是純 UI 測試。其他保存／匯入／錄製結果均從公開 runtime 與正式 Project API 驗證。
- Browser 修正版重驗：NOT RUN，待 root 合併、新 build 與獨佔 browser lease。舊 FAIL 不改標成功；本分支沒有操作原生 Brave、付費 API、裝置或真人聽測，也未跑 600 秒效能。

## 失敗與修復歷程

red.txt 保存初始 8 案 2 PASS／6 FAIL，涵蓋欄位被拒、保存缺失、舊設定與非法命令問題。該初版測試有一個尚未到達的 paused 投影欄位假設，後續依正式 simulationState 改正。

green-asset-unreferenced-harness-failure.txt 與 green-asset-profile-harness-failure.txt 為新增負例的測試前置錯誤：未使用的缺素材原本可合法保留 metadata，之後一輪又誤用 profile ID。兩者不是新產品缺陷。修正為真 OnImpact sample 引用缺少的素材後，preflight rollback 測試通過；未因此變更產品驗證或放寬條件。

## Root／Claude 重驗入口

1. 合併本分支全部提交，保留其他 runtime 錄放與 Zone 功能修補；本分支只新增環境欄位與相應接線。
2. 在新正式 bundle，以 UI 設定 air／35.5 °C，再切 vacuum，Save、Export、重載頁面、Load；確認仍是 vacuum／35.5 °C，新瀏覽器 context 匯入同一 JSON 也相同。
3. 匯入缺 atmosphere 的舊專案，確認 air／20 °C／343 m/s；匯入非法環境或缺必要音檔，舊場景、環境與素材仍保留。
4. 以載入後環境錄製，核對 configuration.atmosphere 與傳播延遲；回放仍使用原錄製環境而不污染目前作者設定。
5. 新 source／bundle 與本頁固定截點不同時，分列新結果；不要把這裡的 Node／build PASS 當作新 bundle 的 browser PASS。
