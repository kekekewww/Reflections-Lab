# 雲端成本模型與容量邊界

狀態：**可重算情境估算，不是報價、帳單、實測容量或支出授權**。查核日2026-10-29，USD、未稅、無長約折扣。主線是[client-first架構候選](HYBRID_CLOUD_ARCHITECTURE.md)：本機互動不因100／1,000／10,000同時使用者而逐人配置雲端simulation。實際預設成本仍0，沒有開通服務、部署或新Meta API calls。

輸入：[cloud-cost-scenarios.json](cloud-cost-scenarios.json)；計算器：[cloud-cost-model.mjs](../../scripts/validation/cloud-cost-model.mjs)。由repo根執行：

```powershell
node scripts/validation/cloud-cost-model.mjs --self-test
node scripts/validation/cloud-cost-model.mjs --markdown
node scripts/validation/cloud-cost-model.mjs
```

預設輸出JSON含工作量、各費目、AI符號公式及capacityStatus。以`--input=path/to/scenarios.json`重算自訂情境；script只讀檔／stdout，**沒有network、provider SDK、provisioning或付費呼叫**。`--self-test`驗R2計費單位、job最少60秒及egress tiers，不能證明雲端供應商容量或真帳單。修改單價需同步來源／查核日，不把較新日期假裝成provider quote。

## 單位與費率來源

GB／MB採十進位；GCS及render RAM使用GiB（2^30 bytes）。CPU-ms是Workers實際CPU時間，不是AI網路等待；Cloud Run Jobs則以完整instance lifetime乘vCPU/RAM計費。下列免費額度在各自account/org/billing account共享，**不能每100個user、每project、每region或每scenario重複扣抵**。九列是九個互斥情境，不相加。

