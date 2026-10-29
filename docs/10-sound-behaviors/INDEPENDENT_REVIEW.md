# Sound Behavior 獨立審查

審查日：2026-10-27（Asia/Taipei）。Reviewer：獨立 Codex subagent `sound_review`；實作者為其他分檔 agents。依 [codex-verification](../../.agents/skills/codex-verification/SKILL.md) 與 [Validation Policy](../09-agents/VALIDATION_POLICY.md) 進行。審查開始先讀 Wiki startup、Task0010、使用者原文與 ADR-013／014；本 reviewer 只新增此報告，沒有修改 implementation、tests、原始 benchmark 或 Wiki。

**結論：目前研究／draft contract／隔離 policy 範圍沒有待修 P1／P2。** 審查發現的問題已由各實作者修正，以下具體反例已重新核對。Root 的最終整合 gate、來源 manifest、Task/Wiki／checkpoint／handoff 尚待 root 完成，不能由本報告先行宣稱整體任務 DONE。

審查時實際 Git HEAD 為 `914cfc742e7e575a09272fba5738d20c3fd5e3b7`，工作目錄有本次未提交修改；本報告不是該 commit 已包含 Sound Behavior 的證明。Root 最後的來源／dirty hashes 與 gate artifact 應記錄交付版本。

## 已重現並修正的問題

下列皆為本地 draft 或隔離 spike 缺陷，不是已發行產品的故障。反例以 [document/context/runtime fixtures](../../schemas/sound-behavior/examples/) 為基底。

| ID／原優先級 | 原可重現反例 | 修正與獨立核對 |
| --- | --- | --- |
| SB-REV-01／P2 | binding override 將 `rule.always` 設 `enabled:false`，checkpoint 仍 active／playing 卻通過；binding master disabled 時 OnImpact start 也通過 | `effectiveEnabled` 統一使用 binding master 與 rule override／base flag；active、scheduled／playing、start／update 拒絕，stop／fading cleanup 可保留。原反例分別回 DISABLED_INSTANCE／INVALID_ACTIVE_RULE／DISABLED_EVENT |
| SB-REV-02／P2 | ordinary OnImpact 改成 oscillator，沒有 finite stop 仍被當 one-shot；latch deadlineTick=300，state.tick=301 仍 playing 也通過 | discrete oscillator 必須有 `oneShotDurationSeconds` 且 envelope 可容納；latched deadline 到達後只可 fading／stopped。無 duration 回 ONE_SHOT_DURATION_REQUIRED，0.1 秒合法例通過；過期 latch 回 LATCH_EXPIRED |
| SB-REV-03／P2 | 首輪修正後，material-pair override 將 sample 換成 oscillator，仍能繞過 rule base generator 的 duration 檢查 | 對每個 selected generator 套同一 finite-duration gate；原 override 回 ONE_SHOT_DURATION_REQUIRED，加 rule duration=0.1 秒通過；新增第21項 regression 已獨立執行 |
| SB-REV-04／P2 | 合法空 document 的 assets/profiles/bindings 均空；CreateProfile 使用 trusted catalog 已有 asset 卻因無 document pin 失敗，五種 proposal operations 也無法補 pin | 候選驗證只從 trusted catalog 精確 ID／revision／hash 衍生 `derivedAssetPins`；原例通過並回傳一筆 pin，輸入 document bytes 不變。未知／缺檔／未核權利仍拒絕；正式 Preview／inverse／原子 commit 仍待 host 實作 |
| SB-REV-05／P2 | contact.colliderA=`collider.invented` 仍被接受為 committed event geometry | trusted collider registry 檢查存在及 participant ownership；原例回 CONTACT_COLLIDER_IDENTITY。這只驗引用，不能證明輸入就是實際 Rapier contact |
| SB-REV-06／P2 | sphere 與 support 共用世界角速度，接觸 slip=0，原 classifier 卻判 ROLLING；它其實可在 support frame 完全靜止 | 顯式 support angular velocity，將 support 點速度換算至 sphere COM 並使用相對角速度。原共轉例改為 RESTING／slip0；未知 support angular state 回 UNCLASSIFIED |

SB-REV-06 的獨立解析輸入為 `vCOM=[0,1,0]`、`omegaBody=[0,0,1]`、`contactOffset=[0,-1,0]`、`vSupportAtContact=[1,1,0]`、`normal=[0,1,0]`、`omegaSupport=[0,0,1]`。兩物件共用剛體旋轉時相對 motion 為零；原 API 缺少 support angular state 而無法分辨。這個修正只作用於明示 Derived／Synthetic 的隔離球體候選，不表示任意 mesh rolling 已驗證。

另核對 physics 子審查修正：`maxGroups` 有 safe-integer／1–256 限制；OnBounce 必須有 parent impact 的有界時間窗及法向反向／分離證據，不能僅憑 ContactEnd。`WhileRolling` 文件已統一 contact anchor，沒有向作者提供 validator 會拒絕的 object anchor。

## 本 reviewer 實際執行與讀查

