# Steam Audio 隔離 smoke test

這裡只有 C API 技術驗證，沒有正式產品程式。

```powershell
./scripts/setup/steam-audio.ps1 -Download -Extract
./experiments/sdk-smoke-tests/run.ps1
```

前置條件：Windows x64、PowerShell 7、支援 GNU C17 的 GCC（本機實測 MSYS2 UCRT64 GCC 15.2.0）。腳本校驗既有 SDK、編譯 `smoke.c` 並動態載入已驗證的 `phonon.dll`。三個完整生命週期測 direct／parametric／convolution；assert 失敗或 compiler/runtime 非零會讓命令失敗。

`build/` 忽略且可重建；`results/native-win64-2026-10-26.json` 是實際執行的小型數值證據。完整方法、容差、時間與未執行事項見 `docs/03-sdk/SDK_VALIDATION.md`。不將 handle-null 檢查當成 leak detector，也不將單次時間當成效能預算保證。此測試沒有播放聲音或呼叫雲端服務。
