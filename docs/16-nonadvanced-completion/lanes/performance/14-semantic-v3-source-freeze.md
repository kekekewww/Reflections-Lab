# Semantic V3 來源固定準備

狀態：SOURCE_FROZEN_FRESH_BROWSER_NOT_RUN。Root批准最小一次post-begin真task方案；來源審查無剩餘P1/P2。最終相同位元的新138組與原入口合計964／964項通過（exit0、TAP6860.5727ms），command與runner的CLI --plan均exit0、未啟browser。所有44個來源於最終驗證後再核SHA吻合。尚未執行V3真browser，不能把source或VM結果當資格通過。

原固定27來源逐項保持，原V2 SHA256仍df86db94c6654399851ec1e3a4a240bc5821aee8dfa0745180d404c8cdf23c9c。新runner固定44個來源：原27，加新版page/html/bootstrap/runner/command/test、官方producer與獨立review、方法ADR及本次原始失敗fixture。完整path與SHA見semantic-v3-source-freeze-receipt.json。沒有修改原native／numeric／stream／reference、原begin/end、50ms edge、原正式負載或門檻。

原attempt01的窗外B拒收與attempt02的51.870ms coverage拒收都已封存；本次修正不回填PASS。新bootstrap只是一個真timer、兩個獨立marks，沒有重複heartbeat／忙迴圈。實際Fire／mark、owner／frame／navigation、完整raw＋validated RunTask以及performance／native兩種clock必須對帳。journal、strict native、full native set、bootstrap capture、numeric complete五項須actual true。

真RED包括缺exports、缺新版頁面，以及兩個獨立審查找到的實際證據缺口：aux自報早但真native晚；普通mark回填timestamp而physical callTime仍在Fire。原始TAP不因檔名包含green就冒稱通過：semantic-bootstrap-v3-green-r1.tap實際是89/90、exit1（頁缺檔）；之後完整修正才138/138。source review與producer清冊見12／13報告，12初稿漏兩category的文書P2已於freeze前補齊完整五項並保存前後SHA，實際trace configuration沒有變更。

預備命令為：

    node tests/browser/performance-semantic-command-v3.mjs --executable-path 'C:\Program Files\Google\Chrome\Application\chrome.exe' --output 'artifacts/v1/perf-nonadvanced-20261103-semantic-03-v4-bootstrap'

只可在Root下一個明確hardware GO後執行。45秒操作＋8秒共用清理及2秒收據預留保持；55秒是owned-child watchdog觸發點，Windows另有有界停止／關閉確認，排程預留約65秒並等actualterminal。machineLeaseReleasable與pilotSucceeded分開；treeproof unknown／false不冒成已停止。

此頁只載四個靜態測試資源，沒有產品UI／AudioContext。V4 registry仍NOT_QUALIFIED且approved為空，正式資格NOT_APPROVED。20秒wiring、PCM、原600秒正式工作負載、Task0033預設levels的產品RAF／analyser成本、native-exclusive DSP、實際設備與hearing均未由本次source驗證。
