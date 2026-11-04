# 曲面與移動反射器：獨立數學參考

本頁對應 Task0030、來源主張 CG-REF-001／005。這是 V1 幾何／工程公式驗證，不能當成 V2 音訊、V3 外部聲學 solver、V4 正式性能或 V5 真房間／聽感證據。科學來源及振幅限制見 [SOURCES](SOURCES.md)；原測試為 [curved-reference.test.ts](../../../../tests/acoustics-runtime/curved-reference.test.ts)。

## 參考方法與獨立性

產品的球面解使用共同可見弧上的路長導數二分法。獨立參考不用產品的導數、弧邊界、二分法或膠囊分解來產生 expected：

1. 精確反射定律構造：先固定表面點 P、外法向 n、單位切向 t，令來源與接收者從 P 的方向分別為 cos(a)n + sin(a)t 及 cos(a)n - sin(a)t。兩個距離分別固定 2.3 m、4.7 m，因此預期交點 P、總路長 7 m 和法向均已知。這同時測球面、膠囊側面、端帽、任意旋轉與接縫。
2. 獨立數值參考：在球的來源—球心—接收者平面，掃描完整 2π 法向角域 32768 點，將不可見點的 cost 設為 Infinity，再以只讀總距離的 golden-section search 做 90 次細化。它沒有讀產品導數，也沒有借用產品回傳點作 expected。
3. 既有平面解析答案：移動平面在 y=0 及 y=0.5 的兩個 snapshot，固定端點 (1,1,0)、(5,1,0)。預期反射點分別 (3,0,0)、(3,0.5,0)，路長分別 sqrt(20)、sqrt(17) m；不以產品鏡射 helper 計算 expected。

精確構造不是對實作的照抄：它把反射法則反向用於 fixture 生成，產品必須自行從不同端點與幾何解回交點。數值參考只用通用向量代數和距離函數，不 import 產品 geometry helpers。

## 共同可見凸弧的條件

Fermat 的一般條件是駐值，不是無條件的全域最短。此處的最小化僅用於外部凸體的共同可見域。

令球心為 C、半徑 r>0，P(θ)=C+r n(θ)、切向為 t，單一端點 E 的 d=|P-E|、u=(P-E)/d。直接微分可得：

d''(θ) = r² [1-(u·t)²] / d - r (u·n)。

在嚴格外部可見域 (E-P)·n>0，故 u·n<0，上式為正；兩段距離和在共同可見弧嚴格凸。這個專案推導支持該有限域的唯一駐值／最小值，**不外推到一般凹面、多次反射、焦散或端點位於體內的情況**。exact tangent 沒有嚴格正的可見內積，按本模型拒絕為反射；封閉不透明體的 segment 查詢則可保守地將接觸算遮蔽。

膠囊的側面／端帽候選與其數值實作是產品工程內容；本測試不以相同分解生成 expected。半段長為 0 時，以球體的獨立等價幾何核對。

## Fixture、單位與容差

全部位置與距離為 m，角度為 rad，聲速為 m/s、延遲為 s，gain 是 pressure ratio。材質是本專案原創 Synthetic，R=0.64、A=0.36、T=0、scattering=0.25，不是量測材質。

| Fixture      | 輸入／預期                                                                       | 容差／拒絕                                                                              |
| ------------ | -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| CURVE-REF-01 | 平移球、三個任意外法向，各測 a=0、0.43、1.1、89°；已知交點與兩腿長度             | 點／法向 2e-7；總長 4e-7 m；入射／反射 cosine 2e-7                                      |
| CURVE-REF-02 | 四組非對稱端點；完整角域 value-only 參考                                         | 交點 2e-6 m；與精確 fixture 容差分開                                                    |
| CURVE-REF-03 | 軸向 normalize(1,2,-1) 的膠囊；側面、上下接縫及距接縫 1e-6 m、兩端帽含近接縫法向 | 同精確 fixture，不能放寬成 facet 誤差                                                   |
| CURVE-REF-04 | capsule halfLength=0 與同心同半徑 sphere                                         | 點／法向差 2e-7                                                                         |
| CURVE-REF-05 | 同向共線、相反端點、內部／表面端點、exact grazing                                | 同向交點 (1,0,0)；其餘不產生反射                                                        |
| CURVE-REF-06 | open segment、endpoint 自交、整段體內、球體外 miss、膠囊兩端帽與側面             | 不透明體查詢與 expected 相符；cap y=±1.5、side x=±0.5                                   |
| CURVE-REF-07 | 真 solver 曲面輸出                                                               | 長 7 m、delay=7/343 s（2e-9 s）、gain=sqrt(0.64×0.75)/7（2e-8）；小幅移動不更換 path ID |
| CURVE-REF-08 | dynamicReflector 的兩個實際幾何 snapshot                                         | 點 2e-7 m；平面路長 1e-10 m；path ID 相同                                               |
| CURVE-REF-09 | 膠囊端帽／側面接縫的真 solver 路徑，以及不透明動態遮蔽物                         | 接縫只產生一條反射；穿過體積的 direct 被遮蔽，不製造穿透路徑                            |

2e-7 m 的精確交點門檻與產品既有 1e-7 m self-intersection epsilon 同尺度，並非真實聲學誤差。value-only 的總距離在極小值附近有二階平坦性，double 精度的距離差會比角度早失去有效位；因此獨立最佳化的點差另採 2e-6 m，不改產品的接受界線或舊平面 reference。二分總工作亦必須有界（sphere ≤48、capsule ≤144）。

## 執行與結果

初輪僅 math kernel 六組：

- 命令：node --import tsx --test --test-name-pattern='CURVE-REF-0[1-6]' tests/acoustics-runtime/curved-reference.test.ts
- 原始結果：[math-initial.txt](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/9eb5f9ec6e01252b36e6155f8de77519e7be58c0)。
- 已讀結果：6/6 PASS、0 FAIL、0 skip、exit 0。它不包括 CURVE-REF-07／08 的 solver 接線。

完整接線後另行執行九組：

- 命令：node --import tsx --test tests/acoustics-runtime/curved-reference.test.ts。
- 最終原始結果：[reference-final-pinned.txt](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/83b18eda76458a22e8bfc6c0cf81ec1a733b2cec)；機讀來源／方法／驗證層級：[verification.json](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/8696b2748d68395b6213db3d374d3fa11b7957c2)。
- 已讀結果：**9/9 PASS、0 FAIL、0 skip、exit 0**。執行前後五個產品／參考測試檔雜湊完全相同；它們是未提交工作樹的固定截點，不將 observed Git HEAD 冒充包含未提交實作的提交。
- exact tangent 於閉體 segment 查詢保守算 hit；只在實際 endpoint 的 tangent 由 epsilon 排除。軸向膠囊、端帽內部／接縫端點、相反軸向端點及 cap/cylinder 重複候選均已納入。
- 局部 ESLint、Prettier 檢查皆 exit 0。沒有改舊平面解析答案、fixture 或容差。

## 明確未驗與模型限制

保留 1/pathLength × sqrt((1-s)R) 的工程幅值代理；**未包含曲率擴散／聚焦、焦散、繞射、表面波、相干波動干涉、厚實體穿透、反射面的 retarded-time／Doppler**。幾何位置與延遲通過，不能證明上述振幅效果。

V0 的正式 schema/capability/budget 負例由 lead 套件另列。V2、V3、V4、V5 在本參考任務均 NOT RUN。未用結果推算 RT60、DRR、C50 或 calibrated SPL；預期不足時維持 null。
