# Sound Behavior Research & Architecture Integration Plan

> 依使用者明確要求直接執行；以分檔研究、draft正負驗證與獨立審查完成，不建立大型正式產品。

**Goal:** 評估可編輯聲音行為的可行性，以可追溯事件、資料契約與共享傳播鏈接回既有系統，並改採Codex主導開發。

**Spec:** [使用者需求](../../00-project/SOUND_BEHAVIOR_REQUEST.md)。

**Architecture:** Physics／互動事件 → 正規化狀態與規則 → logical SoundInstance／SpatialEmitter → 既有Custom Acoustic Core → Web Audio renderer。發聲內容、剛體材質、傳播材質各自獨立；所有3D聲音受同一空間傳播契約。資料草案外接現有SceneSpec，不偷偷遷移正式schema。

**Tech Stack:** 現有Node／TypeScript／AJV與Rapier0.21.0隔離spike；React/R3F、WebAudio正式runtime尚未實作，不加新依賴。

## Constraints

- Codex為主要開發者；MuseCode optional，仍無可用額度，不派模型。Meta Model API保留產品AI地位，沒有live證據不宣稱完成。
- 物理事件不是聲學量測；creative samples不是自然振動。dBFS不是SPL，gravity0不是vacuum。
- 固定步、穩定ID、revisions、原子commands／undo；回放保存軌跡與正規化事件，不假設任意重模擬逐位元相同。
- audio callback不等AI／network／physics，傳播delay/HRTF/distance只算一次；性能預算唯一維護位置不變。
- 保留舊ADR／來源／gate；新版本supersedes。Wiki單一task權威與序列CLI寫入。不push／部署／接受條款。

## 分工與驗證

- [ ] Physics：官方＋已安裝API比對、完整事件定義／邊界、必要真WASM風險spike與獨立fixtures。
- [ ] Middleware：FMOD／MetaSounds／Wwise／SoundParticles原文、版本／web／license／access區別、可借鑑與不必重造部分。
- [ ] Contracts：12類型draft schema/TS、bounded declarative rules、asset refs與revision、正負驗證；AI工具維持獨立v1草案不改原12enum。
- [ ] UX／AI／rules：Inspector優先／Graph延後，canonical設計引用；Meta工具preview/domain/apply/undo與手動fallback；重查競賽官方規則未知項。
- [ ] Root：Codex-primary supersession ADR、聲音分層／聲學／排程／recording、安全與效能、MVP與stable task dependencies，建立下一正式Milestone。
- [ ] 整合：schema／spike／現有回歸實跑、獨立review修正；來源／Wiki／Task／checkpoint／handoff／Now同步，區分PASS／NOTRUN。

## Review Focus

1. Force(N)與impulse(Ns)、pre-solve速度與post-solve資料不能混用，持續接觸不能變impact storm。
2. OnThrow/Drop來源、rolling/sliding/contact/state邊界與held/mode/pause/replay需可追溯。
3. 同一sample被兩個表面profile重複觸發、同一聲源繞過／重複經過HRTF或距離／delay的路由要明確。
4. JSON合法不等於asset存在／權利完整／trigger參數可用；不同revision／runEpoch不能混用。
5. P0規劃不能在產品尚未實作與剩餘時間下承諾所有Graph／rolling／AI／聲學皆已可用。
