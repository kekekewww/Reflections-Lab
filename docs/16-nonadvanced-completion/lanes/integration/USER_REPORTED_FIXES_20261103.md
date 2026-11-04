# 人工測試回報的三個問題與修正（2026-11-03）

使用者在人工測試前與測試中回報三個問題：

1. 「第一人稱環顧時，視角偶爾突然跳到另一個角度，會讓使用者分心。」
2. 「預設球有時在動作後不會發出聲音。」
3. 「抓取要更俐落；目前視角轉快一點，抓住的物件就會鬆脫，使用者必須非常小心。」

| 項目 | 修正 commit | 使用者實測 |
| --- | --- | --- |
| 視角跳動、球偶爾無聲 | `c1002ac7`（src tree `6cb3d25a`） | 使用者 2026-11-03 回報「Both fixed」（4173 production build `c1002ac7`） |
| 抓取鬆脫 | `2f2aa2c7`（src tree `c4bab9cb`） | 使用者 2026-11-03 回報「Grab feels good」（4173 production build `2f2aa2c7`） |

瀏覽器測試的維護另見 `15e0282f`、`956ee761`、`f04fbbf8`（只改測試選擇器與列的挑選，沒有改任何斷言）。

## 1. 第一人稱視角跳動

**原因**：進入第一人稱時以 `requestPointerLock()` 取得滑鼠鎖定，沒有帶 `unadjustedMovement`（[輸入規格](../../../04-physics/INPUT_CONTROLS.md) IC-01 要求原始滑鼠、不支援時才回退）。Chrome 在 Windows 的一般（經作業系統調整）模式下，偶爾會回報一筆滑鼠實際沒有產生的大位移（例如重新置中游標或重新鎖定後的第一筆）。互動主機只把每筆限制在 ±500 px、0.002 rad/px，所以一筆錯誤位移最多讓視角轉約 57°，就是看到的「跳到另一個角度」。相機姿態直接由 yaw／pitch 組成、沒有插值，主機只建立一次，所以排除了繞 ±π 插值或重設造成的跳動。

**修正**（`src/ui/viewport/useFPSInput.ts`、`src/ui/viewport/look-filter.ts`）：

- 進入時改用 `requestPointerLock({ unadjustedMovement: true })`；只有瀏覽器回 `NotSupportedError` 才回退一般模式，其他錯誤照舊顯示。
- 滑鼠位移先經 `LookSpikeFilter`：遠大於近期動作的一筆（> max(120 px, 4×近期峰值)，近期峰值半衰期 60 ms）先保留一筆；下一筆延續同方向且至少有其 1/4 才一起套用，否則丟棄。真的快速甩動只延後一筆，孤立的錯誤位移被丟掉。每次鎖定狀態改變都重設。
- 靈敏度 0.002 rad/px 沒有改；原始模式不經 Windows 指標加速，手感可能略有不同。

## 2. 預設球偶爾無聲

**原因**（用真實 Rapier 預設場景重現）：碰撞音只在接觸 episode 開始那一個 tick 判定，並且 `samplePair` 會略過預先距離大於 1.5 cm 的接觸點。球以中等速度落地時，solver 可能透過「預測（speculative）接觸」在球仍離地 1.6 cm 時就施加衝量；那一個點被略過，就沒有 OnImpact。會不會落在這種情況只取決於 60 Hz 固定步的相位，所以同樣的動作有時有聲、有時沒有。例：從 1.6 m 落下的第二次落地 1.44 m/s、衝量 2.1 N·s 完全無聲。另外，低彈跳（約 0.3–0.7 m/s）沒有離開接觸範圍，整段算同一個 episode，也不會再響。

**修正**（`src/physics/physics-world.ts`）：

