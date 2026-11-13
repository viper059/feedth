// แผนที่เกมเต็มจอ (ซูมได้): ตำบลทั้งจังหวัด ปลดล็อกแล้วมีสี ที่ยังไม่ไปเป็นหมอก
// ใช้ Leaflet ซึ่งซูมลื่นบนมือถือ ไม่มีแผนที่ถนนพื้นหลัง (ไม่พึ่งผู้ให้บริการภายนอก)
import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { geoCentroid, geoDistance } from "d3-geo";

const P = { accent: "#6C5CE7", soft: "#C9C1FF", text: "#1F2430", muted: "#6B7280", line: "#E4E6EF", bg: "#F3F5FA" };
// ไอคอนตามประเภท: ใช้ประเภทย่อย (วัด อุทยาน ชายหาด น้ำตก พิพิธภัณฑ์) ก่อน ถ้าไม่มีใช้หมวดหลัก
const ICON = {
  temple: "M12 3l3 4h-6l3-4zM6 21V11h12v10M3 21h18M10 21v-5h4v5",
  park: "M12 3l5 8h-3l4 6H6l4-6H7l5-8zM12 17v4",
  beach: "M3 18c2 0 2-1.5 4.5-1.5S9 18 11.5 18s2.5-1.5 4.5-1.5 2.5 1.5 5 1.5M12 14V4M12 4c-4 0-7 3-7 5h14c0-2-3-5-7-5z",
  waterfall: "M5 4h14M7 4v12M12 4v16M17 4v12M4 20c2-1 4-1 8 0s6 1 8 0",
  museum: "M3 9l9-5 9 5M5 9v9M9 9v9M15 9v9M19 9v9M3 20h18",
  cafe: "M5 8h11v6a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4V8zm11 1h2a2 2 0 0 1 0 4h-2",
  restaurant: "M7 3v7M10 3v7M7 10a1.5 1.5 0 0 0 3 0M8.5 10v11M16 3c-2 2-2 6 0 8v10",
  hotel: "M3 11l9-7 9 7M5 10v10h14V10M10 20v-6h4v6",
  attraction: "M12 21s-6-5.5-6-10a6 6 0 0 1 12 0c0 4.5-6 10-6 10zM12 13a2 2 0 1 0 0-4 2 2 0 0 0 0 4z",
};
const KIND_TH = { temple: "วัด", park: "อุทยาน / สวน", beach: "ชายหาด", waterfall: "น้ำตก", museum: "พิพิธภัณฑ์", cafe: "คาเฟ่", restaurant: "ร้านอาหาร", hotel: "ที่พัก", attraction: "ที่เที่ยว", other: "อื่นๆ" };
const keyOf = (p) => (p.kind && ICON[p.kind] ? p.kind : ICON[p.category] ? p.category : "attraction");
const svgIcon = (k, size, color) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${ICON[k]}"/></svg>`;
const kmText = (km) => (km < 1 ? `${Math.round(km * 1000)} ม.` : `${km.toFixed(1)} กม.`);
const store = { get(k) { try { return localStorage.getItem(k); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch { /* ignore */ } } };
const CSS = `
.gm .leaflet-container{background:#ffffff;font-family:'IBM Plex Sans Thai',sans-serif}
.gm path.leaflet-interactive{transition:fill .9s ease, fill-opacity .9s ease}
.gm .gm-label{background:#fff;color:${P.text};border-radius:10px;padding:1px 8px;font-size:12px;font-weight:700;white-space:nowrap;box-shadow:0 1px 3px rgba(31,36,48,.18);transform:translate(-50%,-50%);display:inline-block;transition:opacity .2s}
.gm .gm-label.here{background:${P.accent};color:#fff}
.gm .gm-pin{width:36px;height:36px;border-radius:50%;background:#fff;border:3px solid ${P.accent};display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(31,36,48,.25);transform:translate(-50%,-100%);position:relative}
.gm .gm-pin:after{content:"";position:absolute;bottom:-9px;left:50%;margin-left:-6px;border:6px solid transparent;border-top:7px solid ${P.accent}}
.gm .gm-pin.sel{width:46px;height:46px;background:${P.accent}}
.gm .gm-clu{width:38px;height:38px;border-radius:50%;background:${P.accent};color:#fff;border:3px solid #fff;font-weight:800;font-size:14px;display:flex;align-items:center;justify-content:center;transform:translate(-50%,-50%);box-shadow:0 0 0 6px rgba(108,92,231,.22)}
.gm .gm-me{width:18px;height:18px;border-radius:50%;background:${P.accent};border:3px solid #fff;transform:translate(-50%,-50%);box-shadow:0 0 0 0 rgba(108,92,231,.5);animation:gmpulse 1.8s infinite}
@keyframes gmpulse{0%{box-shadow:0 0 0 0 rgba(108,92,231,.5)}100%{box-shadow:0 0 0 18px rgba(108,92,231,0)}}
.gm .leaflet-div-icon{background:none;border:0}
`;

export default function GameMap({ feats, unlocked, pins, here, pos, title, onClose, onOpenPlace, showToast = () => {} }) {
  const box = useRef(null);
  const m = useRef(null);
  const [sel, setSel] = useState(null); // { type: "pin", p } | { type: "area", f, on }
  const [target, setTarget] = useState(null); // ตำบลที่ยังไม่ปลดล็อกที่ใกล้ที่สุด
  const done = feats.filter(f => unlocked.has(String(f.properties.c))).length;

  useEffect(() => {
    const map = L.map(box.current, { zoomControl: false, attributionControl: true, zoomSnap: 0.25, wheelPxPerZoomLevel: 90 });
    map.attributionControl.setPrefix(false).addAttribution("ขอบเขต: OpenGISData-Thailand (CC BY 4.0)");
    const o = { map, labels: L.layerGroup().addTo(map), pinLayer: L.layerGroup().addTo(map) };
    m.current = o;


    // ตำบลที่เพิ่งปลดล็อกตั้งแต่เปิดครั้งก่อน → เล่นแอนิเมชันหมอกจาง
    const seenKey = "gm_seen_" + (feats[0]?.properties.c || "").slice(0, 2);
    const seenRaw = store.get(seenKey);
    const seen = seenRaw ? new Set(JSON.parse(seenRaw)) : null;
    const fresh = seen ? feats.filter(f => unlocked.has(String(f.properties.c)) && !seen.has(String(f.properties.c))) : [];
    store.set(seenKey, JSON.stringify([...unlocked].filter(c => feats.some(f => String(f.properties.c) === c))));

    const styleOf = (f, lockedNow) => {
      const c = String(f.properties.c), on = unlocked.has(c) && !lockedNow, isHere = here?.sub === c;
      if (isHere) return { fillColor: P.accent, fillOpacity: 1, color: "#ffffff", weight: 2.5 };
      if (on) return { fillColor: P.soft, fillOpacity: 1, color: P.accent, weight: 1.5 };
      return { fillColor: "#DADFEA", fillOpacity: 1, color: "#ffffff", weight: 1.2 };
    };
    const freshSet = new Set(fresh.map(f => String(f.properties.c)));
    const layer = L.geoJSON({ type: "FeatureCollection", features: feats }, {
      style: (f) => styleOf(f, freshSet.has(String(f.properties.c))),
      onEachFeature: (f, lyr) => lyr.on("click", () => setSel({ type: "area", f, on: unlocked.has(String(f.properties.c)) })),
    }).addTo(map);
    o.layer = layer;
    const bounds = layer.getBounds();
    map.fitBounds(bounds, { padding: [20, 20] });
    const z0 = map.getZoom();
    map.setMinZoom(z0 - 0.5); map.setMaxZoom(z0 + 6);
    map.setMaxBounds(bounds.pad(0.4));

    if (fresh.length) {
      setTimeout(() => {
        layer.eachLayer(l => { if (freshSet.has(String(l.feature.properties.c))) l.setStyle(styleOf(l.feature, false)); });
        const f = fresh[0];
        showToast(`ปลดล็อก ต.${f.properties.th}${fresh.length > 1 ? ` และอีก ${fresh.length - 1} ตำบล` : ""} แล้ว!`);
      }, 700);
    }

    // ป้ายชื่อตำบลที่ปลดล็อก + หมุดสถานที่: วาดใหม่หลังซูมเสร็จ (ไม่คำนวณระหว่างซูม จึงไม่หน่วง)
    const draw = () => {
      o.labels.clearLayers(); o.pinLayer.clearLayers();
      const boxes = [];
      const free = (b) => !boxes.some(x => b[0] < x[2] && b[2] > x[0] && b[1] < x[3] && b[3] > x[1]);
      // หมุด (รวมกลุ่มที่ชิดกัน)
      const groups = [];
      for (const p of pins) {
        const pt = map.latLngToContainerPoint([p.lat, p.lng]);
        const g = groups.find(g => Math.hypot(g.pt.x - pt.x, g.pt.y - pt.y) < 42);
        if (g) g.items.push(p); else groups.push({ pt, items: [p] });
      }
      for (const g of groups) {
        boxes.push([g.pt.x - 20, g.pt.y - 46, g.pt.x + 20, g.pt.y]);
        if (g.items.length === 1) {
          const p = g.items[0], k = keyOf(p);
          const mk = L.marker([p.lat, p.lng], { icon: L.divIcon({ className: "", html: `<div class="gm-pin" data-pin="${p.id}">${svgIcon(k, 18, P.accent)}</div>`, iconSize: [0, 0] }), keyboard: true, title: p.name });
          mk.on("click", () => setSel({ type: "pin", p })).addTo(o.pinLayer);
        } else {
          const lat = g.items.reduce((a, p) => a + p.lat, 0) / g.items.length, lng = g.items.reduce((a, p) => a + p.lng, 0) / g.items.length;
          const mk = L.marker([lat, lng], { icon: L.divIcon({ className: "", html: `<div class="gm-clu">${g.items.length}</div>`, iconSize: [0, 0] }), title: `${g.items.length} สถานที่` });
          mk.on("click", () => map.flyToBounds(L.latLngBounds(g.items.map(p => [p.lat, p.lng])), { padding: [80, 80], maxZoom: map.getMaxZoom(), duration: 0.6 })).addTo(o.pinLayer);
        }
      }
      // ชื่อตำบล (เฉพาะที่ปลดล็อก) ซ่อนอันที่ชนกัน
      const lab = feats.filter(f => unlocked.has(String(f.properties.c)) || here?.sub === String(f.properties.c))
        .map(f => { const [x, y] = geoCentroid(f); return { f, ll: [y, x], pt: map.latLngToContainerPoint([y, x]), isHere: here?.sub === String(f.properties.c) }; })
        .sort((a, b) => b.isHere - a.isHere);
      for (const l of lab) {
        const name = (l.isHere ? "คุณอยู่ที่นี่ · " : "") + l.f.properties.th, w = name.length * 7 + 18;
        const b = [l.pt.x - w / 2, l.pt.y - 11, l.pt.x + w / 2, l.pt.y + 11];
        if (!l.isHere && !free(b)) continue;
        boxes.push(b);
        L.marker(l.ll, { icon: L.divIcon({ className: "", html: `<span class="gm-label${l.isHere ? " here" : ""}">${name.replace(/</g, "&lt;")}</span>`, iconSize: [0, 0] }), interactive: false, keyboard: false }).addTo(o.labels);
      }
    };
    o.draw = draw;
    map.on("zoomend", draw);
    draw();

    return () => { map.remove(); m.current = null; };
  }, []);

  // ตัวฉัน + เส้นประไปตำบลถัดไปที่ใกล้ที่สุด
  useEffect(() => {
    const o = m.current; if (!o) return;
    if (o.me) { o.me.remove(); o.me = null; }
    if (o.line) { o.line.remove(); o.line = null; }
    if (!pos) { setTarget(null); return; }
    o.me = L.marker([pos.lat, pos.lng], { icon: L.divIcon({ className: "", html: `<div class="gm-me"></div>`, iconSize: [0, 0] }), interactive: false, keyboard: false }).addTo(o.map);
    let best = null;
    for (const f of feats) {
      if (unlocked.has(String(f.properties.c)) || here?.sub === String(f.properties.c)) continue;
      const c = geoCentroid(f), km = geoDistance([pos.lng, pos.lat], c) * 6371;
      if (!best || km < best.km) best = { f, km, ll: [c[1], c[0]] };
    }
    setTarget(best);
    if (best) o.line = L.polyline([[pos.lat, pos.lng], best.ll], { color: P.accent, weight: 3, dashArray: "2 10", lineCap: "round", interactive: false }).addTo(o.map);
  }, [pos && pos.lat, pos && pos.lng]);

  const zoom = (d) => m.current && m.current.map.zoomIn(d);
  const toMe = () => { if (m.current && pos) m.current.map.flyTo([pos.lat, pos.lng], Math.max(m.current.map.getZoom(), m.current.map.getMinZoom() + 2.5), { duration: 0.6 }); else showToast("ยังไม่มีตำแหน่งของคุณ"); };
  const navUrl = (ll) => `https://www.google.com/maps/dir/?api=1&destination=${ll[0]},${ll[1]}`;

  const selPin = sel?.type === "pin" ? sel.p : null;
  const selArea = sel?.type === "area" ? sel : null;
  const areaKm = selArea && pos ? geoDistance([pos.lng, pos.lat], geoCentroid(selArea.f)) * 6371 : null;
  const areaLL = selArea ? (() => { const c = geoCentroid(selArea.f); return [c[1], c[0]]; })() : null;

  const btn = "w-11 h-11 rounded-2xl bg-white flex items-center justify-center shadow-sm";
  return (
    <div className="gm fixed inset-0 z-[60] bg-[#F3F5FA]" role="dialog" aria-label="แผนที่สำรวจ" data-testid="game-map">
      <style>{CSS}</style>
      <div ref={box} className="absolute inset-0" />

      <div className="absolute left-3 right-3 top-3 flex items-center gap-2 z-[1000]">
        <button onClick={onClose} aria-label="ปิดแผนที่" className={btn} style={{ border: `1px solid ${P.line}` }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={P.text} strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
        <div className="flex-1 min-w-0 bg-white rounded-2xl px-3 py-1.5 shadow-sm" style={{ border: `1px solid ${P.line}` }}>
          <p className="text-[15px] font-semibold leading-tight truncate" style={{ fontFamily: "'Kanit', sans-serif", color: P.text }}>{title}</p>
          <div className="flex items-center gap-2 mt-1">
            <div className="flex-1 h-1.5 rounded overflow-hidden" style={{ background: P.line }}><div className="h-full" style={{ width: (feats.length ? (done / feats.length) * 100 : 0) + "%", background: P.accent }} /></div>
            <span className="text-[11px] tabular-nums" style={{ color: P.muted }} data-testid="gm-progress">ตำบล {done}/{feats.length}</span>
          </div>
        </div>
      </div>

      <div className="absolute right-3 top-1/3 flex flex-col gap-2 z-[1000]">
        <button onClick={() => zoom(1)} aria-label="ซูมเข้า" className={btn + " text-xl"} style={{ border: `1px solid ${P.line}`, color: P.text }}>+</button>
        <button onClick={() => zoom(-1)} aria-label="ซูมออก" className={btn + " text-xl"} style={{ border: `1px solid ${P.line}`, color: P.text }}>−</button>
        <button onClick={toMe} aria-label="กลับมาที่ตำแหน่งของฉัน" className={btn} style={{ border: `1px solid ${P.line}` }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={P.accent} strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v4M12 18v4M2 12h4M18 12h4" /></svg>
        </button>
      </div>

      <div className="absolute left-3 right-3 bottom-4 z-[1000] bg-white rounded-3xl p-4 space-y-3 shadow-lg" style={{ border: `1px solid ${P.line}` }} data-testid="gm-card">
        {selPin ? (<>
          <div className="flex items-center gap-3">
            <span className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0" style={{ background: "#EFECFF" }} dangerouslySetInnerHTML={{ __html: svgIcon(keyOf(selPin), 24, P.accent) }} />
            <div className="min-w-0 flex-1">
              <p className="text-[16px] font-bold truncate" style={{ color: P.text }}>{selPin.name}</p>
              <p className="text-[12px]" style={{ color: P.muted }}>{KIND_TH[keyOf(selPin)]}{selPin.visits ? ` · เช็คอิน ${selPin.visits} ครั้ง` : ""}{selPin.last_at ? ` · ล่าสุด ${new Date(selPin.last_at).toLocaleDateString("th-TH", { day: "numeric", month: "short" })}` : ""}</p>
            </div>
          </div>
          <div className="flex gap-2">
            {/^\d+$/.test(String(selPin.id)) && <button onClick={() => onOpenPlace(selPin.id)} className="flex-1 min-h-[46px] rounded-2xl text-white text-sm font-bold" style={{ background: P.accent }}>ดูหน้าสถานที่</button>}
            <button onClick={() => setSel(null)} className="min-h-[46px] px-4 rounded-2xl text-sm font-semibold" style={{ border: `1px solid ${P.line}`, color: P.text }}>ปิด</button>
          </div>
        </>) : selArea ? (<>
          <div>
            <p className="text-[16px] font-bold" style={{ color: P.text, fontFamily: "'Kanit', sans-serif" }}>{selArea.on || here?.sub === String(selArea.f.properties.c) ? "ต." + selArea.f.properties.th : "ตำบลที่ยังไม่ปลดล็อก"}</p>
            <p className="text-[12px]" style={{ color: P.muted }}>{selArea.on ? "ปลดล็อกแล้ว" : `${areaKm != null ? `ห่างราว ${kmText(areaKm)} · ` : ""}ไปเช็คอินในพื้นที่นี้เพื่อเปิดชื่อ`}</p>
          </div>
          <div className="flex gap-2">
            {!selArea.on && <a href={navUrl(areaLL)} target="_blank" rel="noopener noreferrer" className="flex-1 min-h-[46px] rounded-2xl text-white text-sm font-bold flex items-center justify-center" style={{ background: P.accent }}>นำทางด้วย Google Maps</a>}
            <button onClick={() => setSel(null)} className={(selArea.on ? "flex-1 " : "") + "min-h-[46px] px-4 rounded-2xl text-sm font-semibold"} style={{ border: `1px solid ${P.line}`, color: P.text }}>ปิด</button>
          </div>
        </>) : target ? (<>
          <div className="flex items-center gap-3">
            <span className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0" style={{ background: "#EFECFF" }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={P.accent} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 11V8a5 5 0 0 1 10 0v3M5 11h14v10H5z" /></svg>
            </span>
            <div>
              <p className="text-[12px]" style={{ color: P.muted }}>เป้าถัดไป · ตำบลที่ยังไม่ปลดล็อก</p>
              <p className="text-[17px] font-semibold" style={{ color: P.text, fontFamily: "'Kanit', sans-serif" }}>ห่างราว {kmText(target.km)}</p>
            </div>
          </div>
          <a href={navUrl(target.ll)} target="_blank" rel="noopener noreferrer" className="w-full min-h-[46px] rounded-2xl text-white text-sm font-bold flex items-center justify-center" style={{ background: P.accent }}>นำทางด้วย Google Maps</a>
        </>) : (
          <p className="text-[13px]" style={{ color: P.muted }}>{done === feats.length && feats.length ? "ปลดล็อกครบทุกตำบลในจังหวัดนี้แล้ว" : "แตะพื้นที่หรือหมุดเพื่อดูรายละเอียด · บีบนิ้วเพื่อซูม"}</p>
        )}
      </div>
    </div>
  );
}
