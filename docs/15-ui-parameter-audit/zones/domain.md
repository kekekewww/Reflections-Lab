# Task0029：Zone Scene domain、schema 與原子交易

日期：2026-11-02。執行者：Codex zone_domain 子代理；基底分支 codex/pipeline-zones（f6abb93）。本報告限 Scene domain，不代表 producer、UI、錄放或產品整體通過。

## 變更

- 新增 SceneZone：明示靜態 aabb 或 sphere，stable ID、name、enabled、centerM、hysteresisM 及半尺寸／半徑。max 16；半尺寸／半徑 0.05–50 m，center ±200 m，hysteresis 0–0.25 m 且嚴格小於最小半尺寸／半徑。
- SceneSpec.zones 為 optional，create／serialize／deserialize 不插入預設值；舊場景沒有 zones 時，canonical JSON 字串與 SHA-256 完全不變。明示空陣列仍保留，與缺省區分。
- SceneOperation 新增 AddZone、UpdateZone、RemoveZone、SetZones。所有操作沿用 revision、原件隔離、逐步驗證及原子交易；inverse 使用 SetZones 恢復完整順序與作者值。SetZones 的 null 表示刪除 optional property，能 Undo 回 legacy 缺省，[] 則恢復明示空集合。
- Zone ID 加入 objects／sources／listener 的全域唯一性集合；新物件與聲源也不可占用 zone ID。
- 閉合 schema 拒絕未知 shape／欄位、無限／NaN、非法範圍及配錯 shape 參數；JSON 入口拒絕稀疏陣列與陣列額外屬性，避免序列化遺失 metadata。

## 驗證

- `node --import tsx --test tests/scene/*.test.ts`：32/32 PASS（原18、新14），原始 TAP 見 domain-tests.txt。包含 absent／[] 差異、legacy bytes/hash、兩種volume、hysteresis邊界、容量、重複／跨entity ID、原子回滾、增改刪Undo及64操作最大交易完整inverse。
- scoped ESLint：exit 0；scoped Prettier --check：exit 0。
- `npm run typecheck` 曾於 UI 檔建立中的時間點 exit 1，唯一訊息為 AnalysisDock 找不到 ZonePanel.js；不是整樹 TypeScript PASS。Lead 在 UI／runtime 接線完成後必須重新執行。
- 獨立只讀 domain_review 核對上述 assigned domain/schema/tests，未發現 confirmed 重大或次要缺陷；沒有獨立重跑測試。

## 界線與交接

未修改 fixture、physics、聲學角色、runtime、AI、behavior、UI、package、Wiki 或英文生成檔；未 stage／commit。區域的 Derived body-center crossing、初始 inside、hysteresis 事件、刪除／reset／generation 邊界及 raw／normalized／replay 由 Task0029 lead 整合驗證。本 domain 沒有創建任何 phantom Rapier body 或 acoustic surface，也不將作者 volume 宣稱為量測感測器。