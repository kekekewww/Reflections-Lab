import type { MessageCatalog } from "../locale-types.js";

/** Finite presentation translations copied from existing functional messages.
 * Dynamic diagnostics, filenames, counts, user data, and unknown codes remain
 * original technical details. No code is inferred when the read model lost it.
 */
export const statusMessages = {
  "status.recording.cleanupPending": {
    "zh-TW": "前一次錄製準備仍在清理；請稍後重試。",
    en: "The previous recording preparation is still being cleaned up. Try again shortly.",
  },
  "status.recording.captureCancelled": {
    "zh-TW": "錄製準備已取消。",
    en: "Recording preparation was cancelled.",
  },
  "status.recording.storageNotReady": {
    "zh-TW": "錄製儲存尚未就緒。",
    en: "Recording storage is not ready yet.",
  },
  "status.recording.acceptedProtected": {
    "zh-TW": "錄製已接納影格，不能丟棄完整資料。",
    en: "Recording has accepted complete frames. Stop and save them before starting again.",
  },
  "status.recording.captureTimeout": {
    "zh-TW": "錄製準備逾時；請重試。",
    en: "Recording preparation timed out. Try again.",
  },
  "status.recording.storageTimeoutRange": {
    "zh-TW": "錄製儲存準備逾時須大於 0 且不超過 10000 ms。",
    en: "Recording storage preparation requires a timeout greater than zero and no longer than 10 seconds.",
  },
  "status.recording.storageOwner": {
    "zh-TW": "錄製儲存準備已有另一個等待擁有者。",
    en: "Another operation is already preparing recording storage. Wait for it to finish.",
  },
  "status.recording.storageCancelled": {
    "zh-TW": "錄製儲存準備已取消。",
    en: "Recording storage preparation was cancelled.",
  },
  "status.recording.storageTimeout": {
    "zh-TW": "錄製儲存準備逾時。",
    en: "Recording storage preparation timed out. Try again after cleanup finishes.",
  },
  "status.recording.storageUnsupported": {
    "zh-TW": "錄製儲存不支援就緒確認。",
    en: "This recording storage cannot confirm it is ready. Recording was not started.",
  },
  "status.recording.storageFailedInterrupt": {
    "zh-TW": "錄製儲存已失敗；請先中斷目前錄製。",
    en: "Recording storage failed. Interrupt the current recording first.",
  },
  "status.recording.storageDraining": {
    "zh-TW": "錄製儲存仍在處理；降到低水位後才可繼續。",
    en: "Recording storage is still writing. You can continue once it drains to the low-water mark.",
  },
  "status.recording.storageInterruptedPrefix": {
    "zh-TW": "已保留中斷的錄製儲存前綴：{detail}；先前有效成果保留。",
    en: "The interrupted recording storage prefix was kept: {detail}. Earlier valid results are kept.",
  },
  "status.recording.preparing": { "zh-TW": "正在準備錄製…", en: "Preparing recording…" },
  "status.recording.prepareTimeout": {
    "zh-TW": "錄製評估準備逾時。",
    en: "Recording preparation timed out. Try recording again.",
  },
  "status.recording.prepareCancelled": {
    "zh-TW": "錄製評估準備已取消。",
    en: "Recording preparation was cancelled.",
  },
  "status.recording.prepareOwner": {
    "zh-TW": "另一個操作正在準備錄製評估。",
    en: "Another operation is preparing recording. Wait for it to finish or cancel it first.",
  },
  "status.recording.prepareCreateFailed": {
    "zh-TW": "錄製評估工作者建立失敗。",
    en: "The recording worker could not be created. Try recording again.",
  },
  "status.recording.prepareSendFailed": {
    "zh-TW": "錄製評估準備傳送失敗。",
    en: "Recording preparation could not be sent to the worker. Try again.",
  },
  "status.recording.prepareProtocol": {
    "zh-TW": "錄製評估準備回覆協定無效。",
    en: "The recording worker returned an invalid preparation acknowledgement. Recording was not started.",
  },
  "status.recording.prepareErrorProtocol": {
    "zh-TW": "錄製評估準備錯誤回覆無效。",
    en: "The recording worker returned an invalid preparation error. Recording was not started.",
  },
  "status.recording.prepareWorkerBusy": {
    "zh-TW": "錄製評估 Worker 正在處理工作。",
    en: "The recording worker is busy. Try recording again after the current operation.",
  },
  "status.recording.prepareRequestProtocol": {
    "zh-TW": "錄製 Worker 準備協定無效。",
    en: "The recording worker received an invalid preparation request. Recording was not started.",
  },
  "status.recording.workerFailed": {
    "zh-TW": "錄製評估 Worker 失敗。",
    en: "The recording worker failed. Stop any active recording and try again.",
  },
  "status.recording.workerMessageFailed": {
    "zh-TW": "錄製評估 Worker 回覆無法解碼。",
    en: "The recording worker reply could not be decoded.",
  },
  "status.recording.evaluationClosed": {
    "zh-TW": "錄製評估已關閉。",
    en: "Recording evaluation has been closed.",
  },
  "status.recording.evaluationBusy": {
    "zh-TW": "錄製評估已有進行中的工作。",
    en: "Recording evaluation is busy with another operation.",
  },
  "status.recording.zoneRegistryChanged": {
    "zh-TW": "區域配置變更需要fresh physics run；不能沿用原區域進出事件重評。",
    en: "Changing the zone registry requires a fresh physics run; captured zone crossings cannot be reused for reprocessing.",
  },
  "status.recording.zoneBaselineRequired": {
    "zh-TW": "區域事件重評需要原始配置以核對固定區域registry。",
    en: "Reprocessing zone events requires the original configuration to verify the fixed zone registry.",
  },
  "status.recording.emitterPolicyRequired": {
    "zh-TW": "固定或區域音源需要明確的新遮蔽政策；舊錄製仍可原樣重播，請重新錄製後比較。",
    en: "Fixed or zone emitters require an explicit current occlusion policy. Older recordings can still replay unchanged; record a new take before comparing.",
  },
  "status.recording.modelBaselineRequired": {
    "zh-TW": "曲面或動態反射重評需要相同的新模型基準；舊錄製可原樣重播，請先重新錄製再比較。",
    en: "Reprocessing curved or dynamic reflections requires a baseline with the same current model. Older recordings can replay unchanged; record a new take before comparing.",
  },
  "status.runtime.zoneRevisionConflict": {
    "zh-TW": "REVISION_CONFLICT：區域草稿已過期，請重新讀取。",
    en: "REVISION_CONFLICT: the zone draft is stale; reload it before editing.",
  },
  "status.runtime.zoneEditBlocked": {
    "zh-TW": "ZONE_EDIT_BLOCKED：請暫停並結束錄製／重播，在編輯器修改區域。",
    en: "ZONE_EDIT_BLOCKED: pause simulation, finish recording or replay, and edit zones in the editor.",
  },
  "status.runtime.zoneInUsePrefix": {
    "zh-TW": "ZONE_IN_USE：請先改選或移除引用此區域的規則：",
    en: "ZONE_IN_USE: retarget or remove the rules referencing this zone first: ",
  },
  "status.runtime.zoneInUse": {
    "zh-TW": "ZONE_IN_USE：請先改選或移除引用此區域的規則：{rules}",
    en: "ZONE_IN_USE: retarget or remove the rules referencing this zone first: {rules}",
  },
  "status.pipeline.evalPressure": {
    "zh-TW": "錄製評估佇列已滿，已在完整 tick 邊界暫停；處理後可繼續。",
    en: "The recording evaluation queue is full. Paused at a complete tick boundary; resume after it drains.",
  },
  "status.pipeline.toolRun": {
    "zh-TW": "實驗工具：有界模擬與分析",
    en: "Experiment tools: bounded simulation and analysis",
  },
  "status.pipeline.toolCompare": {
    "zh-TW": "實驗工具：相同運動比較",
    en: "Experiment tools: matched-motion comparison",
  },
  "status.pipeline.evalStale": {
    "zh-TW": "錄製已切換；不接納舊評估結果。",
    en: "The recording changed; old evaluation results are not admitted.",
  },
  "status.pipeline.evalMissing": {
    "zh-TW": "沒有可用的錄製求解器。",
    en: "No recording evaluator is available.",
  },
  "status.pipeline.evalAdmission": {
    "zh-TW": "錄製評估接納失敗。",
    en: "Recording evaluation admission failed.",
  },
  "status.pipeline.evalLowWater": {
    "zh-TW": "錄製評估仍在處理；降到低水位後才可繼續。",
    en: "Recording evaluation is still processing. Resume when the queue falls below its low-water mark.",
  },
  "status.pipeline.evalFailed": {
    "zh-TW": "錄製評估已失敗；請先停止並保存完整前綴。",
    en: "Recording evaluation failed. Stop first to preserve the complete prefix.",
  },
  "status.pipeline.evalFailureDetail": {
    "zh-TW": "錄製評估失敗；已保留完整前綴：{detail}",
    en: "Recording evaluation failed; the complete prefix was preserved: {detail}",
  },

  "status.pipeline.shortTakeCapturing": {
    "zh-TW": "短 take：由固定步進控制錄製",
    en: "Short take: recording with controlled fixed steps",
  },
  "status.pipeline.shortTakeReady": {
    "zh-TW": "短 take 已完成；可在音訊匯出產生混音與各聲源音檔。",
    en: "Short take completed. Generate the mix and source audio files in Audio export.",
  },
  "status.pipeline.shortTakePaused": {
    "zh-TW": "短 take 已完成；模擬保持暫停",
    en: "Short take completed; the simulation remains paused",
  },

  "status.scene.revision": {
    "zh-TW": "sceneRevision 必須為安全整數。",
    en: "sceneRevision must be a safe integer.",
  },
  "status.scene.duplicate": {
    "zh-TW": "{object}: 重複 domain ID。",
    en: "{object}: Duplicate domain ID.",
  },
  "status.scene.quaternion": {
    "zh-TW": "{object}: quaternion 必須為單位長度。",
    en: "{object}: Quaternion must have unit length.",
  },
  "status.scene.reference": {
    "zh-TW": "{object}: 物件參照不存在。",
    en: "{object}: Referenced object does not exist.",
  },
  "status.scene.invalid": { "zh-TW": "場景驗證失敗。", en: "Scene validation failed." },
  "status.scene.detail": {
    "zh-TW": "場景驗證失敗：{detail}",
    en: "Scene validation failed: {detail}",
  },
  "status.scene.sphere": {
    "zh-TW": "{object}: 球體三軸直徑必須相同。",
    en: "{object}: Sphere diameter must be equal on all three axes.",
  },
  "status.scene.capsule": {
    "zh-TW": "{object}: 膠囊直徑 X 與 Z 必須相同，高度 Y 必須大於或等於直徑。",
    en: "{object}: Capsule diameters X and Z must match; height Y must be at least the diameter.",
  },
  "status.code.PLACEMENT_TRANSPORT": {
    "zh-TW": "錄製（含暫停）或重播期間無法預覽或放置；請先結束錄製或返回即時場景。",
    en: "Placement preview and placement are unavailable during recording (including paused takes) or replay. Stop recording or return to the live scene first.",
  },
  "status.code.PLACEMENT_AUDIO_RESTART": {
    "zh-TW": "音訊重啟期間無法預覽或放置；請等待重啟完成。",
    en: "Placement preview and placement are unavailable while audio is restarting. Wait for the restart to finish.",
  },
  "status.code.PLACEMENT_TIMEOUT": {
    "zh-TW": "放置準備逾時，已取消；可繼續操作或重試。",
    en: "Placement preparation timed out and was cancelled. Continue operating or try again.",
  },
  "status.code.AUDIO_BUFFER_UNSAFE": {
    "zh-TW": "錄製、重播或交易進行中，無法重啟音訊；請先結束目前操作。",
    en: "Audio cannot restart during recording, replay or a pending transaction. Finish the current operation first.",
  },
  "status.code.AUDIO_BUFFER_BUSY": {
    "zh-TW": "音訊正在重啟或清理，請稍後再試。",
    en: "Audio is restarting or draining. Try again when it finishes.",
  },
  "status.code.AUDIO_BUFFER_INVALID": {
    "zh-TW": "音訊緩衝選項無效。",
    en: "Invalid audio buffer preset.",
  },
  "status.code.AUDIO_BUFFER_EXTERNAL_CONTEXT": {
    "zh-TW": "此音訊裝置由外部管理，無法在此重啟。",
    en: "This audio context is externally managed and cannot restart here.",
  },
  "status.code.AUDIO_BUFFER_RESTART_FAILED": {
    "zh-TW": "音訊重啟失敗，已安全暫停；請重新啟用聆聽。",
    en: "Audio restart failed and transport paused safely. Enable listening again.",
  },
  "status.interaction.previewRunning": {
    "zh-TW": "放置預覽需要運行中的第一人稱控制。",
    en: "Placement preview requires running first-person controls.",
  },
  "status.interaction.previewUnavailable": {
    "zh-TW": "物件預覽目前不可用。",
    en: "Object preview is currently unavailable.",
  },
  "status.interaction.placementCancelled": {
    "zh-TW": "放置已取消或場景版本已變更。",
    en: "Placement was cancelled or the scene revision changed.",
  },
  "status.interaction.ackCancelled": {
    "zh-TW": "幾何確認未完成；已取消放置。",
    en: "Geometry was not acknowledged; placement was cancelled.",
  },
  "status.interaction.placed": {
    "zh-TW": "物件已放置，可直接操作。",
    en: "Object placed and ready to interact with.",
  },
  "status.interaction.shapeSelected": {
    "zh-TW": "已選擇放置形狀；繼續後按住右鍵預覽。",
    en: "Placement shape selected. Resume, then hold the right button to preview.",
  },
  "status.interaction.paintTransport": {
    "zh-TW": "錄製或重播期間無法繪製軌跡；請先結束錄製或返回即時場景。",
    en: "A path cannot be painted during recording or replay. Stop recording or return to the live scene first.",
  },
  "status.interaction.paintNothingAimed": {
    "zh-TW": "三公尺內沒有對準的物件；請以準心對準有聲音的物件。",
    en: "Nothing is aimed at within 3 m. Aim the crosshair at an object with sound.",
  },
  "status.interaction.paintNotAudible": {
    "zh-TW": "只有有聲音的物件可以繪製軌跡；此物件沒有聲音行為或聲源。",
    en: "Only objects with sound can have a painted path. This object has no sound behavior or sound source.",
  },
  "status.interaction.takeRestarted": {
    "zh-TW": "場景已變更；物件回到起始位置，重新開始這段 take。",
    en: "The scene changed, so objects returned to the starting layout and the take restarted.",
  },
  "status.interaction.paintedBlocked": {
    "zh-TW": "這條軌跡碰到固定幾何，不會執行；回到編輯器按 T 調整。",
    en: "This path meets fixed geometry and will not run. Go back to the editor and press T to adjust it.",
  },
  "status.interaction.paintedTooLong": {
    "zh-TW": "這條軌跡以目前強度移動太久，不會執行；回到編輯器按 T 提高強度或縮短軌跡。",
    en: "This path takes too long at its Strength and will not run. Go back to the editor and press T to raise Strength or shorten the path.",
  },
  "status.interaction.paintedTooMany": {
    "zh-TW": "同一段可執行的軌跡已達上限，這條不會執行；回到編輯器清除其他物件的軌跡。",
    en: "The take already runs as many paths as it can, so this path will not run. Go back to the editor and clear another object's path.",
  },
  "status.interaction.canvasUnavailable": {
    "zh-TW": "三維畫面尚未準備好；請重試三維顯示後再進入第一人稱。",
    en: "The 3D view is not ready. Retry the 3D view before entering first person.",
  },
  "status.interaction.entryFailed": {
    "zh-TW": "無法進入第一人稱；請確認目前操作已完成後重試。",
    en: "Could not enter first person. Wait for the current operation to finish, then try again.",
  },
  "status.interaction.notStarted": {
    "zh-TW": "尚未開始第一人稱控制",
    en: "First-person controls have not started.",
  },
  "status.interaction.disposed": {
    "zh-TW": "互動控制器已清理。",
    en: "The interaction controller has been disposed.",
  },
  "status.interaction.alternativeSelected": {
    "zh-TW": "輔助操作已選用；請明確開始／繼續",
    en: "Alternative controls are selected; explicitly start or resume.",
  },
  "status.interaction.confirmLock": {
    "zh-TW": "請明確開始／繼續並確認滑鼠鎖定",
    en: "Explicitly start or resume and confirm pointer lock.",
  },
  "status.interaction.unlocked": {
    "zh-TW": "滑鼠已解鎖；明確繼續後恢復",
    en: "Pointer lock was released; explicitly resume to continue.",
  },
  "status.interaction.alternativeBoolean": {
    "zh-TW": "輔助操作設定必須為布林值。",
    en: "The alternative-control setting must be a boolean.",
  },
  "status.interaction.alternativeEnabled": {
    "zh-TW": "已選用不鎖定滑鼠的輔助操作；請明確開始／繼續",
    en: "Alternative controls without pointer lock are enabled; explicitly start or resume.",
  },
  "status.interaction.alternativeDisabled": {
    "zh-TW": "已關閉輔助操作；請取得滑鼠鎖定後明確繼續",
    en: "Alternative controls are disabled; acquire pointer lock, then explicitly resume.",
  },
  "status.interaction.inputRequired": {
    "zh-TW": "必須先進入第一人稱，並取得滑鼠鎖定或明確選用輔助操作。",
    en: "Enter first person, then acquire pointer lock or explicitly enable alternative controls.",
  },
  "status.interaction.transactionPending": {
    "zh-TW": "交易尚未完成。",
    en: "The transaction is still pending.",
  },
  "status.interaction.stagedBeforeResume": {
    "zh-TW": "請先明確啟用或取消待啟用物件，再繼續模擬。",
    en: "Explicitly enable or cancel the staged object before resuming the simulation.",
  },
  "status.interaction.heldVersionChanged": {
    "zh-TW": "持有物件的版本或幾何已變更；維持暫停，請明確釋放或回復場景。",
    en: "The held object's revision or geometry changed. The simulation remains paused; explicitly release it or restore the scene.",
  },
  "status.interaction.grabSpaceBlocked": {
    "zh-TW": "恢復抓取的目標空間受阻；維持暫停。",
    en: "The space needed to restore the grab is blocked; the simulation remains paused.",
  },
  "status.interaction.heldInvalid": {
    "zh-TW": "持有物件已失效；維持暫停，請明確釋放或回復場景。",
    en: "The held object is no longer valid. The simulation remains paused; explicitly release it or restore the scene.",
  },
  "status.interaction.supportInvalid": {
    "zh-TW": "輕放支撐已失效；已取消輕放並保留持有，請重新確認後繼續。",
    en: "The drop support is no longer valid. The drop was cancelled and the object remains held; check it again before resuming.",
  },
  "status.interaction.placementPending": {
    "zh-TW": "放置交易尚未完成。",
    en: "The placement transaction is still pending.",
  },
  "status.interaction.resumeValidationFailed": {
    "zh-TW": "恢復前的物理驗證失敗",
    en: "Physics validation failed before resuming.",
  },
  "status.interaction.paused": { "zh-TW": "已暫停", en: "Paused." },
  "status.interaction.exited": {
    "zh-TW": "已離開第一人稱；持有／預覽狀態保留",
    en: "Exited first person; the held-object and preview states are preserved.",
  },
  "status.interaction.releaseBeforeBuild": {
    "zh-TW": "持有物件時不能切換建造；請明確釋放或輕放。",
    en: "Release or gently drop the held object before switching to build mode.",
  },
  "status.interaction.uiFocus": {
    "zh-TW": "已切換至介面焦點",
    en: "Focus moved to the interface.",
  },
  "status.interaction.userPaused": {
    "zh-TW": "使用者暫停第一人稱",
    en: "First-person controls were paused by the user.",
  },
  "status.interaction.libraryOpen": {
    "zh-TW": "物件資料庫已開啟",
    en: "The object library is open.",
  },
  "status.interaction.invalidButton": { "zh-TW": "無效滑鼠按鈕。", en: "Invalid mouse button." },
  "status.interaction.grabNeedsActive": {
    "zh-TW": "抓取需要正在運行的第一人稱互動模式。",
    en: "Grabbing requires running first-person interaction mode.",
  },
  "status.interaction.alreadyHeld": { "zh-TW": "已有持有物件。", en: "An object is already held." },
  "status.interaction.noGrabHit": {
    "zh-TW": "三公尺內沒有可抓取物件。",
    en: "No grabbable object is within 3 m.",
  },
  "status.interaction.hitNotGrabbable": {
    "zh-TW": "第一個命中物件已固定、受控或超過抓取預算。",
    en: "The first hit object is fixed, controlled, or exceeds the grab budget.",
  },
  "status.interaction.objectRemoved": {
    "zh-TW": "物件已移除。",
    en: "The object has been removed.",
  },
  "status.interaction.objectTooLarge": {
    "zh-TW": "物件太大，沒有合法持有距離。",
    en: "The object is too large for a valid holding distance.",
  },
  "status.interaction.throwNeedsActive": {
    "zh-TW": "投擲需要運行中的第一人稱互動。",
    en: "Throwing requires running first-person interaction.",
  },
  "status.interaction.dropNeedsHeld": {
    "zh-TW": "輕放需要正在持有物件。",
    en: "A gentle drop requires a held object.",
  },
  "status.interaction.noSupport": {
    "zh-TW": "沒有合法支撐面；仍維持持有，未自動釋放。",
    en: "No valid support surface was found. The object remains held and was not released automatically.",
  },
  "status.interaction.dropBlocked": {
    "zh-TW": "輕放位置受阻；仍維持持有。",
    en: "The drop position is blocked; the object remains held.",
  },
  "status.interaction.dropping": { "zh-TW": "正在低速輕放", en: "Gently dropping at low speed." },
  "status.interaction.noFreezeTarget": {
    "zh-TW": "沒有明確固定／解除目標。",
    en: "No explicit object was selected to freeze or unfreeze.",
  },
  "status.interaction.noPreviousGravity": {
    "zh-TW": "沒有此物件版本的先前重力模式；請在Inspector明確選擇。",
    en: "No previous gravity mode is available for this object revision; select one explicitly in the Inspector.",
  },
  "status.interaction.controlledObject": {
    "zh-TW": "受控運動物件需先在Inspector明確解除控制。",
    en: "Explicitly remove kinematic control in the Inspector first.",
  },
  "status.interaction.freezing": { "zh-TW": "正在固定物件", en: "Freezing the object." },
  "status.interaction.unfreezing": {
    "zh-TW": "正在解除固定，速度預設為零",
    en: "Unfreezing the object with zero initial velocity.",
  },
  "status.interaction.unfreezeWorldChanged": {
    "zh-TW": "解除固定的物理世界已變更。",
    en: "The physics world changed during unfreezing.",
  },
  "status.interaction.unfreezeObjectRemoved": {
    "zh-TW": "解除固定的物件已移除。",
    en: "The object being unfrozen was removed.",
  },
  "status.interaction.unfreezeObjectChanged": {
    "zh-TW": "解除固定的物件版本或模式已變更。",
    en: "The object revision or mode changed during unfreezing.",
  },
  "status.interaction.unfreezeSceneBefore": {
    "zh-TW": "解除固定前的場景版本已變更。",
    en: "The scene revision changed before unfreezing.",
  },
  "status.interaction.unfreezeBlocked": {
    "zh-TW": "解除固定位置受阻；物件保持固定，可清除障礙後重試。",
    en: "The unfreeze position is blocked. The object remains fixed; clear the obstruction and retry.",
  },
  "status.interaction.unfreezeSceneAfter": {
    "zh-TW": "解除固定後的場景版本已變更。",
    en: "The scene revision changed after unfreezing.",
  },
  "status.interaction.frozen": {
    "zh-TW": "已固定；另按繼續才恢復模擬",
    en: "The object is fixed; explicitly resume to continue the simulation.",
  },
  "status.interaction.unfrozen": {
    "zh-TW": "已解除固定，初速為零；另按繼續",
    en: "The object is unfrozen with zero initial velocity; explicitly resume.",
  },
  "status.interaction.releaseFirst": {
    "zh-TW": "請先明確釋放持有物件。",
    en: "Explicitly release the held object first.",
  },
  "status.interaction.finishPlacement": {
    "zh-TW": "請先完成或取消目前放置。",
    en: "Complete or cancel the current placement first.",
  },
  "status.interaction.newStableId": {
    "zh-TW": "預覽必須使用新的穩定物件ID。",
    en: "The preview must use a new stable object ID.",
  },
  "status.interaction.awaitingSurface": {
    "zh-TW": "尚未取得表面",
    en: "No surface has been acquired yet.",
  },
  "status.interaction.placementOutOfBounds": {
    "zh-TW": "放置位置超出範圍",
    en: "The placement position is outside the allowed bounds.",
  },
  "status.interaction.placeable": { "zh-TW": "可放置", en: "Valid placement." },
  "status.interaction.noPlacementSurface": {
    "zh-TW": "沒有可放置表面",
    en: "No placement surface is available.",
  },
  "status.interaction.stageCreating": {
    "zh-TW": "放置確認：已安全暫停，建立待啟用物件",
    en: "Placement confirmed: safely paused while creating a staged object.",
  },
  "status.interaction.stagedCreated": {
    "zh-TW": "已建立待啟用物件；幾何確認後需明確啟用，再另按繼續。",
    en: "The staged object was created. After geometry confirmation, explicitly enable it, then resume separately.",
  },
  "status.interaction.geometryInvalid": {
    "zh-TW": "幾何確認的物件／版本已失效。",
    en: "The object or revision used for geometry confirmation is no longer valid.",
  },
  "status.interaction.geometryPending": {
    "zh-TW": "尚待聲學幾何確認，不能啟用。",
    en: "Waiting for acoustic geometry confirmation; the object cannot be enabled yet.",
  },
  "status.interaction.stagedChanged": {
    "zh-TW": "待啟用物件或場景版本已變更，請重新確認。",
    en: "The staged object or scene revision changed; confirm it again.",
  },
  "status.interaction.stagedOccupied": {
    "zh-TW": "待啟用位置已被占用。",
    en: "The staged object's position is now occupied.",
  },
  "status.interaction.enabled": {
    "zh-TW": "物件已啟用；模擬仍暫停，另按繼續。",
    en: "The object is enabled. The simulation remains paused; resume separately.",
  },
  "status.interaction.dropCancelledHeld": {
    "zh-TW": "輕放支撐或空間已失效；已取消輕放，仍維持持有。",
    en: "The drop support or space is no longer valid. The drop was cancelled and the object remains held.",
  },
  "status.runtime.providerNotQueried": {
    "zh-TW": "尚未查詢本機Meta provider狀態；未呼叫模型。",
    en: "The local Meta provider status has not been checked; no model has been called.",
  },
  "status.runtime.initialNotice": {
    "zh-TW": "選取物件編輯聲音行為；啟用聆聽後才建立音訊裝置。所有材質為 Synthetic 示範。",
    en: "Select an object to edit its sound behavior. The audio device is created only after enabling listening. All materials are Synthetic demonstrations.",
  },
  "status.runtime.userPaused": { "zh-TW": "使用者暫停", en: "Paused by the user." },
  "status.runtime.authoringInterrupted": {
    "zh-TW": "作者資料變更中斷目前錄製",
    en: "Authoring changes interrupted the current recording.",
  },
  "status.runtime.authoringPaused": {
    "zh-TW": "作者編輯：暫停並清理舊聲音",
    en: "Authoring edit: paused and cleared previous sounds.",
  },
  "status.runtime.gravityCheck": {
    "zh-TW": "重力模式已套用；恢復前需重新確認抓取／碰撞空間。",
    en: "The gravity mode was applied. Recheck the grab and collision space before resuming.",
  },
  "status.runtime.gravityInterrupted": {
    "zh-TW": "重力模式已變更，原錄製以中斷狀態封存；持續聲源及游標保留。",
    en: "The gravity mode changed and the original recording was archived as interrupted. Continuous sources and playback cursors are preserved.",
  },
  "status.runtime.gravityChanged": {
    "zh-TW": "重力模式已變更；持續聲源、動量及播放游標保留。",
    en: "The gravity mode changed. Continuous sources, momentum, and playback cursors are preserved.",
  },
  "status.runtime.soundRevisionConflict": {
    "zh-TW": "REVISION_CONFLICT：聲音配置已有後續變更，拒絕覆蓋。",
    en: "REVISION_CONFLICT: the sound configuration has newer changes and will not be overwritten.",
  },
  "status.runtime.replayEnded": {
    "zh-TW": "重播已結束並暫停音訊；可重播或返回即時場景。",
    en: "Replay ended and audio was paused. Replay again or return to the live scene.",
  },
  "status.runtime.fixedStepOverrun": {
    "zh-TW": "固定步負載超限，已暫停；未丟棄錄製 tick",
    en: "The fixed-step workload limit was exceeded. Recording is paused; no recording ticks were discarded.",
  },
  "status.runtime.recordingDebtRetained": {
    "zh-TW": "錄製已暫停並保留固定步欠帳；可繼續逐批處理，或明確停止並封存目前連續資料。",
    en: "Recording is paused with its fixed-step backlog retained. Resume processing in batches, or explicitly stop and archive the contiguous data captured so far.",
  },
  "status.runtime.acceptedInteraction": {
    "zh-TW": "Rapier／已接受互動事件",
    en: "Rapier / accepted interaction event",
  },
  "status.runtime.acousticStale": {
    "zh-TW": "聲學結果已超過3個固定步（20Hz更新窗口）；保留舊結果並標示過期，等待新解。",
    en: "The acoustic result is more than 3 fixed steps old (the 20 Hz update window). The previous result is retained and marked stale while awaiting a new solution.",
  },
  "status.runtime.projectMissingRecordings": {
    "zh-TW": "專案已載入；部分錄製原始資料不在此瀏覽器，保留hash參照，未宣稱可重播。",
    en: "The project loaded, but some original recording data is not in this browser. Hash references are retained; replay availability is not claimed.",
  },
  "status.runtime.focusLost": {
    "zh-TW": "失去焦點／輸入所有權",
    en: "Focus or input ownership was lost.",
  },
  "status.runtime.busy": {
    "zh-TW": "TRANSACTION_BUSY：請等待目前操作完成",
    en: "TRANSACTION_BUSY: wait for the current operation to finish.",
  },
  "status.runtime.workspacePaused": {
    "zh-TW": "工作區切換：FPS互動安全暫停",
    en: "Workspace changed: first-person interaction was safely paused.",
  },
  "status.runtime.previewNotExperiment": {
    "zh-TW": "素材預聽；不屬於3D實驗結果。",
    en: "Asset preview; this is not a 3D experiment result.",
  },
  "status.runtime.stopReplayFirst": {
    "zh-TW": "STOP_REPLAY_REQUIRED：請先返回即時場景再錄製",
    en: "STOP_REPLAY_REQUIRED: return to the live scene before recording.",
  },
  "status.runtime.recordedTrajectory": {
    "zh-TW": "已錄軌跡重播，未重新模擬物理",
    en: "Replaying the recorded trajectory; physics is not being simulated again.",
  },
  "status.runtime.replayPhysics": {
    "zh-TW": "重播已錄物理軌跡；未重新執行Rapier",
    en: "Replaying recorded physics trajectories; Rapier is not being run again.",
  },
  "status.runtime.liveSceneRestored": {
    "zh-TW": "已返回暫停的即時場景；繼續時恢復原來源游標，不重發舊事件。",
    en: "Returned to the paused live scene. Resuming restores the original source cursors without emitting old events again.",
  },
  "status.runtime.seekTailCut": {
    "zh-TW": "Seek已截斷舊尾音；按繼續從保存的來源游標重播，不重發舊撞擊。",
    en: "Seek cut off the previous sound tail. Resume from the saved source cursors; old impacts are not emitted again.",
  },
  "status.runtime.comparisonSnapshot": {
    "zh-TW": "建立同運動比較快照",
    en: "Creating a comparison snapshot with the same motion.",
  },
  "status.runtime.listenerRestored": {
    "zh-TW": "已還原原本的 ScenePinned Listener；觀察相機不改變量測位置。",
    en: "The original ScenePinned Listener was restored. The observation camera does not change the measurement position.",
  },
  "status.runtime.savedBrowser": {
    "zh-TW": "已儲存專案、可用音檔與已完成錄製至本機瀏覽器；跨裝置需另外攜帶原檔。",
    en: "The project, available audio files, and completed recordings were saved in this browser. Transfer the original files separately to use them on another device.",
  },
  "status.runtime.savedMemory": {
    "zh-TW": "已儲存專案；此環境的音檔與錄製為記憶體保存，關閉後需重新匯入。",
    en: "The project was saved. Audio files and recordings are stored in memory in this environment and must be imported again after closing.",
  },
  "status.runtime.noRecording": {
    "zh-TW": "NO_RECORDING：請先完成一次錄製",
    en: "NO_RECORDING: complete a recording first.",
  },
  "status.runtime.frameHint": {
    "zh-TW": "使用Viewport的對準控制移動觀察相機，不改Listener。",
    en: "Use the Viewport framing control to move the observation camera without changing the Listener.",
  },
  "status.runtime.listeningEnabled": {
    "zh-TW": "已啟用低音量監聽；請依實際裝置調整。dBFS未校準為dB SPL。",
    en: "Low-level monitoring is enabled. Adjust it for your actual device. dBFS has not been calibrated to dB SPL.",
  },
  "status.runtime.providerLoading": {
    "zh-TW": "查詢本機設定；沒有模型呼叫。",
    en: "Checking the local configuration; no model is being called.",
  },
  "status.runtime.localApiUnavailable": {
    "zh-TW": "本機API不可用；未呼叫模型。",
    en: "The local API is unavailable; no model was called.",
  },
  "status.runtime.errorPaused": { "zh-TW": "錯誤後安全暫停", en: "Safely paused after an error." },
  "status.runtime.disposed": {
    "zh-TW": "DISPOSED：工作台已卸載，取消提交。",
    en: "DISPOSED: the workspace was unmounted and the submission was cancelled.",
  },
  "status.runtime.offlineMode": {
    "zh-TW": "離線工具模式；沒有Meta模型呼叫。",
    en: "Offline tools mode; no Meta model is being called.",
  },
  "status.runtime.recordFirst": {
    "zh-TW": "先錄製同一物理軌跡",
    en: "Record the same physics trajectory first.",
  },
  "status.runtime.acousticModel": {
    "zh-TW": "Numerical approximation · 一階有限面／零相位幅度",
    en: "Numerical approximation · first-order finite surfaces / zero-phase magnitude",
  },
  "status.runtime.directDelay": { "zh-TW": "直達延遲", en: "Direct-path delay" },
  "status.runtime.vacuumNoAir": {
    "zh-TW": "真空沒有空氣傳播",
    en: "There is no airborne propagation in a vacuum.",
  },
  "status.runtime.distanceOverC": { "zh-TW": "幾何距離/c", en: "Geometric distance / c" },
  "status.runtime.noDecayFit": {
    "zh-TW": "未產生完整IR，無可擬合衰減",
    en: "No complete IR was generated, so no decay can be fitted.",
  },
  "status.runtime.stagedReason": {
    "zh-TW": "Staged；確認後才啟用物理",
    en: "Staged; physics is enabled only after confirmation.",
  },
  "status.recording.hostBusy": {
    "zh-TW": "錄製／比較操作仍在完成；請等待目前操作。",
    en: "A recording or comparison operation is still finishing; wait for it to complete.",
  },
  "status.recording.cancelled": {
    "zh-TW": "操作已中斷；沒有發布不完整結果。",
    en: "The operation was interrupted; no incomplete result was published.",
  },
  "status.recording.invalidRunId": {
    "zh-TW": "主程式提供的 run ID 無效。",
    en: "The application supplied an invalid run ID.",
  },
  "status.recording.failed": { "zh-TW": "錄製操作失敗。", en: "The recording operation failed." },
  "status.recording.finishFirst": {
    "zh-TW": "請先完成或中斷目前錄製。",
    en: "Finish or interrupt the current recording first.",
  },
  "status.recording.frameFailed": {
    "zh-TW": "錄製 frame 失敗。",
    en: "Recording the frame failed.",
  },
  "status.recording.nothingToFinish": {
    "zh-TW": "目前沒有錄製可以完成。",
    en: "There is no active recording to finish.",
  },
  "status.recording.sealing": {
    "zh-TW": "錄製快照正在封存；完成後再重設。",
    en: "The recording snapshot is being archived; wait until it finishes before resetting.",
  },
  "status.recording.finishBeforeReplay": {
    "zh-TW": "錄製完成後才可重播。",
    en: "Replay is available only after recording finishes.",
  },
  "status.recording.noReplay": {
    "zh-TW": "尚無可重播的錄製。",
    en: "No replayable recording is available.",
  },
  "status.recording.openReplay": {
    "zh-TW": "請先開啟錄製重播。",
    en: "Open a recording replay first.",
  },
  "status.recording.baselineCaptured": {
    "zh-TW": "A 必須來自完整錄製。",
    en: "A must come from a complete recording.",
  },
  "status.recording.invalidSlot": {
    "zh-TW": "比較欄位必須是 A 或 B。",
    en: "The comparison slot must be A or B.",
  },
  "status.recording.finishBeforeB": {
    "zh-TW": "請先完成錄製，才可重評 B。",
    en: "Finish recording before re-evaluating B.",
  },
  "status.recording.saveAFirst": { "zh-TW": "請先保存 A 錄製。", en: "Save recording A first." },
  "status.recording.noProcessor": {
    "zh-TW": "未提供實際 Behavior／聲學重評器，不能建立 B。",
    en: "No actual behavior or acoustic reprocessor was provided; B cannot be created.",
  },
  "status.recording.configurationMismatch": {
    "zh-TW":
      "固定步、取樣率、backend／physics version 或額外幾何／物理設定改變；不可假定相同實驗。",
    en: "The fixed step, sample rate, backend or physics version, or extra geometry or physics settings changed. These cannot be assumed to be the same experiment.",
  },
  "status.recording.bothSlotsRequired": {
    "zh-TW": "A 與 B 都完成後才能比較。",
    en: "Complete both A and B before comparing them.",
  },
  "status.recording.stopFirst": {
    "zh-TW": "請先停止目前錄製或重播。",
    en: "Stop the current recording or replay first.",
  },
  "status.recording.comparisonInitial": {
    "zh-TW": "先錄製，再保存 A；修改設定後重評 B。",
    en: "Record first and save A; change the settings, then re-evaluate B.",
  },
  "status.recording.comparisonPending": {
    "zh-TW": "正在以 A 的相同運動／事件重評 B…",
    en: "Re-evaluating B with the same motion and events as A…",
  },
  "status.recording.behaviorCompatible": {
    "zh-TW": "behavior A/B：固定條件相符。",
    en: "Behavior A/B: the fixed conditions match.",
  },
  "status.recording.acousticCompatible": {
    "zh-TW": "acoustic A/B：固定條件相符。",
    en: "Acoustic A/B: the fixed conditions match.",
  },
  "status.recording.bReady": {
    "zh-TW": "B 已重評；等待核對比較條件。",
    en: "B has been re-evaluated; waiting to check the comparison conditions.",
  },
  "status.recording.aReady": {
    "zh-TW": "A 已保存；B 將重用同一運動／事件 trace。",
    en: "A is saved; B will reuse the same motion and event trace.",
  },
  "status.agent.provenanceInvalid": {
    "zh-TW": "Planner來源與請求模式不符，或缺少實際模型／response ID；尚無可驗證的Meta live結果。",
    en: "The planner provenance does not match the request mode, or the actual model or response ID is missing. There is no verifiable Meta live result.",
  },
  "status.agent.completed": {
    "zh-TW": "已完成（Host回傳）",
    en: "Completed (reported by the Host)",
  },
  "status.agent.pending": { "zh-TW": "尚未完成", en: "Not yet completed" },
  "status.agent.blocked": { "zh-TW": "無法執行", en: "Cannot execute" },
  "status.agent.failed": { "zh-TW": "執行失敗", en: "Execution failed" },
  "status.agent.unknown": { "zh-TW": "尚未確認結果", en: "The result is not yet confirmed" },
  "status.agent.offlineAvailable": {
    "zh-TW": "離線指令示範可用；未使用Meta模型或額度。",
    en: "The offline command demonstration is available; no Meta model or budget was used.",
  },
  "status.agent.operationFailed": {
    "zh-TW": "操作失敗，場景未被確認為成功。",
    en: "The operation failed; a successful scene change was not confirmed.",
  },
  "status.agent.sessionTurnLimit": {
    "zh-TW": "本次Agent session已達12回合或120秒上限，請建立新session。",
    en: "This Agent session reached its limit of 12 turns or 120 seconds; start a new session.",
  },
  "status.agent.sessionToolLimit": {
    "zh-TW": "本次Agent session已達48工具或6次模擬上限。",
    en: "This Agent session reached its limit of 48 tools or 6 simulations.",
  },
  "status.agent.mixedProposal": {
    "zh-TW": "不能在同一提案混合場景變更與實驗執行。",
    en: "A single proposal cannot mix scene changes with experiment execution.",
  },
  "status.agent.hostResultMissing": {
    "zh-TW": "Host未回傳可確認的工具結果。",
    en: "The Host did not return a confirmable tool result.",
  },
  "status.agent.parsingOffline": {
    "zh-TW": "本機解析與驗證提案中；沒有模型呼叫。",
    en: "Parsing and validating the proposal locally; no model is being called.",
  },
  "status.agent.checkingProvider": {
    "zh-TW": "檢查本機Meta provider gate。",
    en: "Checking the local Meta provider gate.",
  },
  "status.agent.museWorking": {
    "zh-TW": "Muse正在規劃提案，通常需要10–60秒；場景尚未變更。",
    en: "Muse is working on a proposal. This usually takes 10–60 seconds, and nothing has changed yet.",
  },
  "status.agent.proposalTooLong": {
    "zh-TW": "PROPOSAL_TOO_LONG：Muse的提案過長而被截斷，沒有可用內容；請縮小要求或分次提出。",
    en: "Muse's proposal was too long and got cut off, so none of it can be used. Ask for less, or split it into steps. [PROPOSAL_TOO_LONG]",
  },
  "status.preview.moveListener": {
    "zh-TW": "移動正式Listener；編輯camera保持獨立。",
    en: "Move the listener. The editor camera stays separate.",
  },
  "status.preview.replaceWarning": {
    "zh-TW": "此操作替換現有物件與聲源；套用前請檢查，Undo可回復Scene。",
    en: "This replaces the current objects and sound sources. Check before applying; Undo can restore the scene.",
  },
  "status.preview.motionAuthored": {
    "zh-TW": "Motion is authored only; starting it requires an explicit local run action.",
    en: "The path is saved but not playing. Press play in the Motion tab to run it.",
  },
  "status.agent.proposalRejected": {
    "zh-TW": "PROPOSAL_REJECTED：Muse修正後仍未通過驗證：{detail}",
    en: "Muse's corrected proposal still failed validation: {detail} [PROPOSAL_REJECTED]",
  },
  "status.preview.add": {
    "zh-TW": "新增 {id}：{shape}／{mode}",
    en: "Add {id}: {shape}, {mode}",
  },
  "status.preview.move": {
    "zh-TW": "移動 {id} 到 [{position}]",
    en: "Move {id} to [{position}]",
  },
  "status.preview.resize": {
    "zh-TW": "調整 {id} 尺寸為 {size} m",
    en: "Resize {id} to {size} m",
  },
  "status.preview.removeWithBoth": {
    "zh-TW": "移除 {id}；一併移除聲源 {sources}；一併移除路徑 {paths}",
    en: "Remove {id}, with its sound sources {sources} and paths {paths}",
  },
  "status.preview.removeWithSources": {
    "zh-TW": "移除 {id}；一併移除聲源 {sources}",
    en: "Remove {id}, with its sound sources {sources}",
  },
  "status.preview.removeWithPaths": {
    "zh-TW": "移除 {id}；一併移除路徑 {paths}",
    en: "Remove {id}, with its paths {paths}",
  },
  "status.preview.remove": {
    "zh-TW": "移除 {id}",
    en: "Remove {id}",
  },
  "status.preview.material": {
    "zh-TW": "變更 {id} 的{scope}材質為 {material}",
    en: "Set {id} material ({scope}) to {material}",
  },
  "status.preview.mode": {
    "zh-TW": "將 {id} 設為 {mode}（速度歸零）",
    en: "Set {id} to {mode}, with velocity zero",
  },
  "status.preview.source": {
    "zh-TW": "設定 {id} 聲源 {source}：{signal}／{mode}；非量測振動聲",
    en: "Set sound source {source} on {id}: {signal}, {mode}. This isn't measured vibration sound.",
  },
  "status.preview.roomWithPaths": {
    "zh-TW": "建立固定六面房間 {size} m；{material}；一併移除路徑 {paths}",
    en: "Create a six-sided room, {size} m, {material}, and remove the paths {paths}",
  },
  "status.preview.room": {
    "zh-TW": "建立固定六面房間 {size} m；{material}",
    en: "Create a six-sided room, {size} m, {material}",
  },
  "status.preview.surfaceWarning": {
    "zh-TW": "此操作變更房間表面 {id}，會影響聲學與物理；套用前請檢查。",
    en: "This changes the room surface {id}, which affects acoustics and physics. Check before applying.",
  },
  "status.preview.movedPathWarning": {
    "zh-TW": "{id} 已有路徑，起點不再符合新位置；需要新的路徑才能播放。",
    en: "{id} already has a path, and it no longer starts at the new position. It needs a new path before it can play.",
  },
  "status.preview.motionLine": {
    "zh-TW": "Motion {action}: {count} samples / {seconds} s",
    en: "Path {action}: {count} points over {seconds} s",
  },
  "status.agent.metaProposed": {
    "zh-TW": "Meta提出受限工具，尚待本地預覽與人員套用。",
    en: "Muse's proposal is ready below. Nothing changes until you apply it.",
  },
  "status.agent.metaProposedNothing": {
    "zh-TW": "Meta未提出可驗證操作，場景未變更。",
    en: "Muse didn't propose any changes, so the scene is unchanged.",
  },
  "status.agent.acousticBudget": {
    "zh-TW":
      "ACOUSTIC_BUDGET：這個提案會讓場景有 {count} 個聲學面，超過上限 {limit}，聲音會因此停止；每個方塊算 6 面，球體與膠囊算 1 面。請減少物件。",
    en: "This proposal would give the scene {count} acoustic surfaces, over the limit of {limit}, and the sound would stop. Each box counts as 6 and each sphere or capsule as 1. Use fewer objects. [ACOUSTIC_BUDGET]",
  },
  "status.agent.soundCreative": {
    "zh-TW": "聲音參數為創意設定，不代表量測聲壓或物件真實振動。",
    en: "Sound settings are creative choices; they do not represent measured sound pressure or real object vibration.",
  },
  "status.agent.soundServerScope": {
    "zh-TW": "Server驗證只涵蓋提供的snapshot；必須由本機Sound Host重新驗證並預覽。",
    en: "The server check covers only the snapshot it received; the local Sound Host validates and previews it again.",
  },
  "status.template.agentMetaSound": {
    "zh-TW": "Meta Sound提案：{count}個受限操作，等待本機Host預覽與套用。",
    en: "Meta Sound proposal: {count} bounded actions, waiting for local Host preview and Apply.",
  },
  "status.template.agentLocalSound": {
    "zh-TW": "本機Sound提案：{object} → {trigger}；等待預覽與套用。",
    en: "Local sound proposal: {object} → {trigger}; waiting for preview and Apply.",
  },
  "status.template.agentRemoveBinding": {
    "zh-TW": "解除Binding {binding}",
    en: "Remove binding {binding}",
  },
  "status.template.agentBind": {
    "zh-TW": "將 {object} 綁定至 {profile}",
    en: "Bind {object} to {profile}",
  },
  "status.template.agentOverridePitch": {
    "zh-TW": "Binding覆寫 {object} {rule}：音高 {semitones} 半音",
    en: "{object} · {rule}: pitch {semitones} semitones",
  },
  "status.template.agentOverrideGain": {
    "zh-TW": "Binding覆寫 {object} {rule}：增益 ×{gain}",
    en: "{object} · {rule}: gain ×{gain}",
  },
  "status.template.agentOverrideOn": {
    "zh-TW": "Binding覆寫 {object} {rule}：啟用",
    en: "{object} · {rule}: enabled",
  },
  "status.template.agentOverrideOff": {
    "zh-TW": "Binding覆寫 {object} {rule}：停用",
    en: "{object} · {rule}: disabled",
  },
  "status.agent.applied": {
    "zh-TW": "提案已由Host套用並建立新revision；可使用復原。",
    en: "The Host applied the proposal and created a new revision; Undo is available.",
  },
  "status.agent.cancelled": {
    "zh-TW": "提案已取消，沒有套用變更。",
    en: "The proposal was cancelled; no changes were applied.",
  },
  "status.agent.undone": {
    "zh-TW": "已復原提案並建立新revision；已播放的聲音不會倒轉。",
    en: "The proposal was undone and a new revision was created. Sounds that already played are not reversed.",
  },
  "status.recovery.unsafe": {
    "zh-TW": "RECOVERY_UNSAFE：請先暫停，並結束錄製、重播與其他操作。",
    en: "RECOVERY_UNSAFE: Pause first and finish capture, replay and other operations.",
  },
  "status.recovery.active": {
    "zh-TW": "RECOVERY_ACTIVE：這份錄製仍由其他工作階段使用。",
    en: "RECOVERY_ACTIVE: This recording is still in use by another session.",
  },
  "status.recovery.missing": {
    "zh-TW": "RECOVERY_MISSING：找不到這份中斷錄製。",
    en: "RECOVERY_MISSING: This interrupted recording could not be found.",
  },
  "status.recovery.empty": {
    "zh-TW": "RECOVERY_EMPTY：這份錄製尚無可復原的完整影格。",
    en: "RECOVERY_EMPTY: This recording has no complete persisted frames to recover.",
  },
  "status.recovery.identity": {
    "zh-TW": "RECOVERY_IDENTITY：復原資料的來源與所選記錄不符。",
    en: "RECOVERY_IDENTITY: The recovery data source does not match the selected recording.",
  },
  "status.recovery.state": {
    "zh-TW": "RECOVERY_STATE：只能載入已驗證的中斷錄製。",
    en: "RECOVERY_STATE: Only a verified interrupted recording can be loaded.",
  },
  "status.template.policyDenied": {
    "zh-TW": "POLICY_DENIED：{detail}",
    en: "POLICY_DENIED: {detail}",
  },
  "status.template.providerRequestFailed": {
    "zh-TW": "PROVIDER_REQUEST_FAILED：{detail}",
    en: "PROVIDER_REQUEST_FAILED: {detail}",
  },
  "status.client.metaCredential": {
    "zh-TW": "Meta回覆含禁止的credential資料，未接受或保存內容。",
    en: "The Meta response contains forbidden credential data. Its content was not accepted or saved.",
  },
  "status.client.metaEnvelope": {
    "zh-TW": "Meta回覆缺失、拒絕或角色無效，未套用變更。",
    en: "The Meta response is missing, refused, or has an invalid role. No changes were applied.",
  },
  "status.client.metaIncomplete": {
    "zh-TW": "Meta回覆未完整完成，未接受提案。",
    en: "The Meta response did not finish completely. No proposal was accepted.",
  },
  "status.client.metaUtf8": {
    "zh-TW": "Meta回覆不是有效UTF-8，未接受內容。",
    en: "The Meta response is not valid UTF-8. Its content was not accepted.",
  },
  "status.client.incompleteJson": {
    "zh-TW": "本機API未回傳完整JSON；尚未接受提案。",
    en: "The local API did not return complete JSON; no proposal has been accepted.",
  },
  "status.client.unavailable": {
    "zh-TW": "Planner暫時不可用，手動操作仍可使用。",
    en: "The planner is temporarily unavailable; manual editing remains available.",
  },
  "status.client.schemaInvalid": {
    "zh-TW": "本機API回傳格式無效；尚未接受提案或provider狀態。",
    en: "The local API response format is invalid; no proposal or provider status has been accepted.",
  },
  "status.client.providerSchemaInvalid": {
    "zh-TW": "Provider狀態格式不符；尚無可用的live能力證據。",
    en: "The provider status format is invalid; there is no usable live-capability evidence.",
  },
  "status.offline.inputLimit": {
    "zh-TW": "請輸入1–4000字的指令。",
    en: "Enter a command containing 1–4000 characters.",
  },
  "status.offline.materialRegistryMissing": {
    "zh-TW": "材質registry尚未提供。",
    en: "The material registry is not available.",
  },
  "status.offline.deterministic": {
    "zh-TW": "此為本機確定性指令示範，不是Meta模型輸出。",
    en: "This is a local deterministic command demonstration, not Meta model output.",
  },
  "status.offline.defaultAssumptions": {
    "zh-TW": "未指定尺寸／位置使用可在預覽修改的系統預設。",
    en: "Unspecified dimensions and positions use system defaults that can be changed in the preview.",
  },
  "status.offline.noOsPermissions": {
    "zh-TW": "這項要求超出場景／實驗工具權限；不會執行OS、程式或變更權限。",
    en: "This request exceeds scene and experiment tool permissions; it will not run the OS or programs or change permissions.",
  },
  "status.offline.outOfScope": {
    "zh-TW": "要求超出允許工具範圍，場景未變更。",
    en: "The request exceeds the allowed tool scope; the scene was not changed.",
  },
  "status.offline.objectLimit": {
    "zh-TW": "離線示範每次最多建立8個物件，請分批預覽。",
    en: "The offline demonstration can create up to 8 objects at a time; preview them in batches.",
  },
  "status.offline.unrecognized": {
    "zh-TW": "離線指令示範尚未辨識這項要求；請使用Inspector，或輸入「新增一顆無重力發聲球」。",
    en: "The offline command demonstration did not recognize this request. Use the Inspector, or try “add a no gravity sound ball”.",
  },
  "status.offline.interactionWarning": {
    "zh-TW":
      "離線解析器只提出明示的物件／聲源設定；互動trigger需在Sound Behavior Inspector確認，不把速度當Throw。",
    en: "The offline parser proposes only explicit object and source settings. Confirm interaction triggers in the Sound Behavior Inspector; speed is not treated as Throw.",
  },
  "status.offline.noMatchingAudio": {
    "zh-TW": "Registry沒有精確匹配的音檔；不會捏造或下載。可用聲源明示為系統示範訊號。",
    en: "The registry has no exact audio-file match; none will be invented or downloaded. Available sources are explicitly identified as system demonstration signals.",
  },
  "status.offline.noApprovedSignal": {
    "zh-TW": "尚無授權訊號，提案只建立物件，不假裝已設定音效。",
    en: "No approved signal is available. The proposal creates only an object and does not claim that a sound effect was configured.",
  },
  "status.offline.noOperations": {
    "zh-TW": "尚未產生可套用操作。",
    en: "No applicable operations have been produced.",
  },
  "status.sound.inputLimit": {
    "zh-TW": "聲音要求必須為1–4000字。",
    en: "A sound request must contain 1–4000 characters.",
  },
  "status.sound.noPermissions": {
    "zh-TW": "聲音提案沒有OS、repository、帳務或政策修改權限。",
    en: "Sound proposals have no permission to modify the OS, repository, billing, or policy.",
  },
  "status.sound.unrecognized": {
    "zh-TW": "離線解析器未辨識聲音行為要求；請使用Inspector設定。",
    en: "The offline parser did not recognize the sound-behavior request; configure it in the Inspector.",
  },
  "status.sound.objectMissing": {
    "zh-TW": "所選物件已不存在，請重新選取。",
    en: "The selected object no longer exists; select it again.",
  },
  "status.sound.selectObjectFirst": {
    "zh-TW": "請先建立並選取場景物件，再設定Sound Behavior。",
    en: "Create and select a scene object before configuring Sound Behavior.",
  },
  "status.sound.deterministic": {
    "zh-TW": "本機確定性聲音提案，不是Meta模型輸出。",
    en: "This is a local deterministic sound proposal, not Meta model output.",
  },
  "status.sound.creativeNotMeasured": {
    "zh-TW": "音量與音高為創意設定；不代表量測聲壓或物件振動。",
    en: "Gain and pitch are creative settings; they do not represent measured sound pressure or object vibration.",
  },
  "status.sound.firstObjectAssumption": {
    "zh-TW": "未指定物件，預覽選用現有registry的第一個物件；套用前請確認。",
    en: "No object was specified. The preview uses the first object in the current registry; check it before applying.",
  },
  "status.sound.noPianoAsset": {
    "zh-TW": "Registry沒有可用且權利已確認的鋼琴音檔；此預覽使用C4合成sine示範，並非鋼琴錄音。",
    en: "The registry has no available piano recording with confirmed rights. This preview uses a synthesized C4 sine demonstration, not a piano recording.",
  },
  "status.sound.basicSynth": {
    "zh-TW": "此提案使用明示的基本合成器，不捏造錄音素材或真實材質振動。",
    en: "This proposal uses an explicitly identified basic synthesizer; it does not invent recordings or actual material vibration.",
  },
  "status.sound.sharedOperationLimit": {
    "zh-TW": "共用Profile變更超過單包32操作，請在Inspector分批設定。",
    en: "The shared Profile change exceeds 32 operations per package; configure it in batches in the Inspector.",
  },
  "status.binding.metadataUnavailable": {
    "zh-TW":
      "BINDING_METADATA_UNAVAILABLE：尚未提供完整的基底、覆寫與版本資料；目前無法編輯此物件覆寫。",
    en: "BINDING_METADATA_UNAVAILABLE: complete base, override, and revision data is not available; this object's override cannot currently be edited.",
  },
  "status.binding.metadataInvalid": {
    "zh-TW": "BINDING_METADATA_INVALID：物件行為版本資料無效；目前無法編輯覆寫。",
    en: "BINDING_METADATA_INVALID: the object's behavior revision data is invalid; overrides cannot currently be edited.",
  },
  "status.binding.baseInvalid": {
    "zh-TW": "BINDING_METADATA_INVALID：基底參數未提供有限值；目前無法編輯覆寫。",
    en: "BINDING_METADATA_INVALID: finite base parameter values are not available; overrides cannot currently be edited.",
  },
  "status.binding.enabledBoolean": {
    "zh-TW": "啟用覆寫必須是布林值。",
    en: "The enabled override must be a boolean.",
  },
  "status.binding.missing": {
    "zh-TW": "BINDING_MISSING：原綁定或規則已移除，或無法唯一識別；覆寫草稿保留。",
    en: "BINDING_MISSING: the original binding or rule was removed or cannot be uniquely identified; the override draft is retained.",
  },
  "status.binding.stale": {
    "zh-TW": "STALE_BINDING：場景、行為文件或原綁定已變更；覆寫草稿保留，請明示放棄後重新編輯。",
    en: "STALE_BINDING: the scene, behavior document, or original binding changed. The override draft is retained; explicitly discard it before editing again.",
  },
  "status.binding.ackMissing": {
    "zh-TW": "BINDING_ACK_MISSING：尚未收到符合覆寫草稿的綁定與文件版本；草稿保留。",
    en: "BINDING_ACK_MISSING: no binding and document revision matching the override draft has been acknowledged; the draft is retained.",
  },
  "status.rule.idMismatch": {
    "zh-TW": "DRAFT_INVALID：草稿與規則 ID 不符。",
    en: "DRAFT_INVALID: the draft and rule IDs do not match.",
  },
  "status.rule.missing": {
    "zh-TW": "RULE_MISSING：原規則已移除或無法唯一識別；草稿保留。",
    en: "RULE_MISSING: the original rule was removed or cannot be uniquely identified; the draft is retained.",
  },
  "status.rule.sceneStale": {
    "zh-TW": "STALE_REVISION：場景或行為文件已變更；原草稿版本保留。",
    en: "STALE_REVISION: the scene or behavior document changed; the original draft revision is retained.",
  },
  "status.rule.bindingStale": {
    "zh-TW": "STALE_BINDING：原物件行為 binding 已替換；草稿保留。",
    en: "STALE_BINDING: the original object's behavior binding was replaced; the draft is retained.",
  },
  "status.rule.profileStale": {
    "zh-TW": "STALE_PROFILE：原聲音行為 profile 已替換；草稿保留。",
    en: "STALE_PROFILE: the original sound-behavior profile was replaced; the draft is retained.",
  },
  "status.rule.revisionStale": {
    "zh-TW": "STALE_REVISION：聲音行為版本已變更；請檢查草稿後重試。",
    en: "STALE_REVISION: the sound-behavior revision changed; check the draft before retrying.",
  },
  "status.rule.ackMissing": {
    "zh-TW": "RULE_ACK_MISSING：尚未收到符合草稿的規則版本；草稿保留。",
    en: "RULE_ACK_MISSING: no rule revision matching the draft has been acknowledged; the draft is retained.",
  },
  "status.replay.incomplete": {
    "zh-TW": "只有完整且有 frame 的錄製可以重播音訊。",
    en: "Only complete recordings containing frames can replay audio.",
  },
  "status.replay.resumeAfterSeek": {
    "zh-TW": "Seek 後請先 Resume，才能繼續排程音訊。",
    en: "Resume after seeking before continuing to schedule audio.",
  },
  "status.replay.behaviorMissing": {
    "zh-TW": "錄製缺少完整的 Behavior 狀態／VoiceIntent，無法重播聲音。",
    en: "The recording lacks complete Behavior state or VoiceIntent data; its sound cannot be replayed.",
  },
  "status.replay.frameMismatch": {
    "zh-TW": "Replay frame 與已驗證的原錄製不同。",
    en: "The replay frame differs from the verified original recording.",
  },
  "status.replay.behaviorClockMismatch": {
    "zh-TW": "Behavior 輸入／狀態／事件與錄製時鐘不同。",
    en: "Behavior inputs, state, or events do not match the recording clock.",
  },
  "status.replay.audioEventInvalid": {
    "zh-TW": "錄製 AudioEvent schema 無效。",
    en: "A recorded AudioEvent does not match the schema.",
  },
  "status.replay.voiceIntentMismatch": {
    "zh-TW": "錄製 VoiceIntent 的來源／參數與原始文件不同。",
    en: "The source or parameters of a recorded VoiceIntent differ from the original document.",
  },
  "status.replay.cursorBounds": {
    "zh-TW": "錄製音訊 cursor 超出有界來源集合。",
    en: "A recorded audio cursor is outside the bounded source set.",
  },
  "status.replay.cursorInvalid": {
    "zh-TW": "錄製音訊 cursor 的時鐘或來源無效。",
    en: "A recorded audio cursor has an invalid clock or source.",
  },
  "status.replay.bindingMismatch": {
    "zh-TW": "錄製聲源的 binding／profile／物件世代不符。",
    en: "The recorded source's binding, profile, or object generation does not match.",
  },
  "status.replay.acousticRouteMissing": {
    "zh-TW": "錄製聲源必須對應唯一同 tick 的聲學路由。",
    en: "Each recorded source must match one unique acoustic route at the same tick.",
  },
  "status.replay.sourceCursorMissing": {
    "zh-TW": "Pitch mapping 的錄製缺少真正 source cursor，無法精確恢復聲音相位。",
    en: "The pitch-mapped recording lacks an actual source cursor, so its sound phase cannot be restored precisely.",
  },
  "status.pointer.unavailable": {
    "zh-TW": "瀏覽器未提供滑鼠鎖定，仍可使用下方按鈕操作。",
    en: "The browser did not provide pointer lock; use the alternative buttons below.",
  },
  "status.pointer.failed": {
    "zh-TW": "無法鎖定滑鼠；請使用替代操作，或明示重試。",
    en: "Pointer lock could not be acquired. Use alternative controls or explicitly retry.",
  },
  "status.graphics.contextLost": {
    "zh-TW": "WebGL 顯示已中斷；已暫停運算。畫面恢復後請明示繼續。",
    en: "The WebGL display was interrupted and the simulation was paused. Explicitly resume after the display recovers.",
  },
  "status.server.localOnly": {
    "zh-TW": "只接受授權的本機介面。",
    en: "Only the authorized local interface is accepted.",
  },
  "status.server.unknownRoute": { "zh-TW": "找不到此API。", en: "This API route was not found." },
  "status.server.invalidRequest": {
    "zh-TW": "請求無效；未執行場景變更。",
    en: "The request is invalid; no scene changes were executed.",
  },
  "status.project.sizeLimit": {
    "zh-TW": "SIZE_LIMIT：專案 JSON 超過 8 MiB。",
    en: "SIZE_LIMIT: the project JSON exceeds 8 MiB.",
  },
  "status.project.invalidRoot": {
    "zh-TW": "PROJECT_INVALID：專案根資料必須是 JSON 物件。",
    en: "PROJECT_INVALID: the project root must be a JSON object.",
  },
  "status.project.readFailed": {
    "zh-TW": "無法讀取專案 JSON。",
    en: "The project JSON could not be read.",
  },
  "status.inspector.projectChanged": {
    "zh-TW": "PROJECT_CHANGED：原專案已切換；草稿保留。",
    en: "PROJECT_CHANGED: the original project changed; the draft is retained.",
  },
  "status.inspector.ruleChanged": {
    "zh-TW": "STALE_RULE：原規則已變更或移除；草稿保留，請檢視後明示放棄再重新編輯。",
    en: "STALE_RULE: the original rule changed or was removed. The draft is retained; review it, then explicitly discard it before editing again.",
  },
  "status.inspector.applyFailed": {
    "zh-TW": "套用失敗；草稿保留。",
    en: "Apply failed; the draft is retained.",
  },
  "status.inspector.overrideFailed": {
    "zh-TW": "物件覆寫套用失敗；草稿保留。",
    en: "Applying the object override failed; the draft is retained.",
  },
  "status.inspector.clearFailed": {
    "zh-TW": "無法準備清除覆寫。",
    en: "The override could not be prepared for clearing.",
  },
  "status.binding.gainRange": {
    "zh-TW": "音量 linear 必須介於 0 與 4，並提供有限數值。",
    en: "Gain (linear) must be a finite number between 0 and 4.",
  },
  "status.binding.pitchRange": {
    "zh-TW": "音高 semitones 必須介於 -24 與 24，並提供有限數值。",
    en: "Pitch (semitones) must be a finite number between -24 and 24.",
  },
  "status.mapping.maxCount": {
    "zh-TW": "映射超過 8 條上限。",
    en: "The mapping count exceeds the limit of 8.",
  },
  "status.rule.gainIncomplete": {
    "zh-TW": "DRAFT_INVALID：gainLinear 尚有無效或未完成的數值輸入。",
    en: "DRAFT_INVALID: gainLinear contains an invalid or incomplete numeric input.",
  },
  "status.rule.pitchIncomplete": {
    "zh-TW": "DRAFT_INVALID：pitchSemitones 尚有無效或未完成的數值輸入。",
    en: "DRAFT_INVALID: pitchSemitones contains an invalid or incomplete numeric input.",
  },
  "status.rule.cooldownIncomplete": {
    "zh-TW": "DRAFT_INVALID：cooldownSeconds 尚有無效或未完成的數值輸入。",
    en: "DRAFT_INVALID: cooldownSeconds contains an invalid or incomplete numeric input.",
  },
  "status.replay.notComplete": {
    "zh-TW": "不完整或已取消的錄製不能宣稱完整 replay。",
    en: "An incomplete or cancelled recording cannot be presented as a complete replay.",
  },
  "status.replay.modeUnsupported": {
    "zh-TW": "不支援的重播模式。",
    en: "This replay mode is not supported.",
  },
  "status.replay.seekInteger": {
    "zh-TW": "Seek 必須使用整數 physics tick。",
    en: "Seek requires an integer physics tick.",
  },
  "status.replay.seekRange": {
    "zh-TW": "Seek tick 不在錄製範圍。",
    en: "The seek tick is outside the recording range.",
  },
  "status.material.hard": { "zh-TW": "硬質表面 · Synthetic", en: "Hard surface · Synthetic" },
  "status.material.soft": { "zh-TW": "吸音表面 · Synthetic", en: "Absorbing surface · Synthetic" },
  "status.material.wood": { "zh-TW": "木質示範 · Synthetic", en: "Wood demonstration · Synthetic" },
  "status.material.metal": {
    "zh-TW": "金屬示範 · Synthetic",
    en: "Metal demonstration · Synthetic",
  },
  "status.material.conditions": {
    "zh-TW": "手工設定的示範頻帶係數；非材質量測、非振動合成。A+R+T=1，零透射。",
    en: "Manually authored demonstration band coefficients; not material measurements or vibration synthesis. A+R+T=1, with zero transmission.",
  },
  "status.site.keyMissing": {
    "zh-TW": "尚未輸入Meta API金鑰；未送出請求。",
    en: "Enter your Meta API key first. No request was sent.",
  },
  "status.site.stopped": {
    "zh-TW": "已停止接受此提案；已送出的請求仍可能由Meta計費。",
    en: "This proposal was stopped. Meta may still charge for a request that was already sent.",
  },
  "status.site.keyMissingCoded": {
    "zh-TW": "KEY_NOT_ENTERED：尚未輸入Meta API金鑰；未送出請求。",
    en: "Enter your Meta API key first. No request was sent.",
  },
  "status.site.AUTHENTICATION_ERROR": {
    "zh-TW": "AUTHENTICATION_ERROR：Meta拒絕此金鑰；請檢查後重試，或清除後改用其他金鑰。",
    en: "Meta rejected this key. Check it and try again, or forget it and use another key. [AUTHENTICATION_ERROR]",
  },
  "status.site.PERMISSION_DENIED": {
    "zh-TW": "PERMISSION_DENIED：此金鑰沒有使用這個模型的權限。",
    en: "This key doesn't have permission to use this model. [PERMISSION_DENIED]",
  },
  "status.site.QUOTA_EXCEEDED": {
    "zh-TW": "QUOTA_EXCEEDED：此Meta帳號的額度不足。",
    en: "This Meta account doesn't have enough credit. [QUOTA_EXCEEDED]",
  },
  "status.site.MODEL_UNAVAILABLE": {
    "zh-TW": "MODEL_UNAVAILABLE：Meta目前未向此金鑰提供這個模型。",
    en: "Meta isn't offering this model to this key right now. [MODEL_UNAVAILABLE]",
  },
  "status.site.RATE_LIMITED": {
    "zh-TW": "RATE_LIMITED：Meta暫時限制此金鑰的請求；請稍後再試。",
    en: "Meta is limiting requests from this key for now. Try again shortly. [RATE_LIMITED]",
  },
  "status.site.TIMEOUT": {
    "zh-TW": "TIMEOUT：無法確認Meta是否已回覆；未自動重試以免重複計費。請檢查網路後再試。",
    en: "Couldn't confirm whether Meta replied. It wasn't retried, to avoid charging you twice. Check your connection and try again. [TIMEOUT]",
  },
  "status.site.BUDGET_EXCEEDED": {
    "zh-TW":
      "BUDGET_EXCEEDED：此請求超出此頁的上限，未套用任何變更。請縮小指令或場景；若已達請求或費用上限，請重新載入並再次輸入金鑰。",
    en: "This request went over the page's limits, and nothing was applied. Try a smaller instruction or scene. If you've reached the request or cost limit, reload and enter your key again. [BUDGET_EXCEEDED]",
  },
  "status.site.CANCELED": {
    "zh-TW": "CANCELED：請求已停止；已送出的內容仍可能由Meta計費。",
    en: "The request was stopped. Meta may still charge for what was already sent. [CANCELED]",
  },
  "status.code.KEY_NOT_ENTERED": {
    "zh-TW": "KEY_NOT_ENTERED",
    en: "Enter your Meta API key first.",
  },
  "status.server.requestActive": {
    "zh-TW": "已有Meta請求進行中，不能重複派送。",
    en: "A Meta request is already in progress; it cannot be dispatched again.",
  },
  "status.provider.READY_REQUIRES_EXPLICIT_REQUEST": {
    "zh-TW": "READY_REQUIRES_EXPLICIT_REQUEST；只有提交指令才會呼叫模型；剩餘額度未知。",
    en: "The server gate is ready; a model request is sent only when you submit an instruction. [READY_REQUIRES_EXPLICIT_REQUEST] Remaining credit is unknown.",
  },
  "status.provider.NETWORK_DISABLED": {
    "zh-TW": "NETWORK_DISABLED；Live validation NOT_RUN；剩餘額度未知。",
    en: "Network access is disabled by the server configuration. [NETWORK_DISABLED] Live validation: NOT_RUN; remaining credit is unknown.",
  },
  "status.provider.AUTHENTICATION_NOT_CONFIGURED": {
    "zh-TW": "AUTHENTICATION_NOT_CONFIGURED；Live validation NOT_RUN；剩餘額度未知。",
    en: "Authentication is not configured on the server. [AUTHENTICATION_NOT_CONFIGURED] Live validation: NOT_RUN; remaining credit is unknown.",
  },
  "status.provider.MODEL_NOT_CONFIGURED": {
    "zh-TW": "MODEL_NOT_CONFIGURED；Live validation NOT_RUN；剩餘額度未知。",
    en: "No valid model is configured on the server. [MODEL_NOT_CONFIGURED] Live validation: NOT_RUN; remaining credit is unknown.",
  },
  "status.provider.PROVIDER_UNVERIFIED": {
    "zh-TW": "PROVIDER_UNVERIFIED；Live validation NOT_RUN；剩餘額度未知。",
    en: "The provider has not been verified for this request. [PROVIDER_UNVERIFIED] Live validation: NOT_RUN; remaining credit is unknown.",
  },
  "status.provider.ZERO_OR_INVALID_BUDGET": {
    "zh-TW": "ZERO_OR_INVALID_BUDGET；Live validation NOT_RUN；剩餘額度未知。",
    en: "The server budget is zero or invalid; Meta requests are blocked. [ZERO_OR_INVALID_BUDGET] Live validation: NOT_RUN; remaining credit is unknown.",
  },
  "status.provider.PRICING_UNVERIFIED": {
    "zh-TW": "PRICING_UNVERIFIED；Live validation NOT_RUN；剩餘額度未知。",
    en: "Provider pricing has not been verified. [PRICING_UNVERIFIED] Live validation: NOT_RUN; remaining credit is unknown.",
  },
  "status.provider.INVALID_HOST_BUDGET": {
    "zh-TW": "INVALID_HOST_BUDGET；Live validation NOT_RUN；剩餘額度未知。",
    en: "The Host budget configuration is invalid. [INVALID_HOST_BUDGET] Live validation: NOT_RUN; remaining credit is unknown.",
  },
  "status.provider.REQUEST_DEADLINE_EXCEEDED": {
    "zh-TW": "REQUEST_DEADLINE_EXCEEDED；Live validation NOT_RUN；剩餘額度未知。",
    en: "The current request exceeded its deadline. [REQUEST_DEADLINE_EXCEEDED] Live validation: NOT_RUN; remaining credit is unknown.",
  },
  "status.provider.REQUEST_IN_PROGRESS": {
    "zh-TW": "REQUEST_IN_PROGRESS；Live validation NOT_RUN；剩餘額度未知。",
    en: "A request is already in progress. [REQUEST_IN_PROGRESS] Live validation: NOT_RUN; remaining credit is unknown.",
  },
  "status.provider.PLANNING_TURN_BUDGET_EXCEEDED": {
    "zh-TW": "PLANNING_TURN_BUDGET_EXCEEDED；Live validation NOT_RUN；剩餘額度未知。",
    en: "The planning-turn budget was exceeded. [PLANNING_TURN_BUDGET_EXCEEDED] Live validation: NOT_RUN; remaining credit is unknown.",
  },
  "status.provider.COST_BUDGET_EXCEEDED": {
    "zh-TW": "COST_BUDGET_EXCEEDED；Live validation NOT_RUN；剩餘額度未知。",
    en: "The configured cost budget was exceeded. [COST_BUDGET_EXCEEDED] Live validation: NOT_RUN; remaining credit is unknown.",
  },
  "status.code.PROJECT_CHANGED": {
    "zh-TW": "PROJECT_CHANGED",
    en: "The original project changed; the draft is retained.",
  },
  "status.code.STALE_RULE": {
    "zh-TW": "STALE_RULE",
    en: "The original rule changed or was removed; the draft is retained.",
  },
  "status.code.INCOMPATIBLE_EXPERIMENTS": {
    "zh-TW": "INCOMPATIBLE_EXPERIMENTS",
    en: "The fixed recording conditions do not match; these cannot be assumed to be the same experiment.",
  },
  "status.code.ASSET_RELINK_MISMATCH": {
    "zh-TW": "ASSET_RELINK_MISMATCH",
    en: "This WAV does not match an external asset SHA in the pending project.",
  },
  "status.code.WAV_SAMPLE_OUT_OF_RANGE": {
    "zh-TW": "WAV_SAMPLE_OUT_OF_RANGE",
    en: "Float32 WAV samples must be finite normalized values in [-1,1].",
  },
  "status.code.REPLAY_MODE": { "zh-TW": "REPLAY_MODE", en: "This replay mode is not supported." },
  "status.code.SEEK_TICK": { "zh-TW": "SEEK_TICK", en: "Seek requires an integer physics tick." },
  "status.code.SEEK_RANGE": {
    "zh-TW": "SEEK_RANGE",
    en: "The seek tick is outside the recording range.",
  },
  "status.code.VALID": { "zh-TW": "VALID", en: "The placement is valid." },
  "status.code.OUT_OF_BOUNDS": {
    "zh-TW": "OUT_OF_BOUNDS",
    en: "The placement is outside the allowed bounds.",
  },
  "status.code.OVERLAP": { "zh-TW": "OVERLAP", en: "The placement overlaps another object." },
  "status.code.READY_REQUIRES_EXPLICIT_REQUEST": {
    "zh-TW": "READY_REQUIRES_EXPLICIT_REQUEST",
    en: "The server gate is ready but requires an explicit request.",
  },
  "status.code.NETWORK_DISABLED": {
    "zh-TW": "NETWORK_DISABLED",
    en: "Network access is disabled by the server configuration.",
  },
  "status.code.AUTHENTICATION_NOT_CONFIGURED": {
    "zh-TW": "AUTHENTICATION_NOT_CONFIGURED",
    en: "Authentication is not configured on the server.",
  },
  "status.code.MODEL_NOT_CONFIGURED": {
    "zh-TW": "MODEL_NOT_CONFIGURED",
    en: "No valid model is configured on the server.",
  },
  "status.code.PROVIDER_UNVERIFIED": {
    "zh-TW": "PROVIDER_UNVERIFIED",
    en: "The provider has not been verified for this request.",
  },
  "status.code.ZERO_OR_INVALID_BUDGET": {
    "zh-TW": "ZERO_OR_INVALID_BUDGET",
    en: "The server budget is zero or invalid; Meta requests are blocked.",
  },
  "status.code.PRICING_UNVERIFIED": {
    "zh-TW": "PRICING_UNVERIFIED",
    en: "Provider pricing has not been verified.",
  },
  "status.code.INVALID_HOST_BUDGET": {
    "zh-TW": "INVALID_HOST_BUDGET",
    en: "The Host budget configuration is invalid.",
  },
  "status.code.REQUEST_DEADLINE_EXCEEDED": {
    "zh-TW": "REQUEST_DEADLINE_EXCEEDED",
    en: "The current request exceeded its deadline.",
  },
  "status.code.REQUEST_IN_PROGRESS": {
    "zh-TW": "REQUEST_IN_PROGRESS",
    en: "A request is already in progress.",
  },
  "status.code.PLANNING_TURN_BUDGET_EXCEEDED": {
    "zh-TW": "PLANNING_TURN_BUDGET_EXCEEDED",
    en: "The planning-turn budget was exceeded.",
  },
  "status.code.COST_BUDGET_EXCEEDED": {
    "zh-TW": "COST_BUDGET_EXCEEDED",
    en: "The configured cost budget was exceeded.",
  },
  "status.code.REVISION_CONFLICT": {
    "zh-TW": "REVISION_CONFLICT",
    en: "The scene or document revision changed; the requested change was not accepted.",
  },
  "status.code.TRANSACTION_BUSY": {
    "zh-TW": "TRANSACTION_BUSY",
    en: "Wait for the current transaction to finish.",
  },
  "status.code.DISPOSED": {
    "zh-TW": "DISPOSED",
    en: "This controller has been disposed; the operation cannot continue.",
  },
  "status.code.INVALID_INPUT": { "zh-TW": "INVALID_INPUT", en: "The supplied input is invalid." },
  "status.code.UNKNOWN_OBJECT": {
    "zh-TW": "UNKNOWN_OBJECT",
    en: "The requested object is not available.",
  },
  "status.code.EMPTY_PATCH": { "zh-TW": "EMPTY_PATCH", en: "No editable changes were supplied." },
  "status.code.REVERB_BOUNDS": {
    "zh-TW": "REVERB_BOUNDS",
    en: "The synthetic late-reverb parameters are outside their allowed bounds.",
  },
  "status.code.ASSET_NOT_READY": {
    "zh-TW": "ASSET_NOT_READY",
    en: "The audio asset is not ready.",
  },
  "status.code.STOP_REPLAY_REQUIRED": {
    "zh-TW": "STOP_REPLAY_REQUIRED",
    en: "Return to the live scene before recording.",
  },
  "status.code.TRAJECTORY_NOT_AUDIBLE": {
    "zh-TW": "只有有聲音的物件可以設定軌跡；此物件沒有聲音行為或聲源。",
    en: "Only objects with sound can have a path. This object has no sound behavior or sound source.",
  },
  "status.code.TRAJECTORY_USE_SET_TRAJECTORY": {
    "zh-TW": "軌跡只能透過軌跡編輯修改，不能以一般物件修改變更。",
    en: "A path changes only through the path editor, not through a general object edit.",
  },
  "status.code.MOTION_PATH_ACTIVE": {
    "zh-TW": "此物件正沿軌跡移動；請等軌跡結束或重設後再使用動作面板。",
    en: "This object is following its path. Use the Motion panel after the path ends or after Reset.",
  },
  "status.code.PLAYER_RESPAWN_BLOCKED": {
    "zh-TW": "物件已回到起始位置，但有物件與你站的位置重疊，無法保留玩家位置；請換個位置再試。",
    en: "Objects returned to the starting layout, but one overlaps where you stand, so your position could not be kept. Step to another spot and try again.",
  },
  "status.code.REPLAY_UNAVAILABLE": {
    "zh-TW": "REPLAY_UNAVAILABLE",
    en: "No replay is available for this operation.",
  },
  "status.code.NO_RECORDING": {
    "zh-TW": "NO_RECORDING",
    en: "No recording is available for this operation.",
  },
  "status.code.INVALID_SEEK_TIME": {
    "zh-TW": "INVALID_SEEK_TIME",
    en: "The requested replay time is invalid.",
  },
  "status.code.META_PROVIDER_BLOCKED": {
    "zh-TW": "META_PROVIDER_BLOCKED",
    en: "The server gate blocks the Meta provider; manual editing remains available.",
  },
  "status.code.NO_SAVED_PROJECT": {
    "zh-TW": "NO_SAVED_PROJECT",
    en: "No locally saved project is available.",
  },
  "status.code.RIGHTS_CONFIRMATION_REQUIRED": {
    "zh-TW": "RIGHTS_CONFIRMATION_REQUIRED",
    en: "Confirm that you have permission to use the audio file.",
  },
  "status.code.ASSET_SIZE_LIMIT": {
    "zh-TW": "ASSET_SIZE_LIMIT",
    en: "The audio file exceeds the import size limit.",
  },
  "status.code.LIVE_AUDIO_RESTORE": {
    "zh-TW": "LIVE_AUDIO_RESTORE",
    en: "The live audio sources could not be restored.",
  },
  "status.code.RECORDING_REFERENCE_MISMATCH": {
    "zh-TW": "RECORDING_REFERENCE_MISMATCH",
    en: "A stored recording does not match its project reference.",
  },
  "status.code.BINDING_METADATA_UNAVAILABLE": {
    "zh-TW": "BINDING_METADATA_UNAVAILABLE",
    en: "Complete binding metadata is not available; override editing is unavailable.",
  },
  "status.code.BINDING_METADATA_INVALID": {
    "zh-TW": "BINDING_METADATA_INVALID",
    en: "The binding metadata is invalid; override editing is unavailable.",
  },
  "status.code.BINDING_MISSING": {
    "zh-TW": "BINDING_MISSING",
    en: "The original binding or rule is missing; the draft is retained.",
  },
  "status.code.STALE_BINDING": {
    "zh-TW": "STALE_BINDING",
    en: "The original binding changed; the draft is retained.",
  },
  "status.code.STALE_PROFILE": {
    "zh-TW": "STALE_PROFILE",
    en: "The original sound profile changed; the draft is retained.",
  },
  "status.code.STALE_REVISION": {
    "zh-TW": "STALE_REVISION",
    en: "The scene or behavior revision changed; the draft is retained.",
  },
  "status.code.DRAFT_INVALID": {
    "zh-TW": "DRAFT_INVALID",
    en: "The draft contains invalid or incomplete values and was not applied.",
  },
  "status.code.BINDING_ACK_MISSING": {
    "zh-TW": "BINDING_ACK_MISSING",
    en: "The expected binding revision has not been acknowledged; the draft is retained.",
  },
  "status.code.RULE_MISSING": {
    "zh-TW": "RULE_MISSING",
    en: "The original rule is missing; the draft is retained.",
  },
  "status.code.RULE_ACK_MISSING": {
    "zh-TW": "RULE_ACK_MISSING",
    en: "The expected rule revision has not been acknowledged; the draft is retained.",
  },
  "status.code.HOST_BUSY": {
    "zh-TW": "HOST_BUSY",
    en: "The Host is still finishing another operation.",
  },
  "status.code.OPERATION_CANCELLED": {
    "zh-TW": "OPERATION_CANCELLED",
    en: "The operation was cancelled; no incomplete result was published.",
  },
  "status.code.RUN_ID": { "zh-TW": "RUN_ID", en: "The run ID is invalid." },
  "status.code.RECORDER_ACTIVE": {
    "zh-TW": "RECORDER_ACTIVE",
    en: "Finish or interrupt the current recording before this operation.",
  },
  "status.code.NO_CAPTURED_RECORDING": {
    "zh-TW": "NO_CAPTURED_RECORDING",
    en: "A complete captured recording is required.",
  },
  "status.code.COMPARISON_SLOT": {
    "zh-TW": "COMPARISON_SLOT",
    en: "The comparison slot must be A or B.",
  },
  "status.code.NO_BASELINE": {
    "zh-TW": "NO_BASELINE",
    en: "Save baseline A before re-evaluating B.",
  },
  "status.code.COMPARISON_SLOTS": {
    "zh-TW": "COMPARISON_SLOTS",
    en: "Complete A and B before comparing them.",
  },
  "status.code.INCOMPLETE_RECORDING": {
    "zh-TW": "INCOMPLETE_RECORDING",
    en: "Only a complete recording can be replayed.",
  },
  "status.code.REPLAY_PAUSED": {
    "zh-TW": "REPLAY_PAUSED",
    en: "Resume replay before scheduling more audio.",
  },
  "status.code.CAPABILITY_UNSUPPORTED": {
    "zh-TW": "CAPABILITY_UNSUPPORTED",
    en: "The required capability is not supported by the available data or backend.",
  },
  "status.code.INPUT_PROVENANCE_MISMATCH": {
    "zh-TW": "INPUT_PROVENANCE_MISMATCH",
    en: "The input does not match the verified recording provenance.",
  },
  "status.code.INVALID_AUDIO_EVENT": {
    "zh-TW": "INVALID_AUDIO_EVENT",
    en: "A recorded audio event is invalid.",
  },
  "status.code.INVALID_AUDIO_CURSOR": {
    "zh-TW": "INVALID_AUDIO_CURSOR",
    en: "A recorded source cursor is invalid.",
  },
  "status.code.ACOUSTIC_FRAME_UNAVAILABLE": {
    "zh-TW": "ACOUSTIC_FRAME_UNAVAILABLE",
    en: "No matching acoustic frame is available.",
  },
  "status.code.PROVIDER_REQUEST_FAILED": {
    "zh-TW": "PROVIDER_REQUEST_FAILED",
    en: "The local provider request failed; no proposal was accepted.",
  },
  "status.code.SCHEMA_INVALID": {
    "zh-TW": "SCHEMA_INVALID",
    en: "The supplied data does not match the required schema.",
  },
  "status.code.INPUT_LIMIT": {
    "zh-TW": "INPUT_LIMIT",
    en: "The request is outside its allowed input limits.",
  },
  "status.code.UNKNOWN_ID": {
    "zh-TW": "UNKNOWN_ID",
    en: "A required registry ID is not available.",
  },
  "status.code.POLICY_DENIED": {
    "zh-TW": "POLICY_DENIED",
    en: "The request is outside the allowed tool permissions.",
  },
  "status.code.BUDGET_EXCEEDED": {
    "zh-TW": "BUDGET_EXCEEDED",
    en: "The configured session or tool budget was exceeded.",
  },
  "status.code.ASSET_HOST_BUSY": {
    "zh-TW": "ASSET_HOST_BUSY",
    en: "Another asset transaction is already in progress.",
  },
  "status.code.HASH_UNAVAILABLE": {
    "zh-TW": "HASH_UNAVAILABLE",
    en: "WebCrypto SHA-256 is required to verify this data.",
  },
  "status.code.OFFLINE_AUDIO_UNAVAILABLE": {
    "zh-TW": "OFFLINE_AUDIO_UNAVAILABLE",
    en: "OfflineAudioContext is required to verify decoded audio assets.",
  },
  "status.code.DECODED_MEMORY_BUDGET": {
    "zh-TW": "DECODED_MEMORY_BUDGET",
    en: "The decoded audio would exceed the configured PCM memory budget.",
  },
  "status.code.ASSET_STAGING_RATE": {
    "zh-TW": "ASSET_STAGING_RATE",
    en: "The audio staging context did not preserve the requested sample rate.",
  },
  "status.code.WAV_DECODE_MISMATCH": {
    "zh-TW": "WAV_DECODE_MISMATCH",
    en: "Native WAV decoding did not match the bounded preflight.",
  },
  "status.code.ASSET_COUNT_BUDGET": {
    "zh-TW": "ASSET_COUNT_BUDGET",
    en: "The decoded audio-asset count exceeds the configured budget.",
  },
  "status.code.ASSET_DESCRIPTOR_HASH": {
    "zh-TW": "ASSET_DESCRIPTOR_HASH",
    en: "The generator descriptor does not match its pinned hash.",
  },
  "status.code.ASSET_DESCRIPTOR_ONLY": {
    "zh-TW": "ASSET_DESCRIPTOR_ONLY",
    en: "The descriptor is not decoded sample PCM.",
  },
  "status.code.ASSET_GENERATOR": {
    "zh-TW": "ASSET_GENERATOR",
    en: "The built-in asset could not be regenerated.",
  },
  "status.code.ASSET_PCM_HASH": {
    "zh-TW": "ASSET_PCM_HASH",
    en: "The existing audio buffer does not match the pinned PCM hash.",
  },
  "status.code.ASSET_REQUIRED_MISSING": {
    "zh-TW": "ASSET_REQUIRED_MISSING",
    en: "Import the required original WAV, then apply the project again.",
  },
  "status.code.ASSET_REFERENCE_MISMATCH": {
    "zh-TW": "ASSET_REFERENCE_MISMATCH",
    en: "The stored asset revision or length differs from the project reference.",
  },
  "status.code.ASSET_RIGHTS_UNVERIFIED": {
    "zh-TW": "ASSET_RIGHTS_UNVERIFIED",
    en: "Confirm local use rights by importing the original WAV.",
  },
  "status.code.ASSET_PREPARED_STALE": {
    "zh-TW": "ASSET_PREPARED_STALE",
    en: "The prepared asset bank is stale or belongs to a different Host.",
  },
  "status.code.ASSET_HASH": {
    "zh-TW": "ASSET_HASH",
    en: "The asset SHA-256 or hash kind is invalid.",
  },
  "status.code.ASSET_STORAGE": {
    "zh-TW": "ASSET_STORAGE",
    en: "The asset storage kind is invalid.",
  },
  "status.code.INVALID_WAV": {
    "zh-TW": "INVALID_WAV",
    en: "The WAV file is invalid or inconsistent.",
  },
  "status.code.WAV_CAPABILITY_UNSUPPORTED": {
    "zh-TW": "WAV_CAPABILITY_UNSUPPORTED",
    en: "This WAV encoding is unsupported; V1 accepts preflighted PCM or float WAV.",
  },
  "status.code.WAV_CHANNEL_BUDGET": {
    "zh-TW": "WAV_CHANNEL_BUDGET",
    en: "The WAV channel count exceeds the configured budget.",
  },
  "status.code.WAV_RATE_UNSUPPORTED": {
    "zh-TW": "WAV_RATE_UNSUPPORTED",
    en: "The WAV sample rate is unsupported.",
  },
  "status.code.WAV_DURATION_BUDGET": {
    "zh-TW": "WAV_DURATION_BUDGET",
    en: "The WAV duration exceeds the configured budget.",
  },
  "status.code.SIZE_LIMIT": {
    "zh-TW": "SIZE_LIMIT",
    en: "The project exceeds the allowed size or structural limits.",
  },
  "status.code.PROJECT_INVALID": { "zh-TW": "PROJECT_INVALID", en: "The project data is invalid." },
  "status.code.UNKNOWN_FIELD": {
    "zh-TW": "UNKNOWN_FIELD",
    en: "The data contains an unsupported field.",
  },
  "status.code.NON_JSON_VALUE": {
    "zh-TW": "NON_JSON_VALUE",
    en: "Only finite, plain JSON values can be used as project data.",
  },
  "status.code.CYCLE": { "zh-TW": "CYCLE", en: "Cyclic project data cannot be serialized." },
  "status.code.ACOUSTIC_PAYLOAD_BUDGET": {
    "zh-TW": "ACOUSTIC_PAYLOAD_BUDGET",
    en: "The acoustic payload exceeds the delivery budget.",
  },
  "status.code.ACOUSTIC_PAYLOAD_INVALID": {
    "zh-TW": "ACOUSTIC_PAYLOAD_INVALID",
    en: "The acoustic payload is invalid.",
  },
  "status.code.SOURCE_BUDGET_EXCEEDED": {
    "zh-TW": "SOURCE_BUDGET_EXCEEDED",
    en: "The acoustic source budget was exceeded.",
  },
  "status.code.PATH_BUDGET_EXCEEDED": {
    "zh-TW": "PATH_BUDGET_EXCEEDED",
    en: "The acoustic path budget was exceeded.",
  },
  "status.code.ACOUSTIC_BATCH_IDENTITY": {
    "zh-TW": "ACOUSTIC_BATCH_IDENTITY",
    en: "The acoustic batch identity is invalid.",
  },
  "status.code.ACOUSTIC_TIMEOUT_BOUNDS": {
    "zh-TW": "ACOUSTIC_TIMEOUT_BOUNDS",
    en: "The acoustic timeout is outside its allowed bounds.",
  },
  "status.code.ACOUSTIC_WORKER": {
    "zh-TW": "ACOUSTIC_WORKER",
    en: "The acoustic worker reported an error.",
  },
  "status.code.ACOUSTIC_MESSAGE_ERROR": {
    "zh-TW": "ACOUSTIC_MESSAGE_ERROR",
    en: "The acoustic worker message could not be read.",
  },
  "status.code.ACOUSTIC_POST_MESSAGE_FAILED": {
    "zh-TW": "ACOUSTIC_POST_MESSAGE_FAILED",
    en: "The acoustic request could not be sent to the worker.",
  },
  "status.code.SOLVER_BUSY": {
    "zh-TW": "SOLVER_BUSY",
    en: "The acoustic solver is already processing a request.",
  },
  "status.code.ACOUSTIC_TIMEOUT": {
    "zh-TW": "ACOUSTIC_TIMEOUT",
    en: "The acoustic solver exceeded its request time limit.",
  },
  "status.code.ACOUSTIC_REPLY_INVALID": {
    "zh-TW": "ACOUSTIC_REPLY_INVALID",
    en: "The acoustic worker reply is invalid.",
  },
  "status.code.ACOUSTIC_REPLY_IDENTITY": {
    "zh-TW": "ACOUSTIC_REPLY_IDENTITY",
    en: "The acoustic worker reply does not match the requested batch.",
  },
  "status.code.AUTHORING_CANCELLED": {
    "zh-TW": "AUTHORING_CANCELLED",
    en: "Authoring changes cancelled the pending acoustic request.",
  },
  "status.code.GRAVITY_MODE_CHANGED_CANCELLED": {
    "zh-TW": "GRAVITY_MODE_CHANGED_CANCELLED",
    en: "The gravity-mode change cancelled the pending acoustic request.",
  },
  "status.template.catchUpDropped": {
    "zh-TW": "互動追趕上限：捨棄 {seconds} s 牆鐘時間；固定步長保持1/60 s。",
    en: "Interaction catch-up limit: dropped {seconds} s of wall-clock time; the fixed step stays 1/60 s.",
  },
  "status.template.audioAdmission": {
    "zh-TW": "音訊 admission：{code}",
    en: "Audio admission: {code}",
  },
  "status.template.projectLoaded": {
    "zh-TW": "專案已載入；已驗證 {count} 份錄製與本機可用音檔。",
    en: "Project loaded; verified {count} recordings and the locally available audio files.",
  },
  "status.template.audioSavedForProject": {
    "zh-TW": "已核對並保存 {file}；請再次套用待匯入的專案，保留原asset ID與revision。",
    en: "Verified and saved {file}. Apply the pending project again to keep its original asset ID and revision.",
  },
  "status.template.audioSaved": {
    "zh-TW": "已解碼並保存 {file}；hash涵蓋原WAV位元組，監聽仍需另行啟用。",
    en: "Decoded and saved {file}. The hash covers the original WAV bytes; enable listening separately.",
  },
  "status.template.metaStatus": {
    "zh-TW": "{detail}；Live validation {state}；剩餘額度未知。",
    en: "{detail}; live validation {state}; remaining credit unknown.",
  },
  "status.template.enterFailed": {
    "zh-TW": "無法進入第一人稱：{detail}",
    en: "Cannot enter first person: {detail}",
  },
  "status.template.resumeFailed": {
    "zh-TW": "無法恢復：{detail}",
    en: "Cannot resume: {detail}",
  },
  "status.template.frozenSyncFailed": {
    "zh-TW": "已固定；模擬保持暫停，但後續同步失敗：{detail}",
    en: "Fixed; the simulation stays paused, but the follow-up sync failed: {detail}",
  },
  "status.template.unfrozenSyncFailed": {
    "zh-TW": "已解除固定；模擬保持暫停，但後續同步失敗：{detail}",
    en: "Unfixed; the simulation stays paused, but the follow-up sync failed: {detail}",
  },
  "status.template.modeChangeFailed": {
    "zh-TW": "模式交易失敗：{detail}",
    en: "Mode change failed: {detail}",
  },
  "status.template.cannotPlace": {
    "zh-TW": "無法放置：{detail}",
    en: "Cannot place: {detail}",
  },
  "status.template.placeOccupied": {
    "zh-TW": "位置已被占用：{detail}",
    en: "The position is occupied: {detail}",
  },
  "status.template.geometryAckFailed": {
    "zh-TW": "幾何確認失敗；物件保持待啟用，可重試或取消：{detail}",
    en: "Geometry confirmation failed; the object stays staged and you can retry or cancel: {detail}",
  },
  "status.template.placeFailed": {
    "zh-TW": "放置失敗：{detail}",
    en: "Placement failed: {detail}",
  },
  "status.template.enableFailed": {
    "zh-TW": "啟用失敗：{detail}",
    en: "Activation failed: {detail}",
  },
  "status.template.cancelStagedFailed": {
    "zh-TW": "取消待啟用物件失敗：{detail}",
    en: "Cancelling the staged object failed: {detail}",
  },
  "status.template.recordingInterrupted": {
    "zh-TW": "已中斷：{detail}",
    en: "Interrupted: {detail}",
  },
  "status.template.recordingDiscarded": {
    "zh-TW": "已丟棄未能封存的錄製：{detail}；先前有效成果保留。",
    en: "Discarded a recording that could not be sealed: {detail}. The previous valid result is kept.",
  },
  "status.template.comparisonMismatch": {
    "zh-TW": "無法作相同條件比較：{fields}",
    en: "Cannot compare under the same conditions: {fields}",
  },
} as const satisfies MessageCatalog;

