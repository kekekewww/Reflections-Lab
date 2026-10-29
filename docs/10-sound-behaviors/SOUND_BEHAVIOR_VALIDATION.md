# Sound Behavior 驗證矩陣與下一階段關卡

2026-10-27。本階段完成 **V0 schema／domain fixtures 與隔離物理研究**；沒有正式 Behavior evaluator、Audio Event Runtime、Web Audio graph、browser UI 或 Meta live loop。驗證腳本不是產品功能。

## 已執行的契約驗證

```powershell
node --test tests/sound-behaviors/contracts.test.mjs
node scripts/validation/sound-behavior.mjs
node node_modules/typescript/bin/tsc --noEmit --strict --noUncheckedIndexedAccess --exactOptionalPropertyTypes --target ES2022 --module NodeNext --moduleResolution NodeNext --skipLibCheck schemas/sound-behavior/types.ts
```

原始 RED 為缺少 validator module；先前11案例通過後，新增 latch／identity／host budget／A/B coupling 的5個回歸先重現失敗。獨立審查又重現 effective-enabled、finite one-shot／expired latch、catalog pin workflow與collider identity缺口，新增4個回歸；另重現 material-pair generator 可繞過 oscillator stop 的相同缺陷，將檢查放入共用 selected-generator gate，新增1個回歸，未刪原驗收。結果 **21/21 PASS、5組 CLI draft fixtures PASS、strict TS noEmit PASS**。這些數量是本地契約檢查，不能加總成物理、音訊或模型成功率。Root 完整 gate／原始輸出另由本階段報告保存。

| 測試面 | 已機械核對 | 狀態／界線 |
| --- | --- | --- |
| 資料形狀 | 版本、required／unknown fields、continuous/discrete discriminator、array／numeric bounds、無 graph／JS payload | PASS，不能證明 host 執行 |
| 資產引用 | host registry ID/revision/hash、availability／rights、trusted derived pins、FIXTURE_ONLY不可產品使用 | PASS，未解碼或播放音效 |
| Shared profiles | 多物件共用、object generation、binding override、stale profile revision、重複ID／unknown rules | PASS，未有Inspector／Apply |
| Mapping | context metric、curve endpoints／strict x、clamp、input/output ranges、duplicate target／NaN／Infinity | PASS，未產生音訊 automation |
| Contact emitter | contact source、事件位置與representative point相符、unit normal、impulse／velocity nullable provenance、known object/collider participants | PASS，未驗真實播放位置／HRTF |
| Runtime snapshot | logical epoch／tick、document/profile refs、voice cap、effective-enabled／active rules／cooldown、duplicate events／instances、finite one-shot／latch deadline | PASS，只驗 checkpoint 形狀與一致性；沒有推進 runtime |
| AI proposal | scene/document/profile revision、typed full replacement、host32op上限、clone validation、stranded refs、禁止physics改動 | PASS，Meta API／transaction executor NOT RUN |
| A/B | acoustic固定source；behavior允許宣告生成變量、固定physics/motion/inputtrace/propagation | PASS，實際錄放／分析 NOT RUN |

[asset descriptor](../../schemas/sound-behavior/examples/asset-descriptor.json) 不是 WAV 或錄音。測試的 FIXTURE_ONLY registry 是明示的合成資料；product gate 會拒絕它，不可把這組資料說成真正可播放資產或真實 Meta 回應。

## 正式事件／行為 Runtime 的必過條件

以下全為 **NOT RUN／Implementation Pending**；不可因上表 PASS 自動勾選。

| 類別 | 獨立 fixture／觀察 | 驗收 |
| --- | --- | --- |
| 單次撞擊與支撐 | 固定seed、球落地後保持接觸；raw manifold／force／J與accepted emissions分開保存 | 合格onset只一次；持續支撐不每tick重播。低速被抑制須有reason，不消除raw碰撞 |
| 多 contact／CCD | compound collider、多面牆、高速球、同tick多manifold，獨立幾何位置參考 | patch／episode dedup不跨表面誤併；沒有substep資料就保留UNKNOWN與限制 |
| OnThrow／OnDrop | accepted player command trace與無command自由落下成對案例 | Throw僅由明確互動命令，freefall不造Throw；事件ID重送冪等 |
| Rolling／Sliding | sphere no-slip、純滑動、原地旋轉、移動平台、無支撐與UNKNOWN contact | 線／角／point velocity和support模型可區分；不從平面平移猜rolling |
| Continuous／layers | AlwaysOn＋WhileHeld／Airborne＋impact同時，固定voicebudget | persistent logical instance不因pose/mapping更新重建；one-shot不打斷loop |
| Cooldown／hysteresis | 門檻兩側jitter、重播重送、不同profile共享物件 | tick-based狀態可重現；冷卻與reset政策不跨epoch洩漏 |
| P1 latch | OnThrow→bounce／impact→下一次throw、same-tick不同sequence、timeout、pause／reset | 精確start/stop，重送不重建；airborne gated與latched不可混用 |
| Disable／mode／delete | dynamic/fixed/kinematic/gravity0、held撞牆、teleport、移除 | 不造幽靈impact；合理fade，資料與聲音drop各記reason |

