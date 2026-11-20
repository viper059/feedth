// สร้างหน้ารวมสถานที่ระดับ "จังหวัด" และ "จังหวัด × หมวด" (เช่น คาเฟ่ในเชียงใหม่) ให้ Google ค้นเจอ
// รันหลัง prerender-places.mjs:  node scripts/prerender-hubs.mjs
// ข้อมูลมาจากตารางสถานที่ทั้งหมด (ฟังก์ชัน seo_area_counts / seo_area_top) — เฉพาะชื่อภาษาไทย, กลุ่มที่มี >= MIN_N แห่งถึงสร้างหน้า
import { mkdirSync, writeFileSync, existsSync, readdirSync, readFileSync, appendFileSync } from "node:fs";
import { join } from "node:path";

const SITE = (process.env.SITE_URL || "https://pinsworld.net").replace(/\/+$/, "");
const SB = process.env.VITE_SUPABASE_URL, KEY = process.env.VITE_SUPABASE_ANON_KEY;
const DIST = process.env.DIST_DIR || "dist";
const MIN_N = 5, TOP = 60;

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const jld = (o) => JSON.stringify(o).replace(/</g, "\\u003c");
// slug (ASCII) -> { ชื่อไทย, ตัวกรอง, ชนิด schema.org }
const GROUPS = {
  restaurant: { th: "ร้านอาหาร", f: { category: "restaurant" }, ld: "Restaurant" },
  cafe: { th: "คาเฟ่", f: { category: "cafe" }, ld: "CafeOrCoffeeShop" },
  hotel: { th: "ที่พัก โรงแรม", f: { category: "hotel" }, ld: "LodgingBusiness" },
  attraction: { th: "สถานที่ท่องเที่ยว", f: { category: "attraction" }, ld: "TouristAttraction" },
  temple: { th: "วัด", f: { kind: "temple" }, ld: "PlaceOfWorship" },
  beach: { th: "ชายหาด", f: { kind: "beach" }, ld: "Beach" },
  waterfall: { th: "น้ำตก", f: { kind: "waterfall" }, ld: "TouristAttraction" },
  park: { th: "สวนและอุทยาน", f: { kind: "park" }, ld: "Park" },
  museum: { th: "พิพิธภัณฑ์", f: { kind: "museum" }, ld: "Museum" },
};

if (!SB || !KEY) { console.log("⚠️ ไม่มี VITE_SUPABASE_URL/ANON_KEY — ข้ามหน้ารวมจังหวัด"); process.exit(0); }
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };
const rpc = async (fn, body = {}) => { const r = await fetch(`${SB}/rest/v1/rpc/${fn}`, { method: "POST", headers: H, body: JSON.stringify(body) }); if (!r.ok) throw new Error(`${r.status} ${fn}`); return r.json(); };

const STYLE = `body{font-family:'IBM Plex Sans Thai',system-ui,sans-serif;margin:0;background:#F6F7FB;color:#1F2430;line-height:1.6}main{max-width:720px;margin:0 auto;padding:20px 16px}h1{font-size:24px;margin:4px 0}h2{font-size:18px;margin:22px 0 8px}.t{color:#6B7280;font-size:14px}a{color:#6C5CE7}ul{padding:0;margin:0;list-style:none}li{background:#fff;border:1px solid #E7E9F0;border-radius:12px;padding:10px 14px;margin:6px 0}.chips a{display:inline-block;background:#EFEBFF;border-radius:999px;padding:4px 12px;margin:3px 4px 3px 0;text-decoration:none;font-size:14px}.b{display:inline-block;background:#6C5CE7;color:#fff;border-radius:12px;padding:10px 16px;text-decoration:none;font-weight:600}`;
const page = ({ url, title, desc, ld, body }) => `<!doctype html><html lang="th"><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src https: data:; base-uri 'none'; form-action 'none'">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${url}">
<meta property="og:type" content="website"><meta property="og:site_name" content="ปักหมุด · Pinworld">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${url}"><meta property="og:image" content="${SITE}/og-image.png">
<link rel="icon" href="${SITE}/icon.svg">
${ld.map((o) => `<script type="application/ld+json">${jld(o)}</script>`).join("\n")}
<style>${STYLE}</style></head>
<body><main>
${body}
<p class="t" style="margin-top:28px">ปักหมุด คือแอปเช็คอินท่องเที่ยว ปักหมุดที่ที่ไปจริง ปลดล็อกแผนที่ พิชิตโลกกับเพื่อน — <a href="${SITE}/">เปิดแอปปักหมุด</a> · ข้อมูลแผนที่ © ผู้ร่วมจัดทำ <a href="https://www.openstreetmap.org/copyright" rel="noopener">OpenStreetMap</a></p>
</main></body></html>`;
const write = (rel, html) => { const dir = join(DIST, ...rel.split("/").filter(Boolean)); mkdirSync(dir, { recursive: true }); writeFileSync(join(dir, "index.html"), html); };
const ex = (p) => `${SITE}/explore/${encodeURIComponent(p)}/`;
const fmt = (n) => Number(n).toLocaleString("en-US");

