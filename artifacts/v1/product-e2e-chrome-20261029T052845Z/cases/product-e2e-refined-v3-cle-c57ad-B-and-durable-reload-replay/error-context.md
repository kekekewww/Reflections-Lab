# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: product-e2e-refined-v3.spec.ts >> clean launch 1: actual throw/impact/native audio/capture/acoustic B and durable reload/replay
- Location: tests\browser\product-e2e-refined-v3.spec.ts:1121:3

# Error details

```
Error: Explicit capture recovery budget exhausted (8)
```

# Page snapshot

```yaml
- generic [ref=e3]:
  - link "跳至主要工作區" [ref=e4] [cursor=pointer]:
    - /url: "#main-workspace"
  - generic [ref=e5]:
    - banner [ref=e6]:
      - generic [ref=e12]:
        - text: REFLECTION
        - generic [ref=e13]: LAB
      - generic [ref=e14]:
        - strong [ref=e15]: 聲音行為實驗
        - generic [ref=e16]: Scene rev 1 · 本機專案
      - navigation "工作區" [ref=e17]:
        - button "01 建立場景" [ref=e18] [cursor=pointer]:
          - generic [ref=e19]: "01"
          - text: 建立場景
        - button "02 互動實驗" [ref=e20] [cursor=pointer]:
          - generic [ref=e21]: "02"
          - text: 互動實驗
        - button "03 檢驗比較" [ref=e22] [cursor=pointer]:
          - generic [ref=e23]: "03"
          - text: 檢驗比較
      - generic [ref=e24]:
        - generic [ref=e25]: 介面語言 / Interface language
        - combobox "介面語言 / Interface language" [ref=e26]:
          - option "繁體中文" [selected]
          - option "English"
      - generic [ref=e27]:
        - button "儲存專案" [ref=e28] [cursor=pointer]
        - button "匯出專案" [ref=e31] [cursor=pointer]
        - button "載入本機已儲存的專案" [ref=e34] [cursor=pointer]
        - button "匯入專案 JSON" [ref=e37] [cursor=pointer]
    - generic "模擬控制" [ref=e40]:
      - generic [ref=e41]:
        - button "繼續運算" [active] [ref=e42] [cursor=pointer]
        - button "重設" [ref=e45] [cursor=pointer]
        - button "復原場景命令" [ref=e49] [cursor=pointer]
        - button "重做場景命令" [disabled] [ref=e52]
      - generic [ref=e55]:
        - generic [ref=e56]: 已暫停
        - generic [ref=e57]: 2.85 s
        - generic [ref=e58]: tick 171
      - generic [ref=e59]:
        - button "場景" [pressed] [ref=e60] [cursor=pointer]
        - button "檢查器" [pressed] [ref=e63] [cursor=pointer]
    - status [ref=e66]:
      - generic [ref=e69]: 固定步負載超限，已暫停；未丟棄錄製 tick
    - main [ref=e70]:
      - complementary "場景與素材" [ref=e71]:
        - generic [ref=e72]:
          - heading "場景" [level=2] [ref=e73]
          - generic [ref=e74]: 6 物件
        - textbox "搜尋場景物件" [ref=e79]:
          - /placeholder: 搜尋物件或 ID
        - generic [ref=e80]:
          - generic [ref=e81]: 物件庫
          - generic [ref=e82]: PRIMITIVES
        - generic [ref=e83]:
          - button "方塊 +" [ref=e84] [cursor=pointer]:
            - generic [ref=e87]: 方塊
            - generic [ref=e88]: +
          - button "球體 +" [ref=e89] [cursor=pointer]:
            - generic [ref=e93]: 球體
            - generic [ref=e94]: +
          - button "膠囊 +" [ref=e95] [cursor=pointer]:
            - generic [ref=e98]: 膠囊
            - generic [ref=e99]: +
        - generic [ref=e100]: 場景物件
        - list "場景物件清單" [ref=e104]:
          - listitem [ref=e105]:
            - button "floor 固定" [ref=e106] [cursor=pointer]:
              - generic "floor" [ref=e111]
              - generic "fixed" [ref=e112]: 固定
          - listitem [ref=e113]:
            - button "wall.back 固定" [ref=e114] [cursor=pointer]:
              - generic "wall.back" [ref=e119]
              - generic "fixed" [ref=e120]: 固定
          - listitem [ref=e121]:
            - button "wall.left 固定" [ref=e122] [cursor=pointer]:
              - generic "wall.left" [ref=e127]
              - generic "fixed" [ref=e128]: 固定
          - listitem [ref=e129]:
            - button "wall.right 固定" [ref=e130] [cursor=pointer]:
              - generic "wall.right" [ref=e135]
              - generic "fixed" [ref=e136]: 固定
          - listitem [ref=e137]:
            - button "ball 持有" [pressed] [ref=e138] [cursor=pointer]:
              - generic "ball" [ref=e144]
              - generic "dynamicNoGravity" [ref=e145]: 持有
          - listitem [ref=e146]:
            - button "speaker 固定" [ref=e147] [cursor=pointer]:
              - generic "speaker" [ref=e152]
              - generic "fixed" [ref=e153]: 固定
        - button "Listener / 環境 listener.main 跟隨 FPS" [ref=e154] [cursor=pointer]:
          - generic [ref=e157]:
            - text: Listener / 環境
            - generic [ref=e158]: listener.main
          - generic [ref=e159]: 跟隨 FPS
        - generic [ref=e160]:
          - generic [ref=e161]:
            - generic [ref=e162]: 聲音素材
            - generic [ref=e163]: "4"
          - list [ref=e164]:
            - listitem [ref=e165]:
              - generic [ref=e166]:
                - generic [ref=e167]: original-220hz.wav
                - group [ref=e168]:
                  - generic "來源資訊" [ref=e169] [cursor=pointer]
              - button "預聽 original-220hz.wav 乾音" [ref=e170] [cursor=pointer]
            - listitem [ref=e173]:
              - generic [ref=e174]:
                - generic [ref=e175]: builtin-tone
                - group [ref=e176]:
                  - generic "來源資訊" [ref=e177] [cursor=pointer]
              - button "預聽 builtin-tone 乾音" [ref=e178] [cursor=pointer]
            - listitem [ref=e181]:
              - generic [ref=e182]:
                - generic [ref=e183]: builtin-impact
                - group [ref=e184]:
                  - generic "來源資訊" [ref=e185] [cursor=pointer]
              - button "預聽 builtin-impact 乾音" [ref=e186] [cursor=pointer]
            - listitem [ref=e189]:
              - generic [ref=e190]:
                - generic [ref=e191]: builtin-whoosh
                - group [ref=e192]:
                  - generic "來源資訊" [ref=e193] [cursor=pointer]
              - button "預聽 builtin-whoosh 乾音" [ref=e194] [cursor=pointer]
          - group [ref=e197]:
            - generic "匯入聲音" [ref=e198] [cursor=pointer]
            - generic [ref=e199]:
              - checkbox "我確認有權使用匯入的音檔" [checked] [ref=e200]
              - generic [ref=e201]: 我確認有權使用匯入的音檔
            - button "匯入聲音" [ref=e202] [cursor=pointer]
            - paragraph [ref=e205]: PCM/float WAV，大小/時長限制依錯誤提示。本機素材不會上傳模型。預聽為獨立乾音，不列入實驗。
        - generic [ref=e206]: 場景單位 SI · +Y 向上重力與傳播介質分開設定
      - separator "調整場景面板寬度" [ref=e210]
      - region "三維場景" [ref=e212]:
        - generic [ref=e213]:
          - generic [ref=e214]:
            - generic [ref=e215]: VIEWPORT
            - strong [ref=e216]: 第一人稱互動
          - generic [ref=e217]:
            - button "對準選取" [disabled] [ref=e218]
            - button "離開第一人稱" [ref=e219] [cursor=pointer]
        - generic [ref=e220]:
          - generic "三維場景。Alt 加左鍵旋轉、中鍵平移、滾輪縮放；亦可使用物件清單與數值控制。" [ref=e223]
          - generic:
            - generic: 已暫停
            - generic: tick 171 · 2.85 s
            - generic: 固定步負載超限，已暫停；未丟棄錄製 tick
          - generic:
            - generic: Computed
            - generic: Scene r1 · Acoustic r1
          - generic [aria-hidden]: ＋
          - generic:
            - strong: 持有 ball
            - generic: 1 kg · 保留接觸求解
            - generic: 免鎖定操作已啟用；請使用繼續運算與下方按鈕
            - button "啟用滑鼠控制" [ref=e224] [cursor=pointer]
          - generic "座標慣例":
            - text: Y↑
            - generic: −Z 前
            - generic: SI · m
        - generic [ref=e225]:
          - generic [ref=e226]:
            - generic [ref=e227]: ● Listener / Direct
            - generic [ref=e228]: ◇ Reflection
            - generic [ref=e229]: 聲線來自求解器 · 5/5
          - generic [ref=e230]:
            - checkbox "阻擋候選（不送音訊）" [ref=e231]
            - text: 阻擋候選（不送音訊）
        - generic "無滑鼠鎖定替代操作" [ref=e232]:
          - button "停用免鎖定操作" [pressed] [ref=e233] [cursor=pointer]
          - button "開始第一人稱操作" [ref=e234] [cursor=pointer]
          - button "抓取" [disabled] [ref=e235]
          - button "釋放" [ref=e236] [cursor=pointer]
          - button "投擲" [disabled] [ref=e237]
          - button "放置" [disabled] [ref=e238]
          - button "切換建造" [disabled] [ref=e239]
        - group [ref=e240]:
          - generic "免鎖定移動與視角" [ref=e241] [cursor=pointer]
      - separator "調整檢查器寬度" [ref=e242]
      - complementary "屬性檢查器" [ref=e244]:
        - generic [ref=e245]:
          - heading "檢查器" [level=2] [ref=e246]
          - generic [ref=e247]: sphere
        - generic [ref=e253]:
          - heading "ball" [level=2] [ref=e254]
          - code [ref=e255]: ball
        - generic [ref=e256]:
          - button "複製" [ref=e257] [cursor=pointer]
          - button "刪除" [ref=e261] [cursor=pointer]
        - generic [ref=e264]:
          - generic [ref=e265]:
            - heading "Transform" [level=3] [ref=e266]
            - generic [ref=e267]: 作者設定
          - group "位置 m" [ref=e268]:
            - generic [ref=e269]:
              - text: 位置
              - generic [ref=e270]: m
            - generic [ref=e271]:
              - generic [ref=e272]:
                - generic [ref=e273]: X
                - spinbutton "X" [ref=e274]: "0"
              - generic [ref=e275]:
                - generic [ref=e276]: "Y"
                - spinbutton "Y" [ref=e277]: "1.6"
              - generic [ref=e278]:
                - generic [ref=e279]: Z
                - spinbutton "Z" [ref=e280]: "1.5"
          - group "尺寸 m" [ref=e281]:
            - generic [ref=e282]:
              - text: 尺寸
              - generic [ref=e283]: m
            - generic [ref=e284]:
              - generic [ref=e285]:
                - generic [ref=e286]: X
                - spinbutton "X" [ref=e287]: "0.5"
              - generic [ref=e288]:
                - generic [ref=e289]: "Y"
                - spinbutton "Y" [ref=e290]: "0.5"
              - generic [ref=e291]:
                - generic [ref=e292]: Z
                - spinbutton "Z" [ref=e293]: "0.5"
          - group "旋轉 deg · XYZ" [ref=e294]:
            - generic [ref=e295]:
              - text: 旋轉
              - generic [ref=e296]: deg · XYZ
            - generic [ref=e297]:
              - generic [ref=e298]:
                - generic [ref=e299]: 旋轉 X
                - spinbutton "旋轉 X" [ref=e300]: "0"
              - generic [ref=e301]:
                - generic [ref=e302]: 旋轉 Y
                - spinbutton "旋轉 Y" [ref=e303]: "0"
              - generic [ref=e304]:
                - generic [ref=e305]: 旋轉 Z
                - spinbutton "旋轉 Z" [ref=e306]: "0"
          - group [ref=e307]:
            - generic "詳細資訊" [ref=e308] [cursor=pointer]
        - generic [ref=e309]:
          - heading "剛體物理" [level=3] [ref=e311]
          - generic [ref=e312]:
            - generic [ref=e313]: Body Mode
            - combobox "剛體模式" [ref=e314]:
              - option "Dynamic · 受重力"
              - option "Dynamic · 無重力" [selected]
              - option "Fixed · 固定"
              - option "Kinematic · 指定運動"
          - generic [ref=e315]:
            - generic [ref=e316]:
              - generic [ref=e317]:
                - text: 質量
                - generic [ref=e318]: kg
              - spinbutton "質量 kg" [ref=e319]: "1"
            - generic [ref=e320]:
              - generic [ref=e321]: 摩擦係數
              - spinbutton "摩擦係數" [ref=e322]: "0.4"
          - generic [ref=e323]:
            - generic [ref=e324]: 恢復係數
            - spinbutton "恢復係數" [ref=e325]: "0.55"
          - generic [ref=e326]:
            - generic [ref=e327]: 速度
            - code [ref=e328]: 0.002 m/s
          - group [ref=e329]:
            - generic "詳細資訊" [ref=e330] [cursor=pointer]
        - generic [ref=e331]:
          - generic [ref=e332]:
            - heading "聲學材質" [level=3] [ref=e333]
            - generic [ref=e334]: Synthetic
          - generic [ref=e335]:
            - generic [ref=e336]: 表面材質
            - combobox "聲學材質" [ref=e337]:
              - option "硬質表面 · Synthetic · Synthetic"
              - option "吸音表面 · Synthetic · Synthetic"
              - option "木質示範 · Synthetic · Synthetic"
              - option "金屬示範 · Synthetic · Synthetic" [selected]
          - generic [ref=e338]:
            - generic [ref=e339]: 聲學角色
            - combobox "聲學角色" [ref=e340]:
              - option "不參與幾何聲學"
              - option "靜態反射表面"
              - option "動態遮蔽物" [selected]
              - option "動態反射面（依後端能力）"
        - generic [ref=e341]:
          - generic [ref=e342]:
            - heading "Sound Behaviors" [level=3] [ref=e343]
            - generic [ref=e344]: 3 規則
          - paragraph [ref=e345]: 聲音內容自由設定；所有場景聲源仍經統一聲學傳播。
          - generic [ref=e346]:
            - generic [ref=e347]: 分類
            - combobox "分類" [ref=e348]:
              - option "Creative · 創意分類" [selected]
              - option "Physical-inspired · 材質啟發分類"
              - option "Hybrid · 混合分類"
              - option "Procedural · 程序音分類"
          - group [ref=e349]:
            - generic "詳細資訊" [ref=e350] [cursor=pointer]
          - generic [ref=e351]:
            - article "聲音行為 rule.impact" [ref=e352]:
              - generic [ref=e353]:
                - generic [ref=e354]:
                  - checkbox "撞擊時" [checked] [ref=e355]
                  - strong [ref=e356]: 撞擊時
                - button "刪除 rule.impact 行為" [ref=e357] [cursor=pointer]
              - generic [ref=e360]:
                - code [ref=e361]: rule.impact
                - generic [ref=e362]: 等待觸發
              - button "場景聲學預聽" [ref=e364] [cursor=pointer]
              - generic [ref=e367]:
                - generic [ref=e368]: 觸發條件
                - combobox "觸發條件" [ref=e369]:
                  - option "持續發聲 · AlwaysOn"
                  - option "移動期間 · WhileMoving"
                  - option "飛行期間 · WhileAirborne"
                  - option "滾動期間 · WhileRolling"
                  - option "滑動期間 · WhileSliding"
                  - option "旋轉期間 · WhileSpinning"
                  - option "持有期間 · WhileHeld"
                  - option "抓取時 · OnGrab"
                  - option "放手時 · OnRelease"
                  - option "投擲時 · OnThrow"
                  - option "放下時 · OnDrop"
                  - option "撞擊時 · OnImpact" [selected]
                  - option "彈跳時 · OnBounce（未支援）" [disabled]
                  - option "開始移動 · OnStartMoving"
                  - option "停止移動 · OnStopMoving"
                  - option "進入區域 · OnEnterZone（未支援）" [disabled]
                  - option "離開區域 · OnExitZone（未支援）" [disabled]
                  - option "休眠時 · OnSleep"
                  - option "喚醒時 · OnWake"
              - generic [ref=e370]:
                - generic [ref=e371]: 聲音素材
                - combobox "聲音素材" [ref=e372]:
                  - option "程序音 · Oscillator" [selected]
                  - option "original-220hz.wav"
                  - option "builtin-tone"
                  - option "builtin-impact"
                  - option "builtin-whoosh"
              - generic [ref=e373]:
                - generic [ref=e374]:
                  - generic [ref=e375]:
                    - text: 音量
                    - generic [ref=e376]: linear
                  - spinbutton "音量 linear" [ref=e377]: "0.06309573444801933"
                - generic [ref=e378]:
                  - generic [ref=e379]:
                    - text: 音高
                    - generic [ref=e380]: semitones
                  - spinbutton "音高 semitones" [ref=e381]: "0"
              - generic [ref=e382]:
                - generic [ref=e383]:
                  - generic [ref=e384]:
                    - text: 冷卻時間
                    - generic [ref=e385]: s
                  - spinbutton "冷卻時間 s" [ref=e386]: "0.08"
                - paragraph [ref=e387]: 控制曲線可在下方逐點編輯；不改變物理與傳播模型。
              - region "參數映射曲線編輯器" [ref=e388]:
                - paragraph [ref=e389]: 作者控制曲線，非聲學量測。點表 x/y 為 0–1 正規化座標；首點 x=0、末點 x=1，x 嚴格遞增。每個輸出最多一條映射。
                - article "參數映射 mapping.impact-gain" [ref=e390]:
                  - generic [ref=e391]:
                    - code [ref=e392]: mapping.impact-gain
                    - button "移除映射" [ref=e393] [cursor=pointer]
                  - generic [ref=e394]:
                    - generic [ref=e395]:
                      - generic [ref=e396]: 輸入 metric · m/s
                      - combobox "映射輸入 metric" [ref=e397]:
                        - option "聲源速度 · m/s"
                        - option "角速度 · rad/s"
                        - option "法向衝量 · N·s"
                        - option "接近速度 · m/s" [selected]
                        - option "切向速度 · m/s"
                        - option "滑移速度 · m/s"
                        - option "接觸支撐力 · N"
                    - generic [ref=e398]:
                      - generic [ref=e399]: 輸出參數 · linear
                      - combobox "映射輸出參數" [ref=e400]:
                        - option "音量 · linear" [selected]
                        - option "音高 · semitones"
                        - option "濾波截止頻率 · Hz"
                  - generic [ref=e401]:
                    - generic [ref=e402]:
                      - generic [ref=e403]: 輸入下限 · m/s
                      - spinbutton "映射輸入下限" [ref=e404]: "0"
                    - generic [ref=e405]:
                      - generic [ref=e406]: 輸入上限 · m/s
                      - spinbutton "映射輸入上限" [ref=e407]: "10"
                  - generic [ref=e408]:
                    - generic [ref=e409]:
                      - generic [ref=e410]: 輸出下限 · linear
                      - spinbutton "映射輸出下限" [ref=e411]: "0.025"
                    - generic [ref=e412]:
                      - generic [ref=e413]: 輸出上限 · linear
                      - spinbutton "映射輸出上限" [ref=e414]: "0.25"
                  - generic [ref=e415]:
                    - generic [ref=e416]:
                      - generic [ref=e417]: 插值
                      - combobox "映射插值" [ref=e418]:
                        - option "Linear · 線性" [selected]
                        - option "Step · 階梯"
                    - generic [ref=e419]:
                      - generic [ref=e420]: 參數平滑 · s
                      - spinbutton "映射平滑時間 s" [ref=e421]: "0.015"
                  - paragraph [ref=e422]: Clamp 固定啟用。平滑是發聲參數，不改變物理結果或聲音傳播時間。觸發條件可用的 metric 仍由套用時驗證；缺值不冒充 0。
                  - img "作者參數映射曲線；非聲學量測或聲線。線性插值。" [ref=e423]:
                    - generic "1：輸入 0 m/s → 輸出 0.025 linear" [ref=e426]
                    - generic "2：輸入 10 m/s → 輸出 0.25 linear" [ref=e427]
                  - paragraph [ref=e428]:
                    - status "曲線中點預覽" [ref=e429]: 5 m/s → 0.1375 linear
                    - text: （曲線中點預覽，未經平滑／非模擬結果）
                  - paragraph [ref=e430]: 輸入：接近速度 0–10 m/s；輸出：音量 0.025–0.25 linear。
                  - table [ref=e431]:
                    - caption [ref=e432]: 曲線控制點 · x/y 正規化 [0, 1]
                    - rowgroup [ref=e433]:
                      - row [ref=e434]:
                        - columnheader "點" [ref=e435]
                        - columnheader "x" [ref=e436]
                        - columnheader "y" [ref=e437]
                        - columnheader "操作" [ref=e438]
                    - rowgroup [ref=e439]:
                      - row [ref=e440]:
                        - rowheader "1" [ref=e441]
                        - cell [ref=e442]:
                          - spinbutton "曲線點 1 x" [ref=e443]: "0"
                        - cell [ref=e444]:
                          - spinbutton "曲線點 1 y" [ref=e445]: "0"
                        - cell [ref=e446]:
                          - button "移除曲線點 1" [disabled] [ref=e447]: 移除
                      - row [ref=e448]:
                        - rowheader "2" [ref=e449]
                        - cell [ref=e450]:
                          - spinbutton "曲線點 2 x" [ref=e451]: "1"
                        - cell [ref=e452]:
                          - spinbutton "曲線點 2 y" [ref=e453]: "1"
                        - cell [ref=e454]:
                          - button "移除曲線點 2" [disabled] [ref=e455]: 移除
                  - button "新增曲線點" [ref=e456] [cursor=pointer]
                - button "新增參數映射" [ref=e457] [cursor=pointer]
                - paragraph [ref=e458]: 1/8 條映射；輸出參數不得重複。所有變更先保留為草稿。
            - region "此物件覆寫 rule.impact" [ref=e459]:
              - group [ref=e460]:
                - generic "此物件覆寫 繼承" [ref=e461]:
                  - text: 此物件覆寫
                  - generic [ref=e462]: 繼承
          - generic [ref=e463]:
            - article "聲音行為 rule.grab" [ref=e464]:
              - generic [ref=e465]:
                - generic [ref=e466]:
                  - checkbox "抓取時" [checked] [ref=e467]
                  - strong [ref=e468]: 抓取時
                - button "刪除 rule.grab 行為" [ref=e469] [cursor=pointer]
              - generic [ref=e472]:
                - code [ref=e473]: rule.grab
                - generic [ref=e474]: 聲音實例已到期 [LIFETIME_EXPIRED]
              - paragraph [ref=e475]: 最近決策 tick 39 · 聲音實例已到期 [LIFETIME_EXPIRED]
              - button "場景聲學預聽" [ref=e477] [cursor=pointer]
              - generic [ref=e480]:
                - generic [ref=e481]: 觸發條件
                - combobox "觸發條件" [ref=e482]:
                  - option "持續發聲 · AlwaysOn"
                  - option "移動期間 · WhileMoving"
                  - option "飛行期間 · WhileAirborne"
                  - option "滾動期間 · WhileRolling"
                  - option "滑動期間 · WhileSliding"
                  - option "旋轉期間 · WhileSpinning"
                  - option "持有期間 · WhileHeld"
                  - option "抓取時 · OnGrab" [selected]
                  - option "放手時 · OnRelease"
                  - option "投擲時 · OnThrow"
                  - option "放下時 · OnDrop"
                  - option "撞擊時 · OnImpact"
                  - option "彈跳時 · OnBounce（未支援）" [disabled]
                  - option "開始移動 · OnStartMoving"
                  - option "停止移動 · OnStopMoving"
                  - option "進入區域 · OnEnterZone（未支援）" [disabled]
                  - option "離開區域 · OnExitZone（未支援）" [disabled]
                  - option "休眠時 · OnSleep"
                  - option "喚醒時 · OnWake"
              - generic [ref=e483]:
                - generic [ref=e484]: 聲音素材
                - combobox "聲音素材" [ref=e485]:
                  - option "程序音 · Oscillator" [selected]
                  - option "original-220hz.wav"
                  - option "builtin-tone"
                  - option "builtin-impact"
                  - option "builtin-whoosh"
              - generic [ref=e486]:
                - generic [ref=e487]:
                  - generic [ref=e488]:
                    - text: 音量
                    - generic [ref=e489]: linear
                  - spinbutton "音量 linear" [ref=e490]: "0.06309573444801933"
                - generic [ref=e491]:
                  - generic [ref=e492]:
                    - text: 音高
                    - generic [ref=e493]: semitones
                  - spinbutton "音高 semitones" [ref=e494]: "0"
              - generic [ref=e495]:
                - generic [ref=e496]:
                  - generic [ref=e497]:
                    - text: 冷卻時間
                    - generic [ref=e498]: s
                  - spinbutton "冷卻時間 s" [ref=e499]: "0.08"
                - paragraph [ref=e500]: 控制曲線可在下方逐點編輯；不改變物理與傳播模型。
              - region "參數映射曲線編輯器" [ref=e501]:
                - paragraph [ref=e502]: 作者控制曲線，非聲學量測。點表 x/y 為 0–1 正規化座標；首點 x=0、末點 x=1，x 嚴格遞增。每個輸出最多一條映射。
                - button "新增參數映射" [ref=e503] [cursor=pointer]
                - paragraph [ref=e504]: 0/8 條映射；輸出參數不得重複。所有變更先保留為草稿。
            - region "此物件覆寫 rule.grab" [ref=e505]:
              - group [ref=e506]:
                - generic "此物件覆寫 繼承" [ref=e507]:
                  - text: 此物件覆寫
                  - generic [ref=e508]: 繼承
          - generic [ref=e509]:
            - article "聲音行為 rule.throw" [ref=e510]:
              - generic [ref=e511]:
                - generic [ref=e512]:
                  - checkbox "投擲時" [checked] [ref=e513]
                  - strong [ref=e514]: 投擲時
                - button "刪除 rule.throw 行為" [ref=e515] [cursor=pointer]
              - generic [ref=e518]:
                - code [ref=e519]: rule.throw
                - generic [ref=e520]: 等待觸發
              - button "場景聲學預聽" [ref=e522] [cursor=pointer]
              - generic [ref=e525]:
                - generic [ref=e526]: 觸發條件
                - combobox "觸發條件" [ref=e527]:
                  - option "持續發聲 · AlwaysOn"
                  - option "移動期間 · WhileMoving"
                  - option "飛行期間 · WhileAirborne"
                  - option "滾動期間 · WhileRolling"
                  - option "滑動期間 · WhileSliding"
                  - option "旋轉期間 · WhileSpinning"
                  - option "持有期間 · WhileHeld"
                  - option "抓取時 · OnGrab"
                  - option "放手時 · OnRelease"
                  - option "投擲時 · OnThrow" [selected]
                  - option "放下時 · OnDrop"
                  - option "撞擊時 · OnImpact"
                  - option "彈跳時 · OnBounce（未支援）" [disabled]
                  - option "開始移動 · OnStartMoving"
                  - option "停止移動 · OnStopMoving"
                  - option "進入區域 · OnEnterZone（未支援）" [disabled]
                  - option "離開區域 · OnExitZone（未支援）" [disabled]
                  - option "休眠時 · OnSleep"
                  - option "喚醒時 · OnWake"
              - generic [ref=e528]:
                - generic [ref=e529]: 聲音素材
                - combobox "聲音素材" [ref=e530]:
                  - option "程序音 · Oscillator" [selected]
                  - option "original-220hz.wav"
                  - option "builtin-tone"
                  - option "builtin-impact"
                  - option "builtin-whoosh"
              - generic [ref=e531]:
                - generic [ref=e532]:
                  - generic [ref=e533]:
                    - text: 音量
                    - generic [ref=e534]: linear
                  - spinbutton "音量 linear" [ref=e535]: "0.06309573444801933"
                - generic [ref=e536]:
                  - generic [ref=e537]:
                    - text: 音高
                    - generic [ref=e538]: semitones
                  - spinbutton "音高 semitones" [ref=e539]: "0"
              - generic [ref=e540]:
                - generic [ref=e541]:
                  - generic [ref=e542]:
                    - text: 冷卻時間
                    - generic [ref=e543]: s
                  - spinbutton "冷卻時間 s" [ref=e544]: "0.08"
                - paragraph [ref=e545]: 控制曲線可在下方逐點編輯；不改變物理與傳播模型。
              - region "參數映射曲線編輯器" [ref=e546]:
                - paragraph [ref=e547]: 作者控制曲線，非聲學量測。點表 x/y 為 0–1 正規化座標；首點 x=0、末點 x=1，x 嚴格遞增。每個輸出最多一條映射。
                - button "新增參數映射" [ref=e548] [cursor=pointer]
                - paragraph [ref=e549]: 0/8 條映射；輸出參數不得重複。所有變更先保留為草稿。
            - region "此物件覆寫 rule.throw" [ref=e550]:
              - group [ref=e551]:
                - generic "此物件覆寫 繼承" [ref=e552]:
                  - text: 此物件覆寫
                  - generic [ref=e553]: 繼承
          - generic [ref=e554]:
            - generic [ref=e555]: 新增行為觸發條件
            - combobox "新增行為觸發條件" [ref=e556]:
              - option "持續發聲"
              - option "移動期間"
              - option "飛行期間"
              - option "滾動期間"
              - option "滑動期間"
              - option "旋轉期間"
              - option "持有期間"
              - option "抓取時"
              - option "放手時"
              - option "投擲時"
              - option "放下時"
              - option "撞擊時" [selected]
              - option "彈跳時（未支援）" [disabled]
              - option "開始移動"
              - option "停止移動"
              - option "進入區域（未支援）" [disabled]
              - option "離開區域（未支援）" [disabled]
              - option "休眠時"
              - option "喚醒時"
            - button "新增" [ref=e557] [cursor=pointer]
          - group [ref=e560]:
            - generic "詳細資訊" [ref=e561] [cursor=pointer]
    - region "實驗與分析面板" [ref=e562]:
      - generic [ref=e563]:
        - tablist "實驗分析" [ref=e564]:
          - tab "事件與錄放 4" [selected] [ref=e565] [cursor=pointer]:
            - text: 事件與錄放
            - generic [ref=e566]: "4"
          - tab "聲學路徑 5" [ref=e567] [cursor=pointer]:
            - text: 聲學路徑
            - generic [ref=e568]: "5"
          - tab "實驗比較" [ref=e569] [cursor=pointer]
          - tab "Meta 實驗 Agent" [ref=e570] [cursor=pointer]
        - button "展開實驗面板" [ref=e571] [cursor=pointer]: ⌃
  - contentinfo "音訊監聽與後端狀態" [ref=e572]:
    - generic [ref=e573]:
      - button "靜音監聽" [ref=e574] [cursor=pointer]
      - generic [ref=e578]:
        - generic [ref=e579]: Monitor
        - slider "監聽音量" [ref=e580]: "0.18"
        - status [ref=e581]: 18%
    - group "監聽路由" [ref=e582]:
      - button "Simulated" [pressed] [ref=e583] [cursor=pointer]
      - button "Raw 參考" [ref=e584] [cursor=pointer]
    - group [ref=e585]:
      - generic "監聽資訊" [ref=e586] [cursor=pointer]
    - group [ref=e587]:
      - generic "Synthetic late reverb" [ref=e588] [cursor=pointer]
```

