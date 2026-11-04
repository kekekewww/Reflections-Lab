---
id: RLAB-KB-CORE-PIPELINE-20261102
title: 六項核心實作與整合驗收
type: feature
status: ACCEPTED
created_at: 2026-11-02T05:04:33.815Z
updated_at: 2026-11-03T02:33:40.542Z
sources:
  - CORE-REQ-20261102
  - PUB-CORE-CONTRACT-20261102-V1-c407c71c78da
  - CORE-STAGE-03-20261102-V1
  - CORE-STAGE-05-20261102-V1
  - PUB-CORE-STAGE-01-20261102-V1-24fafd921228
  - PUB-CORE-STAGE-02-20261102-V1-d7982995b235
  - PUB-CORE-STAGE-04-20261102-V1-cd85b0e37287
  - CORE-STAGE-06-20261102-V1
  - CORE-MOTION-GENERATION-20261102-V1
  - CORE-RENDER-CONTRACT-20261102-V2
  - CORE-STAGE-07-20261102-V1
  - CORE-STAGE-07-20261102-V2
  - CORE-WORKSPACE-STATE-20261102-V1
  - CORE-STAGE-08-20261102-V1
  - CORE-STAGES-20261102-V1
  - CORE-STATUS-20261102-V1
  - CORE-NEXT-20261102-V1
  - CORE-LIMITS-20261102-V1
  - PUB-CORE-STAGE-09-20261102-V1-24c2bd0b272e
  - CORE-INTEGRATION-PROGRESS-20261102-V1
  - CORE-META-UI-WORKFLOW-20261102-V1
  - PUB-CORE-STAGE-10-20261102-V1-363d6d4d3d24
  - CORE-INTEGRATION-PROGRESS-20261102-V2
  - UI-TAIL-COMBINED-501-READ-20261102-V1
  - CORE-STAGE12-WAV-20261102-V1
  - PUB-CORE-STAGE12-REPORT-20261102-V1-473e376849d2
  - CORE-R21-FINAL-READ-20261102-V1
  - UI-FINAL-FINDINGS-20261102-V1
  - CORE-STATUS-20261102-V2
  - CORE-NEXT-20261102-V2
  - CORE-STAGES-20261102-V2
  - CORE-RENDER-FINITE-CLOSURE-20261102-V1
  - UI-FINAL-PARAMETER-COVERAGE-20261102-V1
  - CORE-NATIVE-FINAL-URL-POLICY-20261102-V1
  - CORE-NATIVE-GATE-CLASSIFICATION-20261102-V2
  - CORE-FINAL-CHECK-FAD14CC-20261102-V1
  - CORE-MAIN-FIRST-FAST-FORWARD-20261102-V1
  - NONADVANCED-USER-20261103-V1
  - NONADVANCED-BASELINE-E25F9F4-20261103-V1
  - NONADVANCED-CONTRACT-20261103-V1
  - NONADVANCED-S0-FREEZE-20261103-V1
  - NONADVANCED-LONG-OUTPUT-FREEZE-20261103-V2
  - NONADVANCED-CONTRACT-20261103-V3
  - NONADVANCED-M1-UI-AUDIO-ACOUSTIC-READ-20261103-V1
  - NONADVANCED-M1-ASSETS-META-STORAGE-READ-20261103-V1
  - NONADVANCED-51-CROSSWALK-DRAFT-20261103-V1
  - NONADVANCED-STATUS-20261103-M1-V1
  - NONADVANCED-LIMITS-20261103-M1-V1
  - NONADVANCED-NEXT-20261103-M1-V1
  - NONADVANCED-OWNERSHIP-M1-20261103-V1
  - NONADVANCED-CANDIDATE-M1-20261103-V1
  - NONADVANCED-LONG-OUTPUT-FREEZE-20261103-V3
  - PUB-NONADVANCED-CONTRACT-20261103-V4-9f596a63a30f
  - NONADVANCED-M2-ROOT-STORAGE-READ-20261103-V1
  - NONADVANCED-M2-LONG-AUDIO-READ-20261103-V1
  - NONADVANCED-M2-PERF-READ-20261103-V1
  - NONADVANCED-M2-CURSOR-P1-READ-20261103-V1
  - NONADVANCED-M2-ROOT-OPERATOR-20261103-V1
  - NONADVANCED-OWNERSHIP-M2-20261103-V1
  - NONADVANCED-STATUS-20261103-M2-V1
  - NONADVANCED-LIMITS-20261103-M2-V1
  - NONADVANCED-NEXT-20261103-M2-V1
  - NONADVANCED-M2-PARTIAL-MILESTONE-20261103-V1
  - NONADVANCED-M3-TOP-MONITOR-PARTIAL-20261103-V1
  - NONADVANCED-M4-PARTIAL-STAGE-20261103-V1
