# 新版資格與數位PCM歸因：待執行有限矩陣

本頁為方法提案／執行凍結候選，不是資格或測量證據。原V3負載、雙pin、strict parser、數值kernel、trace caps與歷史FAIL保持。全部run初始NOT_RUN，依Root exclusive machine lease序列執行。

## Browser語義資格（v1）

1. 原入口以目前Chrome執行原`--formal-600`參數；保留實際launcher雙pin拒絕，不改原V3使其PASS。
2. 另建owned、無產品bootstrap／其他RAF的靜態pilot頁，避免build成本；45秒操作、10秒cleanup，最多128個callback、8MiB gzip／32MiB expanded／200000 events。collector仍用原V3_LIMITS，128是外部pilot cap。
3. Pretrace先register/cancel PC，再register P0/P1；在同一JS task的精確debugger斷點暫停。Node啟trace後resume，同task建立begin，確保真pretrace-pending而不靠race。此干預只作語義資格，不取性能數字。
4. 固定24callbacks／13RAF groups，group sizes `[2,3,2,1,3,2,1,2,2,1,2,1,2]`；G0/G1各nested H0/H1，B1 register/cancel MC，E0 proof mark指定startTime=0。最後L1只排timer，待Fire span結束才close。
5. 三方比對：獨立operation journal／collector receipt／raw native trace。保留原strict `validateNativeV3()`與原Float64/時鐘membership規則；新oracle不import collector／bits/name helpers。原raw不可mutation覆寫；synthetic negative clones獨立保存標示。
6. source／oracle／parser／raw／actual `Browser.getVersion` revision／launcher前後hash／document identity／GPU／硬體與方法版本都綁定；獨立review之後才加入有限新qualification entry。pilot成功只證明語義資格，仍需原20秒all wiring及完整600秒正式profile。

## 受控PCM歸因（test-only tap v1）

原正式fixture不改muted native graph。另建受控fixture使用同AudioEngine／傳播graph，測試用output adapter須明示選到的實際node／graph版本並在缺接點時fail closed。browser實體聲音以明示mute旗標處理，數位聲流保留；不冒實際裝置聽測。

| case | 固定輸入／單一干預 | 可判讀的不同欄位 |
| --- | --- | --- |
| PCM01 | steady110Hz、固定source/listener/path、無stall | native onset／output stats／真PCM baseline |
| PCM02 | 同PCM01，main thread受控stall，steady native source不中斷 | main stall期間、control age／late onset、PCM／native output各自結果 |
| PCM03 | 背日期emission經真`playVoice`排程 | requested／actual audio onset lateness；不把晚起音冒underrun |
| PCM04 | 真stale update／path birth-death／voice或path budget拒收 | snapshot決策、admission/path loss及PCM分欄；不靠計數推音訊gap |
| PCM05 | 同固定source，實際輸出鏈test-only gain排入有限100ms silence | 證明數位gap與native underrun／control遲到可分辨；明標人工注入而非產品bug |

每case先固定合法矩陣與expected active windows；probe-on/off同graph、source／控制schedule／裝置／rate，off無tap。原始PCM、schedule、diag／native stats、actual block lengths與設定保存，獨立parser驗bytes/frame/channel/finite／已知active-window silence／連續性。濾波／HRTF／path變化的合法phase改變不能只靠最大sample差判成click；聲學數值容差不改。

Tap在processor constructor預配置最多10秒、2ch、actual8k..384kHz、PCM≤32MiB的固定pool；process只用actual input/output block length，無128fallback，精確裁切frame window。固定16個block-length buckets，溢出、缺input、channel不符、非finite、render-frame gap／overlap全部明示INVALID；cancel無PCM、不發布COMPLETE。完成只transfer一次buffer；不做callback網路/log／無界allocation，native DSP CPU與hardware underrun欄固定null，另外由可用native API收硬體統計。

## 同條件probe overhead與正式profile

- 受控PCM各case的on/off成本需直接量到；單次差異不冒跨run可靠性。可取得的process CPU、wall/sim時間、load counts、JS/native known bytes分開，opaque DSP/GPU memory與device route未知則null。
- 原formal on/off皆保持all／UI600wall／physics3000／acoustic600、原8source／32surfaces／default和256stress paths、10秒暖機、10／300／580秒各1秒capture。off只移除可選觀測，非降負載候選。
- 配對需核對source/bundle/browser/device／scene／caps與實際actions/captures/ticks；負載實際未完成則不能從兩個數字宣稱純probe overhead。off無trace／樣本timing，對應gate NOT_RUN/null，不以missing變成0或PASS。
- 600秒wall／sim／capture durations各列；18000frame／bytes cap不變，窗外drain獨立，不回填正式視窗。原V3及新run的所有拒絕／失敗保留。