# Test source

```ts
  267 |         else graph.droppedTimingSamples++;
  268 |       }
  269 |     };
  270 |     const onTick: unknown = Reflect.get(runtime, "onTick");
  271 |     if (typeof onTick === "function")
  272 |       Reflect.set(runtime, "onTick", (snapshot: { tick: number }) => {
  273 |         const started = performance.now(),
  274 |           recordingState = runtime.getSnapshot().recording.state;
  275 |         try {
  276 |           return Reflect.apply(onTick, runtime, [snapshot]);
  277 |         } finally {
  278 |           if (graph.tickTimings.length < 4096)
  279 |             graph.tickTimings.push({
  280 |               tick: snapshot.tick,
  281 |               costMs: performance.now() - started,
  282 |               recordingState,
  283 |             });
  284 |           else graph.droppedTimingSamples++;
  285 |         }
  286 |       });
  287 |   });
  288 | }
  289 | async function collectGraph(page: Page) {
  290 |   return page.evaluate(() => {
  291 |     const graph = (window as GraphWindow).__nativeGraph;
  292 |     const canvas = document.querySelector("canvas"),
  293 |       gl = canvas?.getContext("webgl2"),
  294 |       debug = gl?.getExtension("WEBGL_debug_renderer_info");
  295 |     return {
  296 |       browserDevice: {
  297 |         userAgent: navigator.userAgent,
  298 |         hardwareConcurrency: navigator.hardwareConcurrency,
  299 |         widthCssPx: innerWidth,
  300 |         heightCssPx: innerHeight,
  301 |         devicePixelRatio,
  302 |         webglVendor: gl ? gl.getParameter(debug?.UNMASKED_VENDOR_WEBGL ?? gl.VENDOR) : null,
  303 |         webglRenderer: gl ? gl.getParameter(debug?.UNMASKED_RENDERER_WEBGL ?? gl.RENDERER) : null,
  304 |       },
  305 |       contextCount: graph.contexts.length,
  306 |       contextStates: graph.contexts.map((context) => ({
  307 |         state: context.state,
  308 |         currentTimeSeconds: context.currentTime,
  309 |         sampleRateHz: context.sampleRate,
  310 |         baseLatencySeconds: context.baseLatency,
  311 |         outputLatencySeconds: context.outputLatency ?? null,
  312 |       })),
  313 |       starts: graph.starts,
  314 |       destinations: graph.destinations,
  315 |       connections: graph.connections,
  316 |       panners: graph.panners.map((node) => ({
  317 |         nodeId: graph.nodeId(node),
  318 |         panningModel: node.panningModel,
  319 |         rolloffFactor: node.rolloffFactor,
  320 |         distanceModel: node.distanceModel,
  321 |       })),
  322 |       delaysSeconds: graph.delays.map((node) => node.delayTime.value),
  323 |       delayNodes: graph.delays.map((node) => ({
  324 |         nodeId: graph.nodeId(node),
  325 |         delaySeconds: node.delayTime.value,
  326 |       })),
  327 |       timings: {
  328 |         advance: graph.advanceTimings,
  329 |         tickBridge: graph.tickTimings,
  330 |         droppedSamples: graph.droppedTimingSamples,
  331 |         limits:
  332 |           "Measured public advance and actual onTick bridge/capture spans, not complete UI CPU or native audio render deadline",
  333 |       },
  334 |     };
  335 |   });
  336 | }
  337 | const transportStamp = (model: LabViewModel) => ({
  338 |   tick: model.tick,
  339 |   simTimeSeconds: model.simTimeSeconds,
  340 |   state: model.simulationState,
  341 |   runId: model.runId,
  342 |   sceneRevision: model.sceneRevision,
  343 |   recordingState: model.recording.state,
  344 |   pauseReason: model.pauseReason ?? "",
  345 | });
  346 | interface ExplicitRecovery {
  347 |   phase: string;
  348 |   action: "EXPLICIT_UI_RUN";
  349 |   at: string;
  350 |   before: ReturnType<typeof transportStamp>;
  351 |   after: ReturnType<typeof transportStamp>;
  352 | }
  353 | async function recoverCapture(
  354 |   page: Page,
  355 |   phase: string,
  356 |   recoveries: ExplicitRecovery[],
  357 | ): Promise<void> {
  358 |   const before = await page.evaluate(() => window.__reflectionLab!.getSnapshot());
  359 |   if (before.simulationState === "running") return;
  360 |   if (
  361 |     before.recording.state !== "recording" ||
  362 |     !/固定步.*超限|FIXED_STEP_OVERRUN/i.test(before.pauseReason ?? "")
  363 |   )
  364 |     throw new Error(
  365 |       `Unexpected capture stop at ${phase}: ${JSON.stringify(transportStamp(before))}`,
  366 |     );
> 367 |   if (recoveries.length >= 8) throw new Error("Explicit capture recovery budget exhausted (8)");
      |                                     ^ Error: Explicit capture recovery budget exhausted (8)
  368 |   await page.getByRole("button", { name: /^(開始運算|繼續運算)$/ }).click({ timeout: 3000 });
  369 |   const after = await page.evaluate(() => window.__reflectionLab!.getSnapshot());
  370 |   recoveries.push({
  371 |     phase,
  372 |     action: "EXPLICIT_UI_RUN",
  373 |     at: new Date().toISOString(),
  374 |     before: transportStamp(before),
  375 |     after: transportStamp(after),
  376 |   });
  377 |   expect(after.runId).toBe(before.runId);
  378 |   expect(after.sceneRevision).toBe(before.sceneRevision);
  379 |   expect(after.recording.state).toBe("recording");
  380 |   expect(after.tick).toBeGreaterThanOrEqual(before.tick);
  381 |   if (after.error) throw new Error(after.error);
  382 | }
  383 | async function captureClick(
  384 |   page: Page,
  385 |   name: string,
  386 |   recoveries: ExplicitRecovery[],
  387 | ): Promise<void> {
  388 |   for (;;) {
  389 |     await recoverCapture(page, `click:${name}`, recoveries);
  390 |     try {
  391 |       await page.getByRole("button", { name, exact: true }).click({ timeout: 1500 });
  392 |       return;
  393 |     } catch (error) {
  394 |       const state = await page.evaluate(() => window.__reflectionLab!.getSnapshot());
  395 |       if (
  396 |         state.simulationState === "running" ||
  397 |         !/固定步.*超限|FIXED_STEP_OVERRUN/i.test(state.pauseReason ?? "")
  398 |       )
  399 |         throw error;
  400 |     }
  401 |   }
  402 | }
  403 | 
  404 | // R17 v3 Grab-only helper. Root cause of historical lost action remains UNKNOWN.
  405 | async function captureGrabV3(page: Page, recoveries: ExplicitRecovery[]): Promise<void> {
  406 |   const deadline = Date.now() + 12000;
  407 |   const observe = () =>
  408 |     page.evaluate(() => {
  409 |       const runtime = window.__reflectionLab!;
  410 |       const model = runtime.getSnapshot();
  411 |       return {
  412 |         tick: model.tick,
  413 |         busy: Reflect.get(runtime, "busy") !== false,
  414 |         held: model.objects.find((object) => object.id === "ball")?.held === true,
  415 |         accepted: model.events.some(
  416 |           (event) => event.type === "OnGrab" && event.objectId === "ball",
  417 |         ),
  418 |         state: model.simulationState,
  419 |         overrun: /固定步.*超限|FIXED_STEP_OVERRUN/i.test(model.pauseReason ?? ""),
  420 |       };
  421 |     });
  422 |   const idle = async () => {
  423 |     while (Date.now() < deadline) {
  424 |       const state = await observe();
  425 |       if (!state.busy) {
  426 |         if (!Number.isSafeInteger(state.tick) || state.tick < 0)
  427 |           throw new Error("Grab acknowledgement missing valid observed tick; refusing retry");
  428 |         return state;
  429 |       }
  430 |       await page.waitForTimeout(50);
  431 |     }
  432 |     throw new Error("Grab acknowledgement timed out while runtime busy");
  433 |   };
  434 |   const nextPublishedTick = async (postInputTick: number) => {
  435 |     while (Date.now() < deadline) {
  436 |       const state = await idle();
  437 |       if (state.held || state.accepted || state.tick > postInputTick) return state;
  438 |       if (state.state !== "running") {
  439 |         if (!state.overrun) throw new Error("Grab stopped without fixed-step overrun");
  440 |         await recoverCapture(page, "grab-v3:await-post-input-tick", recoveries);
  441 |       }
  442 |       await page.waitForTimeout(50);
  443 |     }
  444 |     throw new Error("Grab acknowledgement missing post-input tick after recovery; refusing retry");
  445 |   };
  446 |   const initial = await idle();
  447 |   if (initial.held) return;
  448 |   if (initial.accepted)
  449 |     throw new Error("Grab precondition rejects pre-existing OnGrab while target is unheld");
  450 |   const acknowledge = async () => {
  451 |     while (Date.now() < deadline) {
  452 |       const state = await idle();
  453 |       if (state.held || state.accepted || state.overrun || state.state !== "running") return state;
  454 |       await page.waitForTimeout(50);
  455 |     }
  456 |     throw new Error("Grab unaccepted without fixed-step overrun; refusing blind retry");
  457 |   };
  458 |   let attempts = 0;
  459 |   while (Date.now() < deadline) {
  460 |     let state = await idle();
  461 |     if (state.held) return;
  462 |     if (state.accepted)
  463 |       throw new Error("Accepted Grab lost held postcondition; refusing duplicate");
  464 |     if (state.state !== "running") {
  465 |       if (!state.overrun) throw new Error("Grab stopped without fixed-step overrun");
  466 |       await recoverCapture(page, "grab-v3:unaccepted", recoveries);
  467 |       state = await idle();
```