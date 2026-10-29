# Support anchor 獨立審查

結論：本次修改範圍內無需修復的 P0／P1／P2 finding。

- 審查者：`/root/v1_support_anchor/support_anchor_review`，未修改產品程式、測試、驗收、Git、Wiki 或 package。
- 凍結產品來源：`src/app/physics-behavior.ts` SHA256 `de6616fbf5d2c094dc57cf510671c9f0b414f733412fbd250bcf4ee881387f20`。
- 凍結新增測試：`tests/app/support-anchor.test.ts` SHA256 `8841718a47d251529f1b6c9c1529ff2c901901a22bf1a556422ccad83631d217`。
- 獨立命令、exit code、全部 scoped dependency hashes、執行前後穩定性見 [verification.json](verification.json)。

`PhysicsWorld.poses()` 依物件自身支撐與滑動狀態挑選代表接觸。原轉接層卻再次用全域 impulse 排名，讓別的 patch／離散 impact 取代 producer 選點。修正先取 `pose.contact`，只有沒有選點時才使用既有 ranked fallback，符合這個資料權責。離散事件持續由 `event.contact` 複製，沒有被連續狀態接觸覆蓋。

手動核對了 producer 的支撐／滑動選點、`vCOM + omega cross r` 的 contact velocity、BehaviorRuntime 離散 candidate 與連續 candidate 的獨立 contact、material override 與 parent event 關聯。修改沒有改 point velocity、force／impulse 單位、SourceGraph routing、clock 或 propagation delay。新增 fixture 的數值為明示 Synthetic adapter 輸入，非真 Rapier 同時碰牆滾動分類證據。

獨立程序結果：

- `node --import tsx --test tests/app/defaults.test.ts tests/app/support-anchor.test.ts`：17／17 PASS，包含原封未改的 support regression 與真 Rapier falling-ball case。
- scoped ESLint：PASS。
- scoped Prettier check：PASS。
- 執行期間來源／測試／protected acceptance 與所列相依檔案 hashes 全部穩定。
- 相鄰回歸：`contact-emission.test.ts`、`motion-hysteresis.test.ts` 與全部 `tests/audio-behavior/*.test.ts` 共 50／50 PASS；包含真 Rapier floor／wall high-slip 選點案例。完整展開命令與 hashes 見 [adjacent-verification.json](adjacent-verification.json)，raw stdout／stderr 另存。

原始 RED 紀錄為 17 cases 中 5 FAIL，包含既有 defaults regression 與四項新 regression；fallback case 本來就 PASS。紅／綠範圍與 failures 均明列，未變更驗收門檻。

限制：本審查只確認 adapter 與 logical behavior emitter／provenance 的修正。沒有執行完整 runtime／全專案 check、真 browser Inspector、DSP routing／聲學數值、耳機聽測或效能驗收，不表示 V1-EVT-01、V1-AUD-01、V1-UX-04 的全部門檻或第一版已完成。其餘並行修改未審查。