| 動作 | 實際結果與界線 |
| --- | --- |
| `node --test tests/sound-behaviors/contracts.test.mjs` | 首輪修正後獨立執行20/20 PASS、exit0；其後另找到並修正 SB-REV-03，不把這次20項輸出冒稱最終21項全跑 |
| `node --test --test-name-pattern='selected generator cannot bypass' tests/sound-behaviors/contracts.test.mjs` | 最終新增 regression 真正執行1/1 PASS、exit0；先前兩次未命中名稱的篩選不計入驗證證據 |
| `node --input-type=module -e ...` 直接呼叫 exported validators | 上表 enabled、duration、expired latch、collider、空 document asset proposal 的原反例與合法對照依次重驗，結果符合預期；沒有執行 evaluator 或播放音訊 |
| `node --input-type=module -e ...` 直接呼叫 `contactMotion` | 同一共轉案例為 RESTING／slip0，省略 support angular state 為 UNCLASSIFIED／slip0 |
| 讀 [作者最終 contracts raw output](../../tests/sound-behaviors/latest-test-output.txt) 與 [CLI fixtures](../../tests/sound-behaviors/latest-fixture-output.json) | 21/21、fail0；5組 draft fixture 均 PASS。這是讀查作者輸出，完整最終獨立 root gate 另記 |
| 讀 [physics final raw artifact](../../experiments/sound-behavior-spike/physics-validation-final-2026-10-27.json) 並重新計算 source hashes | exit0、13/13；policy source／policy test／WASM probe 的3個 SHA256 均與實檔吻合。不是 reviewer 重跑13項，也不是 audio 成功率 |
| schema trigger enum 與 Event Model 比對 | 7 continuous＋12 discrete，共19個唯一 ID，全數在事件文件出現 |
| `git diff --name-only -- tests benchmarks package-lock.json` | 既有 tracked tests／benchmark／lockfile 無本次變動；新增 sound tests 另列，不能把 untracked 新檔解讀為既有驗收被覆寫 |

本次 reviewer 沒有重跑整套舊 Harness／core／Wiki suites，避免與 root 最終 gate 重複。物理 artifact SHA256：`a7786170f8b7d19464bba698e3a0dbf122d18620f185891cef55a0d59be55296`；舊10項／中間結果保留為歷史，不當作目前程式的通過證據。

## 跨文件核對

- [ADR-013](../02-architecture/adr/013-codex-primary-development.md) 為 Codex 主導、Muse Code 選用；Muse 額度0仍不派送。舊 ADR／Phase3 artifacts 保留歷史；產品 Meta Model API 與 coding executor 分開，沒有以 Codex 開發冒充 Meta live。
- [Event Model](EVENT_MODEL.md)／[Bridge](PHYSICS_AUDIO_BRIDGE.md) 區分 force N、impulse N·s、geometric／solver index、world contact position、COM／point velocity與 pre-step estimate。Held／Moving／sleep／contact 正交；Throw／Drop 來自成功互動意圖；Airborne 不能替代「首次 Impact 後不再重啟」的 latch。
- [Architecture](SOUND_BEHAVIOR_ARCHITECTURE.md)／[Audio Runtime](../02-architecture/AUDIO_RUNTIME.md) 共用 SourceGraph，所有 positioned 3D emissions 經同一傳播鏈；距離、delay、Doppler與 HRTF 有單一責任。乾音 audition／Raw monitoring 有明示界線，不回填成完整空間聲學結果。
- [Schema](BEHAVIOR_SCHEMA.md)／[Meta tools](../08-ai/MUSE_SOUND_BEHAVIOR_INTEGRATION.md) 使用封閉 enum／bounded declarative JSON；拒絕任意 JavaScript、graph、URL／local paths、任意 patch與physics mutations。JSON shape、domain／registry、host capability／revision／budget分層，原 Scene v1／AI12enum 未冒稱擴充完成。
- [Record Replay](../07-experiments/RECORD_REPLAY.md)／[A/B](../07-experiments/AB_COMPARISON.md) 分原 physics/player trace 與 behavior decision trace。acoustic A/B 固定 source generation，behavior A/B 明示改變內容／mapping並固定 motion、raw inputs、listener、solver、medium與傳播材質；後者不要求兩版 voice decisions 相同，也不從鋼琴音色推 RT60。
- voice、active emitter、per-emitter／total paths、queue與decode memory分開有界；schema上限與 perceptual thresholds不是實測容量／自然常數。成熟工具比較保留 Wwise legacy／403、Sound Particles分版本與非執行證據限制。
- [Roadmap](../ROADMAP.md)／[M0](NEXT_AUDIO_MILESTONE.md) 用 stable Task0011–0015 表達前置：純 fixture domain runtime可與 Scene/Physics0006平行，audible vertical0012需要兩者；互動／rolling／latch與產品Meta依能力分切片，Graph／modal留P2。這些任務仍未啟動。

## 不能由本報告推論的項目

正式 Behavior evaluator、Audio Event Runtime、host Apply／Undo、完整 capture/replay、browser／Inspector、OfflineAudioContext、HRTF／click-pop／arrival continuity、裝置／耳機／效能與產品 Meta live **均 NOT RUN／未實作**。Draft checkpoint validator 不驗證退休 profile 的跨版本 voices；v1 authoring boundary／drain／new epoch 仍須由後續 host 明確落實，不承諾 seamless multiversion playback。

本 reviewer 沒有重查遠端競賽全文或接受條款；只核對本次來源 metadata 與文件的允許／未知界線。沒有呼叫 Muse／Meta API、下載音效、部署或 push。科學量測、實機聲音品質與完整競賽合規都不是本次通過範圍。
