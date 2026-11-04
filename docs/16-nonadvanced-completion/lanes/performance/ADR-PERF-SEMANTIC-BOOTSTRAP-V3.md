# ADR-PERF-SEMANTIC-BOOTSTRAP-V3：一次真實的 post-begin task

狀態：Root 已批准候選實作；SOURCE／VM VALIDATED，FRESH NATIVE NOT RUN，正式資格仍 NOT_APPROVED。此文件只適用短 semantic fixture，不變更正式600秒產品負載。

## 問題與原始證據

attempt02 的原 V3 raw event eligibility、V4、journal 與 full native set 都通過，但原 numeric complete 拒收：begin後51.870ms才出現第一個完整 task，超過原50ms起點上限。沒有 B／E，V4 分類為零。八份真原始資料、獨立 Python binary64 重建與失敗收據保留於 semantic-attempt02-v4／semantic-02-independent-review；attempt01原拒收亦保留。prepareAndPause在trace前已進入舊task，resume後立即begin，未保障產生一個新的完整被捕獲task；本資料不能證明51ms等待的排程原因。

## 決策

新增 page-v2／pilot-v2.html、bootstrap-v1、runner-v3／command-v3；原固定27來源、舊入口、原 V2 精確位元、V3／formal numeric core、原begin/end與50000us條件都不改。原26個註冊、24個callback、13個RAF群組、23個native Request、1個measured Cancel與E0特殊時間測試維持。

resume後在原begin／OPEN之後僅排一次setTimeout(0)。它不是重複heartbeat、忙迴圈或捏造RunTask，0只代表要求的delay。真正callback讀取entry clock、發出兩個獨立UserTiming marks、再讀exit clock；所有排程、計時、mark及callback成本保留給原numeric計算。若原樣不足50ms覆蓋，仍拒收，沒有移begin／剪窗／回填duration。

## 新的捕獲契約

獨立bootstrap receipt保留未量欄位null，只有真callback完成才FIRED；restore取消自己尚未執行的timer，沒有重排。其事件前綴為rlab-semantic.bootstrap，與原rlab-v3.observe分開。

候選必須同時滿足：

- receipt與原collection一致，schedule/fire各恰一次，要求delay=0，實際scheduled≤entry≤exit且全在原performance窗內；entry距原begin≤50ms。
- 原document／navigation前後一致，trace無loss且明確closed；原native eligibility為true。
- 同timerId、same owner／owned frame claim之唯一TimerInstall與TimerFire，不能從foreign frame借用相同id。固定producer/category的Install為I/s:t，data只有frame/timerId/timeout/singleShot；Fire為X完整非負duration，data只有frame/timerId。stack類別未啟用，額外stack欄位屬不同方法，拒收。
- captured Fire起點距native begin≤50000us，captured enter mark的startTime距performance begin≤50ms；不能靠aux自報早時間覆蓋真正延遲。mark的startTime與entry/exit clock依序連接，普通mark.ts及physical callTime均在Fire內、navigation吻合。
- 同一個完整raw RunTask包住整個Fire，且該task與原native validator的validated task結構相同。不能把TimerFire或mark冒充完整RunTask，也不能將unknown/native缺值當0。

原journal、原strict native、full native set、新bootstrap capture、原numeric complete五項都必須actual true；缺值、null、truthy字串或廣告旗標不能通過。wrapper另驗實際bootstrap restoration；量測通過與實際browser/server/process關閉分開，真正已關閉的失敗run仍可釋放machine lease。

## 已執行與未執行

真RED包含missing modules、新頁缺檔、aux偽早而native晚、普通mark回填時間；原始TAP保留。138項VM／raw負例通過，涵蓋50ms與下一個binary64、原完整callback情境、外來或錯誤owner/navigation、重複／缺失事件、native/clock不一致、early close及成功旗標不實。此為source與fixture行為，未宣稱native通過。

正式V4 registry仍空白。新的55秒有界command需經Root獨佔排程；真raw、source/executable endpoints與actualcleanup均須讀回，獨立審查後才能評估資格。20秒正式wiring、PCM及原600秒尚未執行，不能用本短fixture取代。

## 限制

一次新task不會恢復舊resume task的未捕獲CPU，不證明整窗毫無遺漏，也不能代表產品UI／頂列／音訊效能。原50ms僅是原edge coverage判準。新bootstrap的post-begin實際成本全計；其purpose只在明確、可驗證地產生並捕獲一個真task，所有不符合的新capture仍照原條件失敗。

Timer／UserTiming與Perfetto官方producer的固定revision、來源URL、SHA與單位見12-bootstrap-producer-schema.json；正式效能、硬體音訊、native-exclusive DSP及hearing並未因此合格。
