# Claude 交接範圍唯讀核實

本輪只整理交接，沒有續做產品、browser、native、build 或測試。Integration HEAD 為 448a503f5373faccc19aa17c6789ffc01bc26017。原開發 goal 已 paused；M4 與 CONTRACT 的 ACTIVE 文字是歷史截點，不能當目前繼續執行授權。此頁不取代正式來源。

## 目前原 task 判定

- Task0032 IN_PROGRESS：AC01=true；AC02–09=false。完整目標不是只修頂列或讓單一測試通過。
- Task0033 IN_PROGRESS：AC01/03/04/05=true；AC02/06/07=false。頂列四模式、資料/單位與觀測資源的有限證據已支持前四者；錄製/來源連續性、完整真 UI 與最終品質/文件仍未結案。
- Task0016 BACKLOG：AC01/02=false；AC03/04 歷史 true 只維持其原 evidence 範圍，不能冒最新整合與本輪英文全面通過。
- Task0020 BLOCKED：AC01/02 歷史 true；AC03=false。原 AC01 要三次乾淨產品 E2E、十次 reset/import/dispose；新來源須重查對帳。不要將歷史 true 擅自回寫 false 或藉新候選宣稱 current。
- 原 PERF001–008/011/014 目前仍 BACKLOG、各 criteria false；umbrella 允許候選並行，不代表原 task 依賴已結案。

## 完整範圍與禁止擅自縮減

正式入口：docs/11-v1/ACCEPTANCE.md、ACCEPTANCE_AMENDMENTS.md、docs/16-nonadvanced-completion/CONTRACT.md 與 BASELINE_20261103.json。PERF001/014 歸因與原 600 秒、002 錄製逐 tick、003 native scalar/shape/delay/direction、004 latest-valid 與 pending event、005 geometry/transport、006 phase voice policy、007 asset residency、008 chunk storage、011 long PCM，及 Task16/20 全品質/逐需求對帳均仍在 scope。

排除 Task0015/PERF009/010/012；cloud013 未授權。paid API 為0，不 push/deploy/提交競賽或代接受條款。保留原負載、caps、數值容差與 FAIL；不能減 voices/paths、刪欠步、自動 Resume 或丟 accepted tick 來換綠。

正常100%是目前必要顯示比例，200%已由使用者移除；不得重新列必要 gate。使用者已確認先前基本功能正常，不要求重做同一輪舊人工測試；新功能與新性能仍需 Claude 後人工/聽測。

## 容易被主線報告漏掉的剩餘工作

1. Acoustic cache/compact packet 僅候選：clone reference 仍預設，需同一真105物件/100dynamic、真physics/behavior/request corpus的A未快取clone/B快取clone/C未快取packet/D快取packet，同條件 oracle、copy/allocation/age/onset/consumer 成本與全部 stale/cancel/ownership 負例。JSON wire bytes 下降不等 native structured-clone 成本收益。
2. 音訊資源 virtualization/native carrier 雖有短 PCM phase/lifecycle 證據，resource policy 仍 reference/off；需同輸入成本、原有效容量、onset/phase/retiring/pending/resource cap 負例，不能用較少 render voices 換正式容量通過。
3. Asset scoped lease/LRU/cold restore/decode staging 已有實作與69/69有限 Node證據；runtime recording/replay/offline finally 已另整合，static-preview rapid replacement 有後續修補。原資產報告中尚待事項仍要真 OAC 44.1/48k、mono/stereo/cancel/cold reload 原 PCM、rights/active-retiring-pending pin保護、同負載resident/staging峰值與reload latency；引用解除不等GC/process RAM立即下降，native decoder scratch=null。
4. Meta server 有 envelope/redirect/credential/reader ownership/UTF8 的窄修及63/63+75/75；不能宣稱原315 mock失敗唯一根因已證。當前產品 offline/fixture→Preview/Apply/Run/Capture/Analyze、grounding/拒絕/rollback需新真UI。公開provider文件不是authenticated catalog、key、account access、billing或目前live；新paid0，不新增inference。歷史最小 Sound live 不證 Scene/模型Run/UI/grounded comparison live。
5. 長管線需真60秒signal/3600accepted tick、48k stereo、2stableowners、2秒tail總62秒2,976,000frames；5WAV(master/raw/simulated/2ownerstems)+manifest，單WAV23,808,056B、總119,040,280B。3601inclusive只容量fixture，不多一tick擴renderwindow。context75s、tail0..10、working256MiB估算、output192MiB、archive384MiB/64jobs、chunk32768及capture18000frames/64MiB不變。真長輸出數值FAIL仍在，不能以短phase成功取代。
6. 四水位accepted/processed/persisted/published、transaction oncomplete、跨tab foreign-writer/WebLocks、cancel/crash/reload/incomplete、archive/recover/download/delete/discard與保留舊成果，均需新來源真browser。schema/canonical recording hash與chunk hash不同，保compat/migration負例。
7. S4全22routes尚未執行。docs/16-nonadvanced-completion/lanes/ui/s4/CURRENT_RUNBOOK.md列完整命令；必須--lanes all（預設只有recovery）。249是mixed registry rows=歷史217+21overlap scenarios+11topmonitor，不是249唯一參數/全PASS。範圍涵蓋Editor/FPS/Build/focus/IME/lock、雙語、所有可達控制/Help/disabled理由、合法/非法/精確邊界、undo/持久化與完整真下載/RIFF/stem校驗。runner不build/不啟server；需新source/bundle/exe/HTTP freeze、單browser、保留原結果。
8. Windows Computer Use 仍方法特定 URL-confidence gate 未通過，不可用DOM/OAC/碼審冒native。遵守SKILL與停止要求；不要繞過URL政策、讀私人Brave或使用private IPC。若工具仍阻擋，只能讓使用者手動建立指定可信local產品視窗再按工具規則辨識，仍不保證解除。
9. 原51 requirements需逐條現在來源裁決；草稿矩陣不能直接當最終驗收。完整npm run check、build、全browser/cleanup次數、numeric/physics/acoustic/audio/reference、原600、source/license/CI/可重現命令、獨立review與外部門檻皆不可漏。根LICENSE、本人資格/條款與競賽提交/發行授權仍由使用者決定；本輪不會代接受。Hi-X65/D3V裝置聽測、SPL/科學量測不是數位PCM通過可替代。