related_tasks:
  - RLAB-TASK-0023
  - RLAB-TASK-0024
  - RLAB-TASK-0025
  - RLAB-TASK-0026
  - RLAB-TASK-0027
  - RLAB-TASK-0032
  - RLAB-TASK-0033
related_decisions:
  - ADR-011
  - ADR-013
  - ADR-014
  - ADR-015
supersedes: []
tags:
  - P0
  - core-pipeline
  - implementation
---

## M4部分整合與Claude可讀交接；完整goal仍ACTIVE

[M4固定stage](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/73953e8828395991c584e3a81d1022f465e134b1)／[部分Claude交接](../../../docs/16-nonadvanced-completion/handoffs/M4_PARTIAL_CLAUDE_HANDOFF_20261103.md)分開Root1f與b7瀏覽器來源：最新globaltsc0＋118/118focused，83/77/64/118重疊不相加；Worker22/63、Runtime25及Native03十對20份2秒PCM是各自有限證據，非fullnpmcheck或一段長take。建置receipt事後建立、completedAt=logmtime，不冒prebuildcapture。

Production03為4PASS/1FAIL，Zone草稿/選取跨四模式與有限load讀值有證據，recording fixed-step guard仍FAIL。diag02 headless為pressure null的固定步guard/5frames封存；diag03 headed為storage FIRST_GUARD：eval14/7/7、store8/8/0/8，WorkerACK531.8ms已await、storagecreate253.6ms未在startawait，新Store-readygate在做非已修；14frames58..71是acceptedprefix，非吞吐PASS。20/19是磁碟sourcepins，HTTP直接驗index/entry，不推CPU/GPU或唯一根因。

V4只Root採exactChrome semantic前置、window222.6ms；Root1f registry仍空、新record/module未整合，無新20s/600/DSPCPU。V2 150sERROR/5false/第6缺結果/0WAV；snapshot已merge65component非realIDB/長WAV/parser/峰值。較晚Root回報V3startupERROR/noDSP待M5，不當本M4六組數值比較結果。EN兩UX sourcehash相符、2PASS僅Rootreported，不冒fullEnglish；舊tree只移clean/Mainancestor兩個，其餘dirty/raw/activeC/Claude保留。

Task33仍AC01/03/04/05true、02/06/07false/IN_PROGRESS；Task32onlyAC01，原PERF/16/20/51、caps/容差/正式負載不改。fullS4/CU/fullnpmcheck/fullEnglish/Mainmerge/最後完整Claude交接與其後人工仍未完成。本次partialhandoff不能當最終goal完成。

## M3頂列四模式：有限證據已固定，完整工程仍ACTIVE

[M3部分里程碑](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/aac9048a20f8addd2cb72f1a92466b98c21c8eb9)分開UI/build ac0b895、native02 audio5b8ace與原native01FAIL。Root64/64focused，paint24不重複相加；build01exit2、02/03/04exit0且僅04綁13來源。Playwright02為3PASS/1FAIL、4/4source/HTTP、0pageerror/modelcall：四mode/keys/focus/L-R/ZH-EN、390/929/1440DPR1與真有限圖表有證據。

新native02 componentPASS由9raw/53248B、同renderclock、wave差0、DFT誤差4.29683e-7dB<原0.3、mute0/-Infinity與release/dispose支持；原01FAIL/2of9保留。API耗時非DSP/CPU，0ms只timerresolution；原50/58控制budget與15Hz/lazy/unknown矩陣用composite證據，不稱native上界壓測/正式性能。

