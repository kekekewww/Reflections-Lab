# Hackathon 規則查核

> 現行重查見文末「2026-10-27 Sound Behavior 階段重查」。以下保留2026-10-26查核歷史；當時waiver日期不代表本次仍為同一版。

查核時間：2026-10-26 03:05（Asia/Taipei，UTC+08:00）；資料取自 2026-10-25 19:01–19:05 UTC 的官方公開頁。用途為研究與工程準備；未代替使用者申請、登入、接受條款、領取點數或提交作品。未檢查使用者的報名／入選狀態與個人資格。

## 正式來源與可讀性

| ID | 官方來源 | 本次取得的證據 |
|---|---|---|
| HC-01 | [Meta 活動頁](https://dev.meta.ai/events/global-hackathon) | 可讀：日期、主題、組別、申請限制；仍寫正式規則將於 10/26 開始前公布。 |
| HC-02 | [Cerebral Valley Event Waiver](https://cerebralvalley.ai/e/meta-ai-developer-hackathon/waiver) | 純文字擷取僅顯示 Loading；改以瀏覽器渲染成功讀全文，標題為 `Hackathon Terms & Conditions (“Official Rules”) and Event Waiver`，文件尾日期為 2026-10-13。以下以章節名稱定位，該頁未編條號。 |
| HC-03 | [共同主辦活動頁](https://cerebralvalley.ai/e/meta-ai-developer-hackathon) | 可讀；頁首標 EST，正文日期標 ET，存在時區標示落差。 |
| HC-04 | [官方提交入口](https://cerebralvalley.ai/e/meta-ai-developer-hackathon/hackathon/submit) | 只讀導覽後轉至登入頁；未登入，無法檢視完整提交欄位。 |

已優先查詢連接的 Devpost：精確活動名稱搜尋回 0 筆，官方 Meta URL 的 overview 查詢回 `Hackathon not found`。因此未套用其他 Devpost 比賽的規則。HC-02 自稱 Official Rules；不能因 HC-01 舊提示而稱「完全沒有規則」，也不能認定 HC-02 已涵蓋尚未公開的提交要求。開賽與提交前均需重新比對版本。

## 時程與時區

年份依官方頁明載的 2026。換算以美東地方時間（Windows `Eastern Standard Time`，含夏令時間）計算；台北換算是工程推導，並非主辦另行公布。10 月仍為 EDT（UTC−04）；11/4 為 EST（UTC−05），不可固定加 12 小時。

| 項目 | 官方原始日期／時間（HC-01） | 台北時間／狀態 |
|---|---|---|
| 申請開始 | 10/13 09:00 ET | 10/13 21:00 |
| 申請截止 | 10/25 23:59 ET，20,000 人額滿可提前 | **10/26 11:59**；HC-02 寫 EST，若字面解讀則 12:59，採較早的 ET 時間規劃；不保證尚有名額。 |
| 通知入選 | 10/26 09:00 ET 前 | 10/26 21:00 前 |
| 開賽 | 10/26，kickoff livestream | HC-01 未載精確時間；HC-03 頁首 12:00 EST 與 ET 標示落差未解，不作精確開發起算點。 |
| 工作坊 | 10/27–11/4 | 僅有日期範圍，逐場時間待確認。 |
| **作品提交** | **11/4 21:00 ET** | **11/5 10:00**（UTC 11/5 02:00）；建議內部凍結至少提前一天。 |
| 評審／閉幕 | 11/4–11/8；11/9 | 官方僅載日期，不能逕當成台北同一日程。 |

日期可由 Meta 修改。查核時為台北 10/26 凌晨，不能將申請與作品提交截止混為一談，也不能將「申請時間尚未到」等同「已入選」。

## 明確允許、禁止、附條件與未知

| 類別 | 已核內容與適用章節 | Reflection Lab 決策 |
|---|---|---|
| **明確允許** | HC-02 `Event Overview`：Indie Developer 接受個人、學生及最多 4 人團隊；另有 Startup track。虛擬參與，無須購買。 | 暫以 Indie／Push the Frontier 作適配建議，尚未替使用者選組。主題不是第三個參賽組別。 |
| **明確禁止** | HC-01／HC-02：虛假、重複、垃圾申請可取消資格；一名參與者與一件作品各限一組；不得侵害他人權利。`Code of Conduct` 禁止騷擾等行為。 | 保留真實作者、來源與成果；不替未入選者聲稱有參賽資格。 |
| **附條件：資格** | HC-02 `Age Restrictions and Eligibility Requirements`：至少 18 歲且達居住地成年年齡；每位有意參與者均須申請並獲接受。受法令／制裁限制者，以及指定關係人不得參加。 | 尚未驗證使用者年齡、身分、組織、所在地或入選證明。台北時區不等於資格證明。 |
| **附條件：地域／關係人** | HC-02 同章：排除白俄羅斯、中國、俄羅斯、烏克蘭、敘利亞，及列明的克里米亞／頓內茨克／盧甘斯克、古巴、北韓、伊朗與其他全面制裁地區；亦涵蓋制裁對象及代理者。Meta／Cerebral Valley 員工、承包商、實習生、政府相關人士及條文列明之家屬／同住者不可參加。 | 公開頁未排除台灣，但不能據此代替完整資格判斷。完整地域及親屬定義以原章節為準。 |
| **附條件：團隊** | HC-02 `Event Overview`：指定符合資格並獲授權的 Representative 代表團隊提交；Indie 須列全體隊員；Startup 代表須為在職員工並獲授權接收通知／獎金。 | 團隊規模與權利歸屬須另核；本階段不建立提交。 |
| **附條件：開源** | HC-02 `Hackathon Submission` 明文允許 open source software／hardware，但須遵循其授權，且作品須增強或建於該開源產品。 | Three.js／Rapier 等可依此條件評估；每個套件仍需個別授權盤點。這不回答賽前寫成的自有產品程式可否重用。 |
| **附條件：第三方協助** | HC-02 `Hackathon Submission` 可委託技術協助，但作品組件須維持參賽者自有工作與權利，並具原創及不侵權保證。 | 不能推成所有商業 SDK、音效、權重或 AI 產出均已被競賽准許。 |
| **附條件：Meta 工具** | HC-02 `Event Overview` 指參與者以 Meta AI 產品建置；HC-01 介紹 Muse Spark 系列、Muse Image、SAM 3.1、open weights 與 Muse Code。 | 產品應具可驗證的 Meta 模型用途；未見必須每個模型全用、最低呼叫量或唯一供應商條款。模型授權／API 使用條款須另查。 |
| **尚未確認** | 賽前研究／程式準備上限；既有自有程式可否重用；商業 SDK 的競賽准許範圍；第三方資料、音效、預訓練權重的特別限制。 | **依使用者 Phase B 指示，只做研究、文件、環境、SDK smoke test 與隔離可行性驗證；暫不大量實作正式功能。**這是本專案保守範圍，並非官方禁止研究的條款。 |
| **尚未確認** | Codex 等非 Meta coding agents 是否受限、AI 產出揭露格式、Muse Code 是否強制；未發現對 Codex 的明文允許或禁止。 | 如實保留本次 AI 協作來源，不把工具未被點名解讀為禁止或通行許可。 |
| **尚未確認** | 公開／私有 repository、指定 license、原始碼 ZIP、commit／diff 證明、部署平台、localhost 可否、登入帳號提供、影片長度／語言／可見性、完整表單必填欄位。 | HC-04 需登入才能讀表單；公開條文未載上述細項。不得引用其他競賽的 2／3 分鐘或必須公開 GitHub 等要求。 |

## 評審與展示

HC-02 `Hackathon Judging Criteria` 是作品評審，與申請審查不同：Impact **30%**、Use of Meta AI Tooling **25%**、Technical Depth & Execution **20%**、Demo **25%**。Demo 評估包含實際運作、現場穩定性與影片品質，但尚未取得影片的強制上傳欄位／時長規格。

Reflection Lab 可提出有依據的工程展示：Meta agent 生成受驗證的場景操作、求解器提供數據、可重現的 A/B 比較、明確近似限制；這是專案建議，不是官方附加條款。申請審查的「構想與技術能力各半」不可誤寫為作品計分方式。

## 智慧財產與公開資料

HC-02 `Hackathon Submission` 保留參賽者相對主辦方的作品所有權；同時，提交會授予主辦方、其子公司、代理與合作公司永久、不可撤回、全球、免權利金、非專屬的廣泛使用、改作與再利用權。`Release of Information` 對活動相關 Materials 亦有可轉讓、可再授權的永久廣泛授權，並明示不承諾保密。`Image, Video and Audio Recording Consent` 涵蓋姓名、肖像、聲音、聊天、螢幕分享及提交內容的長期利用。

因此保留所有權不表示提交仍為機密；來源合法也不必然表示有權授予活動要求的所有再利用權。公開 demo 不帶 API keys、個資、公司機密、未獲授權的第三方資料。第三方授權的實際範圍與活動保證有疑義時，先替換成原創／可清楚再利用的素材並記錄，不能聲稱已取得額外權利。

## 正式開發／提交前關卡

1. 重查 HC-01／HC-02 與入選者公告，保存新版本日期及變更摘要；確認賽前成果及其他 coding agents 的規定。
2. 由使用者處理本人的資格、入選及法律條款接受；本次未查帳戶、未代行。
3. 在獲授權的登入情境取得 HC-04 完整需求，核對 repo、部署、影片、隊員及收件證明。
4. 完成實際發行內容的第三方 notices／資料授權檢查，附開賽前後 provenance 差異；截止前留緩衝。

此文件不把未發現條款當成正式豁免；所有未知保留為待查項，不妨礙已授權的研究與隔離驗證。

## 2026-10-27 Sound Behavior 階段重查

查核：01:19台北，僅公開頁；未登入、接受條款、領credits或提交。已重讀 [Meta活動頁](https://dev.meta.ai/events/global-hackathon)、[CV公開活動頁](https://cerebralvalley.ai/e/meta-ai-developer-hackathon)及完整 [Official Rules／waiver](https://cerebralvalley.ai/e/meta-ai-developer-hackathon/waiver)。waiver頁尾現在為 **2026-10-25**；舊摘要記10/13，沒有原始舊全文不能建立完整redline。Meta頁仍有未來式規則公告，不能因此否認已可讀的waiver。

| 問題 | 本次可確認的分類 |
| --- | --- |
| Codex或其他coding agents | **UNSTATED**：已讀公開全文未見明文允許或禁止；第三方技術協助／OSS為附條件許可，不能外推成所有AI協作的豁免。Muse Code被介紹，不等於強制或唯一可用。 |
| Meta模型用途 | **CONDITIONAL**：公開條文要求以Meta AI產品建置；活動介紹API與Meta open weights。未見API獨占、必用Muse Code、最低呼叫數或固定部署方式。不能把使用coding agent自行當成產品整合證明。 |
| 整合深度 | **JUDGING CRITERION**：Meta tooling佔25%，評估創意及超越基本整合；沒有公開的數量化最低門檻。 |
| 提交證據 | 公開評分涉及可運作demo、live穩定性與影片品質；repo、API logs、部署、影片規格及收件欄位 **UNKNOWN**。本次 [details](https://cerebralvalley.ai/e/meta-ai-developer-hackathon/details) 與 [submit](https://cerebralvalley.ai/e/meta-ai-developer-hackathon/hackathon/submit) 均實際導向登入頁，未讀到其內容。 |

作品截止未見改期，仍為11/4 21:00 ET＝11/5 10:00台北。CV的Event Closed標籤不能判定使用者入選與否；資格、賽前程式界線、登入後公告與credit terms仍待核實。公開重查不足以宣告競賽完整合規。

本專案以Codex開發、產品內以Meta Model API提供Muse Agent，是使用者最新工程決策，不是主辦方已簽發的coding-agent豁免。可重現模型／tool trace與runtime成果的[證據包建議](../08-ai/MUSE_SOUND_BEHAVIOR_INTEGRATION.md)屬工程方法，非已確認必繳附件。來源日期、rendered-text fingerprints及限制見 [本次metadata](../../research/sound-behaviors/ai-rules-sources.json)；fingerprint不等於原始HTTP bytes hash或法律版本保證。
