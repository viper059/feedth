// แผนที่ในกรอบของกระดานด่าน (ซูมได้ ไม่ต้องเปิดหน้าใหม่)
// ใช้ Leaflet ซึ่งบีบนิ้วซูมลื่นบนมือถือ ไม่มีแผนที่ถนนพื้นหลัง (ไม่พึ่งผู้ให้บริการภายนอก)
// นิ้วเดียว = เลื่อนหน้าตามปกติ · สองนิ้ว = ซูม/เลื่อนแผนที่ (ไม่ดักการเลื่อนหน้า)
import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { geoCentroid } from "d3-geo";

const P = { accent: "#6C5CE7", soft: "#C9C1FF", text: "#1F2430", line: "#E4E6EF", fog: "#DFE3EC" };
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
export const KIND_TH = { temple: "วัด", park: "อุทยาน / สวน", beach: "ชายหาด", waterfall: "น้ำตก", museum: "พิพิธภัณฑ์", cafe: "คาเฟ่", restaurant: "ร้านอาหาร", hotel: "ที่พัก", attraction: "ที่เที่ยว" };
export const keyOf = (p) => (p.kind && ICON[p.kind] ? p.kind : ICON[p.category] ? p.category : "attraction");
export const svgIcon = (k, size, color) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${ICON[k]}"/></svg>`;
const esc = (t) => String(t).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const CSS = `
.qm .leaflet-container{background:transparent;font-family:'IBM Plex Sans Thai',sans-serif;outline:none}
.qm path.leaflet-interactive{transition:fill .5s ease}
.qm .qm-label{background:rgba(255,255,255,.95);color:${P.text};border-radius:999px;padding:2px 9px;font-size:11.5px;font-weight:700;white-space:nowrap;box-shadow:0 2px 6px rgba(76,61,184,.18);transform:translate(-50%,-50%);display:inline-block}
.qm .qm-label.here{background:${P.accent};color:#fff}
.qm .qm-pin{width:32px;height:32px;border-radius:50%;background:#fff;border:2.5px solid ${P.accent};display:flex;align-items:center;justify-content:center;box-shadow:0 3px 8px rgba(76,61,184,.28);transform:translate(-50%,-100%);position:relative}
.qm .qm-pin:after{content:"";position:absolute;bottom:-8px;left:50%;margin-left:-5px;border:5px solid transparent;border-top:6px solid ${P.accent}}
.qm .qm-pin.sel{background:${P.accent}}
.qm .qm-clu{width:34px;height:34px;border-radius:50%;background:${P.accent};color:#fff;border:3px solid #fff;font-weight:800;font-size:13px;display:flex;align-items:center;justify-content:center;transform:translate(-50%,-50%);box-shadow:0 0 0 5px rgba(108,92,231,.2)}
.qm .qm-me{width:16px;height:16px;border-radius:50%;background:#2F80FF;border:3px solid #fff;transform:translate(-50%,-50%);animation:qmpulse 1.8s infinite}
@keyframes qmpulse{0%{box-shadow:0 0 0 0 rgba(47,128,255,.45)}100%{box-shadow:0 0 0 16px rgba(47,128,255,0)}}
.qm .leaflet-control-attribution{background:rgba(255,255,255,.7);font-size:9px;border-radius:6px 0 0 0}
`;

