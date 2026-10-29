# Reflection Lab 正式產品原始碼

2026-10-29：此目錄已包含正式 React／TypeScript／R3F、Scene／Rapier／互動、Sound Behavior、custom acoustics、Web Audio、錄放／A-B、資產／專案保存及產品 AI host。server-side Meta adapter 位於 ../server/。實際能力與限制見[架構](../docs/02-architecture/ARCHITECTURE.md)、[Gap Analysis](../docs/12-architecture-review/ARCHITECTURE_GAP_ANALYSIS.md)及[第一版驗收](../docs/11-v1/ACCEPTANCE.md)。

schemas/ 是可序列化契約，experiments/ 與 benchmarks/analytic/ 是隔離研究／驗證；它們不代替產品測試。src/audio/render-contract.ts 只有未實作 backend 的預留型別，不代表已有 offline mix／stems／ADM 匯出。完整 V1、性能、真人輸入與裝置聽測尚未完成。
