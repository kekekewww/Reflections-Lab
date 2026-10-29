# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: product-e2e-refined-v2.spec.ts >> a separate browser store rejects missing WAV bytes, then relinks the exact original without activating hardware
- Location: tests\browser\product-e2e-refined-v2.spec.ts:1028:1

# Error details

```
Error: page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:5190/
Call log:
  - navigating to "http://127.0.0.1:5190/", waiting until "load"

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
        - generic [ref=e16]: Scene rev 0 · 本機專案
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
        - button "開始運算" [ref=e42] [cursor=pointer]
        - button "重設" [ref=e45] [cursor=pointer]
        - button "復原場景命令" [ref=e49] [cursor=pointer]
        - button "重做場景命令" [disabled] [ref=e52]
      - generic [ref=e55]:
        - generic [ref=e56]: 準備就緒
        - generic [ref=e57]: 0.00 s
        - generic [ref=e58]: tick 0
      - generic [ref=e59]:
        - button "場景" [pressed] [ref=e60] [cursor=pointer]
        - button "檢查器" [pressed] [ref=e63] [cursor=pointer]
    - status [ref=e66]:
      - generic [ref=e69]: 作者編輯：暫停並清理舊聲音
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
            - button "ball 動態" [pressed] [ref=e138] [cursor=pointer]:
              - generic "ball" [ref=e144]
              - generic "dynamicGravity" [ref=e145]: 動態
          - listitem [ref=e146]:
            - button "speaker 固定" [ref=e147] [cursor=pointer]:
              - generic "speaker" [ref=e152]
              - generic "fixed" [ref=e153]: 固定
        - button "Listener / 環境 listener.main 獨立位置" [ref=e154] [cursor=pointer]:
          - generic [ref=e157]:
            - text: Listener / 環境
            - generic [ref=e158]: listener.main
          - generic [ref=e159]: 獨立位置
        - generic [ref=e160]:
          - generic [ref=e161]:
            - generic [ref=e162]: 聲音素材
            - generic [ref=e163]: "1"
          - list [ref=e164]:
            - listitem [ref=e165]:
              - generic [ref=e166]:
                - generic [ref=e167]: source-original.wav
                - group [ref=e168]:
                  - generic "來源資訊" [ref=e169] [cursor=pointer]
              - button "預聽 source-original.wav 乾音" [ref=e170] [cursor=pointer]
          - group [ref=e173]:
            - generic "匯入聲音" [ref=e174] [cursor=pointer]
            - generic [ref=e175]:
              - checkbox "我確認有權使用匯入的音檔" [checked] [active] [ref=e176]
              - generic [ref=e177]: 我確認有權使用匯入的音檔
            - button "匯入聲音" [ref=e178] [cursor=pointer]
            - paragraph [ref=e181]: PCM/float WAV，大小/時長限制依錯誤提示。本機素材不會上傳模型。預聽為獨立乾音，不列入實驗。
        - generic [ref=e182]: 場景單位 SI · +Y 向上重力與傳播介質分開設定
      - separator "調整場景面板寬度" [ref=e186]
      - region "三維場景" [ref=e188]:
        - generic [ref=e189]:
          - generic [ref=e190]:
            - generic [ref=e191]: VIEWPORT
            - strong [ref=e192]: 場景觀察
          - generic [ref=e193]:
            - button "對準選取" [ref=e194] [cursor=pointer]
            - button "進入第一人稱" [ref=e195] [cursor=pointer]
        - generic [ref=e196]:
          - generic "三維場景。Alt 加左鍵旋轉、中鍵平移、滾輪縮放；亦可使用物件清單與數值控制。" [ref=e199]
          - generic:
            - generic: 準備就緒
            - generic: tick 0 · 0.00 s
            - generic: 作者編輯：暫停並清理舊聲音
          - generic:
            - generic: 聲學 pending
            - generic: Scene r0 · Acoustic r0
          - generic "座標慣例":
            - text: Y↑
            - generic: −Z 前
            - generic: SI · m
        - generic [ref=e200]:
          - generic [ref=e201]:
            - generic [ref=e202]: ● Listener / Direct
            - generic [ref=e203]: ◇ Reflection
            - generic [ref=e204]: 聲線來自求解器 · 5/5
          - generic [ref=e205]:
            - checkbox "阻擋候選（不送音訊）" [ref=e206]
            - text: 阻擋候選（不送音訊）
      - separator "調整檢查器寬度" [ref=e207]
      - complementary "屬性檢查器" [ref=e209]:
        - generic [ref=e210]:
          - heading "檢查器" [level=2] [ref=e211]
          - generic [ref=e212]: sphere
        - generic [ref=e218]:
          - heading "ball" [level=2] [ref=e219]
          - code [ref=e220]: ball
        - generic [ref=e221]:
          - button "複製" [ref=e222] [cursor=pointer]
          - button "刪除" [ref=e226] [cursor=pointer]
        - generic [ref=e229]:
          - generic [ref=e230]:
            - heading "Transform" [level=3] [ref=e231]
            - generic [ref=e232]: 作者設定
          - group "位置 m" [ref=e233]:
            - generic [ref=e234]:
              - text: 位置
              - generic [ref=e235]: m
            - generic [ref=e236]:
              - generic [ref=e237]:
                - generic [ref=e238]: X
                - spinbutton "X" [ref=e239]: "-0.8"
              - generic [ref=e240]:
                - generic [ref=e241]: "Y"
                - spinbutton "Y" [ref=e242]: "2"
              - generic [ref=e243]:
                - generic [ref=e244]: Z
                - spinbutton "Z" [ref=e245]: "0"
          - group "尺寸 m" [ref=e246]:
            - generic [ref=e247]:
              - text: 尺寸
              - generic [ref=e248]: m
            - generic [ref=e249]:
              - generic [ref=e250]:
                - generic [ref=e251]: X
                - spinbutton "X" [ref=e252]: "0.5"
              - generic [ref=e253]:
                - generic [ref=e254]: "Y"
                - spinbutton "Y" [ref=e255]: "0.5"
              - generic [ref=e256]:
                - generic [ref=e257]: Z
                - spinbutton "Z" [ref=e258]: "0.5"
          - group "旋轉 deg · XYZ" [ref=e259]:
            - generic [ref=e260]:
              - text: 旋轉
              - generic [ref=e261]: deg · XYZ
            - generic [ref=e262]:
              - generic [ref=e263]:
                - generic [ref=e264]: 旋轉 X
                - spinbutton "旋轉 X" [ref=e265]: "0"
              - generic [ref=e266]:
                - generic [ref=e267]: 旋轉 Y
                - spinbutton "旋轉 Y" [ref=e268]: "0"
              - generic [ref=e269]:
                - generic [ref=e270]: 旋轉 Z
                - spinbutton "旋轉 Z" [ref=e271]: "0"
          - group [ref=e272]:
            - generic "詳細資訊" [ref=e273] [cursor=pointer]
        - generic [ref=e274]:
          - heading "剛體物理" [level=3] [ref=e276]
          - generic [ref=e277]:
            - generic [ref=e278]: Body Mode
            - combobox "剛體模式" [ref=e279]:
              - option "Dynamic · 受重力" [selected]
              - option "Dynamic · 無重力"
              - option "Fixed · 固定"
              - option "Kinematic · 指定運動"
          - generic [ref=e280]:
            - generic [ref=e281]:
              - generic [ref=e282]:
                - text: 質量
                - generic [ref=e283]: kg
              - spinbutton "質量 kg" [ref=e284]: "1"
            - generic [ref=e285]:
              - generic [ref=e286]: 摩擦係數
              - spinbutton "摩擦係數" [ref=e287]: "0.4"
          - generic [ref=e288]:
            - generic [ref=e289]: 恢復係數
            - spinbutton "恢復係數" [ref=e290]: "0.55"
          - generic [ref=e291]:
            - generic [ref=e292]: 速度
            - code [ref=e293]: 0.000 m/s
          - group [ref=e294]:
            - generic "詳細資訊" [ref=e295] [cursor=pointer]
        - generic [ref=e296]:
          - generic [ref=e297]:
            - heading "聲學材質" [level=3] [ref=e298]
            - generic [ref=e299]: Synthetic
          - generic [ref=e300]:
            - generic [ref=e301]: 表面材質
            - combobox "聲學材質" [ref=e302]:
              - option "硬質表面 · Synthetic · Synthetic"
              - option "吸音表面 · Synthetic · Synthetic"
              - option "木質示範 · Synthetic · Synthetic"
              - option "金屬示範 · Synthetic · Synthetic" [selected]
          - generic [ref=e303]:
            - generic [ref=e304]: 聲學角色
            - combobox "聲學角色" [ref=e305]:
              - option "不參與幾何聲學"
              - option "靜態反射表面"
              - option "動態遮蔽物" [selected]
              - option "動態反射面（依後端能力）"
        - generic [ref=e306]:
          - generic [ref=e307]:
            - heading "Sound Behaviors" [level=3] [ref=e308]
            - generic [ref=e309]: 3 規則
          - paragraph [ref=e310]: 聲音內容自由設定；所有場景聲源仍經統一聲學傳播。
          - generic [ref=e311]:
            - generic [ref=e312]: 分類
            - combobox "分類" [ref=e313]:
              - option "Creative · 創意分類" [selected]
              - option "Physical-inspired · 材質啟發分類"
              - option "Hybrid · 混合分類"
              - option "Procedural · 程序音分類"
          - group [ref=e314]:
            - generic "詳細資訊" [ref=e315] [cursor=pointer]
          - generic [ref=e316]:
            - article "聲音行為 rule.impact" [ref=e317]:
              - generic [ref=e318]:
                - generic [ref=e319]:
                  - checkbox "撞擊時" [checked] [ref=e320]
                  - strong [ref=e321]: 撞擊時
                - button "刪除 rule.impact 行為" [ref=e322] [cursor=pointer]
              - generic [ref=e325]:
                - code [ref=e326]: rule.impact
                - generic [ref=e327]: 等待觸發
              - button "場景聲學預聽" [ref=e329] [cursor=pointer]
              - generic [ref=e332]:
                - generic [ref=e333]: 觸發條件
                - combobox "觸發條件" [ref=e334]:
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
              - generic [ref=e335]:
                - generic [ref=e336]: 聲音素材
                - combobox "聲音素材" [ref=e337]:
                  - option "程序音 · Oscillator" [selected]
                  - option "source-original.wav"
              - generic [ref=e338]:
                - generic [ref=e339]:
                  - generic [ref=e340]:
                    - text: 音量
                    - generic [ref=e341]: linear
                  - spinbutton "音量 linear" [ref=e342]: "0.06309573444801933"
                - generic [ref=e343]:
                  - generic [ref=e344]:
                    - text: 音高
                    - generic [ref=e345]: semitones
                  - spinbutton "音高 semitones" [ref=e346]: "0"
              - generic [ref=e347]:
                - generic [ref=e348]:
                  - generic [ref=e349]:
                    - text: 冷卻時間
                    - generic [ref=e350]: s
                  - spinbutton "冷卻時間 s" [ref=e351]: "0.08"
                - paragraph [ref=e352]: 控制曲線可在下方逐點編輯；不改變物理與傳播模型。
              - region "參數映射曲線編輯器" [ref=e353]:
                - paragraph [ref=e354]: 作者控制曲線，非聲學量測。點表 x/y 為 0–1 正規化座標；首點 x=0、末點 x=1，x 嚴格遞增。每個輸出最多一條映射。
                - article "參數映射 mapping.impact-gain" [ref=e355]:
                  - generic [ref=e356]:
                    - code [ref=e357]: mapping.impact-gain
                    - button "移除映射" [ref=e358] [cursor=pointer]
                  - generic [ref=e359]:
                    - generic [ref=e360]:
                      - generic [ref=e361]: 輸入 metric · m/s
                      - combobox "映射輸入 metric" [ref=e362]:
                        - option "聲源速度 · m/s"
                        - option "角速度 · rad/s"
                        - option "法向衝量 · N·s"
                        - option "接近速度 · m/s" [selected]
                        - option "切向速度 · m/s"
                        - option "滑移速度 · m/s"
                        - option "接觸支撐力 · N"
                    - generic [ref=e363]:
                      - generic [ref=e364]: 輸出參數 · linear
                      - combobox "映射輸出參數" [ref=e365]:
                        - option "音量 · linear" [selected]
                        - option "音高 · semitones"
                        - option "濾波截止頻率 · Hz"
                  - generic [ref=e366]:
                    - generic [ref=e367]:
                      - generic [ref=e368]: 輸入下限 · m/s
                      - spinbutton "映射輸入下限" [ref=e369]: "0"
                    - generic [ref=e370]:
                      - generic [ref=e371]: 輸入上限 · m/s
                      - spinbutton "映射輸入上限" [ref=e372]: "10"
                  - generic [ref=e373]:
                    - generic [ref=e374]:
                      - generic [ref=e375]: 輸出下限 · linear
                      - spinbutton "映射輸出下限" [ref=e376]: "0.025"
                    - generic [ref=e377]:
                      - generic [ref=e378]: 輸出上限 · linear
                      - spinbutton "映射輸出上限" [ref=e379]: "0.25"
                  - generic [ref=e380]:
                    - generic [ref=e381]:
                      - generic [ref=e382]: 插值
                      - combobox "映射插值" [ref=e383]:
                        - option "Linear · 線性" [selected]
                        - option "Step · 階梯"
                    - generic [ref=e384]:
                      - generic [ref=e385]: 參數平滑 · s
                      - spinbutton "映射平滑時間 s" [ref=e386]: "0.015"
                  - paragraph [ref=e387]: Clamp 固定啟用。平滑是發聲參數，不改變物理結果或聲音傳播時間。觸發條件可用的 metric 仍由套用時驗證；缺值不冒充 0。
                  - img "作者參數映射曲線；非聲學量測或聲線。線性插值。" [ref=e388]:
                    - generic "1：輸入 0 m/s → 輸出 0.025 linear" [ref=e391]
                    - generic "2：輸入 10 m/s → 輸出 0.25 linear" [ref=e392]
                  - paragraph [ref=e393]:
                    - status "曲線中點預覽" [ref=e394]: 5 m/s → 0.1375 linear
                    - text: （曲線中點預覽，未經平滑／非模擬結果）
                  - paragraph [ref=e395]: 輸入：接近速度 0–10 m/s；輸出：音量 0.025–0.25 linear。
                  - table [ref=e396]:
                    - caption [ref=e397]: 曲線控制點 · x/y 正規化 [0, 1]
                    - rowgroup [ref=e398]:
                      - row [ref=e399]:
                        - columnheader "點" [ref=e400]
                        - columnheader "x" [ref=e401]
                        - columnheader "y" [ref=e402]
                        - columnheader "操作" [ref=e403]
                    - rowgroup [ref=e404]:
                      - row [ref=e405]:
                        - rowheader "1" [ref=e406]
                        - cell [ref=e407]:
                          - spinbutton "曲線點 1 x" [ref=e408]: "0"
                        - cell [ref=e409]:
                          - spinbutton "曲線點 1 y" [ref=e410]: "0"
                        - cell [ref=e411]:
                          - button "移除曲線點 1" [disabled] [ref=e412]: 移除
                      - row [ref=e413]:
                        - rowheader "2" [ref=e414]
                        - cell [ref=e415]:
                          - spinbutton "曲線點 2 x" [ref=e416]: "1"
                        - cell [ref=e417]:
                          - spinbutton "曲線點 2 y" [ref=e418]: "1"
                        - cell [ref=e419]:
                          - button "移除曲線點 2" [disabled] [ref=e420]: 移除
                  - button "新增曲線點" [ref=e421] [cursor=pointer]
                - button "新增參數映射" [ref=e422] [cursor=pointer]
                - paragraph [ref=e423]: 1/8 條映射；輸出參數不得重複。所有變更先保留為草稿。
            - region "此物件覆寫 rule.impact" [ref=e424]:
              - group [ref=e425]:
                - generic "此物件覆寫 繼承" [ref=e426]:
                  - text: 此物件覆寫
                  - generic [ref=e427]: 繼承
          - generic [ref=e428]:
            - article "聲音行為 rule.grab" [ref=e429]:
              - generic [ref=e430]:
                - generic [ref=e431]:
                  - checkbox "抓取時" [checked] [ref=e432]
                  - strong [ref=e433]: 抓取時
                - button "刪除 rule.grab 行為" [ref=e434] [cursor=pointer]
              - generic [ref=e437]:
                - code [ref=e438]: rule.grab
                - generic [ref=e439]: 等待觸發
              - button "場景聲學預聽" [ref=e441] [cursor=pointer]
              - generic [ref=e444]:
                - generic [ref=e445]: 觸發條件
                - combobox "觸發條件" [ref=e446]:
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
              - generic [ref=e447]:
                - generic [ref=e448]: 聲音素材
                - combobox "聲音素材" [ref=e449]:
                  - option "程序音 · Oscillator" [selected]
                  - option "source-original.wav"
              - generic [ref=e450]:
                - generic [ref=e451]:
                  - generic [ref=e452]:
                    - text: 音量
                    - generic [ref=e453]: linear
                  - spinbutton "音量 linear" [ref=e454]: "0.06309573444801933"
                - generic [ref=e455]:
                  - generic [ref=e456]:
                    - text: 音高
                    - generic [ref=e457]: semitones
                  - spinbutton "音高 semitones" [ref=e458]: "0"
              - generic [ref=e459]:
                - generic [ref=e460]:
                  - generic [ref=e461]:
                    - text: 冷卻時間
                    - generic [ref=e462]: s
                  - spinbutton "冷卻時間 s" [ref=e463]: "0.08"
                - paragraph [ref=e464]: 控制曲線可在下方逐點編輯；不改變物理與傳播模型。
              - region "參數映射曲線編輯器" [ref=e465]:
                - paragraph [ref=e466]: 作者控制曲線，非聲學量測。點表 x/y 為 0–1 正規化座標；首點 x=0、末點 x=1，x 嚴格遞增。每個輸出最多一條映射。
                - button "新增參數映射" [ref=e467] [cursor=pointer]
                - paragraph [ref=e468]: 0/8 條映射；輸出參數不得重複。所有變更先保留為草稿。
            - region "此物件覆寫 rule.grab" [ref=e469]:
              - group [ref=e470]:
                - generic "此物件覆寫 繼承" [ref=e471]:
                  - text: 此物件覆寫
                  - generic [ref=e472]: 繼承
          - generic [ref=e473]:
            - article "聲音行為 rule.throw" [ref=e474]:
              - generic [ref=e475]:
                - generic [ref=e476]:
                  - checkbox "投擲時" [checked] [ref=e477]
                  - strong [ref=e478]: 投擲時
                - button "刪除 rule.throw 行為" [ref=e479] [cursor=pointer]
              - generic [ref=e482]:
                - code [ref=e483]: rule.throw
                - generic [ref=e484]: 等待觸發
              - button "場景聲學預聽" [ref=e486] [cursor=pointer]
              - generic [ref=e489]:
                - generic [ref=e490]: 觸發條件
                - combobox "觸發條件" [ref=e491]:
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
              - generic [ref=e492]:
                - generic [ref=e493]: 聲音素材
                - combobox "聲音素材" [ref=e494]:
                  - option "程序音 · Oscillator" [selected]
                  - option "source-original.wav"
              - generic [ref=e495]:
                - generic [ref=e496]:
                  - generic [ref=e497]:
                    - text: 音量
                    - generic [ref=e498]: linear
                  - spinbutton "音量 linear" [ref=e499]: "0.06309573444801933"
                - generic [ref=e500]:
                  - generic [ref=e501]:
                    - text: 音高
                    - generic [ref=e502]: semitones
                  - spinbutton "音高 semitones" [ref=e503]: "0"
              - generic [ref=e504]:
                - generic [ref=e505]:
                  - generic [ref=e506]:
                    - text: 冷卻時間
                    - generic [ref=e507]: s
                  - spinbutton "冷卻時間 s" [ref=e508]: "0.08"
                - paragraph [ref=e509]: 控制曲線可在下方逐點編輯；不改變物理與傳播模型。
              - region "參數映射曲線編輯器" [ref=e510]:
                - paragraph [ref=e511]: 作者控制曲線，非聲學量測。點表 x/y 為 0–1 正規化座標；首點 x=0、末點 x=1，x 嚴格遞增。每個輸出最多一條映射。
                - button "新增參數映射" [ref=e512] [cursor=pointer]
                - paragraph [ref=e513]: 0/8 條映射；輸出參數不得重複。所有變更先保留為草稿。
            - region "此物件覆寫 rule.throw" [ref=e514]:
              - group [ref=e515]:
                - generic "此物件覆寫 繼承" [ref=e516]:
                  - text: 此物件覆寫
                  - generic [ref=e517]: 繼承
          - generic [ref=e518]:
            - generic [ref=e519]: 新增行為觸發條件
            - combobox "新增行為觸發條件" [ref=e520]:
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
            - button "新增" [ref=e521] [cursor=pointer]
          - group [ref=e524]:
            - generic "詳細資訊" [ref=e525] [cursor=pointer]
    - region "實驗與分析面板" [ref=e526]:
      - generic [ref=e527]:
        - tablist "實驗分析" [ref=e528]:
          - tab "事件與錄放 0" [selected] [ref=e529] [cursor=pointer]:
            - text: 事件與錄放
            - generic [ref=e530]: "0"
          - tab "聲學路徑 5" [ref=e531] [cursor=pointer]:
            - text: 聲學路徑
            - generic [ref=e532]: "5"
          - tab "實驗比較" [ref=e533] [cursor=pointer]
          - tab "Meta 實驗 Agent" [ref=e534] [cursor=pointer]
        - button "展開實驗面板" [ref=e535] [cursor=pointer]: ⌃
  - contentinfo "音訊監聽與後端狀態" [ref=e536]:
    - generic [ref=e537]:
      - button "啟用聆聽" [pressed] [ref=e538] [cursor=pointer]
      - generic [ref=e542]:
        - generic [ref=e543]: Monitor
        - slider "監聽音量" [ref=e544]: "0.18"
        - status [ref=e545]: 18%
    - group "監聽路由" [ref=e546]:
      - button "Simulated" [pressed] [ref=e547] [cursor=pointer]
      - button "Raw 參考" [ref=e548] [cursor=pointer]
    - status [ref=e549]: 聲學更新中
    - group [ref=e550]:
      - generic "監聽資訊" [ref=e551] [cursor=pointer]
    - group [ref=e552]:
      - generic "Synthetic late reverb" [ref=e553] [cursor=pointer]
```

