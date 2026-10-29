# 專案起始基準

盤點日：2026-10-26（Asia/Taipei）。工作目錄：`D:\Developing\Meta Hack`。

## 修改前觀察

`Get-ChildItem -Force` 與遞迴檔案列舉皆無輸出；`rg --files` 無檔案。`git status --short --branch` 與 `git log -1 --format=fuller` 均回報 `fatal: not a git repository`。此結論只涵蓋目前目錄，不代表其他磁碟、帳號或歷史聊天沒有相關資產。

| 項目 | 起始狀態 |
| --- | --- |
| Git 分支／Commit／Remote | 不存在，無法判讀歷史 |
| README／AGENTS／CLAUDE／Skills | 無；亦未找到 `D:\AGENTS.md`、`D:\Developing\AGENTS.md` |
| Source／Tests／Fixtures／Benchmarks | 無 |
| PDF／Markdown／CSV／JSON／Lockfile | 無 |
| 未提交修改 | 無 Git，不能套用 Git 狀態分類；原目錄為空 |

## 環境觀察

初始命令實測 Windows build `10.0.26200`、x64、PowerShell 7.6.5、Node v22.17.0、npm 11.4.2、Python 3.12.11、CMake 4.3.1、Git 2.49.0.windows.1。`rustc`、`cargo`、`clang`、`cl` 初始不在 PATH，這不證明機器完全未安裝；SDK spike 會另檢查可用編譯器。CIM CPU 查詢被環境拒絕，後續改以 Node `os` 唯讀取得；詳見環境結果檔。

## 本次範圍

使用者要求研究、SDK、工程準備及隔離可行性驗證，暫不大規模實作產品。所有 bootstrap 新增檔案均屬本次工作，不能追溯宣稱為競賽前既有成果。競賽正式規則與開始時間若未確定，維持研究／spike 範圍。

需求原文保存在 [MASTER_REQUEST.md](MASTER_REQUEST.md)。後續決策優先順序：最新使用者需求 → 已採納 ADR → 實測實作證據 → 歷史草稿 → 尚未採納研究。Git 初始化不等於有來源作者、上游授權或競賽資格證明。
