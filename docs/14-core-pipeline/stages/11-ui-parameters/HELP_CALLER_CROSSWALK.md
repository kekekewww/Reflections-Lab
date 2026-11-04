# 說明提示逐來源覆蓋對照

靜態來源固定5010685，71個source caller ID與刷新前相同。68個一般公開UI可達caller均有至少一次明列狀態的非空內容；最後20個unique caller補內容或特定方法，來源為02／03／04的精確raw index，不冒稱一次全量clean run。共有0個可達內容／方法待join，另三個條件明確未觀測。

逐site的來源、description、方法、前提與原收據見 [HELP_CALLER_CROSSWALK.json](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/44b056f78b8e0bd39a09c29723d46991f5eee299)。共用hover／focus／Escape／touch契約不替代caller內容；71個靜態站點不是71個全部條件PASS。

## 三個未觀測條件

| Source site                                        | 條件與判定                                                                                                                                                                                                                              |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ui.analysisdock.eventdetails.helptip.d773ccb4d7    | 真Audio nativeRejection的Event evidence未自然出現；未捏造事件、刻意過載或注入模型。                                                                                                                                                     |
| ui.rulecard.rulecard.helptip.ff9b12f624            | 真Audio nativeRejection的Logical instance active未自然出現；與Computer Use工具存取gate不同。                                                                                                                                            |
| ui.analysisdock.comparisonpanel.helptip.c7bbe36cfd | 空comparison.status fallback。RecordingHost.getView預設與各分支、runtime fallback都提供非空status，現行公開產品Host不可達；source-only判定不冒browser PASS。見[source SHA及理由](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/317e9495b553e6e501176ca71efccf01157750c7)。 |

## 最後定向補測

[固定join收據](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/c8a794d2144d2b32e438ee23f02788e4e718956e)逐筆指回實際raw與SHA；02中斷／03 FAIL不改寫，04最後單案PASS／exit0。每個新caller皆有pointer及focus方法、非空description與Escape關閉；Dock切換改變layout後pointer tooltip不保持可見，只主張真toggle／description與隨後可見focus內容。Monitor routing另有修後真hover。

| Source site                                             | Topic                                               | raw attempt／index   |
| ------------------------------------------------------- | --------------------------------------------------- | -------------------- |
| ui.app.monitorstrip.helptip.54fc1d24fd                  | Raw reference                                       | final-5010685-02／1  |
| ui.app.monitorstrip.helptip.c34ecc040a                  | Monitor routing                                     | final-5010685-02／2  |
| ui.app.monitorstrip.helptip.d82512ba16                  | Synthetic late reverb                               | final-5010685-02／3  |
| ui.inspector.previewinspector.section.c24a9572be        | Independent preview                                 | final-5010685-02／4  |
| ui.rulecard.rulecard.helptip.2ae73974bc                 | triggerName(draft.trigger, t)                       | final-5010685-02／5  |
| ui.zonepanel.zonepanel.helptip.2a43c2d943               | copy.title                                          | final-5010685-02／6  |
| ui.zonepanel.zonepanel.helptip.cb7efbc36a               | copy.add                                            | final-5010685-02／7  |
| ui.rulecard.rulecard.helptip.e2595a7002                 | Event zone                                          | final-5010685-02／8  |
| ui.renderpanel.renderpanel.helptip.82fad18b0d           | zh ? "音訊匯出" : "Audio export"                    | final-5010685-02／9  |
| ui.analysisdock.analysisdock.helptip.3ce42f3ee5         | Expand experiment panel / Collapse experiment panel | final-5010685-03／1  |
| ui.analysisdock.pathspanel.helptip.1ea8a8a6a2           | Path provenance                                     | final-5010685-03／2  |
| ui.sceneexplorer.sceneexplorer.helptip.113da508b3       | Audition {name} dry                                 | final-5010685-03／7  |
| ui.rulecard.rulecard.helptip.1df7992c01                 | Enabled                                             | final-5010685-03／8  |
| ui.sceneexplorer.sceneexplorer.helptip.a9db4be1e2       | Scene objects                                       | final-5010685-03／9  |
| ui.analysisdock.comparisonpanel.helptip.cd13089abc      | Check and compare                                   | final-5010685-04／3  |
| ui.analysisdock.comparisonpanel.helptip.671266b267      | Comparison type                                     | final-5010685-04／4  |
| ui.performancepanel.performancepanel.helptip.a145ac10d1 | Late onsets / total onsets                          | final-5010685-04／6  |
| ui.performancepanel.performancepanel.helptip.94c33a39bc | Accepted / rejected audio frames                    | final-5010685-04／7  |
| ui.performancepanel.performancepanel.helptip.6cae4bebb9 | Native browser output                               | final-5010685-04／8  |
| ui.analysisdock.eventspanel.helptip.047429dda4          | ● Start recording                                   | final-5010685-04／13 |

最初62個content caller加6個新內容caller為68，不把16個原補測site全說成原本未測內容（其中10個只缺特定方法）。4個Render／Zone相關caller雖已有9fc內容，仍有本輪501補充。MotionPanel沒有HelpTip caller，記為不存在。

這些是Playwright CLI scripted DOM／headless Chrome證據；沒有新增native app／真人／聽測主張。不同source的既有內容與本次501方法分開保留。
