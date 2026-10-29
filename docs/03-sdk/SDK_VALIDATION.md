# Steam Audio SDK 隔離驗證

狀態：**Technical Spike Verified（Windows x64）**。這不是正式應用、部署、聽感或聲學精度驗收。

## 已執行的環境與命令

- 執行時間：`2026-10-25T19:05:46.1187836Z`，台灣時間 2026-10-26 03:05:46。
- OS：`Microsoft Windows NT 10.0.26200.0`，X64 process；PowerShell 7.6.5。
- Compiler：`C:\msys64\ucrt64\bin\gcc.exe`，`gcc.exe (Rev8, Built by MSYS2 project) 15.2.0`。
- CPU 環境描述：`Intel64 Family 6 Model 183 Stepping 1, GenuineIntel`，環境提供 32 logical processors；CIM 存取受限，未取得可靠 CPU 商品型號。
- SDK：4.8.1；官方 ZIP hash 與 publisher digest 一致，181,171,027 bytes。
- 執行 DLL SHA-256：`ca3dbc01dbc24492717011e80f6a51404ca143ae344ca660971d2c983f1e058d`。
- 測試原始碼 SHA-256：`a45f8300ac40e079ec9fa20228a4295c96881d36eed7db2b6653e1c5c58476b7`。
- 歷史 JSON 結果 SHA-256：`c8bfeffa9f303fde2d6974a5ba3d8a6ca9fb86dd1f114cdedeac53b5156fddc2`；原始 JSONL stdout SHA-256：`7195c1e4aaaec23d12bd5f21daf635205c752bff5c8a83b8017be7105acb54cf`。

```powershell
./scripts/setup/steam-audio.ps1 -Download -Extract
./experiments/sdk-smoke-tests/run.ps1
```

下載腳本固定 tag、URL、檔案大小與 SHA-256，校驗成功才解壓。run script 會重新校驗 ZIP，以 `-std=gnu17 -Wall -Wextra -Werror -O2` 編譯原始 C 測試，依官方 header 型別透過 `LoadLibraryExA/GetProcAddress` 呼叫 DLL。此方式使用現有 GCC，不需要先安裝 Visual Studio；僅為 Windows x64 的可重現 spike。其他編譯器／平台尚未測試。

完整小型結果保存於 `experiments/sdk-smoke-tests/results/native-win64-2026-10-26.json`，原始 stdout 另存同名 `.jsonl`；下一次執行輸出到忽略的 `build/last-run.json` 及 `build/smoke-output.jsonl`，不覆寫歷史證據。JSON 中的 source／SDK／DLL hashes 及本節的結果 hashes，將原始碼、參數與輸出連結；後續 run script 亦會自動寫入 output hash。

## 場景、輸入與判定

使用右手座標及公尺。房間為 6 × 3 × 8 m，12 個外牆三角形，另有 x=0 的 2 個內牆三角形，共 14 triangles／12 vertices。所有面使用合成測試材質：absorption `[.1,.2,.3]`、scattering `.1`、transmission `[.2,.1,.05]`。這不是實測材料資料。

Source 固定 `(-1,1,0)`。第一個 listener 為 `(-1,1,2)`，與 source 同側且相距 2 m；第二個 listener 為 `(1,1,0)`，亦相距 2 m但穿過內牆。distance attenuation、air absorption、raycast occlusion、transmission 同時開啟。測試 assert：clear attenuation=.5、clear occlusion=1、blocked occlusion=0，blocked transmission 等於三頻帶材質值，容差 `1e-5`；air absorption 需有限。

反射設定：4096 rays、32 diffuse samples、8 bounces、1 source、2 threads、0.25 s duration、Ambisonics order 1、48 kHz、512 sample frames、default CPU ray tracer。前兩次使用 parametric reflection，要求各頻帶 RT60 estimate 有限且 >0。第三次 convolution 要求 non-null IR handle，並將 Dirac impulse 輸入 reflection effect 連續處理 28 frames，要求四聲道所有 sample 有限且總能量 >0。每個 cycle 都重新建立及釋放所有 handles，檢查 release 後 handles 為 null；第三次才卸載 DLL。

