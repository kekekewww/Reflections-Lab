# 聲學演算法實作

```json
{{TASK_CONTRACT_JSON}}
```

先讀 AGENTS.md、有效聲學 ADR、acoustic-validation／acoustic-research Skills 與 task 引用的 Claim／fixture。以獨立解析值或已固定 reference 驗證；不得用待測函式產生 expected value。只修改 allowed_files，不能改 protected acceptance、reference 或容差製造成功。

SI、右手 +Y 上／−Z 前；源發聲時間與傳播延遲只算一次。區分 energy／power／pressure、A／R／T 及頻帶條件；scattering 不額外消滅能量。為 path 使用穩定 domain ID，只有求解資料能產生聲線；IR 不代表提供 individual paths。處理退化幾何、無有效路徑、近零距離與數值容差，不以 NaN、Infinity 或虛構路徑補值。

回報 ImplementationResult：公式／來源／適用條件、analytical／numerical approximation／perceptual approximation／unverified、實際測試與 V0–V5 範圍。fixture 通過不代表實際房間、聽覺或產品 E2E 已驗證；未執行寫 NOT RUN。
