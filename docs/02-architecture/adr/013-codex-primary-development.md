# ADR-013：Codex 主導開發；Muse Code 選用

- 狀態：**Accepted，2026-10-27**，依本次[明確使用者需求](../../00-project/SOUND_BEHAVIOR_REQUEST.md)。
- Decision：Codex負責架構、實作、任務推進與品質驗證；可用Skills／Subagents與已授權Goal。通常直接從Wiki task／正式規格工作，不必先建立跨coding-agent run或啟動Muse。
- Supersedes：ADR-012 的「Muse Code preferred／必須經過Codex→Muse→Codex」及quota恢復後優先切回政策。ADR-012的獨立驗收、有限重試、workspace互斥、預算／provenance與安全界線保留為可重用原則。
- Muse Code：**Optional**。僅在任務有具體價值、使用者授權與資源條件成立時選用；現有Muse額度為使用者確認0，不能派模型。`scripts/agents`、`schemas/agents`、`prompts/muse`與Phase3歷史測試保留為選用Harness；其中MUSE預設只描述該舊工具profile，不是本專案目前開發預設。不再為完成主產品要求先驗證Live Muse或SDK。
- Product AI：Meta Muse Agent仍透過Meta Model API規劃場景、物理／Sound Behavior與實驗，模型不執行任意程式、不製造測量值。開發使用Codex不構成產品Meta整合證據，參賽規則另查[目前官方條款紀錄](../../01-compliance/HACKATHON_RULES.md)。
- Verification：優先固定tests、deterministic benchmark／reference、CI與隔離review。Codex同時寫程式與解釋結果時，不能把自述成功當獨立驗收；未跑browser／audio／Meta live要明示。
- History：Phase3 artifacts／已完成Task0008不重寫；原Live Harness Task0009退為已取消的強制工作，保留原因，非產品依賴。產品帳號／資格Task0007仍另列，不因取消Muse開發要求而消失。
- Rationale：目前產品尚未實作、競賽時間有限；消除無收益的跨Coding Agent流程，把時間用在可測的垂直產品能力。
- Trade-off：使用單一主要coding agent仍有相關性風險，靠獨立程序／reference／review控制；不假設更換模型名稱本身就增加驗證可信度。
