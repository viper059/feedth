// สร้างหน้าสถานที่แบบ HTML จริง (ให้ Google อ่านได้) + sitemap.xml + robots.txt ลงใน dist/
// รันหลัง vite build:  node scripts/prerender-places.mjs
// เลือกเฉพาะสถานที่ที่มีรีวิว/โพสต์จริงของสมาชิก (กันหน้าเนื้อหาบางที่ Google ไม่ให้อันดับ)
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const SITE = (process.env.SITE_URL || "https://pinsworld.net").replace(/\/+$/, "");
const SB = process.env.VITE_SUPABASE_URL, KEY = process.env.VITE_SUPABASE_ANON_KEY;
const DIST = process.env.DIST_DIR || "dist";
const MIN_TEXT = 15;      // รีวิวที่นับต้องยาวอย่างน้อยกี่ตัวอักษร
const MAX_PAGES = 5000;

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const KIND = { temple: "วัด", park: "อุทยาน / สวน", beach: "ชายหาด", waterfall: "น้ำตก", museum: "พิพิธภัณฑ์" };
const CAT = { restaurant: "ร้านอาหาร", cafe: "คาเฟ่", hotel: "ที่พัก", attraction: "สถานที่ท่องเที่ยว", other: "สถานที่" };
const LD = { restaurant: "Restaurant", cafe: "CafeOrCoffeeShop", hotel: "LodgingBusiness", attraction: "TouristAttraction", other: "Place" };
const label = (p) => KIND[p.kind] || CAT[p.category] || "สถานที่";

if (!SB || !KEY) { console.log("⚠️ ไม่มี VITE_SUPABASE_URL/ANON_KEY — ข้ามการสร้างหน้า SEO"); process.exit(0); }
const H = { apikey: KEY, Authorization: `Bearer ${KEY}` };
const get = async (path) => { const r = await fetch(`${SB}/rest/v1/${path}`, { headers: H }); if (!r.ok) throw new Error(`${r.status} ${path.slice(0, 80)}`); return r.json(); };

