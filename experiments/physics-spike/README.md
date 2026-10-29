# Rapier 隔離式可行性驗證

查核日期：2026-10-26（Asia/Taipei）。狀態：**6 / 6 PASS**。這是研究階段的 Node.js / WASM API 與數值 smoke，尚未建立正式產品互動功能。

## 重跑

使用 Node.js 22.17.0、npm 11.4.2，Windows x64。依賴固定為 `@dimforge/rapier3d-compat@0.21.0`，獨立於根目錄 package；`package-lock.json` 包含 npm integrity。

```powershell
Set-Location 'D:\Developing\Meta Hack\experiments\physics-spike'
npm ci --ignore-scripts --no-audit --no-fund
npm test
```

已安裝依賴時，也可從專案根目錄執行：

```powershell
node experiments/physics-spike/smoke.mjs
```

腳本每次重寫本目錄 `results.json`；它是 **latest／可變** 的工作結果，記錄 UTC 執行時間、環境、容差與數值。下節的時間戳快照是本次固定證據。物理固定步長 `h = 1/60 s`，單位為 m、kg、s、N、N·s。沒有接觸的數值測試關閉睡眠並使用預設零阻尼。

## 固定快照與來源雜湊

已實際執行：

```powershell
node experiments/physics-spike/smoke.mjs --archive
```

```text
ARCHIVED experiments/physics-spike/results/rapier-win64-20261025T192231997Z.json
PASS: 6 checks, @dimforge/rapier3d-compat 0.21.0, dt=0.016666666666666666s
```

固定證據為 `results/rapier-win64-20261025T192231997Z.json`，執行時間 `2026-10-25T19:22:31.997Z`。SHA-256：`bd84d577e09cbfe7155422d4e9d8c23cb17a179fcf70eba66f3652cefc998e9f`。正常測試不寫入 `results/`；`--archive` 以 UTC 時間產生檔名，使用 `writeFile(..., {flag: 'wx'})` 排他建立，腳本遇到同名檔案會失敗而不覆寫。這是腳本的 write-once 政策；雜湊可用來檢查後續外部修改。

保存後另跑一次正常 `node experiments/physics-spike/smoke.mjs`，六項仍通過；執行前後 archive SHA-256 相同，命令輸出 `ARCHIVE_UNCHANGED BD84D577E09CBFE7155422D4E9D8C23CB17A179FCF70EBA66F3652CEFC998E9F`。因此 latest 已可獨立更新，固定快照保持原值。

Schema 2 在每次結果中包含下列來源證據。本表對應上述固定快照；腳本若修改，後續結果會記錄新的來源雜湊。

| Artifact | SHA-256 |
| --- | --- |
| 執行腳本 `smoke.mjs` | `cd8f6234f7a47b85d734ec6eb37645d297898eb379bca5dcb5ff7b2604f02e83` |
| 獨立 `package-lock.json` | `33e30676831f0b6d769855183ca812f903d0e4f5875519fd199fce8f48c035b7` |
| 實際 ESM import `dist/rapier.mjs` | `02dc6a4e2fffc013bab08fbb44fa68f501d8303615e9afe4c7d89ad4eedda0d0` |
| 套件附帶 `dist/rapier_wasm3d_bg.wasm` | `17cfa80eebd8de0291b948496dbffba724b98b489687f8272ca236a7bbf1dd4b` |
| 從 compat ESM 內嵌 base64 解碼的 WASM payload | `17cfa80eebd8de0291b948496dbffba724b98b489687f8272ca236a7bbf1dd4b` |

Compat 執行入口內嵌 WASM；不能僅因套件附帶 `.wasm` 檔案就宣稱該外部檔案被載入。本 smoke 找出 ESM 中唯一解碼為 WebAssembly magic／version 1 的 base64 token，解碼為 3,082,103 bytes，並逐 byte 確認與附帶 `.wasm` 相等。結果分開記錄容器、解碼 payload、外部 artifact 的 hash 與長度；未將 JavaScript hash 冒稱 WASM hash。

快照也保存 npm tarball 來源 `https://registry.npmjs.org/@dimforge/rapier3d-compat/-/rapier3d-compat-0.21.0.tgz` 及 lockfile 的 `sha512-tCl1HPGwOhn5aCQbgqWbOH+Nx/5fnr3IPAnzQuR7zIhC/raqi2yxC6LhvZqjdI2El5hQgY5RDAwDrAjAi2FdPA==`。這是 npm 來源封裝的 integrity，與解壓後單一檔案的 SHA-256 分開。

## 已執行命令與結果

一般 sandbox 下，初次 `npm view` 與 `npm install` 失敗：`getaddrinfo ENOTFOUND registry.npmjs.org`。改用工具的網路權限核可流程後，安裝及唯讀 metadata 查詢成功。未修改根目錄 package。

```text
npm install --ignore-scripts --no-audit --no-fund --fetch-retries=0 --fetch-timeout=15000
added 1 package in 7s

npm view @dimforge/rapier3d-compat version dist.tarball license --json --fetch-retries=0 --fetch-timeout=15000
{
  "version": "0.21.0",
  "dist.tarball": "https://registry.npmjs.org/@dimforge/rapier3d-compat/-/rapier3d-compat-0.21.0.tgz",
  "license": "Apache-2.0"
}

npm test
PASS freefall_matches_analytic_velocity_and_bounded_position_error
PASS dynamic_zero_gravity_retains_inertia
PASS fixed_ignores_impulse_then_explicit_dynamic_restore_moves
PASS impulse_is_instantaneous_and_addForce_persists_until_reset
PASS collision_force_and_solved_contact_impulse_are_separate_apis
PASS spring_joint_to_position_kinematic_anchor_api_smoke
PASS: 6 checks, @dimforge/rapier3d-compat 0.21.0, dt=0.016666666666666666s
```

