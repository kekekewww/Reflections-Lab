# ADM／BW64 匯出：標準、資料契約與驗證研究

查閱日期：2026-10-29（Asia/Taipei）。研究基準 `c210ca882ca8503b322c28884bf1e9f6e9fe126d`；本文為繁體中文 canonical 研究，沒有新增 ADM exporter、依賴或外部交付，也沒有宣告 Dolby／DAW／平台相容。`CR-ADM-*` 是本輪本地 Claim IDs，尚未登錄中央 Ledger。

## 1. 結論與現況

未來可在現有穩定 source IDs、recording timeline、asset provenance 之上加入獨立的 export pipeline；目前應保留最小資料契約與測試計畫，不把 ADM serializer 加進即時 audio path。一般 ADM metadata、BW64 檔案容器、Dolby Atmos Master ADM Profile、終端播放 codec 是四個不同層次。

**CR-ADM-001／VERIFIED fact（code）**：正式程式目前沒有 ADM／BW64 exporter。`src/audio/wav.ts` 是 bounded uncompressed RIFF/WAVE PCM／float32 匯入預檢；其 header 拒收 BW64／RF64，但未知 RIFF chunks 會略過。因此部分 RIFF-container ADM BWF PCM 檔可能被當一般 WAV 接受，不能寫成「所有含 ADM 的 WAV 都拒收」；實際上沒有解讀／保留 `axml`、`chna` 與 ADM 語義。

`src/experiments/types.ts`、`src/experiments/recorder.ts` 的 source phase／AudioEngine epoch cursors 明示不是硬體 PCM read pointer；封存的是 canonical JSON。`src/app/replay-audio.ts` 把 source seconds 與 propagation 分開，透過既有 SourceGraph 重播 captured decisions。這些是未來 exporter 的 provenance 與重播輸入，不能代替實際獨立 stem PCM。對 `src/`、`server/`、`schemas/`、`package.json` 搜尋 ADM／BW64／RF64／`audioTrackUID`／`audioBlockFormat` 沒有找到 production implementation。現行 recording JSON 或 stereo render 不是 ADM objects。

本報告中 **VERIFIED fact** 僅指已讀官方標準／程式事實；**analytical** 是本案推導；**PROPOSED** 尚未採納／實作；**UNVERIFIED** 表示未驗能力。XML 能被 parser 讀取不等於完整標準、profile 或目的端接受。

## 2. 標準、容器與互通層次

| Claim／層次 | 已核實事實 | 本案影響 |
| --- | --- | --- |
| CR-ADM-002／ADM model | ITU-R BS.2076-3（02/2025）官方狀態 In force；Objects、DirectSpeakers、HOA、Binaural 等有不同語義 | 版本需明示；不把所有 spatial audio 都塞成 objects |
| CR-ADM-003／BW64 container | ITU-R BS.2088-2（11/2025，2026 editorial amendments）為 In force；BW64 有 `BW64` magic、首個 `ds64`，`axml` 載 XML、`chna` 作 PCM track／ADM ID 對應 | serializer 與 PCM writer 分層；不能把普通 RIFF writer 改副檔名就稱 BW64 |
| CR-ADM-004／資料圖 | ADM 的 programme/content/object/pack/channel/track references 與 PCM allocation 要一致 | stable domain IDs 需映射為合法 ADM IDs；缺 reference 不能靜默略過 |
| CR-ADM-005／profile | Dolby master profile 額外限制不由一般 ADM/BW64 相容自動推出 | 需 `targetProfile`／版本／目的端獨立 gate；不預先承諾 Atmos |

