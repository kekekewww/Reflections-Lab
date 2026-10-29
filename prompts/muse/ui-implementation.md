# UI 實作

```json
{{TASK_CONTRACT_JSON}}
```

先讀 AGENTS.md、docs/05-ux/DESIGN_SYSTEM.md 及其索引的 canonical tokens、Component States、FPS／Build／Motion 規範，再讀 reflection-lab-design-system 與當次適用的固定版本 Emil Skill。Wiki UI 頁只作導覽，不能另造 tokens 或平行規格。

只實作 allowed_files 內的 scope；保留既有 acceptance、protected_files 與使用者工作。涵蓋規格要求的 loading／empty／error／disabled／focus 狀態、鍵盤操作與 reduced motion。輸入仲裁需區分編輯面板、FPS、Build；不能讓快捷鍵穿透有焦點的文字輸入。若產品殼尚未存在，依 task 的 fixture 範圍工作，不自行啟動完整產品開發。

回報 ImplementationResult，將 typecheck／component tests、真實 browser 視覺、輸入、音訊與效能分開列證據。碼審、token 對比度計算或 HTML 看似合理不能寫成 browser／WCAG／pointer-lock PASS。沒有執行的畫面、音訊與量測一律 NOT RUN。
