# ADR-007：Scene / Material Data Contracts

- 狀態：Accepted for preproduction；schema 不取代 domain validation。
- Context：物理／聲學／AI／recorder 對 units、IDs、band coefficients 必須一致。
- Decision：版本化 JSON Schema，SI、右手 +Y/-Z、quaternion xyzw；Scene revision 與 geometry revision 分開。材質記 evidence class、來源、頻帶、安裝條件；A/R/T energy conservation 由 validator 檢查。
- Alternatives：直接序列化 Three／Rapier／Steam 物件（耦合且難 migration）；untyped AI JSON（不可靠）；fallback 為顯式 migration adapters。
- Evidence：[DATA_CONTRACTS.md](../DATA_CONTRACTS.md)、[材料理論](../../../research/theory/ACOUSTIC_THEORY.md)。
- Trade-offs：schema 不能自行驗證 registry refs、mass tensor、mesh manifold 或 energy sum；需要第二階段 domain checks。
- Risks：把 absorption 與 transmission 重複計損、band interpolation 假裝 measured、negative scale mesh normals。拒絕無來源的測量標籤。
- Reversibility：migration保留 original hash／version；禁止 silent reinterpretation。
