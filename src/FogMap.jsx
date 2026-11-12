import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { select } from "d3-selection";
import { zoom as d3zoom, zoomIdentity } from "d3-zoom";
import "d3-transition";
import { geoNaturalEarth1, geoPath, geoContains } from "d3-geo";
import { Flame, Lock, Check, Loader2 } from "lucide-react";
import { loadBase, loadDis, loadSub, LEVELS, RANKS, REGION_TH, CONTINENT_TH, COUNTRY_TH } from "./geo.js";

const GOLD = "#E3B25A";
// สีประจำแต่ละระดับ (ใช้ทั้งแท็บ เส้น พื้นที่ที่ปลดล็อก หมุด และตัวเลขสรุป)
export const LEVEL_COLOR = { con: "#5BC0EB", cty: "#A78BFA", reg: "#34D3B4", pro: "#E3B25A", dis: "#FF8A5B", sub: "#FF5D9E", vil: "#B4F05A" };
const MAXZ = 20000;
const idOf = (k, f) => {
  const p = f.properties;
  return k === "con" ? p.CONTINENT : k === "cty" ? p.a : k === "reg" ? p.reg_royin : p.c;
};
const nameOf = (k, f) => {
  const p = f.properties;
  if (k === "con") return CONTINENT_TH[p.CONTINENT] || p.CONTINENT;
  if (k === "cty") return COUNTRY_TH[p.a] || p.n;
  if (k === "reg") return REGION_TH[p.reg_royin] || p.reg_royin;
  return p.th;
};

// ซ่อนป้ายชื่อที่ซ้อนทับกันตามระดับซูมปัจจุบัน (ป้ายของพื้นที่ใหญ่กว่าได้สิทธิ์ก่อน) ซูมเข้าไปแล้วจะค่อยๆ โผล่
let rafId = 0;
function declutter(o) {
  if (rafId) return;
  rafId = requestAnimationFrame(() => {
    rafId = 0;
    const placed = [];
    for (const l of o.lab) {
      const x = o.T.x + o.T.k * l.cx, y = o.T.y + o.T.k * l.cy;
      const w = l.w, h = 15;
      const box = [x - w / 2, y - h / 2, x + w / 2, y + h / 2];
      const visible = x > -w && y > -h && x < o.W + w && y < o.H + h
        && !placed.some(b => box[0] < b[2] && box[2] > b[0] && box[1] < b[3] && box[3] > b[1]);
      l.el.style.display = visible ? "" : "none";
      if (visible) placed.push(box);
    }
  });
}

// หมุดสถานที่ที่เช็คอินจริง (ระดับตำบล): วงกลมไอคอนตามประเภท + ป้ายชื่อตำบลพร้อมจำนวนสถานที่ หมุดที่ชิดกันรวมเป็นวงเลข แตะเพื่อซูมให้แตกออก
const CAT_COLOR = { cafe: "#f59e0b", restaurant: "#fb7185", attraction: "#a78bfa", hotel: "#60a5fa", other: "#34d399" };
const CAT_TH = { attraction: "ที่เที่ยว", hotel: "ที่พัก", restaurant: "ร้านอาหาร", cafe: "คาเฟ่", other: "อื่นๆ" };
const CAT_ICON = {
  cafe: "M5 8h11v6a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4V8zm11 1h2a2 2 0 0 1 0 4h-2",
  restaurant: "M7 3v7M10 3v7M7 10a1.5 1.5 0 0 0 3 0M8.5 10v11M16 3c-2 2-2 6 0 8v10",
  attraction: "M12 3l3 4h-6l3-4zM6 21V11h12v10M3 21h18M10 21v-5h4v5",
  hotel: "M3 11l9-7 9 7M5 10v10h14V10M10 20v-6h4v6",
  other: "M12 21s-6-5.5-6-10a6 6 0 0 1 12 0c0 4.5-6 10-6 10zM12 13a2 2 0 1 0 0-4 2 2 0 0 0 0 4z",
  wish: "M12 4l2.5 5 5.5.8-4 3.9.9 5.5-4.9-2.6-4.9 2.6.9-5.5-4-3.9 5.5-.8z",
};
const catKey = (c) => (CAT_ICON[String(c || "").toLowerCase()] && String(c).toLowerCase() !== "wish" ? String(c).toLowerCase() : "other");
const kmBetween = (a, b) => {
  const R = 6371, r = Math.PI / 180, dLat = (b.lat - a.lat) * r, dLng = (b.lng - a.lng) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};
