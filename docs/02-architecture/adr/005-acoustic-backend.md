# ADR-005：Acoustic Simulation Backend

- 狀態：Accepted for preproduction；正式 solver 未實作。
- Context：Demo 同時需要可選取反射路徑與容易部署；SDK reflections 不等於逐條路徑 API。
- Decision：Web worker 有限多邊形 image source direct／一階作主線，二階為 P2；聲線必由有效路徑產生。Steam Audio C API 作 native adapter 候選，依實際 capability 回 direct／IR，不合成不存在的 path list。
- Alternatives：全 Steam native（音場成熟但包裝／audio transport 成本）；Unity（現成整合但產品重起）；WASM Steam（4.8.1 SDK 確有靜態 archive，但瀏覽器 linker/runtime 未驗證）；fallback 限制 first-order static geometry，晚期用標示的 approximation。
- Evidence：[SDK comparison](../../03-sdk/INTEGRATION_COMPARISON.md)、[科學索引](../../../research/papers/PAPER_INDEX.md)、[Steam C API](https://valvesoftware.github.io/steam-audio/doc/capi/index.html)。
- Trade-offs：Web 可檢視幾何但低頻波動、繞射、漫反射、真實房間準確性有限；native IR 與 Web path A/B 不保證同模型。
- Risks：CPU 爆量、finite polygon visibility、path identity／crossfade、SDK native 部署。capability／solver ID 各自顯示。
- Reversibility：共享 Scene／Material 與 AcousticFrame；backend adapter 顯式轉換、不讓 SDK type 侵入 UI。
