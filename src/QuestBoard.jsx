// กระดานด่าน (หน้าเช็คอิน): แทนแผนที่หมอกแบบซูม
// แผนที่ย่อพอดีกรอบ ไม่มีชื่อ ไม่ซูม + ช่องด่านที่มีชื่อเสมอ เรียงจากที่อยู่ตอนนี้ → ปลดล็อกแล้ว → ใกล้ตัวที่สุด
import { useState, useEffect, useMemo, useCallback, lazy, Suspense, Component } from "react";
import { geoContains, geoCentroid, geoDistance } from "d3-geo";
import { loadBase, loadDis, loadSub, locateAt, RANKS, CONTINENT_TH } from "./geo.js";

// สีเดียวโทนขาวเหมือนหน้าหลัก: ม่วงของแอปเป็นสีเน้นสีเดียว
const QuestMap = lazy(() => import("./GameMap.jsx"));
const KIND_TH = { temple: "วัด", park: "อุทยาน / สวน", beach: "ชายหาด", waterfall: "น้ำตก", museum: "พิพิธภัณฑ์", cafe: "คาเฟ่", restaurant: "ร้านอาหาร", hotel: "ที่พัก", attraction: "ที่เที่ยว" };
// ถ้าแผนที่เต็มจอพัง ให้แสดงข้อความพร้อมปุ่มปิด แทนที่จะทำให้ทั้งแอปเป็นจอขาว
class MapGuard extends Component {
  constructor(p) { super(p); this.state = { err: null }; }
  static getDerivedStateFromError(err) { return { err }; }
  render() {
    if (!this.state.err) return this.props.children;
    return (
      <div className="rounded-2xl bg-white border border-[#E4E6EF] flex flex-col items-center justify-center gap-1 p-6 text-center" style={{ height: 250 }}>
        <p className="text-sm font-semibold text-[#1F2430]">โหลดแผนที่ไม่สำเร็จ</p>
        <p className="text-xs text-[#6B7280] break-all">{String(this.state.err?.message || this.state.err)}</p>
      </div>
    );
  }
}
const C = { bg: "#ffffff", card: "#F6F7FB", line: "#E4E6EF", text: "#1F2430", muted: "#6B7280", mint: "#6C5CE7", gold: "#6C5CE7", lock: "#E9EBF2", ember: "#6C5CE7", soft: "#EFECFF", map: "#C9C1FF" };
const LV = { world: { name: "ทวีป", child: "con" }, con: { name: "ประเทศ", child: "cty" }, cty: { name: "จังหวัด", child: "pro" }, pro: { name: "อำเภอ", child: "dis" }, dis: { name: "ตำบล", child: "sub" } };
const PREFIX = { pro: "จ.", dis: "อ.", sub: "ต." };
const kmText = (km) => (km < 1 ? `${Math.round(km * 1000)} ม.` : `${km.toFixed(1)} กม.`);
const rankOf = (score) => { let r = RANKS[0], next = null; for (let i = 0; i < RANKS.length; i++) { if (score >= RANKS[i][0]) { r = RANKS[i]; next = RANKS[i + 1] || null; } } return { name: r[1], next }; };
const store = { get(k) { try { return localStorage.getItem(k); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch { /* ignore */ } } };

const Star = ({ c = C.mint, s = 16 }) => <svg width={s} height={s} viewBox="0 0 24 24" fill={c} aria-hidden="true"><path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" /></svg>;
const LockIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 11V8a5 5 0 0 1 10 0v3M5 11h14v10H5z" /></svg>;
const Chevron = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>;

export default function QuestBoard({ rest, pos, nearest, onCheckin, onLocate, onAdd, busy, refreshKey, onMore, onOpenPlace = () => {}, showToast = () => {} }) {
  const [data, setData] = useState(null);
  const [pins, setPins] = useState([]);
  const [geo, setGeo] = useState(null); // { base, dis }
  const [here, setHere] = useState(null); // ตำแหน่งปัจจุบันอยู่ จังหวัด/อำเภอ/ตำบล ไหน
  const [view, setView] = useState(null); // { lvl: "cty"|"pro"|"dis", code }
  const [subs, setSubs] = useState({}); // ตำบลของแต่ละจังหวัดที่โหลดแล้ว
  const [sel, setSel] = useState(null);
  const [all, setAll] = useState(false);
  const [mapOpen, setMapOpen] = useState(store.get("qb_map") !== "0");
  const [claiming, setClaiming] = useState("");
  const [tall, setTall] = useState(false);
  const [pinSel, setPinSel] = useState(null);

  const refresh = useCallback(() => {
    rest("/rest/v1/rpc/my_explore", { method: "POST", body: {} }).then(setData)
      .catch(() => setData({ score: 0, checkins: 0, streak: { current: 0, best: 0, today: false }, missions: [], unlocks: [] }));
    rest("/rest/v1/rpc/my_place_pins_v2", { method: "POST", body: {} })
      .catch(() => rest("/rest/v1/rpc/my_place_pins", { method: "POST", body: {} }))
      .then(r => setPins(Array.isArray(r) ? r : [])).catch(() => setPins([]));
  }, [rest]);
  useEffect(() => { refresh(); }, [refresh, refreshKey]);
  useEffect(() => { Promise.all([loadBase(), loadDis()]).then(([base, dis]) => setGeo({ base, dis })).catch(() => {}); }, []);
  useEffect(() => { if (pos) locateAt(pos.lat, pos.lng).then(setHere).catch(() => setHere(null)); }, [pos && pos.lat, pos && pos.lng]);

  const un = useMemo(() => {
    const s = { con: new Set(), cty: new Set(), pro: new Set(), dis: new Set(), sub: new Set() };
    (data?.unlocks || []).forEach(u => s[u.level] && s[u.level].add(String(u.code)));
    return s;
  }, [data]);

  // มุมมองเริ่มต้น: อำเภอที่อยู่ตอนนี้ → อำเภอที่ปลดล็อกตำบลไว้มากที่สุด → ทั้งประเทศ
  useEffect(() => {
    if (view || !geo || !data) return;
    if (here?.dis) { setView({ lvl: "dis", code: here.dis }); return; }
    const cnt = {};
    un.sub.forEach(c => { const d = String(c).slice(0, 4); cnt[d] = (cnt[d] || 0) + 1; });
    const best = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0];
    if (best && geo.dis.features.some(f => f.properties.c === best)) setView({ lvl: "dis", code: best });
    else if (!pos) setView({ lvl: "cty", code: "THA" });
  }, [geo, data, here, view, un, pos]);
  // ตำแหน่งมาทีหลัง: ย้ายไปอำเภอที่อยู่ตอนนี้ ถ้ายังดูมุมกว้างอยู่
  useEffect(() => { if (here?.dis && view && view.lvl === "cty") setView({ lvl: "dis", code: here.dis }); }, [here]);

  const pc = view && (view.lvl === "pro" ? view.code : view.lvl === "dis" ? geo?.dis.features.find(f => f.properties.c === view.code)?.properties.pc : null);
  useEffect(() => { if (pc && !subs[pc]) loadSub(pc).then(j => setSubs(s => ({ ...s, [pc]: j }))).catch(() => {}); }, [pc]);

  // ลูกของพื้นที่ที่กำลังดู → ช่องด่าน
  const tiles = useMemo(() => {
    if (!view || !geo) return null;
    let feats, kind;
    if (view.lvl === "world") { feats = geo.base.con.features.filter(f => f.properties.CONTINENT !== "Antarctica"); kind = "con"; }
    else if (view.lvl === "con") { feats = geo.base.cty.features.filter(f => f.properties.k === view.code); kind = "cty"; }
    else if (view.lvl === "cty") { feats = geo.base.pro.features; kind = "pro"; }
    else if (view.lvl === "pro") { feats = geo.dis.features.filter(f => f.properties.pc === view.code); kind = "dis"; }
    else { if (!subs[pc]) return null; feats = subs[pc].features.filter(f => f.properties.dc === view.code); kind = "sub"; }
    const subsOf = (code) => [...un.sub].filter(c => String(c).startsWith(code)).length;
    const out = feats.map(f => {
      const p = f.properties;
      const code = kind === "con" ? p.CONTINENT : kind === "cty" ? p.a : String(p.c);
      const name = kind === "con" ? (CONTINENT_TH[p.CONTINENT] || p.CONTINENT) : kind === "cty" ? (p.a === "THA" ? "ประเทศไทย" : p.n) : p.th;
      const on = un[kind].has(code);
      const n = kind === "sub" ? pins.filter(q => q.lat != null && geoContains(f, [q.lng, q.lat])).length : 0;
      const hereCon = here?.cty ? geo.base.cty.features.find(x => x.properties.a === here.cty)?.properties.k : null;
      const isHere = here && (kind === "con" ? hereCon === code : kind === "cty" ? here.cty === code : kind === "pro" ? here.pro === code : kind === "dis" ? here.dis === code : here.sub === code);
      const km = pos ? geoDistance([pos.lng, pos.lat], geoCentroid(f)) * 6371 : null;
      const sub = kind === "con" ? `${geo.base.cty.features.filter(x => x.properties.k === code && un.cty.has(x.properties.a)).length} ประเทศ`
        : kind === "cty" ? (code === "THA" ? `${un.pro.size} จังหวัด` : "ไปแล้ว")
        : kind === "sub" ? (n ? `${n} สถานที่` : "ปลดล็อกแล้ว") : kind === "dis" ? `${subsOf(code)} ตำบล` : `${[...un.dis].filter(c => c.startsWith(code)).length} อำเภอ`;
      return { f, code, name, on, n, here: !!isHere, km, sub, kind };
    });
    out.sort((a, b) => (b.here - a.here) || (b.on - a.on) || (a.on ? (b.n - a.n) || a.name.localeCompare(b.name, "th") : (a.km ?? 1e9) - (b.km ?? 1e9) || a.name.localeCompare(b.name, "th")));
    return out;
  }, [view, geo, subs, pc, un, pins, here, pos]);

  const crumbs = useMemo(() => {
    if (!view || !geo) return [];
    const c = [{ lvl: "world", code: "world", name: "โลก" }];
    if (view.lvl === "world") return c;
    const conCode = view.lvl === "con" ? view.code : "Asia";
    c.push({ lvl: "con", code: conCode, name: CONTINENT_TH[conCode] || conCode });
    if (view.lvl === "con") return c;
    c.push({ lvl: "cty", code: "THA", name: "ไทย" });
    const proCode = view.lvl === "pro" ? view.code : pc;
    if (proCode) c.push({ lvl: "pro", code: proCode, name: geo.base.pro.features.find(f => f.properties.c === proCode)?.properties.th || "" });
    if (view.lvl === "dis") c.push({ lvl: "dis", code: view.code, name: "อ." + (geo.dis.features.find(f => f.properties.c === view.code)?.properties.th || "") });
    return c;
  }, [view, geo, pc]);


  const go = (v) => { setView(v); setSel(null); setAll(false); };
  const tap = (t) => {
    if (t.on && (t.kind === "con" || t.kind === "pro" || t.kind === "dis" || (t.kind === "cty" && t.code === "THA"))) { go({ lvl: t.kind, code: t.code }); return; }
    if (t.kind === "con" || t.kind === "cty") { if (!t.on) showToast("ยังไม่เคยเช็คอินที่นี่ ไปเช็คอินเพื่อปลดล็อก"); else showToast(`เคยไป${t.name}แล้ว`); return; }
    setSel(s => (s === t.code ? null : t.code));
    if (!t.on) showToast(t.km != null ? `ยังไม่ปลดล็อก · ห่างราว ${kmText(t.km)} ไปเช็คอินในพื้นที่นี้เพื่อเปิดชื่อ` : "ยังไม่ปลดล็อก ไปเช็คอินในพื้นที่นี้เพื่อเปิดชื่อ");
  };
  const toggleMap = () => { setMapOpen(o => { store.set("qb_map", o ? "0" : "1"); return !o; }); };
  const claim = async (id) => {
    setClaiming(id);
    try { const p = await rest("/rest/v1/rpc/claim_mission", { method: "POST", body: { p_mission: id } }); showToast(`รับรางวัลภารกิจ +${p} คะแนน`); refresh(); }
    catch (e) { showToast("รับรางวัลไม่สำเร็จ: " + e.message); }
    setClaiming("");
  };

  const done = tiles ? tiles.filter(t => t.on).length : 0;
  const total = tiles ? tiles.length : 0;
  const lvName = view ? LV[view.lvl].name : "";
  const selT = tiles && sel ? tiles.find(t => t.code === sel) : null;
  const selPins = selT && selT.kind === "sub" && selT.on ? pins.filter(q => q.lat != null && geoContains(selT.f, [q.lng, q.lat])) : [];
  const shown = tiles ? (all ? tiles : tiles.slice(0, 9)) : [];
  const rk = rankOf(data?.score || 0);
  const hereName = here?.sub && subs[here.pro] ? subs[here.pro].features.find(f => f.properties.c === here.sub)?.properties.th : null;

  return (
    <section className="rounded-3xl p-4 space-y-3 shadow-sm" style={{ background: C.bg, color: C.text, border: `1px solid ${C.line}` }} data-testid="quest-board">
      {/* คะแนน + สตรีค */}
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px]" style={{ color: C.muted }}>{rk.name}{rk.next ? ` · อีก ${rk.next[0] - (data?.score || 0)} ถึง${rk.next[1]}` : ""}</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="flex items-center gap-1 text-[13px] font-bold rounded-full px-2.5 py-1" style={{ background: C.card, border: `1px solid ${C.line}`, color: C.gold }} data-testid="score"><Star c={C.gold} s={13} />{data ? data.score : "–"}</span>
          <span className="flex items-center gap-1 text-[13px] font-bold rounded-full px-2.5 py-1" style={{ background: C.card, border: `1px solid ${C.line}`, color: C.ember }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill={C.ember} aria-hidden="true"><path d="M12 3c1 3 4 4.5 4 8.5a4 4 0 0 1-8 0c0-1.5.6-2.6 1.5-3.5.2 1.4 1 2 1.5 2C11 8 10.5 5.5 12 3z" /></svg>{data?.streak?.current || 0} วัน
          </span>
        </div>
      </div>

      {/* ปุ่มเช็คอินหลัก */}
      <div className="rounded-2xl p-3.5 space-y-2" style={{ background: C.mint, color: C.bg }} data-testid="qb-checkin">
        {!pos ? (<>
          <p className="text-[12px] font-semibold">เปิดตำแหน่งเพื่อดูว่าคุณอยู่ตำบลไหน</p>
          <button onClick={onLocate} className="w-full min-h-[46px] rounded-xl text-[15px] font-bold" style={{ background: C.bg, color: C.mint }}>{busy ? "กำลังหาตำแหน่ง..." : "หาตำแหน่งของฉัน"}</button>
        </>) : nearest ? (<>
          <p className="text-[12px] font-semibold">{hereName ? `คุณอยู่ใน ต.${hereName} · ` : ""}ใกล้สุด {Math.round(nearest.distance_m)} ม.</p>
          <p className="text-[19px] font-semibold leading-tight" style={{ fontFamily: "'Kanit', sans-serif" }}>{nearest.name}</p>
          <div className="flex gap-2">
            <button onClick={() => onCheckin(nearest)} data-testid="qb-checkin-btn" className="flex-1 min-h-[46px] rounded-xl text-[15px] font-bold" style={{ background: C.bg, color: C.mint }}>เช็คอินที่นี่</button>
            <button onClick={() => onAdd("list")} className="min-h-[46px] px-3.5 rounded-xl text-[13px] font-bold" style={{ border: `2px solid ${C.bg}` }}>ที่อื่น</button>
          </div>
        </>) : (<>
          <p className="text-[12px] font-semibold">{hereName ? `คุณอยู่ใน ต.${hereName} · ` : ""}ยังไม่มีสถานที่ในรัศมี 150 ม.</p>
          <button onClick={() => onAdd("add")} className="w-full min-h-[46px] rounded-xl text-[15px] font-bold" style={{ background: C.bg, color: C.mint }}>เพิ่มสถานที่ตรงนี้</button>
        </>)}
      </div>

      {/* เส้นทาง: แตะเพื่อขึ้นไปดูระดับบน */}
      {crumbs.length > 0 && (
        <nav className="flex items-center flex-wrap text-[13px]" aria-label="ระดับพื้นที่">
          {crumbs.map((c, i) => (
            <span key={c.lvl} className="flex items-center">
              {i > 0 && <Chevron />}
              {i < crumbs.length - 1
                ? <button onClick={() => go({ lvl: c.lvl, code: c.code })} className="min-h-[40px] px-2 font-semibold" style={{ color: C.muted }}>{c.name}</button>
                : <span className="px-2 font-bold" style={{ color: C.gold }}>{c.name}</span>}
            </span>
          ))}
        </nav>
      )}

      {!tiles && <p className="text-xs py-6 text-center" style={{ color: C.muted }}>กำลังโหลดด่าน...</p>}

      {tiles && (<>
        {/* แผนที่ย่อ + ความคืบหน้า */}
        <div className="rounded-2xl p-3 space-y-2" style={{ background: C.card, border: `1px solid ${C.line}` }}>
          <div className="flex items-center justify-between">
            <span className="text-[16px] font-semibold" style={{ fontFamily: "'Kanit', sans-serif" }} data-testid="qb-progress">ด่าน{lvName} {done}/{total}</span>
            <div className="flex items-center -mr-2">
              {mapOpen && <button onClick={() => setTall(v => !v)} data-testid="qb-map-tall" className="min-h-[40px] px-2 text-[12px] font-semibold" style={{ color: C.mint }}>{tall ? "ย่อกรอบ" : "ขยายกรอบ"}</button>}
              <button onClick={toggleMap} className="min-h-[40px] px-2 text-[12px] font-semibold" style={{ color: C.muted }}>{mapOpen ? "ซ่อนแผนที่" : "ดูแผนที่"}</button>
            </div>
          </div>
          {mapOpen && (
            <MapGuard>
              <Suspense fallback={<div className="rounded-2xl" style={{ height: 250, background: "radial-gradient(120% 90% at 50% 0%, #F4F1FF 0%, #FFFFFF 70%)", border: `1px solid ${C.line}` }} />}>
                <QuestMap items={tiles} pos={pos} sel={sel} tall={tall}
                  pins={view.lvl === "dis" ? pins.filter(q => q.lat != null && tiles.some(t => t.on && geoContains(t.f, [q.lng, q.lat]))) : []}
                  onSelect={(code) => { const t = tiles.find(x => x.code === code); if (t) { setPinSel(null); tap(t); } }}
                  onPin={(p) => { setSel(null); setPinSel(p); }} />
              </Suspense>
            </MapGuard>
          )}
          {pinSel && (
            <div className="flex items-center gap-3 rounded-2xl p-3" style={{ background: C.bg, border: `1px solid ${C.line}` }} data-testid="qb-pin-card">
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-bold truncate">{pinSel.name}</p>
                <p className="text-[12px]" style={{ color: C.muted }}>{KIND_TH[pinSel.kind] || KIND_TH[pinSel.category] || "สถานที่"}{pinSel.visits ? ` · เช็คอิน ${pinSel.visits} ครั้ง` : ""}</p>
              </div>
              {/^\d+$/.test(String(pinSel.id)) && <button onClick={() => onOpenPlace(pinSel.id)} className="min-h-[40px] px-3 rounded-xl text-[13px] font-bold text-white" style={{ background: C.mint }}>ดูหน้าสถานที่</button>}
              <button onClick={() => setPinSel(null)} aria-label="ปิด" className="min-w-[40px] min-h-[40px] rounded-xl text-[16px]" style={{ border: `1px solid ${C.line}`, color: C.muted }}>×</button>
            </div>
          )}
          {mapOpen && (
            <div className="flex items-center gap-3 text-[11px]" style={{ color: C.muted }}>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: C.map }} />ปลดล็อกแล้ว</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: C.gold }} />คุณอยู่ที่นี่</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: C.lock, border: `1px solid ${C.line}` }} />ยังล็อก</span>
              <span className="ml-auto" style={{ color: C.muted }}>{total - done > 0 ? `อีก ${total - done} ด่าน` : "ครบแล้ว"}</span>
            </div>
          )}
          <div className="h-2 rounded overflow-hidden" style={{ background: C.bg }}><div className="h-full" style={{ width: (total ? (done / total) * 100 : 0) + "%", background: C.gold }} /></div>
        </div>

        {/* ช่องด่าน */}
        <div className="grid grid-cols-3 gap-2" data-testid="qb-tiles">
          {shown.map(t => (
            <button key={t.code} onClick={() => tap(t)} data-testid="qb-tile" aria-pressed={sel === t.code}
              className="min-h-[84px] rounded-2xl p-2 flex flex-col items-start gap-0.5 text-left"
              style={t.here ? { border: `2px solid ${C.gold}`, background: C.gold, color: "#ffffff" } : t.on ? { border: `2px solid ${sel === t.code ? C.text : C.mint}`, background: C.soft } : { border: `2px ${t.km != null && t === tiles.find(x => !x.on) ? "dashed" : "solid"} ${sel === t.code ? C.text : C.line}`, background: C.card }}>
              {t.here ? <span className="text-[10px] font-bold rounded px-1.5" style={{ background: "#ffffff", color: C.gold }}>อยู่ที่นี่</span> : t.on ? <Star /> : <LockIcon />}
              <span className="text-[14px] font-bold leading-tight break-words w-full">{t.on || t.here || t.kind === "con" || t.kind === "cty" ? t.name : "???"}</span>
              <span className="text-[11px]" style={{ color: t.here ? "#ffffff" : t.on ? C.mint : C.muted }}>{t.on ? t.sub : t.km != null ? (t === tiles.find(x => !x.on) ? `ใกล้สุด ${kmText(t.km)}` : kmText(t.km)) : "ยังไม่ปลดล็อก"}</span>
            </button>
          ))}
        </div>
        {tiles.length > 9 && (
          <button onClick={() => setAll(a => !a)} className="w-full min-h-[44px] text-[12px] font-semibold rounded-xl" style={{ color: C.text, border: `1px solid ${C.line}` }} data-testid="qb-more">
            {all ? "ย่อรายการ" : `ดูอีก ${tiles.length - 9} ด่าน`}
          </button>
        )}

        {/* รายละเอียดตำบลที่แตะ */}
        {selT && selT.kind === "sub" && (
          <div className="rounded-2xl p-3 space-y-1.5" style={{ background: C.card, border: `1px solid ${C.line}` }} role="status" data-testid="qb-detail">
            <p className="text-[15px] font-bold" style={{ fontFamily: "'Kanit', sans-serif" }}>{selT.on ? "ต." + selT.name : "ตำบลที่ยังไม่ปลดล็อก"}</p>
            {selT.on
              ? (selPins.length ? selPins.map(q => <p key={q.id} className="text-[13px]">· {q.name}</p>) : <p className="text-[12px]" style={{ color: C.muted }}>ปลดล็อกแล้ว</p>)
              : <p className="text-[12px]" style={{ color: C.muted }}>{selT.km != null ? `ห่างราว ${kmText(selT.km)} · ` : ""}ไปเช็คอินในพื้นที่นี้เพื่อเปิดชื่อ</p>}
          </div>
        )}
      </>)}

      {data && !data.streak?.today && (
        <p className="text-[11px]" style={{ color: C.ember }}>{data.streak?.current > 0 ? "วันนี้ยังไม่ได้เช็คอิน · เช็คอินวันนี้เพื่อรักษาสตรีค" : "เช็คอินวันนี้เพื่อเริ่มสตรีค"}</p>
      )}

      {data?.missions?.length > 0 && (
        <div className="rounded-2xl p-3 space-y-2.5" style={{ background: C.card, border: `1px solid ${C.line}` }}>
          <div className="flex justify-between items-baseline"><h3 className="text-sm font-semibold" style={{ fontFamily: "'Kanit', sans-serif" }}>ภารกิจประจำสัปดาห์</h3><span className="text-[11px]" style={{ color: C.muted }}>รีเซ็ตทุกวันจันทร์</span></div>
          {data.missions.map(ms => {
            const ok = ms.progress >= ms.goal;
            return (
              <div key={ms.id} className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-[13px]">{ms.title}</p>
                  <div className="h-1.5 rounded overflow-hidden mt-1" style={{ background: C.bg }}><div className="h-full" style={{ width: Math.min(100, (ms.progress / ms.goal) * 100) + "%", background: C.gold }} /></div>
                  <p className="text-[11px] mt-0.5" style={{ color: C.muted }}>{ms.progress}/{ms.goal} · รางวัล +{ms.points}</p>
                </div>
                {ms.claimed ? <span className="text-[11px] rounded-full px-2.5 py-1" style={{ background: C.soft, color: C.mint }}>รับแล้ว</span>
                  : <button disabled={!ok || claiming === ms.id} onClick={() => claim(ms.id)} className="text-xs font-semibold px-3 py-2 rounded-full disabled:opacity-40" style={{ background: C.gold, color: C.bg }}>รับรางวัล</button>}
              </div>
            );
          })}
        </div>
      )}
      {onMore && (
        <button onClick={onMore} data-testid="qb-more-challenges" className="w-full min-h-[44px] rounded-xl text-[13px] font-semibold" style={{ border: `1px solid ${C.line}`, color: C.text }}>
          ความท้าทายธรรมชาติ · เส้นทาง 9 บท · ร้านค้า
        </button>
      )}
    </section>
  );
}
