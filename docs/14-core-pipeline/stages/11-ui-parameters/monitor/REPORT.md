# Monitor／Footer 參數實測與修補

日期：2026-11-02。Lane：audio_core。介面保持既有設計語言，沒有改全域CSS、NumberField或其他面板。中央inventory的10個semantic families與13個AST sites，對照見[summary.json](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/515490210e23636e835cf7b1ac577eb74ee7a3c8)。

## 方法與來源

- 使用獨立Chrome156.0.8078.75 context、1600×1100 CSS pixels、deviceScaleFactor=1。只由真DOM locator、pointer與keyboard改值；evaluate只讀DOM／focus／native validity，不使用bridge、內部engine state或測試模式。
- 基準為4173的 `/assets/index-BDGeI4Sd.js`：[audit-baseline.json](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/9af4cafa71b78376e0be644041b6928c204cb98c)，39 cases＝36 PASS／3 FAIL。首次參數盤點與原生ARIA／圖另保存。
- 修正版為主代理提供的a10b741，entry `/assets/index-BmjZ1Zyf.js`，實際下載的JS SHA-256=`0ed373c786549c63413e9ef5cac502630df727ba9a1d331c988c2101c8a5d42a`：[retest-final-a10b741.json](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/5aaca7e38be154a6b2a9ff598c2b65522c4fab71)，受影響範圍11/11 PASS、0 pageerrors。Browser已finally關閉並釋放獨佔lease。
- 這不是裝置聽測、DSP性能、實體鍵鼠或整體V1驗收。兩輪是不同來源，不把數量相加，也不宣稱舊39 cases全部在新來源重跑。

## 逐參數覆蓋

| 參數／控制 | 已實際操作與結果 |
| --- | --- |
| 啟用／靜音 | 基準真click與Space／Enter循環通過；新來源啟用沿用desired gain／Raw，click靜音及safe-final通過。啟用沒有啟動模擬。 |
| 監聽音量 | 原啟用前Home回0dB為FAIL；修補後啟用前−40／+12上下界、超界箭頭鉗制、啟用與三次重建均保留。基準另有pointer調整與非數字鍵不改值證據。 |
| 三種buffer | 預設Stable；基準未啟用選擇、三preset切換與keyboard通過；新來源三次重建保留gain／route／mute，lookahead60／80／120ms有DOM回讀。 |
| Raw／Simulated | 原啟用前Raw為FAIL；修補後啟用前Raw可見且未建立裝置，啟用／重建保留。基準pointer／Space／Enter切換與Raw說明通過；新來源safe-final選Simulated通過。 |
| Monitor details | 基準鍵盤開合通過，但與尾響面板同開會遮擋路由說明。修補後pointer真hover及elementFromPoint命中、keyboard互斥開關都通過。 |
| Synthetic reverb details | 新來源與metadata互斥；pointer／keyboard開關、fields點擊及Tab可達通過。 |
| Reverb enable | 基準真checkbox click／Space true↔false循環通過；新來源已確認Tab可達和最終false。新來源實際toggle委由Render lane共用context補證據，尚不把Tab或原本false的uncheck算成toggle。 |
| Decay | 基準0.1／4／1.2、上下越界、空、1e309、NaN鍵入、Esc還原、blur提交、ArrowUp均通過。新來源再驗上下界與超界錯誤／Esc、跨popover保留。 |
| Wet | 基準0／1／0.12及相同負面、還原／blur／ArrowUp流程通過；另觀察預設0.12在step0.05的native stepMismatch。新來源step0.01、預設native valid、Up0.13／Down0.12、上下界／錯誤／還原皆通過。 |
| HelpTips／Tab／Reset | 基準Synthetic說明focus／Esc、Raw hover／Esc、Reset保留設定通過。新來源Monitor路由help真pointer無遮擋，native Tab走過所有可見footer控制。 |

範圍slider無法透過正常UI輸入任意NaN／Infinity；未用DOM注入偽造。此種非法gain由獨立Node domain測試確認拒絕。NumberField的非finite／非法鍵入則只用鍵盤，保留無效草稿、可見錯誤與Esc還原。

## 修補與Node回歸

- `runtime.ts` 保存desired monitor gain／mode；建立AudioEngine前就驗finite、0..MAX_MONITOR_GAIN與raw/simulated enum，值在未啟用view可見，啟用時套用。變更偏好不建立device。
- Init、buffer rebuild、preview及RenderHost master gain fallback沿用所選設定。未改mute、pause、buffer／reverb guard。MAX_MONITOR_GAIN=`10^(12/20)`，不是2；+12dB精確界限啟用前後均有Node回歸。
- App兩個footer details使用單一enum互斥，過期close事件不清除另一個section；維持native keyboard操作。
- 僅wet gain的UI step由0.05改0.01，未縮窄0..1連續runtime domain；這不是把所有NumberField改成step格點限制。

Public LabRuntime Node回歸6/6 GREEN：[runtime-green.txt](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/baccf620e07a4fac888cf52d7cee37a7253f9b0a)。有效RED為[修正fixture後的基準](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/7b5c6dcb8b82827c02d39943c1578ba0a1d52445)（2 PASS／3 FAIL）；[首輪紀錄](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/c437896d0f42abe07461487bd8b00845e1d709c2)另含OAC fixture前置失敗，原件保留而未當有效產品FAIL。型別、修改範圍ESLint及格式檢查均exit0。FakeAudioContext／公開asset staging adapter只證控制契約，不宣稱DSP。

## 共用Render lane待補項目

1. 未啟用聆聽先以UI設−40dB，再輸出master，讀真下載manifest確認monitorGain=0.01。Fallback已修且靜態核對，尚不冒充manifest已驗。
2. 最新bundle的reverb checkbox真true／false回讀。由Render lane共用已取得lease的context完成，避免多Chrome干擾。

主代理／Render lane提供證據後，應更新summary的sharedConfirmationsPending與checkboxfamily狀態；不得省略來源版本界線。此lane沒有改Git index、commit、Wiki或英文鏡像。
