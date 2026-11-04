# S4 current source runbook

這是對Root快照 `b7ade6727f50bac4544dd8d933729b6a13880a14` 正常合併後的來源準備；後續Store／Runtimeopts整合、產品build、正式browser freeze及全22route GO仍由Root完成。沒有執行本文件的browser命令；249個mixed registry rows不等於249個唯一參數、獨立案例或已驗項目。

## Root final freeze commands

在最終整合樹，先確認產品與browser-test inputs均已commit、已建置production目錄與既有 `http://127.0.0.1:4173` bytes相同，並取得exclusive browser lease。runner本身不build、不啟server。以下名稱須全新；既有freeze/attempt不覆寫。

```text
node tests/browser/nonadvanced/run-s4-ui.mjs --lanes all

node tests/browser/nonadvanced/run-s4-ui.mjs --capture-freeze --freeze docs/16-nonadvanced-completion/lanes/ui/s4/freeze-s4-final-01.json --dist dist --lease root-s4-exclusive-01 --browser-executable "C:/Program Files/Google/Chrome/Application/chrome.exe" --browser-version "<Root實測完整version>"

node tests/browser/nonadvanced/run-s4-ui.mjs --execute --freeze docs/16-nonadvanced-completion/lanes/ui/s4/freeze-s4-final-01.json --attempt s4-final-01 --lease root-s4-exclusive-01 --lanes all --keep-going --lane-timeout-ms 1200000
```

第一條只列計畫，不連網或開browser；第二條只讀已建置檔案、source、executable與本機HTTP，不開browser。第三條才啟動22條串行路徑，每次只一個child，Playwright workers1。預設 `--lanes` 只有recovery，必須明示 `all` 才是完整22route。未加 `--keep-going` 會在第一個失敗停止；加入後仍保留失敗exit1，取消不能被keep-going抵銷。

freeze須重收所有實際tracked src/server/schemas/public/tests/browser、build inputs、canonical tokens、兩份原priority source-provenance正式文件、registry、immutable combined fixture與正式TopMonitor要求。舊準備receipt／plan的UNFROZEN sourceSnapshot及owner1c6固定pins仍是歷史，不能當新bundle freeze；Root新增preparation locale source也不能繼承舊38case的currentPASS。

## Existing route budgets and completion boundaries

所有route的外層child限時預設1200000ms（20分鐘）；可顯式指定1000..3600000ms，這裡不更改或縮短門檻。以下是原config的每test timeout，且保留原expect／numeric／fixture assertions；direct script沒有統一per-case hard limit。數量是top-level test或selected check的來源數，不是semantic family數。

| route | 來源case／selected check數 | 原per-test timeout |
| --- | ---: | --- |
| interaction-main | 18 | script；無per-case hard limit |
| interaction-completion | direct script | script；無per-case hard limit |
| interaction-priority | direct script | script；無per-case hard limit |
| scene-inspector | direct script | script；無per-case hard limit |
| scene-environment | direct script | script；無per-case hard limit |
| scene-curved | direct script | script；無per-case hard limit |
| behavior-rules | direct script | script；無per-case hard limit |
| behavior-assets | direct script | script；無per-case hard limit |
| audio-monitor | direct script | script；無per-case hard limit |
| audio-monitor-retest | direct script | script；無per-case hard limit |
| pipeline-agent | 3 | 150 s/test |
| pipeline-dock | 3 | 120 s/test |
| pipeline-events | 4 | 120 s/test |
| pipeline-motion | 7 | 120 s/test |
| pipeline-zones | 6 | 150 s/test |
| pipeline-render | 4 | 150 s/test |
| pipeline-tail | 1 | 240 s/test |
| pipeline-diagnostics | 1 | 150 s/test |
| pipeline-combined | 1 | 240 s/test |
| interaction-help | 1 | 180 s/test |
| recovery | 7 | 180 s/test；public60 case 300 s |
| top-monitor | 3 | 180 s/test |

recovery原test timeout總額可達23分鐘，與外層20分鐘是兩個不同界線；這不代表實際需要23分鐘，也不把外層限時冒稱保證全部test timeout各自用滿。公開60秒錄製至少需要其真實60秒tick取樣，後續完整離線render、逐檔下載與119MB bytes檢查另耗時間；本輪尚無實測wall duration可承諾。

完整executeall有23組HTTP核對（初preflight1＋每lane post22）；先capture freeze則總共24組。每組HTML15秒加每個unique JS/CSS asset30秒，序列進行。22×20分鐘＝7小時20分鐘僅是child預算加總；普通stop名目另約11秒／lane，Windows catch清理名目約16秒。Git、日誌開啟、檔案讀寫、staging、receipt與join沒有deadline，HTTPpre/post也不在childtimer內，**整輪目前沒有硬性wall上限**。Root須安排／監督總lease，不能由以上數字推算已實測速度或假稱有完整wall cap。

完成條件維持原每case斷言、raw狀態與外層真exit；每lane後重查source／exe與實際HTTP bytes。`current-results.json` 只將真raw/case/steps逐列join為待獨立審查，沒有suiteexit0→整批familyPASS。缺條件的hidden／unavailable／optional-port項目保持未觀測或相應unit/component層；Playwright不升格native／hearing／formal performance。

## Artifacts and constrained ports

每個fresh attempt保存於 `docs/16-nonadvanced-completion/lanes/ui/s4/attempts/<attempt>/`：root freeze/run receipt/current-results；每lane stdout/stderr/actual-exit、adapter-proof與獨立browser UUID guard；spec另有Playwright JSON、trace／screenshots。current cases另保存receipt、DOM截圖、真下載與獨立RIFF/hash/stem檢查。副本與大型暫存在本樹 `.cache/nonadvanced-s4/<attempt>/`；不改歷史legacy檔、不刪舊raw、不自動stage大型WAV。

本輪三個小port都有新真RED0/3→GREEN3/3：monitor-retest仍用原strictassert但收到完整 `/assets/index-*.js`；diagnostics只在副本更新declaredSource；Held路徑只把原Place lookup對位同一bounded gentlePlace的現行Gentle place名稱，G／disabled／outcome流程原樣。原數值容差、caps、fixtures與歷史檔案均未變；adapter的6個受影響preservation cases驗證20個legacy來源／斷言，結果6/6，沒有重跑整批舊38。

Root process ledger仍須核實實際browser descendants cleanup。process receipt的terminal只代表所屬Node退出；controlled cancellation已有純Node清理測試，不能把正常退出的terminal欄冒稱whole-tree absence。
