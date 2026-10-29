# Dataset Catalog

查核日期：2026-10-26（Asia/Taipei）。本表是資料選用與驗證設計，**沒有下載、重製或執行任何第三方音訊資料**。`PAGE_VERIFIED` 表示已閱讀官方資料頁；`FULL_TEXT_VERIFIED` 僅適用於明確開啟的論文全文。公開可下載與可再散布是不同條件；`UNKNOWN` 不得以其他資料集、程式碼授權或 Zenodo 預設值補齊。

## 優先選用

| ID | 資料／參考實作 | 類別 | 個別授權查核 | 第一個驗證用途 | 取得狀態 |
|---|---|---|---|---|---|
| D01 | pyroomacoustics | 獨立幾何聲學參考實作／合成 RIR | MIT，已查官方 README | V3：shoebox 直達音及一階反射到達時間 | NOT RUN |
| D02 | SADIE II | HRIR、BRIR、SOFA | Apache-2.0，官方頁明示 | V2：SOFA 座標、左右耳、方位與取樣率 | NOT RUN |
| D03 | BRAS v3 | 反射、散射、繞射、量測基準場景 | CC BY-SA 4.0，官方完整 metadata 明示 | V3/V5：選一個 reference scene，比較頻率響應／RIR | NOT RUN |
| D04 | Acoustic screens and two-layer systems | 吸音、複數反射、正規化表面阻抗 | 官方頁明示 CC BY；版本號未在文字顯示 | V1/V5：複數反射與吸音轉換、量測變異 | NOT RUN |
| D05 | dEchorate | 有 early-echo 標註的量測 RIR | 資料 UNKNOWN；配套程式 MIT | V5：早期反射標註與幾何到達時間 | NOT RUN；授權待補 |
| D06 | RealImpact | 實物 impact sound field、接觸力 | 程式 MIT；外部音訊檔個別授權 UNKNOWN | V5：衝擊力與聲音模態／方向性關係 | NOT RUN；授權待補 |
| D07 | OpenAIR | 不同空間的量測 RIR | 本次未取得各條目授權，UNKNOWN | V2/V5：卷積、EDC、衰減與空間差異 | NOT RUN；逐檔待查 |
| D08 | OpenSLR SLR26 | 合成 RIR | Apache-2.0，官方頁明示 | V2：批次 RIR 匯入與重取樣 | NOT RUN |
| D09 | RIEC HRTF | 真人 HRTF | 限學術／研究／教育、商用須許可、修改後不得再公開 | 不列競賽預設素材 | NOT RUN；受限 |

D01–D04 已具備可追溯的授權聲明與明確驗證用途，足以建立三個以上實用驗證來源的取得清單；仍需實際取檔、核對附帶條款、計算 SHA-256 及執行測試，才能改為 `ACQUIRED` 或 `TESTED`。這個表不表示任何競賽規則已核准第三方資料；競賽適用性應再連結專案 compliance review。

## D01 — pyroomacoustics