## 英文與記憶實際現況

108 targets與batch02另30 targets已分別提交，不是所有英文最終驗收。最後一次全域 finalize 原始結果仍INCOMPLETE/exit1：575 originals、593 Markdown inventory、545 translation_required且545 translated、0missing/0stale、4errors/15warnings。

四error皆docs/en/11-v1/REQUIREMENT_EVIDENCE_20261027.md歷史test-results href缺檔；只改四href至已提交同bytes aliases 的修補已dirty，new SHA b31ff1eeae3a51b068bdf4b1793fe8f2d83994612ff25e3112e094c390043dfa。Canonical/source/claims未改，single-target scoped PASS1/1/0errors/warnings且review已閉；但修補後global finalize/check尚未重跑。docs/en/index.md/manifest.json/validation.json及多個英文檔案仍dirty，保留。再次finalize前先保存原FAIL validation/manifest/log，再用新attempt；勿篡改原raw或將0missing/stale寫成全英文PASS。後續新handoff/新canonical會另增current/stale需求。

M4交接固定1f3779，後續Store-ready949、全英文batch、V4實跑與新observer尚需新的記憶里程碑；不要倒改M4原始截點。階段/source/task/wiki/Now/English需一致，事件/transaction/claim保留。原owner lease目前仍未過期，不擅自刪claim。以新handoff說明paused/轉交Claude，不把剩餘task關DONE。

## 本審核限制

只讀Git/正式檔案與現存報告，無產品修改/測試/瀏覽器/進程輸入；未重新驗證每份底層raw。精確主要來源path/bytes/SHA與task flags保存在scope-audit.json。原scope snapshot和stage中較早NOT_RUN/ACTIVE是歷史，最新實際執行由Root其他審核交叉補充。

## 原先六項核心的歷史交付（不要與本輪較廣性能工程混淆）

精確功能名稱見docs/14-core-pipeline/IMPLEMENTATION_CONTRACT.md：01錄製與A/B有界evaluation、02成本觀測與native音訊更新拆責、03 UI/AI/Preview/Host共用能力與最小Bounce producer、04 Meta工具UI閉環、05 Motion authoring/SetTrajectory、06短take full mix/object stems renderer。這些已有原核心實作與本機Main整合歷史；後續Zone enter/exit、曲面/動態反射、Project environment持久化亦有Task0029/30/31有限交付，不是本輪重新從零。

原最後短管線docs/14-core-pipeline/stages/12-final-integrated-ui-audio.md綁5010685：Playwright真DOM錄180連續tick19..198（3秒），產品OAC下載5個float32 stereo48k WAV+manifest，每檔240000frames=5秒含2秒tail、1,920,056B；獨立RIFF/stem-sum誤差1.1420343071222305e-6<原2e-6。實體輸出在D:/Developing/Meta Hack/exports/core-pipeline-20261102/integrated-final/render-37c82ed6-7aaf-4b4a-9537-a718b75b46ab/。historyIncomplete=true與browserManagedUnspecified HRTF保留；pre-master浮點可>1且manifest精確報告，安全master要求0超界，勿重新normalize或錯當SPL。

這是舊來源的短管線PASS，不抵本輪最新來源60秒capture/62秒長輸出/全參數/正式600/原生ComputerUse或聽測。Stage12文字較早稱native access timeout；後來第四輪已Ctrl+N成功後URLpolicy STOP，最新方法分類docs/15-ui-parameter-audit/NATIVE_GATE_CLASSIFICATION_20261102.json優先於舊時間截點。
