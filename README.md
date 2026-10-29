<!-- architecture-review-entry -->
2026-10-29：[全面架構研究](docs/12-architecture-review/ARCHITECTURE_REVIEW.md)、[實作差異](docs/12-architecture-review/ARCHITECTURE_GAP_ANALYSIS.md)、[整合與公開狀態](docs/12-architecture-review/INTEGRATION_REPORT.md)。本輪保留既有V1，修正跨層傳播上限並預留RenderBackend；完整產品、性能與真人／外部門檻仍未完成。下方r11數量是歷史，最新V1基準為[R17](docs/11-v1/REQUIREMENT_EVIDENCE_20261029-r17.json)。原Git歷史包含禁止公開的建置／大型產物，公開push需先過[完整歷史審查](docs/12-architecture-review/PUBLICATION_AUDIT.md)。

# Reflection Lab

[English README](README.en.md) · [English user guide](docs/11-v1/USER_GUIDE.en.md)

介面可透過上方語言選單切換繁體中文／English，語言偏好保存在本機；兩種語言共用場景、聲音與驗收資料。全套英文文件已建立原文／譯文hash與current／stale對照，前次完整檢查已確認當時258份鏡像全數current、0 missing／stale／errors；本次與後續變更仍依最新報告同步。範圍見[英文補充驗收](docs/11-v1/ENGLISH_ACCEPTANCE.md)。

2026-10-28最新：[當前checkpoint r11](docs/11-v1/SESSION_PROGRESS_20261028-r11.md)的UI27、physics2、storage5、完整product4及Chromium原生音訊25／IRv2分項通過，當前完整pinned check（含917項runtime）與離線prompt benchmark通過；正式性能量測未通過，原生桌面操作與實際裝置聽測仍有未解門檻。完整第一版尚未完成，原[51項驗收](docs/11-v1/ACCEPTANCE.md)及61份保護檔案保留，[M0](docs/11-v1/M0_IMPLEMENTATION.md)維持其原範圍。依[ADR-013](docs/02-architecture/adr/013-codex-primary-development.md)由Codex主導，MuseCode與舊Harness為Optional；[開發資源](docs/09-agents/RESOURCE_STATUS.json)與產品Meta Model API分帳管理，未新增Muse或付費Meta使用。

最新入口：[持久 Wiki](knowledge/README.md) → [Index](knowledge/wiki/index.md) → [Now](knowledge/wiki/now.md)。Phase 3 的 [Codex × Muse Harness](docs/09-agents/CODEX_MUSE_ORCHESTRATION.md) 已加入有界接手與獨立驗收；實測與 Live 限制見 [報告](docs/09-agents/PHASE3_REPORT.md)。Phase2 [Wiki／設計成果](docs/09-knowledge/PHASE2_REPORT.md) 與 Phase1 證據保留，不把下方歷史數量視為現行總數。

結合三維物理互動、可追溯聲學模型與Meta AI的實驗平台。產品程式位於`src/`與`server/`；研究、Harness、spike與各層驗證各自保留來源，不冒充完整功能通過。本目錄起始為空，沒有沿用 Echo Canvas／Reflections 原型。

從 [Bootstrap Report](docs/BOOTSTRAP_REPORT.md) 開始，接著讀 [架構](docs/02-architecture/ARCHITECTURE.md)、[ADR 索引](docs/02-architecture/ADR_INDEX.md)、[實作狀態](docs/IMPLEMENTATION_STATUS.md)、[限制](docs/KNOWN_LIMITATIONS.md)、[下一任務](docs/NEXT_ENGINEERING_TASK.md)。Agents 先讀 [AGENTS.md](AGENTS.md)。

## 本地驗證

固定 Node **22.17.0**、npm **11.4.2**；Python **3.12.11** 是本次觀察版本。實際依賴版本與 integrity 在 package-lock.json。

```powershell
npm ci
npm ci --prefix experiments/physics-spike
npm run check
npm run dev
npm run build
npm run test:runtime
npm run benchmark
node scripts/agents/cli.mjs help
npm run test:agents
npm run test:prompts
```

