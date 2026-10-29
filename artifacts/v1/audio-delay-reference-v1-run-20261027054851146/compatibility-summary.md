# Firefox原生Delay相容性參考

2026-10-27，以Windows既有快取Playwright Firefox157.0執行一次`native-delay-reference-v1`，9個事先固定的圖完整測得PCM，狀態 **REFERENCE_MEASURED／exit0**。此狀態只表示取得獨立數值參考，原25項跨引擎驗收仍為 **FAIL**，原能量`abs(error)<1e-5`未變。

觀測把原能量差限縮到此build的native Delay Float32參數／分數取樣位置插值：沒有Delay時，gain-only與unit Convolver的完整PCM相同；0.025s與二進位可精確表示的0.125s控制組維持預期主脈衝。0.075s的native AudioParam readback為0.07500000298023224。由此Float32換算出的3600.000244140625frames是獨立模型的**推算**，不是瀏覽器暴露的內部DSP屬性。

0.075s圖移除Convolver與全部產品程式後，兩聲道完整PCM與事先固定的Float32線性插值預測逐sample完全相同：6480為0.17673353850841522，6481為0.0000431583721365314，其餘samples為零。單位Convolver加入後只有小量native數值殘差。雙路獨立圖重現原能量0.31246948243551215，與原失敗資料逐值相同。這證明產品FIR／gain／排程不是重現該差異的必要條件；沒有觀測支持把此fixture的差異歸因為16-bit PCM或privacy/dither。

| 預先固定圖               |             原生能量 | 模型逐sample最大絕對誤差 |
| ------------------------ | -------------------: | -----------------------: |
| gain-only-zero           |  0.06249999786071614 |                        0 |
| convolver-unit-zero      |  0.06249999786071614 |                        0 |
| gain-only-delay-025      |  0.06249999786071614 |                        0 |
| convolver-unit-delay-025 |  0.06249999786071622 |      5.26835597369768e-9 |
| gain-only-delay-075      | 0.062469490992701146 |                        0 |
| convolver-unit-delay-075 |  0.06246949099264736 |     5.836865213382225e-9 |
| gain-only-delay-125      |  0.06249999786071614 |                        0 |
| convolver-unit-delay-125 |  0.06249999786071622 |      5.26835597369768e-9 |
| parallel-original-paths  |  0.31246948243551215 |     1.053671194739536e-8 |

新reference在原生測量前固定`maxSampleAbsoluteError<=1e-7`，9圖都吻合該診斷模型；此值不是改寫原`energy error<1e-5`門檻。原理想能量0.3125假定純整數sample延遲保持脈衝能量，對本次Float32參數轉換後的native雙sample插值不成立。原驗收 **FAIL仍保存**，不能宣稱「原25項現在PASS」；若未來要修訂oracle，必須另立contract版本／理由並獨立review。

Web Audio的AudioParam排程值為float。Mozilla索引版DelayNode以float換算frames，DelayBuffer混合相鄰frames，與此次PCM模式一致；索引source revision未對應到此binary的build revision，不能當成直接讀取內部DSP的證據。主要結論來自獨立native控制圖與完整PCM，Node模型測試只驗算術。[W3C AudioParam](https://www.w3.org/TR/2021/REC-webaudio-20210617/#dom-audioparam-setvalueattime)、[Mozilla DelayNode](https://searchfox.org/firefox-main/source/dom/media/webaudio/DelayNode.cpp#104)、[Mozilla DelayBuffer](https://raw.githubusercontent.com/mozilla-firefox/firefox/main/dom/media/webaudio/DelayBuffer.cpp)。

原跨引擎Firefox8 PASS／1 FAIL／9 API阻擋／7 aggregate未執行保持不變。缺少的是測試排程所需的`OfflineAudioContext.suspend`，不能推論產品live Freeze/Pause不支援；游標／pause的未執行案例仍未驗證。Windows快取WebKit27.2缺少AudioContext／OfflineAudioContext的觀測也不代表所有Safari平台。

完整output PCM為9×2×12000samples／864000bytes；[reference-result.json](archive://14da3d7fdcdb5dc73d69b6420238689e22f3846e/f04028c02f6bb4f2eae35c5c31c7bb8ed3274467)保存每sample數值、native readback、prediction與UA。[verification.json](verification.json)保存實際版本、PID、22份來源before/after hashes（`sourceStable=true`），含原15份audio／native suite。context、browser client、BrowserServer與Vite都正常close；[process-cleanup.json](process-cleanup.json)的elevated唯讀CIM查核為0個matching browser程序。瀏覽器時段已交還，沒有額外重跑、產品修改、原fixture修改或prefs變更。

Runner限制：本機Vite dynamic import／createServer目前沒有個別deadline；native/protocol/render/cleanup stages有固定deadline，本次實際完成用時8859ms。若後續圖拋錯，先前已完成PCM沒有逐圖checkpoint回host；本次9圖均完整取得，未遇到此路徑。這些限制在測量後read-only review指出，未透過重跑或改碼掩蓋。

本結果只涵蓋該Windows快取Firefox版本的固定native數值圖；不宣稱所有Firefox／Safari、產品整體跨引擎驗收、人工聽測、裝置延遲、SPL、AudioWorklet或長時間效能通過。