Task0033 AC01/03/04/05有逐literalcomposite證據，AC02/06/07仍false/IN_PROGRESS；Task32原AC02–09、原51/PERF/16/20/正式負載容差不變。錄製Pause早於首次Spectrum；1.42s=global85/60，錄製UI0.12s非acceptedcount，共享guard不辨evaluation/storage，冷啟動或切圖因果未證。新未提交label/runtime與錄製診斷不由舊ac0 pins冒驗。ComputerUse仍WindowsURLpolicy/0新featureinput，最後fullcheck/雙方法/長管線/正式600/English/Claude→人工未完成。

## M2部分整合：原驗收與全scope仍ACTIVE

[M2固定里程碑](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/ac657109c4ae5a5390d9eecd2c1d425f2072e246)保舊41526/32與新3a251 P1、[91doc/raw副本](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/465cb0a1eed142f77586ca69854f49fbbcf602c4)及較晚writer677正常merge的不同時點。Root32/107/105等是有限scope，globalTS0在Blob4d前，不能冒最新fullcheck；新P1真RED1→32GREEN且validator不變。

公開60s=3600acceptedframes，3601inclusive只獨立容量fixture，不+renderwindow一tick。Long57/58仍原whole63master2.9802322387695312e-6/321over超2e-6；14downloadcomplete、15partial、16missing，90sFAIL/Worker未跑，terminal後0ownedprocess不是原finally成功。

Perf55秒只cap，程序4.754秒/native約0.397秒strict拒收；原V3/新V4未資格/正式600分開，null不當0。047讀者415/3a未merge、較晚writer677實merge只negative/methodcomponent，不是資格通過。Resourcecandidatedefaultreference/off，新EOF224/226+45未凍結owner進度；第9owner與ephemeral權責已明確，不冒永久授權。

原51draftcurrent/Task16/20/PERF/Task32AC02–09不升級，ComputerUse仍policyblock0input，完整產品PW/長公開管線/fullquality/正式600與最後英文/Claude/人工未完成。Root仍做工程，M2不是final/handoffcomplete；舊FAIL、原schema/容差/負載/creditsgate0均保留。

## 2026-11-03 候選里程碑01：S2 partial，完整scope仍ACTIVE

[固定里程碑](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/7cee6ae1118139b2bfd78376a89e5bba3601f322)保Root877→後續a9de正常merge時點、[66份精確doc/raw副本](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/4a81067fda59aae11773b208dad09265503d069e)。Assets69/Meta63+75/storage98/UI25與renderer/voice各有不同component範圍，不加總冒完整產品PASS。UI19新families/3PW只authored，Root61reject/60BUSY的1GREEN不是真60秒run。

Audio原native5FAIL與10zero-framePCM無效保留，control133/18與Nodeintegration52GREEN不改native結果；attempt02尚未跑/未grant/v2pin未採。Acoustic79後有新review真RED與中間82/88，仍未final採納。Rendererforeignwriter3FAIL/4與WebLocks/真IDB5198/長62sPCM、公用recover/archive UI仍待驗。315歷史failingdecodedtext未捕獲，不claim唯一根因已修；Meta當次fakePASS非currentlive，key/newpaid0。

本輪GUI native仍URLpolicyblock/0input，Playwright驅動OAC數位DSP不是ComputerUse或完整Playwright產品矩陣。[長規格v2](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/8bde27d90c0715399501ae6d2de1e43100433e85)保v1；[51列草稿](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/195b1de848ab3b5496a5a362d45bde0f8006cded)全current未裁決。S1/原formal600、S2/原Task16/20/PERF、全check/UI/longpipeline/英文/Claude與之後人工未完成；不改原criteria/dependency/workload/tolerance。

## S0scope已凍結；兩次完整1536基準仍FAIL

[S0收據](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/5ff8c4a6d358f795845efe030066f715920f4308)固定原文/原criteria/七樹actualowner與long規格。typecheck0；原OOM1520reported/1517pass/3fileabort exit1及定向19/19exit0保留。完整concurrency4與原預設重試皆1536tests/1535PASS/1FAIL/exit1/0skip，原預設129798.5083ms、sourceStart/End同e25。唯一重現315mocktrustedApply(prior400=0)expectedPASSED實INCOMPLETE、scene400/PROVIDER_REQUEST_FAILED「Meta回覆不是完整JSON。」；注入remoteFetchfixture，沒有真API/新付費，根因待Metaowner，不確診OOM/WSL。

