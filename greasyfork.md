**X 極簡**是我平常自用的 Tampermonkey 腳本。它支援 X 的新舊版面，設定介面採繁體中文。功能靈感來自 Minimal Theme for Twitter / X，並加入自訂背景、Liquid Glass、媒體下載與音量功能。

**這是個人自用專案。** 我會依使用需求和時間決定是否受理 issue、功能請求與 PR。回覆、修正和持續維護都沒有時程承諾。

### 可以調整什麼

- **版面與內容**　時間線寬度、置中、兩側欄獨立貼邊、導覽收合與懸浮展開。可隱藏廣告、推薦、訂閱卡、貼文計數與浮窗。
- **背景與材質**　選擇本機或 HTTPS 背景圖片，調整位置、壓暗、模糊與透明度。時間線和側欄／浮窗各自設定實色、毛玻璃或 WebGL Liquid Glass。折射無法使用時自動降級，另有手動輕量模式。
- **配色與操作**　透明時間線可自動調整文字與圖標的深淺，也能手動指定。發文與行內回覆的工具列跟著更新。磁吸游標預設關閉，支援文字游標和影片控制滑軌。
- **媒體下載**　從貼文操作列下載原圖或最高可用畫質的 MP4，依序存到瀏覽器下載目錄。紀錄成功下載的檔案，下次略過，按住 Shift 可重新下載；紀錄可逐筆移除或清空。X 更換網頁 API 時會改用公開的嵌入資料來源。
- **分享連結**　從貼文分享選單複製不含追蹤參數的 FixupX 連結，可關閉這個項目或隱藏原本的「複製連結」。
- **影片音量**　記住播放器音量，並可另外開啟本機音量平衡。滑桿保留低音量微調空間。
- **備份與跨裝置同步**　設定平常存在 Tampermonkey。可匯出／匯入 JSON，也可自行連接 Google Drive 或 WebDAV，同步外觀、背景、音量和下載紀錄。雲端同步預設關閉；其他裝置同步來的自訂 CSS 需要確認才會套用。

安裝後重新整理 X，點左側的「介面設定」，或從 Tampermonkey 選單選「X 極簡設定」。主要在 Vivaldi 與 Chromium 驗證。媒體下載使用 X 網頁 API 和 X CDN，需允許 Tampermonkey 的下載功能；備用來源為 `cdn.syndication.twimg.com`。

[GitHub 原始碼與完整功能說明](https://github.com/TW527E/X-Minimal) · [跨裝置同步設定](https://github.com/TW527E/X-Minimal/blob/main/x-minimal-sync-guide.md) · [MIT 授權與署名](https://github.com/TW527E/X-Minimal/blob/main/LICENSE)
