# Steam Audio 本機快取

固定版本與官方來源見 `manifest.json`；研究與授權見 `docs/03-sdk/`。

```powershell
./scripts/setup/steam-audio.ps1 -Download -Extract
./experiments/sdk-smoke-tests/run.ps1
```

`cache/` 儲存官方 ZIP、SDK headers、原生／WASM library 與隨附文件，僅供本機隔離驗證，不提交 Git。下載須通過 pinned SHA-256 比對後才使用。官方 release 的主程式碼授權為 Apache-2.0，但其 binary 仍有個別第三方條款；實際 notices 參閱 cache 內 `steamaudio/THIRDPARTY.md`，勿宣稱整包 Apache-only。
