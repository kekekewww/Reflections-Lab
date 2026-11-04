# 歸因收據與同負載probe模式（有限unit證據）

實際base HEAD為`e25f9f48302fd357b0f97a6f9bf8565f5916627c`，本stage只改performance fixture／隔離tests。未變更正式CLI、browser資格、負載、產品預算或門檻；尚無browser／overhead／600秒結果。原FAIL與原正式雙pin拒絕保留。

## 實作

- Acoustic raw逐批保存現有bounded`AudioEngine.getDiagnostics()`，保留baseline／暖機終點／最後snapshot；UI約1Hz保存同一診斷。late onset、consumer stale／拒收、delivery age／拒收、voice/path drops、native output stats與unmeasured PCM/DSP欄位仍分開。
- Handler或consumer任一未量測時`totalDeliveryMs=null`；已量得0仍可加總。原receive-entry→同步native-consumer包絡繼續獨立保存，沒有冒稱browser pre-handler/OS dispatch或完整LabRuntime成本。
- `window.__performanceProfileConfig.probeMode`只允許`on`（預設）／`off`。off保留相同scene、physics steps、255wake、原30tick impulses、8source worker batches、consumer次數、absolute50ms排程、capture/action腳本；不安裝fixture RAF/cancel、method/advance/interpolation、native-start、receive、route-state和longtask observer，不讀物理sleep/timing probes，停用engine可選diagnostics。
- off只保留最小wall endpoints、工作動作與結束counter/結果；timingStatus明示`NOT_OBSERVED_PROBE_OFF`。新runner必須另外關CDP tracing，才可稱完整probe-free；原V3入口沒有讀off設定，仍維持原instrumented正式方法。

## 實際單工命令與原失敗

| raw | 實際命令／結果 |
| --- | --- |
| attribution-red.tap | `node --test --test-concurrency=1 tests/performance-v3/attribution-fixture.spec.mjs` exit1，1/3pass；未知handler被當0、diagnostics未保存，正確RED |
| attribution-green.tap | 同命令exit0，3/3pass |
| probe-free-red.tap | `node --test --test-concurrency=1 tests/performance-v3/probe-free-fixture.spec.mjs` exit1，1/3pass；off仍替換RAF並產生proof，正確RED |
| probe-free-green.tap | 同命令exit0，3/3pass |
| probe-free-physics-red.tap | `node --test --test-concurrency=1 tests/performance-v3/probe-free-physics.spec.mjs` exit1，0/3pass；off仍clock/sleep讀取且回測量值，正確RED |
| collector-focused-green.tap | 三檔合測exit1，6/9pass；新增probeMode lexical dependency未注入測試host，ReferenceError。修host而非變更期待，原錯保留 |
| collector-focused-green-r2.tap | 三檔合測exit0，9/9pass |
| collector-focused-green-r3.tap | 補actual acoustic off同批次／consumer驗證後三檔合測exit0，10/10pass，245.7275ms |

最後合測命令：`node --test --test-concurrency=1 tests/performance-v3/attribution-fixture.spec.mjs tests/performance-v3/probe-free-fixture.spec.mjs tests/performance-v3/probe-free-physics.spec.mjs`。Root授予單工小測lease，未與其他test/build/browser並跑。

## 尚未驗證

原performance regression、scoped lint、build/typecheck、真browser on/off、當前browser雙pin與semantic pilot、stall/event/path fixtures、hardware/device/rate/PCM能力、probe overhead、正式600秒完整資格與效能均NOT_RUN。上表僅驗collector與負載動作等價，不是音訊輸出、主緒CPU、硬體聽感或整體PERF001／014完成證據。source/task/Now由唯一memory writer按原criteria處理。