/** Exact finite raw-message matches only; no substring or generic regex translation. */
export const exactStatusKeys: Readonly<Record<string, keyof typeof statusMessages>> = {
  "前一次錄製準備仍在清理；請稍後重試。": "status.recording.cleanupPending",
  "錄製準備已取消。": "status.recording.captureCancelled",
  "錄製儲存尚未就緒。": "status.recording.storageNotReady",
  "錄製已接納影格，不能丟棄完整資料。": "status.recording.acceptedProtected",
  "錄製準備逾時；請重試。": "status.recording.captureTimeout",
  "錄製儲存準備逾時須大於 0 且不超過 10000 ms。": "status.recording.storageTimeoutRange",
  "錄製儲存準備已有另一個等待擁有者。": "status.recording.storageOwner",
  "錄製儲存準備已取消。": "status.recording.storageCancelled",
  "錄製儲存準備逾時。": "status.recording.storageTimeout",
  "錄製儲存已失敗；請先中斷目前錄製。": "status.recording.storageFailedInterrupt",
  "錄製儲存仍在處理；降到低水位後才可繼續。": "status.recording.storageDraining",
  "錄製儲存不支援就緒確認。": "status.recording.storageUnsupported",
  "正在準備錄製…": "status.recording.preparing",
  "錄製評估準備逾時。": "status.recording.prepareTimeout",
  "錄製評估準備已取消。": "status.recording.prepareCancelled",
  "另一個操作正在準備錄製評估。": "status.recording.prepareOwner",
  "錄製評估工作者建立失敗。": "status.recording.prepareCreateFailed",
  "錄製評估準備傳送失敗。": "status.recording.prepareSendFailed",
  "錄製評估準備回覆協定無效。": "status.recording.prepareProtocol",
  "錄製評估準備錯誤回覆無效。": "status.recording.prepareErrorProtocol",
  "錄製評估 Worker 正在處理工作。": "status.recording.prepareWorkerBusy",
  "錄製 Worker 準備協定無效。": "status.recording.prepareRequestProtocol",
  "錄製評估 Worker 失敗。": "status.recording.workerFailed",
  "錄製評估 Worker 回覆無法解碼。": "status.recording.workerMessageFailed",
  "錄製評估已關閉。": "status.recording.evaluationClosed",
  "錄製評估已有進行中的工作。": "status.recording.evaluationBusy",
  "區域配置變更需要fresh physics run；不能沿用原區域進出事件重評。":
    "status.recording.zoneRegistryChanged",
  "區域事件重評需要原始配置以核對固定區域registry。": "status.recording.zoneBaselineRequired",
  "固定或區域音源需要明確的新遮蔽政策；舊錄製仍可原樣重播，請重新錄製後比較。":
    "status.recording.emitterPolicyRequired",
  "曲面或動態反射重評需要相同的新模型基準；舊錄製可原樣重播，請先重新錄製再比較。":
    "status.recording.modelBaselineRequired",
  "REVISION_CONFLICT：區域草稿已過期，請重新讀取。": "status.runtime.zoneRevisionConflict",
  "ZONE_EDIT_BLOCKED：請暫停並結束錄製／重播，在編輯器修改區域。": "status.runtime.zoneEditBlocked",
  "ZONE_IN_USE：請先改選或移除引用此區域的規則：": "status.runtime.zoneInUsePrefix",
  "錄製評估佇列已滿，已在完整 tick 邊界暫停；處理後可繼續。": "status.pipeline.evalPressure",
  "實驗工具：有界模擬與分析": "status.pipeline.toolRun",
  "實驗工具：相同運動比較": "status.pipeline.toolCompare",
  "錄製已切換；不接納舊評估結果。": "status.pipeline.evalStale",
  "沒有可用的錄製求解器。": "status.pipeline.evalMissing",
  "錄製評估接納失敗。": "status.pipeline.evalAdmission",
  "錄製評估仍在處理；降到低水位後才可繼續。": "status.pipeline.evalLowWater",
  "錄製評估已失敗；請先停止並保存完整前綴。": "status.pipeline.evalFailed",

  "短 take：由固定步進控制錄製": "status.pipeline.shortTakeCapturing",
  "短 take 已完成；可在音訊匯出產生混音與各聲源音檔。": "status.pipeline.shortTakeReady",
  "短 take 已完成；模擬保持暫停": "status.pipeline.shortTakePaused",

  "sceneRevision 必須為安全整數。": "status.scene.revision",
  "場景驗證失敗。": "status.scene.invalid",
  "放置預覽需要運行中的第一人稱控制。": "status.interaction.previewRunning",
  "物件預覽目前不可用。": "status.interaction.previewUnavailable",
  "放置已取消或場景版本已變更。": "status.interaction.placementCancelled",
  "幾何確認未完成；已取消放置。": "status.interaction.ackCancelled",
  "物件已放置，可直接操作。": "status.interaction.placed",
  "已選擇放置形狀；繼續後按住右鍵預覽。": "status.interaction.shapeSelected",
  "錄製或重播期間無法繪製軌跡；請先結束錄製或返回即時場景。": "status.interaction.paintTransport",
  "三公尺內沒有對準的物件；請以準心對準有聲音的物件。": "status.interaction.paintNothingAimed",
  "只有有聲音的物件可以繪製軌跡；此物件沒有聲音行為或聲源。": "status.interaction.paintNotAudible",
  "場景已變更；物件回到起始位置，重新開始這段 take。": "status.interaction.takeRestarted",
  "這條軌跡碰到固定幾何，不會執行；回到編輯器按 T 調整。": "status.interaction.paintedBlocked",
  "這條軌跡以目前強度移動太久，不會執行；回到編輯器按 T 提高強度或縮短軌跡。":
    "status.interaction.paintedTooLong",
  "同一段可執行的軌跡已達上限，這條不會執行；回到編輯器清除其他物件的軌跡。":
    "status.interaction.paintedTooMany",
  "PROJECT_CHANGED：原專案已切換；草稿保留。": "status.inspector.projectChanged",
  "STALE_RULE：原規則已變更或移除；草稿保留，請檢視後明示放棄再重新編輯。":
    "status.inspector.ruleChanged",
  "套用失敗；草稿保留。": "status.inspector.applyFailed",
  "物件覆寫套用失敗；草稿保留。": "status.inspector.overrideFailed",
  "無法準備清除覆寫。": "status.inspector.clearFailed",
  "音量 linear 必須介於 0 與 4，並提供有限數值。": "status.binding.gainRange",
  "音高 semitones 必須介於 -24 與 24，並提供有限數值。": "status.binding.pitchRange",
  "映射超過 8 條上限。": "status.mapping.maxCount",
  "DRAFT_INVALID：gainLinear 尚有無效或未完成的數值輸入。": "status.rule.gainIncomplete",
  "DRAFT_INVALID：pitchSemitones 尚有無效或未完成的數值輸入。": "status.rule.pitchIncomplete",
  "DRAFT_INVALID：cooldownSeconds 尚有無效或未完成的數值輸入。": "status.rule.cooldownIncomplete",
  "不完整或已取消的錄製不能宣稱完整 replay。": "status.replay.notComplete",
  "不支援的重播模式。": "status.replay.modeUnsupported",
  "Seek 必須使用整數 physics tick。": "status.replay.seekInteger",
  "Seek tick 不在錄製範圍。": "status.replay.seekRange",
  "硬質表面 · Synthetic": "status.material.hard",
  "吸音表面 · Synthetic": "status.material.soft",
  "木質示範 · Synthetic": "status.material.wood",
  "金屬示範 · Synthetic": "status.material.metal",
  "手工設定的示範頻帶係數；非材質量測、非振動合成。A+R+T=1，零透射。": "status.material.conditions",
  "尚未輸入Meta API金鑰；未送出請求。": "status.site.keyMissing",
  "已停止接受此提案；已送出的請求仍可能由Meta計費。": "status.site.stopped",
  "KEY_NOT_ENTERED：尚未輸入Meta API金鑰；未送出請求。": "status.site.keyMissingCoded",
  "AUTHENTICATION_ERROR：Meta拒絕此金鑰；請檢查後重試，或清除後改用其他金鑰。":
    "status.site.AUTHENTICATION_ERROR",
  "PERMISSION_DENIED：此金鑰沒有使用這個模型的權限。": "status.site.PERMISSION_DENIED",
  "QUOTA_EXCEEDED：此Meta帳號的額度不足。": "status.site.QUOTA_EXCEEDED",
  "MODEL_UNAVAILABLE：Meta目前未向此金鑰提供這個模型。": "status.site.MODEL_UNAVAILABLE",
  "RATE_LIMITED：Meta暫時限制此金鑰的請求；請稍後再試。": "status.site.RATE_LIMITED",
  "TIMEOUT：無法確認Meta是否已回覆；未自動重試以免重複計費。請檢查網路後再試。":
    "status.site.TIMEOUT",
  "BUDGET_EXCEEDED：此請求超出此頁的上限，未套用任何變更。請縮小指令或場景；若已達請求或費用上限，請重新載入並再次輸入金鑰。":
    "status.site.BUDGET_EXCEEDED",
  "CANCELED：請求已停止；已送出的內容仍可能由Meta計費。": "status.site.CANCELED",
  "已有Meta請求進行中，不能重複派送。": "status.server.requestActive",
  "READY_REQUIRES_EXPLICIT_REQUEST；只有提交指令才會呼叫模型；剩餘額度未知。":
    "status.provider.READY_REQUIRES_EXPLICIT_REQUEST",
  "NETWORK_DISABLED；Live validation NOT_RUN；剩餘額度未知。": "status.provider.NETWORK_DISABLED",
  "AUTHENTICATION_NOT_CONFIGURED；Live validation NOT_RUN；剩餘額度未知。":
    "status.provider.AUTHENTICATION_NOT_CONFIGURED",
  "MODEL_NOT_CONFIGURED；Live validation NOT_RUN；剩餘額度未知。":
    "status.provider.MODEL_NOT_CONFIGURED",
  "PROVIDER_UNVERIFIED；Live validation NOT_RUN；剩餘額度未知。":
    "status.provider.PROVIDER_UNVERIFIED",
  "ZERO_OR_INVALID_BUDGET；Live validation NOT_RUN；剩餘額度未知。":
    "status.provider.ZERO_OR_INVALID_BUDGET",
  "PRICING_UNVERIFIED；Live validation NOT_RUN；剩餘額度未知。":
    "status.provider.PRICING_UNVERIFIED",
  "INVALID_HOST_BUDGET；Live validation NOT_RUN；剩餘額度未知。":
    "status.provider.INVALID_HOST_BUDGET",
  "REQUEST_DEADLINE_EXCEEDED；Live validation NOT_RUN；剩餘額度未知。":
    "status.provider.REQUEST_DEADLINE_EXCEEDED",
  "REQUEST_IN_PROGRESS；Live validation NOT_RUN；剩餘額度未知。":
    "status.provider.REQUEST_IN_PROGRESS",
  "PLANNING_TURN_BUDGET_EXCEEDED；Live validation NOT_RUN；剩餘額度未知。":
    "status.provider.PLANNING_TURN_BUDGET_EXCEEDED",
  "COST_BUDGET_EXCEEDED；Live validation NOT_RUN；剩餘額度未知。":
    "status.provider.COST_BUDGET_EXCEEDED",
  尚未開始第一人稱控制: "status.interaction.notStarted",
  "互動控制器已清理。": "status.interaction.disposed",
  "輔助操作已選用；請明確開始／繼續": "status.interaction.alternativeSelected",
  "請明確開始／繼續並確認滑鼠鎖定": "status.interaction.confirmLock",
  "滑鼠已解鎖；明確繼續後恢復": "status.interaction.unlocked",
  "輔助操作設定必須為布林值。": "status.interaction.alternativeBoolean",
  "已選用不鎖定滑鼠的輔助操作；請明確開始／繼續": "status.interaction.alternativeEnabled",
  "已關閉輔助操作；請取得滑鼠鎖定後明確繼續": "status.interaction.alternativeDisabled",
  "必須先進入第一人稱，並取得滑鼠鎖定或明確選用輔助操作。": "status.interaction.inputRequired",
  "交易尚未完成。": "status.interaction.transactionPending",
  "請先明確啟用或取消待啟用物件，再繼續模擬。": "status.interaction.stagedBeforeResume",
  "持有物件的版本或幾何已變更；維持暫停，請明確釋放或回復場景。":
    "status.interaction.heldVersionChanged",
  "恢復抓取的目標空間受阻；維持暫停。": "status.interaction.grabSpaceBlocked",
  "持有物件已失效；維持暫停，請明確釋放或回復場景。": "status.interaction.heldInvalid",
  "輕放支撐已失效；已取消輕放並保留持有，請重新確認後繼續。": "status.interaction.supportInvalid",
  "放置交易尚未完成。": "status.interaction.placementPending",
  恢復前的物理驗證失敗: "status.interaction.resumeValidationFailed",
  已暫停: "status.interaction.paused",
  "已離開第一人稱；持有／預覽狀態保留": "status.interaction.exited",
  "持有物件時不能切換建造；請明確釋放或輕放。": "status.interaction.releaseBeforeBuild",
  已切換至介面焦點: "status.interaction.uiFocus",
  使用者暫停第一人稱: "status.interaction.userPaused",
  物件資料庫已開啟: "status.interaction.libraryOpen",
  "無效滑鼠按鈕。": "status.interaction.invalidButton",
  "抓取需要正在運行的第一人稱互動模式。": "status.interaction.grabNeedsActive",
  "已有持有物件。": "status.interaction.alreadyHeld",
  "三公尺內沒有可抓取物件。": "status.interaction.noGrabHit",
  "第一個命中物件已固定、受控或超過抓取預算。": "status.interaction.hitNotGrabbable",
  "物件已移除。": "status.interaction.objectRemoved",
  "物件太大，沒有合法持有距離。": "status.interaction.objectTooLarge",
  "投擲需要運行中的第一人稱互動。": "status.interaction.throwNeedsActive",
  "輕放需要正在持有物件。": "status.interaction.dropNeedsHeld",
  "沒有合法支撐面；仍維持持有，未自動釋放。": "status.interaction.noSupport",
  "輕放位置受阻；仍維持持有。": "status.interaction.dropBlocked",
  正在低速輕放: "status.interaction.dropping",
  "沒有明確固定／解除目標。": "status.interaction.noFreezeTarget",
  "沒有此物件版本的先前重力模式；請在Inspector明確選擇。": "status.interaction.noPreviousGravity",
  "受控運動物件需先在Inspector明確解除控制。": "status.interaction.controlledObject",
  正在固定物件: "status.interaction.freezing",
  "正在解除固定，速度預設為零": "status.interaction.unfreezing",
  "解除固定的物理世界已變更。": "status.interaction.unfreezeWorldChanged",
  "解除固定的物件已移除。": "status.interaction.unfreezeObjectRemoved",
  "解除固定的物件版本或模式已變更。": "status.interaction.unfreezeObjectChanged",
  "解除固定前的場景版本已變更。": "status.interaction.unfreezeSceneBefore",
  "解除固定位置受阻；物件保持固定，可清除障礙後重試。": "status.interaction.unfreezeBlocked",
  "解除固定後的場景版本已變更。": "status.interaction.unfreezeSceneAfter",
  "已固定；另按繼續才恢復模擬": "status.interaction.frozen",
  "已解除固定，初速為零；另按繼續": "status.interaction.unfrozen",
  "請先明確釋放持有物件。": "status.interaction.releaseFirst",
  "請先完成或取消目前放置。": "status.interaction.finishPlacement",
  "預覽必須使用新的穩定物件ID。": "status.interaction.newStableId",
  尚未取得表面: "status.interaction.awaitingSurface",
  放置位置超出範圍: "status.interaction.placementOutOfBounds",
  可放置: "status.interaction.placeable",
  沒有可放置表面: "status.interaction.noPlacementSurface",
  "放置確認：已安全暫停，建立待啟用物件": "status.interaction.stageCreating",
  "已建立待啟用物件；幾何確認後需明確啟用，再另按繼續。": "status.interaction.stagedCreated",
  "幾何確認的物件／版本已失效。": "status.interaction.geometryInvalid",
  "尚待聲學幾何確認，不能啟用。": "status.interaction.geometryPending",
  "待啟用物件或場景版本已變更，請重新確認。": "status.interaction.stagedChanged",
  "待啟用位置已被占用。": "status.interaction.stagedOccupied",
  "物件已啟用；模擬仍暫停，另按繼續。": "status.interaction.enabled",
  "輕放支撐或空間已失效；已取消輕放，仍維持持有。": "status.interaction.dropCancelledHeld",
  "尚未查詢本機Meta provider狀態；未呼叫模型。": "status.runtime.providerNotQueried",
  "選取物件編輯聲音行為；啟用聆聽後才建立音訊裝置。所有材質為 Synthetic 示範。":
    "status.runtime.initialNotice",
  使用者暫停: "status.runtime.userPaused",
  作者資料變更中斷目前錄製: "status.runtime.authoringInterrupted",
  "作者編輯：暫停並清理舊聲音": "status.runtime.authoringPaused",
  "重力模式已套用；恢復前需重新確認抓取／碰撞空間。": "status.runtime.gravityCheck",
  "重力模式已變更，原錄製以中斷狀態封存；持續聲源及游標保留。": "status.runtime.gravityInterrupted",
  "重力模式已變更；持續聲源、動量及播放游標保留。": "status.runtime.gravityChanged",
  "REVISION_CONFLICT：聲音配置已有後續變更，拒絕覆蓋。": "status.runtime.soundRevisionConflict",
  "重播已結束並暫停音訊；可重播或返回即時場景。": "status.runtime.replayEnded",
  "固定步負載超限，已暫停；未丟棄錄製 tick": "status.runtime.fixedStepOverrun",
  "錄製已暫停並保留固定步欠帳；可繼續逐批處理，或明確停止並封存目前連續資料。":
    "status.runtime.recordingDebtRetained",
  "Rapier／已接受互動事件": "status.runtime.acceptedInteraction",
  "聲學結果已超過3個固定步（20Hz更新窗口）；保留舊結果並標示過期，等待新解。":
    "status.runtime.acousticStale",
  "專案已載入；部分錄製原始資料不在此瀏覽器，保留hash參照，未宣稱可重播。":
    "status.runtime.projectMissingRecordings",
  "失去焦點／輸入所有權": "status.runtime.focusLost",
  "TRANSACTION_BUSY：請等待目前操作完成": "status.runtime.busy",
  "工作區切換：FPS互動安全暫停": "status.runtime.workspacePaused",
  "素材預聽；不屬於3D實驗結果。": "status.runtime.previewNotExperiment",
  "STOP_REPLAY_REQUIRED：請先返回即時場景再錄製": "status.runtime.stopReplayFirst",
  "已錄軌跡重播，未重新模擬物理": "status.runtime.recordedTrajectory",
  "重播已錄物理軌跡；未重新執行Rapier": "status.runtime.replayPhysics",
  "已返回暫停的即時場景；繼續時恢復原來源游標，不重發舊事件。": "status.runtime.liveSceneRestored",
  "Seek已截斷舊尾音；按繼續從保存的來源游標重播，不重發舊撞擊。": "status.runtime.seekTailCut",
  建立同運動比較快照: "status.runtime.comparisonSnapshot",
  "已還原原本的 ScenePinned Listener；觀察相機不改變量測位置。": "status.runtime.listenerRestored",
  "已儲存專案、可用音檔與已完成錄製至本機瀏覽器；跨裝置需另外攜帶原檔。":
    "status.runtime.savedBrowser",
  "已儲存專案；此環境的音檔與錄製為記憶體保存，關閉後需重新匯入。": "status.runtime.savedMemory",
  "NO_RECORDING：請先完成一次錄製": "status.runtime.noRecording",
  "使用Viewport的對準控制移動觀察相機，不改Listener。": "status.runtime.frameHint",
  "已啟用低音量監聽；請依實際裝置調整。dBFS未校準為dB SPL。": "status.runtime.listeningEnabled",
  "查詢本機設定；沒有模型呼叫。": "status.runtime.providerLoading",
  "本機API不可用；未呼叫模型。": "status.runtime.localApiUnavailable",
  錯誤後安全暫停: "status.runtime.errorPaused",
  "DISPOSED：工作台已卸載，取消提交。": "status.runtime.disposed",
  "離線工具模式；沒有Meta模型呼叫。": "status.runtime.offlineMode",
  先錄製同一物理軌跡: "status.runtime.recordFirst",
  "Numerical approximation · 一階有限面／零相位幅度": "status.runtime.acousticModel",
  直達延遲: "status.runtime.directDelay",
  真空沒有空氣傳播: "status.runtime.vacuumNoAir",
  "幾何距離/c": "status.runtime.distanceOverC",
  "未產生完整IR，無可擬合衰減": "status.runtime.noDecayFit",
  "Staged；確認後才啟用物理": "status.runtime.stagedReason",
  "錄製／比較操作仍在完成；請等待目前操作。": "status.recording.hostBusy",
  "操作已中斷；沒有發布不完整結果。": "status.recording.cancelled",
  "主程式提供的 run ID 無效。": "status.recording.invalidRunId",
  "錄製操作失敗。": "status.recording.failed",
  "請先完成或中斷目前錄製。": "status.recording.finishFirst",
  "錄製 frame 失敗。": "status.recording.frameFailed",
  "目前沒有錄製可以完成。": "status.recording.nothingToFinish",
  "錄製快照正在封存；完成後再重設。": "status.recording.sealing",
  "錄製完成後才可重播。": "status.recording.finishBeforeReplay",
  "尚無可重播的錄製。": "status.recording.noReplay",
  "請先開啟錄製重播。": "status.recording.openReplay",
  "A 必須來自完整錄製。": "status.recording.baselineCaptured",
  "比較欄位必須是 A 或 B。": "status.recording.invalidSlot",
  "請先完成錄製，才可重評 B。": "status.recording.finishBeforeB",
  "請先保存 A 錄製。": "status.recording.saveAFirst",
  "未提供實際 Behavior／聲學重評器，不能建立 B。": "status.recording.noProcessor",
  "固定步、取樣率、backend／physics version 或額外幾何／物理設定改變；不可假定相同實驗。":
    "status.recording.configurationMismatch",
  "A 與 B 都完成後才能比較。": "status.recording.bothSlotsRequired",
  "請先停止目前錄製或重播。": "status.recording.stopFirst",
  "先錄製，再保存 A；修改設定後重評 B。": "status.recording.comparisonInitial",
  "正在以 A 的相同運動／事件重評 B…": "status.recording.comparisonPending",
  "behavior A/B：固定條件相符。": "status.recording.behaviorCompatible",
  "acoustic A/B：固定條件相符。": "status.recording.acousticCompatible",
  "B 已重評；等待核對比較條件。": "status.recording.bReady",
  "A 已保存；B 將重用同一運動／事件 trace。": "status.recording.aReady",
  "Planner來源與請求模式不符，或缺少實際模型／response ID；尚無可驗證的Meta live結果。":
    "status.agent.provenanceInvalid",
  "已完成（Host回傳）": "status.agent.completed",
  尚未完成: "status.agent.pending",
  無法執行: "status.agent.blocked",
  執行失敗: "status.agent.failed",
  尚未確認結果: "status.agent.unknown",
  "離線指令示範可用；未使用Meta模型或額度。": "status.agent.offlineAvailable",
  "操作失敗，場景未被確認為成功。": "status.agent.operationFailed",
  "本次Agent session已達12回合或120秒上限，請建立新session。": "status.agent.sessionTurnLimit",
  "本次Agent session已達48工具或6次模擬上限。": "status.agent.sessionToolLimit",
  "不能在同一提案混合場景變更與實驗執行。": "status.agent.mixedProposal",
  "Host未回傳可確認的工具結果。": "status.agent.hostResultMissing",
  "本機解析與驗證提案中；沒有模型呼叫。": "status.agent.parsingOffline",
  "Muse正在規劃提案，通常需要10–60秒；場景尚未變更。": "status.agent.museWorking",
  "PROPOSAL_TOO_LONG：Muse的提案過長而被截斷，沒有可用內容；請縮小要求或分次提出。":
    "status.agent.proposalTooLong",
  "移動正式Listener；編輯camera保持獨立。": "status.preview.moveListener",
  "此操作替換現有物件與聲源；套用前請檢查，Undo可回復Scene。": "status.preview.replaceWarning",
  "Motion is authored only; starting it requires an explicit local run action.":
    "status.preview.motionAuthored",
  "Meta提出受限工具，尚待本地預覽與人員套用。": "status.agent.metaProposed",
  "Meta未提出可驗證操作，場景未變更。": "status.agent.metaProposedNothing",
  "檢查本機Meta provider gate。": "status.agent.checkingProvider",
  "聲音參數為創意設定，不代表量測聲壓或物件真實振動。": "status.agent.soundCreative",
  "Server驗證只涵蓋提供的snapshot；必須由本機Sound Host重新驗證並預覽。":
    "status.agent.soundServerScope",
  "提案已由Host套用並建立新revision；可使用復原。": "status.agent.applied",
  "提案已取消，沒有套用變更。": "status.agent.cancelled",
  "已復原提案並建立新revision；已播放的聲音不會倒轉。": "status.agent.undone",
  "RECOVERY_UNSAFE：請先暫停，並結束錄製、重播與其他操作。": "status.recovery.unsafe",
  "RECOVERY_ACTIVE：這份錄製仍由其他工作階段使用。": "status.recovery.active",
  "RECOVERY_MISSING：找不到這份中斷錄製。": "status.recovery.missing",
  "RECOVERY_EMPTY：這份錄製尚無可復原的完整影格。": "status.recovery.empty",
  "RECOVERY_IDENTITY：復原資料的來源與所選記錄不符。": "status.recovery.identity",
  "RECOVERY_STATE：只能載入已驗證的中斷錄製。": "status.recovery.state",
  "Meta回覆含禁止的credential資料，未接受或保存內容。": "status.client.metaCredential",
  "Meta回覆缺失、拒絕或角色無效，未套用變更。": "status.client.metaEnvelope",
  "Meta回覆未完整完成，未接受提案。": "status.client.metaIncomplete",
  "Meta回覆不是有效UTF-8，未接受內容。": "status.client.metaUtf8",
  "本機API未回傳完整JSON；尚未接受提案。": "status.client.incompleteJson",
  "Planner暫時不可用，手動操作仍可使用。": "status.client.unavailable",
  "本機API回傳格式無效；尚未接受提案或provider狀態。": "status.client.schemaInvalid",
  "Provider狀態格式不符；尚無可用的live能力證據。": "status.client.providerSchemaInvalid",
  "請輸入1–4000字的指令。": "status.offline.inputLimit",
  "材質registry尚未提供。": "status.offline.materialRegistryMissing",
  "此為本機確定性指令示範，不是Meta模型輸出。": "status.offline.deterministic",
  "未指定尺寸／位置使用可在預覽修改的系統預設。": "status.offline.defaultAssumptions",
  "這項要求超出場景／實驗工具權限；不會執行OS、程式或變更權限。": "status.offline.noOsPermissions",
  "要求超出允許工具範圍，場景未變更。": "status.offline.outOfScope",
  "離線示範每次最多建立8個物件，請分批預覽。": "status.offline.objectLimit",
  "離線指令示範尚未辨識這項要求；請使用Inspector，或輸入「新增一顆無重力發聲球」。":
    "status.offline.unrecognized",
  "離線解析器只提出明示的物件／聲源設定；互動trigger需在Sound Behavior Inspector確認，不把速度當Throw。":
    "status.offline.interactionWarning",
  "Registry沒有精確匹配的音檔；不會捏造或下載。可用聲源明示為系統示範訊號。":
    "status.offline.noMatchingAudio",
  "尚無授權訊號，提案只建立物件，不假裝已設定音效。": "status.offline.noApprovedSignal",
  "尚未產生可套用操作。": "status.offline.noOperations",
  "聲音要求必須為1–4000字。": "status.sound.inputLimit",
  "聲音提案沒有OS、repository、帳務或政策修改權限。": "status.sound.noPermissions",
  "離線解析器未辨識聲音行為要求；請使用Inspector設定。": "status.sound.unrecognized",
  "所選物件已不存在，請重新選取。": "status.sound.objectMissing",
  "請先建立並選取場景物件，再設定Sound Behavior。": "status.sound.selectObjectFirst",
  "本機確定性聲音提案，不是Meta模型輸出。": "status.sound.deterministic",
  "音量與音高為創意設定；不代表量測聲壓或物件振動。": "status.sound.creativeNotMeasured",
  "未指定物件，預覽選用現有registry的第一個物件；套用前請確認。":
    "status.sound.firstObjectAssumption",
  "Registry沒有可用且權利已確認的鋼琴音檔；此預覽使用C4合成sine示範，並非鋼琴錄音。":
    "status.sound.noPianoAsset",
  "此提案使用明示的基本合成器，不捏造錄音素材或真實材質振動。": "status.sound.basicSynth",
  "共用Profile變更超過單包32操作，請在Inspector分批設定。": "status.sound.sharedOperationLimit",
  "BINDING_METADATA_UNAVAILABLE：尚未提供完整的基底、覆寫與版本資料；目前無法編輯此物件覆寫。":
    "status.binding.metadataUnavailable",
  "BINDING_METADATA_INVALID：物件行為版本資料無效；目前無法編輯覆寫。":
    "status.binding.metadataInvalid",
  "BINDING_METADATA_INVALID：基底參數未提供有限值；目前無法編輯覆寫。":
    "status.binding.baseInvalid",
  "啟用覆寫必須是布林值。": "status.binding.enabledBoolean",
  "BINDING_MISSING：原綁定或規則已移除，或無法唯一識別；覆寫草稿保留。": "status.binding.missing",
  "STALE_BINDING：場景、行為文件或原綁定已變更；覆寫草稿保留，請明示放棄後重新編輯。":
    "status.binding.stale",
  "BINDING_ACK_MISSING：尚未收到符合覆寫草稿的綁定與文件版本；草稿保留。":
    "status.binding.ackMissing",
  "DRAFT_INVALID：草稿與規則 ID 不符。": "status.rule.idMismatch",
  "RULE_MISSING：原規則已移除或無法唯一識別；草稿保留。": "status.rule.missing",
  "STALE_REVISION：場景或行為文件已變更；原草稿版本保留。": "status.rule.sceneStale",
  "STALE_BINDING：原物件行為 binding 已替換；草稿保留。": "status.rule.bindingStale",
  "STALE_PROFILE：原聲音行為 profile 已替換；草稿保留。": "status.rule.profileStale",
  "STALE_REVISION：聲音行為版本已變更；請檢查草稿後重試。": "status.rule.revisionStale",
  "RULE_ACK_MISSING：尚未收到符合草稿的規則版本；草稿保留。": "status.rule.ackMissing",
  "只有完整且有 frame 的錄製可以重播音訊。": "status.replay.incomplete",
  "Seek 後請先 Resume，才能繼續排程音訊。": "status.replay.resumeAfterSeek",
  "錄製缺少完整的 Behavior 狀態／VoiceIntent，無法重播聲音。": "status.replay.behaviorMissing",
  "Replay frame 與已驗證的原錄製不同。": "status.replay.frameMismatch",
  "Behavior 輸入／狀態／事件與錄製時鐘不同。": "status.replay.behaviorClockMismatch",
  "錄製 AudioEvent schema 無效。": "status.replay.audioEventInvalid",
  "錄製 VoiceIntent 的來源／參數與原始文件不同。": "status.replay.voiceIntentMismatch",
  "錄製音訊 cursor 超出有界來源集合。": "status.replay.cursorBounds",
  "錄製音訊 cursor 的時鐘或來源無效。": "status.replay.cursorInvalid",
  "錄製聲源的 binding／profile／物件世代不符。": "status.replay.bindingMismatch",
  "錄製聲源必須對應唯一同 tick 的聲學路由。": "status.replay.acousticRouteMissing",
  "Pitch mapping 的錄製缺少真正 source cursor，無法精確恢復聲音相位。":
    "status.replay.sourceCursorMissing",
  "瀏覽器未提供滑鼠鎖定，仍可使用下方按鈕操作。": "status.pointer.unavailable",
  "無法鎖定滑鼠；請使用替代操作，或明示重試。": "status.pointer.failed",
  "WebGL 顯示已中斷；已暫停運算。畫面恢復後請明示繼續。": "status.graphics.contextLost",
  "只接受授權的本機介面。": "status.server.localOnly",
  "找不到此API。": "status.server.unknownRoute",
  "請求無效；未執行場景變更。": "status.server.invalidRequest",
  "SIZE_LIMIT：專案 JSON 超過 8 MiB。": "status.project.sizeLimit",
  "PROJECT_INVALID：專案根資料必須是 JSON 物件。": "status.project.invalidRoot",
  "無法讀取專案 JSON。": "status.project.readFailed",
};

