# Emil Kowalski Skills：選用、安裝與來源

查核／取得：2026-10-26（Asia/Taipei）。已完整閱讀固定版官方 README、LICENSE、八個 SKILL 及其必要 reference；不是依賴 repository 名稱的摘要。官方來源：[repository](https://github.com/emilkowalski/skills)、[固定版 README](https://github.com/emilkowalski/skills/blob/2d228630ba1446365f614a108cb8252f1feda202/README.md)、[MIT LICENSE](https://github.com/emilkowalski/skills/blob/2d228630ba1446365f614a108cb8252f1feda202/LICENSE)。

來源固定於 commit `2d228630ba1446365f614a108cb8252f1feda202`，commit 時間 `2026-10-11T13:58:32Z`，簽章 API 顯示 unsigned。逐檔 Git blob SHA-1、SHA-256、byte length 與本地位置記於 [manifest](../../third_party/emil-skills.manifest.json)。原始檔案保持 byte-for-byte；保留 [MIT notice](../../third_party/emil-skills.LICENSE)，授權不代替本專案根 LICENSE 的決定。

## 已安裝的必要範圍

唯一上游 skill 正文在 `.agents/skills/<name>/`，沒有 vendor 第二份、Windows symlink、全域設定或私人 Agent 設定。README／LICENSE 僅在 `third_party/` 保存一份作來源與 MIT notice；未下載其他技能、字型、圖像或執行上游程式。

| Skill | 本專案使用時機 | 一併保留的 reference |
| --- | --- | --- |
| [emil-design-eng](../../.agents/skills/emil-design-eng/SKILL.md) | 元件、層級與設計工程綜合 review | 無 |
| [animate](../../.agents/skills/animate/SKILL.md) | 確認有目的後的 UI 動畫 | RECIPES.md |
| [review-animations](../../.agents/skills/review-animations/SKILL.md) | 已有動畫 diff 的檢查 | STANDARDS.md |
| [improve-animations](../../.agents/skills/improve-animations/SKILL.md) | 已有 UI 的整體 motion audit／plan | AUDIT.md、PLAN-TEMPLATE.md |
| [animation-performance](../../.agents/skills/animation-performance/SKILL.md) | frame trace、layout／paint／composite 問題 | 無 |
| [pick-ui-library](../../.agents/skills/pick-ui-library/SKILL.md) | 正式需求確有缺口時評估元件／虛擬列表套件 | 無 |
| [prototype](../../.agents/skills/prototype/SKILL.md) | 另獲原型任務後，比較不同方向 | PICKER.md |
| [break-ui](../../.agents/skills/break-ui/SKILL.md) | 既有元件極端資料／空／大量／失敗狀態 | CATALOG.md |

八項都適用未來專業桌面工具的設計／驗證，所以保留；`prototype` 與 review／library skill 的 `disable-model-invocation` 原文照留，不保證每個 Agent 都會自動觸發。Codex 的 project discovery 路徑是 `.agents/skills/`；新 session 重新掃描前，本 session 可直接閱讀。Claude／Pi 可透過共同入口按需讀相同檔案；不宣稱已在其他 Agent 實測自動 discovery。相容入口由共用記憶規範維護，不能複製並獨立改寫上游 skill。

## 安裝工具查核與重現

官方 README 建議 `npx skills@latest add emilkowalski/skills`。本次先檢查 [npm skills 1.7.4 metadata](https://registry.npmjs.org/skills/1.7.4) 與對應 [CLI README](https://github.com/vercel-labs/skills/blob/a80e4c9d12d607631249d4d7d059f835d4b2f13a/README.md)、[commands](https://github.com/vercel-labs/skills/blob/a80e4c9d12d607631249d4d7d059f835d4b2f13a/docs/commands.md)、[installer.ts](https://github.com/vercel-labs/skills/blob/a80e4c9d12d607631249d4d7d059f835d4b2f13a/src/installer.ts)、[agents.ts](https://github.com/vercel-labs/skills/blob/a80e4c9d12d607631249d4d7d059f835d4b2f13a/src/agents.ts)、[add.ts](https://github.com/vercel-labs/skills/blob/a80e4c9d12d607631249d4d7d059f835d4b2f13a/src/add.ts)、[telemetry 說明](https://github.com/vercel-labs/skills/blob/a80e4c9d12d607631249d4d7d059f835d4b2f13a/docs/troubleshooting.md)。

`1.7.4` 對應 gitHead `a80e4c9d12d607631249d4d7d059f835d4b2f13a`，MIT，registry integrity 為 `sha512-lHZJksE8UImNAr+LL6unqq7jERjdFw5EJasm17srycwL7rXHGdCmgu1L1ttLxUO9i3rdH+QQig+px0icHqLmRw==`。它要求 Node `>=22.20.0`，高於本專案固定 `22.17.0`；**CLI 沒有執行或加入依賴**。這是 metadata／source inspection，沒有宣稱 tarball 已下載校驗。

其預設 project 安裝、agent 偵測、canonical copy 加 symlink／Windows junction、copy fallback、可覆寫目的 skill、lockfile 及 telemetry/security-audit request 都可能產生副作用；`-g` 會寫使用者目錄，`--all` 會擴大技能及 Agent 範圍。執行時可用 `DISABLE_TELEMETRY=1` 或 `DO_NOT_TRACK=1` 關閉兩類 request。這些查核促成本次選擇 bounded 自有工具，不執行未固定的 latest，也不升級專案 Node 只為安裝文字技能。

```powershell
# 預設離線：只檢查 16 個已保存檔案（8 SKILL、6 reference、README、LICENSE）
node scripts/setup/emil-skills.mjs --check
# 只列出缺少／不同的檔案，不連網、不修改
node scripts/setup/emil-skills.mjs --dry-run
# 僅缺檔時，從固定 commit 的 raw URL 取得、驗 Git blob 與 SHA256 後新增；不同檔案拒絕覆蓋
node scripts/setup/emil-skills.mjs --restore
# 檢查 token schema／靜態對比／狀態完整性；不是 runtime／視覺測試
node scripts/setup/emil-skills.mjs --standards
```

正常 Git checkout 已包含所有文字檔，不需網路。restore 不接受任意 URL／ref／目的地，不移除／覆寫既有內容，不建立 symlink，不執行下載內容；網路與檔案權限失敗保留錯誤。若發現不同檔案，先保存 diff、確認是本地修改或 pin 更新，再透過明確來源審查更新 manifest；不能把本機目前 hash 當成上游證據。

## 套用限制與指令優先序

上游是設計參考，不覆寫最新使用者要求、已接受 ADR、physics／DSP 契約及本專案 token。`pick-ui-library` 的喜好清單不構成採納或安裝依據；本次未安裝 React／Motion／Base UI 等產品依賴。UI spring、swipe velocity、blur 或 stagger 不適用於 Rapier 抓取／音訊排程／求解數據。

上游的 bare-invocation greeting、audit 後等待選擇、break-ui report 後等待修正、prototype 等候 variant choice 必須依實際任務範圍套用。本次使用者明確授權直接建立規範與環境，無須停在問候／重複確認；但沒有授權建立正式 UI 或代替使用者選 prototype 方向，因此這些 UI 工作 **未執行**。`improve-animations` 保持 audit/plan 角色，不把所有下游工程都限制成 read-only。具體 motion 差異見 [MOTION_GUIDELINES.md](MOTION_GUIDELINES.md)。

驗證只證明來源文字、tokens 及規範結構；正式產品沒有可執行 UI，所以八項技能的實機行為、visual review、animation profile 與 accessibility testing 均 **NOT RUN**。