function drawPlacePins(o, cb) {
  o.pp.selectAll("*").remove();
  const K = o.K, sc = (p) => [o.T.x + K * p.x, o.T.y + K * p.y];
  const boxes = [];
  const free = (box) => o.showAll || !boxes.some(b => box[0] < b[2] && box[2] > b[0] && box[1] < b[3] && box[3] > b[1]);
  const tw = (t) => String(t).length * 6.6;
  // ป้ายชื่อตำบลที่ปลดล็อกแล้ว + จำนวนสถานที่ที่เช็คอินในตำบลนั้น
  for (const c of o.subChips || []) {
    const [sx, sy] = sc(c), w = tw(c.name) + 18 + (c.n ? 22 : 0), box = [sx - w / 2, sy - 12, sx + w / 2, sy + 12];
    if (!free(box)) continue;
    boxes.push(box);
    const g = o.pp.append("g").attr("data-chip", "1").attr("transform", `translate(${c.x},${c.y}) scale(${1 / K})`).style("cursor", "pointer")
      .on("click", (e) => { e.stopPropagation(); cb.openSub(c.d); });
    g.append("rect").attr("x", -w / 2).attr("y", -11).attr("width", w).attr("height", 22).attr("rx", 11).attr("fill", "#f6f1e3").attr("opacity", 0.95);
    g.append("text").attr("x", -w / 2 + 9).attr("y", 4).text(c.name).attr("fill", "#0b1220").attr("pointer-events", "none").style("font-weight", 700).style("font-size", "11px");
    if (c.n) {
      g.append("circle").attr("cx", w / 2 - 12).attr("cy", 0).attr("r", 8).attr("fill", LEVEL_COLOR.sub);
      g.append("text").attr("x", w / 2 - 12).attr("y", 3.5).attr("text-anchor", "middle").text(c.n).attr("fill", "#fff").attr("pointer-events", "none").style("font-weight", 800).style("font-size", "10px");
    }
  }
  // หมุดวงกลม: ไอคอนประเภทอยู่ในวง ปลายแหลมชี้ตำแหน่งจริง ชื่ออยู่ข้างหมุด
  const pin = (p, color, icon, text, dashed, onClick) => {
    const g = o.pp.append("g").attr("data-pin", "1").attr("transform", `translate(${p.x},${p.y}) scale(${1 / K})`).style("cursor", "pointer")
      .on("click", (e) => { e.stopPropagation(); onClick(); });
    g.append("path").attr("d", "M-6,-10 L6,-10 L0,0Z").attr("fill", color);
    const c = g.append("circle").attr("cx", 0).attr("cy", -24).attr("r", 15).attr("fill", dashed ? "#16203a" : "#f6f1e3").attr("stroke", color).attr("stroke-width", 3);
    if (dashed) c.attr("stroke-dasharray", "4 3");
    g.append("path").attr("d", icon).attr("transform", "translate(-9,-33) scale(0.75)").attr("fill", "none").attr("stroke", dashed ? color : "#0b1220")
      .attr("stroke-width", 2).attr("stroke-linecap", "round").attr("stroke-linejoin", "round").attr("pointer-events", "none");
    const [sx, sy] = sc(p), box = [sx + 17, sy - 33, sx + 23 + tw(text), sy - 15];
    if (free(box)) {
      boxes.push(box);
      g.append("text").attr("x", 20).attr("y", -20).text(text).attr("fill", dashed ? "#ffe29a" : "#f6f1e3").attr("stroke", "#0b1220").attr("paint-order", "stroke")
        .attr("stroke-linejoin", "round").attr("pointer-events", "none").style("font-weight", 700).style("font-size", "11px").style("stroke-width", "3px");
    }
  };
  for (const w of o.wishPts || []) pin(w, "#ffd166", CAT_ICON.wish, w.name, true, () => cb.openWish(w.w));
  // รวมกลุ่มหมุดที่อยู่ชิดกันบนหน้าจอ
  const cl = [];
  for (const p of o.placePts || []) {
    const [sx, sy] = sc(p);
    const c = cl.find(c => Math.hypot(c.sx - sx, c.sy - sy) < 40);
    if (c) c.items.push(p); else cl.push({ sx, sy, items: [p] });
  }
  for (const c of cl) {
    if (c.items.length === 1) {
      const p = c.items[0];
      pin(p, p.color, CAT_ICON[p.cat], p.name, false, () => cb.open(p.v));
    } else {
      const x = c.items.reduce((a, p) => a + p.x, 0) / c.items.length, y = c.items.reduce((a, p) => a + p.y, 0) / c.items.length;
      const g = o.pp.append("g").attr("data-pin", "1").attr("transform", `translate(${x},${y}) scale(${1 / K})`).style("cursor", "pointer")
        .on("click", (e) => { e.stopPropagation(); cb.zoomTo(c.items); });
      g.append("circle").attr("r", 17).attr("fill", "#f6f1e3").attr("stroke", LEVEL_COLOR.sub).attr("stroke-width", 3);
      g.append("text").attr("text-anchor", "middle").attr("dy", "0.35em").attr("fill", "#0b1220").attr("pointer-events", "none").style("font-weight", 800).style("font-size", "13px").text(c.items.length);
    }
  }
}