`check`範圍以package.json為準，保留研究回歸並加入正式runtime、build及license檢查；native SDK、browser／audio、聽測與帳號API各自驗證。`dev`開啟本機Web與受限API，產品Meta預設支出上限0。正式工具鏈、獨立browser命令與限制見[Web工具鏈](docs/03-sdk/V1_WEB_TOOLCHAIN.md)；研究基線見[驗證計畫](docs/06-validation/BENCHMARK_PLAN.md)。尚未部署或提交。

第一次聆聽可先維持暫停，在底部 Monitor 按 **啟用聆聽／Enable listening**，從低裝置音量開始，再調整 Monitor gain 並按 **開始運算／繼續運算（Start simulation／Resume simulation）**。啟用聆聽不會自動恢復模擬；靜音監聽也不會暫停物理。Simulated走統一聲學鏈，Raw reference是置中乾音；結束時按Pause並靜音。dBFS不是校準的dB SPL。

已保存的[最小真Meta Sound切片](server/META_LIVE_VALIDATION.md)包含模型回覆、Host Apply與本機180ticks證據；離線重用recorded response不是新的live模型輸出。Offline tools明示不是模型；產品server預設關閉網路／budget0，本次US$1授權的3請求slots已用完，實際帳單與剩餘credit未知。

資料集取得預設 `node scripts/setup/datasets.mjs` 僅 dry-run；範例授權與檔案 pins 未齊，預期回 `BLOCKED`／exit 2，不是下載失敗。`npm run test:datasets` 用本地 mock 驗證取得工具；沒有下載真實資料。詳 [取得規格與限制](experiments/dataset-fetch-spike/README.md)。

Windows SDK spike：

```powershell
./scripts/setup/steam-audio.ps1 -Download -Extract
./experiments/sdk-smoke-tests/run.ps1
```

版本／SHA256／compiler／逐項結果見 [SDK_VALIDATION](docs/03-sdk/SDK_VALIDATION.md)。SDK cache／node_modules 不入 Git；首次下載需要網路，run 需要 Windows x64 與文件指定 compiler。聲音裝置測試未執行。

## 導覽

| 路徑                                      | 內容                                               |
| ----------------------------------------- | -------------------------------------------------- |
| docs/00-project                           | 原始需求、空目錄基準、資產與來源                   |
| docs/01-compliance                        | 官方競賽規則、授權登記、依賴清冊                   |
| docs/02-architecture                      | 有效 ADR 與歷史、資料／時間／backend 契約          |
| docs/03-sdk                               | Steam Audio 版本、授權、比較與 native 實測         |
| docs/04-physics、05-ux                    | FPS／Grab／Build／狀態、8 套工具 UX 研究           |
| docs/06-validation、07-experiments、08-ai | V0–V5、錄放／A/B、Meta 模型與工具                  |
| research                                  | 文獻、公式、資料集、Evidence Ledger                |
| docs/09-agents、prompts                   | Harness、failover、quota、prompt 與模型來源        |
| schemas                                   | 產品／Wiki／agents contracts 與 synthetic examples |
| .agents/skills                            | 15 個本專案技能與 8 個 pinned Emil upstream skills |
| tests、benchmarks、experiments            | 隔離解析／依賴／物理／SDK 驗證                     |

正式競賽提交時間目前為 **2026-11-05 10:00 台北**，申請／入選、賽前成果與完整提交欄位仍需本人核對；官方來源與時區歧義見 [HACKATHON_RULES](docs/01-compliance/HACKATHON_RULES.md)。沒有代替使用者接受條款、申請或提交。

專案自身的開源 LICENSE 尚未選定；第三方各依其 license。所有 measured/computed/estimated／未驗證項目分開記錄，不將不具校準的 dBFS 當 dB SPL。完整新增檔案清單見 [FILE_MANIFEST](docs/00-project/FILE_MANIFEST.md)。
