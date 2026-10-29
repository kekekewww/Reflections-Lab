# ADR-006：Audio Rendering Backend

- 狀態：Accepted for preproduction；真實 audio graph V2/V5 尚未驗證。
- Context：continuous emission、collision voices、HRTF、path delays、reverb 必須共同維持時間連續。
- Decision：Web Audio source graph；原生節點可滿足時先使用，fractional delay／高密度 path bank 才導入 AudioWorklet。禁 audio thread 等 AI／worker；使用單一 emission epoch。
- Alternatives：native full renderer（fallback 需 native device／clock 全部測試）；每 path 大量 PannerNodes（先 cap／profile）；offline convolution（分析可用但非互動）。
- Evidence：[Web Audio 2021 Recommendation](https://www.w3.org/TR/2021/REC-webaudio-20210617/)、[AUDIO_RUNTIME.md](../AUDIO_RUNTIME.md)。浮動 URL 已轉向 1.1 Working Draft。
- Trade-offs：瀏覽器 HRTF、output latency 與節點限制依實作；不能保證所有瀏覽器同聲。
- Risks：雙重距離增益／延遲、delay jump、IR normalization、late events、voice clipping。自算傳播時避免額外套同一 effect。
- Reversibility：SpatialAudioRenderer 接受中立 frame／events，未來 native 提供同等 capabilities。
