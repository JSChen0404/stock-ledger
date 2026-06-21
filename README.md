# 持股簿 · 台股投資紀錄 PWA

可裝到手機桌面的台股投資紀錄 App。交易資料存在**你自己的 Cloudflare KV**（雲端、永久、可多裝置同步），本機保留離線快取。

## 功能
- 買賣交易紀錄，自動算手續費（可設折數）與賣出證交稅
- 加權平均成本、未實現／已實現損益、報酬率
- 股利自動抓取（FinMind）：現金股利 + 股票股利（配股），自動成本內扣
- 股價：盤中即時（約 5 秒延遲，經 Worker）／盤後官方收盤價，開啟自動更新
- 券商風深色報價板、台股「紅漲綠跌」
- 雲端儲存（Cloudflare KV）＋本機離線快取；可匯出／匯入 JSON 備份

## 檔案
- `index.html`、`manifest.webmanifest`、`sw.js`、`icon-*.png` — App 本體
- `worker.js` — Cloudflare Worker：雲端儲存（KV）＋報價/股利代理

---

## 一、部署 App（GitHub Pages，固定網址）
1. 建一個 GitHub repo（私有亦可），把所有檔案上傳（Add file → Upload files）。
2. Settings → Pages → 選 main 分支 → 儲存，取得固定網址 `https://你的帳號.github.io/repo/`。
3. 手機開該網址 →（iPhone Safari）分享 → 加入主畫面 ／（Android Chrome）選單 → 安裝應用程式。

之後更新：因為程式幾乎都在單一 `index.html`、service worker 採網路優先，**改完重新 push 到 repo，手機下次開啟就自動是新版**（不用重裝、資料不掉）。可用 Claude Code 直接幫你改檔＋push。

## 二、設定雲端 + 即時報價（Cloudflare Worker + KV，免費）
1. Cloudflare 免費註冊 → Workers & Pages → Create Worker，貼上 `worker.js`，把 `SECRET` 改成你自己的密碼，Deploy。
2. 左側 KV → 建一個 namespace（例如 ledger）。
3. 回 Worker → Settings → Bindings → 新增 KV Namespace binding：變數名 **KV**，選剛建的 namespace。
4. 複製 Worker 網址與密碼，填到 App「設定 → Worker 網址 / Secret」，按「測試連線」。

完成後：
- 交易資料存到你的 KV，**換機、重裝、清瀏覽器都不會掉**，多裝置同步。
- 盤中（平日 09:00–13:30）開啟或按「更新」會抓即時報價；盤後抓官方收盤價。
- 資料只在你的 Cloudflare 帳號裡，沒有密碼存取不了。

免費額度：Cloudflare Workers 每日 10 萬次請求、KV 寫入每日 1,000 次，個人自用遠遠用不到；超額只會暫停、不會收費。

## 自動抓取股利
「股利」分頁按「⟳ 自動抓取」。依交易紀錄向 FinMind 抓各檔除息資料：
- 現金股利：除息日前持股 × 每股現金股利。
- 股票股利（配股）：除權日前持股 × 每股配股 ÷ 10 = 新增股數（0 成本入股，均價自動下降，不足一股捨去）。
- 重複執行不會重覆新增；免 token 可用，註冊 FinMind 拿 token 填到設定可提高額度。

## 備份
雲端已是主要保存；仍可到「設定 → 匯出備份」存一份 JSON，作為離線或換平台的保險。
