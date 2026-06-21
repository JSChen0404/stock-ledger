/*
 * 持股簿 — Cloudflare Worker（雲端儲存 + 報價/股利代理）
 *
 * 功能：
 *   GET  /data            讀取你的交易資料（從 KV）
 *   PUT  /data            儲存你的交易資料（到 KV）
 *   GET  /proxy?url=...    轉發證交所/櫃買/FinMind 的請求（解決瀏覽器 CORS、抓即時報價）
 *   所有請求都要帶 ?k=你的密碼
 *
 * 一次性設定：
 *   1. Cloudflare → Workers & Pages → Create Worker，貼上本檔，Deploy。
 *   2. 把下面的 SECRET 改成你自己的密碼（App 設定要填一樣的）。
 *   3. 左側 KV → 建一個 namespace（例如 ledger）。
 *   4. 回到此 Worker → Settings → Bindings → 新增 KV Namespace binding：
 *        變數名稱填 KV，選你剛建的 namespace，儲存。
 *   5. 複製 Worker 網址與密碼，填到 App 的「設定」。
 */

const SECRET = "change-this-to-your-own-password";   // ← 改成你自己的密碼（App 設定要填一樣的）
const KEY = "portfolio";                              // KV 裡存資料用的鍵
const ALLOW = ["mis.twse.com.tw", "openapi.twse.com.tw", "www.tpex.org.tw", "api.finmindtrade.com"];

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...CORS, "content-type": "application/json; charset=utf-8" } });

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { headers: CORS });

    const url = new URL(request.url);
    if (url.searchParams.get("k") !== SECRET) return json({ error: "unauthorized" }, 401);

    // ---- 資料儲存 ----
    if (url.pathname === "/data") {
      if (!env.KV) return json({ error: "KV not bound (請在 Settings→Bindings 加上變數名 KV)" }, 500);
      if (request.method === "PUT") {
        const body = await request.text();
        if (body.length > 4_000_000) return json({ error: "too large" }, 413);
        await env.KV.put(KEY, body);
        return json({ ok: true });
      }
      const v = await env.KV.get(KEY);
      return new Response(v || "{}", { headers: { ...CORS, "content-type": "application/json; charset=utf-8" } });
    }

    // ---- 代理（報價/股利）----
    if (url.pathname === "/proxy") {
      const target = url.searchParams.get("url");
      if (!target) return json({ error: "missing url" }, 400);
      let host;
      try { host = new URL(target).hostname; } catch (e) { return json({ error: "bad url" }, 400); }
      if (!ALLOW.includes(host)) return json({ error: "host not allowed" }, 403);
      try {
        const r = await fetch(target, { headers: { "User-Agent": "Mozilla/5.0", "Accept": "application/json" } });
        const txt = await r.text();
        return new Response(txt, { headers: { ...CORS, "content-type": "application/json; charset=utf-8" } });
      } catch (e) {
        return json({ error: "upstream failed" }, 502);
      }
    }

    return json({ error: "not found" }, 404);
  }
};
