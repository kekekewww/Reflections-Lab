# 物理事件、振動與碰撞聲音

查核日：2026-10-26。這是 Reflection Lab 的模型契約與待驗證工程推導，尚無正式產品實作。SI 單位：m、s、kg、N、N·s、rad。下列牛頓模型限於一般低速剛體；精確 engine 行為仍須依固定版本 API 與實驗核實。文獻識別碼見 [COLLISION_WAVE_NOTES.md](../papers/COLLISION_WAVE_NOTES.md)。

## 1. 狀態與接觸幾何

每個剛體記錄質心位置 `x`、姿態 `q`、線速度 `v`、角速度 `ω`、質量 `m`、世界座標慣性張量 `I_world`。在世界接觸點 `p`，剛體表面速度為：

```text
r_A = p − x_A
v_A_contact = v_A + ω_A × r_A
v_rel = v_B_contact − v_A_contact
v_n = dot(v_rel, n)
v_t = v_rel − v_n n
```

本檔固定 `n` 從 A 指向 B；`v_n < 0` 表示接近。這是由剛體運動學推得的契約，不能與 engine 的法向／pair order 混用。`contactPointVelocity` 不能只用兩物件質心速度相減；旋轉中的物體可能有零質心速度及非零撞擊速度。

## 2. Force、Impulse 與 Restitution

衝量為時間積分，單位與 force 不同：

```text
J = ∫ F(t) dt = Δp                    [N·s = kg·m/s]
F_average = J / Δt                   [N]
e = −v_n_after / v_n_before          [dimensionless; central impact]
```

