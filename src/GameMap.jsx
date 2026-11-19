// แผนที่ในกรอบของกระดานด่าน: แผนที่ถนนจริง (OpenFreeMap) ย้อมสีธีม + ชั้นหมอกเกม
// - ตัดตัวหนังสือทั้งหมดของแผนที่ออก (MapLibre ยังวาดสระ/วรรณยุกต์ไทยไม่ถูก) แล้ววางชื่อเองด้วย HTML
//   ซึ่งเบราว์เซอร์วาดภาษาไทยได้ถูกต้อง — แสดงเฉพาะชื่อสถานที่ (ร้าน ที่เที่ยว ที่พัก อุทยาน ฯลฯ) ไม่มีบ้านคน
// - มือถือ: นิ้วเดียวเลื่อนหน้า สองนิ้วเลื่อน/ซูมแผนที่ (cooperative gestures)
// - โหลดแผนที่พื้นหลังไม่ได้ (ออฟไลน์/โดนบล็อก) → ใช้พื้นสีเรียบแทน ชั้นเกมยังทำงาน
import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

const P = { accent: "#6C5CE7", soft: "#C9C1FF", text: "#1F2430", line: "#E4E6EF", land: "#F7F5FF", water: "#CFE3FF", green: "#DDF1E4", building: "#ECE8FB", road: "#FFFFFF", major: "#E7E1FF" };
const STYLE_URL = "https://tiles.openfreemap.org/styles/positron";
const ICON = {
  temple: "M12 3l3 4h-6l3-4zM6 21V11h12v10M3 21h18M10 21v-5h4v5",
  park: "M12 3l5 8h-3l4 6H6l4-6H7l5-8zM12 17v4",
  beach: "M3 18c2 0 2-1.5 4.5-1.5S9 18 11.5 18s2.5-1.5 4.5-1.5 2.5 1.5 5 1.5M12 14V4M12 4c-4 0-7 3-7 5h14c0-2-3-5-7-5z",
  waterfall: "M5 4h14M7 4v12M12 4v16M17 4v12M4 20c2-1 4-1 8 0s6 1 8 0",
  museum: "M3 9l9-5 9 5M5 9v9M9 9v9M15 9v9M19 9v9M3 20h18",
  cafe: "M5 8h11v6a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4V8zm11 1h2a2 2 0 0 1 0 4h-2",
  restaurant: "M7 3v7M10 3v7M7 10a1.5 1.5 0 0 0 3 0M8.5 10v11M16 3c-2 2-2 6 0 8v10",
  hotel: "M3 11l9-7 9 7M5 10v10h14V10M10 20v-6h4v6",
  fuel: "M4 20V5a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v15M3 20h11M13 9h2a2 2 0 0 1 2 2v5a1.5 1.5 0 0 0 3 0V8l-3-3M6 8h5",
  shop: "M5 8h14l-1 12H6L5 8zM9 8V6a3 3 0 0 1 6 0v2",
  forest: "M12 2l4 6h-2l4 6h-3l3 5H6l3-5H6l4-6H8l4-6zM12 19v3",
  attraction: "M12 21s-6-5.5-6-10a6 6 0 0 1 12 0c0 4.5-6 10-6 10zM12 13a2 2 0 1 0 0-4 2 2 0 0 0 0 4z",
};
// สีจุดของแต่ละประเภท (ชื่อที่ยังไม่เคยไป)
const DOT = { temple: "#A855F7", park: "#22A06B", beach: "#0EA5E9", waterfall: "#0EA5E9", museum: "#8B5CF6", cafe: "#D97706", restaurant: "#E11D48", hotel: "#2563EB", fuel: "#475569", shop: "#0D9488", forest: "#15803D", attraction: "#7C3AED" };
export const KIND_TH = { temple: "วัด", park: "อุทยาน / สวน", beach: "ชายหาด", waterfall: "น้ำตก", museum: "พิพิธภัณฑ์", cafe: "คาเฟ่", restaurant: "ร้านอาหาร", hotel: "ที่พัก", fuel: "ปั๊มน้ำมัน", shop: "ร้านค้า", forest: "ป่า / เขตอนุรักษ์", attraction: "ที่เที่ยว" };
export const keyOf = (p) => (p.kind && ICON[p.kind] ? p.kind : ICON[p.category] ? p.category : "attraction");
export const svgIcon = (k, size, color) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${ICON[k]}"/></svg>`;
const esc = (t) => String(t).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const PRIORITY = { forest: 5, shop: 2, attraction: 5, temple: 5, park: 5, beach: 5, waterfall: 5, museum: 5, hotel: 3, fuel: 3, cafe: 2, restaurant: 1 };

