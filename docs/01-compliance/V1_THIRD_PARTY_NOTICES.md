# 第一版第三方聲明索引

## 2026-10-28 r12 當前 production candidate

[r12 pack](../../artifacts/v1/bundle-notice-pack-20261028-active-rule-r12/manifest.json)與 [當前 byte 綁定及獨立審查](../../artifacts/v1/bundle-notice-current-qualification-r12-20261028/qualification-seal.json)逐檔核對最新 12 個 production 資源、149 個 installed manifests、173 份 legal payload，以及四張 source maps 的 113 個 module occurrences／15 個 packages。Root build receipt 與 assembler 的 JSON 欄位／排序不同，使用 path-keyed bytes／SHA-256 比對，不把不同 schema 的整體 digest 當作相同值。

六個原 gap records 原樣保留；只有 `@esbuild/win32-x64@0.28.2` 的「官方完整 MIT 來源文字」子狀態另記 RECOVERED，附上 byte-exact 1069-byte 原文與固定來源／lockfile 證據。該 child package 根目錄仍沒有授權檔，binary/source、native closure、再分發審查及根 LICENSE 仍未核准。只計一個 `17cfa80e…` WASM，於兩個 container 實際解碼核對。聲明包不在 `dist`，不能稱已製成公開發行包；完整 check 後還須核對重建 bytes。

## r10 歷史 production candidate 截點

[新pack manifest](../../artifacts/v1/bundle-notice-pack-20261027-1914-r10/manifest.json)保存158份whole originals＋15份原始byte ranges，共173份legal payload／1,079,808 bytes、149個installed package manifests與15個source-map observed package names。[獨立production綁定](../../artifacts/v1/bundle-notice-pack-20261027-1914-r10/production-candidate-binding.json)逐一比對本輪實際production capture的12個bundle files及目前dist bytes；generator原本的HISTORICAL_BUILD_CAPTURE標籤不改寫，最後完整check重建後仍須另核對byte equality。

只有一個產品WASM hash record，在installed rapier.mjs與目前bundled JS兩個container核對出相同17cfa80e…bytes，不能稱兩個不同WASM binary。六項缺口保留：R3F published-source lineage、Rapier精確Rust／WASM transitive closure，以及@esbuild/win32-x64、@humanfs/types、@rolldown/binding-win32-x64-msvc、natural-compare的完整原文取得缺口。沒有用metadata、MIT縮寫或最新版文字填補未核實版本。這是工程來源集合與candidate綁定，不是公開發行／合規／根LICENSE決策。

## 原依賴清冊與來源範圍

2026-10-27 本機工程依賴查核。固定版本、npm integrity、原始授權／NOTICE 檔案 SHA-256 與完整位置見 [V1_DEPENDENCY_LICENSE_INVENTORY-r2.json](V1_DEPENDENCY_LICENSE_INVENTORY-r2.json)。這份索引尚不是公開發行包的完整 `THIRD_PARTY_NOTICES`；發布前須依實際 bundle、WASM、工具 binary 與素材內容產生可隨包提供的原文聲明。初次清冊保留為歷史 snapshot；r2 驗證器另核對 README／內嵌聲明，未覆寫舊記錄。

本機 149 個安裝套件全部版本吻合根 lockfile。lockfile 共 199 個套件位置；其餘 50 個都是未安裝的 optional 平台套件。已安裝 license metadata 為 MIT 110、Apache-2.0 19、BSD-2-Clause 6、BSD-3-Clause 4、ISC 7、MPL-2.0 2、BlueOak-1.0.0 1；沒有空白 license metadata。這些數量是 metadata 清冊，不能推定每個套件只含一種授權。

## 必須保留的具體來源

| 範圍                          | 固定版本／本機原文                                                                                                            | 處理狀態                                                                                                           |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| React／React DOM              | 19.3.1；各套件 `LICENSE`                                                                                                      | MIT；保留 Meta 原文 copyright 與完整許可。                                                                         |
| R3F | 9.8.2；官方MIT完整原文與固定取得紀錄見目前pack的provenance／manifest | 完整許可已保存；取得的官方來源與npm已發布9.8.2／tag之lineage尚未核實，不能稱tag對應已確認。 |
| R3F 內含 React reconciler     | `node_modules/@react-three/fiber/react-reconciler/index.js`                                                                   | 有 Meta MIT header，原始檔 hash 列於清冊；不是因為外層套件作者不同就省略 Meta 歸屬。                               |
| Three                         | 0.186.1；`node_modules/three/LICENSE`                                                                                         | MIT；不包含未採用 examples 外部模型／貼圖。                                                                        |
| Rapier JS／WASM               | 0.21.0；`node_modules/@dimforge/rapier3d-compat/LICENSE`                                                                      | Apache-2.0；實際發行 WASM／Rust 組合與適用 notices 仍要按包審查。                                                  |
| Vite                          | 8.3.5；`node_modules/vite/LICENSE.md`                                                                                         | 檔案包含 bundled BSD-2／CC0／ISC／MIT 等原文；不能以外層 manifest 的 MIT 取代整份內容。                            |
| Rolldown                      | 1.2.15；`node_modules/rolldown/LICENSE`、`THIRD-PARTY-LICENSE`                                                                | 同時保留本體與第三方聲明；Windows native binding 是另一套件位置。                                                  |
| Playwright                    | 1.64.1；`@playwright/test`、`playwright`、`playwright-core` 各自 `LICENSE`／`NOTICE`                                          | 發行這些工具時保留實際 NOTICE；本機或 CI 執行不等於將瀏覽器 binary 打包進產品。                                    |
| Lightning CSS／Windows binary | 1.33.0；各套件 `LICENSE`；[官方固定版 MPL-2.0](https://raw.githubusercontent.com/parcel-bundler/lightningcss/v1.33.0/LICENSE) | 目前用於建置。若散布工具／binary，要一併處理適用的 covered source 與告知義務；不能把它當 MIT-only。                |
| esrecurse                     | 4.3.0；`node_modules/esrecurse/esrecurse.js` 開頭                                                                             | 根授權檔未偵測到，實際 JS 內含完整 BSD 聲明；清冊保存原始檔 hash。                                                 |
| imurmurhash                   | 0.1.4；`node_modules/imurmurhash/README.md` 末尾                                                                              | 根授權檔未偵測到，README 含完整 MIT；清冊保存原始檔 hash。                                                         |
| natural-compare               | 1.4.0；README copyright／MIT 連結                                                                                             | 已見歸屬及 license metadata，完整原文仍需發行前取回核對。                                                          |

另有 `@esbuild/win32-x64`、`@humanfs/types`、`@rolldown/binding-win32-x64-msvc` 未偵測到根 LICENSE／NOTICE。其 manifest 有 MIT／Apache-2.0／MIT，但這不免除發行時確認原文與 bundled 元件的工作。未安裝的其他平台 optional packages 只記 lockfile metadata，沒有虛構其本機檔案 hash。

## 發行邊界

此工程工作尚未散布 `node_modules`、瀏覽器、Steam Audio cache、第三方音效包或 HRTF 資料。正式產品 build 的各個輸入仍可能包含 `devDependencies` 中的程式；例如 Three、Rapier、AJV 由 `src` 匯入，應按實際 bundle 另核對。源碼的 package 分類不能代替發行物清單。

Reflection Lab 根 LICENSE 尚未由使用者選定。這次沒有代替使用者接受競賽／模型服務條款或決定對外授權，也沒有因第三方使用 MIT／Apache 就替專案套用相同 license。開發授權清冊、產品 API 服務權利與競賽合規是不同證據。
