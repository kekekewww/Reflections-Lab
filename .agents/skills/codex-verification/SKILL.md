---
name: codex-verification
description: 獨立驗證 Reflection Lab 實作結果，核對凍結 acceptance、Git diff、測試 artifacts 與 provenance，建立可重現且有限次數的修復任務。
---

# Codex 驗證

## Trigger / Inputs

Codex或選用的Muse實作者產生修改，需要判定acceptance與repair。一般輸入WikiTask／正式驗收、Git diff與artifacts；選用舊Harness時再帶TaskContract／RunState／ImplementationResult，不強制每個任務建立跨Agent流程。

## Workflow

1. 核對 task／goal／milestone／run 與工作區；確認 executor 已停止並釋放寫入權。檢查實檔、未追蹤變更與 protected acceptance hashes。
2. 以獨立程序執行原 acceptance，保留實際 command／exit／stdout／stderr／hash。模型或 executor 的 tests_reported 只作線索；不可作驗收權威。
3. 依任務選 deterministic physics／acoustic reference、schema、CI、browser、audio 或 E2E。只執行有實作與可重現環境的命令；未執行明示 NOT RUN。UI 外觀不能取代數值驗證。
4. 失敗轉成 RepairTask，附 expected／actual、重現與 evidence，維持原 allowed_files、acceptance 與 repair budget。通過才由 Orchestrator 更新既有 Wiki Task 與 checkpoint。

## Completion / Validation

輸出 VerificationResult，明列驗證範圍、缺陷及限制。參照 docs/09-agents/VALIDATION_POLICY.md 與 schemas/agents。CLI 精確命令以 `node scripts/agents/cli.mjs help` 為準。

## Failure Handling

protected test／reference 被改、證據缺失或工作區仍有人寫入時拒絕完成。Codex 同時負責 orchestration／implementation 時，不能以自我審查聲稱獨立；使用預先凍結測試與獨立程序，可用時再加隔離 reviewer，仍缺少的驗證要列限制。