S0close只指scope/owner/longspec與基準事實保存；S1歸因/正式性能、S2候選、全部原PERFcriteria與完整V1未閉合。長輸出/ComputerUse/Playwright/formalprofile/Claude仍未驗；各候選已開始自有檔實作/RED，不把規格或小測試當產品完成。正式原負載、容差和失敗不改；英文延到最終sourcefreeze。

# 2026-11-03 新非進階完整scope已ACTIVE

[新一輪綜合頁](nonadvanced-completion-20261103.md)及[本輪契約](../../../docs/16-nonadvanced-completion/CONTRACT.md)記錄明確使用者授權：PERF001–008/011/014、Task20/16證據對帳及Computer Use/Playwright全產品與管線。此頁下方六core/1536/217/五WAV為前次有限交付，不能當成本輪新完成。新Task0032 IN_PROGRESS、所有本輪產品測試NOT_RUN；原dependencies/criteria/正式workload/tolerance保留。Claude本輪未驗，最終人工排在Claude後，advancedTask15/009/010/012排除、cloud013/paid未授權。

## 先前截點（保留其日期、方法與限制）



# 核心管線目前狀態與交付邊界

501產品六核心、Zone／曲面動態反射與Project環境已有有限實作；Task24..31含28有限DONE，Task23只因字面nativeAC04外部URLpolicy列BLOCKED。最新217/217family收據join／0pending、68/71公開Help內容PASS且3條件明示未觀測，新Combined180ticks／5WAV和Stage12RIFF5/5PASS、Tailguard1PASS。版本化source與原FAIL不重標全501重跑，完整方法見[參數審核](../ui-ux/product-parameter-audit-20261102.md)／[Now](../now.md)／[Claude交接](../../../docs/14-core-pipeline/CLAUDE_CODE_HANDOFF_20261102.md)。[新完整check](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/2f387d58e834799d809cbbdaab03e2afd2cb4194)exit0及[本機main](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/529524649ac8b7fbff91d919bf6dcab6403b7865)實際`fe663ca9f384d247bcd89b331936f6be202c761f`已驗，129原untracked／4ba snapshot／11featuretips保留；Claude獨立重驗與新增功能人工觀察為下一階段。前三次native timeout後第四輪只建獨立視窗成功，產品操作遭WindowsURLpolicy停止，Task23字面AC04false；全V1／聽測／600秒／Meta live仍分開。

## 歷史進度與原始來源截點

下列為當時進度，含待整合／Zone不支援／未重驗等語只描述原source；現在能力與固定新收據見頁首，不改原FAIL與pins。

### 原始核心分工與階段

本輪實作已由使用者授權，精確範圍與完成條件見[核心契約](../../../docs/14-core-pipeline/IMPLEMENTATION_CONTRACT.md)，分工與證據提交見[Stages](../../../docs/14-core-pipeline/STAGES.md)，需求摘要見[授權來源](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/1c8807e9ba7b981c937b04a7e84ea12859bfb497)。

Task0023為有限核心整合與基本驗證；0024共用能力/Bounce、0025 Meta UI、0026 Motion、0027短take renderer。PERF001/002/003/014保留原較廣條件並由本輪引用，不放寬依賴或把14項優化全開。所有新criteria在取得實際來源與測試前皆未驗證。

基本功能已經使用者確認，不重複要求前置重測；Claude獨立後驗證、新增功能真人聽測、原600秒性能與其他V1門檻分列。各stage交付時固定source/commit/bundle/命令/退出碼/限制，再由唯一memory writer序列ingest/checkpoint。

### 階段 03 component 截點

共用能力與真 PhysicsWorld 靜態支撐 OnBounce 已有 component 程式及基本回歸。機讀收據記17/17新增案、255/255較廣回歸與typecheck/scoped lint通過；已讀原TAP結尾確認255 pass/0 fail。這些是該branch/source的Node／Rapier證據，UI接線、整合後新bytes及聽感未由此證明。Zone仍unsupported，Bounce為Tuned分類；root須保留Motion控制干預invalidations。