export default function QuestMap({ items, pins = [], pos, sel, onSelect, onPin, tall }) {
  const box = useRef(null);
  const m = useRef(null);
  const cb = useRef({});
  cb.current = { onSelect, onPin };

  // สร้างแผนที่ครั้งเดียว
  useEffect(() => {
    const touch = L.Browser.touch && L.Browser.mobile;
    const map = L.map(box.current, { zoomControl: false, attributionControl: true, zoomSnap: 0.25, dragging: !touch, tap: false, scrollWheelZoom: false, touchZoom: true, bounceAtZoomLimits: false });
    map.attributionControl.setPrefix(false).addAttribution("ขอบเขต: OpenGISData-Thailand (CC BY 4.0) · Natural Earth");
    m.current = { map, area: null, marks: L.layerGroup().addTo(map), me: null };
    // สองนิ้ว: ระหว่างบีบซูม Leaflet เลื่อนแผนที่ตามให้อยู่แล้ว
    return () => { map.remove(); m.current = null; };
  }, []);

  // พื้นที่ + ป้าย + หมุด: วาดใหม่เมื่อเปลี่ยนระดับ/ข้อมูล และหลังซูมเสร็จ (ไม่คำนวณระหว่างซูม)
  useEffect(() => {
    const o = m.current; if (!o || !items) return;
    const map = o.map;
    if (o.area) o.area.remove();
    const styleOf = (t) => t.here ? { fillColor: P.accent, fillOpacity: 1, color: "#ffffff", weight: 2.2 }
      : t.on ? { fillColor: P.soft, fillOpacity: 1, color: "#ffffff", weight: 1.4 }
      : { fillColor: P.fog, fillOpacity: 1, color: "#ffffff", weight: 1 };
    const byCode = new Map(items.map(t => [t.code, t]));
    o.area = L.geoJSON({ type: "FeatureCollection", features: items.map(t => ({ ...t.f, properties: { ...t.f.properties, __code: t.code } })) }, {
      style: (f) => styleOf(byCode.get(f.properties.__code)),
      onEachFeature: (f, lyr) => lyr.on("click", () => cb.current.onSelect && cb.current.onSelect(f.properties.__code)),
    }).addTo(map);
    o.styleOf = styleOf; o.byCode = byCode;
    const b = o.area.getBounds();
    if (b.isValid()) {
      map.invalidateSize();
      map.fitBounds(b, { padding: [14, 14] });
      const z0 = map.getZoom();
      map.setMinZoom(z0 - 0.5); map.setMaxZoom(z0 + 6);
      map.setMaxBounds(b.pad(0.5));
    }
    const draw = () => {
      o.marks.clearLayers();
      const boxes = [];
      const free = (bx) => !boxes.some(x => bx[0] < x[2] && bx[2] > x[0] && bx[1] < x[3] && bx[3] > x[1]);
      // หมุดสถานที่ (รวมกลุ่มที่ชิดกัน)
      const groups = [];
      for (const p of pins) {
        const pt = map.latLngToContainerPoint([p.lat, p.lng]);
        const g = groups.find(g => Math.hypot(g.pt.x - pt.x, g.pt.y - pt.y) < 40);
        if (g) g.items.push(p); else groups.push({ pt, items: [p] });
      }
      for (const g of groups) {
        boxes.push([g.pt.x - 18, g.pt.y - 42, g.pt.x + 18, g.pt.y]);
        if (g.items.length === 1) {
          const p = g.items[0];
          L.marker([p.lat, p.lng], { icon: L.divIcon({ className: "", html: `<div class="qm-pin" data-pin="${esc(p.id)}">${svgIcon(keyOf(p), 16, P.accent)}</div>`, iconSize: [0, 0] }), title: p.name })
            .on("click", () => cb.current.onPin && cb.current.onPin(p)).addTo(o.marks);
        } else {
          const lat = g.items.reduce((a, p) => a + p.lat, 0) / g.items.length, lng = g.items.reduce((a, p) => a + p.lng, 0) / g.items.length;
          L.marker([lat, lng], { icon: L.divIcon({ className: "", html: `<div class="qm-clu">${g.items.length}</div>`, iconSize: [0, 0] }), title: `${g.items.length} สถานที่` })
            .on("click", () => map.flyToBounds(L.latLngBounds(g.items.map(p => [p.lat, p.lng])), { padding: [60, 60], maxZoom: map.getMaxZoom(), duration: 0.5 })).addTo(o.marks);
        }
      }
      // ป้ายชื่อพื้นที่ที่ปลดล็อก (ชนกันก็ซ่อน) — ที่อยู่ตอนนี้ขึ้นก่อนเสมอ
      const lab = items.filter(t => t.on || t.here).map(t => { const [x, y] = geoCentroid(t.f); return { t, ll: [y, x], pt: map.latLngToContainerPoint([y, x]) }; })
        .sort((a, b) => b.t.here - a.t.here);
      const size = map.getSize();
      for (const l of lab) {
        const w = l.t.name.length * 6.6 + 18, bx = [l.pt.x - w / 2, l.pt.y - 10, l.pt.x + w / 2, l.pt.y + 10];
        if (bx[2] < 0 || bx[0] > size.x || bx[3] < 0 || bx[1] > size.y) continue;
        if (!l.t.here && !free(bx)) continue;
        boxes.push(bx);
        L.marker(l.ll, { icon: L.divIcon({ className: "", html: `<span class="qm-label${l.t.here ? " here" : ""}">${esc(l.t.name)}</span>`, iconSize: [0, 0] }), interactive: false, keyboard: false }).addTo(o.marks);
      }
    };
    o.draw = draw;
    map.off("zoomend moveend").on("zoomend moveend", draw);
    draw();
  }, [items, pins]);

  // พื้นที่ที่เลือก: ขอบเข้ม
  useEffect(() => {
    const o = m.current; if (!o || !o.area) return;
    o.area.eachLayer(l => {
      const t = o.byCode.get(l.feature.properties.__code);
      l.setStyle(t && t.code === sel ? { ...o.styleOf(t), color: P.text, weight: 2.5 } : o.styleOf(t));
      if (t && t.code === sel) l.bringToFront();
    });
  }, [sel, items]);

  // ตัวฉัน
  useEffect(() => {
    const o = m.current; if (!o) return;
    if (o.me) { o.me.remove(); o.me = null; }
    if (pos) o.me = L.marker([pos.lat, pos.lng], { icon: L.divIcon({ className: "", html: `<div class="qm-me"></div>`, iconSize: [0, 0] }), interactive: false, keyboard: false }).addTo(o.map);
  }, [pos && pos.lat, pos && pos.lng]);

  // ขยาย/ย่อกรอบ
  useEffect(() => { const o = m.current; if (o) setTimeout(() => { o.map.invalidateSize(); if (o.area) o.map.fitBounds(o.area.getBounds(), { padding: [14, 14] }); }, 260); }, [tall]);

  const zoom = (d) => m.current && m.current.map.zoomIn(d);
  const fit = () => { const o = m.current; if (o && o.area) o.map.flyToBounds(o.area.getBounds(), { padding: [14, 14], duration: 0.5 }); };
  const btn = "w-9 h-9 rounded-xl bg-white/95 flex items-center justify-center text-[18px] shadow-sm";
  return (
    <div className="qm relative rounded-2xl overflow-hidden" style={{ height: tall ? "62vh" : 250, transition: "height .25s ease", background: "radial-gradient(120% 90% at 50% 0%, #F4F1FF 0%, #FFFFFF 70%)", border: `1px solid ${P.line}` }} data-testid="qb-map">
      <style>{CSS}</style>
      <div ref={box} className="absolute inset-0" role="img" aria-label="แผนที่ พื้นที่ที่ปลดล็อกแล้วมีสี" />
      <div className="absolute right-2 top-2 flex flex-col gap-1.5 z-[500]">
        <button onClick={() => zoom(1)} aria-label="ซูมเข้า" className={btn} style={{ color: P.text, border: `1px solid ${P.line}` }}>+</button>
        <button onClick={() => zoom(-1)} aria-label="ซูมออก" className={btn} style={{ color: P.text, border: `1px solid ${P.line}` }}>−</button>
        <button onClick={fit} aria-label="ดูทั้งหมด" className={btn} style={{ border: `1px solid ${P.line}` }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={P.accent} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></svg>
        </button>
      </div>
      {L.Browser.mobile && <p className="absolute left-2 bottom-2 z-[500] text-[10px] font-semibold rounded-full px-2 py-0.5 pointer-events-none" style={{ background: "rgba(255,255,255,.85)", color: "#6B7280" }}>ใช้สองนิ้วเพื่อซูม/เลื่อนแผนที่</p>}
    </div>
  );
}
