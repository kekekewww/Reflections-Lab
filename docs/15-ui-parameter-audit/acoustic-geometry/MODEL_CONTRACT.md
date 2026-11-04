# 曲面與移動反射器有限模型契約

本輪範圍依使用者將「尚未支援」選項也納入實作的要求，對應 RLAB-TASK-0030。保留原箱體解析參考、數學公式與容差；新增曲面及明示移動反射器模型，不把整體 V1 或人工驗收標成完成。

## 幾何與數學

球及膠囊沿用 Scene 的實體尺寸。球半徑為 dimensionsM[0]/2；膠囊半徑相同，沿當前 quaternion 的局部 +Y 軸，半直段長為 (dimensionsM[1]-dimensionsM[0])/2。每個非 fixed 物件必須供應當前 tick 的真 pose，缺失明確拒絕；不得退回 authored pose 冒充 snapshot。

遮蔽查詢解析閉體積的有限線段區間：球為二次式，膠囊為有限圓柱與端球聯集。只排除實際端點 epsilon，內部線段及中段 tangent 保守視為不透明遮蔽。不新增穿透路徑。曲面反射位置採外部嚴格共同可見弧的駐值：球每候選最多 48 次二分；膠囊枚舉兩端帽及側面，最多 144 次。側面的軸向解按兩腿徑向距離加權；候選使用真外法向，接縫僅回傳一條。獨立解析及 value-only 數值參考、條件與固定容差見 [REFERENCE](reference/REFERENCE.md)。

反射器的 role 為 staticReflector 或 dynamicReflector；dynamicOccluder 只遮蔽。既有 moving staticSurface 保持遮蔽語義，Inspector 說明需改選 dynamicReflector，不能偷偷改作者 role。dynamicReflector 使用每個 snapshot 的真位置及旋轉，沒有移動邊界 retarded-time 或 Doppler 解。

## 預算與可追溯性

所有 surfaces + primitives + boxOccluders 共用原 maxSurfaces（預設 256），上限不放寬且不默默丟棄。Sphere/capsule 各占一項。只在 extended 模型且未壓縮幾何超過預算時，dynamicOccluder 箱體才由六個平面改為解析 OBB 體積遮蔽；反射箱體永遠保留六個有限真平面。OBB 使用 inverse-quaternion 的三軸 slab 相交，不產生反射。舊 planar-only request 不改表示。每 source 先排 emitting body 再核預算；cache 包含 faces/volume 表示且僅存活於一次 snapshot 建置，不跨 tick。

原 105-object 混合 regression 包含 33 箱、33 球、33 膠囊加基底 6 物件；新增曲面後原表示是 289 項，導致真實失敗。解析遮蔽物壓縮後為 124 項，124 可接納、123 明確拒絕，原 fixture 與 256 上限不變。segment tests 仍有明示上限，未完成可見性 fail closed，不能把缺路徑解讀成物理無路徑。

Path ID 由 model/topology/source/listener/geometry IDs 組成，座標及排名不進 ID。法線只用於求解，不捏造 AcousticFrame normal。只有 solver 產生聲線。

## 模型版本與錄放

純舊平面請求維持 web-geometric-1.0.0。任何有聲學角色的曲面或 dynamicReflector 場景使用 web-geometric-primitives-1.0.0；同完整 Scene 的所有 source 都明示 pin 相同版本，即使自身 geometry 排除後沒有曲面。Unknown pin 或 extended geometry 搭舊 pin 明確拒絕。

新錄製與重評 metadata 必須核真模型；舊 baseline 不能在新模型下偷算成 matched A/B，需重錄才能比較。舊已存 AudioReplay 保留原版本及 paths，不依今日 Scene 新能力回推拒絕。source.objectId 保留 binding ownership；emitterObjectId 省略沿 owner 自排除、null 表示 zone/fixed detached 不排 owner、字串排明示且存在的實體。明示動態 emitting body 即使被排除幾何，仍必須提供有效、單位旋轉的真 pose。

所有新 Runtime／Host 錄製在 solverConfig 加 emitterGeometryPolicy=explicit-emitter-body-v1。這是 caller 的幾何排除政策版本，不改 solver 全球版本；同新版物件掛載 A→固定／區域掛載 B 保持相同政策，按原 behavior A/B 自變項規則比較。既有 artifact validator 不插 default、不改已存 bytes；受影響的舊 fixed／zone baseline 缺 policy 必須重新錄製，不能在新重評中默默改遮蔽。policy 不同會透過原 solverConfigHash 明確 mismatch；原樣已存 AudioReplay 仍可播放。

## 能量及未建模範圍

既有 pressure magnitude 保留 1/pathLength × sqrt((1-scattering)R) × air attenuation，未渲染的 scattering×R 是漫反射分配，不能再當吸收。這是有限 ray-path amplitude 近似，沒有曲率 divergence/focusing/caustics 補償。沒有固體 transmission、diffraction、surface wave、相干干涉、低頻全波、retarded-time 或 moving-boundary Doppler；模型不保證任意波長的小物體遮蔽準確。科學主張 CG-REF-001～005 及原始來源在 [Evidence Ledger](../../../research/EVIDENCE_LEDGER.json)，文獻不是數值測試。

## 驗證層級

V0：契約、資料正負例、UI enabled/state gate、版本及 budget 測試另附原始收據。V1：獨立解析/value-only numerical reference，加舊平面回歸。V2：僅 fake-context replay/transport 接線測試，不冒充真 Web Audio 波形驗證。V3：外部獨立聲學 solver／全波比較 NOT RUN。V4：本階段 Node test elapsed 不當正式裝置性能；真 browser/runtime/deadline 由整合驗收另列。V5：校準房間／聽測／人工測試 NOT RUN。