BS.2076-3 支援 decimal 與 sample-based time；`audioFormatExtended.version` 需明示，省略代表初版 BS.2076-0。這些新標準能力不表示所有現有 library 或 DAW 都支援；初版 exporter 應選固定的共同 subset，不能把較新版欄位默默寫入較舊 profile。[ITU BS.2076-3 官方狀態](https://www.itu.int/rec/R-REC-BS.2076-3-202502-I/en)、[正式 PDF](https://www.itu.int/dms_pubrec/itu-r/rec/bs/R-REC-BS.2076-3-202502-I!!PDF-E.pdf)

`chna.trackIndex` 從 1 起算並對應 interleaved PCM 的 channel 順序；ADM UID 與物理 track 不必永遠一對一，不同時間可重用，但 allocation 必須明確。最小 exporter 建議避免 track reuse，先以獨立完整 stem／固定 mapping 換取可驗性。[BS.2088 官方狀態](https://www.itu.int/rec/R-REC-BS.2088/en)、[正式 PDF](https://www.itu.int/dms_pubrec/itu-r/rec/bs/R-REC-BS.2088-2-202511-I!!PDF-E.pdf)、[EBU CHNA 說明](https://adm.ebu.io/guidelines/reference/excursions/chna_chunk.html)

## 3. 三種出口先明確選擇

**CR-ADM-006／VERIFIED fact（標準語義）＋PROPOSED（本案分類）**：object-based 交付需要可獨立處理的聲音 channels 與 metadata；混合成 binaural stereo 後無法單靠 XML 恢復個別音源。一般 stereo DirectSpeakers 與耳機 Binaural 也不同。[EBU audio types](https://adm.ebu.io/background/audio_types.html)

| 出口 | 必須提供的 PCM | 可以宣稱／不能推得 |
| --- | --- | --- |
| `dryObjectMaster` | 每 logical source／instance 的獨立 dry stem；gain/pitch/envelope 責任明示 | 可交換 authoring scene；一般 ADM renderer 不會自動重現本案房間鏡射、材質／大氣、occlusion、late |
| `bakedBinaural` | 選定 listener trace 與 renderer 下的最終 stereo PCM | 可保存該聽點的結果；不能還原 objects，也不保留可自由移動 listener 的場景 |
| `bakedSpeaker`／未來 HOA | 指定 layout／HOA conventions 的多聲道 PCM | 可保存已烘焙空間結果；不是原始 emitter／acoustic simulation graph |

不建議把每條 transient acoustic path 直接升格為 ADM object：path 的出生死亡、近似預算和 source 的語義不是同一層，且可能重複原聲／direct。如果後續專門研究 baked reflection objects，需自訂清楚的出口契約與 receiver reference、證明 direct／reflection 各只出現一次，並承認它是特定渲染表示，不能冒充可重算房間模型。房間幾何、材料 provenance、solver 配置與 listener trace 應留有版本化 sidecar；ADM 不取代 Scene/Experiment。

## 4. 明確座標轉換

**CR-ADM-007／VERIFIED fact（官方軸向）**：ADM Objects Cartesian 是 +X 右、+Y 前、+Z 上，通常用 normalized cube；HOA 是 +X 前、+Y 左、+Z 上。Reflection Lab 是 SI metres、+X 右、+Y 上、-Z 前，不能直接寫入相同的 `[x,y,z]`。[EBU coordinate systems](https://adm.ebu.io/guidelines/reference/excursions/coordinate_system.html)

以下為 **PROPOSED／analytical** 本案 Objects 轉換，假設 reference frame 與 Reflection Lab forward/up 定義一致：

```text
r = inverse(R_reference) * (p_world_m - referenceOriginWorldM)
positionADMObjects = [r.x, -r.z, r.y] / metersPerNormalizedUnit
metersPerNormalizedUnit = D > 0
```

`[x,-z,y]` 是 proper rotation；除以 D 是顯式尺度政策。不要套用到 HOA；若研究 HOA，另定 axis／ACN/order／normalization 與所選 ADM subset。source quaternion 也不能直接塞進未定義的 ADM 欄位。

最小契約至少包含：

```typescript
interface ExportSpatialReference {
  coordinatePolicy: "fixedReference" | "listenerRelativeBaked";
  referenceOriginWorldM: [number, number, number];
  referenceOrientationQuaternion: [number, number, number, number]; // [x,y,z,w]
  metersPerNormalizedUnit: number;
  outOfRangePolicy: "fail" | "explicitUniformRescale";
  coordinateAdapterVersion: string;
}
```

這是資料設計提案，尚無 schema／implementation。超出選定 subset/profile 範圍時應 fail，或經明示、全場一致的 scale；不可逐 axis 或逐 object 默默 clamp。以 fixed reference 作第一個研究版本，listener trajectory 留 sidecar。`listenerRelativeBaked` 是特定聽點的烘焙政策，不應稱完整 moving-listener scene exchange。

必要解析 fixtures：左／右／前／後／上／下六軸、非原點 reference、reference yaw/pitch、round-trip、尺度、越界與 NaN。例：本案 forward `[0,0,-D]` 必須到 Objects `[0,1,0]`，up `[0,D,0]` 到 `[0,0,1]`；此處只是手算 expected，**本輪未執行 exporter 座標測試**。

## 5. 時間、獨立 stems 與一次性烘焙責任

**CR-ADM-008／VERIFIED fact（官方語義）**：`audioObject.start` 相對檔案開始；`audioBlockFormat.rtime` 相對 object start。EBU 指引建議 blocks chronological、contiguous，首 block 從零開始；duration 必須和實際 PCM 區間一致。[Timing guide](https://adm.ebu.io/guidelines/tutorial/timing.html)、[Dynamic metadata](https://adm.ebu.io/guidelines/tutorial/dynamic.html)

**PROPOSED**：以 export file 的整數 sample index 為時間權威，保存 rational tick→sample mapping、origin／rounding policy。直接由絕對 tick 計算 sample placement；不要每 tick rounding 再累加，避免長時間漂移。loop、one-shot、pitch automation、fade、pause／seek、resample、trim 與 tails 都要明確；現有 logical cursor 不是過去全部音訊 automation／filter state 的完整錄音。

```typescript
interface ExportStemContract {
  logicalSourceId: string;
  instanceId: string;
  pcmAssetSha256: string;
  generatorVersion: string | null;
  seed: number | null;
  sampleRateHz: number;
  pcmEncoding: string;
  channelCount: number;
  totalSampleFrames: number;
  fileStartSample: number;
  sourceStartSample: number;
  durationSamples: number;
  tailSamples: number;
  gainApplied: boolean;
  pitchApplied: boolean;
  envelopeApplied: boolean;
  propagationApplied: boolean;
  hrtfApplied: boolean;
  lateReverbApplied: boolean;
}
```

上述只是最小欄位草案；IDs／references、metadata blocks、版號、來源授權、hash／dither／normalization、`sourceToTrackMap`／`admIdMap` 與 export policy 仍需正式 schema。實體 PCM track index 是容器內對應順序，不能反過來當 source domain ID。不能因 active voice budget 截斷後，把已混合的 tracks 繼續標「獨立 object」；不足時應明確 fail／改選 baked 出口。

**CR-ADM-009／analytical＋PROPOSED**：dry object stem 對應 emission clock；arrival rendering 對應含 propagation 的結果。若 PCM 已烘焙傳播延遲／HRTF／late，後段不得再加一次。`propagationApplied` 等 flags 是輸出責任描述，不是泛用 ADM 自帶的房間求解功能。要保留特定 Reflection Lab 聽感，先產生可核對 PCM，再記 renderer／browser version／sample rate／listener trace／acoustic configuration hashes；單純 dry+position 不足以重現原 SourceGraph。

## 6. 可研究的工具與部署邊界

| 工具 | VERIFIED fact（官方 README） | 採用前還需核實 |
| --- | --- | --- |
| [EBU libadm](https://github.com/ebu/libadm) | C++11 ADM XML parse/create/write；README 明列 revisions／部分 elements 尚未完整支援、沒有 S-ADM | 固定 release/commit、selected subset；不能直接稱完整 BS.2076-3 支援 |
| [EBU libbw64](https://github.com/ebu/libbw64) | header-only BW64 reader/writer，列出 ds64／axml／chna、integer PCM16/24/32 | 實際 writer 功能、chunk ordering／大檔／encoding；不等同泛用codec |
| [EBU EAR](https://github.com/ebu/ebu_adm_renderer/blob/master/README.md) | 獨立 ADM/BW64 render／dump；有 strict 與 overload 相關選項 | 文件仍引用較舊 ADM；先資格化 subset／版本；可 render 不等於全profile相容 |

libadm/libbw64 官方 repo 標示 Apache-2.0；本輪未下載／編譯／新增任何依賴。未來採用須固定版本、完整依賴與 notices，另判斷 C++ server/offline helper 或經驗證的 WASM build。不要為匯出把 native SDK 強塞進即時 audio callback；export job 應獨立、可取消、有限記憶體／磁碟／時長與明確錯誤，保留舊 project 不因失敗損壞。

## 7. Dolby 與 consumer playback 分開

**CR-ADM-010／VERIFIED fact（有限公開證據）**：Dolby Atmos Master ADM Profile 是額外 profile，不能由一般 BS.2076 或 BW64 合法推得。官方 v1.0 PDF URL 存在；搜尋索引可見 2019-07-22、BS.2076-0 及額外 constraints，但直接抓取回 502，片段帶 Confidential header。本輪沒有完整讀取／重散布 profile，也不將該舊索引內容當作最新完整要求。[Dolby 官方 profile URL](https://developer.dolby.com/globalassets/documentation/technology/dolby_atmos_master_adm_profile_v1.0.pdf)

Dolby 公開工作流程將 ADM BWF 視為製作／交付 master，之後仍編碼為 distribution format，stereo master 另行交付。因此「產生 ADM 檔」不能當成「消費者裝置已可播放 Atmos」，也不能當成音樂平台上架資格。[Dolby Music workflow](https://professionalsupport.dolby.com/s/article/Getting-Started-with-Dolby-Atmos-Music)

**UNVERIFIED**：最新完整 Dolby profile、vendor extensions、指定 DAW importer、實際目的端接受、播放 codec、認證／商標／授權條件。本輪不替使用者接受第三方條款。未來 export manifest 至少保存 `targetProfile`、`profileVersion`、`validatorVersion`、目的端與實際結果，失敗不得改標一般 ADM PASS 來冒充同一目標成功。

## 8. 可重現驗證計畫與本輪狀態

本輪只完成 read-only code／official-source review；**未跑 ADM serializer、PCM export、libadm/libbw64、EAR、DAW 或 Dolby 相容測試**。本案沒有 exporter，因此不建立照抄草案的空測試。以下全部為 PROPOSED gate：

1. 固定標準／profile/subset 與 negative fixtures；XML version／schema、reference graph、duplicate IDs、missing reference、未知 attributes。parse成功和full conformance分開。
2. 真 PCM interleaving／sample count／bit depth／endianness／chunk sizes／padding／`ds64`／`axml`／`chna`；trackIndex從1、UID allocation與PCM完全一致；大檔與truncation負例。
3. 各stem相異impulse與聲源ID；移動position blocks與PCM同一sample origin；六軸／round-trip／非原點reference；整數時間、loop／pitch／fade、trim、pause/seek與tail。
4. dry與baked責任：無重複gain、propagation、HRTF、late；stereo輸入不能冒充object decomposition；capacity不足明確fail。
5. 兩個獨立parser round-trip；selected subset的EAR render，確認無overload並聽／量方位；選定DAW實際匯入和再匯出；記各版本／flags／hash，不以同一serializer自我round-trip作唯一證據。
6. 大場景export的峰值記憶體、cancel／crash-recovery、原子完成／失敗保留；權利來源、依賴notice及sidecar完整性；最終目的端由實際需求另驗。

合理的下一步是先決定出口類型與一個公開、固定的最小 ADM subset，設計獨立 mono stems 的離線 capture；當真 PCM／sample origin 有證據後，才選 writer。它是後續功能提案，不能自動加入目前凍結 V1 gate 或聲稱已實作。

## 9. 官方來源與存取紀錄

所有 access date 為 2026-10-29。只保存原創摘要與連結，不收錄第三方全文。

| ID | 官方來源／版本 | 本輪查閱程度 |
| --- | --- | --- |
| ADM-S01 | [ITU BS.2076-3 狀態](https://www.itu.int/rec/R-REC-BS.2076-3-202502-I/en)／[PDF](https://www.itu.int/dms_pubrec/itu-r/rec/bs/R-REC-BS.2076-3-202502-I!!PDF-E.pdf) | In force；PDF相關§5、§5.13、§6–9可讀；不稱每段皆完整審讀 |
| ADM-S02 | [ITU BS.2088](https://www.itu.int/rec/R-REC-BS.2088/en)／[BS.2088-2 PDF](https://www.itu.int/dms_pubrec/itu-r/rec/bs/R-REC-BS.2088-2-202511-I!!PDF-E.pdf) | 現行版與相關container/chunk規則可讀；舊2088-1不作現行權威 |
| ADM-S03 | [EBU coordinates](https://adm.ebu.io/guidelines/reference/excursions/coordinate_system.html)／[types](https://adm.ebu.io/background/audio_types.html) | 官方說明可讀；本案矩陣與scale是另標analytical/proposed |
| ADM-S04 | [EBU timing](https://adm.ebu.io/guidelines/tutorial/timing.html)／[dynamic](https://adm.ebu.io/guidelines/tutorial/dynamic.html)／[CHNA](https://adm.ebu.io/guidelines/reference/excursions/chna_chunk.html) | 官方指引可讀；指引不取代選定profile的正式限制 |
| ADM-S05 | [libadm](https://github.com/ebu/libadm)／[libbw64](https://github.com/ebu/libbw64)／[EAR](https://github.com/ebu/ebu_adm_renderer/blob/master/README.md) | 官方README／能力與限制；未pin／安裝／編譯／驗證library |
| ADM-S06 | [Dolby profile v1.0](https://developer.dolby.com/globalassets/documentation/technology/dolby_atmos_master_adm_profile_v1.0.pdf) | 官方URL搜尋索引片段；直接502；全文／最新完整要求UNVERIFIED |
| ADM-S07 | [Dolby Music workflow](https://professionalsupport.dolby.com/s/article/Getting-Started-with-Dolby-Atmos-Music) | 公開官方工作流程；沒有帳號／DAW／submission或播放測試 |
