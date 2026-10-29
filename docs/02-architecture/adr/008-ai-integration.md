# ADR-008：Meta AI Integration

- 狀態：設計採納；帳號／live API 未驗證。
- Context：AI 能編排場景與實驗，但不具權威數值來源；模型文件支援不等於帳號可用。
- Decision：server-side provider adapter；每次 tool call 通過 JSON schema、registry／units／budget domain checks，顯示 preview，由 trusted host 原子套用且可 undo。模型名稱由已核准 provider config 指定，不硬編造可用版本。
- Alternatives：client secret（不採用）；模型生成任意 code／eval（不採用）；fallback 為明示 fixture replay，不能冒充 Meta live Demo 或競賽合規證據。
- Evidence：[META_MODEL_RESEARCH.md](../../08-ai/META_MODEL_RESEARCH.md)、[AI_SCENE_CONTROL.md](../../08-ai/AI_SCENE_CONTROL.md)。
- Trade-offs：額外 host 控制與 strict schema flatten 轉換；web／provider schema 能力差異須測試。
- Risks：prompt injection、parallel mutation、stale revision、費用、幻覺數據；數值工具只回 computed artifact ID 與來源。
- Reversibility：Domain tools 與 provider 解耦；更換模型仍需相同核准與效能驗證。
