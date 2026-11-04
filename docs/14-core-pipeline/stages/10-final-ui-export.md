# Stage 10：b41cdeb 產品音檔與後續來源界線

日期：2026-11-02。此頁固定第二批真Browser DOM匯出的數位音檔；原[Stage09](09-integration-and-export.md)及第一次音檔完整保留，不覆寫原source或結果。

## 固定來源與實際檔案

第二批來源為 `b41cdeb0eac47d1b23e04fbda6a196049a9c66a5`，job `render-7d0bdb25-8a5d-44fe-9b13-ded5207513f9`。下載後的檔案位於 `D:/Developing/Meta Hack/exports/core-pipeline-20261102/final/`；當次 `source-bundle/index-CgrKG5Ax.js` 同時保留，SHA-256 `91145f8d501538d73954f6746c17dccd47865f3b71953beb4092f9cec8fa22bb`。

UI動作仍是正式產品擷取3秒／180ticks、產生、逐一下載mix／master／dry／ball stem／speaker stem及manifest。成功方法是Playwright MCP真DOM輸入；native Computer Use先前兩次appapproval timeout後停止，沒有native輸入成功。本頁不將fallback改標native PASS。

## 獨立 RIFF 檢查

[獨立收據](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/36e52efc07660c876e7d8c722e0904065ed65043)固定verifier SHA、Node22.17.0、source Git tree pins、bundle與下載/copy hashes；不以產品WAVE encoder自證。

- 5／5檔案為float32 stereo48kHz、240000frames＝5秒，涵蓋3秒take與2秒tail；每檔1920056 bytes，finite/nonzero，單位範圍外樣本0。
- 每檔與manifest、原下載與project copy hash均相符；兩個pre-master stems對mix最大誤差 `1.210719347000122e-8`，小於原 `2e-6` 容差。
- master與dry各自不同於mix；完整peak/RMS/首個非零frame與所有hash見JSON，這不是聲壓或硬體loopback測試。
- 收據的 `pinnedSourceExists=true` 與bundle `HASH_VERIFIED`支持b41cdeb截點；`sameProductSource=false`明示驗證當時工作區已有後續UI修改，不能把本批稱為之後main每個檔案都相同的fresh export。

目錄名final表示本次交付批次，不代替source驗證。後續Meta頻帶/grounding與Motion表單修補有各自source/基本測試；若要主張新bundle音檔，須另固定來源產生，不改寫本收據。

## 品質與目前未完成項目

Root更正第三輪完整check執行期為1328／1328 PASS；其他通過階段回報research669、agents82、prompts12、wiki54、design14、sound34、datasets18，以及build/license。各組總數／skip細節依原raw stdout，不將總數一概寫成無skip。完整命令最後因進行中的文件出現English missing2/stale5/errors16而exit1；後續English/Wiki需在最後文件固定後獨立重驗，不能把這次完整命令改寫為exit0。

真Meta UI閉環已另有[成功與拒絕收據](04-meta-ui-workflow-receipt.md)，保留空table首次FAIL、22單元與真production DOM1／1、七個source pins與index-CsQTPNJk bundle。它與本批音檔是不同source/bundle證據。

Root在Motion真UI點儲存時發現預設HTML step／pattern令表單invalid，正在局部修NumberField／Motion表單並新增基本browser案例；最後source尚未凍結。Main切換、完整交接與Claude獨立後驗證仍待其實際收據，不預填完成。

本頁只支持固定source的數位檔案與已記錄進度。原600秒性能FAIL、裝置聽測／聲學科學／Meta live／外部條件及預算0/fixture界線不變。