來源：[stage報告](../../../docs/14-core-pipeline/stages/03-capabilities.md)與[機讀收據](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/80d113653604089c99ab1e676e83cae1649e645d)，該報告最後變更commit `9efd9ceeede5cc21dbb441ed14445c7bccd124d4`。本輪task尚未因component證據預填完整驗收。

### 階段 05 component 截點

Motion Registry、有限controller與AI transaction hooks已有component程式。已讀原TAP確認Motion12/12 pass，機讀收據列AI bridge29/29、typecheck/scoped lint通過；重疊67案不另加總。Dynamic控制為Tuned、Kinematic旋轉只有終點overlap；root真runtime原子發布、UI／Project／錄製接線與browser仍待整合驗證，不把隔離callback當成完成產品。

來源：[stage報告](../../../docs/14-core-pipeline/stages/05-motion.md)與[機讀收據](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/a83e337ede5d843823502dd16251727da2540fb0)，該報告最後變更commit `dd4ef2232be111ffadaa0f0b4853150000a22e46`。本輪task尚未因component證據預填完整驗收。

### 階段 01 component 截點

有界錄製evaluation、module Worker與B重算已交component。已讀原JSONL最終summary確認153/153 pass、0 fail；queue預設8 frames/32MiB、工作逾時10秒，保留取消/stale/背壓與source phase語意。這不是總heap或同步JS可搶占保證；真browser Worker transport、root短take/Motion/renderer整合及性能收益仍須獨立證據。原恢復時漏tick與其他失敗保留在stage失敗收據，不覆寫原600秒FAIL。

來源：[stage報告](../../../docs/14-core-pipeline/stages/01-recording.md)與[原始收據](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/4cfefa22b32e9218fc301d262d874a4cddc79780)，該報告最後變更commit `2582bf5e484019c86e2d830e4b7f8654530c95f2`。component基本結果不預填整個產品整合驗收。

### 階段 02 component 截點

有界可停用diagnostics與scalar/shape/delay/direction分工已交component。已讀原TAP確認較廣226/226、最終核心19/19（不重複相加），以及真Chrome OAC4案PCM收據。48kHz字面impulse中master/simulatedMix firstSample4080、dry480，支持該graph一次delay/gain/headroom；不是solver或裝置校準。首次dry能量oracle失敗及依上混方程修正另存；root delivery/UI接線、無probe對照與原性能gate未由此解除。

來源：[stage報告](../../../docs/14-core-pipeline/stages/02-audio.md)與[原始收據](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/1cc4fa48448f141e5f905529b9a2f8933500af64)，該報告最後變更commit `506c19934abb2c2039162011c9a1b8514031db99`。component基本結果不預填整個產品整合驗收。

### 階段 04 component 截點

持久budget ledger、request identity/取消、AgentSession與可信基準/候選/分析比較流程已交component。已讀原TAP確認最終183/183與provider27/27 pass、0 fail；工作流程8案含真Rapier/Behavior/聲學/Host閉環。初85/86失敗、Windows fixture EPERM及修補保留版本。所有model transport仍fixture、費用預設0、沒有新增Meta live；root grounding/cancel/Motion hooks與browser UI接線需最終整合證據。

來源：[stage報告](../../../docs/14-core-pipeline/stages/04-meta.md)與[原始收據](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/c9474af71b15f5c46d1a5fc14fe8c72a6058a2a6)，該報告最後變更commit `42abb6fe6e0a71dce9dba1d20ccf2c331035c662`。component基本結果不預填整個產品整合驗收。

### 階段 06 component 截點

已讀Node原TAP確認13/13、browser原收據確認真Chrome OAC7/7 exit0，來源核心55d40fd，後續報告提交另保留。沿同AudioEngine重建真RecordingArtifact，預算為發聲30秒/單context45秒/16outputs、工作估算256MiB/輸出192MiB；估算不當native峰值量測。原non-loop/continuous fixture拒絕FAIL保留；最終pre-master stems和mix誤差5.122274160385132e-9、direct impulse2654/2654、dry2080/2080只支持該fixture與source版本。Root真短take/UI下載/computer-use及最終bundle仍另收證；沒有把byte產出當真人聽測或原600秒性能成功。

