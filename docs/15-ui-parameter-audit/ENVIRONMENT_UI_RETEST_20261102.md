# 環境保存修復：a10真UI另批重驗

日期：2026-11-02。Task0031的環境保存／載入缺陷已在固定source `a10b7419908ecd88fd26d96dc354ca5659796986`、`index-BmjZ1Zyf.js`、Chrome156.0.8078.75取得4／4真production DOM PASS。原19db的vacuum35.5→air20 FAIL及59360da分支Node/build報告保留原bytes，不改寫舊結果。這不是全產品／最後main驗收。

## 直接證據

[原始summary](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/8a26db2657cf5059a182fe3ff6eb05f61bfab979)固定操作、時間、前後環境、實際HTTP資產bytes/hash與下載檔；[evidence manifest](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/a08a483d05a3589efeb5587e77f1f34a64922751)保留19檔及初始觀察。實際流程透過產品DOM、Save／Export／Load及fresh browser context的file Import，沒有runtime/test bridge。

| 實際操作 | 固定結果 |
| --- | --- |
| 設35.5°C、切vacuum，Save並真Export | Project.atmosphere為vacuum／35.5，保存作者聲速與七個頻帶值 |
| 重載頁面後Load saved project | UI仍vacuum／35.5，第二份真Export確認 |
| fresh context由實際檔案Import同一份Export | UI與真Export仍vacuum／35.5 |
| 匯入只移除optional atmosphere的舊檔fixture | exact air／343m/s／20°C／七bands0／Synthetic，沒有前專案vacuum洩漏 |

page/consoleErrors皆0；owner回報程序exit0且已關閉Chrome/釋放lease，原raw stdout保留4項PASS。Memorywriter獨立比對19個證據bytes/SHA全符，並直接解析三個vacuum真Export與legacy真Export核對實際欄位，見[對帳JSON](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/ca3b6f9e502ebf9b820fc223128e1c4008f8ec86)；此為讀取核對，不是另跑一次browser。

## 原FAIL、其他觀察與界線

- [19db環境短probe](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/69a4b4305ec822ca484333b1e3c9786e97de4229)的真保存FAIL保留；[component報告](environment/REPORT.md)保存RED2/8→GREEN11/11與相關51/51（包含11）及build/type/lint/format。原資料與新批各自判定。
- 最初快速溫度Enter後立刻切medium被明示TRANSACTION_BUSY拒絕；另有Save通知被既有pauseReason遮蔽，初runner等待通知而在驗保存值前失敗。這兩批原runner/JSON/stdout/截圖都在manifest，不改作資料保存回歸；Save回饋UX與快速交易策略仍由root在Task0028獨立追蹤，不隱藏觀察。
- 普通Scene Undo依正式參數契約不復原環境；Node專項已驗證該政策、非法命令/匯入原子保留、缺素材/disposing拒絕及record/replay固定環境來源。這不是新增atmosphere Undo。
- 本批只重驗環境，不把舊27個Inspector功能、新曲面／動態反射或Zone標成a10 PASS。後續source改動須另依影響範圍補證據。
- Task0031前四項資料/驗證/真UI/recording語義有直接證據；最終inventory/crosswalk與英文/Claude整合仍待，Task0031與Task0028/Main不先結案。原native／裝置聽感／科學／600秒性能／Meta live及預算0界線不變。
