# ADR-009：Experiment Recording

- 狀態：Accepted for preproduction；完整 recorder 尚未實作。
- Context：修改 acoustic material 後要比較相同運動；只錄鍵鼠無法提供本案跨平台已驗證的可重現性。
- Decision：initial snapshot＋每 tick pose／velocity trace＋contact event trace＋input intent＋版本 manifest。A/B 主模式用 authoritative motion trace 驅動聲學；原 collision trace 只在聲學材料改變且 physics 不變時重用。
- Alternatives：同版 Rapier snapshot deterministic resim（fallback 與診斷）；只錄 input（不具充分證據）；錄影（不可分析／再求解）。
- Evidence：[Rapier determinism](https://rapier.rs/docs/user_guides/javascript/determinism/)、[RECORD_REPLAY.md](../../07-experiments/RECORD_REPLAY.md)。
- Trade-offs：pose trace 較大；控制時鐘／取樣／interpolation 必須記錄。不能稱 trace playback 為重新物理求解。
- Risks：修改質量／摩擦後仍使用舊碰撞事件會污染 A/B；該情況需重跑且標 mixed factors。
- Reversibility：版本化 storage、hash content assets；未來可加入壓縮與已驗證 deterministic runtime。
