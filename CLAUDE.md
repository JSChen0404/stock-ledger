# CLAUDE.md — 持股簿（台股投資紀錄 PWA）

給 Claude Code 的專案脈絡。使用者母語為繁體中文，UI 與回覆請用繁體中文。

## 這是什麼
單人自用的台股投資紀錄 App。可加到手機桌面（PWA）、可離線。記錄買賣、自動算手續費與證交稅、加權平均成本、未實現/已實現損益、報酬率，並自動抓股價與股利（含成本內扣）。

## 技術與檔案
- 無建置流程、無框架。整個 App 是**單一 `index.html`**（HTML + 內嵌 CSS + 內嵌 JS）。
- `worker.js` — Cloudflare Worker：雲端儲存（KV）+ 報價/股利代理。
- `manifest.webmanifest`、`sw.js`、`icon-*.png` — PWA 必要檔。
- `README.md` — 部署與設定說明。
- 因為 CSS/JS 都內嵌，**改版通常只動 `index.html` 一個檔**。

## 資料流 / 架構
- **儲存**：以 Cloudflare Worker + KV 為主，localStorage 為離線快取。
  - `save(push=true)`：先寫 localStorage，再去抖動上傳雲端。
  - `cloudLoad()`：開啟時抓雲端，`updatedAt` 較新者為準；雲端空則把本機推上去。
  - 只有 `{tx, div, prices, updatedAt}` 上雲；`settings`（worker/secret/fee/finmind）只存本機。
- **股價**：盤中（台北時間平日 09:00–13:30，且已設 Worker）抓 `mis.twse.com.tw` 約 5 秒延遲即時價；否則抓官方收盤價（TWSE/TPEx OpenAPI）。皆經 Worker `/proxy` 避開 CORS。
- **股利**：FinMind `TaiwanStockDividend`，按鈕觸發。

## 台股領域規則（重要，勿改錯）
- **紅漲綠跌**：正/獲利＝紅（class `up`，var `--up`）、負/虧損＝綠（`down`/`--down`）。與美股相反。
- 手續費 = 成交金額 × 0.001425 × 折數（`settings.fee`，預設 0.6）；賣出證交稅 = 成交金額 × 0.003（目前一律 0.3%，ETF 0.1% 尚未分開，屬已知簡化）。
- 成本：**加權平均法**。賣出時已實現 = 賣出淨額 − 賣出股數 × 當時均價。
- **股利成本內扣**：現金股利從該檔持股成本扣除（`buildHoldings` 內 `divByCode`）；賣光的標的其股利併入已實現。
- **配股**：除權日前持股 × 每股配股 ÷ 10 = 新增股數，存成 `kind:'stockdiv'` 的 0 成本 buy。
- `sharesHeldBefore(code, exDate)` 用**嚴格小於** `t.date < exDate`，確保同日除權息的新股不灌入當日基準。

## 外部 API
- 上市收盤：`https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL` → 欄位 `Code`,`ClosingPrice`,`Date`(民國)。
- 上櫃收盤：`https://www.tpex.org.tw/openapi/v1/tpex_mainboard_daily_close_quotes` → `SecuritiesCompanyCode`,`Close`。
- 盤中即時：`https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=tse_2330.tw|otc_xxxx.tw&json=1` → `msgArray[].c/z/y/o/n`（z 可能為 '-'，fallback o→y）。**非官方、會限流**。
- 股利：`https://api.finmindtrade.com/api/v4/data?dataset=TaiwanStockDividend&data_id=CODE&start_date=...&token=...` → `CashEarningsDistribution`+`CashStatutorySurplus`(每股現金)、`CashExDividendTradingDate`(除息日)、`StockEarningsDistribution`+`StockStatutorySurplus`(每股配股)、`StockExDividendTradingDate`。

## Worker 介面（worker.js）
- 所有請求需 `?k=<SECRET>`（`worker.js` 頂端 `const SECRET`，與 App 設定一致）。
- `GET /data` → 讀 KV 的 `portfolio`；`PUT /data` → 寫入。**需綁定 KV namespace，binding 變數名 = `KV`**。
- `GET /proxy?url=<encoded>` → 允許清單轉發：`mis.twse.com.tw`,`openapi.twse.com.tw`,`www.tpex.org.tw`,`api.finmindtrade.com`，並補 CORS。

## 開發 / 驗證慣例
- 改完 JS 後務必語法檢查：抽出 `<script>` 內容跑 `node --check`。例如：
  `python3 -c "import re;h=open('index.html',encoding='utf-8').read();open('/tmp/a.js','w').write(re.search(r'<script>(.*)</script>',h,re.S).group(1))" && node --check /tmp/a.js`
- 也對 `worker.js` 跑 `node --check`。
- Service worker 採**網路優先**讀 HTML，所以部署後手機開啟會自動更新；改大版面/資產時可把 `sw.js` 的 `VERSION` 加一以清舊快取。
- 沙箱/部分環境會擋 `localStorage` 與 `alert/confirm/prompt`：本專案已用 try/catch 記憶體 fallback、並以自製 modal 取代原生跳窗，**請勿改回原生跳窗**。

## 部署
- GitHub Pages，固定網址。**push 到 repo 即自動部署**；手機端網路優先自動換新版（不用重裝、資料不掉）。
- 期望工作流：使用者口頭描述需求 → 你（Claude Code）改 `index.html`（必要時 `worker.js`）→ commit & push → Pages 重部署。

## 已知限制 / 注意
- 報價板的紅綠是依**使用者部位損益**上色，不是當日漲跌——因為 TWSE 開放資料的「漲跌」正負號格式不一致，不可靠。若要做當日漲跌欄位，需用 `mis` 的 `y`(昨收) 自行算並小心符號。
- 即時來源 `mis` 為非官方、可能限流；要 100% 穩定授權需付費源。
- FinMind 為第三方，個別公司/年度偶有缺漏。
- 全部免費額度內（Workers 10萬req/日、KV 寫入 1k/日），單人用不到上限。

## 可能的後續（backlog）
- 持股配置圓餅圖、報酬率走勢圖。
- 成本法切換（加權平均 ↔ FIFO）。
- 自動帶入股票名稱（目前部分留空，靠報價回填）。
- 賣出證交稅分一般股 0.3% / ETF 0.1%。
- 多組自選清單、搜尋/排序。
