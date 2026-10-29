# 架構研究與公開快照範圍補充

2026-10-29，使用者明確回覆：「授權另建乾淨公開快照；保留全部本地歷史」。這是對[原需求](ARCHITECTURE_REVIEW_REQUEST.md)公開方式的後續授權，不是允許改寫、刪除或上傳被排除的原始歷史。

原完整 history 含禁止公開產物及三個 >100 MiB blobs，直接 full-history push 保持 BLOCKED。另建立無原祖先的公開分支，僅發布審查後原始碼、文件與真正小型收據／reference fixtures；全部本地分支、commits與證據保留。

公開快照仍需 manifest、秘密／權利／大小審查、適當驗證、remote／CI核對。不能偽造缺失 evidence、放寬 frozen tests、force push、覆蓋新遠端歷史或自行接受條款。來源不可公開時明示 local archive availability，原內部完整驗證不因此豁免。