固定 golden traces 不由受測 classifier 自己產生 expected；Rapier API 取值的隔離結果參照 [Physics Bridge](PHYSICS_AUDIO_BRIDGE.md) 的原始 artifact。Threshold／cooldown／support角度為 Tuned 設定，不是普遍物理常數。

## 正式 Audio／Spatial 驗收

先建立 Audio Event Runtime／clock bridge／voice registry，再接 behavior evaluator。以預先寫好的 impulses、解析 `d/c` 與固定 generator 波形作獨立答案；不用待驗函式同時算 expected 與 actual。

- **Click／pop與參數連續性：NOT RUN。** OfflineAudioContext 量測 envelope／gain／pitch／delay跨frame的邊界，保存sample rate、block size、波形與峰值差；測試門檻要基於訊號與裝置，不自行宣告「聽不見」。耳機聽測另列人、裝置、音量與條件。
- **音量與定位：NOT RUN。** 相同emission送direct/early/late，距離gain／delay只計一次。contact one-shot在已知世界接觸位置；object-following聲源平滑更新。沿用 [Audio Runtime](../02-architecture/AUDIO_RUNTIME.md) HRTF／IR capability，確認沒有重複Panner attenuation或HRTF。
- **聲學繞路：NOT RUN。** Creative sample／oscillator均只產生emission，不因presetKind繞過Custom Acoustic Core。用instrumentation核對每個positioned emission及solver request/frame ID；dry audition明示獨立bus／epoch且不進實驗。
- **預算／重疊：NOT RUN。** voice allocation／stolen／drop記錄可回放，fade不硬切；AudioBufferSourceNode為單次播放node，不能「pool後重新start」已用節點。可重用decoded buffers與可持續的Gain／Panner／Worklet處理資源；實際策略依renderer驗證。
- **Callback安全：NOT RUN。** 實際block size、無阻塞／無界allocation／geometry／AI／network；main/worker/control變更不在audio callback求解。

物理60Hz目標、聲學更新頻率、audio sample clock各自紀錄；新增behavior eval更新率／batch大小是待profile的初值。容量與延遲依 [PERFORMANCE_BUDGET](../06-validation/PERFORMANCE_BUDGET.md) 與指定裝置實測，不能把schema上限當吞吐量。

## 錄製、A/B與AI

Record保存scene／physics input trace、profile／bindings／assets／generator版本及hash、event/voice decisions、seed、solver／listener／clock policy；Pause／Resume與late-event政策明示。重播可以重用已記錄AudioEvent，不能再由physics重複觸發一次。

Acoustic A/B保留相同source signal；Behavior A/B可改宣告的asset／gain／pitch／profile，固定同一physics/player inputs與傳播條件。Output metric只來自數值／audio artifact，hash檢查僅驗metadata，真實run producer與分析仍 **NOT RUN**。更新後正式規範看 [Experiment docs](../07-experiments/) 與本草案 comparison 型別。

Meta工具測試需用合法／invalid trigger、未知asset、stale revision、provider失敗、domain拒絕、Preview／Apply／Undo等案例。手動authoring不依賴API；AI不能生成量測數字或自造assetID。當前Meta live、嚴格provider schema轉換、產品Apply／Undo、UI事件編輯與測量 **NOT RUN**；fixture與模型來源明示分開。

## 最小下一切片

正式產品的下一步仍遵循 [NEXT_ENGINEERING_TASK](../NEXT_ENGINEERING_TASK.md) 的Scene／固定步前置；Sound Behavior先切出無聲音裝置依賴的 Audio Event Runtime：固定 logical clocks、dedup、instance/voice IDs、bounded queues、epoch reset與golden trace。該切片通過後才做有聲的 Web Audio／Acoustic Core smoke，再接 Inspector P0與手動rules。P1 latch、rolling/sliding、AI提案需能力與驗收就緒後解鎖；node graph／modal synthesis維持P2。
