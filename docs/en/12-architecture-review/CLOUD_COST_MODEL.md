<!-- english-source: {"path":"docs/12-architecture-review/CLOUD_COST_MODEL.md","sha256":"f0e33962013575b5071932d434638ab5fe269a9a1899344921a34b7afae6ca5d","translated_at":"2026-10-29T05:28:21.507Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/12-architecture-review/CLOUD_COST_MODEL.md`](../../12-architecture-review/CLOUD_COST_MODEL.md). Source SHA-256: `f0e33962013575b5071932d434638ab5fe269a9a1899344921a34b7afae6ca5d`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="雲端成本模型與容量邊界"></a>
# Cloud Cost Model and Capacity Boundaries

Status: **Recalculable scenario estimates, not a quotation, bill, measured capacity, or spending authorization**. Checked on 2026-10-29; USD, before tax, with no long-term commitment discounts. The primary path is the [client-first architecture candidate](HYBRID_CLOUD_ARCHITECTURE.md): local interaction does not allocate a cloud simulation per user when there are 100 / 1,000 / 10,000 concurrent users. The actual default spending remains 0. No services were activated, no deployment was made, and no new Meta API calls were made.

Inputs: [cloud-cost-scenarios.json](../../12-architecture-review/cloud-cost-scenarios.json); calculator: [cloud-cost-model.mjs](../../../scripts/validation/cloud-cost-model.mjs). Run from the repository root:

```powershell
node scripts/validation/cloud-cost-model.mjs --self-test
node scripts/validation/cloud-cost-model.mjs --markdown
node scripts/validation/cloud-cost-model.mjs
```

The default JSON output includes workloads, each cost item, symbolic AI formulas, and capacityStatus. Use `--input=path/to/scenarios.json` to recalculate custom scenarios. The script only reads files and writes to stdout; it has **no network access, provider SDK, provisioning, or paid calls**. `--self-test` checks R2 billing units, the 60-second job minimum, and egress tiers. It cannot establish cloud provider capacity or an actual bill. Changes to unit prices must update their sources and verification date; a newer date must not be presented as a provider quotation.

<!-- english-original-anchor --> <a id="單位與費率來源"></a>
## Units and Rate Sources

GB and MB use decimal units; GCS and render RAM use GiB (2^30 bytes). CPU-ms means actual Workers CPU time, excluding AI network waits. Cloud Run Jobs instead bills the full instance lifetime multiplied by vCPU and RAM. The free allowances below are shared within their respective account, organization, or billing account. **They cannot be deducted repeatedly for every 100 users, project, region, or scenario**. The nine rows are nine mutually exclusive scenarios and are not added together.

| Cost item | Published unit price / minimum charge found | Model treatment / official source |
|---|---|---|
| Pages static | Static requests are free; Functions are billed as Workers | Do not put audio files into the 25MiB static asset cap; build and product conditions require separate verification. [Pricing](https://developers.cloudflare.com/pages/functions/pricing/), [Limits](https://developers.cloudflare.com/pages/platform/limits/) |
| Workers Paid | $5/account/month; includes 10M requests and 30M CPU-ms; overages $0.30/M requests and $0.02/M CPU-ms | Small workloads still incur $5; CPU and request allowances use the account's remaining balance. [Pricing](https://developers.cloudflare.com/workers/platform/pricing/) |
| R2 Standard | $0.015/GB-month; Class A $4.50/M, Class B $0.36/M; monthly allowance of 10GB-month, 1M A, and 10M B; egress $0 | Storage and operations round up to official billing units; storage averages daily peaks over 30 days. Standard has no minimum retention. IA has a separate 30-day minimum and retrieval charges; the model does not use IA. [Pricing](https://developers.cloudflare.com/r2/pricing/) |
| Cloudflare Queues | Monthly allowance of 1M operations, then $0.40/M; a normal descriptor under 64KB incurs 3 operations: write/read/delete | Charged per 64KB chunk, with approximately 100 bytes of metadata; retry reads are additional. Requires Workers Paid, so the $5 minimum must be included. This is not free transport for arbitrarily large messages. [Pricing](https://developers.cloudflare.com/queues/platform/pricing/) |
| Supabase | Pro $25/organization/month; compute credit $10/organization/month; Micro $0.01344/h, Large $0.1517/h, XL $0.2877/h | One project runs for an entire 30 × 24 = 720h month; a 30-day month is not described as a fixed 730h. Plan minimum + max(compute − credit, 0). [Compute](https://supabase.com/docs/guides/platform/manage-your-usage/compute) |
| Supabase disk / egress / Auth | Pro includes 8GB disk, then $0.125/GB; uncached egress includes 250GB, then $0.09/GB; Auth includes 100k MAU, then $0.00325/MAU | Only metadata is stored here; PCM and traces are not stored in the database. Cached egress has a separate quota and price and does not offset database traffic. [Pricing](https://supabase.com/pricing), [Egress](https://supabase.com/docs/guides/platform/manage-your-usage/egress), [MAU](https://supabase.com/docs/guides/platform/manage-your-usage/monthly-active-users) |
| Cloud Run Jobs us-central1 | $0.000018/vCPU-s and $0.000002/GiB-s; 60s minimum per instance, then rounded up in 100ms increments; monthly free allowance of 240k vCPU-s / 450k GiB-s | Free usage is shared across projects and requires an eligible billing account. Lifetime includes startup, not just DSP kernel time. Each retry is billed separately. [Pricing](https://cloud.google.com/run/pricing/) |
| GCS Standard us-central1 | $0.000027397/GiB-h; A $0.005/1k, B $0.0004/1k; eligible free allowance of 5GiB-month / 5k A / 50k B | Stores cloud render outputs only, in the same region as Run. Soft delete and versioning occupy additional space; the model does not assume they are automatically free. [Pricing](https://cloud.google.com/storage/pricing/) |
| GCS Internet transfer to Taiwan | First 10TiB $0.12/GiB, 10–150TiB $0.11, then $0.08; eligible North American sources have 100GiB free, excluding Australia / China | The free allowance does not shift higher tiers downward. Downloads leave GCS directly; the model does not assume R2's free egress offsets Google's outbound charges. [Pricing](https://cloud.google.com/storage/pricing/) |

`sharedAllowancesAreOtherwiseUnused=true` explicitly assumes **no other projects consume the shared allowances above**. If they are exhausted, set it to false, which also stops deducting the compute credit again, or update rate inputs with actual remaining allowances. This is not a check of the user's billing account. The actual minimum for small workloads is Workers $5 + Supabase Pro $25 = $30/month; remaining Cloud Run / GCS free allowances must be checked separately.

<!-- english-original-anchor --> <a id="lowexpectedhigh完整工作量假設"></a>
## Complete Low / Expected / High Workload Assumptions

`N` is the daily peak number of concurrent online sessions; `H` is the daily operating window; `d` is the average-online-to-peak ratio within that window (session duty). Monthly occupied / active user hours are `U=N×H×30×d`; with average session duration `L`, `S=U/L`. This scenario definition neither maintains peak N for the entire month nor treats N as MAU. Every occupied hour is considered active time eligible for saving, AI, and output. If there is substantial idle time, lower d or the individual feature rates.

| Parameter (each value is editable in JSON) | low | expected | high |
|---|---:|---:|---:|
| H window h/day; d; L session h | 2; 25%; 0.5 | 8; 50%; 1 | 16; 75%; 2 |
| sessions/MAU (estimated monthly unique users) | 4 | 8 | 12 |
| AI requests/active user-minute | 0.02 | 0.1 | 0.5 |
| Input/output tokens per AI request | 2,000/500 | 4,000/1,000 | 8,000/2,000 |
| AI CPU-ms / wall s / memory GiB | 10 / 3 / 0.125 | 20 / 10 / 0.25 | 50 / 20 / 0.5 |
| Other control API CPU-ms/request | 5 | 10 | 20 |
| Save frequency | Every 10 minutes | Every 5 minutes | Every minute |
| Metadata bytes/save; retained save fraction; retention days | 4,096; 10%; 7 | 4,096; 10%; 30 | 4,096; 10%; 90 |
| New upload GB/user-hour | 0.005 | 0.05 | 0.25 |
| Download GB/session; object MB | 0.02; 8 | 0.1; 16 | 0.5; 32 |
| Asset retention days | 7 | 30 | 90 |
| Static download GB/session; requests/session | 0.005; 20 | 0.008; 40 | 0.012; 60 |
| Cloud render jobs/user-hour | 0.001 | 0.01 | 0.05 |
| Full instance lifetime s/job | 60 | 120 | 600 |
| Job vCPU / RAM GiB | 1 / 2 | 2 / 4 | 4 / 8 |
| Input/output GB/job | 0.02/0.01 | 0.1/0.05 | 0.5/0.25 |
| Output downloads/job; retention days | 1.2; 7 | 1.2; 30 | 1.2; 30 |
| Global render concurrency cap; retry attempt multiplier | 2; 1.0 | 10; 1.05 | 50; 1.2 |
| DB egress bytes/session; bytes/save | 100,000; 1,000 | 200,000; 2,000 | 400,000; 4,000 |

These numbers are estimation inputs, not the product's existing usage or performance. Metadata assumes only 10% of checkpoint versions are retained; other short-term saves are overwritten or merged. This compaction policy has not been implemented. All uploads are treated as new unique bytes, without invented deduplication savings. Retained storage uses the steady-state formula `monthly new bytes × days/30`; high's 90 days represents a mature archive after at least three months of operation, not the first month's accumulation. Objects are assumed to use a single part; multipart uploads, retries, and range reads increase operations. AI wall time and RAM only describe control-plane waiting requirements. Workers does not bill waiting seconds as CPU time, and its 128MB/isolate limit is not assumed to satisfy these RAM inputs. Render input GETs are estimated as `ceil(input_GB × 1000 / object_MB)` objects per attempt.

Database compute configurations are explicitly separate, editable **budget assumptions**: Micro for N=100, Large for N=1,000, and XL for N=10,000. **They are neither verified capacities for those user counts nor recommendations that guarantee them**. Schema/indexes, query cost, bursts, background maintenance, and the actual connection pool have not been tested. XL's connections must not be mapped directly to 10,000 people.

<!-- english-original-anchor --> <a id="重算公式"></a>
## Recalculation Formulas

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

`P_in/P_out` are the **provider's USD prices per million tokens**; their JSON defaults are null. This review did not establish verified Meta prices applicable to the current account and model, so no numeric prices are inserted and historical live budget reservations are not presented as current prices. Tokens per request in the formula must include the system prompt, tool schemas, and history. If a product turn has multiple provider/tool loops, AI_requests must include the actual call count and retries; a single UI button press must not be charged as exactly one call. Fill these values only after verifying the provider, model, rates, and account quota. Until then, totalIncludingAiUsd is null.

<!-- english-original-anchor --> <a id="九個月費情境結果"></a>
## Nine Monthly Cost Scenario Results

The table below was calculated by running the commands above and rounds to cents. **The priced subtotal excludes AI and unmodeled expenses**, so it is not the total cost. Pages static is 0; the queue remains within its included allowance, so it rounds to 0.

| Peak | Scenario | User hours | AI requests | Cloud jobs | Workers | R2 | DB/Auth | Jobs | GCS | Queue | Priced subtotal USD | AI million tokens in/out |
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

For example, AI for N=10,000 expected adds `28,800×P_in + 7,200×P_out` USD; high adds `864,000×P_in + 216,000×P_out`. The $1,459.77 subtotal cannot be cited as the full cost of serving ten thousand people. Unknown AI costs may dominate expenses substantially.

The JSON results provide further workload details for N=10,000:

| Metric | low | expected | high |
|---|---:|---:|---:|
| Saves/month | 900,000 | 14,400,000 | 216,000,000 |
| Upload / download GB/month | 750 / 6,000 | 60,000 / 120,000 | 900,000 / 900,000 |
| Retained assets GB-month | 175 | 60,000 | 2,700,000 |
| Estimated MAU | 75,000 | 150,000 | 150,000 |
| Metadata GB, excluding indexes/WAL | 0.086 | 5.898 | 265.421 |
| Render vCPU-s / GiB-s | 9,000 / 18,000 | 3,024,000 / 6,048,000 | 518,400,000 / 1,036,800,000 |
| Expected render concurrency when fully active, including retries | 0.167 | 3.5 | 100 |
| Configured global cap | 2 | 10 | 50 |

High's demand of 100 exceeds the cap of 50, so sustained peaks create a backlog. The model still estimates the cost of eventually completing all work; **it does not guarantee completion within the operating window**. Queue or reject requests and display waiting time; do not automatically double spending. Typical concurrency under average daily duty can also be read from JSON. Per-execution parallelism, queue dispatch, and global leases are different limits. Cloud Run regional quotas and the Jobs Run API limit must be considered together; CPU unit prices alone do not establish capacity. Typical demand under average duty is also 75 concurrent renders, exceeding the cap of 50; backlog therefore accumulates during the average operating window too.

<!-- english-original-anchor --> <a id="替代平台與未計費項"></a>
## Alternative Platforms and Unmodeled Expenses

Vercel Pro currently has a $20/month minimum, one deploying seat, and a $20 usage credit. Published Fluid CPU pricing starts at $0.128/h, provisioned memory at $0.0106/GB-h, and invocations at $0.60/M. Regions, product credits, and the September 2026 Flat Rate CDN tiers all require verification against the new plan. A starting rate is not a fixed Taiwan quotation. The alternative formula is `20 + extra_seats×20 + max(eligible_usage-credit,0) + noneligible/add-ons + chosen_CDN_tier`. This review did not obtain pricing sufficient to reconstruct every Flat Rate tier, so the main table uses Cloudflare and **does not invent a Vercel total**. The two hosting charges are not added together. [Vercel pricing](https://vercel.com/pricing), [Pro](https://vercel.com/docs/plans/pro-plan), [CDN announcement](https://vercel.com/blog/introducing-flat-rate-cdn)

Alternative queues: Cloud Tasks includes the first 1M operations/account/month free, then $0.40/M, with 32KB chunks. API, dispatch, and retry operations are charged individually. A single queue permits 500 dispatches/s; an HTTP handler runs for up to 30 minutes and should return after starting the job. Pub/Sub includes the first 10GiB/month free, then $40/TiB. Both publish and delivery bytes count, with a 1KB minimum per request. It suits event streams with multiple consumers and is not required in this proposal. Both are **alternatives**, not three queue services whose costs should be added together. [Tasks pricing](https://cloud.google.com/tasks/pricing), [Tasks quotas](https://docs.cloud.google.com/tasks/docs/quotas), [Pub/Sub pricing](https://cloud.google.com/pubsub/pricing)

Alternative rendering: Cloudflare Containers overage prices are CPU $0.000020/vCPU-s, RAM $0.0000025/GiB-s, and disk $0.00000007/GB-s, plus Workers, Durable Objects, and network charges. RAM and disk are billed on provisioned resources. Taiwan / Korea / Oceania egress costs $0.05/GB after the included allowance. R2's free egress does not apply, and this is not an ordinary Workers 128MB isolate. The main table does not also charge for this alternative. [Containers pricing](https://developers.cloudflare.com/containers/platform/pricing/)

The main table excludes logs and monitoring, builds and Artifact Registry, dispatcher OAuth / bridge hosting, DB indexes/WAL/bloat and backup headroom, cross-region traffic, email/SMS, tax and support, payments/domains, and malicious abuse. GCS result retention through soft delete / versions and additional R2 multipart operations must also be recalculated after deployment settings are defined. A sourced price does not establish that any user account receives free allowances or has quota. Quota and capacity remain UNVERIFIED. Render duration, AI tokens, and usage rates are the most sensitive inputs. First use limits, queues, and retention periods to prevent uncontrolled growth, then revise the model using actual usage and authorized load tests.
