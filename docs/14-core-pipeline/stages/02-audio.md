# 音訊核心：成本觀測與原生路徑更新

日期：2026-11-02（台灣時間）。範圍為六項核心實作中的第2項；基準 `429efb7`，核心提交 `17e3318`，後續觀測開關與驗證收尾以本分支實際 Git log 為準。這不是完整 V1、600秒性能或實際裝置聽測通過。

## 已實作

- `AudioEngine.getDiagnostics()`：以控制執行緒觀測為明確模型；frame consumer 的 accepted／stale／unavailable／source-budget／restart-blocked／invalid／error 分欄，與 runtime batch delivery 的 accepted／epoch／revision／age／solver 拒絕分開。
- `recordAcousticDelivery()` 提供 root runtime 接點，batch 與 source-frame 數量分開；未接入時為 NOT_OBSERVED，不把沒有觀測當零拒絕。
- onset lateness 以 requested 與 actual native generator start 計算，不加物理傳播或裝置延遲。此計數是 native generator starts，不是唯一 physics event 數。
- 三項控制成本（frame consumer、route control、listener control）、onset lateness、delivery age／cost 各保留最多128樣本。分位數是最近保留窗口，lifetime observation count 分開；route control 是 frame consumer 的子工作，不可將兩者加總。
- 原生 `playbackStats` 至多每500ms讀取一次；同 context generation 的 cumulative 差值才是窗口資料。未支援、暖機、counter reset與未觀測均留 null。PCM gap、native DSP CPU、resident memory、SPL 都未量測。
- `diagnosticsEnabled` 選項與 `setDiagnosticsEnabled(boolean)`；關閉時不採 performance clock、不累積 ring／counter、不poll native getter，不改 voices／graph。重新啟用重建native baseline，不跨停用期間算差值；既有歷史觀測保留。
- PathRoute 將 scalar pressure gain、normalized spectral shape、delay、direction分開。normalized Float64 key與active target Float32 coefficients精確比較；純scalar改動不建立／複製FIR、不上傳IR。scalar可在shape crossfade期間獨立平滑更新。
- spectral bank最多一筆pending-latest，audio-clock完成交叉淡入後回收舊bank；最後一筆shape不需等另一個solver frame。live最多一個route timer，offline由明確checkpoint完成；disconnect／retire取消pending且不復活路徑。
- delay沿用1e-6秒deadband、position沿用1e-4公尺deadband，明確是有誤差的render策略；與exact scalar／shape suppression分開。保留雙bank、Convolver.normalize=false、group delay、stable path ID、持續generator及一次absolute propagation delay。

## 給離線renderer的接縫

`AudioEngineOptions.offlineOutputTap` 僅允許 OfflineAudioContext：

| Tap | 語義 |
| --- | --- |
| master | 現有完整監聽輸出圖，包含headroom／monitor／mute及配置的limiter／ceiling。 |
| simulatedMix | unity pre-master傳播後訊號，含此graph開啟的direct／early／late；不是純late reverb。 |
| dryContent | unity pre-master Raw乾聲，無傳播與空間化。單聲道在stereo speakers佈局會複製到左右各一份，不是equal-power panning。 |

pre-master taps不烘焙monitor／master processing，monitor mode固定，錯誤mode明確拒絕。`flushControlUpdates()`供renderer在實際OfflineAudioContext.suspend音訊時間點及tail checkpoint呼叫；不得預先覆寫所有Convolver.buffer而冒充未來排程。純late tap尚未支援，不能以相減偽造分軌。

## 基本測試與直接證據

- 完整音訊runtime與三份app audio回歸：226/226 PASS，原始收據 [02-audio-unit.txt](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/1b7cfe8d56854061ed881ad934d88ee9617dc1b3)。此輪在新增單一engine-disable回歸前啟動；該案例由下列最終核心測試涵蓋，不重複累加測試數。
- 最終diagnostics／native-update核心：19/19 PASS，含觀測關閉仍維持同一個native source；[02-audio-core-unit.txt](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/b76b33ea8b8d11f3301186cc04c0effb2ca582df)。
- 真Chrome OfflineAudioContext：4/4 PASS、0 page errors；[02-audio-oac.json](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/1cc4fa48448f141e5f905529b9a2f8933500af64)保存browser版本、source bytes／SHA-256及結果。命令 `node tests/browser/audio-update-core/run.mjs docs/14-core-pipeline/stages/02-audio-oac.json`。
- 型別／修改範圍ESLint／格式檢查以[靜態檢查收據](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/e0df9584d92a396ba58848713ea2e69782135c75)為準。

Claim AUDIO-CORE-PCM-01：48kHz字面impulse、發聲0.01秒、路徑0.075秒。master與simulatedMix的第一個非零sample都是4080；dry為480。master headroom=.25、monitor=.5時兩聲道總能量約.003906249866（解析.00390625）；simulatedMix約.249999991443（解析.25）。原生圖的延遲、pressure gain與headroom只套用一次。此為V2原生圖PCM證據，非幾何solver或裝置校準。

Claim AUDIO-CORE-PCM-02：非均勻band FIR的scalar加倍，native OAC前後RMS比約2.000000014；shape build／upload各維持1，generator onset維持1。沒有聲稱所有移動／filter變化在所有裝置都無斷音。

基本回歸的實際命令：

```powershell
node --import tsx --test tests/audio-runtime/*.test.ts tests/app/audio-smoothness.test.ts tests/app/audio-review2.test.ts tests/app/audio-review3.test.ts
node --import tsx --test tests/audio-runtime/update-core.test.ts tests/audio-runtime/diagnostics.test.ts
```

## 首次FAIL與參考更正

初輪4案中只有dry oracle失敗：把stereo總能量預期成1，但實際unity mono-to-stereo是左右各1，總能量2。[原FAIL](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/88c748362ea62f978e7563e8a91d2dd5ff473657)完整保留。依[W3C Web Audio 2021 §4.4](https://www.w3.org/TR/2021/REC-webaudio-20210617/#up-mixing)的speakers上混方程，修正為每聲道能量1／總能量2；同時新增每聲道檢查，沒有改產品graph或放寬容差。source-based final證據另存，不覆蓋初FAIL。

原 `routes-response-reuse` 測試曾明示scalar也被20ms shape gate擋住；該行為正是本輪拆責任修復的缺口。回歸改驗scalar在transition期間獨立到達，其他IR identity、arrival fade、tiny response、disconnect等既有assertions保留。

## Claude Code複驗入口與界線

1. 核對整合後Git、此報告與source-bound JSON，執行上述核心unit及OAC runner；再跑整合後完整runtime／browser。
2. 檢查root runtime確實接上recordAcousticDelivery，與UI的enable開關；不得把NOT_OBSERVED顯示為零錯誤。
3. 對比有／無觀測的固定source／browser／負載，再做長時間profile；本輪沒有執行600秒性能、裝置播放、native CPU／memory或實際聽測。
4. 初始框架、R17及研究長測負面結果保留；原native音訊框架、音質近似及跨browser限制沒有被這份基本測試解除。

本階段由Codex audio_core實作，routes_review子代理協作diagnostics與單元測試；root獨立review指出觀測開關缺口並已修補。root負責跨功能合併、UI、英文鏡像、Wiki task／checkpoint與完整Claude交接。本分支沒有新增依賴、付費API、部署或push。