const CSS = `
.qm .maplibregl-map{font-family:'IBM Plex Sans Thai',sans-serif}
.qm .qm-p{display:flex;align-items:flex-end;gap:3px;cursor:pointer;white-space:nowrap}
.qm .qm-p b{width:22px;height:22px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:#fff;border:2px solid var(--c);display:flex;align-items:center;justify-content:center;box-shadow:0 2px 5px rgba(31,36,48,.25);flex-shrink:0}
.qm .qm-p b svg{transform:rotate(45deg)}
.qm .qm-p.v b{width:28px;height:28px;background:${P.accent};border-color:#fff;box-shadow:0 0 0 3px rgba(108,92,231,.25),0 3px 8px rgba(76,61,184,.35)}
.qm .qm-p span{font-size:11px;font-weight:600;color:#374151;margin-bottom:8px;text-shadow:0 0 2px #fff,0 0 2px #fff,0 0 3px #fff,0 0 3px #fff}
.qm .qm-p.v span{font-weight:800;color:${P.accent}}
.qm .qm-p em{font-style:normal;font-size:10px;font-weight:800;color:#fff;background:${P.text};border-radius:999px;padding:0 5px;margin-bottom:22px;margin-left:-10px}
.qm .qm-me{width:16px;height:16px;border-radius:50%;background:#2F80FF;border:3px solid #fff;animation:qmpulse 1.8s infinite}
@keyframes qmpulse{0%{box-shadow:0 0 0 0 rgba(47,128,255,.45)}100%{box-shadow:0 0 0 16px rgba(47,128,255,0)}}
.qm .maplibregl-ctrl-attrib{font-size:9px}
.qm .maplibregl-cooperative-gesture-screen{font-family:'IBM Plex Sans Thai',sans-serif;font-size:15px}
`;

