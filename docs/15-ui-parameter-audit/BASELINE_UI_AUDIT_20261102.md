# 既有產品UI審核：19db固定批次與尚未通過項目

日期：2026-11-02。這是五lane中的已凍結部分，服務來源為19db9f9／index-BDGeI4Sd；操作時Git HEAD另有f6／5360等未serve修補。不能將工作區HEAD當成瀏覽器已載入的bytes，也不能把此批平移為新增Zone、曲面／動態反射、環境持久化或最後main的PASS。

## 已讀原始收據的有限結果

| 固定範圍 | 結果與來源 | 正確解讀 |
| --- | --- | --- |
| 聲音行為／mapping／binding | [核心報告](../14-core-pipeline/stages/11-ui-parameters/behavior/REPORT.md)及三個raw receipt的PASS case ID聯集為44 | 32個初PASS＋續驗8＋容量/help4；17種既有trigger切換Apply、16點curve上限等。不是逐一真執行全部producer，也不含新Zone |
| 素材匯入／預聽／還原 | [素材報告](../14-core-pipeline/stages/11-ui-parameters/behavior/assets/REPORT.md)及兩個raw receipt聯集為13 | 五種原創WAV格式、拒絕非法檔、權利gate、ready/JSON保存等；真browser filechooser而非Windows原生dialog或真人聽測 |
| 行為與素材crosswalk | [PARAMETER_INVENTORY](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/d64bed93f0a7659275e7a9c1bda9670219f3dc19)為57不同case／44語意family | 有限矩陣，不是全產品分母或任意數值組合窮舉；核心與素材數不再和family數相加 |
| Inspector | [29組總合](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/3322de870ebbb65eccbbe8886c3bac06ad8e5b84)：27個操作功能PASS、1舊版EXPECTED_UNSUPPORTED、1確認產品FAIL | 舊曲面disabled不算能力PASS；角色選項的選取/保存不證明真DynamicReflector反射，仍依Task0030實作重驗 |
| 效能面板 | [報告](../14-core-pipeline/stages/11-ui-parameters/pipeline/render-performance/diagnostics/REPORT.md)：真browser1/1、exit0，28盤點項 | 6互動控制＋19唯讀指標＋2狀態＋1不存在refresh；不是28個可編輯參數。NOT_OBSERVED→WARMUP→AVAILABLE實見，UNSUPPORTED/COUNTER_RESET未發生 |

以上不同計數單位不加成一個總PASS或覆蓋百分比；中央完整inventory與其他lane尚待對帳。

## 保留原FAIL與修補界線

- 行為初輪32PASS/4定位FAIL及導覽負載中斷保留；續驗只處理未完成與錯誤定位。素材初輪9PASS/4測試比較器/讀取順序/前置FAIL保留，補正測試後4個不同案例PASS；沒有因此改產品或Host驗證。
- Inspector初輪三FAIL中，兩個spinner觀測時序在原資料匯出正確後，另批filtered重驗通過；該批其他27列仍NOT_RUN_FILTERED，未冒充整輪重跑。
- 環境保存為真產品FAIL：[短probe](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/69a4b4305ec822ca484333b1e3c9786e97de4229)從UI設定vacuum/35.5°C後，Save→reload→Load回air/20°C，匯出Project亦缺環境欄位。Task0031修正式Project，待新source真DOM重驗，不能被舊27PASS遮蔽。
- 新使用者已要求實作未支援選項。原曲面/Zone disabled批次保留原狀，Task0029/0030完成後須新收據；不能將EXPECTED_UNSUPPORTED視作本輪最終完成。

## 獨立記憶對帳與來源強度

Memory writer讀取原raw結果並保存[對帳JSON](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/c86fa75c1d2dafbc58307a2bfaa58e8d635c7199)：112個固定證據項的bytes/sha256全部吻合；raw PASS case ID聯集確為核心44與素材13。這是讀取與雜湊核對，不是新的browser執行。未將之擴大為所有ignored traces、所有程式檔或全產品正確性。

三個owner已確認本批凍結，後續使用新批或保留preimage。行為trace只固定JS網路檔名/HTTP狀態，未保留JS response body，不能捏造其body hash；效能收據則保留實際HTTP資產bytes hash。各檔方法與來源強度分開，不把相同檔名自動當作同bytes證據。

正常100%與Chrome156.0.8078.75的production DOM pointer/keyboard範圍保留；native CUA、真人聽感、校準SPL、硬體、聲學科學、完整600秒性能及Meta live皆不由本批判定。預算0、無新付費／部署／push；Task0028/Main/Claude後驗證與最後English仍未完成。
