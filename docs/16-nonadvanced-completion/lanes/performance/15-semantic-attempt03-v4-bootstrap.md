# Semantic attempt03：真實單次 bootstrap 短追蹤

狀態為 SEMANTIC_CANDIDATE_OBSERVED_NOT_APPROVED。Root明確授予單次獨佔窗口，來源為03d665a720de4d1b32f1e0a4818d25a28e48d25d；實際command exit0、owned child4557.0003ms。journal、strict native、full native set、captured bootstrap及原numeric complete五項均true。正式registry仍空白，未宣稱正式資格或600秒通過。

執行前44來源及指定Chrome雜湊均核對；runner真sourceBefore／sourceAfter與執行後44次hash亦逐項相符。原27來源、原V2精確雜湊、原數值核心／begin／end／50ms門檻均保留。八份canonical原始複本、逐檔bytes／SHA及完整可重現命令見semantic-attempt03-v4-bootstrap-receipt.json；實際hardware/browser/commandLine/GPU來源在canonical verification.json的host欄。

原26註冊、24callbacks、13群組保持；raw有23Request、24Fire、1measured Cancel與25trace handles，E0特殊時間仍由full native oracle對帳。本次原raw V3已通過，V4 classification為零，因此沒有使用窗外B例外；不能把此結果推論成所有可能原生task形狀都已合格。

新bootstrap只schedule/fire各一次。原performance begin=549.6000000000931ms，schedule=550ms、entry=550.5ms、exit=550.6000000000931ms；requested delay0，真正delivery delay0.5ms，entry距原begin約0.9ms。raw ordinal195是TimerInstall、198是TimerFire、202／203是兩個mark、197是完整RunTask；Fire完整duration174us，owner／frame／navigation／timerId及physical callTime對帳通過。沒有重複heartbeat或修改原window。

原numeric native begin=2667589229us、end=2667811785us，起點gap780us、終點0，均符合原50000us；38個selected native tasks產生14個bins。此222.59999999962747ms的semantic window只是測試情境，不是產品效能負載，也不以短fixture數值宣稱原正式p95門檻已通過。

清理真耗時403ms，errors空、browserConnected=false、serverListening=false，原RAF／cancel identity保持，pending0、bootstrap FIRED且無pending、state CLOSED。wrapper的machineLeaseReleasable=true與pilotSucceeded=true分開記錄；正常direct_process停止，treeproof仍null，沒有冒稱強制整樹關閉。已向Root確認釋放exclusive，沒有立即重跑。

attempt01原始B拒收與attempt02起點51.870ms拒收持續保留。本次raw已由獨立代理以Python重建，26／24／13及全部native parent／E0時間吻合，38tasks／14bins／15bounds逐值binary64一致，全部44個archive／前後／current／03d Git bytes與executable均相符，未發現差異。MD／JSON與SHA見同名receipt，由Root評估下一個資格登記；不把獨立短追蹤對帳當正式批准。頁面沒有產品UI或AudioContext，sample rate／hardware block／native DSP CPU為null；Task0033頂列成本、PCM、20秒wiring、原600秒及hearing均未由此驗證。