- 有實際衝量的接觸點一律計入，不論預先距離；沒有衝量的遠點仍依 1.5 cm 排除。
- 依[事件模型](../../../10-sound-behaviors/EVENT_MODEL.md)的 rearm 規則：同一 episode 內連續 3 個 tick 沒有法向衝量（穩定分離）之後的新衝量，視為新的打擊，仍須通過原本的衝量、接近速度與 80 ms cooldown 門檻。靜止或滾動的接觸每個 tick 都有衝量，不會重新觸發。
- [Physics Bridge](../../../10-sound-behaviors/PHYSICS_AUDIO_BRIDGE.md) 中「persistent contact 重新打擊的 rearm extension 尚未做」一句已由本修正取代；該規格頁是 Wiki 固定來源，本輪未改寫，列為後續文件同步。

## 3. 抓取在快速轉視角時鬆脫

**原因**：被抓物件以有限衝量追一個在視線前方 2 m 的目標點。目標點每秒最多移動 3 m、速度前饋上限 3 m/s，每公斤加速度預算 20 m/s²，落後超過 1.5 m 就立刻放開。172°/s 的一般快轉，目標點就以 6 m/s 移動，預設球追不上而被放開；115°/s 時已落後 1.18 m。

**修正**（`src/physics/physics-world.ts`，[物理架構](../../../04-physics/PHYSICS_ARCHITECTURE.md) 4.1 標明這些是可調 demo 邊界）：

| 參數 | 原值 | 新值 |
| --- | --- | --- |
| 目標點移動與速度前饋上限 | 3 m/s | 20 m/s |
| 伺服自然頻率 wn／阻尼 | 10 rad/s／1 | 20 rad/s／1（kp 400、kd 40） |
| 每公斤加速度預算 | 20 m/s² | 150 m/s² |
| 絕對手力上限 FhandMax | 150 N | 150 N（不變） |
| 力矩預算 | 15 N·m | 15 N·m（不變） |
| 放開條件 | 落後 > 1.5 m 立即放開 | 落後 > 1.5 m 持續 0.5 s，或落後 > 3 m 立即放開 |

仍是有限衝量、目標掃掠＋重疊檢查、不 parent 到相機、不 teleport；受阻時停止往牆後延伸的規則不變，重物仍受 150 N 上限而落後較多。[物理架構](../../../04-physics/PHYSICS_ARCHITECTURE.md) 4.1 的「建議起始值」與 [驗收補充](../../../11-v1/ACCEPTANCE_AMENDMENTS.md) 同為 Wiki 固定來源，本輪未改寫，數值以本頁為準並列為後續文件同步。

## 驗證

