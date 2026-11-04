# Stage 12：最新整合版本的實際音檔與獨立校驗

日期：2026-11-02（台灣時間）。產品來源固定為 `5010685ebfd6bb482aa37e1d82e5f64418b55d9b`，production entry `index-Nm7oRfzL.js`、SHA-256 `baf2542885944b5becf2138fa40e13831d04a1ce7dc1b9f03d3a845d6731706a`。這是新批次；[Stage09](09-integration-and-export.md)／[Stage10](10-final-ui-export.md)及其來源、結果保持原樣。

## 實際操作與檔案來源

[固定真UI收據](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/279a3bceb606308c1da386fa7b2eeee93117a258)記錄 Playwright CLI scripted DOM／headless Chrome 156.0.8078.75：移動物件、Zone enter／exit、非線性 mapping 與動態反射進入180個連續固定tick（19..198）的3秒錄製，再以產品真 OfflineAudioContext 產生並逐一下載5個WAV及manifest。UI動作與組合管線主張來自這份外部收據，獨立RIFF parser不冒充另一輪UI操作。

新job為 `render-37c82ed6-7aaf-4b4a-9537-a718b75b46ab`。實際檔案位於 `D:/Developing/Meta Hack/exports/core-pipeline-20261102/integrated-final/render-37c82ed6-7aaf-4b4a-9537-a718b75b46ab/`；[原下載索引](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/4548b0430029bafc040bba0701d43c4cc1985308)固定原始下載路徑、建議檔名、copy路徑、bytes及SHA。原下載檔案含label前綴，parser依索引核對，不重命名或更改音訊內容。WAV留在上述實體目錄，並非全部放入Git。

## 獨立位元組結果

[新獨立收據](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/fd0e82716a062ccf7d6eb9e68742ae21806f2d64)為PASS／exit0：無產品decoder匯入，逐項解析RIFF／fmt／fact／data、clock有理數frame數、finite／nonzero PCM、manifest及原下載hash。5檔皆為float32 stereo、48kHz、240000frames＝5秒（3秒take＋2秒tail），各1920056 bytes。兩個stem與mix最大逐sample誤差 `1.1420343071222305e-6`，維持原 `2e-6` 門檻。

| 輸出 | 獨立peak | 超過±1的樣本 |
| --- | ---: | ---: |
| mix | 6.864605903625488 | 1708 |
| master | 0.00924539566040039 | 0 |
| dry | 2.058187246322632 | 117174 |
| ball stem | 6.862547874450684 | 1704 |
| speaker stem | 0.051398251205682755 | 0 |

所有peak／超界數均精確符合manifest，float32輸出轉換clippedSampleCount均為0。既有[Stage06語義](06-render.md)明定mix／stems為pre-master、dry為原內容，IEEE浮點可超過±1且不隱藏normalize／clip。配置為outputSafetyClip=true的master另要求0超界；本批headroomGain=0.5、monitorGain=0.01、limiterEnabled=true，不能把raw浮點幅值當校準SPL或聽感。

## 舊錯oracle與修正驗證

先前parser對所有輸出要求±1，因而拒絕本批合法pre-master；[原RED](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/e1ad98552d9998ddb160c480c2c5a835eceef4ac)與exit1 raw完整保留。只修測試工具：pre-master改為獨立量測並精確核manifest，安全master仍有範圍斷言；產品、音檔、stem-sum容差均未改動。

[工具回歸](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/427777caf466940f063214d2a1a96a236728cfea)7項通過：合法pre-master正控制、outside-count／peak／clipping竄改拒絕、安全master超界拒絕、相同manifest aliases可用／相異aliases拒絕。這些是複製bytes及明確合成metadata的工具測試，不新增產品UI主張。另[重新讀舊hyphen manifest](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/9f8773c757ce5b0c646ad2a0cf7dd134ea4ffc44)PASS，沒有重寫舊09／10收據。syntax／ESLint／Prettier均exit0，原命令及固定hash見[證據清單](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/00922504eaf04c6f0ddb33ee9efcdc1d5e07b36d)。

## 限制與接手

5檔均明示historyIncomplete=true：錄製前的native DSP因果歷史不足，不能宣稱完整preroll；tailTruncated=false照實記錄。native HRTF仍browserManagedUnspecified。原生Computer Use存取逾時且無native輸入成功；本批真DOM／數位產物PASS不改寫原生方法gate。沒有真人聽測、硬體loopback、校準SPL、Meta live或600秒效能PASS。

Claude Code可依新收據reproduction陣列重跑獨立parser、核對真UI與來源bundle，再獨立驗證新增功能與音檔；人工測試在Claude後續調整完成後進行。