## 實際結果

| 檢查 | 結果 | 證據 |
| --- | --- | --- |
| 官方 SDK 下載、SHA-256 | PASS | 本機計算等於 manifest／GitHub digest |
| C test 編譯 | PASS | GCC，warnings-as-errors，exit 0 |
| 初始化 context／scene／mesh／simulator／source | PASS | 三個 cycle 完成 |
| 2 m clear distance attenuation | PASS | 全部 0.5 |
| 同側／穿牆 occlusion | PASS | 全部 1／0 |
| 穿透係數 | PASS | `[0.200000003,0.100000001,0.0500000007]` |
| 空氣吸收 | PASS（有限性） | 未驗證 ISO 模型精度 |
| Parametric reflections | PASS（有限、正值） | 兩組結果如下；未視作解析 RT60 真值 |
| Convolution reflections／Dirac rendering | PASS | 4-channel finite output，energy `0.0626459021818` |
| Release、再初始化 | PASS | 每次 handles 皆 null，下個 cycle 可重建 |
| 泄漏檢測／sanitizer | NOT RUN | null handle 不是無 memory leak 證明 |
| HRTF、音訊裝置播放、Doppler | NOT RUN | 本次不產生裝置聲音 |
| 動態 instance／材質更新、pathing、baking／raw IR extraction | NOT RUN | 僅 API 檢查，未執行 |
| WASM link／browser runtime | NOT RUN | 本機 `emcc` 未找到；只有實際 archive／source 檢查 |
| 大場景效能／P95／多聲源／聽感 | NOT RUN | 本次資料不足以宣稱可達產品預算 |

| Cycle | 模式 | 初始化 ms | 兩次 direct 呼叫與取回合計 ms | 一次 reflections ms | 三頻帶 RT60 estimate（s） |
| --- | --- | --- | --- | --- | --- |
| 1 | Parametric | 0.5178 | 0.0148 | 5.8060 | `[.225812316,.220546782,.214963555]` |
| 2 | Parametric（完整重新初始化） | 0.3719 | 0.0015 | 5.2708 | `[.201755434,.202699035,.197928399]` |
| 3 | Convolution | 2.0714 | 0.0021 | 5.4765 | 不適用；result 欄位 `[0,0,0]` 並非零殘響證明 |

這是三次 cold lifecycle 的 smoke 觀察，不是統計 benchmark。兩個 parametric 結果不同，顯示不能把相同設定視為 bit-exact 決定性結果；本次沒有公開可設定 random seed 的實驗證明。不能將約 5 ms 直接解讀為總音訊延遲、可用 source 數或跨平台效能。

## 真實遇到的障礙與處理

1. sandbox 內 `Invoke-RestMethod https://api.github.com/...` 首次失敗：`無法識別這台主機`。官方資料仍可由瀏覽工具讀取；經核准的網路執行成功取得 metadata 並下載指定 ZIP。沒有繞過付費或帳號控制。
2. `Get-CimInstance Win32_Processor` 回報 `用戶端無法存取 CIM 資源`。改記錄 OS／arch／compiler 及環境 CPU 描述，不編造型號。
3. 本機沒有 Emscripten。沒有執行 WASM link，因此不能將歷史 issue 或現有靜態庫清單寫成當前成功／失敗結果。

## 能證明的範圍與下一步

已證明官方 SDK、目前 Windows runtime 與既有 GCC 能完成最小聲學流程及重新初始化。尚需：單平面反射的到達時間與能量驗證、獨立 solver comparison、動態障礙 commit、material update、Baked IR extraction、native audio thread 壓力／underrun、1／8／32 source 的 P50/P95／memory。這些應依最終 ADR 選擇性執行，不應把本次 smoke 擴大宣告為正式功能已完成。

本次測試的官方 API 與下載依據見 [STEAM_AUDIO_RESEARCH.md](STEAM_AUDIO_RESEARCH.md)；授權限制見 [SDK_LICENSE.md](SDK_LICENSE.md)。
