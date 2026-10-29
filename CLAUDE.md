@AGENTS.md

# Claude Code 入口

共同規範與知識只在 `AGENTS.md`、`knowledge/schema.md` 及其索引維護。需要記憶工作流程時，讀取 `.agents/skills/persistent-project-memory/SKILL.md`；`.claude/skills/persistent-project-memory/` 僅提供相容入口。

依任務讀取 `.agents/skills/` 的專案技能與其 references，不複製規範到 Claude 私有記憶。完成重要工作後執行共同 Wiki 手動流程；自動 session hooks 尚未設定或驗證。
