import type { MessageCatalog } from "../locale-types.js";

export const explorerMessages = {
  "explorer.assetDetails": { "zh-TW": "來源資訊", en: "Source details" },
  "analysis.native.logicalActive": {
    "zh-TW": "邏輯實例活動中",
    en: "Logical instance active",
  },
  "analysis.native.sourceBudget": {
    "zh-TW": "原生音訊拒絕：已達聲源容量",
    en: "Native audio rejected: source capacity reached",
  },
  "analysis.native.voiceBudget": {
    "zh-TW": "原生音訊拒絕：聲音優先權未通過容量限制",
    en: "Native audio rejected: voice priority did not pass the capacity limit",
  },
  "analysis.native.otherReason": {
    "zh-TW": "原生音訊拒絕；原始原因：{reason}",
    en: "Native audio rejected; original reason: {reason}",
  },
  "analysis.native.missingReason": {
    "zh-TW": "原生音訊拒絕；引擎未提供原因",
    en: "Native audio rejected; the engine provided no reason",
  },
  "analysis.native.scope": {
    "zh-TW": "即時原生准入診斷；不寫入錄製。邏輯實例不代表實際裝置輸出。",
    en: "Live native admission diagnostic; excluded from recordings. A logical instance does not establish actual device output.",
  },
  "analysis.native.latestAttempt": {
    "zh-TW": "最近原生拒絕 tick {tick}",
    en: "Latest native rejection at tick {tick}",
  },
  "analysis.native.audioEvent": {
    "zh-TW": "原始邏輯音訊事件 ID",
    en: "Original logical audio event ID",
  },
  "analysis.native.epoch": { "zh-TW": "Run epoch", en: "Run epoch" },
  "analysis.native.context": {
    "zh-TW": "邏輯事件版本脈絡",
    en: "Logical event version context",
  },
  "analysis.native.contextValues": {
    "zh-TW": "generation {generation} · scene r{scene} · behavior r{document} · profile r{profile}",
    en: "generation {generation} · scene r{scene} · behavior r{document} · profile r{profile}",
  },
  "analysis.native.acousticFrame": {
    "zh-TW": "原生嘗試的聲學 request ID",
    en: "Acoustic request ID for native attempt",
  },
  "analysis.native.attempt": {
    "zh-TW": "原生嘗試／聲學時點",
    en: "Native attempt / acoustic timing",
  },
  "analysis.native.attemptValues": {
    "zh-TW": "嘗試 tick {attempt} · acoustic pose tick {pose} · acoustic scene r{scene}",
    en: "attempt tick {attempt} · acoustic pose tick {pose} · acoustic scene r{scene}",
  },
  "analysis.decision.reason": { "zh-TW": "決策原因", en: "Decision reason" },
  "analysis.decision.occurrences": {
    "zh-TW": "同一步相同決策次數",
    en: "Identical decisions in this step",
  },
  "analysis.decision.action": { "zh-TW": "決策動作", en: "Decision action" },
  "analysis.decision.binding": { "zh-TW": "綁定 ID", en: "Binding ID" },
  "analysis.decision.inputEvent": { "zh-TW": "輸入事件 ID", en: "Input event ID" },
  "analysis.decision.instance": { "zh-TW": "聲音實例 ID", en: "Sound instance ID" },
  "analysis.decision.attachment": {
    "zh-TW": "設定的發聲位置來源",
    en: "Configured emitter attachment",
  },
  "analysis.decision.contactPair": { "zh-TW": "輸入接觸配對", en: "Input contact pair" },
  "analysis.decision.contactPosition": {
    "zh-TW": "輸入接觸位置（m）",
    en: "Input contact position (m)",
  },
  "analysis.decision.emitterPosition": {
    "zh-TW": "實際發聲位置（m）",
    en: "Emitted source position (m)",
  },
  "analysis.decision.latestTick": {
    "zh-TW": "最近決策 tick {tick}",
    en: "Latest decision at tick {tick}",
  },
  "analysis.decision.action.start": {
    "zh-TW": "已建立邏輯聲音實例",
    en: "Logical sound instance created",
  },
  "analysis.decision.action.update": { "zh-TW": "更新", en: "Updated" },
  "analysis.decision.action.stop": { "zh-TW": "停止", en: "Stopped" },
  "analysis.decision.action.reject": { "zh-TW": "抑制", en: "Suppressed" },
  "analysis.decision.attachment.contact": { "zh-TW": "接觸點", en: "Contact point" },
  "analysis.decision.attachment.object": {
    "zh-TW": "物件相對位置",
    en: "Object-relative position",
  },
  "analysis.decision.attachment.fixed": { "zh-TW": "固定位置", en: "Fixed position" },
  "analysis.decision.attachment.zone": { "zh-TW": "區域位置", en: "Zone position" },
  "analysis.decision.ruleMatch": {
    "zh-TW": "規則符合；已建立邏輯聲音實例",
    en: "Rule matched; logical sound instance created",
  },
  "analysis.decision.cooldown": { "zh-TW": "規則冷卻中", en: "Rule cooldown is active" },
  "analysis.decision.globalLimit": {
    "zh-TW": "已達整體聲音實例上限",
    en: "Global voice limit reached",
  },
  "analysis.decision.objectLimit": {
    "zh-TW": "已達物件聲音實例上限",
    en: "Object voice limit reached",
  },
  "analysis.decision.ruleLimit": {
    "zh-TW": "已達規則聲音實例上限",
    en: "Rule voice limit reached",
  },
  "analysis.decision.metricUnavailable": {
    "zh-TW": "所需物理量未提供",
    en: "Required metric is unavailable",
  },
  "analysis.decision.emitterUnavailable": {
    "zh-TW": "發聲位置未提供",
    en: "Emitter position is unavailable",
  },
  "analysis.decision.contactUnavailable": {
    "zh-TW": "缺少接觸位置，無法建立接觸聲源",
    en: "Contact position is missing; no contact source was emitted",
  },
  "analysis.decision.conditionUnknown": {
    "zh-TW": "條件未成立或資料未知",
    en: "Condition is false or unknown",
  },
  "analysis.decision.duplicate": { "zh-TW": "重複事件已略過", en: "Duplicate event was ignored" },
  "analysis.decision.producerRejected": {
    "zh-TW": "輸入事件未獲來源接受",
    en: "Input producer did not accept the event",
  },
  "analysis.decision.latchActive": {
    "zh-TW": "有界持續聲已在活動中",
    en: "Latched sound is already active",
  },
  "analysis.decision.latchRestart": {
    "zh-TW": "有界持續聲重新觸發",
    en: "Latched sound restarted",
  },
  "analysis.decision.latchStop": {
    "zh-TW": "停止事件已結束有界持續聲",
    en: "Stop event ended the latched sound",
  },
  "analysis.decision.latchContext": {
    "zh-TW": "有界持續聲所需資料未提供",
    en: "Latched sound context is unavailable",
  },
  "analysis.decision.latchUpdate": {
    "zh-TW": "有界持續聲參數已更新",
    en: "Latched sound parameters updated",
  },
  "analysis.decision.continuousUpdate": {
    "zh-TW": "持續聲參數已更新",
    en: "Continuous sound parameters updated",
  },
  "analysis.decision.oneShotUpdate": {
    "zh-TW": "單次聲的物件位置已更新",
    en: "One-shot sound followed its object",
  },
  "analysis.decision.gateClosed": {
    "zh-TW": "持續聲條件已關閉",
    en: "Continuous sound gate closed",
  },
  "analysis.decision.invalidated": {
    "zh-TW": "物件或規則已失效",
    en: "Object or rule was invalidated",
  },
  "analysis.decision.ended": { "zh-TW": "單次聲已結束", en: "One-shot sound ended" },
  "analysis.decision.lifetime": {
    "zh-TW": "聲音實例已到期",
    en: "Sound instance lifetime expired",
  },
  "analysis.decision.deadline": {
    "zh-TW": "有界持續聲已到期",
    en: "Latched sound reached its deadline",
  },
  "analysis.decision.ruleDisabled": {
    "zh-TW": "規則設定為停用",
    en: "Rule is disabled in configuration",
  },
  "analysis.decision.bindingDisabled": {
    "zh-TW": "物件綁定設定為停用",
    en: "Object binding is disabled in configuration",
  },
  "analysis.decision.unknownReason": {
    "zh-TW": "原始決策原因：{reason}",
    en: "Original decision reason: {reason}",
  },
  "explorer.primitive.box": { "zh-TW": "方塊", en: "Box" },
  "explorer.primitive.sphere": { "zh-TW": "球體", en: "Sphere" },
  "explorer.primitive.capsule": { "zh-TW": "膠囊", en: "Capsule" },
  "explorer.region": { "zh-TW": "場景與素材", en: "Scene and assets" },
  "explorer.scene": { "zh-TW": "場景", en: "Scene" },
  "explorer.objectCount": { "zh-TW": "{count} 物件", en: "{count} objects" },
  "explorer.searchLabel": { "zh-TW": "搜尋場景物件", en: "Search scene objects" },
  "explorer.searchPlaceholder": { "zh-TW": "搜尋物件或 ID", en: "Search objects or IDs" },
  "explorer.library": { "zh-TW": "物件庫", en: "Object library" },
  "explorer.primitives": { "zh-TW": "PRIMITIVES", en: "PRIMITIVES" },
  "explorer.addPrimitive": { "zh-TW": "新增{shape}", en: "Add {shape}" },
  "explorer.pauseBeforeAdd": { "zh-TW": "請先暫停再新增物件", en: "Pause before adding an object" },
  "explorer.sceneObjects": { "zh-TW": "場景物件", en: "Scene objects" },
  "explorer.objectList": { "zh-TW": "場景物件清單", en: "Scene object list" },
  "explorer.mode.held": { "zh-TW": "持有", en: "Held" },
  "explorer.mode.fixed": { "zh-TW": "固定", en: "Fixed" },
  "explorer.mode.kinematic": { "zh-TW": "運動", en: "Kinematic" },
  "explorer.mode.dynamic": { "zh-TW": "動態", en: "Dynamic" },
  "explorer.noMatches": { "zh-TW": "沒有符合的物件。", en: "No matching objects." },
  "explorer.addFirst": {
    "zh-TW": "從物件庫新增第一個物件。",
    en: "Add your first object from the library.",
  },
  "explorer.listenerEnvironment": { "zh-TW": "Listener / 環境", en: "Listener / Environment" },
  "explorer.listenerFollowsFps": { "zh-TW": "跟隨 FPS", en: "Follows FPS" },
  "explorer.listenerIndependent": { "zh-TW": "獨立位置", en: "Independent position" },
  "explorer.soundAssets": { "zh-TW": "聲音素材", en: "Sound assets" },
  "explorer.noAssets": {
    "zh-TW": "尚無素材；可匯入自己的音檔。",
    en: "No assets yet. Import your own audio files.",
  },
  "explorer.auditionLabel": { "zh-TW": "預聽 {name} 乾音", en: "Audition {name} dry" },
  "explorer.auditionTitle": {
    "zh-TW": "乾音預聽；非場景實驗",
    en: "Dry audition; outside the scene experiment",
  },
  "explorer.rightsConfirmation": {
    "zh-TW": "我確認有權使用匯入的音檔",
    en: "I confirm that I have the right to use the imported audio",
  },
  "explorer.confirmRightsFirst": {
    "zh-TW": "請先確認素材使用權",
    en: "Confirm your right to use the asset first",
  },
  "explorer.pauseFirst": { "zh-TW": "請先暫停", en: "Pause first" },
  "explorer.localDecode": {
    "zh-TW": "只在本機解碼，不上傳模型",
    en: "Decoded locally; never uploaded to the model",
  },
  "explorer.importSound": { "zh-TW": "匯入聲音", en: "Import audio" },
  "explorer.importHelp": {
    "zh-TW":
      "PCM/float WAV，大小/時長限制依錯誤提示。本機素材不會上傳模型。預聽為獨立乾音，不列入實驗。",
    en: "PCM/float WAV. Size and duration limits appear in error messages. Local assets are never uploaded to the model. Audition plays dry audio separately and is excluded from experiments.",
  },
  "explorer.sceneUnits": { "zh-TW": "場景單位 SI · +Y 向上", en: "Scene units: SI · +Y up" },
  "explorer.gravityAndMedium": {
    "zh-TW": "重力與傳播介質分開設定",
    en: "Gravity and the propagation medium are configured separately",
  },
  "projectImport.errorSize": {
    "zh-TW": "SIZE_LIMIT：專案 JSON 超過 8 MiB。",
    en: "SIZE_LIMIT: Project JSON exceeds 8 MiB.",
  },
  "projectImport.errorRoot": {
    "zh-TW": "PROJECT_INVALID：專案根資料必須是 JSON 物件。",
    en: "PROJECT_INVALID: The project root must be a JSON object.",
  },
  "projectImport.errorRead": {
    "zh-TW": "無法讀取專案 JSON。",
    en: "Unable to read project JSON.",
  },
  "projectImport.errorApply": {
    "zh-TW": "專案匯入失敗；原草稿保留。",
    en: "Project import failed; the draft has been kept.",
  },
  "projectImport.unavailable": { "zh-TW": "— 未提供", en: "— Not provided" },
  "projectImport.notProvided": { "zh-TW": "未提供", en: "Not provided" },
  "projectImport.pauseFirst": {
    "zh-TW": "請先暫停再匯入專案 JSON",
    en: "Pause before importing project JSON",
  },
  "projectImport.reviewFirst": {
    "zh-TW": "匯入專案 JSON；先檢視再套用",
    en: "Import project JSON; review before applying",
  },
  "projectImport.title": { "zh-TW": "匯入專案 JSON", en: "Import project JSON" },
  "projectImport.introduction": {
    "zh-TW": "選擇本機 JSON 並檢視內容。套用將替換目前工作區專案；檔案不會上傳模型。",
    en: "Choose a local JSON file and review its contents. Applying replaces the current workspace project; the file is not uploaded to a model.",
  },
  "projectImport.fileLimit": {
    "zh-TW": "專案 JSON 檔案 · 上限 8 MiB",
    en: "Project JSON file · Maximum 8 MiB",
  },
  "projectImport.selectFile": {
    "zh-TW": "選擇專案 JSON 檔案",
    en: "Choose a project JSON file",
  },
  "projectImport.applying": {
    "zh-TW": "正在套用並驗證專案…",
    en: "Applying and validating the project…",
  },
  "projectImport.reading": {
    "zh-TW": "正在讀取 JSON；尚未套用。",
    en: "Reading JSON; not yet applied.",
  },
  "projectImport.preview": { "zh-TW": "專案匯入預覽", en: "Project import preview" },
  "projectImport.localFile": { "zh-TW": "本機來源檔案", en: "Local source file" },
  "projectImport.fileSummary": { "zh-TW": "{name} · {bytes} bytes", en: "{name} · {bytes} bytes" },
  "projectImport.projectName": { "zh-TW": "專案名稱", en: "Project name" },
  "projectImport.sceneRevision": { "zh-TW": "Scene revision", en: "Scene revision" },
  "projectImport.contentSummary": { "zh-TW": "內容摘要", en: "Contents" },
  "projectImport.counts": {
    "zh-TW": "{objects} 物件 · {assets} 素材 · {recordings} 錄製引用",
    en: "{objects} objects · {assets} assets · {recordings} recording references",
  },
  "projectImport.validationHelp": {
    "zh-TW": "此為 JSON 語法與摘要預覽；完整 schema、資產及引用會在套用時由 Domain 驗證。",
    en: "This previews JSON syntax and a summary. The domain validates the full schema, assets and references when you apply it.",
  },
  "projectImport.inspectJson": {
    "zh-TW": "檢視 JSON 開頭（最多 6,000 字元）",
    en: "Inspect the start of the JSON (up to 6,000 characters)",
  },
  "projectImport.cancel": { "zh-TW": "取消匯入", en: "Cancel import" },
  "projectImport.apply": { "zh-TW": "套用並開啟專案", en: "Apply and open project" },
  "analysis.tabs.events": {
    "zh-TW": "事件與錄放",
    en: "Events & recording",
  },
  "analysis.tabs.paths": {
    "zh-TW": "聲學路徑",
    en: "Acoustic paths",
  },
  "analysis.tabs.comparison": {
    "zh-TW": "實驗比較",
    en: "Experiment comparison",
  },
  "analysis.tabs.agent": {
    "zh-TW": "Meta 實驗 Agent",
    en: "Meta experiment agent",
  },
  "analysis.notProvided": {
    "zh-TW": "— 未提供",
    en: "— Not provided",
  },
  "analysis.path.direct": {
    "zh-TW": "直達聲",
    en: "Direct",
  },
  "analysis.path.reflection": {
    "zh-TW": "反射",
    en: "Reflection",
  },
  "analysis.path.transmission": {
    "zh-TW": "穿透",
    en: "Transmission",
  },
  "analysis.path.blocked": {
    "zh-TW": "阻擋候選（不送音訊）",
    en: "Blocked candidate (not sent to audio)",
  },
  "analysis.actionFailed": {
    "zh-TW": "操作失敗，請檢查輸入後重試。",
    en: "The action failed. Check the input and try again.",
  },
  "analysis.region": {
    "zh-TW": "實驗與分析面板",
    en: "Experiment and analysis panel",
  },
  "analysis.tabList": {
    "zh-TW": "實驗分析",
    en: "Experiment analysis",
  },
  "analysis.expand": {
    "zh-TW": "展開實驗面板",
    en: "Expand experiment panel",
  },
  "analysis.collapse": {
    "zh-TW": "收合實驗面板",
    en: "Collapse experiment panel",
  },
  "analysis.actionIncomplete": {
    "zh-TW": "操作未完成：",
    en: "Action incomplete: ",
  },
  "analysis.recording.active": {
    "zh-TW": "記錄中",
    en: "Recording",
  },
  "analysis.recording.replaying": {
    "zh-TW": "運動／事件重播",
    en: "Motion / event replay",
  },
  "analysis.recording.saved": {
    "zh-TW": "紀錄已保存",
    en: "Recording saved",
  },
  "analysis.recording.interrupted": {
    "zh-TW": "中斷紀錄已封存；不可重播",
    en: "Interrupted recording archived; replay unavailable",
  },
  "analysis.recording.empty": {
    "zh-TW": "尚未錄製",
    en: "No recording yet",
  },
  "analysis.recording.stopReplayFirst": {
    "zh-TW": "先結束重播，再建立新的錄製",
    en: "Stop replay before creating a new recording",
  },
  "analysis.recording.stop": {
    "zh-TW": "■ 停止錄製",
    en: "■ Stop recording",
  },
  "analysis.recording.start": {
    "zh-TW": "● 開始錄製",
    en: "● Start recording",
  },
  "analysis.recording.completeRequired": {
    "zh-TW": "需要一份完整的運動／事件紀錄",
    en: "A complete motion / event recording is required",
  },
  "analysis.recording.endReplay": {
    "zh-TW": "結束重播",
    en: "End replay",
  },
  "analysis.recording.replay": {
    "zh-TW": "▶ 重播紀錄",
    en: "▶ Replay recording",
  },
  "analysis.recording.exportHelp": {
    "zh-TW": "匯出已封存的原始錄製 JSON；中斷紀錄仍保留狀態與原因，與專案 JSON 分開保存",
    en: "Export the archived raw recording JSON. Interrupted recordings retain their status and reason. Save separately from the project JSON.",
  },
  "analysis.recording.export": {
    "zh-TW": "匯出已封存錄製",
    en: "Export archived recording",
  },
  "analysis.recording.summary": {
    "zh-TW": "{duration} s · {events} 個已錄事件",
    en: "{duration} s · {events} recorded events",
  },
  "analysis.events.filter": {
    "zh-TW": "篩選事件",
    en: "Filter events",
  },
  "analysis.events.filterPlaceholder": {
    "zh-TW": "篩選事件、物件或規則",
    en: "Filter by event, object or rule",
  },
  "analysis.events.filterAria": {
    "zh-TW": "篩選事件",
    en: "Filter events",
  },
  "analysis.recording.playhead": {
    "zh-TW": "重播時間",
    en: "Replay time",
  },
  "analysis.recording.playheadAria": {
    "zh-TW": "{cursor} 秒，共 {duration} 秒",
    en: "{cursor} seconds of {duration} seconds",
  },
  "analysis.events.table": {
    "zh-TW": "正規化事件表，可捲動",
    en: "Normalized events table, scrollable",
  },
  "analysis.events.caption": {
    "zh-TW": "事件時間、固定步、類型與來源；選取可檢查事件證據",
    en: "Event time, fixed step, type and source. Select an event to inspect its evidence.",
  },
  "analysis.events.timeColumn": {
    "zh-TW": "時間 s",
    en: "Time s",
  },
  "analysis.events.tickColumn": {
    "zh-TW": "Tick",
    en: "Tick",
  },
  "analysis.events.eventColumn": {
    "zh-TW": "事件",
    en: "Event",
  },
  "analysis.events.objectRuleColumn": {
    "zh-TW": "物件／規則",
    en: "Object / rule",
  },
  "analysis.events.resultColumn": {
    "zh-TW": "處理結果",
    en: "Result",
  },
  "analysis.events.suppressed": {
    "zh-TW": "已抑制",
    en: "Suppressed",
  },
  "analysis.events.recorded": {
    "zh-TW": "已記錄",
    en: "Recorded",
  },
  "analysis.events.recentSummary": {
    "zh-TW": "顯示最新 {recent} / {total} 筆符合事件；完整紀錄仍保留。",
    en: "Showing the latest {recent} / {total} matching events. The complete recording is retained.",
  },
  "analysis.events.noMatches": {
    "zh-TW": "沒有符合的事件",
    en: "No matching events",
  },
  "analysis.events.waiting": {
    "zh-TW": "等待第一個事件",
    en: "Waiting for the first event",
  },
  "analysis.events.tryOtherFilter": {
    "zh-TW": "試試其他事件名稱或物件 ID。",
    en: "Try another event name or object ID.",
  },
  "analysis.events.waitingHelp": {
    "zh-TW":
      "開始運算並操作物件，碰撞、抓取及聲音決策會出現在這裡。錄製會另外保存可重播的運動與事件。",
    en: "Start the simulation and interact with objects. Collisions, grabs and sound decisions appear here. Recording separately saves motion and events for replay.",
  },
  "analysis.events.details": {
    "zh-TW": "選取事件詳細資料",
    en: "Selected event details",
  },
  "analysis.events.evidence": {
    "zh-TW": "事件證據",
    en: "Event evidence",
  },
  "analysis.detail.id": {
    "zh-TW": "ID",
    en: "ID",
  },
  "analysis.detail.type": {
    "zh-TW": "類型",
    en: "Type",
  },
  "analysis.detail.time": {
    "zh-TW": "時間",
    en: "Time",
  },
  "analysis.detail.object": {
    "zh-TW": "物件",
    en: "Object",
  },
  "analysis.detail.rule": {
    "zh-TW": "規則",
    en: "Rule",
  },
  "analysis.detail.asset": {
    "zh-TW": "素材",
    en: "Asset",
  },
  "analysis.detail.position": {
    "zh-TW": "位置 m",
    en: "Position m",
  },
  "analysis.events.timeDetail": {
    "zh-TW": "{time} s · tick {tick}",
    en: "{time} s · tick {tick}",
  },
  "analysis.notBehaviorDecision": {
    "zh-TW": "— 非行為決策",
    en: "— Not a behavior decision",
  },
  "analysis.acoustic.ready": {
    "zh-TW": "Computed · 求解結果",
    en: "Computed · Solver result",
  },
  "analysis.acoustic.idle": { "zh-TW": "尚無求解結果", en: "No solver result" },
  "analysis.acoustic.empty": { "zh-TW": "已求解 · 無路徑", en: "Computed · No paths" },
  "analysis.acoustic.unavailable": {
    "zh-TW": "空氣聲傳播不可用",
    en: "Airborne sound unavailable",
  },
  "analysis.acoustic.pending": {
    "zh-TW": "等待求解",
    en: "Waiting for solver",
  },
  "analysis.acoustic.stale": {
    "zh-TW": "結果已過期",
    en: "Result is stale",
  },
  "analysis.acoustic.error": {
    "zh-TW": "求解錯誤",
    en: "Solver error",
  },
  "analysis.acoustic.unsupported": {
    "zh-TW": "目前能力不支援",
    en: "Not supported by the current backend",
  },
  "analysis.acoustic.revisions": {
    "zh-TW": "{backend} · acoustic rev {acousticRevision} / scene rev {sceneRevision}",
    en: "{backend} · acoustic rev {acousticRevision} / scene rev {sceneRevision}",
  },
  "analysis.paths.table": {
    "zh-TW": "聲學路徑表，可捲動",
    en: "Acoustic paths table, scrollable",
  },
  "analysis.paths.caption": {
    "zh-TW": "真實求解器提供的幾何路徑，延遲自聲源發聲時刻起算",
    en: "Geometric paths supplied by the actual solver. Delay starts at the source emission time.",
  },
  "analysis.paths.idColumn": {
    "zh-TW": "路徑 ID",
    en: "Path ID",
  },
  "analysis.paths.distanceColumn": {
    "zh-TW": "距離 m",
    en: "Distance m",
  },
  "analysis.paths.delayColumn": {
    "zh-TW": "傳播延遲 ms",
    en: "Propagation delay ms",
  },
  "analysis.paths.gainColumn": {
    "zh-TW": "振幅比（線性）",
    en: "Amplitude ratio (linear)",
  },
  "analysis.paths.statusColumn": {
    "zh-TW": "狀態",
    en: "Status",
  },
  "analysis.paths.stale": {
    "zh-TW": "過期快照",
    en: "Stale snapshot",
  },
  "analysis.paths.debugOnly": {
    "zh-TW": "Debug only",
    en: "Debug only",
  },
  "analysis.paths.current": {
    "zh-TW": "目前 frame",
    en: "Current frame",
  },
  "analysis.paths.details": {
    "zh-TW": "選取路徑詳細資料",
    en: "Selected path details",
  },
  "analysis.paths.origin": {
    "zh-TW": "路徑來源",
    en: "Path provenance",
  },
  "analysis.detail.source": {
    "zh-TW": "聲源",
    en: "Source",
  },
  "analysis.detail.surfaces": {
    "zh-TW": "表面",
    en: "Surfaces",
  },
  "analysis.detail.model": {
    "zh-TW": "模型",
    en: "Model",
  },
  "analysis.paths.noReflection": {
    "zh-TW": "無表面反射",
    en: "No surface reflection",
  },
  "analysis.paths.delayHelp": {
    "zh-TW": "傳播延遲不含裝置延遲。振幅比不是聲壓級，未校準輸出不表示 dB SPL。",
    en: "Propagation delay excludes device latency. Amplitude ratio is not sound pressure level; uncalibrated output does not represent dB SPL.",
  },
  "analysis.paths.empty": {
    "zh-TW": "此結果沒有可顯示的路徑",
    en: "No paths in this result",
  },
  "analysis.paths.emptyHelp": {
    "zh-TW": "求解已完成，未回傳路徑。",
    en: "The solver completed and returned no paths.",
  },
  "analysis.paths.idleHelp": {
    "zh-TW": "尚未收到求解結果。請確認聲源與 Listener。",
    en: "No solver result has arrived. Check the source and Listener.",
  },
  "analysis.paths.pendingHelp": {
    "zh-TW": "正在等待聲學結果。",
    en: "Waiting for acoustic results.",
  },
  "analysis.paths.staleHelp": {
    "zh-TW": "舊結果沒有路徑，尚待目前場景的結果。",
    en: "The old result has no paths; current results are still needed.",
  },
  "analysis.paths.unsupportedHelp": {
    "zh-TW": "目前求解器未提供此條件的個別路徑。",
    en: "The solver does not provide individual paths for these conditions.",
  },
  "analysis.paths.unavailableHelp": {
    "zh-TW": "真空沒有空氣聲傳播。",
    en: "Sound does not propagate through air in a vacuum.",
  },
  "analysis.paths.errorHelp": {
    "zh-TW": "路徑求解失敗，未提供可用結果。",
    en: "Path solving failed; no usable result was provided.",
  },
  "analysis.paths.selectionUnavailable": {
    "zh-TW": "先前選取的路徑不在目前結果中。",
    en: "The previously selected path is absent from the current result.",
  },
  "analysis.paths.noMetrics": {
    "zh-TW": "這個 frame 尚未提供分析指標。",
    en: "No analysis metrics are available for this frame yet.",
  },
  "analysis.comparison.updateA": {
    "zh-TW": "更新 A 快照",
    en: "Update snapshot A",
  },
  "analysis.comparison.saveA": {
    "zh-TW": "保存 A 快照",
    en: "Save snapshot A",
  },
  "analysis.comparison.updateB": {
    "zh-TW": "更新 B 快照",
    en: "Update snapshot B",
  },
  "analysis.comparison.saveB": {
    "zh-TW": "保存 B 快照",
    en: "Save snapshot B",
  },
  "analysis.comparison.kind": {
    "zh-TW": "比較類型",
    en: "Comparison type",
  },
  "analysis.comparison.acoustic": {
    "zh-TW": "聲學 A/B",
    en: "Acoustic A/B",
  },
  "analysis.comparison.behavior": {
    "zh-TW": "聲音行為 A/B",
    en: "Sound behavior A/B",
  },
  "analysis.comparison.snapshotsRequired": {
    "zh-TW": "先保存 A 與 B，才能檢查可比較條件",
    en: "Save A and B before checking whether the conditions are comparable",
  },
  "analysis.comparison.compare": {
    "zh-TW": "檢查並比較",
    en: "Check and compare",
  },
  "analysis.comparison.acousticHelp": {
    "zh-TW": "聲學 A/B：固定運動、事件、聲音內容與 Listener，只改明示的聲學材質／傳播參數。",
    en: "Acoustic A/B: hold motion, events, sound content and Listener fixed; change only the stated acoustic material / propagation parameters.",
  },
  "analysis.comparison.behaviorHelp": {
    "zh-TW": "行為 A/B：固定運動、原始物理事件與傳播條件，比較明示的素材、生成器或行為規則。",
    en: "Behavior A/B: hold motion, raw physics events and propagation conditions fixed; compare the stated assets, generators or behavior rules.",
  },
  "analysis.comparison.prepareHelp": {
    "zh-TW": "先錄製同一段運動，再保存兩組條件。變更無關條件的資料不會被當成單因素比較。",
    en: "Record the same motion, then save both sets of conditions. Results with unrelated changes are not treated as a single-factor comparison.",
  },
  "analysis.comparison.noMetrics": {
    "zh-TW": "尚未取得可比較的結果。未提供的 RT 或聲壓指標不會填為 0。",
    en: "No comparable results are available yet. Missing RT or sound pressure metrics are not filled with zero.",
  },
  "analysis.provider.unknown": {
    "zh-TW": "尚未檢查",
    en: "Not checked",
  },
  "analysis.provider.loading": {
    "zh-TW": "檢查中",
    en: "Checking",
  },
  "analysis.provider.ready": {
    "zh-TW": "可提出請求；live 驗證尚未執行",
    en: "Requests are permitted; live verification has not been run",
  },
  "analysis.provider.blocked": {
    "zh-TW": "已阻擋",
    en: "Blocked",
  },
  "analysis.provider.error": {
    "zh-TW": "檢查失敗",
    en: "Check failed",
  },
  "analysis.agent.heading": {
    "zh-TW": "由意圖到可驗證操作",
    en: "From intent to verifiable actions",
  },
  "analysis.agent.resultMeta": {
    "zh-TW": "最近結果：Meta Model API",
    en: "Latest result: Meta Model API",
  },
  "analysis.agent.resultOffline": {
    "zh-TW": "離線工具 · 非模型輸出",
    en: "Offline tools · Not model output",
  },
  "analysis.agent.resultUnavailable": {
    "zh-TW": "Meta 請求目前不可用",
    en: "Meta requests are currently unavailable",
  },
  "analysis.agent.execution": {
    "zh-TW": "執行方式",
    en: "Execution mode",
  },
  "analysis.agent.executionAria": {
    "zh-TW": "AI 執行方式",
    en: "AI execution mode",
  },
  "analysis.agent.offline": {
    "zh-TW": "離線工具（非模型）",
    en: "Offline tools (not a model)",
  },
  "analysis.agent.meta": {
    "zh-TW": "Meta Model API",
    en: "Meta Model API",
  },
  "analysis.agent.refresh": {
    "zh-TW": "重新檢查伺服器狀態",
    en: "Check server status again",
  },
  "analysis.agent.gate": {
    "zh-TW": "Meta 伺服器 gate：{status}。",
    en: "Meta server gate: {status}. ",
  },
  "analysis.agent.noServerStatus": {
    "zh-TW": "尚未取得伺服器狀態；不會自動提出模型請求。",
    en: "Server status is not available yet. No model request is sent automatically.",
  },
  "analysis.agent.prompt": {
    "zh-TW": "實驗指令",
    en: "Experiment instruction",
  },
  "analysis.agent.promptExample": {
    "zh-TW": "例如：新增一顆無重力的球，碰撞時發出電子音",
    en: "Example: ball impact audio quiet",
  },
  "analysis.agent.preparing": {
    "zh-TW": "準備操作預覽…",
    en: "Preparing action preview…",
  },
  "analysis.agent.previewAction": {
    "zh-TW": "產生操作預覽",
    en: "Generate action preview",
  },
  "analysis.agent.unavailableHelp": {
    "zh-TW":
      "Meta Model API 目前不可用；仍可切回離線工具，或使用 Inspector 手動建立場景與聲音行為。",
    en: "Meta Model API is currently unavailable. You can switch to offline tools or use the Inspector to create scenes and sound behaviors manually.",
  },
  "analysis.agent.offlineHelp": {
    "zh-TW": "目前只使用本機受限指令，不會呼叫模型。離線結果不能證明 Meta 模型整合。",
    en: "Only bounded local commands are used. No model is called. Offline results do not demonstrate Meta model integration.",
  },
  "analysis.agent.metaHelp": {
    "zh-TW":
      "只有提交指令才會提出 Meta 模型請求；費用與存取 gate 由伺服器控制。模型只提出操作，實際計算由程式執行。",
    en: "A Meta model request is sent only when you submit an instruction. The server controls spending and access gates. The model proposes actions; the application performs the calculations.",
  },
  "analysis.agent.shortcut": {
    "zh-TW": "Ctrl / ⌘ + Enter 送出；組字時不提交。",
    en: "Ctrl / ⌘ + Enter to submit. Composition input is not submitted.",
  },
  "analysis.agent.previewHeading": {
    "zh-TW": "操作預覽",
    en: "Action preview",
  },
  "analysis.agent.notApplied": {
    "zh-TW": "尚未套用",
    en: "Not applied",
  },
  "analysis.agent.validatedDiff": {
    "zh-TW": "已驗證的操作差異",
    en: "Validated action differences",
  },
  "analysis.agent.pauseAndApply": {
    "zh-TW": "暫停並套用操作",
    en: "Pause and apply actions",
  },
  "analysis.agent.apply": {
    "zh-TW": "套用操作",
    en: "Apply actions",
  },
  "analysis.agent.cancel": {
    "zh-TW": "取消預覽",
    en: "Cancel preview",
  },
  "analysis.agent.applyHelp": {
    "zh-TW":
      "套用使用同一套 Domain 驗證與可撤銷命令；不讓模型執行 JavaScript、OS 操作或改寫 Repository。",
    en: "Applying uses the same domain validation and undoable commands. The model cannot execute JavaScript, perform OS operations or modify the repository.",
  },
} as const satisfies MessageCatalog;
