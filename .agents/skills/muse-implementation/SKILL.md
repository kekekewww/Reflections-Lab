---
name: muse-implementation
description: 以 Reflection Lab Task Contract 委派 Muse Code 實作或修復，處理受限工作區、實作報告與 quota 失敗；不替代獨立驗收。
---

# Muse 實作

## Trigger / Inputs

**Optional工具**：依ADR-013，只有明確選用Muse Code且具有具體價值、可用額度與授權時觸發；正常由Codex實作。最新可用性與來源以docs/09-agents/RESOURCE_STATUS.json為準；不把可用credit當作已配置的單次支出上限，也不因恢復額度自動切換executor。選用時輸入WikiTask、凍結contract、run／goal／milestone、workspace、budget與remaining work。

## Workflow

1. 依 AGENTS startup 恢復，只讀相關 ADR、relevant_files 與適用 domain／design Skill。核對已完成 checkpoint 與 diff，保留部分成果。
2. 以 `node scripts/agents/cli.mjs help` 確認目前 runner 命令；使用受控 adapter，先核對已安裝 CLI help、sandbox、model availability 與 budget。額度未知時記 null；無付費授權不產生付費 model run。
3. 使用 prompts/muse 對應模板與凍結 contract。只修改 allowed_files，不修改 protected acceptance、benchmark reference、Task scope／budget／ADR；不自動 commit／push。
4. 保留 session events、model／CLI version、modified files、局部測試與剩餘工作；輸出 ImplementationResult。Exit0 與自述成功不能完成任務。

## Completion / Validation

外部 verifier 執行原 acceptance，確認 artifacts 與 protected hashes。完整政策見 docs/09-agents/CODEX_MUSE_ORCHESTRATION.md、VALIDATION_POLICY.md 與 FAILURE_RECOVERY.md；模板見 prompts/muse/implementation.md、repair.md。

## Failure Handling

由 detector 分開識別暫時429、確定quota／credit、認證、權限、服務故障及未知錯誤。只在政策內有限 backoff；停止程序並保存 checkpoint 後才交出工作區。不得解除 sandbox、提高付費上限、換未授權帳號或與 Codex 同時寫入。
