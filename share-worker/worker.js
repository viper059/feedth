// Cloudflare Worker: ทำให้ลิงก์แชร์ของแต่ละโพสต์มีการ์ดพรีวิว (รูป+ข้อความ) ของโพสต์นั้นเอง
// ลิงก์: https://<worker>/p/<post_id>  → บอต Facebook/LINE เห็นแท็ก og ของโพสต์ / คนทั่วไปถูกพาเข้าแอป
// ตั้งค่า Variables ใน Worker: SUPABASE_URL, SUPABASE_ANON_KEY, APP_URL (เช่น https://viper059.github.io/feedth/)
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const m = url.pathname.match(/^\/p\/([0-9a-fA-F-]{36})\/?$/);
    const app = env.APP_URL || "https://viper059.github.io/feedth/";
    if (!m) return Response.redirect(app, 302);
    const id = m[1];
    let post = null;
    try {
      const r = await fetch(
        `${env.SUPABASE_URL}/rest/v1/posts?id=eq.${id}&select=content,media_urls,place:places(name),author:profiles!posts_user_id_fkey(username:display_name)&limit=1`,
        { headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: `Bearer ${env.SUPABASE_ANON_KEY}` } }
      );
      if (r.ok) post = (await r.json())[0] || null;
    } catch {}
    const who = post?.author?.username || "ปักหมุด";
    const title = post?.place?.name ? `${who} @ ${post.place.name}` : `โพสต์ของ ${who} · ปักหมุด`;
    const desc = (post?.content || "ปักหมุดที่ที่คุณไปจริง พิชิตโลกไปกับเพื่อน").replace(/\s+/g, " ").slice(0, 200);
    const img = post?.media_urls?.[0] || new URL("og-image.png", app).href;
    const dest = `${app}${app.includes("?") ? "&" : "?"}post=${id}`;
    const html = `<!doctype html><html lang="th"><head><meta charset="utf-8">
<title>${esc(title)}</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta property="og:type" content="article"><meta property="og:site_name" content="ปักหมุด · Pinworld">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${esc(img)}"><meta property="og:url" content="${esc(url.href)}">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:image" content="${esc(img)}">
<meta http-equiv="refresh" content="0;url=${esc(dest)}"></head>
<body><script>location.replace(${JSON.stringify(dest)})</script><a href="${esc(dest)}">เปิดในแอปปักหมุด</a></body></html>`;
    return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=300" } });
  },
};