證據檔在 [user-reported-fixes-20261103](archive://uncommitted-local/docs/16-nonadvanced-completion/lanes/integration/user-reported-fixes-20261103/)。

| 項目 | 結果 | 證據 |
| --- | --- | --- |
| 碰撞音：落地重現（Node＋真 Rapier） | 修正前從 0.4–3 m 落下，0.41–1.44 m/s 的落地有 1–2 次無聲；修正後每次 ≥0.4 m/s 的落地都有 OnImpact，靜止後不再觸發；新測試修正前 RED、修正後 GREEN | `tests/physics/contact-emission.test.ts`、[探測程式](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/d2a63d852baa62c7a15c4f706980957b9ffc43dc) |
| 碰撞音：真 Chrome 產品 build（`c1002ac7`，e2e） | 10 次落下，每個 OnImpact 都啟動一個原生 440 Hz 聲音（每次 2–3 次撞擊），0 個拒絕 | [impact-sound-probe-c1002ac7.json](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/38f3c9b6570b0131940e3171d0ed59349f779ad6) |
| 視角：單元測試 | 尖峰過濾 6／6；第一人稱進入協調 19／19，新增「要求原始滑鼠、只在不支援時回退」與「孤立尖峰被丟棄」兩案在修正前來源 `3a03adc3` 都失敗、修正後通過 | `src/ui/viewport/look-filter.test.ts`、`src/ui/viewport/fps-entry-coordination.test.ts` |
| 抓取：快轉測試（Node＋真 Rapier） | 預設球在 2 m 處，180° 轉身：172°/s 由落後 1.42 m 被放開→落後 0.18 m 保持；344°/s→0.57 m；573°/s→1.82 m 仍保持並追上；新測試在原伺服 RED | `tests/physics/grab-turn.test.ts`、[探測程式](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/53b04beacdb19937a129e6a51ef21d831181177a) |
| 抓取：V1 牆／角落／堆疊矩陣（0.1–20 kg） | 牆與角落穿透 ≤0.1 mm（原 ≤0.6 mm）；20 kg 受重力堆疊接觸 0.4→2.0 mm；衝量不超過不變的 150 N 上限 | [前](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/8a22cf7ba1db47d2691351977c3a35805ad929ad)／[後](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/2102343869f4b6ea6a405b4e843354dfc4137b8d) |
| runtime 全部單元測試（`2f2aa2c7`） | 2284／2284 | [log](archive://uncommitted-local/docs/16-nonadvanced-completion/lanes/integration/user-reported-fixes-20261103/test-runtime-2f2aa2c7.log) |
| 真 Chrome：pointer-lock race（`956ee761`） | 2／2 | [結果](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/d57aa7dd2d5ca7ef3c1666b67aac978dd84a02d5) |
| 真 Chrome：十次 lifecycle（`956ee761`） | 2／2 | [結果](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/59bfb758f7c559d1c1c5d93055e0d5ef4c61a4c1) |
| 真 Chrome：linked-workflow-v2（`f04fbbf8`） | 8／8（原本 2 項只因 canvas 選擇器與「事件表最新在上」假設而失敗，已修測試、斷言不變） | [結果](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/7113959e47f1dc5fb98f086c7baac0ac0f7d85b2) |
| 真 Chrome：ui-refined-v2 | 修正後 `956ee761` 43／47；同一批 spec 在修正前來源 `3a03adc3` 也是同樣 4 項失敗（英文對話框、音訊緩衝重啟訊息重複、曲面聲學說明、OnBounce 選項），屬既有落差，非本次修正造成 | [後](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/1a052858027de48483f4868a7817f4d67fd3aa61)／[前](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/7f908f3648291ca98d5e3e828cdbe599cc311790) |
| 真 Chrome：refined v3 產品 E2E（`956ee761`） | 1／3 乾淨啟動＋重新連結通過；失敗仍是錄製中「錄製評估佇列已滿」暫停，與修正前相同的環境問題 | `artifacts/v1/product-e2e-chrome-20261103T142634Z/` |
| 使用者實測 | 視角與碰撞音「Both fixed」；抓取「Grab feels good」 | 本頁開頭 |
| S4 全 22 路徑 | NOT RUN（本輪未重跑） | — |

測試維護：pointer-lock race、ui-refined-v2（含 gizmo、首次使用、語系、第一人稱競態）與 linked-workflow-v2 的 spec 原本用 `locator("canvas")` 或 `document.querySelector("canvas")`，頂列監測加入第二個 canvas 後會在進入鎖定邏輯前失敗，或默默選到頂列音量表；已全部改為 `.viewport-canvas-wrap canvas`，沒有改任何斷言。文件程序以外的 spec（linked-workflow-v1、meta-ui-workflow、native-admission、pipeline-ui）仍有同樣寫法。測試執行曾覆寫已追蹤的 R21 證據截圖 `artifacts/v1/r21-helptips-20261101/help-*.png`，已還原原檔。

## 限制與後續

- 原始滑鼠模式與尖峰過濾只能以單元測試與使用者實機確認；headless Chrome 無法重現 Windows 的錯誤位移。
- 抓取參數、rearm 與預測接觸規則已在本頁與程式記錄；Wiki 固定來源 `PHYSICS_ARCHITECTURE.md`、`PHYSICS_AUDIO_BRIDGE.md`、`ACCEPTANCE_AMENDMENTS.md` 待後續同步。
- refined v3 在本機目前狀態仍無法穩定 4／4（環境問題，見[介面整理紀錄](../ui/readability-pass-20261103/README.md)）。