衝量定義與動量定理依 [OpenStax University Physics §9.2](https://openstax.org/books/university-physics-volume-1/pages/9-2-impulse-and-collisions)；恢復係數依 [Jönköping University Applied Mechanics §7.5](https://mechanics.ju.se/Kinetics/ImpulseMomentum.html)。兩者是教材完整網頁，非 Reflection Lab 的實測資料。

對無摩擦、單一瞬時接觸，將動量更新和恢復係數聯立，可推得：

```text
invEffectiveMass = 1/m_A + 1/m_B
  + dot(n, cross(I_A⁻¹ cross(r_A,n), r_A))
  + dot(n, cross(I_B⁻¹ cross(r_B,n), r_B))
j_n = −(1+e) v_n_before / invEffectiveMass
```

條件是 `v_n_before < 0`、接觸法向單位長度、質量／慣性均合法。固定 body 在動力學求解中以零 inverse mass／inertia 處理；這不表示材質沒有聲學振動或不會發聲。多點接觸、堆疊、摩擦、穿透修正與迭代求解會使單點式不足以重現實際引擎衝量；不要用它覆寫 engine 的結果。

可再推得一維相對法向動能損失：

```text
m_eff = 1 / invEffectiveMass
ΔE_normal = 0.5 m_eff (1−e²) v_n_before²
```

此式只有指定接觸模型中的能量意義；`ΔE_normal` 會分配到形變、熱、聲音及其他通道，**不等於聲能**。`e=1` 在理想剛體模型仍可能觸發敲擊音效；若要物理上閉合聲能預算，必須使用另外校準的振動／輻射模型。模型常用 `0≤e≤1` 表達被動碰撞；不要把恢復係數設成 sound gain。

## 3. 重力與 body mode

```text
dv/dt = g_scale g_world + F_other/m
dx/dt = v
```

`NoGravityDynamic` 應定義為 dynamic body 的 `g_scale=0`；在無其他外力、無 damping、無接觸的解析條件下，`v(t)=v0`、`x(t)=x0+v0 t`。它仍能受到衝量、扭矩與碰撞。`Fixed` 是積分狀態不因力而移動；`Kinematic` 由外部軌跡控制。三者不能用同一個「停止更新 transform」實作。這些為本專案的模型要求，API 細節與 engine 測試記錄是另一層證據。

自由飛行／無重力／固定物體的連續音訊生命週期獨立於 body mode；位置與速度更新不能自動停止 source。Impact sound 在接觸世界座標建立自己的聲源事件。

## 4. 摩擦、刮擦與滾動

Coulomb 簡化的切向約束為 `|F_t|≤μ F_n`；滑動時 `F_t` 反向於 `v_t`。摩擦耗散功率可寫為 `P_friction = max(0, −dot(F_t,v_t))`。若只有每步法向衝量，`j_n/Δt` 是平均力估計，不能還原真實接觸力波形。接觸點跳動與 constraint stabilization 也可能污染此估計。

CW01 將表面粗糙度與相對運動轉成高取樣率激發；因此 `speed`、`normalLoad`、`roughness`、`contactLocation` 都是候選控制量。將 gain 與 `sqrt(P_friction)` 關聯是有條件的物理啟發，不是通用量測校準。`pure rolling` 可有接觸點相對速度接近零，但物體仍在粗糙面上發聲；不能以 `|v_t|≈0` 推論完全靜音。滾動與刮擦需要分開的狀態／表面運動估計，未建模者標 `Estimated`。

## 5. Sample-based 與 Modal Synthesis

`SampleBasedImpact` 的可維護 P0 契約：材質配對與形狀類別選樣本；以 pre-impact `v_n`、`j_n` 或估計能量控制單調、有限且有上限的 gain；事件包含接觸點及 source motion。Gain curve、pitch variation、樣本 random seed 是 `PerceptuallyTunedPreset`，不冒稱 material measurement。需記錄樣本來源、授權與版本。

`ModalSynthesis` 的基本小振幅模型為：

```text
M u¨ + C u˙ + K u = f(t)
K φ_k = ω_k² M φ_k
u = Σ φ_k q_k
q¨_k + 2 ζ_k ω_k q˙_k + ω_k² q_k = φ_kᵀ f(t)  [mass-normalized modes]
```

第一式為標準線性振動模型；此處獨立模態 ODE 另假設 classical／diagonal modal damping，任意非比例阻尼不一定能解耦。模態分解與實際接觸聲音用途由 CW01/CW03 支持。衝擊位置影響 `φ_kᵀ f`；材料、幾何、邊界、接觸阻尼影響頻率和衰減。對欠阻尼模態，impulse response 含 `exp(−ζ_k ω_k t) sin(ω_d,k t)`，`ω_d,k=ω_k sqrt(1−ζ_k²)`。固體振動要經 `radiationModel` 才成為空氣聲壓，不能把位移或 mode amplitude 直接稱 Pa／SPL。

剛體引擎提供的衝量可以當激發 proxy，但不含完整高頻力、微碰撞及彈性耦合。CW03 提醒 resting-contact solver 波動可能變成可聞嗡聲；事件去重和閾值只能降低 artifact，不能取代耦合模型。

## 6. 事件契約與時脈

碰撞事件至少需要：

```text
eventId, pairId, contactId, simulationTick, tSimulation_s
bodyAId, bodyBId, contactPoint_m, normal_A_to_B
preContactRelativeVelocity_m_s, normalImpulse_N_s
materialAId, materialBId, bodyModeA, bodyModeB
solverVersion, physicsDt_s, provenance, optionalForceEstimate_N
```

`ImpactBegin` 與 `ContactPersist` 分流；同一次多點接觸可先依 pair／tick／空間群組聚合，再用 energy/gain 上限防止 manifold 點數改變就變大聲。聚合規則、minimum onset、retrigger interval 屬本專案工程設計，必須經 V1/V2/V5 驗證，不是文獻保證。

Audio renderer 以 sample clock 排程；physics tick 轉 audio time 要有明確 epoch／clock mapping。Audio callback 只讀有界 event queue 和已準備參數；不可等待 physics、網路或求解幾何。要記錄 queue overflow／late event policy，不能默默重播舊衝擊。

## 7. 波動求解的角色與成本

空氣的線性無耗散波動方程與頻域形式：

```text
∂²p/∂t² = c² ∇²p + source
∇²P + (ω/c)² P = source_frequency
```

CW04 與 CW06 均使用這類模型。FDTD 對整個體積取樣，FEM 在體積網格建立弱形式，BEM 以 Green 函數將均勻域問題寫到邊界；後者減少網格維度，但一般矩陣是 dense，仍需加速與良好的 iterative solver。這些不是「反射路徑枚舉」的同義詞。

對**均勻 cubic grid、標準二階 7-point explicit FDTD**，von Neumann 分析給出：

```text
λ_courant = c Δt / Δx ≤ 1/√3
```

這是對特定 stencil 的解析推導條件，**不可套用 CW04 的所有 27-point／implicit stencil 或不規則邊界**。邊界、浮點誤差、色散與 source injection 仍需獨立驗證；穩定不代表正確。每波長取樣點數決定可用最高頻率，不能只滿足 Nyquist 就宣稱聲壓誤差夠小。

在相同物理體積與模擬時間、固定每波長解析度／Courant 比例下，由網格點數與步數可自行推得：最高頻率提高 2 倍約使記憶體增為 8 倍、explicit 更新量增為 16 倍。這是漸近估算，不是本機 benchmark；常數、邊界、GPU transfer、FEM order 與 BEM acceleration 另計。CW04 提供相同尺度問題的分析背景。

規劃：P0/P1 採幾何聲學及音訊渲染；波動方法先作小房間／低頻離線 V3 對照。若做 hybrid，須明確定義分頻、重疊區、相位／增益與 crossfade，避免同一能量在兩 backend 重複累加。CW06 的 shoebox 比較尤其顯示：不同入射角邊界假設可造成 solver 差值，不能盲目選「較複雜」solver 為 ground truth。

對尺寸 `Lx,Ly,Lz`、均勻 c、**剛性 Neumann 邊界**的長方體，由波動方程分離變數可獨立導出：

```text
f(nx,ny,nz) = c/2 × sqrt((nx/Lx)² + (ny/Ly)² + (nz/Lz)²)
nx,ny,nz = nonnegative integers; exclude (0,0,0) for nonzero modes
```

此為 `WAVE-001` 解析 oracle，不是 measured resonance；有限阻抗、吸收、非長方體會改變模態與衰減。空間 source／receiver 的模態節點可能使某個理論頻率幾乎未被激發或接收，FFT 未見峰值不能直接判定 solver 錯誤。頻率解析度、時間窗、damping 和 spectral estimator 必須同時記錄。

## 8. 建議解析 fixtures 與限制

| Fixture | 解析條件與期望 | 驗證重點 |
|---|---|---|
| NoGravityDynamic | 無其他力／damping／contact，`x=x0+v0t` | 區分 mode、積分誤差、步長與座標 |
| FixedBodyCollision | 固定平面不移動，dynamic 球正向碰撞 | 動量法向符號、impact 世界位置、事件數；固定邊界可受外部支撐，勿要求兩球孤立動量式 |
| CentralImpact | 單一無摩擦、指定 `e` 與質量 | 接近／分離速度與 `j_n`，solver 容差應由固定版本 spike 量得 |
| OffCenterImpact | 接觸點相對質心偏移 | 角速度及接觸點速度，不以質心速度代替 |
| RestingContact | gravity 下安靜靜置 | 不反覆觸發 impact；追蹤 solver jitter 與人為閾值 |
| ModalImpulse | 單阻尼模式、已知激發 | 頻率、衰減包絡、線性與無 NaN；不代表真實材質驗證 |
| WaveShoebox | 固定 c、硬牆、相同 source 與網格收斂 | 理論 room modes、到達時間、穩定性；先對齊 boundary |

此文件定義驗收條件，不把建議 tolerance 冒充量測結果。已跑的隔離解析 kernel 與 Rapier engine smoke 分別見 `benchmarks/results/validation-local.json`、`experiments/physics-spike/`；其有限場景結果不等於以上所有物理／模態／wave fixtures 已完成。實際容差、結果與命令由各 runner 記錄；研究主張、解析推導、工程決策與已跑測試分欄保存。
