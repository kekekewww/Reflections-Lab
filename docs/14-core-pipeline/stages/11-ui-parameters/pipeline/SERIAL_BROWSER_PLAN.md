# 最終 Pipeline 真 DOM 串行驗證計畫

狀態：全部 22 案 STATIC READY／WAITING ROOT EXCLUSIVE LEASE。候選 product 49bde82be6f9def5058bc8f3076e105fcdfd535d；入口 index-C4qRBPy8.js／SHA256 8d4f079ed98894648a0da35092471f730644128a2e3d569dc5fb191210b84123 為 Root 交付，實際每批仍獨立記錄 HTTP bytes。尚未執行這一批。方法為 **Playwright CLI scripted DOM／headless Chrome**；不是 native app 或 MCP 操作。Root 的三次 native app 未完成證據另存，不以本批替代其方法標籤。

全部在 `D:/Developing/Meta Hack/.worktrees/integration`，連既有 production preview 4173，不自行啟 dev server、不 build、不改產品／Git。Root 交付最終 candidate 與 browser lease 後才執行；同時最多一個 Chrome，前一批 CLI 結束／fixture teardown 後才啟下一批。每次重試改新 attempt，保留原始 FAIL／中止／成功截點。

共同命令前綴：`node node_modules/@playwright/test/cli.js test --config tests/browser/parameter-audit/`，以下 config 與 filter 依序接在前綴後。

| 順序 | 設定與 filter | 案數 | attempt／來源環境 |
| --- | --- | --- | --- |
| 1 | `pipeline-events-audit.config.ts --grep 'events controls cover finalized recording replay seek and normalized event evidence'` | 1 | PIPELINE_EVENTS_ATTEMPT、PIPELINE_EVENTS_CANDIDATE |
| 2 | `pipeline-dock-paths-comparison.config.ts --grep 'comparison controls'` | 1 | PIPELINE_DOCK_ATTEMPT |
| 3 | `pipeline-agent-audit.config.ts` | 3 | PIPELINE_AGENT_ATTEMPT、PIPELINE_AGENT_SOURCE_HINT |
| 4 | `pipeline-motion-audit.config.ts --grep-invert 'native keyboard and pointer'` | 6 | MOTION_AUDIT_ATTEMPT |
| 5 | `pipeline-render-performance-render.config.ts` | 4 | PIPELINE_RENDER_AUDIT_ATTEMPT |
| 6 | `pipeline-zones-audit.config.ts` | 6 | PIPELINE_ZONES_BROWSER_LEASE=granted、PIPELINE_ZONES_ATTEMPT、PIPELINE_ZONES_CANDIDATE |
| 7 | `pipeline-render-performance-combined.config.ts` | 1 | PIPELINE_COMBINED_AUDIT_ATTEMPT；禁止借前六批結果當完成 |

前六批共 21 案，最後完整管線另 1 案。Performance 已有有限狀態收據、Motion 原生數字增減已有舊版三欄兩方法收據，不擅自加入重複批次。舊版結果維持其實際 source／HTTP bundle pins，不外推最終來源。

## 每批共同收據

- Root candidate 為來源提示；真正載入的 HTML／JS／CSS hashes、Chrome 版本、開始／結束時間、stdout／exit／逐項機讀狀態另行保存。
- 只用產品 UI click／keyboard／正常檔案上傳下載；evaluate 僅 DOM read。不呼叫 runtime／HostInternal／測試 bridge。
- 阻擋 paid propose 與外部 HTTP；本機真 public provider status 可查。Root gated API 為 offline available、Meta NETWORK_DISABLED、budget 0、live NOT RUN，不 mock live。
- 狀態分開記 PASS／FAIL／ABSENT_NOT_A_CONTROL／NOT_OBSERVED／未執行；family 的一例不冒充全部 instance／狀態。
- 原始 reporter JSON 保留 bytes；Agent／Motion 錯位的歷史 raw 已驗 hash 後移回 canonical docs，見 REPORTER_RAW_RELOCATION.json，不格式化原始資料。
- 失敗先保留畫面／trace／機讀事實，再區分 harness、狀態前置或產品問題；產品修改由 Root 指定 owner，重新建置後針對影響範圍重驗。

## 主要待驗點

Events 最後一案等新 seal 與新 runId 後再 export，同時驗 immutable archive 讀取；之前兩個 replay 入口與 reset 的成功維持各自來源。Comparison 以全域 role=alert 驗 A／B／geometry 拒絕文案，不把舊錯誤當成本次結果。

Agent 三案含真 gated API、prompt／4000 字上限、keyboard／browser CDP composition（不是 OS／真人 IME）、preview／stale apply／Undo、duration／cancel、基準／候選／比較與拒絕。沒有 model／key／budget／context 編輯欄。

Motion 六案含其餘全部 kinds／release／import／history／timeout／cancel／rebase 及錄放禁用條件。新的 Zone 第一案含實際八分頁 pointer／keyboard。Zone 六案含全部 authoring／引用／容量／schema／占用事件／錄放／A-B／Project 往返；emitter attachment 沒有編輯 control，合法 Project UI import 另列方法。

Render 四案包含 tail bounds、stems off/on、取消保留上一 publication／重試、逐一下載 WAV／manifest。未 Enable Audio 時先以 UI 設 Monitor -40 dB，驗下載 manifest master.monitorGain=0.01；其後獨立收據驗 Synthetic late reverb 真 true→false，不掩蓋前項已完成結果。

## 最後完整管線

只準備一個組合場景，不增加無關高 CPU 批次：dynamicNoGravity sphere ball 水平 MoveTo 穿過 Zone；AlwaysOn speed→gain 非線性曲線與 OnEnter／OnExit；ball 為 metal dynamicReflector，另一 speaker 音源提供真反射見證；所有作者修改先完成，Motion 最後 Save，以避免 stale pin。Run 後立即 UI Pause，再用 UI 錄製 3 秒固定步，保留尚未完成的 Motion。

計畫位置：ball 從 [-0.8,2,0] 到 [2.5,2,0]，speed 1.5、acceleration 12、impulse limit 10、timeout 10；Zone center [0.2,2,0]／half [0.4,0.5,0.5]／hysteresis 0.05。speaker／Listener 同側配置由 combined case 正常 UI 設定。任何 import 作者部分都需清楚標示，不冒手動填欄。

實際下載的 recording JSON 必須證明物件位置變化、raw／normalized Zone IDs、resolved mapping 與 speaker 的 order-1 reflection surfaceIds 包含 `ball.body`；跨 tick reflection point／delay 變化且 path ID 穩定。球的聲音會 self-exclude，不能用球自身聲源證明自身反射。backend version／capability label 單獨不足以判定成功。

最後產生並逐一下載 mix／master／dry／object stems 及 manifest，核對每檔 bytes／hash／WAV 格式與非靜音資料，交 Root 的獨立 WAV 驗證工具複核。只稱有界 snapshot 反射與模型結果，不稱 Doppler／focusing／RT60／真人聽測或全產品性能通過。