| 費目 | 查到的單價／最低費用 | 模型處理／官方來源 |
|---|---|---|
| Pages靜態 | 靜態請求免費，Functions計Workers | 不把音檔塞進25MiB static asset cap；build／產品條件另查。[Pricing](https://developers.cloudflare.com/pages/functions/pricing/)、[Limits](https://developers.cloudflare.com/pages/platform/limits/) |
| Workers Paid | $5/account/月；含10M requests、30M CPU-ms；超額$0.30/M requests、$0.02/M CPU-ms | 小用量仍有$5，CPU及request額度按account剩餘量。[Pricing](https://developers.cloudflare.com/workers/platform/pricing/) |
| R2 Standard | $0.015/GB-month；Class A $4.50/M、Class B $0.36/M；月含10GB-month、1M A、10M B；egress $0 | storage與operations依官方計費單位向上取整；storage以30日每日peak平均。Standard無最短留存，IA另有30日與retrieval，模型未採IA。[Pricing](https://developers.cloudflare.com/r2/pricing/) |
| Cloudflare Queues | 月含1M operations，超額$0.40/M；一個<64KB descriptor正常write/read/delete共3ops | 每64KB chunk、約100bytes metadata；retry read另計。須Workers Paid，$5不可漏；不是免費任意大訊息傳送。[Pricing](https://developers.cloudflare.com/queues/platform/pricing/) |
| Supabase | Pro $25/org/月；compute credit $10/org/月；Micro $0.01344/h、Large $0.1517/h、XL $0.2877/h | 一個project跑整月30×24=720h，不以30日月假稱730h固定。plan minimum＋max(compute-credit,0)。[Compute](https://supabase.com/docs/guides/platform/manage-your-usage/compute) |
| Supabase disk／egress／Auth | Pro含8GB disk，超額$0.125/GB；uncached egress含250GB、超$0.09/GB；Auth含100k MAU、超$0.00325/MAU | 此處只放metadata，PCM／trace不存DB；cached egress另有獨立quota/價，不拿來抵DB流量。[Pricing](https://supabase.com/pricing)、[Egress](https://supabase.com/docs/guides/platform/manage-your-usage/egress)、[MAU](https://supabase.com/docs/guides/platform/manage-your-usage/monthly-active-users) |
| Cloud Run Jobs us-central1 | $0.000018/vCPU-s、$0.000002/GiB-s；每instance最低60s，之後100ms進位；月free240k vCPU-s／450k GiB-s | free跨project共享且需合資格billing account；lifetime包含啟動，不只DSP kernel時間。每retry另計。[Pricing](https://cloud.google.com/run/pricing/) |
| GCS Standard us-central1 | $0.000027397/GiB-h；A $0.005/1k、B $0.0004/1k；合資格free5GiB-month／5k A／50k B | 只保存雲render結果，與Run同region；soft delete／versioning會額外占空間，模型未假設自動免費。[Pricing](https://cloud.google.com/storage/pricing/) |
| GCS Internet至台灣 | 前10TiB $0.12/GiB，10–150TiB $0.11，其後$0.08；合資格北美來源有100GiB free（排除澳洲／中國） | free不將高一級tier往下平移；download直接出GCS，不假設R2免費egress能抵消Google傳出費。[Pricing](https://cloud.google.com/storage/pricing/) |

`sharedAllowancesAreOtherwiseUnused=true`是**沒有其他專案耗用上述共享額度**的明示假設；若已被耗完，設false（同時不再重扣compute credit），或以真實剩餘額度更新rate inputs。這不是查過使用者帳單；實際小用量最低額為Workers $5＋Supabase Pro $25＝$30/月，Cloud Run/GCS是否有剩餘免費額度另查。

## Low／expected／high完整工作量假設

`N`為當日尖峰同時在線session數；`H`為每日營運時窗；`d`為時窗內平均在線／尖峰比例（session duty）。月occupied/active user hours `U=N×H×30×d`；每session平均時長`L`，`S=U/L`。這是情境定義，沒有把尖峰N維持整月，也沒有把N當MAU。每個occupied hour視為可儲存／AI／輸出的活躍時數；若大量idle需另降d或各功能rate。

| 參數（每列都在JSON可改） | low | expected | high |
|---|---:|---:|---:|
| H時窗h/day；d；L session h | 2；25%；0.5 | 8；50%；1 | 16；75%；2 |
| sessions/MAU（推算月不重複用戶） | 4 | 8 | 12 |
| AI requests/活躍user-minute | 0.02 | 0.1 | 0.5 |
| 每AI request input/output tokens | 2,000/500 | 4,000/1,000 | 8,000/2,000 |
| AI CPU-ms／wall s／memory GiB | 10／3／0.125 | 20／10／0.25 | 50／20／0.5 |
| 其他control API CPU-ms/req | 5 | 10 | 20 |
| save頻率 | 每10分鐘 | 每5分鐘 | 每1分鐘 |
| metadata bytes/save；保留save比例；留存days | 4,096；10%；7 | 4,096；10%；30 | 4,096；10%；90 |
| 新upload GB/user-hour | 0.005 | 0.05 | 0.25 |
| download GB/session；object MB | 0.02；8 | 0.1；16 | 0.5；32 |
| asset retention days | 7 | 30 | 90 |
| static download GB/session；requests/session | 0.005；20 | 0.008；40 | 0.012；60 |
| 雲render jobs/user-hour | 0.001 | 0.01 | 0.05 |
| 完整instance lifetime s/job | 60 | 120 | 600 |
| job vCPU／RAM GiB | 1／2 | 2／4 | 4／8 |
| input/output GB/job | 0.02/0.01 | 0.1/0.05 | 0.5/0.25 |
| output downloads/job；retention days | 1.2；7 | 1.2；30 | 1.2；30 |
| 全域render並行cap；重試attempt倍率 | 2；1.0 | 10；1.05 | 50；1.2 |
| DB egress bytes/session；bytes/save | 100,000；1,000 | 200,000；2,000 | 400,000；4,000 |

這些數字是估算輸入，非產品現有使用率／效能。metadata只假定保存10% checkpoint版本；其餘短期save覆寫／合併，這個壓縮政策尚未實作。所有upload視為新的unique bytes，未憑空假定dedup節省；retained storage採穩定狀態`每月新增×days/30`，high90日代表運作至少三個月的成熟archive，不是第一個月累積值。objects假定單part；render input按`ceil(input_GB×1000/object_MB)`個objects/attempt估GET，multipart/retry/range reads會增加ops。AI wall/RAM只輸出控制面等待需求；Workers不按等待秒數收CPU費，也不把其128MB/isolate當此RAM假設已符合。

DB compute配置刻意單列為可改**預算假設**：N100用Micro、N1000用Large、N10000用XL；**不是依此人數驗證過或建議保證的容量**。schema/index、query cost、burst、background maintenance與實際connection pool未測；不得把XL的connections直接對應10,000人。

## 重算公式

```text
U = N × H × days × d
S = U / L; MAU = ceil(S / sessions_per_MAU)
AI_requests = U × 60 × AI_rpm
AI_USD = (AI_requests × Tin / 1e6) × P_in
       + (AI_requests × Tout / 1e6) × P_out
saves = U × 60 / save_every_minutes
metadata_GB = saves × metadata_bytes × retained_fraction × retention_days / days / 1e9
asset_GB_month = U × upload_GB_per_hour × retention_days / days
render_input_reads = attempts × ceil(render_input_GB × 1000 / object_MB)
jobs = ceil(U × jobs_per_hour); attempts = ceil(jobs × retry_multiplier)
job_billable_seconds = max(60, ceil(lifetime_seconds × 10) / 10)
CPU_s = attempts × job_billable_seconds × vCPU
RAM_GiB_s = attempts × job_billable_seconds × RAM_GiB
Jobs_USD = max(CPU_s - remaining_free_CPU_s, 0) × CPU_rate
         + max(RAM_GiB_s - remaining_free_RAM_GiB_s, 0) × RAM_rate
R2_USD = ceil(max(asset_GB_month - remaining_free_GB_month, 0)) × storage_rate
       + ceil(max(A - remaining_free_A, 0) / 1e6) × A_rate
       + ceil(max(B - remaining_free_B, 0) / 1e6) × B_rate
queue_ops = jobs(write+successful_delete) + attempts(read)
worker_requests = AI_requests + saves + asset_objects + R2_reads
                + jobs × 5(submit/status/sign actions) + attempts(dispatch)
worker_CPU_ms = AI_requests × AI_CPU_ms + other_requests × control_CPU_ms
```

`P_in/P_out`是**每百萬token的供應商USD單價**，JSON預設null；此輪未查得足以套用目前帳號/model的Meta已驗價，因此不填數字、不把歷史live budget reserve冒充現價。上式每request token需包括system/tool schema/history；若一個產品turn有多次provider/tool loops，AI_requests應乘實際呼叫數與重試，不能只用一次UI按鈕計費。只在已核實provider/model/rate與帳號quota後才填值；未填時totalIncludingAiUsd為null。

## 九個月費情境結果

下表由上述命令實際算出，四捨五入到美分；**已定價小計不含AI及未建模費用**，不是總成本。Pages static項為0；queue仍在含額度內，故四捨五入為0。

| Peak | 情境 | 使用者小時 | AI requests | 雲端 jobs | Workers | R2 | DB/Auth | Jobs | GCS | Queue | 已定價小計 USD | AI token百萬 in/out |
|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 100 | low | 1500 | 1800 | 2 | 5.00 | 0.00 | 25.00 | 0.00 | 0.00 | 0.00 | 30.00 | 3.6/0.9 |
| 100 | expected | 12000 | 72000 | 120 | 5.00 | 8.85 | 25.00 | 0.00 | 0.01 | 0.00 | 38.86 | 288/72 |
| 100 | high | 36000 | 1080000 | 1800 | 6.59 | 404.85 | 25.00 | 108.83 | 56.52 | 0.00 | 601.78 | 8640/2160 |
| 1000 | low | 15000 | 18000 | 15 | 5.00 | 0.12 | 124.22 | 0.00 | 0.00 | 0.00 | 129.34 | 36/9 |
| 1000 | expected | 120000 | 720000 | 1200 | 5.20 | 89.85 | 124.22 | 1.43 | 1.00 | 0.00 | 221.71 | 2880/720 |
| 1000 | high | 360000 | 10800000 | 18000 | 34.82 | 4058.85 | 126.54 | 1135.26 | 674.15 | 0.00 | 6029.62 | 86400/21600 |
| 10000 | low | 150000 | 180000 | 150 | 5.00 | 2.48 | 222.14 | 0.00 | 0.00 | 0.00 | 229.62 | 360/90 |
| 10000 | expected | 1200000 | 7200000 | 12000 | 19.35 | 913.35 | 386.34 | 61.31 | 79.43 | 0.00 | 1459.77 | 28800/7200 |
| 10000 | high | 3600000 | 108000000 | 180000 | 335.58 | 40633.77 | 536.88 | 11399.58 | 6450.18 | 0.00 | 59355.99 | 864000/216000 |

例如N10,000 expected的AI另為`28,800×P_in + 7,200×P_out` USD；high為`864,000×P_in + 216,000×P_out`。不能引用$1,459.77說一萬人完整成本只需此數；未知AI可大幅主導費用。

N10,000的工作量可進一步查JSON結果：

| 指標 | low | expected | high |
|---|---:|---:|---:|
| saves/月 | 900,000 | 14,400,000 | 216,000,000 |
| upload／download GB/月 | 750／6,000 | 60,000／120,000 | 900,000／900,000 |
| retained assets GB-month | 175 | 60,000 | 2,700,000 |
| estimated MAU | 75,000 | 150,000 | 150,000 |
| metadata GB（不含index/WAL） | 0.086 | 5.898 | 265.421 |
| render vCPU-s／GiB-s | 9,000／18,000 | 3,024,000／6,048,000 | 518,400,000／1,036,800,000 |
| 全active時預期render並行（含retry） | 0.167 | 3.5 | 100 |
| 配置global cap | 2 | 10 | 50 |

high的全active需求100大於cap50，連平均duty下的典型需求75也大於50，營運時窗內便會積欠；模型仍估全部工作最終完成的費用，**不保證可在時窗內完成**，應排隊／拒絕並顯示等待，不自動加倍支出。每日平均duty下的典型並行亦可由JSON讀取；單execution parallelism、queue dispatch與global lease是不同限制。Cloud Run regional quota與Jobs Run API限制需同看，不能只依CPU單價聲稱容量。

## 替代平台與未計費項

Vercel Pro目前最低$20/月、一個deploying seat、$20usage credit。Fluid CPU公開starting at $0.128/h、provisioned memory $0.0106/GB-h、invocations $0.60/M，但region／product credits及2026-09 Flat Rate CDN tier都需按新方案核對；不把starting rate當台灣固定報價。替代式為`20 + extra_seats×20 + max(eligible_usage-credit,0) + noneligible/add-ons + chosen_CDN_tier`；本研究未取得足以重建所有Flat Rate tier的價目，故主表採Cloudflare而**不填虛構Vercel總價**，也不相加兩個hosting費。[Vercel pricing](https://vercel.com/pricing)、[Pro](https://vercel.com/docs/plans/pro-plan)、[CDN公告](https://vercel.com/blog/introducing-flat-rate-cdn)

替代queue：Cloud Tasks首1M operations/account/月免費，其後$0.40/M，32KB chunks，API／dispatch／retry各計；單queue500dispatch/s，HTTP handler最多30min，應啟動job後返回。Pub/Sub首10GiB/月free，其後$40/TiB，publish＋delivery bytes都計，每request最低1KB；適合多consumer event流，本案未列為必需。兩者都是**替代**而非和Queues三倍相加。[Tasks pricing](https://cloud.google.com/tasks/pricing)、[Tasks quotas](https://docs.cloud.google.com/tasks/docs/quotas)、[Pub/Sub pricing](https://cloud.google.com/pubsub/pricing)

替代render：Cloudflare Containers超額CPU $0.000020/vCPU-s、RAM $0.0000025/GiB-s、disk $0.00000007/GB-s，另Workers／Durable Objects／network。RAM/disk以provisioned計費；台灣/韓國/大洋洲egress超含額後$0.05/GB。不能套R2免費egress，也不能當普通Workers的128MB isolate。主表沒有同時算此替代方案。[Containers pricing](https://developers.cloudflare.com/containers/platform/pricing/)

主表未含logs／監控、build／Artifact Registry、dispatcher OAuth/bridge hosting、DB index/WAL/bloat與backup headroom、cross-region流量、email/SMS、稅／支援、付款／domain及惡意濫用。GCS結果soft-delete／version留存與R2 multipart額外ops也需部署設定後重算。price列有來源不代表任何使用者帳號已享免費額度或有quota；quota/capacity皆UNVERIFIED。render時長、AI tokens與使用率最敏感，先以限額／queue／保留期阻止失控，再用真usage和有授權的load test調整模型。
