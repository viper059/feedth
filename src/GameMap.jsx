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
  attraction: "M12 21s-6-5.5-6-10a6 6 0 0 1 12 0c0 4.5-6 10-6 10zM12 13a2 2 0 1 0 0-4 2 2 0 0 0 0 4z",
};
// สีจุดของแต่ละประเภท (ชื่อที่ยังไม่เคยไป)
const DOT = { temple: "#A855F7", park: "#22A06B", beach: "#0EA5E9", waterfall: "#0EA5E9", museum: "#8B5CF6", cafe: "#D97706", restaurant: "#E11D48", hotel: "#2563EB", fuel: "#475569", attraction: "#7C3AED" };
export const KIND_TH = { temple: "วัด", park: "อุทยาน / สวน", beach: "ชายหาด", waterfall: "น้ำตก", museum: "พิพิธภัณฑ์", cafe: "คาเฟ่", restaurant: "ร้านอาหาร", hotel: "ที่พัก", fuel: "ปั๊มน้ำมัน", attraction: "ที่เที่ยว" };
export const keyOf = (p) => (p.kind && ICON[p.kind] ? p.kind : ICON[p.category] ? p.category : "attraction");
export const svgIcon = (k, size, color) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${ICON[k]}"/></svg>`;
const esc = (t) => String(t).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const PRIORITY = { attraction: 5, temple: 5, park: 5, beach: 5, waterfall: 5, museum: 5, hotel: 3, fuel: 3, cafe: 2, restaurant: 1 };

