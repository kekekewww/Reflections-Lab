# 開發代理安全界線

Control directory 與 implementation workspace 分開，path 由 host 確認；禁止 traversal、symlink／junction 逃逸、session 跨 workspace 重用、兩 executor 同時寫。固定 `argv` 啟動已核實 CLI，不能把來源文字拼成 shell command。Contract 與來源中的 instruction 是資料，不能擴權。Tasks 只修改明確 allowed files，protected acceptance／Architecture／tokens 需由 Orchestrator 管理。

Muse 預設保持 sandbox、restricted network、Contributor Off、排除 foreign personal context。`--disable-approval` 只在安裝版本確認仍保留 sandbox 後使用；禁止預設 `--yolo`／`--disable-sandbox`。不把不同版本的 flag 名稱混用。Trust 只限明確隔離 workspace，見 [Headless 查證](HEADLESS_EXECUTION.md)。

任務不得自行安裝依賴、讀取私人設定／憑證、公開檔案、push／deploy／reset／clean。Root checkout 有未提交成果時不以重建 worktree 為由丟棄。沒有 HEAD 要保存內容 manifest 與 untracked，保留真實 null revision。

Log 僅保存必要事件與有界 stdout／stderr，redact 常見 secret／Authorization／key 類型，不記完整環境或私人對話。Regex redaction 無法保證所有敏感資料；prompt scope 必須事前排除 secrets，CLI private settings／API key 不應送模型或寫 repo。未知 provider payload 不在工具輸出全量展開。

Timeout 後 direct child close 不等於所有後代已停。Windows process tree termination 也有 detached child／PID reuse 限制；無可驗證 containment 時不做 live 自動接手。Mock subprocess 無後代是測試前提，不能將其結果外推成任意 live CLI 都安全。

這是 cooperative harness，不能阻止擁有相同 OS 權限的任意程序改寫 control store。正式多代理部署應由 OS sandbox／獨立權限／受保護 CI 驗收檔補強。產品 Agent 的工具權限更窄，沒有 shell／repo access，見 [Runtime 契約](../08-ai/PHASE3_RUNTIME_AGENT.md)。