// ย้อมสีแผนที่และตัดตัวหนังสือ/ไอคอนของแผนที่ออกทั้งหมด
function themeStyle(style) {
  const has = (id, words) => words.some(w => id.includes(w));
  style.layers = (style.layers || []).filter(l => l.type !== "symbol").map(l => {
    const id = (l.id || "").toLowerCase(), paint = { ...(l.paint || {}) };
    if (l.type === "background") paint["background-color"] = P.land;
    else if (l.type === "fill") {
      if (has(id, ["water", "ocean", "river", "lake"])) paint["fill-color"] = P.water;
      else if (has(id, ["park", "wood", "forest", "grass", "landcover", "nature", "golf", "cemetery", "farmland", "scrub", "wetland"])) paint["fill-color"] = P.green;
      else if (has(id, ["building"])) { paint["fill-color"] = P.building; delete paint["fill-outline-color"]; }
      else if (has(id, ["landuse", "residential", "industrial", "commercial", "school", "hospital", "pitch", "aeroway", "airport"])) paint["fill-color"] = "#F1EEFB";
      else paint["fill-color"] = P.land;
    } else if (l.type === "line") {
      if (has(id, ["water", "river", "stream", "canal", "drain"])) paint["line-color"] = P.water;
      else if (has(id, ["boundary", "admin"])) paint["line-color"] = "#D8D2F5";
      else if (has(id, ["motorway", "trunk", "primary", "major"])) paint["line-color"] = P.major;
      else if (has(id, ["rail", "transit"])) paint["line-color"] = "#E2DEF3";
      else paint["line-color"] = P.road;
    } else if (l.type === "fill-extrusion") paint["fill-extrusion-color"] = P.building;
    return { ...l, paint };
  });
  return style;
}
const BLANK = { version: 8, sources: {}, layers: [{ id: "bg", type: "background", paint: { "background-color": P.land } }] };
async function loadStyle() {
  try {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 6000);
    const r = await fetch(STYLE_URL, { signal: ctl.signal }); clearTimeout(t);
    if (!r.ok) throw new Error(String(r.status));
    return themeStyle(await r.json());
  } catch { return BLANK; }
}
const bboxOf = (features) => {
  let w = 180, s = 90, e = -180, n = -90;
  const walk = (c) => { if (typeof c[0] === "number") { if (c[0] < w) w = c[0]; if (c[0] > e) e = c[0]; if (c[1] < s) s = c[1]; if (c[1] > n) n = c[1]; } else c.forEach(walk); };
  features.forEach(f => f.geometry && walk(f.geometry.coordinates));
  return w <= e ? [[w, s], [e, n]] : null;
};
// ชื่อสถานที่ทั่วโลกจากข้อมูลในแผ่นแผนที่ (OpenStreetMap ผ่าน OpenFreeMap) — ไม่ต้องเก็บในฐานข้อมูลเรา
// คัดเฉพาะ ร้านค้า ร้านอาหาร คาเฟ่ ปั๊ม ที่พัก ที่เที่ยว วัด อุทยาน/ป่า — ไม่มีบ้านคน สำนักงาน ธนาคาร โรงเรียน
const POI_KIND = {
  fuel: "fuel",
  restaurant: "restaurant", fast_food: "restaurant", food_court: "restaurant", ice_cream: "restaurant", bar: "restaurant", beer: "restaurant", pub: "restaurant",
  cafe: "cafe", bakery: "cafe",
  lodging: "hotel", campsite: "park",
  place_of_worship: "temple",
  park: "park", garden: "park", nature_reserve: "forest",
  museum: "museum", art_gallery: "museum",
  attraction: "attraction", zoo: "attraction", aquarium: "attraction", castle: "attraction", monument: "attraction", theme_park: "attraction", viewpoint: "attraction", information: null, beach: "beach", waterfall: "waterfall",
  grocery: "shop", shop: "shop", alcohol_shop: "shop", books: "shop", clothing_store: "shop", electronics: "shop", furniture: "shop", gift: "shop", hardware: "shop", jewelry: "shop", mobile_phone: "shop", music: "shop", optician: "shop", pet: "shop", sports: "shop", stationery: "shop", toys: "shop", florist: "shop", car: "shop", bicycle: "shop", motorcycle: "shop", department_store: "shop", marketplace: "shop", hairdresser: "shop", laundry: "shop", cosmetics: "shop", photo: "shop", butcher: "shop", deli: "shop", greengrocer: "shop", convenience: "shop", supermarket: "shop", mall: "shop",
};
const PARK_KIND = { national_park: "park", nature_reserve: "forest", protected_area: "forest", forest: "forest", park: "park" };
const THAI = /[\u0E00-\u0E7F]/;
const pickName = (pr) => pr["name:th"] || (pr.name && THAI.test(pr.name) ? pr.name : null) || pr.name_en || pr["name:en"] || pr["name:latin"] || pr.name || "";
const ringPoint = (g) => {
  const ring = g.type === "Polygon" ? g.coordinates[0] : g.type === "MultiPolygon" ? g.coordinates[0][0] : g.type === "Point" ? [g.coordinates] : null;
  if (!ring || !ring.length) return null;
  let w = 180, s = 90, e = -180, n = -90;
  for (const c of ring) { if (c[0] < w) w = c[0]; if (c[0] > e) e = c[0]; if (c[1] < s) s = c[1]; if (c[1] > n) n = c[1]; }
  return [(w + e) / 2, (s + n) / 2];
};
function tilePlaces(map, src) {
  if (!src || map.getZoom() < 12.5) return [];
  const out = [], seen = new Set();
  const push = (id, name, kind, lng, lat, tag) => {
    if (!name || !isFinite(lng) || !isFinite(lat)) return;
    const key = name + "|" + lng.toFixed(3) + "|" + lat.toFixed(3);
    if (seen.has(key)) return; seen.add(key);
    out.push({ id: "osm:" + (id ?? key), name, kind, category: kind, lat, lng, src: tag });
  };
  try {
    for (const f of map.querySourceFeatures(src, { sourceLayer: "poi" })) {
      const pr = f.properties || {};
      const kind = POI_KIND[pr.subclass] || POI_KIND[pr.class];
      if (!kind || f.geometry.type !== "Point") continue;
      push(f.id, pickName(pr), kind, f.geometry.coordinates[0], f.geometry.coordinates[1], "osm");
    }
    for (const f of map.querySourceFeatures(src, { sourceLayer: "park" })) {
      const pr = f.properties || {};
      const kind = PARK_KIND[pr.class] || "park";
      const name = pickName(pr); if (!name) continue;
      if (seen.has("park|" + name)) continue; seen.add("park|" + name);
      const c = ringPoint(f.geometry); if (c) push(f.id, name, kind, c[0], c[1], "osm");
    }
  } catch { /* ยังไม่มีแผ่นแผนที่ */ }
  return out;
}

