# X 極簡跨裝置同步

適用於 X 極簡 1.10.0 以上。先更新原有的 [Tampermonkey 腳本](x-minimal.user.js)。

在「介面設定 → 跨裝置同步」選 Google Drive 或 WebDAV，設定連線後按「立即同步」。需要自動同步時，再開啟開關。有可見的 X 分頁時，會在開頁、設定或下載紀錄變更後與每分鐘同步。每部裝置選擇同一個服務並連線到同一份同步資料。每次使用一種服務。

同步包含外觀、背景圖片、記憶音量與下載紀錄。下載紀錄會合併，已下載的媒體檔案留在各自裝置。設定按個別項目合併，較新的修改優先。兩端都沒有修改時間的項目採用雲端值。第一次同步前可用「匯出設定」備份。同步資料上限為 32 MiB，連線憑證儲存在各裝置的 Tampermonkey，與同步資料及匯出檔分開。

## Google Drive

1. 在 [Google Apps Script](https://script.google.com/) 建立自己的專案，將 [Drive 配套程式](x-minimal-drive-sync.gs) 貼入程式碼檔。
2. 到「專案設定」開啟顯示 `appsscript.json`，用隨附的 [Apps Script 設定檔](x-minimal-drive-appsscript.json) 取代其內容。這份設定啟用 Drive API，授權範圍限於這個應用程式的資料夾及對外請求。若專案自行連到標準 Google Cloud 專案，也要在該專案啟用 Drive API。 [Apps Script 進階服務說明](https://developers.google.com/apps-script/guides/services/advanced)
3. 在編輯器執行 `configureSync`，核對 Google 的授權畫面並完成授權。從執行記錄複製同步密鑰。請將密鑰視為密碼。
4. 新增部署，類型選「網頁應用程式」，以自己身分執行，存取權選「任何人」。端點以同步密鑰驗證讀寫，Drive 檔案存於該專案私有的 `appDataFolder`。如果 Workspace 管理員禁止匿名網頁應用程式，這個部署方式會受限。 [網頁應用程式](https://developers.google.com/apps-script/guides/web) · [Drive 應用程式資料夾](https://developers.google.com/workspace/drive/api/guides/appdata)
5. 在每部裝置的 X 極簡選擇 Google Drive，填入同一個部署的 `/exec` 網址與同步密鑰，然後按「立即同步」。

## WebDAV

在每部裝置填入同一個 HTTPS **檔案網址**（例如 `https://dav.example.com/remote.php/dav/files/使用者/x-minimal-sync.json`）、使用者名稱與應用程式密碼。先建立上層資料夾，JSON 檔會在首次同步時建立。伺服器需提供強 ETag，並支援條件式 PUT。若 Tampermonkey 詢問跨站請求權限，只允許該 WebDAV 網域。 [Tampermonkey 網域權限說明](https://www.tampermonkey.net/documentation.php?locale=en&q=connect)
