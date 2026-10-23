import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { select } from "d3-selection";
import { zoom as d3zoom, zoomIdentity } from "d3-zoom";
import "d3-transition";
import { geoNaturalEarth1, geoPath } from "d3-geo";
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

  useEffect(() => {
    setVils([]);
    if (!subProv || !rest) return;
    let live = true;
    rest(`/rest/v1/villages?province=eq.${subProv}&select=id,name,lat,lng&limit=3000`).then(r => { if (live && Array.isArray(r)) setVils(r); }).catch(() => {});
    return () => { live = false; };
  }, [subProv, rest]);

  // สร้าง svg + zoom ครั้งเดียว
  useEffect(() => {
    const svg = select(svgEl.current);
    const g = svg.append("g");
    const o = { svg, g, shapes: g.append("g"), pins: g.append("g"), labels: g.append("g"), K: 1, T: zoomIdentity, lab: [], proj: geoNaturalEarth1(), W: 0, H: 0 };
    o.path = geoPath(o.proj);
    o.zoom = d3zoom().scaleExtent([1, MAXZ]).on("zoom", e => {
      o.K = e.transform.k; o.T = e.transform; g.attr("transform", e.transform);
      o.labels.selectAll("text").style("font-size", 11 / o.K + "px").style("stroke-width", 3 / o.K + "px");
      o.pins.selectAll("circle").attr("r", d => (d.r0 || 4.5) / o.K).style("stroke-width", 1.5 / o.K + "px");
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
    const C = LEVEL_COLOR[k];
    if (k === "vil") {
      // หมู่บ้านเป็นจุดพิกัด: วาดเขตอำเภอของจังหวัดเป็นฉากหลัง แล้วปักหมุดหมู่บ้าน (สว่าง = ปลดล็อกแล้ว)
      const ds = dis ? dis.features.filter(f => f.properties.pc === subProv) : [];
      o.shapes.selectAll("path.ctx").data(ds).join("path").attr("d", o.path).attr("fill", "#121b31").attr("stroke", "#34466f")
        .attr("stroke-width", 0.6).attr("vector-effect", "non-scaling-stroke").attr("pointer-events", "none");
      const pts = vils.map(v => ({ v, xy: o.proj([v.lng, v.lat]), on: unlocked.vil.has(String(v.id)) })).filter(d => d.xy && isFinite(d.xy[0]));
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
      const [cx, cy] = o.path.centroid(f); const a = o.path.area(f); const name = nameOf(k, f);
      return { f, cx, cy, a, name };
    }).filter(d => isFinite(d.cx) && isFinite(d.cy)).sort((x, y) => y.a - x.a);
    o.pins.selectAll("circle").data(lit).join("circle").attr("cx", d => d.cx).attr("cy", d => d.cy)
      .attr("r", 4.5 / o.K).attr("fill", C).attr("stroke", "#0b1220").style("stroke-width", 1.5 / o.K + "px").attr("pointer-events", "none");
    const tx = o.labels.selectAll("text").data(lit).join("text").attr("transform", d => `translate(${d.cx},${d.cy})`)
      .attr("dy", "-0.75em").text(d => d.name).attr("fill", "#f6f1e3").attr("stroke", "#0b1220").attr("paint-order", "stroke").attr("stroke-linejoin", "round")
      .attr("text-anchor", "middle").attr("pointer-events", "none").style("font-weight", 600)
      .style("font-size", 11 / o.K + "px").style("stroke-width", 3 / o.K + "px");
    o.lab = lit.map((d, i) => ({ el: tx.nodes()[i], cx: d.cx, cy: d.cy - 0, w: Math.max(24, d.name.length * 6.8) }));
    declutter(o);
  }, [ready, sizeTick, base, dis, sub, vils, active, unlocked, subProv, feats]);

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
        {LEVELS.map(l => (
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
      <div ref={wrap} className="relative rounded-2xl overflow-hidden border border-[#263456]" style={{ background: "#0b1220", height: "52vh", minHeight: 320, touchAction: "none" }}>
        <svg ref={svgEl} className="absolute inset-0 w-full h-full" role="img" aria-label="แผนที่เส้นแบ่งเขตที่ปลดล็อกได้ด้วยการเช็คอิน" />
        {!base && !err && <div className="absolute inset-0 flex items-center justify-center text-[#8b97b3]"><Loader2 className="animate-spin" size={22} /></div>}
        {err && <p className="absolute inset-0 flex items-center justify-center text-xs text-[#8b97b3] px-6 text-center">{err}</p>}
        {active === "vil" && base && subProv && vils.length === 0 && (
          <p className="absolute left-2 top-2 text-[10.5px] text-[#8b97b3] bg-[#111a2e]/90 border border-[#263456] rounded-lg px-2 py-1 pointer-events-none">ยังไม่มีข้อมูลหมู่บ้านในจังหวัดนี้</p>
        )}
        <div className="absolute right-2 top-2 flex flex-col gap-1.5">
          <button aria-label="ซูมเข้า" onClick={() => m.current.svg.transition().duration(250).call(m.current.zoom.scaleBy, 2.5)} className="w-9 h-9 text-lg leading-none bg-[#111a2e] text-[#e8ecf5] border border-[#263456] rounded-lg">+</button>
          <button aria-label="ซูมออก" onClick={() => m.current.svg.transition().duration(250).call(m.current.zoom.scaleBy, 0.4)} className="w-9 h-9 text-lg leading-none bg-[#111a2e] text-[#e8ecf5] border border-[#263456] rounded-lg">−</button>
        </div>
        <button onClick={view} className="absolute right-2 bottom-2 text-[11px] bg-[#111a2e] text-[#e8ecf5] border border-[#263456] rounded-lg px-2.5 py-1.5">เต็มจอ</button>
        <p className="absolute left-2 bottom-1.5 max-w-[calc(100%-5.5rem)] leading-tight text-[9px] text-[#55627f] pointer-events-none">ขอบเขต: OpenGISData-Thailand (CC BY 4.0) · Natural Earth</p>
      </div>
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
