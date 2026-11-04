import type { MessageCatalog } from "../locale-types.js";

export const pipelineMessages = {
  "pipeline.tabs.motion": { "zh-TW": "動作", en: "Motion" },
  "pipeline.tabs.zones": { "zh-TW": "區域", en: "Zones" },
  "pipeline.tabs.render": { "zh-TW": "音訊匯出", en: "Audio export" },
  "pipeline.tabs.performance": { "zh-TW": "效能", en: "Performance" },
  "pipeline.bounce.help": {
    "zh-TW":
      "僅分類動態物件與未移動固定支撐面的已接受撞擊：短時間內分離並具有相對離面速度才產生彈跳事件；動態對動態或移動支撐面尚未分類。",
    en: "Bounce classification covers admitted impacts between a dynamic object and an unmoved fixed support, followed by separation with outgoing relative velocity within a bounded window. Dynamic pairs and moving supports are not classified.",
  },
  "pipeline.unavailable": {
    "zh-TW": "此工作階段未提供這項功能。",
    en: "This feature is unavailable in this session.",
  },
  "pipeline.agent.undo": { "zh-TW": "復原上次 AI 套用", en: "Undo last AI apply" },
  "pipeline.agent.undoHelp": {
    "zh-TW":
      "透過提案 Host 復原最後一次已套用的場景或動作交易，保留 revision 守衛；不倒轉已發生的物理或聲音。",
    en: "Undo the last applied scene or motion transaction through its proposal host, preserving revision guards. This does not reverse elapsed physics or audio.",
  },
  "pipeline.workflow.title": { "zh-TW": "實驗流程", en: "Experiment workflow" },
  "pipeline.workflow.duration": { "zh-TW": "基準實驗長度", en: "Baseline duration" },
  "pipeline.workflow.run": { "zh-TW": "建立基準實驗", en: "Run baseline experiment" },
  "pipeline.workflow.compare": {
    "zh-TW": "以相同運動比較目前材質",
    en: "Compare current materials with matched motion",
  },
  "pipeline.workflow.cancel": { "zh-TW": "取消實驗流程", en: "Cancel experiment workflow" },
  "pipeline.workflow.help": {
    "zh-TW":
      "使用目前場景執行有限模擬、封存並分析結果。完成基準後，明確套用材質變更，再以原運動軌跡建立候選比較；不會自動套用提案或呼叫模型。",
    en: "Run a bounded simulation of the current scene, capture it and analyze the results. After a baseline completes, explicitly apply material changes, then compare a candidate using the original motion. This does not apply proposals or call a model.",
  },
  "pipeline.workflow.details": { "zh-TW": "步驟與結果來源", en: "Steps and result provenance" },
  "pipeline.workflow.empty": { "zh-TW": "尚未建立實驗基準。", en: "No experiment baseline yet." },
  "pipeline.workflow.baseline": { "zh-TW": "基準", en: "Baseline" },
  "pipeline.workflow.candidate": { "zh-TW": "候選", en: "Candidate" },
  "pipeline.workflow.tool": { "zh-TW": "工具", en: "Tool" },
  "pipeline.workflow.result": { "zh-TW": "結果", en: "Result" },
  "pipeline.workflow.recording": { "zh-TW": "錄製", en: "Recording" },
  "pipeline.workflow.explanation": { "zh-TW": "可追溯結果", en: "Grounded results" },
  "pipeline.workflow.metric": { "zh-TW": "指標", en: "Metric" },
  "pipeline.workflow.value": { "zh-TW": "數值", en: "Value" },
  "pipeline.workflow.band": { "zh-TW": "頻率 Hz", en: "Frequency Hz" },
  "pipeline.workflow.unit": { "zh-TW": "單位", en: "Unit" },
  "pipeline.workflow.unavailable": { "zh-TW": "未提供", en: "Unavailable" },
  "pipeline.workflow.rawEvidence": { "zh-TW": "原始 Host 說明", en: "Original host explanation" },
  "pipeline.workflow.step.cancelRequested": {
    "zh-TW": "等待安全取消",
    en: "Waiting for safe cancellation",
  },
  "pipeline.workflow.computed": { "zh-TW": "Host 計算結果", en: "Host-computed results" },
  "pipeline.workflow.status.idle": { "zh-TW": "尚未執行", en: "Idle" },
  "pipeline.workflow.status.running": { "zh-TW": "實驗執行中", en: "Experiment running" },
  "pipeline.workflow.status.cancelRequested": {
    "zh-TW": "等待安全取消",
    en: "Waiting for safe cancellation",
  },
  "pipeline.workflow.status.completed": { "zh-TW": "實驗完成", en: "Experiment completed" },
  "pipeline.workflow.status.stopped": { "zh-TW": "實驗已停止", en: "Experiment stopped" },
  "pipeline.workflow.status.failed": { "zh-TW": "實驗未完成", en: "Experiment incomplete" },
  "pipeline.workflow.step.queued": { "zh-TW": "等待", en: "Queued" },
  "pipeline.workflow.step.running": { "zh-TW": "執行中", en: "Running" },
  "pipeline.workflow.step.succeeded": { "zh-TW": "完成", en: "Succeeded" },
  "pipeline.workflow.step.failed": { "zh-TW": "失敗", en: "Failed" },
  "pipeline.workflow.step.canceled": { "zh-TW": "已取消", en: "Canceled" },
  "pipeline.workflow.step.timedOut": { "zh-TW": "逾時", en: "Timed out" },
  "pipeline.workflow.step.budgetExceeded": { "zh-TW": "超出預算", en: "Budget exceeded" },
  "pipeline.capture.duration": { "zh-TW": "錄製長度", en: "Capture duration" },
  "pipeline.capture.help": {
    "zh-TW": "錄製1–60秒的完整片段；可用主工具列「暫停」中止，未完成片段不會成為完整錄製。",
    en: "Capture a complete take of 1–60 seconds. Use Pause in the main toolbar to interrupt; an incomplete take is not a complete recording.",
  },
  "pipeline.capture.invalid": {
    "zh-TW": "請修正錄製長度，或按 Esc 還原後再錄製。",
    en: "Correct Capture duration or press Escape to restore it before capturing.",
  },
  "pipeline.capture.integer": {
    "zh-TW": "請輸入1–60之間的整數秒。",
    en: "Enter a whole number of seconds from 1 to 60.",
  },
  "pipeline.capture.pause": {
    "zh-TW": "錄製中；可用主工具列「暫停」中止。",
    en: "Capturing. Use Pause in the main toolbar to interrupt.",
  },
  "pipeline.archive.busy": {
    "zh-TW": "正在處理本機封存，請稍候再錄製或產生音檔。",
    en: "A local archive operation is in progress. Wait before capturing or rendering.",
  },
  "pipeline.archive.ownershipUnavailable": {
    "zh-TW": "此瀏覽器無法安全確認輸出工作擁有者，暫時無法復原或清理封存。",
    en: "This browser cannot safely verify output ownership. Archive recovery and cleanup are unavailable.",
  },
  "pipeline.archive.activeWriter": {
    "zh-TW": "仍有輸出工作正在寫入，完成或取消後再試。",
    en: "An output is still being written. Wait for it to finish or cancel it before retrying.",
  },
  "pipeline.archive.needsRecovery": {
    "zh-TW": "請先檢查並復原封存清單，確認狀態後再清理未完成輸出。",
    en: "Check and recover the archive list before cleaning up incomplete output.",
  },
  "pipeline.archive.title": { "zh-TW": "本機音檔封存", en: "Local audio archive" },
  "pipeline.archive.check": { "zh-TW": "檢查並復原封存", en: "Check and recover archive" },
  "pipeline.archive.empty": {
    "zh-TW": "此瀏覽器尚無封存音檔。",
    en: "No archived audio in this browser.",
  },
  "pipeline.archive.loading": { "zh-TW": "讀取封存中…", en: "Reading archive…" },
  "pipeline.archive.usage": {
    "zh-TW":
      "已存 {payload} MiB；保留 {reserved} MiB；計入上限 {charged} / {cap} MiB。{jobs} / {maxJobs} 筆。",
    en: "Stored {payload} MiB; reserved {reserved} MiB; charged {charged} / {cap} MiB. {jobs} / {maxJobs} jobs.",
  },
  "pipeline.archive.limits": {
    "zh-TW":
      "每筆 WAV 上限 {wav} MiB，清單另限 {manifest} MiB。只計應用程式資料；瀏覽器額外占用未量測。容量不足會拒絕新工作，不會自動刪除舊成果。",
    en: "Each job allows {wav} MiB of WAV plus {manifest} MiB for its manifest. These are application payload limits; browser overhead is unmeasured. New work is refused at capacity; old results are retained.",
  },
  "pipeline.archive.published": { "zh-TW": "已封存", en: "Published" },
  "pipeline.archive.interrupted": {
    "zh-TW": "已中斷，無完整音檔",
    en: "Interrupted; no complete output",
  },
  "pipeline.archive.writing": { "zh-TW": "尚在寫入", en: "Writing" },
  "pipeline.archive.delete": { "zh-TW": "刪除此封存", en: "Delete this archive" },
  "pipeline.archive.discard": { "zh-TW": "捨棄未完成音檔", en: "Discard incomplete output" },
  "pipeline.archive.confirmDelete": {
    "zh-TW": "刪除本機封存「{id}」的全部 WAV 與清單？此動作無法復原，不影響已下載的檔案。",
    en: "Delete all local WAV files and the manifest for “{id}”? This cannot be undone. Downloaded files are unaffected.",
  },
  "pipeline.archive.confirmDiscard": {
    "zh-TW": "捨棄本機未完成工作「{id}」及其暫存資料？此動作無法復原。",
    en: "Discard incomplete local job “{id}” and its staged data? This cannot be undone.",
  },
  "pipeline.archive.deleted": {
    "zh-TW": "已移除本機工作「{id}」。",
    en: "Removed local job “{id}”.",
  },
  "pipeline.archive.download": { "zh-TW": "下載 {id}", en: "Download {id}" },
  "pipeline.archive.manifest": {
    "zh-TW": "下載來源與雜湊清單",
    en: "Download provenance manifest",
  },
  "pipeline.archive.pending": { "zh-TW": "處理中…", en: "Working…" },
  "pipeline.archive.confirm": { "zh-TW": "確認移除", en: "Confirm removal" },
  "pipeline.archive.cancel": { "zh-TW": "保留", en: "Keep" },
  "pipeline.recovery.title": { "zh-TW": "中斷錄製復原", en: "Interrupted recording recovery" },
  "pipeline.recovery.refresh": { "zh-TW": "重新檢查錄製", en: "Refresh recordings" },
  "pipeline.recovery.empty": {
    "zh-TW": "此瀏覽器尚無可檢查的中斷錄製。",
    en: "No interrupted recordings to inspect in this browser.",
  },
  "pipeline.recovery.help": {
    "zh-TW":
      "復原僅載入已通過完整性檢查的持久化前段，仍標為中斷；可匯出錄製資料檢查，不能當作完整錄製或完整 WAV。",
    en: "Recovery loads only the integrity-checked persisted prefix and keeps it marked interrupted. Export the recording data for inspection; it is not a complete take or complete WAV.",
  },
  "pipeline.recovery.prefix": {
    "zh-TW": "已保存 {frames} 個 frame，最後 tick {tick}；保留 {bytes} MiB。",
    en: "Persisted {frames} frames through tick {tick}; reserved {bytes} MiB.",
  },
  "pipeline.recovery.active": {
    "zh-TW": "錄製仍有有效擁有者租約，無法復原或捨棄；稍後重新檢查。",
    en: "This recording has an active owner lease and cannot be recovered or discarded. Refresh later.",
  },
  "pipeline.recovery.load": { "zh-TW": "載入已驗證前段", en: "Load verified prefix" },
  "pipeline.recovery.discard": {
    "zh-TW": "捨棄此中斷錄製",
    en: "Discard this interrupted recording",
  },
  "pipeline.recovery.confirmDiscard": {
    "zh-TW": "捨棄本機錄製工作「{id}」及其已保存前段？此動作無法復原，不會刪除已完成錄製。",
    en: "Discard local recording session “{id}” and its persisted prefix? This cannot be undone. Completed recordings are retained.",
  },
  "pipeline.recovery.loaded": {
    "zh-TW": "已載入「{id}」的已驗證中斷前段；可匯出錄製資料檢查。",
    en: "Loaded the verified interrupted prefix for “{id}”. Export the recording data for inspection.",
  },
  "pipeline.recovery.emptyPrefix": {
    "zh-TW": "尚無已保存的 frame 可復原。",
    en: "No persisted frames are available to recover.",
  },
  "pipeline.recovery.noTick": { "zh-TW": "未提供", en: "unavailable" },
} as const satisfies MessageCatalog;