來源：[原始文件或程式](../../../docs/14-core-pipeline/stages/06-render.md)；最後變更commit `2bbc1b78dbc0a25e1c78f5b53faa404cff39b3cb`。

### Motion 混合世代修補截點

獨立審查重現reset後generation2被preview錯設1的缺陷；修補使用PhysicsWorld實際身分投影及可信prepareRestore，不從scene revision猜世代。已讀真Rapier原TAP18/18與AI bridge報告37/37，原重疊fixture FAIL與修正另存；root仍需接相同World身分政策下的原子runtime callback並重驗UI，不把隔離storage fixture擴大成產品整合通過。

來源：[原始文件或程式](../../../docs/14-core-pipeline/stages/05-motion-generation-fix.md)；最後變更commit `49bad90d1da9ee78ca9cdb2b02e413db97dad473`。

### Render 契約來源版本更新

RenderJob原type-only seam已接有限native-offline-recorded backend與runtime validator。本來源固定本輪src/audio/render-contract.ts實際bytes；以supersedes保留AR-WIKI-ca2bde0e-2ffea48d的2026-10-29 type-only原hash與Git歷史，該舊研究仍是其當時截點，不覆寫成新code。此來源更新處理current hash失配，沒有改驗收、reference或safe()，也不聲稱未實作capabilities已可用。

來源：[原始文件或程式](../../../src/audio/render-contract.ts)；最後變更commit `39606d9fe8808b8f460065b0260cca11b7b3f243`。

### UI 初版來源觀察

已讀初版報告與原始收據，19/19、SSR5/5、headless browser2/2保留原scope。初版原文SHA0678c790...已實際觀察但未Git提交；目前byte前綴與LF/CRLF候選不能精確匹配，沒有捏造preimage或commit。完整舊canonical及當時未提交產品輸入不能只靠hash重建，觀察JSON明示缺口，原測試stdout/process/失敗收據保留。

來源：[固定來源](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/1fd5831dccd9f74fb67888d65b2f1025a39d3dbc)。

### UI 原子發布修補

現在報告以實際新hash固定；MotionPanel改讀LabViewModel.motion同次發布快照，不獨立訂閱live workspace，legacy缺欄位才fallback。新增原子snapshot/legacy回歸9/9（7SSR+2ports），root接runtime發布與critical revision。V1是前版hash觀察、不是可重建原文；舊2/2browser不當新atomic source重測。root最終產品輸出與Claude獨立驗證另收證。

來源：[固定來源](../../../docs/14-core-pipeline/stages/07-integration-ui.md)。

### 工作樹與封存範圍

新七個core工作樹位於專案.worktrees，cleanup範圍與原branch SHA保留在精簡JSON，private archives不入Git。C architecture/performance及D public舊樹已封存後移除；C primary與舊R21因active attachment/broker保留，backup已逐regular-file核hash。R21搬刪遭auto-review拒絕，沒有繞過或殺process；使用者表示關閉Claude後再處理。四個fixture symlink只存精確metadata、未追外部target。這是DONE_SCOPED加兩個active-process保留，不是舊樹全刪。

來源：[固定來源](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/3920ee9b89eb7a1cd97ed7d31b03b5b4133e5ccc)。

### 作者Motion實際進入ExperimentToolHost錄製

實驗clone world現在透過可信registry/pin/generation projection安裝真MotionWorkspace，最多8同時動作且每物件一個，tick0不增減，replay沿原trace而不重執行作者動作。Stage報告列最終8/8與先前38/38不同scope；root凍結來源完整檢查另收證。沒有把本機pipeline結果擴大成browser/裝置/Meta live或全V1。

來源：[正式文件](../../../docs/14-core-pipeline/stages/08-motion-experiment.md)。

### 六core分檔與07/08整合證據規則

Stages已使用實際component報告檔名，07/08是跨核心整合補充而非新增產品核心；報告、source/commit、原失敗、基本/Claude/真人與原性能gates分開。

