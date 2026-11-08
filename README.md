# X 極簡

把 X 的時間線、側欄和閱讀介面調成自己順手的樣子。這是我平常自己在用的 Tampermonkey 腳本，設定介面採繁體中文，支援 X 新舊兩套版面。原始碼採 MIT 授權。

**這是個人自用專案。** 我會依自己的使用需求和時間決定是否處理 issue、功能請求與 PR，回覆、修正和持續維護都沒有時程承諾。遇到問題可以回報，附上瀏覽器、腳本版本、X 頁面和重現方式，方便我有空時查看。

## 安裝

1. 在瀏覽器安裝 [Tampermonkey](https://www.tampermonkey.net/)。
2. 安裝 [X 極簡腳本](https://raw.githubusercontent.com/TW527E/X-Minimal/main/x-minimal.user.js)。若使用其他 X 主題擴充套件，先暫停它，避免樣式重疊。
3. 重新整理 X，點左側的「介面設定」，或從 Tampermonkey 選單選「X 極簡設定」。窄視窗的入口在左下角。

主要在 Vivaldi 與 Chromium 驗證。X 的新版介面會分批推出，頁面改版後可能需要更新腳本。macOS 的 Vivaldi／Chrome 可使用同一份腳本，Safari 的實機相容性仍待驗證。

## 做了哪些改動

功能靈感來自 [Minimal Theme for Twitter / X](https://github.com/typefully/minimal-twitter)。這個版本以獨立 userscript 實作，加入背景、玻璃材質、媒體與備份功能。Typefully 推廣與排程整合省略。

| 功能 | 可以做什麼 |
| --- | --- |
| 時間線與側欄 | 調整主欄寬度、置中、框線和貼文分隔線。左側導覽和右側推薦欄可獨立貼邊。導覽可依寬度收合，懸浮展開時保持圖示位置。 |
| 精簡介面 | 隱藏廣告、推薦追蹤、訂閱卡、指定導覽項目、貼文計數、Grok 與聊天浮窗。可預設進入「正在跟隨」，另有專注寫作和自訂 CSS。 |
| 背景與玻璃 | 選擇本機圖片或 HTTPS 圖片網址，調整填滿方式、位置與壓暗程度。時間線和側欄／浮窗可各自設定實色、毛玻璃或 Liquid Glass。 |
| 透明介面的配色 | 隨背景選擇深淺文字，也可手動指定。發文與行內回覆的工具列跟著配色更新，媒體控制、按讚狀態和連結保留各自的用途色。 |
| 磁吸游標 | 選擇性開啟。可貼合連結、按鈕和選單，文字區顯示文字游標。影片只對底部控制列吸附，拖曳進度條和音量滑軌時滑塊會跟隨。 |
| 媒體下載 | 從貼文操作列依序下載原圖或最高可用畫質的 MP4，全部放在瀏覽器下載目錄。記住已成功下載的檔案，再按會略過，按住 Shift 可重抓。 |
| 影片音量 | 記住播放器音量，並可另外開啟音量平衡。三次方滑桿方便微調低音量，平衡處理在本機執行。 |
| 設定備份 | 匯出／匯入 JSON，或自選 Google Drive／WebDAV 同步外觀、背景、音量及下載紀錄。 |

## Liquid Glass 的做法

WebGL 折射改編自 [tw527e.zip](https://github.com/TW527E/tw527e.zip)，包含折射邊緣、色散和高光。時間線的畫布只涵蓋可見區域，側欄、頂列、浮窗、發文與回覆區使用各自合適的材質範圍。發文和回覆的輸入區、工具列共用同一塊玻璃。

效能不足、WebGL 失敗或背景圖片無法取樣時會退回毛玻璃。瀏覽器不支援模糊，或系統偏好減少透明度與高對比時，會使用實色。輕量模式可手動關閉折射，設定頁也會顯示自動降級的狀態和原因。

## 儲存、下載與同步

設定與下載紀錄平常存放於 Tampermonkey，同一瀏覽器設定檔中的 X 帳號會共用。圖片網址由瀏覽器向該圖片主機載入。媒體下載使用登入後的 X 網頁 API 和 X CDN，需要 Tampermonkey 的下載權限。檔名和儲存位置仍受瀏覽器下載設定影響。

跨裝置同步預設關閉。啟用時資料會送到你填入的 WebDAV 或你自行部署的 Google Apps Script，詳見 [跨裝置同步設定](x-minimal-sync-guide.md)。GitHub 和 Greasy Fork 之間的同步只負責發佈腳本，不涉及個人設定或下載紀錄。

## 發佈紀錄

- **1.10.2** 修正發文和行內回覆工具列的圖示，使其跟隨透明時間線的配色設定。
- **1.10.1** 統一貼文頁行內回覆的輸入區和工具列背景。
- **1.10.0** 新增媒體下載紀錄、跳過已下載項目，以及 Google Drive／WebDAV 跨裝置同步。

## 來源與授權

- Liquid Glass shader 與磁吸游標改編自 [TW527E/tw527e.zip](https://github.com/TW527E/tw527e.zip)。
- 音量曲線與平衡算法改編自 [TW527E/bilibili-youtube-volume](https://github.com/TW527E/bilibili-youtube-volume)。
- 媒體解析改編自 [Twitter/X Media Downloader](https://greasyfork.org/zh-TW/scripts/529453-twitter-x-media-downloader)。
- 設定視窗與側欄動態參考 [Motion Prompt](https://github.com/showheyohtaki/motion-prompt)。

本專案使用 [MIT 授權](LICENSE)。第三方授權與署名一併保留。
