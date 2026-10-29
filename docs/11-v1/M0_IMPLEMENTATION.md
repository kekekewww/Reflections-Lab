# M0 Audio Event Runtime 已實作

2026-10-27，Task0011 DONE；這只是第一版中的已驗收領域層，不代表整個產品、瀏覽器、DSP或Meta live完成。

- `src/audio-behavior/`：正規化事件排序／去重、正交continuous與one-shot、contact/object emitter、有界latch與mapping、voice admission、snapshot／epoch與重播。
- `src/app/behavior-editor.ts`：候選驗證、有效overrides、單物件共享profile分離、revision／generation／資產pins與安全作者操作。
- 原驗收條件保留；[正式驗證](../../artifacts/v1/m0-validation-20261027.json) 實際執行40項domain＋20項作者測試，60/60 PASS，61份保護檔案hash保持。
- [獨立domain原始結果](../../artifacts/v1/m0-independent-domain-review.json) 包含完整stdout、exit及8份固定source/test hashes；與本次來源另行核對。作者UI投影的binding overrides問題由root整合修正，不能以domain測試推成UI驗收。

可重跑：

```powershell
node --import tsx --test tests/audio-behavior/runtime.test.ts tests/app/behavior-editor.test.ts
```

Task0006、0012–0014及第一版整體Task0016仍依其各自原驗收推進。真Audio／browser、來源phase／完整replay、裝置性能／聽測與產品Meta live各留直接證據，不沿用M0的PASS。