export default function QuestMap({ items, pins = [], places = [], pos, sel, onSelect, onPin, onPlace, onView, tall }) {
  const box = useRef(null);
  const m = useRef(null);
  const cb = useRef({});
  cb.current = { onSelect, onPin, onPlace, onView };
  const data = useRef({ items, pins, places });
  data.current = { items, pins, places };

  // สร้างแผนที่ครั้งเดียว
  useEffect(() => {
    let dead = false;
    const o = { map: null, markers: [], me: null, ready: false };
    m.current = o;
    loadStyle().then(style => {
      if (dead) return;
      const mobile = matchMedia("(pointer: coarse)").matches;
      const map = new maplibregl.Map({
        container: box.current, style, center: [100.5, 13.7], zoom: 5, attributionControl: false,
        cooperativeGestures: mobile, dragRotate: false, pitchWithRotate: false, touchPitch: false, maxZoom: 18,
        locale: { "CooperativeGesturesHandler.MobileHelpText": "ใช้สองนิ้วเพื่อเลื่อนแผนที่", "CooperativeGesturesHandler.WindowsHelpText": "กด Ctrl ค้างแล้วเลื่อนเพื่อซูม", "CooperativeGesturesHandler.MacHelpText": "กด ⌘ ค้างแล้วเลื่อนเพื่อซูม" },
      });
      map.touchZoomRotate.disableRotation();
      map.addControl(new maplibregl.AttributionControl({ compact: true, customAttribution: "ขอบเขต: OpenGISData-Thailand (CC BY 4.0) · Natural Earth" }), "bottom-right");
      o.map = map;
      map.on("load", () => {
        if (dead) return;
        map.on("moveend", () => { const b = map.getBounds(); cb.current.onView && cb.current.onView({ w: b.getWest(), s: b.getSouth(), e: b.getEast(), n: b.getNorth(), z: map.getZoom() }); });
        // ชั้นล่องหนเพื่อให้แผนที่โหลดข้อมูลจุดสถานที่/อุทยาน (เราวาดชื่อเองด้วย HTML)
        o.src = Object.keys(map.getStyle().sources || {}).find(k => map.getSource(k).type === "vector") || null;
        if (o.src) {
          try {
            map.addLayer({ id: "qm-poi", type: "circle", source: o.src, "source-layer": "poi", minzoom: 12, paint: { "circle-opacity": 0, "circle-radius": 1 } });
            map.addLayer({ id: "qm-park", type: "fill", source: o.src, "source-layer": "park", minzoom: 8, paint: { "fill-opacity": 0 } });
          } catch { /* สไตล์ไม่มีชั้นนี้ */ }
        }
        map.on("idle", () => { const k = map.getZoom().toFixed(2) + map.getCenter().toArray().join(); if (k !== o.idleKey) { o.idleKey = k; draw(); } });
        o.ready = true;
        const at = map.getContainer().querySelector(".maplibregl-ctrl-attrib");
        if (at) at.classList.remove("maplibregl-compact-show"); // เริ่มแบบย่อ แตะ (i) เพื่อดูเครดิต
        setItems(); setMe();
      });
    });
    return () => { dead = true; if (o.map) o.map.remove(); m.current = null; };
  }, []);

  const clearMarkers = () => { const o = m.current; o.markers.forEach(mk => mk.remove()); o.markers = []; };
  const el = (html, cls) => { const d = document.createElement("div"); if (cls) d.className = cls; d.innerHTML = html; return d; };

  // หมุดเดียวทั้งระบบ: ปักตรงพิกัดของสถานที่พร้อมชื่อ — ที่เคยไปเป็นหมุดม่วงเด่น ที่ยังไม่เคยไปเป็นหมุดเล็กตามสีประเภท
  // ชนกันก็ซ่อนอันที่สำคัญน้อยกว่า (ที่เคยไปที่ถูกซ่อนจะนับเป็น +n บนหมุดที่ใกล้สุด แตะเพื่อซูมเข้า)
  const draw = () => {
    const o = m.current; if (!o || !o.ready) return;
    const map = o.map, { pins: pns, places: pls } = data.current;
    clearMarkers();
    const W = map.getContainer().clientWidth, H = map.getContainer().clientHeight;
    const boxes = [[W - 52, 0, 99999, 150]];
    const hit = (b) => boxes.some(x => b[0] < x[2] && b[2] > x[0] && b[1] < x[3] && b[3] > x[1]);
    const inView = (pt) => pt.x > -10 && pt.x < W + 10 && pt.y > -10 && pt.y < H + 30;
    const z = map.getZoom();
    const visited = new Set((pns || []).map(p => String(p.id)));
    const list = [];
    for (const p of pns || []) if (isFinite(p.lat) && isFinite(p.lng)) list.push({ p, v: true });
    const names = new Set();
    for (const p of pls || []) if (isFinite(p.lat) && isFinite(p.lng) && !visited.has(String(p.id))) { list.push({ p, v: false }); names.add(String(p.name).toLowerCase()); }
    for (const p of pns || []) names.add(String(p.name).toLowerCase());
    for (const p of tilePlaces(map, o.src)) if (!names.has(p.name.toLowerCase())) list.push({ p, v: false });
    const cand = list.map(x => ({ ...x, k: keyOf(x.p), pt: map.project([x.p.lng, x.p.lat]) })).filter(x => inView(x.pt))
      .sort((a, b) => (b.v - a.v) || ((PRIORITY[b.k] || 0) - (PRIORITY[a.k] || 0)) || ((b.p.visits || 0) - (a.p.visits || 0)));
    const shown = [];
    let others = 0;
    for (const x of cand) {
      const showName = true;
      const raw = String(x.p.name || "");
      const name = raw.length > 22 ? raw.slice(0, 21) + "…" : raw;
      const pw = x.v ? 30 : 24, w = pw + (showName ? name.length * 6.2 + 6 : 0), h = x.v ? 34 : 28;
      const b = [x.pt.x - pw / 2, x.pt.y - h, x.pt.x - pw / 2 + w, x.pt.y];
      if (hit(b)) {
        if (x.v) { const near = shown.filter(s => s.v).sort((a, c) => Math.hypot(a.pt.x - x.pt.x, a.pt.y - x.pt.y) - Math.hypot(c.pt.x - x.pt.x, c.pt.y - x.pt.y))[0]; if (near) near.more++; }
        continue;
      }
      if (!x.v && others >= 60) continue;
      if (!x.v) others++;
      boxes.push(b);
      shown.push({ ...x, name: showName ? name : "", more: 0 });
    }
    for (const x of shown) {
      const c = x.v ? P.accent : (DOT[x.k] || DOT.attraction);
      const d = el(`<b style="--c:${c}">${svgIcon(x.k, x.v ? 14 : 12, x.v ? "#fff" : c)}</b>${x.more ? `<em>+${x.more}</em>` : ""}${x.name ? `<span>${esc(x.name)}</span>` : ""}`, "qm-p" + (x.v ? " v" : ""));
      d.style.setProperty("--c", c);
      d.dataset[x.v ? "pin" : "place"] = String(x.p.id);
      d.title = `${x.p.name} · ${KIND_TH[x.k] || ""}${x.v ? ` · เช็คอิน ${x.p.visits || 1} ครั้ง` : ""}`;
      d.addEventListener("click", (e) => {
        e.stopPropagation();
        if (x.more) { map.easeTo({ center: [x.p.lng, x.p.lat], zoom: Math.min(18, z + 2), duration: 400 }); return; }
        x.v ? cb.current.onPin && cb.current.onPin(x.p) : cb.current.onPlace && cb.current.onPlace(x.p);
      });
      // ปลายหมุดอยู่ตรงพิกัดพอดี: ยึดมุมล่างซ้าย แล้วเลื่อนครึ่งความกว้างหัวหมุด
      const mk = new maplibregl.Marker({ element: d, anchor: "bottom-left", offset: x.v ? [-16, -7] : [-13, -5] }).setLngLat([x.p.lng, x.p.lat]).addTo(map);
      o.markers.push(mk);
    }
  };

  const fit = (animate) => {
    const o = m.current; if (!o || !o.ready) return;
    const b = bboxOf((data.current.items || []).map(t => t.f));
    if (!b) return;
    o.map.resize();
    o.map.fitBounds(b, { padding: 18, duration: animate ? 500 : 0, maxZoom: 15 });
  };
  const setItems = () => { fit(false); draw(); };
  const setMe = () => {
    const o = m.current; if (!o || !o.ready) return;
    if (o.me) { o.me.remove(); o.me = null; }
    if (pos && isFinite(pos.lat) && isFinite(pos.lng)) o.me = new maplibregl.Marker({ element: el("", "qm-me") }).setLngLat([pos.lng, pos.lat]).addTo(o.map);
  };

  useEffect(() => { setItems(); }, [items]);
  useEffect(() => { draw(); }, [pins, places]);
  useEffect(() => { setMe(); }, [pos && pos.lat, pos && pos.lng]);
  // แตะตำบลในรายการ → บินไปที่ตำบลนั้น
  useEffect(() => {
    const o = m.current; if (!o || !o.ready || !sel) return;
    const t = (data.current.items || []).find(x => x.code === sel);
    if (t && t.kind === "sub") { const b = bboxOf([t.f]); if (b) o.map.fitBounds(b, { padding: 24, duration: 500 }); }
  }, [sel]);
  useEffect(() => { const id = setTimeout(() => fit(true), 280); return () => clearTimeout(id); }, [tall]);

  const zoom = (d) => { const o = m.current; if (o && o.map) o.map.zoomTo(o.map.getZoom() + d, { duration: 300 }); };
  const btn = "w-9 h-9 rounded-xl bg-white/95 flex items-center justify-center text-[18px] shadow-sm";
  return (
    <div className="qm relative rounded-2xl overflow-hidden" style={{ height: tall ? "62vh" : 280, transition: "height .25s ease", background: P.land, border: `1px solid ${P.line}` }} data-testid="qb-map">
      <style>{CSS}</style>
      <div ref={box} style={{ position: "absolute", inset: 0 }} role="region" aria-label="แผนที่ พื้นที่ที่ปลดล็อกแล้วไม่มีหมอก" />
      <div className="absolute right-2 top-2 flex flex-col gap-1.5" style={{ zIndex: 5 }}>
        <button onClick={() => zoom(1)} aria-label="ซูมเข้า" className={btn} style={{ color: P.text, border: `1px solid ${P.line}` }}>+</button>
        <button onClick={() => zoom(-1)} aria-label="ซูมออก" className={btn} style={{ color: P.text, border: `1px solid ${P.line}` }}>−</button>
        <button onClick={() => fit(true)} aria-label="ดูทั้งหมด" className={btn} style={{ border: `1px solid ${P.line}` }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={P.accent} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></svg>
        </button>
      </div>
    </div>
  );
}