來源：[正式文件](../../../docs/14-core-pipeline/STAGES.md)。

### 六core合併後正式實作現況前言

正式status前言延續使用者基本功能已確認，更新六項真實component與有限能力。Root品質/CUA輸出/main仍在完成，不冒充全V1；舊章節保留其歷史時間截點。

來源：[正式文件](../../../docs/IMPLEMENTATION_STATUS.md)。

### 六core合併後交付與Claude後驗證順序

下一步改為完成source-bound品質、產品匯出、授權本地main、記憶/英文及Claude獨立重驗；不重開原lane/能力/renderer提案，不把14候選一概啟動。

來源：[正式文件](../../../docs/NEXT_ENGINEERING_TASK.md)。

### 六core目前能力上限與原未解門檻

新限制前言列有界queue與非總heap、control-thread診斷、Tuned Bounce/Motion、30s/45s/16outputs renderer/未支援功能、fixture Meta與預算0。基本功能真人確認不外推science/device/perf；初次WikiFAIL與後續來源/完整checkout修復、UI前版不可重建及兩個active舊樹保留均明示。

來源：[正式文件](../../../docs/KNOWN_LIMITATIONS.md)。

### 正式產品BrowserDOM匯出與獨立WAV檢查

42d25cb/index-27NgeX35.js經真UI capture3秒/180ticks、render、逐一下載5WAV和manifest。獨立RIFF parser5/5，stereo48k/240000frames/5秒、finite/nonzero/0越界、manifest及原下載/copyhash相符；2stems sum誤差1.4901161193847656e-8<2e-6。Native sky.get_window兩次appapproval timeout後停止，沒有native輸入成功；BrowserDOM與數位檔案PASS不當native、人耳、SPL或性能成功。

來源：[正式收據或報告](../../../docs/14-core-pipeline/stages/09-integration-and-export.md)。

### 主整合回歸修補與產品輸出目前進度

Root回報首check缺spike依賴後離線補齊；第二輪23FAIL（Hostrebind過早publish19、舊oracle新增欄位4）在42d25cb修，相關46+8回歸回報PASS。第三完整check與MetaUI空table修補/重驗尚在進行；最終source/main與Claude未完成。這些品質進度是root回報，未假造最終raw結果；09獨立WAV有自己的fixed receipt。

來源：[正式收據或報告](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/d42579a50834c13dbaa57b9e4c1fd31b40815402)。

### 真正production Meta離線UI閉環與拒絕案例

已讀原browser exit0/1passed21.2s、unit22/22原TAP與7sourcepins目前全相符。真DOM完成hard preview/apply、1秒baseline3tools、soft candidate4tools含Compare、Undo、越權拒絕及不相容geometry/motion拒絕；table有可信數值與125–4000Hz欄，rt60仍未提供。原空table FAIL及21/22格式假設FAIL保留；無testbridge/runtime dispatch、API requests0，不是Meta live/真人/聲學改善。

來源：[固定來源](../../../docs/14-core-pipeline/stages/04-meta-ui-workflow-receipt.md)。

### b41cdeb第二批實際DOM音檔與獨立檢查

b41cdeb/index-CgrKG5Ax.js固定於exports/final/source-bundle，真DOM逐一下載5WAV+manifest、獨立RIFF5/5、48k stereo/240000frames/5秒、finite/nonzero/0越界/hash一致，stems sum最大1.210719347000122e-8<2e-6。sameProductSource=false明示後續UI已改，不把此固定bundle當未來main完全相同；native仍NOTCOMPLETED。

來源：[固定來源](../../../docs/14-core-pipeline/stages/10-final-ui-export.md)。

### 完整code品質與Meta成功後Motion表單修補進度

Root更正runtime1328/1328；其他完整checkcode/build/license階段通過回報，但命令最後English missing2/stale5/errors16所以exit1，不能改寫為完整命令PASS。Meta真UI已成功；Motion真Save又發現HTML step/pattern使預設invalid，局部修補及browser基本重驗進行中，最後source/main/Claude未完成。V1完整bytes已先保存pre-closing history，不只剩舊hash。

來源：[固定來源](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/d42579a50834c13dbaa57b9e4c1fd31b40815402)。
