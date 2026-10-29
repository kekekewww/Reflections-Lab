# Steam Audio 授權與來源紀錄

查核日期：2026-10-26。以下是工程授權盤點；本次僅下載至本機隔離 cache 並執行 smoke，未替使用者接受條款、提交競賽、部署或重新散布 SDK。

## 來源、版本與完整性

| 項目 | 已查核資料 |
| --- | --- |
| 發行者 | ValveSoftware／Valve Corporation |
| SDK | Steam Audio C API 4.8.1，tag `v4.8.1` |
| Release | [固定 release](https://github.com/ValveSoftware/steam-audio/releases/tag/v4.8.1) |
| Source | [固定版本來源樹](https://github.com/ValveSoftware/steam-audio/tree/v4.8.1) |
| Binary download | [官方 C API ZIP](https://github.com/ValveSoftware/steam-audio/releases/download/v4.8.1/steamaudio_4.8.1.zip) |
| ZIP SHA-256 | `4a0aa5ec1176f38f0b0993a37c2259d9e86f27e22d5e24f83ec4c3cb9a1d5449`，本機已比對官方 digest |
| ZIP bytes | 181,171,027 |
| ZIP 中 THIRDPARTY SHA-256 | `a95e143e7d2466e82a28d6680c7287d9fc7d772136c323ab538a6d24472e70f0` |
| ZIP 中 header SHA-256 | `cfab67684fe1ed75a16bb9bccb81c31276b6fb3bad904073407db900045229e7` |
| 本機位置 | `third_party/steam-audio/cache/4.8.1/steamaudio/`（忽略，不入 Git） |

授權證據以固定版本 [LICENSE.md](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/LICENSE.md)、[TRADEMARK_RIGHTS.md](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/TRADEMARK_RIGHTS.md)、[core/THIRDPARTY.md](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/THIRDPARTY.md) 及實際 ZIP 的 `THIRDPARTY.md` 為準。

## Apache-2.0 與商標

Steam Audio 的主要程式碼採 Apache License 2.0。再散布時應提供授權副本、保留適用的著作權／專利／商標／歸屬聲明、標示修改過的檔案，若上游有適用 NOTICE 也應依法保留。Apache 不授予商標一般使用權；不能暗示 Valve／Steam 對 Reflection Lab 的背書或關係。[LICENSE](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/LICENSE.md)、[商標文件](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/TRADEMARK_RIGHTS.md)

本次對已驗證 ZIP 做完整 entry name 掃描，只有 `steamaudio/THIRDPARTY.md` 命中 license／notice／thirdparty 類名稱；未找到獨立 LICENSE 或 NOTICE 檔。這是這個 archive 的檔案清單觀察，不代表未來發行可以省略 Apache 授權。header 本身保留 Valve copyright 與 Apache 說明；未來打包時從固定來源附適用授權。

## 主要第三方元件

以下各項依官方 [THIRDPARTY](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/THIRDPARTY.md) 彙整。不能將整套預編譯 binary 宣稱為 Apache-only；此表也不是完整 SBOM。

| 元件 | 上游條款型態 | 打包時的重點 |
| --- | --- | --- |
| Intel IPP | Intel Simplified Software License（October 2022） | binary 必須原樣使用／再散布；保留著作權與條款；禁止未授權背書、逆向／反編譯／修改 |
| FFTS | BSD 類三條款 | source／binary notices、disclaimer、不得未授權背書 |
| PFFFT | BSD 類條款 | 保留 attribution／disclaimer；包含其 UCAR／NCAR 來源聲明 |
| MySOFA | BSD 類三條款 | 保留著作權、條款與 disclaimer |
| Intel Embree | Apache-2.0 及其內含 notices | 依實際平台／是否連結確認完整聲明 |
| AMD RadeonRays | MIT | 保留 copyright／permission notice |
| AMD TrueAudio Next | MIT | 保留 copyright／permission notice；不是預設 CPU smoke 的測試範圍 |
| CIPIC HRTF Database | CIPIC 特別使用條款 | 允許使用／修改／再散布，但保留 copyright，條款另有致謝請求；不可替換成 MIT 宣告 |
| Google Spherical Harmonics Library | Apache-2.0 | 保留適用授權與歸屬 |

`dependencies.json` 還列有 FlatBuffers、zlib、ISPC 與工具／測試用依賴。是否出現在最終散布物，須依 compile/link、平台與資料資產判定；不能只把 THIRDPARTY 的 headings 當成所有依賴已審完。[Dependencies](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/build/dependencies.json)

官方 source build 文件指出 IPP 是可選的 closed-source 相依，具有 PFFFT／內建數學替代路徑。若未來要求完全開源的 binary 組合，需固定 build flags、各元件版本及產生新 SBOM／效能結果；不能假定官方 DLL 的內容與自行重建版相同。[Build instructions](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/doc/build-instructions.rst)

## 再散布與競賽狀態

| 工作 | 狀態／處理 |
| --- | --- |
| 本機下載、完整性校驗、隔離測試 | 已完成；未作外部發布 |
| Git 追蹤 SDK DLL／ZIP／靜態庫／完整第三方文件 | 未執行；忽略 cache/build |
| 發行 Reflection Lab 安裝包 | 尚未執行；先製作實際 binary inventory、附完整 notices／license |
| Unity 方案 | 另需查 Unity 當期使用條款，Steam Audio 授權不涵蓋 Unity |
| WASM 方案 | 靜態連結仍須按實際包含的 code／data 保留條款，不會因 browser 執行免除義務 |
| Hackathon 是否允許使用這些預編譯 SDK | 由競賽正式規則及 compliance 文件判定；開源授權本身不等於競賽已允許所有準備行為 |

專案正式授權總表應交叉參考本檔與 `docs/01-compliance/LICENSE_REGISTER.md`，保留「主程式碼授權」與「官方預編譯發行物的各元件條款」的區別。
