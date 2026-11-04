# PCM／控制干預與開銷：來源可執行候選

本批為 test-only 診斷工具；356項純回歸已實跑全通過、scope lint 0error／0warning。尚未 build 或執行真 AudioContext／PCM／process CPU 量測；不得將 VM blocks、synthetic WAV 或 literal ABBA 數值視為實測。精確來源與原始 RED/GREEN 見 pcm-control-source-receipt-v1.json。

原13欄 AudioBudget固定24 voices／8 paths per voice／96 total。七個3秒案例為 steady、main-thread stall150ms、backdated onset、真consumer stale refusal、真solver path birth/death、36admissions/32requestedpaths的原budget負控制、post-master100ms數位靜音。最後一項是負控制，不是產品或硬體underrun。此component的budget干預不是原formal stress32/256，不能抵正式負載。

診斷tap接同個AudioEngine post-master聲流，依實際block長度處理；constructor有界預配置pool／16種block長度、10秒／32MiB上限。process不做無界配置、網路或log。drop／overflow／missing／nonfinite／gap都有明確欄位，未知不補0。原始interleaved float32 PCM與56-byte fact WAV分開下載，逐byte驗WAV payload，短／長資料一律拒包裝，不補零，不改NaN payload。

獨立byte oracle檢查timeline/capture/WAV全欄對帳，原Stage12 reader/hash不改；真all-zero是有效raw並報整段靜音，原非零reference拒收另欄保留。數位gap僅指all-channel exact-zero run至少等於實際最短block，不推成aligned callback loss、click/pop、可聽性或hardware事件。

控制oracle要求主continuous voice/source/path確實存續、onset已建立、必要干預實際落在capture音訊窗及saved wall wait窗。handler dispatch、同步operation wall、late onset、stale、budget拒收、PCM及native playbackStats各分欄。不能只有admission旗標或音檔就宣稱干預通過。

ABBA摘要只比較同一pinned run的on/off/off/on，自己重驗原budget、source/config、真solver結果、actions/admission counts、rate/channel/frame count與control lifecycle。process CPU coverage不完整維持null，不濾掉缺值當0；兩筆每mode只給descriptive mean/delta，沒有統計或performance PASS。比較增量是Worklet＋periodic diagnostics＋setup/encoding/report；兩mode共用有界action journal、timer timestamp、native endpoints與unity control node，**不是**完全observer-free的正式長測。

新頁／Vite config／dist／port皆獨立，不修改公共runtime/package/UI。Vite清理前核對固定owned目錄、拒Windows junction或工作區外target。Smoke外層90秒、full ABBA240秒owned-child watchdog；正常結束需actual browser disconnected／preview stopped／cleanup0，forced stop缺tree proof不釋放lease。正式600秒另待有效V4資格，保留原V3拒收。

Candidate resource model尚未採納。requested oscillator仍nativeReference，virtual carrier policy與snapshot resource representation分欄；完整新增caps依Root freeze另量，不能以降低原voices／paths／tails換PASS。真native候選驗證、硬體聆聽、callback CPU、全品質與正式性能仍NOT RUN。
