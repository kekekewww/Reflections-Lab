# Claude 交接：驗證事實核對

本報告僅唯讀現有 JSON／raw／log，沒有重跑測試、建置、瀏覽器或產品修改。完整證據 path/hash 見 VERIFICATION_AUDIT.json。

- **頂部四檢視已實作**：Levels／Spectrum／Waveform／Load。production attempt03 原來源 b7ade 有4通過1失敗；失敗是錄製 fixed-step guard，不能歸因為切換按鈕。後續949storage-ready來源尚未完整重跑此5案。
- **單元／整合**：83/83與118/118有重疊不可相加；118於1f3779、611方法案例於b902。最新1f258 globaltsc與production/e2e build成功；這不是全npm check、全UI或600秒通過。
- **錄製**：diag04首個 guard實證storage。create73.3ms完成後才建Worker、ACK147.6ms；firstappend83ms已完成1frame仍pending8。14連續frames52..65可公開Stop封存。準備gate有效，持續吞吐未通過。advance observer只在 recording-readiness46da已提交，async commit extension未實作；保留8frame/32MiB/guard/固定時鐘。
- **效能pilot**：CLI0只代表收集完成，status MEASURED_WITH_INCOMPLETE_ACOUSTIC_WORKLOAD，formalQualifiedfalse／600NOTRUN。physics是**256bodies/255dynamic/CCD64**，3000步nativep952.5ms>原2；UI另為**105objects/100dynamic**，20.1791秒804frames，frame50.1ms>16.67、callback42.8ms>4、occupancy50.026ms>4。
- **聲學兩組均8sources/nativevoices**。productDefault cap8/voice→64，600次actual20.000267Hz但deadline miss20；stresscap32→256，19.993458Hz miss21。兩者20Hzwindowfalse，不因平均Hz約20宣稱合格。receive-through-nativep956.3/14.5ms>1。stress量測新增76droppedPaths，warmup9另列。
- **CPU**：Win32前後皆成功，process8→9新增TracingService，wholeCPU total/ratio=null/PARTIAL；不能當0或API讀取失敗。候選把before endpoint移到Tracing.start完成後、beginUI之前，尚未實作。原sourceinputs遺漏transitive performance-attribution-metrics-v1.mjs，下一版需補，舊宣稱僅已列set。
- **實際GPU**：headlessChrome156，ANGLE NVIDIA RTX4070D3D11；不要因launchargs含enable-unsafe-swiftshader就說實際SwiftShader。2次累計underrun已在warmupAfter、20sample/end未增加，窗口delta0；非聽測或PCM無中斷保證。
- **長輸出尚FAIL**：五產品WAV+manifest實際完整，但whole63reference master max2.9802322387695312e-6、321sample超原2e-6；57/58。16診斷檔僅14完整、1partial、1missing。pairedV2 DSP150秒ERROR；V3及startupV2停於啟動，沒有新完整六對數值。startupV2 page2秒失敗不等於fullV3 page10秒失敗；原總ERROR保留、最終ownedPID/5353已清理。
- **S4完整22routes當前NOTRUN**，registry249mixedrows≠249唯一參數。必須freshfreeze/currentbuild、明示--lanes all、單browser lease；default只有recovery。
- **Windows ComputerUse當前未通過**：舊URL-confidence STOP保留，沒有新原生產品操作。需依skill由正式Windows工具操作；不得以Playwright/headedDSP替代、不得繞過安全阻擋。
- **Renderer資源重用尚未實作**：render-performance目前c321乾淨工作樹，沒有產品patch。

接手順序：先保全各tree/dirty/raw→整合可審查source候選→補錄製advance/async commit量測並窄修→重跑錄製與頂部5案→啟動probeV3及長輸出完整六對/逐檔解析→修效能方法pin/CPU順序並原負載歸因/優化→完整600秒→S4全22route+原生CU完整pipeline→接受表/Wiki/英文/globalcheck/Claude交接/本機Main整合。不得放寬原cap/門檻、跳tick或刪失敗證據。