const CSS = `
.qm .maplibregl-map{font-family:'IBM Plex Sans Thai',sans-serif}
.qm .qm-label{background:rgba(255,255,255,.95);color:${P.text};border-radius:999px;padding:2px 9px;font-size:11.5px;font-weight:700;white-space:nowrap;box-shadow:0 2px 6px rgba(76,61,184,.18);pointer-events:none}
.qm .qm-label.here{background:${P.accent};color:#fff}
.qm .qm-label.off{background:rgba(255,255,255,.85);color:#6B7280;font-weight:600}
.qm .qm-pin{width:32px;height:32px;border-radius:50%;background:#fff;border:2.5px solid ${P.accent};display:flex;align-items:center;justify-content:center;box-shadow:0 3px 8px rgba(76,61,184,.28);position:relative;cursor:pointer}
.qm .qm-pin:after{content:"";position:absolute;bottom:-8px;left:50%;margin-left:-5px;border:5px solid transparent;border-top:6px solid ${P.accent}}
.qm .qm-clu{width:34px;height:34px;border-radius:50%;background:${P.accent};color:#fff;border:3px solid #fff;font-weight:800;font-size:13px;display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 5px rgba(108,92,231,.2);cursor:pointer}
.qm .qm-place{display:flex;align-items:center;gap:4px;cursor:pointer;white-space:nowrap}
.qm .qm-place i{width:9px;height:9px;border-radius:50%;border:2px solid #fff;box-shadow:0 1px 2px rgba(0,0,0,.25);flex-shrink:0}
.qm .qm-place span{font-size:11px;font-weight:600;color:#374151;text-shadow:0 0 2px #fff,0 0 2px #fff,0 0 3px #fff}
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
// จุดวางป้าย: จุดศูนย์กลางพื้นที่ของวงที่ใหญ่ที่สุด (ป้ายไม่หลุดไปนอกพื้นที่รูปตัว C)
const labelPoint = (f) => {
  const polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.type === "MultiPolygon" ? f.geometry.coordinates : [];
  let best = null, bestA = -1;
  for (const p of polys) {
    const ring = p[0]; let a = 0, cx = 0, cy = 0;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const k = ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1]; a += k; cx += (ring[j][0] + ring[i][0]) * k; cy += (ring[j][1] + ring[i][1]) * k; }
    if (Math.abs(a) > bestA && a !== 0) { bestA = Math.abs(a); best = [cx / (3 * a), cy / (3 * a)]; }
  }
  return best && isFinite(best[0]) && isFinite(best[1]) ? best : null;
};

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
        map.addSource("areas", { type: "geojson", data: { type: "FeatureCollection", features: [] }, promoteId: "code" });
        map.addLayer({ id: "area-fill", type: "fill", source: "areas", paint: {
          "fill-color": ["match", ["get", "st"], "here", P.accent, "on", P.accent, "#ADA6CF"],
          // ซูมใกล้แล้วหมอกจางลง ให้เห็นถนน/ร้านข้างใต้
          "fill-opacity": ["interpolate", ["linear"], ["zoom"], 11, ["match", ["get", "st"], "here", 0.22, "on", 0.07, 0.55], 15, ["match", ["get", "st"], "here", 0.12, "on", 0.03, 0.3]],
        } });
        map.addLayer({ id: "area-line", type: "line", source: "areas", paint: {
          "line-color": ["case", ["boolean", ["feature-state", "sel"], false], P.text, ["match", ["get", "st"], "off", "#FFFFFF", P.accent]],
          "line-width": ["case", ["boolean", ["feature-state", "sel"], false], 3, ["match", ["get", "st"], "off", 1, 2]],
        } });
        map.on("click", "area-fill", (e) => { const f = e.features && e.features[0]; if (f) cb.current.onSelect && cb.current.onSelect(f.properties.code); });
        map.on("mouseenter", "area-fill", () => { map.getCanvas().style.cursor = "pointer"; });
        map.on("mouseleave", "area-fill", () => { map.getCanvas().style.cursor = ""; });
        map.on("moveend", () => { draw(); const b = map.getBounds(); cb.current.onView && cb.current.onView({ w: b.getWest(), s: b.getSouth(), e: b.getEast(), n: b.getNorth(), z: map.getZoom() }); });
        o.ready = true;
        const at = map.getContainer().querySelector(".maplibregl-ctrl-attrib");
        if (at) at.classList.remove("maplibregl-compact-show"); // เริ่มแบบย่อ แตะ (i) เพื่อดูเครดิต
        setItems(); setMe();
      });
    });
    return () => { dead = true; if (o.map) o.map.remove(); m.current = null; };
  }, []);

  const clearMarkers = () => { const o = m.current; o.markers.forEach(mk => mk.remove()); o.markers = []; };
  const add = (lnglat, el, anchor = "center") => { const o = m.current; const mk = new maplibregl.Marker({ element: el, anchor }).setLngLat(lnglat).addTo(o.map); o.markers.push(mk); return mk; };
  const el = (html, cls) => { const d = document.createElement("div"); if (cls) d.className = cls; d.innerHTML = html; return d; };

  // ป้าย/หมุด/ชื่อสถานที่: วาดใหม่หลังเลื่อน/ซูมเสร็จ ชนกันก็ซ่อนอันที่สำคัญน้อยกว่า
  const draw = () => {
    const o = m.current; if (!o || !o.ready) return;
    const map = o.map, { items: its, pins: pns, places: pls } = data.current;
    clearMarkers();
    const boxes = [[map.getContainer().clientWidth - 52, 0, 99999, 150]], W = map.getContainer().clientWidth, H = map.getContainer().clientHeight;
    const free = (b) => b[2] > 0 && b[0] < W && b[3] > 0 && b[1] < H && !boxes.some(x => b[0] < x[2] && b[2] > x[0] && b[1] < x[3] && b[3] > x[1]);
    const proj = (lng, lat) => map.project([lng, lat]);
    // 1) หมุดที่เคยไป (รวมกลุ่มที่ชิดกัน)
    const groups = [];
    for (const p of pns) {
      if (!isFinite(p.lat) || !isFinite(p.lng)) continue;
      const pt = proj(p.lng, p.lat);
      const g = groups.find(g => Math.hypot(g.pt.x - pt.x, g.pt.y - pt.y) < 40);
      if (g) g.items.push(p); else groups.push({ pt, items: [p] });
    }
    for (const g of groups) {
      boxes.push([g.pt.x - 18, g.pt.y - 42, g.pt.x + 18, g.pt.y]);
      if (g.items.length === 1) {
        const p = g.items[0], d = el(svgIcon(keyOf(p), 16, P.accent), "qm-pin");
        d.dataset.pin = String(p.id); d.title = p.name;
        d.addEventListener("click", (e) => { e.stopPropagation(); cb.current.onPin && cb.current.onPin(p); });
        add([p.lng, p.lat], d, "bottom");
      } else {
        const lng = g.items.reduce((a, p) => a + p.lng, 0) / g.items.length, lat = g.items.reduce((a, p) => a + p.lat, 0) / g.items.length;
        const d = el(String(g.items.length), "qm-clu");
        d.addEventListener("click", (e) => {
          e.stopPropagation();
          const b = bboxOf(g.items.map(p => ({ geometry: { coordinates: [p.lng, p.lat] } })));
          if (b) map.fitBounds(b, { padding: 60, maxZoom: Math.min(18, map.getZoom() + 3), duration: 500 });
        });
        add([lng, lat], d);
      }
    }
    // 2) ชื่อพื้นที่ที่ปลดล็อก (ที่อยู่ตอนนี้มาก่อน)
    const lab = (its || []).filter(t => t.on || t.here).map(t => ({ t, c: labelPoint(t.f) })).filter(x => x.c).sort((a, b) => b.t.here - a.t.here);
    for (const { t, c } of lab) {
      const pt = proj(c[0], c[1]), w = t.name.length * 6.6 + 18, b = [pt.x - w / 2, pt.y - 10, pt.x + w / 2, pt.y + 10];
      if (!t.here && !free(b)) continue;
      boxes.push(b);
      add(c, el(esc(t.name), "qm-label" + (t.here ? " here" : "")));
    }
    // 3) ชื่อสถานที่ (ร้าน ที่เที่ยว ที่พัก อุทยาน ฯลฯ) — ที่เที่ยวสำคัญกว่าร้าน
    const seen = new Set(pns.map(p => String(p.id)));
    const cand = (pls || []).filter(p => isFinite(p.lat) && isFinite(p.lng) && !seen.has(String(p.id)))
      .map(p => ({ p, k: keyOf(p), pt: proj(p.lng, p.lat) })).filter(x => x.pt.x > -20 && x.pt.x < W + 20 && x.pt.y > -20 && x.pt.y < H + 20)
      .sort((a, b) => (PRIORITY[b.k] || 0) - (PRIORITY[a.k] || 0));
    let shown = 0;
    for (const { p, k, pt } of cand) {
      if (shown >= 60) break;
      const name = String(p.name).length > 24 ? String(p.name).slice(0, 23) + "…" : String(p.name);
      const w = name.length * 6.2 + 16, b = [pt.x - 6, pt.y - 9, pt.x + w, pt.y + 9];
      if (!free(b)) continue;
      boxes.push(b); shown++;
      const d = el(`<i style="background:${DOT[k] || DOT.attraction}"></i><span>${esc(name)}</span>`, "qm-place");
      d.dataset.place = String(p.id); d.title = `${p.name} · ${KIND_TH[k] || ""}`;
      d.addEventListener("click", (e) => { e.stopPropagation(); cb.current.onPlace && cb.current.onPlace(p); });
      add([p.lng, p.lat], d, "left");
    }
  };

  const fit = (animate) => {
    const o = m.current; if (!o || !o.ready) return;
    const b = bboxOf((data.current.items || []).map(t => t.f));
    if (!b) return;
    o.map.resize();
    o.map.fitBounds(b, { padding: 18, duration: animate ? 500 : 0, maxZoom: 15 });
  };
  const setItems = () => {
    const o = m.current; if (!o || !o.ready) return;
    const fc = { type: "FeatureCollection", features: (data.current.items || []).map(t => ({ type: "Feature", geometry: t.f.geometry, properties: { code: t.code, st: t.here ? "here" : t.on ? "on" : "off" } })) };
    o.map.getSource("areas").setData(fc);
    o.sel = null;
    fit(false);
    draw();
  };
  const setMe = () => {
    const o = m.current; if (!o || !o.ready) return;
    if (o.me) { o.me.remove(); o.me = null; }
    if (pos && isFinite(pos.lat) && isFinite(pos.lng)) o.me = new maplibregl.Marker({ element: el("", "qm-me") }).setLngLat([pos.lng, pos.lat]).addTo(o.map);
  };

  useEffect(() => { setItems(); }, [items]);
  useEffect(() => { draw(); }, [pins, places]);
  useEffect(() => { setMe(); }, [pos && pos.lat, pos && pos.lng]);
  // พื้นที่ที่เลือก: ขอบเข้ม + บินไปหา (เฉพาะตำบล)
  useEffect(() => {
    const o = m.current; if (!o || !o.ready) return;
    if (o.sel) o.map.setFeatureState({ source: "areas", id: o.sel }, { sel: false });
    o.sel = sel || null;
    if (!sel) return;
    o.map.setFeatureState({ source: "areas", id: sel }, { sel: true });
    const t = (data.current.items || []).find(x => x.code === sel);
    if (t && t.kind === "sub") { const b = bboxOf([t.f]); if (b) o.map.fitBounds(b, { padding: 24, duration: 500 }); }
  }, [sel, items]);
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
