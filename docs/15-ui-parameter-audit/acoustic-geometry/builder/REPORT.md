# 曲面聲學輸入與 Inspector 接線

Task0030 子範圍；狀態：基本 Node／SSR 驗證通過，真 production browser 與最終合併驗證由 lead／root 另列。

## 實作

- `buildAcousticRequests` 以同一份資料供 live／record/replay／A-B：方塊保留六個平面；球體、膠囊每物件一個解析 primitive。膠囊軸由實際 quaternion 旋轉本地 +Y，半段長為 `(height-diameter)/2`。
- `surfaces.length + primitives.length` 共用既有 `maxSurfaces`；105 物件 fixture 為 24 平面＋100 primitive＝124，沒有放寬原預設 256 上限。超界早拒絕，不丟幾何。
- 排除每個發聲者自己的幾何；各 request 深複製位置、軸與 geometry，cache 不跨呼叫，新的 tick／pose 即時重建。沒有 moving pose、非有限／sparse 位置或非單位 quaternion 明確拒絕。
- 使用同一份 `acousticSnapshotRole`：fixed staticSurface 反射；明示 dynamicReflector 依 snapshot 反射；舊 moving staticSurface 保留遮蔽語意，UI 顯示原因，不自動改作者設定。

| Before | After | Why |
| --- | --- | --- |
| 球體／膠囊材質與角色整欄停用 | 依共享 shape capability 開放；running／replay 仍停用編輯 | 控制實際進入 solver 幾何，保留原狀態規則 |
| 動態反射標成依後端能力 | 明示動態反射面與準靜態限制 | 使用者可判斷已實作模型及其邊界 |
| 移動物件可新選 staticSurface 並靜默成遮蔽 | staticSurface 選項限 fixed；舊值保留且附原因 | 避免誤以為靜態設定在移動中產生反射 |

沿用既有 Section／select／micro-copy／tokens；未增加動畫、CSS 或另一套設計值。ARIA 描述連到實際顯示的模型與 legacy 說明。

每個 request 另依完整 authored Scene 固定 solver model；即使發聲者本身是唯一球體而被 self-exclusion 排除，也不會混回 legacy 版本。純平面場景仍省略新欄位以保留舊 serialized 表示。

## 原失敗與測試調整

`legacy-contract-before-update.txt` 保存舊 24 案結果：16 PASS／8 FAIL。原始測試完整 preimage 與 SHA 保存在 `legacy-test-preimages.json`，沒有刪除原資料。

- 舊 ownership fixture 未提供 default ball 的 pose，因曲面先前被排除而可過；現在補真姿態，原方塊頂點／normal／material／ownership 斷言不變。
- per-source 精確 budget 從只計平面改成加入該 request 的一個球體；全域 256 cap 不變。
- 舊 recording processor 案例硬期待 dynamicReflector 退化為 occluder 且忽略曲面。僅更新已被使用者新範圍取代的期待，補 sphere／capsule 的 pose；原 direct occlusion、finite-plane path 長度、delay 與壓力比容忍度完全保留。

## 已執行

- 最終 `node --import tsx --test tests/app/acoustic-primitives-input.test.ts tests/app/acoustic-input-ownership.test.ts tests/app/recording-processor.test.ts`：41/41 PASS、0 skip、exit 0。原始輸出 `builder-mixed105.txt`。
- 新檔共 17 案，含所有 shape／role、RecordedPose／BodyPose 一致、姿態更新、clone ownership、105 物件及精確容量、缺 pose／NaN／sparse 拒絕、legacy omission、穩定排序與 Inspector SSR 狀態。
- 指定六檔 ESLint、Prettier、全 source TypeScript：exit 0；收據及檔案 hashes 見 `verification.json`。


## 受保護混合 105 物件容量修補

原先新增的 105 物件測試只含 clone ball；真正 performance-fixture.mjs 的 uiScene 為 33 方塊、33 球體、33 膠囊加原預設物件。若把動態方塊仍當六面，總計 222 faces＋67 primitives＝289，會超過原 256。原 fixture 與 746-byte constructor 的既定 SHA 由新測試逐一核對，未改 fixture、舊數值 oracle 或 cap。

只有 EXTENDED 模型且當前 source 的未壓縮幾何數超過同一 cap 時，mapped dynamicOccluder 方塊才改成一個解析 OBB 遮擋體積。反射方塊仍保留六個精確平面；legacy 純方塊模型不新增欄位或改表示法。真混合 fixture 成為 24 反射平面＋67 曲面 primitive＋33 OBB＝124；256 與精確 124 可成功，123 仍明確拒絕。

每 source 先依自己的 emitter exclusion 計算是否需要壓縮；cache key 明確區分 faces／volume，不能因第一個 source 的表示法污染第二個。新增測試驗兩種 source 順序、OBB center／halfExtents／quaternion 的獨立所有權、實際 pose 更新與 owner 排除，以及不壓縮 reflector／legacy 的負例。

此為幾何表示與容量回歸，不宣稱正式性能改善或 600 秒測試通過。解析 OBB 交點與 solver integration 的獨立數學驗證由 lead／primitive math 子任務另列。

## 限制與接手

SSR 只證明欄位接線與 disabled／文字狀態，不是 browser 視覺或輸入通過。真 UI 點選／儲存／聲線／錄製／WAV 尚未在此子任務執行，需 root 的 browser lease 與最後整合。

曲面 specular 位置由 solver 求解，但幅度沿用射線路徑模型，不含 curvature focusing、diffraction、solid transmission 或 retarded moving-boundary／Doppler。數學 reference、能源與 V0–V5 證據由 geometry lead／獨立 reference 子任務負責，不能由本次 UI／builder 測試代替。

已定位 `tests/browser/ui-refined-v2.spec.ts:476` 的舊『曲面不參與』browser 案例；本子任務未修改或執行，lead/root 應保存其原截點後依新能力更新並重驗。
