# ADR-010：Deployment Architecture

- 狀態：Accepted for preproduction；未部署、未建立雲端專案。
- Context：評審需容易操作；Meta API secret 必須 server-side；Steam native 增加分發成本。
- Decision：HTTPS web app＋same-origin AI proxy，靜態資產與 registry 版本鎖定。初版不要求 SharedArrayBuffer；評審機先做 capabilities check／user gesture audio。
- Alternatives：Tauri desktop（fallback native backend 用，但 Rust／簽署／打包需補環境）；Unity native（另一條主線）；local-only（離線展示備案，部署合規待查）。
- Evidence：[整合比較](../../03-sdk/INTEGRATION_COMPARISON.md)、[競賽規則](../../01-compliance/HACKATHON_RULES.md)、[Web Audio](https://www.w3.org/TR/webaudio/)。
- Trade-offs：web 方便但 audio device／browser 差異、CORS／隔離 header、後端 timeout 要測試；native 避免傳輸卻增加安裝。
- Risks：public repo／deployment 競賽要求未明，不將建議當正式要求；本階段不替使用者建立服務或接受條款。
- Reversibility：靜態 web bundle 與 backend contracts 可包桌面；不要在 localhost HTTP control endpoint 無驗證開任意 CORS。