try {
  // 1) โพสต์ที่ผูกสถานที่ (อ่านได้สาธารณะ)
  const posts = await get("posts?select=place_id,content,rating,created_at,author:profiles!posts_user_id_fkey(username:display_name)&place_id=not.is.null&order=created_at.desc&limit=3000");
  const by = new Map();
  for (const p of posts) {
    const txt = String(p.content || "").replace(/\s+/g, " ").trim();
    if (txt.length < MIN_TEXT) continue;
    if (!by.has(p.place_id)) by.set(p.place_id, []);
    by.get(p.place_id).push({ txt, rating: p.rating, at: p.created_at, who: (p.author && p.author.username) || "สมาชิก" });
  }
  const ids = [...by.keys()].slice(0, MAX_PAGES);
  if (!ids.length) { console.log("ยังไม่มีสถานที่ที่มีรีวิว — สร้างแค่ robots/sitemap หน้าแรก"); }
  const places = [];
  for (let i = 0; i < ids.length; i += 150) {
    places.push(...await get(`places?select=id,name,category,kind,lat,lng,province&id=in.(${ids.slice(i, i + 150).join(",")})`));
  }

  // 2) เขียนหน้า
  const urls = [{ loc: SITE + "/", pri: "1.0" }];
  for (const pl of places) {
    const rv = by.get(pl.id) || [];
    const rated = rv.filter((r) => r.rating >= 1 && r.rating <= 5);
    const avg = rated.length ? rated.reduce((a, r) => a + r.rating, 0) / rated.length : null;
    const slugName = String(pl.name).replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "").slice(0, 60);
    const url = `${SITE}/place/${pl.id}/`;
    const prov = pl.province ? ` จ.${pl.province}` : "";
    const title = `${pl.name}${prov} · รีวิวและเช็คอินจากสมาชิก | ปักหมุด`;
    const desc = `${label(pl)} ${pl.name}${prov} — ${rv.length} รีวิวจากคนไปมาจริง: ${rv[0].txt}`.slice(0, 155);
    const ld = {
      "@context": "https://schema.org", "@type": LD[pl.category] || "Place", name: pl.name, url,
      geo: { "@type": "GeoCoordinates", latitude: pl.lat, longitude: pl.lng },
      ...(pl.province ? { address: { "@type": "PostalAddress", addressRegion: pl.province, addressCountry: "TH" } } : {}),
      ...(avg ? { aggregateRating: { "@type": "AggregateRating", ratingValue: Number(avg.toFixed(1)), reviewCount: rated.length, bestRating: 5, worstRating: 1 } } : {}),
      ...(rv.length ? { review: rv.slice(0, 5).map((r) => ({ "@type": "Review", reviewBody: r.txt.slice(0, 400), author: { "@type": "Person", name: r.who }, datePublished: String(r.at).slice(0, 10), ...(r.rating >= 1 && r.rating <= 5 ? { reviewRating: { "@type": "Rating", ratingValue: r.rating, bestRating: 5, worstRating: 1 } } : {}) })) } : {}),
    };
    const html = `<!doctype html><html lang="th"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${url}">
<meta property="og:type" content="website"><meta property="og:site_name" content="ปักหมุด · Pinworld">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${url}"><meta property="og:image" content="${SITE}/og-image.png">
<link rel="icon" href="${SITE}/icon.svg">
<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, "\\u003c")}</script>
<style>body{font-family:'IBM Plex Sans Thai',system-ui,sans-serif;margin:0;background:#F6F7FB;color:#1F2430;line-height:1.6}main{max-width:640px;margin:0 auto;padding:20px 16px}h1{font-size:24px;margin:4px 0}.t{color:#6B7280;font-size:14px}.c{background:#fff;border-radius:16px;padding:14px 16px;margin:12px 0;box-shadow:0 1px 3px rgba(0,0,0,.06)}.b{display:inline-block;background:#6C5CE7;color:#fff;text-decoration:none;font-weight:600;border-radius:999px;padding:12px 22px;margin:8px 8px 8px 0}.b2{background:#fff;color:#6C5CE7;border:1px solid #6C5CE7}a{color:#6C5CE7}</style></head>
<body><main>
<p class="t"><a href="${SITE}/">ปักหมุด · Pinworld</a> › ${esc(label(pl))}${pl.province ? " › " + esc(pl.province) : ""}</p>
<h1>${esc(pl.name)}</h1>
<p class="t">${esc(label(pl))}${prov ? " · " + esc(prov.trim()) : ""}${avg ? ` · ⭐ ${avg.toFixed(1)} จาก ${rated.length} รีวิว` : ""}</p>
<p><a class="b" href="${SITE}/?place=${pl.id}">เช็คอินที่นี่ในแอปปักหมุด</a><a class="b b2" href="https://www.google.com/maps/search/?api=1&query=${pl.lat},${pl.lng}" rel="noopener">เปิดใน Google Maps</a></p>
<h2 style="font-size:18px">รีวิวและโพสต์จากสมาชิก (${rv.length})</h2>
${rv.slice(0, 20).map((r) => `<div class="c"><p style="margin:0">${esc(r.txt.slice(0, 600))}</p><p class="t" style="margin:6px 0 0">${esc(r.who)}${r.rating ? " · " + "★".repeat(r.rating) : ""} · ${esc(String(r.at).slice(0, 10))}</p></div>`).join("\n")}
<p class="t">ปักหมุด คือแอปเช็คอินท่องเที่ยว ปักหมุดที่ที่ไปจริง ปลดล็อกแผนที่ พิชิตโลก — <a href="${SITE}/">เปิดแอป</a></p>
</main></body></html>`;
    const dir = join(DIST, "place", String(pl.id));
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "index.html"), html);
    urls.push({ loc: url, pri: "0.6", mod: String((rv[0] && rv[0].at) || "").slice(0, 10) });
  }

  // 3) sitemap + robots
  const sm = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `<url><loc>${u.loc}</loc>${u.mod ? `<lastmod>${u.mod}</lastmod>` : ""}<priority>${u.pri}</priority></url>`).join("\n")}\n</urlset>\n`;
  writeFileSync(join(DIST, "sitemap.xml"), sm);
  writeFileSync(join(DIST, "robots.txt"), `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`);
  console.log(`✅ สร้างหน้าสถานที่ ${places.length} หน้า + sitemap (${urls.length} URL) + robots.txt`);
} catch (e) {
  // ไม่ให้การอัปเดตเว็บล้มเพราะ SEO: ข้ามไป เว็บยังใช้ได้ปกติ
  console.log("⚠️ สร้างหน้า SEO ไม่สำเร็จ (ข้าม): " + e.message);
  if (!existsSync(join(DIST, "robots.txt"))) writeFileSync(join(DIST, "robots.txt"), `User-agent: *\nAllow: /\nSitemap: ${SITE}/sitemap.xml\n`);
}