# Test source

```ts
  988  |             info.outputPath("failure-recording.json"),
  989  |             JSON.stringify(partial.recording) + "\n",
  990  |           );
  991  |         await writeFile(info.outputPath("failure-project.json"), partial.project);
  992  |       }
  993  |     } catch (error) {
  994  |       failureSealError = String(error);
  995  |     } finally {
  996  |       if (sealTimer !== undefined) clearTimeout(sealTimer);
  997  |     }
  998  |     throw failure;
  999  |   } finally {
  1000 |     await writeFile(
  1001 |       info.outputPath("execution-diagnostics.json"),
  1002 |       JSON.stringify(
  1003 |         {
  1004 |           warmupEvidence,
  1005 |           captureStart,
  1006 |           explicitOverrunRecoveries: recoveries,
  1007 |           recoveryBudget: 8,
  1008 |           captureResetOrDroppedTicksAllowed: false,
  1009 |           failureSealError,
  1010 |         },
  1011 |         null,
  1012 |         2,
  1013 |       ) + "\n",
  1014 |     );
  1015 |     await writeFile(
  1016 |       info.outputPath("console.json"),
  1017 |       JSON.stringify({ consoleEntries, pageErrors, modelRequests }, null, 2) + "\n",
  1018 |     );
  1019 |   }
  1020 | }
  1021 | 
  1022 | for (let launch = 1; launch <= 3; launch++) {
  1023 |   test(`clean launch ${launch}: actual throw/impact/native audio/capture/acoustic B and durable reload/replay`, async ({
  1024 |     page,
  1025 |   }, info) => productChain(page, info, launch));
  1026 | }
  1027 | 
  1028 | test("a separate browser store rejects missing WAV bytes, then relinks the exact original without activating hardware", async ({
  1029 |   page,
  1030 |   browser,
  1031 | }, info) => {
  1032 |   const source = waveFixture();
  1033 |   const consoleEntries: { page: string; type: string; text: string }[] = [],
  1034 |     errors: string[] = [],
  1035 |     modelRequests: string[] = [];
  1036 |   const observe = (observed: Page, label: string) => {
  1037 |     observed.on("console", (message) =>
  1038 |       consoleEntries.push({ page: label, type: message.type(), text: message.text() }),
  1039 |     );
  1040 |     observed.on("pageerror", (error) => errors.push(`${label}: ${error.message}`));
  1041 |     observed.on("request", (request) => {
  1042 |       if (/\/api\/agent\/propose|https:\/\/api\.meta\.ai\//.test(request.url()))
  1043 |         modelRequests.push(`${label}: ${request.url()}`);
  1044 |     });
  1045 |   };
  1046 |   observe(page, "source");
  1047 |   await instrumentNativeGraph(page);
  1048 |   await open(page);
  1049 |   await page.locator(".import-details summary").click();
  1050 |   await page.getByRole("checkbox", { name: "我確認有權使用匯入的音檔", exact: true }).check();
  1051 |   await page
  1052 |     .locator(".scene-explorer input[type='file']")
  1053 |     .setInputFiles({ name: "source-original.wav", mimeType: "audio/wav", buffer: source });
  1054 |   await expect
  1055 |     .poll(() =>
  1056 |       page.evaluate(() =>
  1057 |         window
  1058 |           .__reflectionLab!.getSnapshot()
  1059 |           .assets.some((asset) => asset.name === "source-original.wav"),
  1060 |       ),
  1061 |     )
  1062 |     .toBe(true);
  1063 |   const assetId = await page.evaluate(
  1064 |     () =>
  1065 |       window
  1066 |         .__reflectionLab!.getSnapshot()
  1067 |         .assets.find((asset) => asset.name === "source-original.wav")!.id,
  1068 |   );
  1069 |   await command(page, {
  1070 |     type: "patchRule",
  1071 |     objectId: "speaker",
  1072 |     ruleId: "rule.always",
  1073 |     patch: { generator: "sample", assetId },
  1074 |   });
  1075 |   const project = await page.evaluate(() => window.__reflectionLab!.exportProject());
  1076 |   const other = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  1077 |   let targetTraceStarted = false;
  1078 |   try {
  1079 |     await other.tracing.start({
  1080 |       screenshots: !observerLight,
  1081 |       snapshots: !observerLight,
  1082 |       sources: true,
  1083 |     });
  1084 |     targetTraceStarted = true;
  1085 |     const target = await other.newPage();
  1086 |     observe(target, "target");
  1087 |     await instrumentNativeGraph(target);
> 1088 |     await target.goto("http://127.0.0.1:5190/");
       |                  ^ Error: page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:5190/
  1089 |     await expect.poll(() => target.evaluate(() => Boolean(window.__reflectionLab))).toBe(true);
  1090 |     const oldScene = await target.evaluate(() => window.__reflectionLab!.getSceneDocument());
  1091 |     const rejected = await target.evaluate(async (text) => {
  1092 |       await window.__reflectionLab!.dispatch({ type: "importProject", text });
  1093 |       return window.__reflectionLab!.getSnapshot().error;
  1094 |     }, project);
  1095 |     expect(rejected).toMatch(/ASSET_REQUIRED_MISSING|original WAV/);
  1096 |     expect(await target.evaluate(() => window.__reflectionLab!.getSceneDocument())).toEqual(
  1097 |       oldScene,
  1098 |     );
  1099 |     expect((await collectGraph(target)).contextCount).toBe(0);
  1100 |     await target.locator(".import-details summary").click();
  1101 |     await target.getByRole("checkbox", { name: "我確認有權使用匯入的音檔", exact: true }).check();
  1102 |     const wrong = Buffer.from(source);
  1103 |     wrong.writeInt16LE(1234, wrong.length - 2);
  1104 |     await target
  1105 |       .locator(".scene-explorer input[type='file']")
  1106 |       .setInputFiles({ name: "wrong.wav", mimeType: "audio/wav", buffer: wrong });
  1107 |     await expect
  1108 |       .poll(() => target.evaluate(() => window.__reflectionLab!.getSnapshot().error))
  1109 |       .toMatch(/ASSET_RELINK_MISMATCH|does not match any external asset SHA/);
  1110 |     expect(await target.evaluate(() => window.__reflectionLab!.getSnapshot().assets)).toEqual([]);
  1111 |     await target
  1112 |       .locator(".scene-explorer input[type='file']")
  1113 |       .setInputFiles({ name: "renamed-exact-original.wav", mimeType: "audio/wav", buffer: source });
  1114 |     await expect
  1115 |       .poll(() => target.evaluate(() => window.__reflectionLab!.getSnapshot().notice))
  1116 |       .toMatch(/再次套用/);
  1117 |     expect(await target.evaluate(() => window.__reflectionLab!.getSnapshot().assets)).toEqual([]);
  1118 |     await command(target, { type: "importProject", text: project });
  1119 |     const loaded = await target.evaluate(() => ({
  1120 |       project: JSON.parse(window.__reflectionLab!.exportProject()),
  1121 |       view: window.__reflectionLab!.getSnapshot(),
  1122 |     }));
  1123 |     expect(
  1124 |       loaded.project.assets.find((asset: { assetId: string }) => asset.assetId === assetId).sha256,
  1125 |     ).toBe(sha256(source));
  1126 |     expect(loaded.view.assets.filter((asset) => asset.id === assetId)).toHaveLength(1);
  1127 |     expect(loaded.view.assets.find((asset) => asset.id === assetId)?.status).toBe("ready");
  1128 |     expect(loaded.view.recording.canReplay).toBe(false);
  1129 |     expect((await collectGraph(target)).contextCount).toBe(0);
  1130 |     expect(errors).toEqual([]);
  1131 |     expect(consoleEntries.filter((entry) => entry.type === "error")).toEqual([]);
  1132 |     expect(modelRequests).toEqual([]);
  1133 |     await writeFile(
  1134 |       info.outputPath("evidence.json"),
  1135 |       JSON.stringify(
  1136 |         {
  1137 |           originalWavHash: sha256(source),
  1138 |           assetId,
  1139 |           separateBrowserContext: true,
  1140 |           initialRejection: rejected,
  1141 |           nativeHardwareContextCount: 0,
  1142 |           restoredReady: true,
  1143 |           pageErrors: errors,
  1144 |           consoleEntries,
  1145 |           modelRequests,
  1146 |           note: "Actual product import and native OfflineAudioContext/IndexedDB; raw recordings are not synthesized from metadata.",
  1147 |         },
  1148 |         null,
  1149 |         2,
  1150 |       ) + "\n",
  1151 |     );
  1152 |   } finally {
  1153 |     try {
  1154 |       await writeFile(
  1155 |         info.outputPath("console.json"),
  1156 |         JSON.stringify({ consoleEntries, pageErrors: errors, modelRequests }, null, 2) + "\n",
  1157 |       );
  1158 |       if (targetTraceStarted)
  1159 |         await other.tracing.stop({ path: info.outputPath("relink-target-source.trace.zip") });
  1160 |     } finally {
  1161 |       await other.close();
  1162 |     }
  1163 |   }
  1164 | });
  1165 | 
```