/** Only use these keys when the original diagnostic actually contains this code.
 * The renderer must keep the original code and diagnostic detail visible.
 */
export const statusCodeKeys: Readonly<Record<string, keyof typeof statusMessages>> = {
  KEY_NOT_ENTERED: "status.code.KEY_NOT_ENTERED",
  PLACEMENT_AUDIO_RESTART: "status.code.PLACEMENT_AUDIO_RESTART",
  PLACEMENT_TRANSPORT: "status.code.PLACEMENT_TRANSPORT",
  PLACEMENT_TIMEOUT: "status.code.PLACEMENT_TIMEOUT",
  AUDIO_BUFFER_UNSAFE: "status.code.AUDIO_BUFFER_UNSAFE",
  AUDIO_BUFFER_BUSY: "status.code.AUDIO_BUFFER_BUSY",
  AUDIO_BUFFER_INVALID: "status.code.AUDIO_BUFFER_INVALID",
  AUDIO_BUFFER_EXTERNAL_CONTEXT: "status.code.AUDIO_BUFFER_EXTERNAL_CONTEXT",
  AUDIO_BUFFER_RESTART_FAILED: "status.code.AUDIO_BUFFER_RESTART_FAILED",
  PROJECT_CHANGED: "status.code.PROJECT_CHANGED",
  STALE_RULE: "status.code.STALE_RULE",
  INCOMPATIBLE_EXPERIMENTS: "status.code.INCOMPATIBLE_EXPERIMENTS",
  ASSET_RELINK_MISMATCH: "status.code.ASSET_RELINK_MISMATCH",
  WAV_SAMPLE_OUT_OF_RANGE: "status.code.WAV_SAMPLE_OUT_OF_RANGE",
  REPLAY_MODE: "status.code.REPLAY_MODE",
  SEEK_TICK: "status.code.SEEK_TICK",
  SEEK_RANGE: "status.code.SEEK_RANGE",
  VALID: "status.code.VALID",
  OUT_OF_BOUNDS: "status.code.OUT_OF_BOUNDS",
  OVERLAP: "status.code.OVERLAP",
  READY_REQUIRES_EXPLICIT_REQUEST: "status.code.READY_REQUIRES_EXPLICIT_REQUEST",
  NETWORK_DISABLED: "status.code.NETWORK_DISABLED",
  AUTHENTICATION_NOT_CONFIGURED: "status.code.AUTHENTICATION_NOT_CONFIGURED",
  MODEL_NOT_CONFIGURED: "status.code.MODEL_NOT_CONFIGURED",
  PROVIDER_UNVERIFIED: "status.code.PROVIDER_UNVERIFIED",
  ZERO_OR_INVALID_BUDGET: "status.code.ZERO_OR_INVALID_BUDGET",
  PRICING_UNVERIFIED: "status.code.PRICING_UNVERIFIED",
  INVALID_HOST_BUDGET: "status.code.INVALID_HOST_BUDGET",
  REQUEST_DEADLINE_EXCEEDED: "status.code.REQUEST_DEADLINE_EXCEEDED",
  REQUEST_IN_PROGRESS: "status.code.REQUEST_IN_PROGRESS",
  PLANNING_TURN_BUDGET_EXCEEDED: "status.code.PLANNING_TURN_BUDGET_EXCEEDED",
  COST_BUDGET_EXCEEDED: "status.code.COST_BUDGET_EXCEEDED",
  REVISION_CONFLICT: "status.code.REVISION_CONFLICT",
  TRANSACTION_BUSY: "status.code.TRANSACTION_BUSY",
  DISPOSED: "status.code.DISPOSED",
  INVALID_INPUT: "status.code.INVALID_INPUT",
  UNKNOWN_OBJECT: "status.code.UNKNOWN_OBJECT",
  EMPTY_PATCH: "status.code.EMPTY_PATCH",
  REVERB_BOUNDS: "status.code.REVERB_BOUNDS",
  ASSET_NOT_READY: "status.code.ASSET_NOT_READY",
  STOP_REPLAY_REQUIRED: "status.code.STOP_REPLAY_REQUIRED",
  TRAJECTORY_NOT_AUDIBLE: "status.code.TRAJECTORY_NOT_AUDIBLE",
  TRAJECTORY_USE_SET_TRAJECTORY: "status.code.TRAJECTORY_USE_SET_TRAJECTORY",
  MOTION_PATH_ACTIVE: "status.code.MOTION_PATH_ACTIVE",
  PLAYER_RESPAWN_BLOCKED: "status.code.PLAYER_RESPAWN_BLOCKED",
  REPLAY_UNAVAILABLE: "status.code.REPLAY_UNAVAILABLE",
  NO_RECORDING: "status.code.NO_RECORDING",
  INVALID_SEEK_TIME: "status.code.INVALID_SEEK_TIME",
  META_PROVIDER_BLOCKED: "status.code.META_PROVIDER_BLOCKED",
  NO_SAVED_PROJECT: "status.code.NO_SAVED_PROJECT",
  RIGHTS_CONFIRMATION_REQUIRED: "status.code.RIGHTS_CONFIRMATION_REQUIRED",
  ASSET_SIZE_LIMIT: "status.code.ASSET_SIZE_LIMIT",
  LIVE_AUDIO_RESTORE: "status.code.LIVE_AUDIO_RESTORE",
  RECORDING_REFERENCE_MISMATCH: "status.code.RECORDING_REFERENCE_MISMATCH",
  BINDING_METADATA_UNAVAILABLE: "status.code.BINDING_METADATA_UNAVAILABLE",
  BINDING_METADATA_INVALID: "status.code.BINDING_METADATA_INVALID",
  BINDING_MISSING: "status.code.BINDING_MISSING",
  STALE_BINDING: "status.code.STALE_BINDING",
  STALE_PROFILE: "status.code.STALE_PROFILE",
  STALE_REVISION: "status.code.STALE_REVISION",
  DRAFT_INVALID: "status.code.DRAFT_INVALID",
  BINDING_ACK_MISSING: "status.code.BINDING_ACK_MISSING",
  RULE_MISSING: "status.code.RULE_MISSING",
  RULE_ACK_MISSING: "status.code.RULE_ACK_MISSING",
  HOST_BUSY: "status.code.HOST_BUSY",
  OPERATION_CANCELLED: "status.code.OPERATION_CANCELLED",
  RUN_ID: "status.code.RUN_ID",
  RECORDER_ACTIVE: "status.code.RECORDER_ACTIVE",
  NO_CAPTURED_RECORDING: "status.code.NO_CAPTURED_RECORDING",
  COMPARISON_SLOT: "status.code.COMPARISON_SLOT",
  NO_BASELINE: "status.code.NO_BASELINE",
  COMPARISON_SLOTS: "status.code.COMPARISON_SLOTS",
  INCOMPLETE_RECORDING: "status.code.INCOMPLETE_RECORDING",
  REPLAY_PAUSED: "status.code.REPLAY_PAUSED",
  CAPABILITY_UNSUPPORTED: "status.code.CAPABILITY_UNSUPPORTED",
  INPUT_PROVENANCE_MISMATCH: "status.code.INPUT_PROVENANCE_MISMATCH",
  INVALID_AUDIO_EVENT: "status.code.INVALID_AUDIO_EVENT",
  INVALID_AUDIO_CURSOR: "status.code.INVALID_AUDIO_CURSOR",
  ACOUSTIC_FRAME_UNAVAILABLE: "status.code.ACOUSTIC_FRAME_UNAVAILABLE",
  PROVIDER_REQUEST_FAILED: "status.code.PROVIDER_REQUEST_FAILED",
  SCHEMA_INVALID: "status.code.SCHEMA_INVALID",
  INPUT_LIMIT: "status.code.INPUT_LIMIT",
  UNKNOWN_ID: "status.code.UNKNOWN_ID",
  POLICY_DENIED: "status.code.POLICY_DENIED",
  BUDGET_EXCEEDED: "status.code.BUDGET_EXCEEDED",
  ASSET_HOST_BUSY: "status.code.ASSET_HOST_BUSY",
  HASH_UNAVAILABLE: "status.code.HASH_UNAVAILABLE",
  OFFLINE_AUDIO_UNAVAILABLE: "status.code.OFFLINE_AUDIO_UNAVAILABLE",
  DECODED_MEMORY_BUDGET: "status.code.DECODED_MEMORY_BUDGET",
  ASSET_STAGING_RATE: "status.code.ASSET_STAGING_RATE",
  WAV_DECODE_MISMATCH: "status.code.WAV_DECODE_MISMATCH",
  ASSET_COUNT_BUDGET: "status.code.ASSET_COUNT_BUDGET",
  ASSET_DESCRIPTOR_HASH: "status.code.ASSET_DESCRIPTOR_HASH",
  ASSET_DESCRIPTOR_ONLY: "status.code.ASSET_DESCRIPTOR_ONLY",
  ASSET_GENERATOR: "status.code.ASSET_GENERATOR",
  ASSET_PCM_HASH: "status.code.ASSET_PCM_HASH",
  ASSET_REQUIRED_MISSING: "status.code.ASSET_REQUIRED_MISSING",
  ASSET_REFERENCE_MISMATCH: "status.code.ASSET_REFERENCE_MISMATCH",
  ASSET_RIGHTS_UNVERIFIED: "status.code.ASSET_RIGHTS_UNVERIFIED",
  ASSET_PREPARED_STALE: "status.code.ASSET_PREPARED_STALE",
  ASSET_HASH: "status.code.ASSET_HASH",
  ASSET_STORAGE: "status.code.ASSET_STORAGE",
  INVALID_WAV: "status.code.INVALID_WAV",
  WAV_CAPABILITY_UNSUPPORTED: "status.code.WAV_CAPABILITY_UNSUPPORTED",
  WAV_CHANNEL_BUDGET: "status.code.WAV_CHANNEL_BUDGET",
  WAV_RATE_UNSUPPORTED: "status.code.WAV_RATE_UNSUPPORTED",
  WAV_DURATION_BUDGET: "status.code.WAV_DURATION_BUDGET",
  SIZE_LIMIT: "status.code.SIZE_LIMIT",
  PROJECT_INVALID: "status.code.PROJECT_INVALID",
  UNKNOWN_FIELD: "status.code.UNKNOWN_FIELD",
  NON_JSON_VALUE: "status.code.NON_JSON_VALUE",
  CYCLE: "status.code.CYCLE",
  ACOUSTIC_PAYLOAD_BUDGET: "status.code.ACOUSTIC_PAYLOAD_BUDGET",
  ACOUSTIC_PAYLOAD_INVALID: "status.code.ACOUSTIC_PAYLOAD_INVALID",
  SOURCE_BUDGET_EXCEEDED: "status.code.SOURCE_BUDGET_EXCEEDED",
  PATH_BUDGET_EXCEEDED: "status.code.PATH_BUDGET_EXCEEDED",
  ACOUSTIC_BATCH_IDENTITY: "status.code.ACOUSTIC_BATCH_IDENTITY",
  ACOUSTIC_TIMEOUT_BOUNDS: "status.code.ACOUSTIC_TIMEOUT_BOUNDS",
  ACOUSTIC_WORKER: "status.code.ACOUSTIC_WORKER",
  ACOUSTIC_MESSAGE_ERROR: "status.code.ACOUSTIC_MESSAGE_ERROR",
  ACOUSTIC_POST_MESSAGE_FAILED: "status.code.ACOUSTIC_POST_MESSAGE_FAILED",
  SOLVER_BUSY: "status.code.SOLVER_BUSY",
  ACOUSTIC_TIMEOUT: "status.code.ACOUSTIC_TIMEOUT",
  ACOUSTIC_REPLY_INVALID: "status.code.ACOUSTIC_REPLY_INVALID",
  ACOUSTIC_REPLY_IDENTITY: "status.code.ACOUSTIC_REPLY_IDENTITY",
  AUTHORING_CANCELLED: "status.code.AUTHORING_CANCELLED",
  GRAVITY_MODE_CHANGED_CANCELLED: "status.code.GRAVITY_MODE_CHANGED_CANCELLED",
};