- **來源／版本**：EPFL LCAV 的 [官方 repository](https://github.com/LCAV/pyroomacoustics) 與 [Room Simulation 文件](https://pyroomacoustics.readthedocs.io/en/pypi-release/pyroomacoustics.room.html)。文件本次標示 0.10.0；尚未安裝或固定套件 artifact。
- **方法／環境**：2D／3D image-source 與 ray tracing，輸出合成 RIR。適用靜態室內幾何比較；不是量測 ground truth。
- **頻率／取樣率／配置**：取樣率、房間尺寸、聲源／麥克風、反射階數由實驗明訂。本專案建議 `fs=48000 Hz`、`max_order=1`、關閉隨機 ISM，先比對直達與一階到達時間；這些是本專案測試設定。
- **Metadata／限制**：保存版本、幾何、材料能量吸收、聲速、階數、seed。文件警告舊 `absorption` 並非目前的 energy absorption；混合 solver 仍標為 experimental。
- **授權／競賽／再散布**：MIT，保留 copyright 與許可聲明；可作競賽參考實作。內建材料表不能一律標成實測值，須另查材料 provenance。
- **取得／測試**：固定 release 或 commit 與套件 hash 後安裝；只產生小型合成 RIR。比較到達時間時先記錄 fractional-delay 的全域額外延遲 `frac_delay_length // 2` samples，不能歸入聲學傳播時間。`PAGE_VERIFIED`；執行 `NOT RUN`。

## D02 — SADIE II

- **來源／版本**：[University of York 官方 SADIE II 頁](https://www.york.ac.uk/sadie-project/database.html)，頁面列 latest release `v2-2 (18-06-2024)`。本次官方索引可讀完整頁面文字；直接開啟曾回 403，未下載資料。
- **方法／環境**：HRIR 以 Genelec 8010 於頭中心半徑 1.2 m 量測；BRIR 以 Genelec 8030/40 於 1.5 m、50-point Lebedev 配置量測。真人與 dummy head 必須分開識別。
- **頻率／取樣率／配置**：WAV 提供 44.1 kHz／16 bit、48 kHz／24 bit、96 kHz／24 bit，另有 AES69 SOFA；可用聲學頻帶須讀個別檔案 metadata，不能以 Nyquist 頻率當作保證頻寬。
- **Metadata**：有測量方向、頭部與耳部資料；官方方位角以面向前為 0°、向左逆時針。匯入時必須明確轉換到專案座標。
- **授權／競賽／再散布**：官方明示 Apache-2.0 並要求引用原資料；保留 notices、標註修改。來源 [Apache 條款](https://www.apache.org/licenses/LICENSE-2.0)。不需要為測試取用頭部掃描或照片。
- **驗證／取得**：先選一個 dummy-head SOFA 小檔，核對 release、左右耳、方向、`Data.SamplingRate` 與條款；用已知方向測 ITD／ILD 與旋轉映射。避免把舊 SADIE Database 與 SADIE II 混用。`PAGE_VERIFIED`；`NOT RUN`。

## D03 — BRAS — Benchmark for Room Acoustical Simulation

- **來源／版本**：Aspöck、Brinkmann、Ackermann、Weinzierl、Vorländer，2020 v3；[DOI 10.14279/depositonce-6726.3](https://doi.org/10.14279/depositonce-6726.3)，[官方完整 metadata 與授權](https://depositonce.tu-berlin.de/items/38410727-febb-4769-8002-9c710ba393c4/full)。論文：[10.1016/j.apacoust.2020.107867](https://doi.org/10.1016/j.apacoust.2020.107867)。
- **方法／環境**：七個 reference scenes 分離反射、散射與繞射等現象；附錄四個 complex rooms。官方特別指出後者量測不確定性較高，不能作直接 reference。
- **頻率／取樣率／配置**：各 scene 有獨立幾何與 source／receiver 描述，另有 surface descriptions。**本次未讀到原始 Documentation.pdf，不能確認逐 scene 的取樣率、有效頻帶、校準與散射係數定義**；維持 UNKNOWN，取檔前補查。
- **Metadata／限制**：比一般 RIR 庫更接近 solver benchmark；必須納入 source directivity、receiver response、環境與 boundary conditions，不能只比未校準峰值。
- **授權／競賽／再散布**：metadata 明示 CC BY-SA 4.0；引用來源，修改資料再散布遵守同授權條件。參見 [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)。
- **驗證／取得**：先取官方文件，再選最小合適 reference-scene archive；保留幾何、RIR、材料與 source／receiver 依賴清單。RS6／RS7 壓縮檔較小，不代表更適合第一階反射測試，應先讀 scene 定義。`PAGE_VERIFIED`；論文僅 publisher 預覽；`NOT RUN`。

## D04 — Statistical characterisation and responses of acoustic screens and two-layers systems

- **來源**：Gaborit、Jaouen、Dazel、Göransson，2019；[Zenodo 固定版本 10.5281/zenodo.3967083](https://zenodo.org/records/3967083)。作者頁要求引用概念 DOI `10.5281/zenodo.3358921`。
- **方法／環境**：44.44 mm 內徑、三麥克風阻抗管；woven／nonwoven film、melamine／glass wool backing，包含空腔與 rigid backing 配置。每次 session 重新校準，重複樣本可用於觀察量測變異。
- **頻率／取樣率／配置**：頁面列量測掃頻 `[4,4520] Hz`；這不是對整段可靠度的保證。取樣率在每次量測 `.irk` metadata；本次未取檔，數值 UNKNOWN。
- **Metadata**：`.irk` 有厚度、空腔、溫度、壓力、濕度；`.rok` 有吸音、複數反射、正規化表面阻抗；另有 YAML characterization。
- **授權／競賽／再散布**：官方文字明示 CC BY、要求引用，頁面未顯示版本號。可列驗證候選；再散布前解析 record license URI，不能自行填 `CC-BY-4.0`。
- **驗證／取得**：官方 `dataset.zip` 約 40 MB，先只取得 README／metadata 再選一組量測。測 `alpha = 1 - abs(R)^2` 與 `R=(z-1)/(z+1)` 時，限定正常入射、同介質且無能量傳透的相應 backing 條件；不是室內 diffuse-field 吸音或散射資料。`PAGE_VERIFIED`；`NOT RUN`。

## D05 — dEchorate

- **來源**：[Zenodo v1 10.5281/zenodo.4626590](https://zenodo.org/records/4626590)、[官方 code](https://github.com/Chutlhu/dEchorate)、[作者論文全文](https://arxiv.org/html/2104.13168)；Di Carlo 等，2021。配套 repository 已列 v3.0.0 更新，不能把 v1 DOI 與新資料混合。
- **方法／環境**：可調牆面條件的 cuboid room、多通道 RIR，有實際聲源、麥克風、image sources 與 early-echo timing 標註。
- **頻率／取樣率／配置**：須隨所選 HDF5／SOFA 版本核對；本表未取檔，取樣率與有效頻帶 UNKNOWN。v1 單一 HDF5 約 83.9 GB，不適合作為預設 bootstrap 下載。
- **Metadata／限制**：echo annotation 適合驗證反射到達時間；論文另有 annotation limitations，標註不等於每一峰皆為精確真值。移動到不同位置的靜態量測不能直接充當連續 Doppler 錄音。
- **授權／競賽／再散布**：程式 README／repo 為 MIT；Zenodo 本次 Rights 區未顯示可辨識 license，API 網域在本機解析失敗。**資料授權 UNKNOWN，不能以程式 MIT 或 Zenodo 預設 CC BY 代替。**競賽音訊採用與再散布先暫停。
- **驗證／取得**：解決資料條款後，優先官方 SOFA 小子集；記錄精確 DOI、echo IDs、座標與處理方式。`FULL_TEXT_VERIFIED`：論文可讀；`PAGE_VERIFIED`：資料／程式；資料 `NOT RUN`。

## D06 — RealImpact

- **來源**：Clarke 等，CVPR 2023；[作者官方頁](https://samuelpclarke.com/realimpact/)、[官方 repository](https://github.com/samuel-clarke/RealImpact)、[download script](https://raw.githubusercontent.com/samuel-clarke/RealImpact/main/dataset/download.sh)。
- **方法／環境**：受控 impact-hammer 敲擊實物，15 支量測麥克風隨 gantry 移動，採樣物體周圍聲場；有接觸力曲線、敲擊位置、麥克風位置、材質與 RGBD 標註。
- **頻率／取樣率／配置**：本次未讀取原始音檔，取樣率、校準與可用頻帶 UNKNOWN；不可把展示音訊當成量測檔。
- **Metadata／限制**：可比較 modal frequencies、衰減、角向差異、force-profile excitation；不涵蓋所有實際自由落體、破碎、rolling 或 scraping。repository 說明原始資料與其餘程式仍在整理。
- **授權／競賽／再散布**：repository 標示 MIT，但腳本從外部 Stanford host 下載壓縮音訊；本次未找到明確將該音訊歸於 MIT 的獨立條款，因此**音訊 UNKNOWN，程式 MIT**。不得直接當作競賽音效庫。
- **驗證／取得**：先釐清外部音訊授權，再固定 object ID／impact ID／mic ID，取單一物件子集。官方腳本批次抓全物件且會刪除壓縮檔，不應未審閱就執行。`PAGE_VERIFIED`；論文僅摘要／索引，PDF 取用失敗；`NOT RUN`。

## D07 — OpenAIR

- **來源**：[University of York 官方計畫頁](https://www.york.ac.uk/physics-engineering-technology/research/communication-technologies/projects/open-acoustic-impulse-response-library/)，資料站 `openair.hosted.york.ac.uk` 本次連線逾時。
- **方法／環境**：收錄真實空間聲學調查與模型結果；提供 stereo、B-format、5.1 等不同格式及部分 raw data。不能把所有條目都稱為量測 RIR。
- **頻率／取樣率／配置／Metadata**：必須逐條目讀取 room geometry、source／receiver、excitation、取樣率、channel ordering 與量測校準；本次皆尚未逐檔確認，UNKNOWN。
- **授權／競賽／再散布**：官方計畫頁提及商業音訊應用，但這不足以證明任一音檔有可再散布授權；個別條款本次 UNKNOWN，不下載進 Git。
- **驗證／取得**：若條目完成授權查核，可作卷積、EDC、T20／T30、C50／C80 管線測試；缺少精確幾何／邊界條件時，不作 solver 逐峰誤差標準。`PAGE_VERIFIED`：計畫頁；資料站未能取用；`NOT RUN`。

## D08 — OpenSLR SLR26

- **來源**：[OpenSLR 26 官方頁](https://www.openslr.org/26/)，對應資料增強研究。
- **方法／環境**：不同 room configurations 的**合成** RIR，原用途為 reverberant speech／ASR 資料增強。
- **頻率／取樣率／配置**：提供 8 kHz 與 16 kHz 兩包；房間幾何與處理細節須取檔後讀。不能靠升頻產生更高頻的真實反射資料。
- **Metadata／限制**：本次僅官方資料頁，未檢查 archive 內 metadata；不能作實測驗證或直接證明低頻模態、散射與繞射正確。
- **授權／競賽／再散布**：官方明示 Apache-2.0；保留條款／notices 與修改紀錄。競賽使用仍需符合整體規則。
- **驗證／取得**：先固定 mirror、檔名、checksum；只選數個 RIR 做 V2 解析、卷積與重取樣 regression。兩包分別約 128 MB／178 MB，無須預設全抓。`PAGE_VERIFIED`；`NOT RUN`。

## D09 — RIEC HRTF：保留作受限來源示例

- **來源**：[Tohoku University 官方資料頁](https://www.riec.tohoku.ac.jp/pub/hrtf/)（官方索引文字本次可讀；直接開啟回 404），Watanabe 等 2014 相關研究。
- **方法／配置**：真人 HRTF；官方列 105 名受試者、每耳 865 個方向，另有部分人體尺寸資料。取樣率與頻帶本次未核實，UNKNOWN。
- **授權／競賽／再散布**：官方條款准研究、學術、教育使用並需引用；商業使用需事先許可，修改後資料不得再公開。不能推論有獎金競賽一定屬非商業用途；不列為預設 artifact 或 demo 素材。
- **驗證價值**：若取得相應許可，可比較個體差異與 HRTF 插值；已有授權較明確的 SADIE II，因此無需此時取得。`PAGE_VERIFIED`：官方索引；`NOT RUN`。

## SOFA 匯入規約

[SOFA 官方規格入口](https://www.sofaconventions.org/mediawiki/index.php/SOFA_(Spatially_Oriented_Format_for_Acoustics)) 說明此格式用於 HRTF、BRIR、SRIR，並由 AES69 標準化。**SOFA 是格式，不是內容授權**；同一站鏡像的各資料集仍須逐項查條款。

讀取時保存 `SOFAConventions`／版本、`Data.SamplingRate`／Units、`Data.Delay`、`SourcePosition`／Type／Units、`ReceiverPosition`、`ListenerView`／`ListenerUp`、`Data.IR` 維度、左右耳次序、原始 `License`／`References`。這是本專案 importer 的驗證規格；各 convention 的必要欄位與意義以該版規格為準，不要假設所有 SOFA 都是 SimpleFreeFieldHRIR。

## 可重現取得與驗證契約

本次已建立 [取得工具](../../scripts/setup/datasets.mjs)、[實際範例manifest](acquisition-manifest.example.json) 與 [離線驗證](../../experiments/dataset-fetch-spike/README.md)。工具預設dry-run，UNKNOWN／缺pins回BLOCKED；本catalog仍未取得真實資料，不將mock測試升格量測證據。以下規格示例用於說明欄位，實際執行需用完整example格式及逐檔證據。

1. 先建立 manifest，至少含 `dataset_id`、`record_doi`、`version`、`source_url`、`download_url`、`license_id`、`license_url`、`license_scope`、`accessed_at`、`file_name`、`size_bytes`、`sha256`、`subset_ids`、`modifications`、`attribution`、`test_ids`。未知欄位填 `null`，不猜值。
2. 只有 `license_status=VERIFIED` 的固定檔案可交給取得工具；預設 dry-run、限制總 bytes、限制下載單一子集。URL、授權與 file hash 變動時停止並重新查核。禁止預設執行外部下載腳本。
3. 保存原始檔到 Git 忽略的資料目錄；manifest、原創解析程式與結果指標可版本管理。需要再散布資料子集時，先完成該子集條款、引用與修改紀錄。
4. 測試先讀 header／metadata，檢查 units、channels、finite values、樣本長度、訊號延遲與正規化；保留 raw 與 processed SHA-256。重取樣／去捲積／裁切／gain normalization 都要記錄。
5. 以 V2 檢查 DSP；以 V3 比獨立 solver；以 V5 比量測。不把合成資料或同源公式的自我比對升格成 V5。RIR 峰值誤差須先校準 source／receiver response、起始時間與頻寬；T30 所需衰減範圍不足時回報無效。

以下是取得工具預期接收的**規格示例，尚未對應任何已下載檔案**：

```json
{
  "dataset_id": "D02",
  "record_doi": null,
  "version": "v2-2",
  "source_url": "https://www.york.ac.uk/sadie-project/database.html",
  "download_url": null,
  "license_id": "Apache-2.0",
  "license_status": "VERIFIED_PAGE_ONLY",
  "license_scope": "SADIE II database official page; verify accompanying file notices",
  "file_name": null,
  "sha256": null,
  "subset_ids": [],
  "max_download_bytes": 50000000,
  "dry_run": true,
  "acquisition_status": "NOT_RUN"
}
```

## 待完成項目

- 補 BRAS 原始文件的逐 scene 頻帶、取樣率、環境、校準及材料係數定義；本次官方 PDF endpoint 未能取用。
- 補 D04 的 license version／URI；補 dEchorate 和 RealImpact 外部量測檔的 license scope。
- 逐檔查 OpenAIR，而非套用網站或他人列表的通用授權。
- 真正取得三個小型固定子集，寫入 SHA-256／attribution manifest，再執行獨立比較。**本次 catalog 完成不等於資料下載或量測驗證完成。**
