# 歸因方法元件與資格入口：unit／source 截點

此頁只記本lane已執行的分項，不是PERF001／014或正式600秒通過。產品程式仍取自`e25f9f48302fd357b0f97a6f9bf8565f5916627c`；先前有限stage提交為`494d580d0865fd38bfcb5caa2a9896b225672ee3`。本輪後續提交由實際Git回報，不在檔案中預造自身SHA。

- 原fixture/window/performance方法回歸實跑280／280，exit0（`collector-original-regression-r1.tap`，17.333秒）。新六spec在`focused-127-green-r1.tap`實跑127／127、0skip、exit0（997.6805ms）；當時scoped lint為0errors／0warnings，兩個semantic `--plan`均exit0且未啟browser。這些不是native音訊或效能證據。其後新增PCM artifact oracle RED尚未執行，不冒127涵蓋該新批次。
- 保留所有RED：未知handler總成本、未保存診斷、off仍裝observer、off物理探針、off未觀測counter冒0、partial樣本被filter成PASS、缺semantic/PCM module、optional frame未驗值、MC／未知RAF evidence、inherited cancel、float WAV缺fact。第一次合測測試host缺probeMode的ReferenceError也保留；沒有刪原失敗或放寬原reader。
- `metric`保留原有效樣本quantile與嚴格threshold；新增requested/unobserved counts，部分缺樣本不能PASS，已量FAIL仍FAIL，全未量quantile／exceedance為null。off收尾counter／插值／native-start觀測用null；不以空列表導出零成本。
- 新semantic journal／native oracle各自固定52 operations、26 registrations、24 callbacks、13 groups、23 captured Requests和24 Fires；逐owned-document handle、parent Fire／window與custom startTime/callTime核對。原strict V3 parser、caps及數值kernel不改，廣告資格flag不能取代實驗。PC在trace前的cancel只以來源和operation journal佐證，不冒captured native cancel。
- 新static semantic頁用同task debugger gate建立真pretrace-pending，再以timer close避開最後Fire span。Node入口保served source實體bytes、前後獨立pins、共用10秒cleanup與明確restoration條件；外層沿既有owned-process helper限制55秒。此入口永遠標NOT_APPROVED，仍需真browser raw及獨立review；不自動換掉舊Chrome雙pin。
- Test-only PCM processor使用constructor固定pool與16個block-size欄位，actual input/output length，不假定128；完整frame window、finite／channel／gap／overlap／overflow／cancel有33項VM證據。補own-key與實際WAV encoder→原Stage12 reader後35／35通過；WAV已含float格式fact chunk，未動原Stage12 assertion。NaN只保NaN數值並標INVALID，不宣稱任意NaN payload逐bit相同。

## 同容量與待真實執行

`original-audio-budget.json`以未enable／未建立AudioContext的原AudioEngine getter讀得完整budget：active24、sources32、sourceFrames64、paths8／total96、decoded64MiB、asset120秒／2ch、pending256、assets64、decode2、lateSends16／lateIR4MiB；stress只改paths32／total256。這是configuration事實，不是device或performance。已與audio owner對帳：新graph48、carrier144（default）／304（stress）另欄，不能降低舊tails或提高active換PASS；新policy仍未採納。原formal exact8 content starts gate保留；新carrier若有native源需全計成本，不能藏掉。

目前新controlled PCM頁有7個有限case（steady、main stall、late onset、stale frame、path birth/death、voice/path pressure、intentional digital gap），用真solver／同AudioEngine post-master聲流、同on/off unity control及精確audio-frame終點；排程entry與同步operation成本分欄。source已review／lint，尚未build、真Worklet／PCM下載／process CPU或probe overhead皆NOT_RUN。另一獨立raw PCM oracle仍在RED準備；合法全零資料要保留真gap／peak0／rms0，原Stage12 nonzero gate對相同bytes的拒絕另存，不加impulse改成PASS。

下一硬體lease先保原V3 launcher拒絕→新55秒semantic pilot→真raw獨立review／有限qualification registry；再跑原20秒all wiring、controlled PCM on/off／獨立檔案解析、正式原600秒wall負載。wall／sim／capture分開，18000frames與bytes cap不變，窗外drain不回填。原R17及研究600秒FAIL、完整audio DSP CPU／device buffer／聽感未量、Claude與人工後續全部保留，不把本頁當完整V1完成。