首次成功執行：`2026-10-25T19:04:42.612Z`（台灣 2026-10-26 03:04:42）。以下數值對應該次紀錄；之後重跑時間以 `results.json` 為準。

| 檢查 | 實際觀察與通過條件 | 能支持的結論 |
| --- | --- | --- |
| 自由落體 | 從 y=10 m 經 0.5 s，vy=-4.9049964 m/s（解析值 -4.905，容差 0.001）；y=8.7635317 m（解析值 8.77375，容差 0.05 m） | 固定步長動態剛體與重力基本行為成立；離散位置不要求等於連續解析解 |
| 無重力動態物件 | gravityScale=0 時 1 s 內高度維持 10 m（容差 1e-5 m）、vx=2 m/s、x≈2 m（容差 1e-4 m）；恢復 scale=1 後 0.5 s 的 vy≈-4.905 | 無重力仍有慣性，與 Fixed 不同 |
| Fixed → Dynamic | Fixed 在 100 N·s 衝量及重力下 1 s 位置不變（容差 1e-6 m）；切 Dynamic、scale=0、明確設定 vx=2 並喚醒後，1 s 的 x=1.99999845 m（容差 1e-4 m） | 引擎能切換 body type；恢復政策仍需應用程式明確決定 |
| Force 與 impulse | m=2 kg；12 N·s 單次 impulse 產生 vx=6；僅呼叫一次 addForce(12 N)，0.5 s 的 vx≈3，1 s≈6；resetForces 後再 0.5 s 不再加速（容差 1e-4 m/s） | `applyImpulse` 與 `addForce` 不可交換，外力會持續直到 reset |
| 碰撞資料 | 1 kg 球落到靜態地板；tick30 出現 collision start，force≈304.109741 N，manifold normal impulse≈5.068496 N·s；可讀 world-space solver point | 事件可取得，但 force event 不含 impulse 欄位；需另外讀 manifold |
| Spring joint | 1 kg 球、零重力、kinematic anchor 在 x=2；rest=0 m、k=40 N/m、c=8 N·s/m；3 s 後 x=1.99999475 m（容差 0.05 m），過程最大 x≈2.1458745 | `JointData.spring` 與 position-based kinematic anchor 可在此單一無負載案例建立並運作 |

## 重要 API 限制

- `TempContactForceEvent.totalForce()`、`totalForceMagnitude()`、`maxForceMagnitude()` 的語意是力。不能將數值直接標成 N·s 的衝量。此案例的 `F·h` 與讀回接觸衝量吻合，仍不能把這個單接觸案例當作所有複合碰撞的一般證明。
- `world.contactPair(a,b,callback)` 的 `TempContactManifold.contactImpulse(i)` 可讀解算後的接觸法線衝量。`i` 屬幾何 contact；`solverContactPoint(j)` 的 `j` 屬 solver contact，兩者不能假設相同索引。
- `solverContactPoint(j)` 是 world space；`localContactPoint1/2(i)` 是各自 shape local space，且須處理 callback 的 `flipped`。暫時 event/manifold 只能在 callback 內讀值後複製，不能放入非同步佇列直接保存物件參考。
- 靜置球在後續每一步仍產生約 9.81 N 的支撐力、0.1635 N·s 的衝量，因此 `impulse > 0` 不足以觸發 impact 音效，需 onset、接近速度／能量、pair state、cooldown 等條件。
- Rapier 的 collider handle 是 opaque 數值，這次出現 `5e-324`；不可假設為一般遞增整數或把 handle 當作長期 Domain ID。事件紀錄應使用應用程式穩定 Object ID / Collider ID。
- 官方套件 README 把一般 build 的跨平台確定性列為不保證；這個 smoke 未驗證跨平台、不同瀏覽器或不同引擎版本的 bitwise replay。固定步長不等於跨平台重播保證。

## 證據與授權

實際安裝套件的 `package.json` 為 `0.21.0`、`license: Apache-2.0`，並附完整 `LICENSE`。依賴保留在被忽略的 `node_modules/`，不將整份第三方套件複製到研究來源庫。發布產品時仍應由授權清冊整合 Apache 2.0 授權、適用通知與修改揭露義務。

官方來源（查核 2026-10-26；網站 API 文件可能隨新版更新，精確 API 另以本次固定版 `.d.ts` 與實測確認）：

- [官方 npm 套件與版本](https://www.npmjs.com/package/@dimforge/rapier3d-compat)
- [Rapier rigid bodies](https://rapier.rs/docs/user_guides/javascript/rigid_bodies/)
- [Rapier rigid-body forces and impulses](https://rapier.rs/docs/user_guides/javascript/rigid_body_forces_and_impulses/)
- [Rapier joints](https://rapier.rs/docs/user_guides/javascript/joints/)
- [Rapier advanced collision detection](https://rapier.rs/docs/user_guides/javascript/advanced_collision_detection/)
- [TempContactManifold API](https://rapier.rs/javascript3d/classes/TempContactManifold.html)
- [TempContactForceEvent API](https://rapier.rs/javascript3d/classes/TempContactForceEvent.html)
- [官方原始碼及授權](https://github.com/dimforge/rapier)

## 尚未驗證

瀏覽器初始化、Pointer Lock、FPS 膠囊移動、攝影機與 Listener、實際聲音播放、碰撞安全抓取、角度控制、投擲、CCD 高速／薄牆情境、不同質量與慣量範圍、放置重疊檢查、大量物件效能、跨平台重播均為 **NOT RUN**。Spring 的單案例成功無法決定產品 grab 選型；正式穩定性需另行驗證受限輸出、碰撞限制與目標跳變。
