# ADR-014：聲音行為與物理／傳播分層

- 狀態：**Accepted for architecture，2026-10-27；產品 implementation pending**。來源：[使用者需求](../../00-project/SOUND_BEHAVIOR_REQUEST.md)、[研究](../../10-sound-behaviors/SOUND_BEHAVIOR_RESEARCH.md)、[架構](../../10-sound-behaviors/SOUND_BEHAVIOR_ARCHITECTURE.md)。
- Decision：採 **宣告式Event Rules＋正交State Machine**，以Inspector為主要作者介面。狀態來自經正規化的Physics／Player events；規則選內容、曲線與logical instance；每個3D emitter經同一Custom Acoustic Core與Web Audio renderer。Graph editor與modal synthesis為P2，沒有新增middleware強制依賴。
- Separation：剛體運動／接觸、發聲內容、聲學介質／表面各自有權威。使用者把撞擊換成鋼琴不改mass/friction或牆的absorption；sample preset標感知近似／Creative，不能稱自然振動模擬。Gravity0不是vacuum；真空仍有機械碰撞，但本版不模擬固體傳聲。
- Physics：OnThrow／OnDrop來自成功的明確互動意圖，impact需pair episode／有效接觸資料；rolling／sliding依接觸點相對速度與角速度、support/contact、hysteresis判定。閾值屬Tuned且要有fixtures，不當物理常數。正式維護位置：[Event Model](../../10-sound-behaviors/EVENT_MODEL.md)與[Bridge](../../10-sound-behaviors/PHYSICS_AUDIO_BRIDGE.md)。
- Data：新增獨立draft version1 contract／asset registry／bindings／record refs，尚不改SceneSpec既有v1欄位或AI舊12工具enum。host migration／command validation／原子apply／inverse與正式renderer尚待實作。JSON合法仍需domain、registry、revision／capability／budget查核；禁止任意JS規則。
- Audio：continuous instance持久、one-shot可重疊；contact聲源定位於接觸區而非一律COM。共用既有clock／absolute delay／path IDs／HRTF與距離衰減政策，不開一條Behavior→master的3D捷徑。
- Experiments：區分acoustic A/B（固定發聲信號）與behavior A/B（明示改內容／gain／pitch／profile）；後者固定motion／raw physics-player events／listener／solver／medium，不能冒充只改聲學材質或用音樂推RT60。
- Priority：先補Audio Event Runtime前置；最小P0為AlwaysOn＋OnImpact、bounded gain/pitch＋統一傳播＋簡單Inspector。OnGrab／OnThrow與WhileAirborne依FPS／interaction prerequisites解鎖；不為展示新規則而跳過碰撞／音訊連續性／Meta真整合的既有主線。
- Risks：contact storm、voice/path爆量、錯誤A/B、shared profile改版、missing assets、clock／replay不一致、AI捏造ID／測量。見[驗證](../../10-sound-behaviors/SOUND_BEHAVIOR_VALIDATION.md)與[限制](../../KNOWN_LIMITATIONS.md)。
- Not superseded：ADR-002/004/005/006/007/008/009/011核心權威不變；此新增橋接與作者資料層，不另寫一套physics/acoustics solver。Codex開發政策另見ADR-013。