/** Catalogued parameterized messages. Each zh-TW template, anchored over the whole
 * raw message, is the match; a {detail} value is itself formatted, so an unknown
 * detail keeps its original text under the explicit original-detail label.
 */
export const templateStatusKeys: readonly (keyof typeof statusMessages)[] = [
  "status.template.agentMetaSound",
  "status.template.agentLocalSound",
  "status.template.agentRemoveBinding",
  "status.template.agentBind",
  "status.template.agentOverridePitch",
  "status.template.agentOverrideGain",
  "status.template.agentOverrideOn",
  "status.template.agentOverrideOff",
  "status.template.policyDenied",
  "status.template.providerRequestFailed",
  "status.runtime.zoneInUse",
  "status.pipeline.evalFailureDetail",
  "status.recording.storageInterruptedPrefix",
  "status.scene.detail",
  "status.scene.sphere",
  "status.scene.capsule",
  "status.scene.duplicate",
  "status.scene.quaternion",
  "status.scene.reference",
  "status.template.catchUpDropped",
  "status.template.audioAdmission",
  "status.template.projectLoaded",
  "status.template.audioSavedForProject",
  "status.template.audioSaved",
  "status.template.metaStatus",
  "status.template.enterFailed",
  "status.template.resumeFailed",
  "status.template.frozenSyncFailed",
  "status.template.unfrozenSyncFailed",
  "status.template.modeChangeFailed",
  "status.template.cannotPlace",
  "status.template.placeOccupied",
  "status.template.geometryAckFailed",
  "status.template.placeFailed",
  "status.template.enableFailed",
  "status.template.cancelStagedFailed",
  "status.template.recordingInterrupted",
  "status.template.recordingDiscarded",
  "status.template.comparisonMismatch",
  "status.agent.acousticBudget",
  "status.agent.proposalRejected",
  "status.preview.add",
  "status.preview.move",
  "status.preview.resize",
  "status.preview.removeWithBoth",
  "status.preview.removeWithSources",
  "status.preview.removeWithPaths",
  "status.preview.remove",
  "status.preview.material",
  "status.preview.mode",
  "status.preview.source",
  "status.preview.roomWithPaths",
  "status.preview.room",
  "status.preview.surfaceWarning",
  "status.preview.movedPathWarning",
  "status.preview.motionLine",
];