// แผนที่หมอก: เห็นแต่เส้นแบ่งเขต ชื่อพื้นที่จะเปิดเมื่อเช็คอินในพื้นที่นั้น
function FogCanvas({ unlocked, onInfo, rest }) {
  const wrap = useRef(null);
  const svgEl = useRef(null);
  const m = useRef({});
  const [ready, setReady] = useState(false);
  const [sizeTick, setSizeTick] = useState(0);
  const [base, setBase] = useState(null);
  const [dis, setDis] = useState(null);
  const [sub, setSub] = useState(null);
  const [vils, setVils] = useState([]);
  const [litList, setLitList] = useState([]);
  const [wishes, setWishes] = useState([]);
  const [cats, setCats] = useState({}); // ประเภทของสถานที่ที่เช็คอิน (ดึงจากตาราง places ซึ่งอ่านได้ทุกคน)
  const [pinFilter, setPinFilter] = useState("all");
  const [showAll, setShowAll] = useState(false);
  const [wishOk, setWishOk] = useState(false);
  const [sheet, setSheet] = useState(null); // { mode: "add"|"view", ... }
  const loadWishes = useCallback(() => {
    if (!rest) return;
    rest("/rest/v1/rpc/my_wish_pins", { method: "POST", body: {} }).then(r => { if (Array.isArray(r)) { setWishOk(true); setWishes(r); } }).catch(() => {});
  }, [rest]);
  useEffect(() => { loadWishes(); }, [loadWishes]);
  const [active, setActive] = useState("pro");
  const [subProv, setSubProv] = useState(null);
  const [err, setErr] = useState("");
  const infoRef = useRef(onInfo);
  infoRef.current = onInfo;

  useEffect(() => {
    loadBase().then(setBase).catch(() => setErr("โหลดแผนที่ไม่สำเร็จ ลองใหม่อีกครั้ง"));
    loadDis().then(setDis).catch(() => {});
  }, []);

  // จังหวัดที่เปิดแล้ว (ใช้เลือกดูตำบล)
  // เลือกดูได้ทุกจังหวัด (จังหวัดที่เปิดแล้วขึ้นก่อนและมี ✓) — จังหวัดที่ยังไม่เปิดจะเห็นเป็นเส้นแบ่งเขตในหมอก
  const openProvs = useMemo(() => {
    if (!base) return [];
    const all = base.pro.features.slice().sort((x, y) => x.properties.c.localeCompare(y.properties.c));
    const on = all.filter(f => unlocked.pro.has(f.properties.c));
    return on.concat(all.filter(f => !unlocked.pro.has(f.properties.c)));
  }, [base, unlocked]);
  useEffect(() => {
    if (!subProv && openProvs.length) setSubProv(openProvs[0].properties.c);
  }, [openProvs, subProv]);
  useEffect(() => {
    setSub(null);
    if (!subProv) return;
    let live = true;
    loadSub(subProv).then(d => { if (live) setSub(d); }).catch(() => {});
    return () => { live = false; };
  }, [subProv]);

  // หมุดของฉัน: สร้างจากสถานที่ที่เคยเช็คอิน (ไม่พึ่งข้อมูลหมู่บ้าน) แล้วกรองตามจังหวัดที่เลือก
  const [myPins, setMyPins] = useState([]);
  useEffect(() => {
    if (!rest) return;
    let live = true;
    rest("/rest/v1/rpc/my_place_pins", { method: "POST", body: {} }).then(r => { if (live && Array.isArray(r)) setMyPins(r); }).catch(() => {});
    return () => { live = false; };
  }, [rest, unlocked]);
  // พิกัดจริงของหมุดตำบล/อำเภอ = สถานที่แรกที่เช็คอินในพื้นที่นั้น (ถ้ายังไม่มีฟังก์ชันในฐานข้อมูล ใช้จุดกลางพื้นที่แทน)
  const [areaPins, setAreaPins] = useState({});
  useEffect(() => {
    if (!rest) return;
    let live = true;
    rest("/rest/v1/rpc/my_area_pins", { method: "POST", body: {} }).then(r => {
      if (!live || !Array.isArray(r)) return;
      const mp = {}; r.forEach(x => { mp[x.level + ":" + x.code] = { lng: x.lng, lat: x.lat, place: x.place_name }; }); setAreaPins(mp);
    }).catch(() => {});
    return () => { live = false; };
  }, [rest, unlocked]);
  useEffect(() => { setVils(myPins.filter(r => String(r.province) === String(subProv))); }, [myPins, subProv]);
  useEffect(() => {
    const ids = myPins.filter(r => !r.category && /^\d+$/.test(String(r.id))).map(r => r.id).slice(0, 300);
    if (!rest || !ids.length) return;
    let live = true;
    rest(`/rest/v1/places?select=id,category&id=in.(${ids.join(",")})`).then(r => {
      if (!live || !Array.isArray(r)) return;
      const mp = {}; r.forEach(x => { if (x && x.category) mp[x.id] = x.category; }); setCats(mp);
    }).catch(() => {});
    return () => { live = false; };
  }, [rest, myPins]);
  const catOf = useCallback((v) => catKey(v.category || cats[v.id]), [cats]);
  const presentCats = useMemo(() => Object.keys(CAT_TH).filter(c => vils.some(v => catOf(v) === c)), [vils, catOf]);

  // สร้าง svg + zoom ครั้งเดียว
  useEffect(() => {
    const svg = select(svgEl.current);
    const g = svg.append("g");
    const o = { svg, g, shapes: g.append("g"), pins: g.append("g"), labels: g.append("g"), pp: g.append("g"), placePts: null, wishPts: [], subChips: [], showAll: false, mode: "", cb: null, K: 1, T: zoomIdentity, lab: [], proj: geoNaturalEarth1(), W: 0, H: 0 };
    o.path = geoPath(o.proj);
    o.zoom = d3zoom().scaleExtent([1, MAXZ]).on("zoom", e => {
      o.K = e.transform.k; o.T = e.transform; g.attr("transform", e.transform);
      o.labels.selectAll("text").style("font-size", 11 / o.K + "px").style("stroke-width", 3 / o.K + "px");
      o.pins.selectAll("circle").attr("r", d => (d.r0 || 4.5) / o.K).style("stroke-width", 1.5 / o.K + "px");
      if (o.mode === "sub" && o.cb) drawPlacePins(o, o.cb);
      declutter(o);
    });
    svg.call(o.zoom).on("dblclick.zoom", null);
    m.current = o;
    const size = () => {
      const r = wrap.current.getBoundingClientRect();
      if (!r.width || !r.height) return;
      o.W = r.width; o.H = r.height;
      o.proj.fitExtent([[6, 6], [o.W - 6, o.H - 6]], { type: "Sphere" });
      setSizeTick(t => t + 1);
    };
    size();
    setReady(true);
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(size) : null;
    ro && ro.observe(wrap.current);
    return () => { ro && ro.disconnect(); svg.on(".zoom", null); svg.selectAll("*").remove(); };
  }, []);

  const feats = useCallback((k) => {
    if (!base) return [];
    if (k === "dis") return dis ? dis.features : [];
    if (k === "sub") return sub ? sub.features : [];
    return base[k].features;
  }, [base, dis, sub]);

  // วาดชั้นปัจจุบัน
  useEffect(() => {
    const o = m.current;
    if (!ready || !base || !o.W) return;
    const k = active;
    o.shapes.selectAll("*").remove(); o.labels.selectAll("*").remove(); o.pins.selectAll("*").remove();
    o.pp.selectAll("*").remove(); o.placePts = null; o.wishPts = []; o.subChips = []; o.mode = k;
    const C = LEVEL_COLOR[k];
    if (k === "vil") {
      setLitList([]);
      // หมู่บ้านเป็นจุดพิกัด: วาดเขตอำเภอของจังหวัดเป็นฉากหลัง แล้วปักหมุดหมู่บ้าน (สว่าง = ปลดล็อกแล้ว)
      const ds = dis ? dis.features.filter(f => f.properties.pc === subProv) : [];
      o.shapes.selectAll("path.ctx").data(ds).join("path").attr("d", o.path).attr("fill", "#121b31").attr("stroke", "#34466f")
        .attr("stroke-width", 0.6).attr("vector-effect", "non-scaling-stroke").attr("pointer-events", "none");
      const pts = vils.map(v => ({ v, xy: o.proj([v.lng, v.lat]), on: true })).filter(d => d.xy && isFinite(d.xy[0]));
      pts.sort((a, b) => a.on - b.on);
      o.pins.selectAll("circle").data(pts.map(d => ({ ...d, r0: d.on ? 4.5 : 2.6 }))).join("circle")
        .attr("cx", d => d.xy[0]).attr("cy", d => d.xy[1]).attr("r", d => d.r0 / o.K)
        .attr("fill", d => (d.on ? C : "#3d4d77")).attr("stroke", "#0b1220").style("stroke-width", 1.2 / o.K + "px")
        .style("cursor", "pointer")
        .on("click", (e, d) => { e.stopPropagation(); infoRef.current({ k: "vil", id: String(d.v.id), name: d.v.name, on: d.on, props: {} }); });
      const lit = pts.filter(d => d.on);
      const tx = o.labels.selectAll("text").data(lit).join("text").attr("transform", d => `translate(${d.xy[0]},${d.xy[1]})`)
        .attr("dy", "-0.75em").text(d => d.v.name).attr("fill", "#f6f1e3").attr("stroke", "#0b1220").attr("paint-order", "stroke").attr("stroke-linejoin", "round")
        .attr("text-anchor", "middle").attr("pointer-events", "none").style("font-weight", 600)
        .style("font-size", 11 / o.K + "px").style("stroke-width", 3 / o.K + "px");
      o.lab = lit.map((d, i) => ({ el: tx.nodes()[i], cx: d.xy[0], cy: d.xy[1], w: Math.max(24, d.v.name.length * 6.8) }));
      declutter(o);
      return;
    }
    if (k !== "con" && k !== "cty") {
      o.shapes.selectAll("path.ctx").data(base.cty.features).join("path").attr("d", o.path)
        .attr("fill", "#121b31").attr("stroke", "#26355a").attr("stroke-width", 0.5).attr("vector-effect", "non-scaling-stroke");
    }
    const data = feats(k);
    const on = (f) => unlocked[k].has(idOf(k, f));
    o.shapes.selectAll("path.cell").data(data).join("path").attr("class", "cell").attr("d", o.path)
      .attr("fill", f => (on(f) ? C + "4D" : "#16203a"))
      .attr("stroke", f => (on(f) ? C : "#34466f")).attr("stroke-width", f => (on(f) ? 1 : 0.6))
      .attr("vector-effect", "non-scaling-stroke").style("cursor", "pointer")
      .on("click", (e, f) => { e.stopPropagation(); infoRef.current({ k, id: idOf(k, f), name: nameOf(k, f), on: on(f), props: f.properties }); });
    if (k === "dis" || k === "sub") {
      const up = k === "dis" ? base.pro.features : (dis ? dis.features.filter(f => f.properties.pc === subProv) : []);
      o.shapes.selectAll("path.up").data(up).join("path").attr("d", o.path).attr("fill", "none").attr("stroke", k === "dis" ? LEVEL_COLOR.pro : LEVEL_COLOR.dis)
        .attr("stroke-opacity", 0.7).attr("stroke-width", 1.1).attr("vector-effect", "non-scaling-stroke").attr("pointer-events", "none");
    }
    const lit = data.filter(on).map(f => {
      let [cx, cy] = o.path.centroid(f); const a = o.path.area(f); const name = nameOf(k, f);
      const ap = (k === "sub" || k === "dis") ? areaPins[k + ":" + idOf(k, f)] : null;
      if (ap) { const xy = o.proj([ap.lng, ap.lat]); if (xy && isFinite(xy[0])) { cx = xy[0]; cy = xy[1]; } }
      return { f, cx, cy, a, name };
    }).filter(d => isFinite(d.cx) && isFinite(d.cy)).sort((x, y) => y.a - x.a);
    const open = (d) => infoRef.current({ k, id: idOf(k, d.f), name: d.name, on: true, props: d.f.properties });
    if (k === "sub") {
      // ระดับตำบล: ไม่ปักหมุดชื่อตำบล — ปักหมุดสถานที่ที่เช็คอินจริงแทน (ชื่อตำบลดูได้จากรายการใต้แผนที่)
      setLitList(lit.map(d => ({ name: d.name, f: d.f })));
      // สถานที่เช็คอินจริง: จาก my_place_pins + เติมจาก my_area_pins (สถานที่แรกของแต่ละตำบล/อำเภอ) เผื่อฟังก์ชันแรกว่าง
      const seen = new Set(vils.map(v => v.name));
      const extra = Object.entries(areaPins).filter(([key, a]) => a.place && !seen.has(a.place) && a.lat != null && a.lng != null && seen.add(a.place))
        .map(([key, a]) => ({ id: "a:" + key, name: a.place, lat: a.lat, lng: a.lng }));
      const all = vils.concat(extra).map(v => ({ v, lat: v.lat, lng: v.lng, xy: o.proj([v.lng, v.lat]) })).filter(d => d.xy && isFinite(d.xy[0]));
      o.showAll = showAll;
      o.placePts = all.map(d => ({ x: d.xy[0], y: d.xy[1], v: d.v, name: String(d.v.name), cat: catOf(d.v) })).map(p => ({ ...p, color: CAT_COLOR[p.cat] }))
        .filter(p => pinFilter === "all" || pinFilter === p.cat);
      // ป้ายชื่อตำบล: อยู่กลางตำบล พร้อมจำนวนสถานที่ที่เช็คอินในตำบลนั้น
      o.subChips = lit.map(d => { const [x, y] = o.path.centroid(d.f); return { x, y, d, name: d.name, n: all.filter(q => geoContains(d.f, [q.lng, q.lat])).length }; })
        .filter(c => isFinite(c.x) && isFinite(c.y));
      // หมุดอยากไป: ซ่อนอันที่ไปเช็คอินจริงแล้ว (ห่างไม่เกิน 150 ม.)
      o.wishPts = (pinFilter === "all" || pinFilter === "wish" ? wishes : []).filter(w => !all.some(d => kmBetween(w, d) < 0.15)).map(w => ({ w, name: String(w.name), xy: o.proj([w.lng, w.lat]) }))
        .filter(d => d.xy && isFinite(d.xy[0])).map(d => ({ x: d.xy[0], y: d.xy[1], w: d.w, name: d.name }));
      o.cb = {
        open: (v) => { if (/^\d+$/.test(String(v.id))) infoRef.current({ k: "vil", id: String(v.id), name: v.name, on: true, props: {} }); },
        openWish: (w) => setSheet({ mode: "view", wish: w }),
        openSub: (d) => open(d),
        zoomTo: (items) => {
          const xs = items.map(p => p.x), ys = items.map(p => p.y);
          const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
          const span = Math.max((x1 - x0) / o.W, (y1 - y0) / o.H);
          const kk = span > 1e-9 ? Math.min(MAXZ, 0.6 / span) : o.K * 3;
          o.svg.transition().duration(500).call(o.zoom.transform, zoomIdentity.translate(o.W / 2, o.H / 2).scale(Math.max(kk, o.K * 1.8)).translate(-(x0 + x1) / 2, -(y0 + y1) / 2));
        },
      };
      drawPlacePins(o, o.cb);
      return;
    }
    setLitList([]);
    o.pins.selectAll("circle").data(lit).join("circle").attr("cx", d => d.cx).attr("cy", d => d.cy)
      .attr("r", 4.5 / o.K).attr("fill", C).attr("stroke", "#0b1220").style("stroke-width", 1.5 / o.K + "px").style("cursor", "pointer")
      .on("click", (e, d) => { e.stopPropagation(); open(d); });
    const tx = o.labels.selectAll("text").data(lit).join("text").attr("transform", d => `translate(${d.cx},${d.cy})`)
      .attr("dy", "-0.75em").text(d => d.name).attr("fill", "#f6f1e3").attr("stroke", "#0b1220").attr("paint-order", "stroke").attr("stroke-linejoin", "round")
      .attr("text-anchor", "middle").attr("pointer-events", "none").style("font-weight", 600)
      .style("font-size", 11 / o.K + "px").style("stroke-width", 3 / o.K + "px");
    o.lab = lit.map((d, i) => ({ el: tx.nodes()[i], cx: d.cx, cy: d.cy, w: Math.max(24, d.name.length * 6.8) }));
    declutter(o);
  }, [ready, sizeTick, base, dis, sub, vils, active, unlocked, subProv, feats, areaPins, wishes, catOf, pinFilter, showAll]);

  // กดค้างบนแผนที่ (ระดับตำบล) = ปักหมุด "อยากไป"
  useEffect(() => {
    const el = svgEl.current;
    if (!el || !wishOk) return;
    let timer = 0, sx = 0, sy = 0;
    const cancel = () => { if (timer) clearTimeout(timer); timer = 0; };
    const down = (e) => {
      const o = m.current;
      if (o.mode !== "sub" || (e.pointerType === "mouse" && e.button !== 0)) return;
      if (e.target.closest && e.target.closest("[data-pin]")) return;
      cancel(); sx = e.clientX; sy = e.clientY;
      timer = setTimeout(() => {
        timer = 0;
        const r = el.getBoundingClientRect();
        const [wx, wy] = o.T.invert([sx - r.left, sy - r.top]);
        const ll = o.proj.invert([wx, wy]);
        if (ll && isFinite(ll[0]) && isFinite(ll[1])) setSheet({ mode: "add", lat: ll[1], lng: ll[0], name: "" });
      }, 650);
    };
    const move = (e) => { if (timer && Math.hypot(e.clientX - sx, e.clientY - sy) > 8) cancel(); };
    el.addEventListener("pointerdown", down); el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", cancel); el.addEventListener("pointercancel", cancel); el.addEventListener("pointerleave", cancel);
    return () => { cancel(); el.removeEventListener("pointerdown", down); el.removeEventListener("pointermove", move); el.removeEventListener("pointerup", cancel); el.removeEventListener("pointercancel", cancel); el.removeEventListener("pointerleave", cancel); };
  }, [wishOk]);
  const saveWish = async () => {
    const name = (sheet.name || "").trim();
    if (!name) { setSheet({ ...sheet, err: "ใส่ชื่อสถานที่ก่อน" }); return; }
    try {
      await rest("/rest/v1/rpc/add_wish_pin", { method: "POST", body: { p_name: name.slice(0, 60), p_lat: sheet.lat, p_lng: sheet.lng } });
      setSheet(null); loadWishes();
    } catch (e) { setSheet({ ...sheet, err: "บันทึกไม่สำเร็จ (อาจครบ 100 หมุดแล้ว) ลองใหม่" }); }
  };
  const removeWish = async () => {
    try { await rest("/rest/v1/rpc/delete_wish_pin", { method: "POST", body: { p_id: sheet.wish.id } }); setSheet(null); loadWishes(); }
    catch (e) { setSheet({ ...sheet, err: "ลบไม่สำเร็จ ลองใหม่" }); }
  };

  // เลื่อน/ซูมไปยังพื้นที่ที่เกี่ยวข้อง
  const fitTo = useCallback((list, pad) => {
    const o = m.current;
    if (!o.W || !list.length) return;
    const [[x0, y0], [x1, y1]] = o.path.bounds({ type: "FeatureCollection", features: list });
    const k = Math.min(MAXZ, Math.max(1, (1 - pad) / Math.max((x1 - x0) / o.W, (y1 - y0) / o.H)));
    o.svg.transition().duration(600).call(o.zoom.transform, zoomIdentity.translate(o.W / 2, o.H / 2).scale(k).translate(-(x0 + x1) / 2, -(y0 + y1) / 2));
  }, []);
  const view = useCallback(() => {
    const o = m.current;
    if (!base || !o.W) return;
    if (active === "con" || active === "cty") o.svg.transition().duration(600).call(o.zoom.transform, zoomIdentity);
    else if (active === "sub" || active === "vil") fitTo(base.pro.features.filter(f => f.properties.c === subProv), 0.1);
    else fitTo(base.pro.features, 0.08);
  }, [base, active, subProv, fitTo]);
  useEffect(() => { if (ready && base) { const t = setTimeout(view, 60); return () => clearTimeout(t); } }, [ready, base, active, subProv, sizeTick > 0, view]);

  return (
    <div>
      <div className="flex gap-1.5 overflow-x-auto pb-2" role="tablist">
        {LEVELS.filter(l => l.k !== "vil").map(l => (
          <button key={l.k} role="tab" aria-selected={active === l.k} onClick={() => { setActive(l.k); onInfo(null); }}
            className={`text-xs font-semibold px-3 py-1.5 rounded-full whitespace-nowrap border ${active === l.k ? "text-[#0b1220]" : "bg-[#111a2e] border-[#263456]"}`} style={active === l.k ? { background: LEVEL_COLOR[l.k], borderColor: LEVEL_COLOR[l.k] } : { color: LEVEL_COLOR[l.k] }}>{l.name}</button>
        ))}
      </div>
      {(active === "sub" || active === "vil") && openProvs.length > 0 && (
        <select value={subProv || ""} onChange={e => { setSubProv(e.target.value); onInfo(null); }} aria-label="เลือกจังหวัดที่จะดูตำบล"
          className="w-full mb-2 text-xs bg-[#111a2e] text-[#e8ecf5] border border-[#263456] rounded-lg px-3 py-2">
          {openProvs.map(f => <option key={f.properties.c} value={f.properties.c}>{unlocked.pro.has(f.properties.c) ? "✓ " : ""}{f.properties.th}</option>)}
        </select>
      )}
      {active === "sub" && (presentCats.length > 1 || wishes.length > 0) && (
        <div className="flex gap-1.5 overflow-x-auto pb-2" data-testid="pin-filter">
          {[["all", "ทั้งหมด", "#e8ecf5"]].concat(presentCats.map(c => [c, CAT_TH[c], CAT_COLOR[c]])).concat(wishes.length ? [["wish", "อยากไป", "#ffd166"]] : []).map(([key, label, color]) => (
            <button key={key} onClick={() => setPinFilter(key)} aria-pressed={pinFilter === key}
              className={`text-xs font-semibold px-3 py-2 rounded-full whitespace-nowrap border ${pinFilter === key ? "text-[#0b1220]" : "bg-[#111a2e]"}`}
              style={pinFilter === key ? { background: color, borderColor: color } : { color, borderColor: "#263456" }}>{label}</button>
          ))}
        </div>
      )}
      <div ref={wrap} className="relative rounded-2xl overflow-hidden border border-[#263456]" style={{ background: "#0b1220", height: "52vh", minHeight: 320, touchAction: "none" }}>
        <svg ref={svgEl} className="absolute inset-0 w-full h-full" role="img" aria-label="แผนที่เส้นแบ่งเขตที่ปลดล็อกได้ด้วยการเช็คอิน" />
        {!base && !err && <div className="absolute inset-0 flex items-center justify-center text-[#8b97b3]"><Loader2 className="animate-spin" size={22} /></div>}
        {err && <p className="absolute inset-0 flex items-center justify-center text-xs text-[#8b97b3] px-6 text-center">{err}</p>}
        {active === "vil" && base && subProv && vils.length === 0 && (
          <p className="absolute left-2 top-2 text-[10.5px] text-[#8b97b3] bg-[#111a2e]/90 border border-[#263456] rounded-lg px-2 py-1 pointer-events-none">ยังไม่มีหมุดในจังหวัดนี้ เช็คอินสถานที่ในจังหวัดนี้เพื่อปักหมุด</p>
        )}
        {sheet && (
          <div className="absolute left-2 right-2 bottom-10 bg-[#111a2e] border border-[#263456] rounded-2xl p-3 flex flex-col gap-2" data-testid="wish-sheet">
            {sheet.mode === "add" ? (<>
              <p className="text-xs text-[#ffd166] font-semibold">ปักหมุด &ldquo;อยากไป&rdquo; ตรงนี้</p>
              <input autoFocus value={sheet.name} maxLength={60} onChange={e => setSheet({ ...sheet, name: e.target.value, err: "" })} placeholder="ชื่อสถานที่ที่อยากไป"
                aria-label="ชื่อสถานที่ที่อยากไป" className="w-full bg-[#0b1220] text-[#e8ecf5] border border-[#263456] rounded-lg px-3 py-2.5 text-sm" />
              {sheet.err && <p className="text-[11px] text-[#fb7185]">{sheet.err}</p>}
              <div className="flex gap-2">
                <button onClick={saveWish} className="flex-1 min-h-[44px] rounded-xl bg-[#ffd166] text-[#0b1220] text-sm font-bold">บันทึกหมุด</button>
                <button onClick={() => setSheet(null)} className="min-h-[44px] px-4 rounded-xl border border-[#263456] text-[#e8ecf5] text-sm">ยกเลิก</button>
              </div>
            </>) : (<>
              <p className="text-sm font-bold text-[#e8ecf5]">{sheet.wish.name}</p>
              <p className="text-[11px] text-[#8b97b3]">หมุดอยากไป · พอไปเช็คอินที่นี่จริง หมุดจะกลายเป็นหมุดทึบเอง</p>
              {sheet.err && <p className="text-[11px] text-[#fb7185]">{sheet.err}</p>}
              <div className="flex gap-2">
                <button onClick={removeWish} className="flex-1 min-h-[44px] rounded-xl border border-[#fb7185] text-[#fb7185] text-sm font-semibold">ลบหมุดนี้</button>
                <button onClick={() => setSheet(null)} className="min-h-[44px] px-4 rounded-xl border border-[#263456] text-[#e8ecf5] text-sm">ปิด</button>
              </div>
            </>)}
          </div>
        )}
        {active === "sub" && (
          <button onClick={() => setShowAll(v => !v)} aria-pressed={showAll} data-testid="show-all-names"
            className="absolute left-2 top-2 text-[11px] font-semibold px-3 py-2 rounded-full border"
            style={showAll ? { background: "#f6f1e3", color: "#0b1220", borderColor: "#f6f1e3" } : { background: "#111a2e", color: "#e8ecf5", borderColor: "#263456" }}>{showAll ? "✓ " : ""}แสดงชื่อทั้งหมด</button>
        )}
        <div className="absolute right-2 top-2 flex flex-col gap-1.5">
          <button aria-label="ซูมเข้า" onClick={() => m.current.svg.transition().duration(250).call(m.current.zoom.scaleBy, 2.5)} className="w-9 h-9 text-lg leading-none bg-[#111a2e] text-[#e8ecf5] border border-[#263456] rounded-lg">+</button>
          <button aria-label="ซูมออก" onClick={() => m.current.svg.transition().duration(250).call(m.current.zoom.scaleBy, 0.4)} className="w-9 h-9 text-lg leading-none bg-[#111a2e] text-[#e8ecf5] border border-[#263456] rounded-lg">−</button>
        </div>
        <button onClick={view} className="absolute right-2 bottom-2 text-[11px] bg-[#111a2e] text-[#e8ecf5] border border-[#263456] rounded-lg px-2.5 py-1.5">เต็มจอ</button>
        <p className="absolute left-2 bottom-1.5 max-w-[calc(100%-5.5rem)] leading-tight text-[9px] text-[#55627f] pointer-events-none">ขอบเขต: OpenGISData-Thailand (CC BY 4.0) · Natural Earth</p>
      </div>
      {litList.length > 0 && (
        <div className="mt-2.5" data-testid="lit-list">
          <p className="text-[11px] text-[#8b97b3] mb-1.5">ตำบลที่ปลดล็อกแล้ว {litList.length} แห่ง · แตะชื่อเพื่อซูมไปดู · หมุดวงกลม = ที่ที่ไปเช็คอินจริง · เลขข้างชื่อตำบล = จำนวนสถานที่{wishOk ? " · กดค้างบนแผนที่เพื่อปักหมุดที่อยากไป (เส้นประ)" : ""}</p>
          <div className="flex flex-wrap gap-1.5">
            {litList.map(x => (
              <button key={x.name + idOf(active, x.f)} onClick={() => { fitTo([x.f], 0.45); infoRef.current({ k: active, id: idOf(active, x.f), name: x.name, on: true, props: x.f.properties }); }}
                className="flex items-center gap-1.5 text-xs bg-[#111a2e] border border-[#263456] rounded-full pl-2.5 pr-3 py-1.5 text-[#e8ecf5]">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: LEVEL_COLOR[active] }} />{x.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const rankOf = (score) => {
  let r = RANKS[0], nx = RANKS[1];
  for (let i = 0; i < RANKS.length; i++) if (score >= RANKS[i][0]) { r = RANKS[i]; nx = RANKS[i + 1] || null; }
  return { name: r[1], next: nx, pct: nx ? ((score - r[0]) / (nx[0] - r[0])) * 100 : 100 };
};

export default function FogMapPanel({ rest, showToast }) {
  const [data, setData] = useState(null);
  const [info, setInfo] = useState(null);
  const [claiming, setClaiming] = useState("");
  const [baseData, setBaseData] = useState(null);
  const [disData, setDisData] = useState(null);

  const refresh = useCallback(async () => {
    try { setData(await rest("/rest/v1/rpc/my_explore", { method: "POST", body: {} })); }
    catch (e) { showToast("โหลดข้อมูลสำรวจไม่สำเร็จ: " + e.message); setData({ score: 0, checkins: 0, streak: { current: 0, best: 0, today: false }, missions: [], unlocks: [], totals: {} }); }
  }, [rest]);
  useEffect(() => { refresh(); loadBase().then(setBaseData).catch(() => {}); loadDis().then(setDisData).catch(() => {}); }, []);

  const unlocked = useMemo(() => {
    const s = { con: new Set(), cty: new Set(), reg: new Set(), pro: new Set(), dis: new Set(), sub: new Set(), vil: new Set() };
    (data?.villages || []).forEach(id => s.vil.add(String(id)));
    (data?.unlocks || []).forEach(u => s[u.level] && s[u.level].add(u.code));
    return s;
  }, [data]);

  const claim = async (id) => {
    setClaiming(id);
    try {
      const pts = await rest("/rest/v1/rpc/claim_mission", { method: "POST", body: { p_mission: id } });
      showToast(`รับรางวัลภารกิจ +${pts} คะแนน`);
      await refresh();
    } catch (e) { showToast("รับรางวัลไม่สำเร็จ: " + e.message); }
    setClaiming("");
  };

  if (!data) return <p className="text-center text-xs text-[#9199A8] py-10">กำลังโหลด...</p>;
  const rk = rankOf(data.score);
  const tot = { con: baseData?.con.features.length, cty: baseData?.cty.features.length, reg: baseData?.reg.features.length, ...data.totals };
  const childInfo = info && info.on && (() => {
    const pre = info.id;
    if (info.k === "pro") return `อำเภอที่เปิดแล้ว ${[...unlocked.dis].filter(c => c.startsWith(pre)).length}/${disData ? disData.features.filter(f => f.properties.pc === pre).length : "-"}`;
    if (info.k === "dis") return `ตำบลที่เปิดแล้ว ${[...unlocked.sub].filter(c => c.startsWith(pre)).length}`;
    if (info.k === "reg") return `จังหวัดที่เปิดแล้ว ${baseData ? baseData.pro.features.filter(f => f.properties.r === pre && unlocked.pro.has(f.properties.c)).length : "-"}/${baseData ? baseData.pro.features.filter(f => f.properties.r === pre).length : "-"}`;
    return "";
  })();
  const lv = info && LEVELS.find(l => l.k === info.k);

  return (
    <div className="space-y-3">
      <div className="rounded-2xl p-3.5 text-[#e8ecf5]" style={{ background: "#0b1220" }}>
        <div className="flex items-center gap-3">
          <div>
            <div className="text-[28px] leading-none font-bold tabular-nums" style={{ fontFamily: "'Kanit', sans-serif", color: GOLD }} data-testid="score">{data.score.toLocaleString("th-TH")}</div>
            <div className="text-[11px] text-[#8b97b3]">คะแนนสำรวจ</div>
          </div>
          <div className="flex-1 min-w-0">
            <b className="text-[13px] block truncate">{rk.name}{rk.next ? ` · อีก ${rk.next[0] - data.score} ถึง ${rk.next[1]}` : " · สูงสุดแล้ว"}</b>
            <div className="h-1.5 rounded bg-[#1d2946] overflow-hidden mt-1"><div className="h-full" style={{ width: rk.pct + "%", background: GOLD }} /></div>
          </div>
          <div className="text-center shrink-0" title="เช็คอินติดต่อกันกี่วัน">
            <Flame size={20} color={data.streak.today ? "#FF8A3D" : "#55627f"} className="mx-auto" />
            <div className="text-[11px] font-semibold tabular-nums" data-testid="streak">{data.streak.current} วัน</div>
          </div>
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11.5px] text-[#8b97b3] mt-2.5 tabular-nums">
          {LEVELS.slice().reverse().map(l => <span key={l.k} className="whitespace-nowrap"><i className="inline-block w-2 h-2 rounded-full mr-1 align-baseline" style={{ background: LEVEL_COLOR[l.k] }} />{l.name} <b className="text-[#e8ecf5]">{unlocked[l.k].size}</b>{tot[l.k] ? `/${tot[l.k]}` : ""}</span>)}
        </div>
        {!data.streak.today && <p className="text-[11px] mt-2" style={{ color: "#FF8A3D" }}>{data.streak.current > 0 ? "วันนี้ยังไม่ได้เช็คอิน — เช็คอินวันนี้เพื่อรักษาสตรีค" : "เช็คอินวันนี้เพื่อเริ่มสตรีค"}</p>}
      </div>

      <FogCanvas unlocked={unlocked} onInfo={setInfo} rest={rest} />

      {info && (
        <div className="rounded-2xl p-3.5 text-[#e8ecf5] relative" style={{ background: "#111a2e", border: "1px solid #263456" }} role="status">
          <button onClick={() => setInfo(null)} aria-label="ปิด" className="absolute top-2 right-3 text-[#8b97b3] text-lg leading-none">×</button>
          {info.on ? (
            <>
              <h3 className="font-bold text-base flex items-center gap-1.5" style={{ fontFamily: "'Kanit', sans-serif" }}><Check size={16} color="#5fd0a4" />{info.name}</h3>
              <p className="text-xs text-[#8b97b3] mt-0.5">{lv.name}{childInfo ? " · " + childInfo : ""}</p>
            </>
          ) : (
            <>
              <h3 className="font-bold text-base flex items-center gap-1.5" style={{ fontFamily: "'Kanit', sans-serif" }}><Lock size={15} />{lv.name}ที่ยังไม่ปลดล็อก</h3>
              <p className="text-xs text-[#8b97b3] mt-0.5">ไปเช็คอินในพื้นที่นี้เพื่อเปิดชื่อและรับ +{lv.pts} คะแนน</p>
            </>
          )}
        </div>
      )}

      <div className="bg-white rounded-2xl p-3.5 shadow-sm">
        <div className="flex justify-between items-baseline"><h3 className="text-sm font-semibold" style={{ fontFamily: "'Kanit', sans-serif" }}>ภารกิจประจำสัปดาห์</h3><span className="text-[11px] text-[#9199A8]">รีเซ็ตทุกวันจันทร์</span></div>
        <div className="mt-2 space-y-2.5">
          {data.missions.map(ms => {
            const done = ms.progress >= ms.goal;
            return (
              <div key={ms.id} className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm">{ms.title}</p>
                  <div className="h-1.5 rounded bg-[#EEF0F5] overflow-hidden mt-1"><div className="h-full bg-[#B8862B]" style={{ width: (ms.progress / ms.goal) * 100 + "%" }} /></div>
                  <p className="text-[11px] text-[#9199A8] mt-0.5">{ms.progress}/{ms.goal} · รางวัล +{ms.points}</p>
                </div>
                {ms.claimed ? <span className="text-[11px] text-[#178A5D] bg-[#E8F8F1] rounded-full px-2.5 py-1">รับแล้ว</span>
                  : <button disabled={!done || claiming === ms.id} onClick={() => claim(ms.id)} className={`text-xs font-medium px-3 py-1.5 rounded-full ${done ? "bg-[#6C5CE7] text-white" : "bg-[#EEF0F5] text-[#9199A8]"}`}>รับรางวัล</button>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
