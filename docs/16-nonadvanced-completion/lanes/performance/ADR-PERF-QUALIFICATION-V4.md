# ADR-PERF-QUALIFICATION-V4：嚴格窗外 begin-only task 的獨立方法版本

狀態：候選規則經 Root 授權實作；**NOT_QUALIFIED／NOT_APPROVED**。尚無新版 semantic pilot、20 秒 wiring 或正式 600 秒證據。本 ADR 不修改或取代原 V3 結果。

## 問題與已核實來源

semantic-attempt01 固定在 bd64e4f；原 V3 正確拒收唯一 owned renderer task：ThreadControllerImpl::RunTask、ph=B、cat=toplevel、無 dur，開始時間為原 native end 之後16,311微秒。47 個完整 X spans、RAF 集合與時間錨點保留。舊結果仍為 UNVERIFIED_NOT_APPROVED。

獨立官方鏈見 semantic-01-independent-review.{md,json}：Chromium revision861389936bf33ea77529ee5dcc0605e68f6bb620 的 DEPS 固定 Perfetto403906f4adfbf287a02e5546f8430dcc9d56b649；其 export_json.cc 對 unfinished slice 輸出 B 且不造 duration/end。原 JSON 沒有 protobuf duration_ns，無法證明為何該 slice 未結束。src_file／src_func／src_line 是 posting location，不是執行函式成本。

## 獨立 V4 候選契約

原 trace 完整保存。原 validateNativeV3 對同一 raw 仍執行並保留拒收。新增 typed classification 不寫回、裁切、修補 raw，不產生虛構 X span。

唯一新增分類為 POST_WINDOW_BEGIN_ONLY，必須同時符合：

- producer revision、launcher SHA 與獨立 registry 候選固定值完全相同。
- task owner 與原有效 begin/end anchors 所屬 renderer pid/tid 完全相同。
- 名稱 ThreadControllerImpl::RunTask、category 精確 toplevel、phase B；top-level 僅有原始七欄 args/cat/name/ph/pid/tid/ts，dur/tdur/s 均不存在。
- args 僅有 src_file/src_func/src_line，精確為 cc/trees/proxy_impl.cc／ScheduledActionSendBeginMainFrame／849。
- ts 有限且嚴格大於原 native end。不得以 epsilon、取整或顯示精度改邊界；end 與下一個較小 binary64 值皆拒收，下一個較大值才可分類。
- 每個 owned renderer 最多一個此分類。任何不能由原 V3 接受、也不能由此唯一規則分類的 owned task 都拒收。

輸出保留原 event index 與完整 source event，另列 duration:null、numericIncluded:false。若已證 source location 的候選出現在錯誤 owner，不能借用 other-thread exclusion 取得分類。其他原本可排除的非 owner 工作仍依原 V3 規則記錄，不拿其時間補滿主緒成本。

B 在窗內、跨窗但未知結束時間、B.ts==end、未知 E、錯誤 category/name/args/location/identity、非有限時間、含 dur（含0或null）、多個候選一律拒收。沒有 duration 不等於0成本；此分類只證明其開始於成本視窗之後。

## 原核心與新證據

完整 X spans 交給未修改的 unchangedNumericV3／formalNumericV3，保留 binary64 anchors、union/intersection、原 caps、原50,000微秒coverage 與原門檻。600 秒 wall、voices、default/stress paths、geometry、capture、tails、recorder caps 均不改。資料缺少維持 null，不以單元測試或碼審取代原生追蹤資格。

有限 RED/GREEN 包含原真 raw 的舊拒收、exact／nextfloat end 邊界、inside-overlap、schema/owner/producer/cap 負例、原 raw 不變，以及新 typed 完整 spans 的成本與原數值 reference 完全相同。Registry 初始 status=NOT_QUALIFIED；獨立 source review 加新的 semantic raw review 後才能另版登記資格。不得將 attempt01 回填 PASS。

後續為有限純回歸與獨立審查、新 semantic pilot、原20秒 all wiring、最後原600秒。Probe-free 同條件與 PCM／process CPU 開銷另列，不把未觀測 callback CPU／硬體 underrun冒充0。