try {
  const rows = await rpc("seo_area_counts");
  // รวมจำนวนต่อ จังหวัด × กลุ่ม
  const cnt = new Map(); // province -> slug -> n
  const add = (p, s, n) => { if (!cnt.has(p)) cnt.set(p, {}); cnt.get(p)[s] = (cnt.get(p)[s] || 0) + n; };
  for (const r of rows) {
    const n = Number(r.n);
    if (GROUPS[r.category]) add(r.province, r.category, n);
    if (r.kind && GROUPS[r.kind]) add(r.province, r.kind, n);
  }
  const provs = [...cnt.entries()].map(([p, g]) => ({ p, g, total: (g.restaurant || 0) + (g.cafe || 0) + (g.hotel || 0) + (g.attraction || 0) })).sort((a, b) => b.total - a.total);
  // สถานที่ที่มีหน้ารีวิวของตัวเองแล้ว → ลิงก์ไปหน้านั้น
  const reviewed = new Set(existsSync(join(DIST, "place")) ? readdirSync(join(DIST, "place")) : []);
  const link = (id) => reviewed.has(String(id)) ? `${SITE}/place/${id}/` : `${SITE}/?place=${id}`;

  const urls = [{ loc: `${SITE}/explore/`, pri: "0.8" }];
  let pages = 0;

  // หน้าจังหวัด × หมวด
  for (const { p, g } of provs) {
    for (const [slug, n] of Object.entries(g)) {
      if (n < MIN_N) continue;
      const G = GROUPS[slug];
      const top = await rpc("seo_area_top", { p_province: p, p_category: G.f.category || null, p_kind: G.f.kind || null, p_limit: TOP });
      if (top.length < MIN_N) continue;
      const url = `${ex(p)}${slug}/`;
      const title = `${G.th}ใน${p === "กรุงเทพมหานคร" ? "" : "จังหวัด"}${p} ${fmt(n)} แห่ง พิกัดแผนที่และรีวิว | ปักหมุด`;
      const desc = `รวม${G.th}ใน${p} ${fmt(n)} แห่ง เช่น ${top.slice(0, 3).map((x) => x.name).join(" ")} ดูพิกัด เช็คอิน และอ่านรีวิวจากคนไปจริงบนปักหมุด`.slice(0, 158);
      const others = Object.entries(g).filter(([s, m]) => s !== slug && m >= MIN_N);
      const ld = [
        { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
          { "@type": "ListItem", position: 1, name: "ปักหมุด", item: `${SITE}/` },
          { "@type": "ListItem", position: 2, name: "สำรวจสถานที่", item: `${SITE}/explore/` },
          { "@type": "ListItem", position: 3, name: p, item: ex(p) },
          { "@type": "ListItem", position: 4, name: G.th, item: url } ] },
        { "@context": "https://schema.org", "@type": "ItemList", name: `${G.th}ใน${p}`, numberOfItems: n,
          itemListElement: top.map((x, i) => ({ "@type": "ListItem", position: i + 1, item: { "@type": G.ld, name: x.name, url: link(x.id), geo: { "@type": "GeoCoordinates", latitude: x.lat, longitude: x.lng }, address: { "@type": "PostalAddress", addressRegion: p, addressCountry: "TH" } } })) },
      ];
      const body = `<p class="t"><a href="${SITE}/">ปักหมุด</a> › <a href="${SITE}/explore/">สำรวจสถานที่</a> › <a href="${ex(p)}">${esc(p)}</a> › ${esc(G.th)}</p>
<h1>${esc(G.th)}ใน${esc(p)}</h1>
<p>ปักหมุดรวบรวม${esc(G.th)}ใน${esc(p)}ไว้ ${fmt(n)} แห่ง ด้านล่างคือ ${top.length} แห่งแรก กดเพื่อดูพิกัด เช็คอิน และรีวิวจากคนไปจริง</p>
<p><a class="b" href="${SITE}/">เปิดแผนที่ในแอปปักหมุด</a></p>
<ul>
${top.map((x) => `<li><a href="${link(x.id)}">${esc(x.name)}</a><br><span class="t">${esc(G.th)} · ${esc(p)} · <a href="https://www.google.com/maps/search/?api=1&amp;query=${x.lat},${x.lng}" rel="noopener">ดูแผนที่</a></span></li>`).join("\n")}
</ul>
${others.length ? `<h2>หมวดอื่นใน${esc(p)}</h2><p class="chips">${others.map(([s, m]) => `<a href="${ex(p)}${s}/">${esc(GROUPS[s].th)} (${fmt(m)})</a>`).join("")}</p>` : ""}`;
      write(`explore/${p}/${slug}`, page({ url, title, desc, ld, body }));
      urls.push({ loc: url, pri: "0.7" }); pages++;
    }
  }

  // หน้าจังหวัด
  for (const { p, g, total } of provs) {
    const slugs = Object.entries(g).filter(([, m]) => m >= MIN_N).sort((a, b) => b[1] - a[1]);
    if (!slugs.length) continue;
    const url = ex(p);
    const title = `เที่ยว${p} ที่กิน ที่พัก ที่เที่ยว คาเฟ่ ${fmt(total)} แห่ง | ปักหมุด`;
    const desc = `สำรวจ${p}: ${slugs.slice(0, 4).map(([s, m]) => `${GROUPS[s].th} ${fmt(m)} แห่ง`).join(" · ")} ดูพิกัดและรีวิวจากคนไปจริงบนปักหมุด`.slice(0, 158);
    const ld = [{ "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
      { "@type": "ListItem", position: 1, name: "ปักหมุด", item: `${SITE}/` }, { "@type": "ListItem", position: 2, name: "สำรวจสถานที่", item: `${SITE}/explore/` }, { "@type": "ListItem", position: 3, name: p, item: url }] }];
    const body = `<p class="t"><a href="${SITE}/">ปักหมุด</a> › <a href="${SITE}/explore/">สำรวจสถานที่</a> › ${esc(p)}</p>
<h1>สำรวจ${esc(p)}</h1>
<p>ปักหมุดมีข้อมูลสถานที่ในจังหวัด${esc(p)}กว่า ${fmt(total)} แห่ง เลือกหมวดที่สนใจ แล้วเช็คอินสถานที่ที่ไปจริงเพื่อปลดล็อกแผนที่</p>
<p class="chips">${slugs.map(([s, m]) => `<a href="${url}${s}/">${esc(GROUPS[s].th)} (${fmt(m)})</a>`).join("")}</p>
<p><a class="b" href="${SITE}/">เปิดแอปปักหมุด</a></p>`;
    write(`explore/${p}`, page({ url, title, desc, ld, body }));
    urls.push({ loc: url, pri: "0.8" }); pages++;
  }

  // หน้ารวมทุกจังหวัด
  const rootUrl = `${SITE}/explore/`;
  write("explore", page({
    url: rootUrl, title: "สำรวจสถานที่ทั่วไทย รายจังหวัด ที่กิน ที่พัก ที่เที่ยว | ปักหมุด",
    desc: `สำรวจ ${provs.length} จังหวัดทั่วไทย ร้านอาหาร คาเฟ่ ที่พัก วัด ชายหาด น้ำตก พร้อมพิกัดและรีวิวจากคนไปจริงบนปักหมุด`,
    ld: [{ "@context": "https://schema.org", "@type": "CollectionPage", name: "สำรวจสถานที่ทั่วไทย", url: rootUrl }],
    body: `<p class="t"><a href="${SITE}/">ปักหมุด</a> › สำรวจสถานที่</p><h1>สำรวจสถานที่ทั่วไทย</h1><p>เลือกจังหวัดเพื่อดูร้านอาหาร คาเฟ่ ที่พัก และที่เที่ยว</p><p class="chips">${provs.map(({ p, total }) => `<a href="${ex(p)}">${esc(p)} (${fmt(total)})</a>`).join("")}</p>`,
  }));

  // sitemap แยกไฟล์ + ต่อท้าย robots.txt
  writeFileSync(join(DIST, "sitemap-explore.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `<url><loc>${u.loc}</loc><priority>${u.pri}</priority></url>`).join("\n")}\n</urlset>\n`);
  appendFileSync(join(DIST, "robots.txt"), `Sitemap: ${SITE}/sitemap-explore.xml\n`);

  // ลิงก์ให้บอตเห็นจากหน้าแรก (ซ่อนจากผู้ใช้ที่มี JS) — ไปหน้ารวมจังหวัด
  const idx = join(DIST, "index.html");
  if (existsSync(idx)) {
    const nav = `<noscript><h1>ปักหมุด · Pinworld เช็คอินทั่วไทย พิชิตโลก</h1><p><a href="/explore/">สำรวจสถานที่ทั่วไทยรายจังหวัด</a>: ${provs.slice(0, 12).map(({ p }) => `<a href="/explore/${encodeURIComponent(p)}/">${esc(p)}</a>`).join(" · ")}</p></noscript>`;
    const h = readFileSync(idx, "utf8");
    if (!h.includes("/explore/")) writeFileSync(idx, h.replace('<div id="root"></div>', `<div id="root"></div>${nav}`));
  }
  console.log(`✅ สร้างหน้ารวมจังหวัด/หมวด ${pages + 1} หน้า (${provs.length} จังหวัด) + sitemap-explore.xml`);
} catch (e) {
  console.log("⚠️ สร้างหน้ารวมจังหวัดไม่สำเร็จ (ข้าม): " + e.message);
}
