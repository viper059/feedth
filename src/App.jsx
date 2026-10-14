import { useState, useEffect, useCallback, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  Heart, MessageCircle, Zap, Wallet, Send, X, Sparkles,
  Share2, UserPlus, UserCheck, Crown, Trophy, Loader2, LogOut, MapPin, ArrowLeft, Home, User, Medal, Compass,
} from "lucide-react";

// ==========================================================
// 1) ใส่ค่าจาก Supabase Project Settings > API ตรงนี้
// ==========================================================
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "YOUR_SUPABASE_URL"; // เช่น https://xxxxx.supabase.co
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "YOUR_SUPABASE_ANON_KEY";

const FONT_IMPORT = `@import url('https://fonts.googleapis.com/css2?family=Kanit:wght@500;600;700&family=IBM+Plex+Sans+Thai:wght@400;500;600&display=swap');`;
const SESSION_KEY = "feedth-session";

const TIERS = [
  { min: 30, label: "เพื่อนรัก", color: "#B77600", bg: "#FFF4DD", icon: Crown },
  { min: 15, label: "เพื่อนสนิท", color: "#6C5CE7", bg: "#F0EDFF", icon: null },
  { min: 5, label: "เพื่อน", color: "#178A5D", bg: "#E8F8F1", icon: null },
  { min: 0, label: "คนรู้จัก", color: "#9199A8", bg: "#F1F2F5", icon: null },
];
const tierFor = (points) => TIERS.find(t => points >= t.min);
const boostActive = (p) => p.is_boosted && (!p.boost_expire_at || new Date(p.boost_expire_at) > new Date());

const BOOST_OPTIONS = [
  { credits: 10, label: "6 ชม.", desc: "เห็นเพิ่มในฟีดเพื่อน" },
  { credits: 25, label: "24 ชม.", desc: "ติดฟีดยอดนิยม" },
  { credits: 50, label: "3 วัน", desc: "เด่นสุด + ป้ายพิเศษ" },
];

function timeAgo(iso) {
  const mins = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "เมื่อสักครู่";
  if (mins < 60) return `${mins} นาทีที่แล้ว`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h} ชม.ที่แล้ว`;
  return `${Math.floor(h / 24)} วันที่แล้ว`;
}

const configured = SUPABASE_URL !== "YOUR_SUPABASE_URL" && SUPABASE_ANON_KEY !== "YOUR_SUPABASE_ANON_KEY";

const TOPIC_KEYWORDS = {
  van_custom: ["รถตู้", "แต่งรถ", "ช่วงล่าง", "พ่นสี"],
  food: ["กิน", "อร่อย", "ร้านอาหาร", "ก๋วยเตี๋ยว", "หมูปิ้ง"],
  cafe: ["คาเฟ่", "กาแฟ"],
  travel: ["เที่ยว", "ทริป", "ทะเล", "ภูเขา"],
  hotel: ["ที่พัก", "โรงแรม", "รีสอร์ท"],
};
const CATEGORY_TH = { attraction: "ที่เที่ยว", hotel: "ที่พัก", restaurant: "ร้านอาหาร", cafe: "คาเฟ่", other: "อื่นๆ" };
const CHECKIN_RADIUS_M = 150;

const ACHIEVEMENTS = [
  { id: "first", icon: "🌱", label: "ก้าวแรก", desc: "เช็คอินครั้งแรก", test: t => t.total >= 1 },
  { id: "five", icon: "🔥", label: "นักเดินทาง", desc: "เช็คอินครบ 5 ครั้ง", test: t => t.total >= 5 },
  { id: "ten", icon: "🏆", label: "ขาลุย", desc: "เช็คอินครบ 10 ครั้ง", test: t => t.total >= 10 },
  { id: "cafe3", icon: "☕", label: "สายคาเฟ่", desc: "เช็คอินคาเฟ่ 3 ครั้ง", test: t => (t.by_cat.cafe || 0) >= 3 },
  { id: "food3", icon: "🍜", label: "นักชิม", desc: "เช็คอินร้านอาหาร 3 ครั้ง", test: t => (t.by_cat.restaurant || 0) >= 3 },
  { id: "temple3", icon: "⛩️", label: "สายมู", desc: "เช็คอินที่เที่ยว 3 ครั้ง", test: t => (t.by_cat.attraction || 0) >= 3 },
  { id: "prov3", icon: "🗺️", label: "ล่าจังหวัด", desc: "เช็คอินครบ 3 จังหวัด", test: t => t.provinces.length >= 3 },
  { id: "hotel", icon: "🏨", label: "นักนอน", desc: "เช็คอินที่พัก 1 ครั้ง", test: t => (t.by_cat.hotel || 0) >= 1 },
];

const CAT_COLOR = { attraction: "#17B890", hotel: "#4A90E2", restaurant: "#EF4565", cafe: "#FFB020", other: "#9199A8" };

// แผนที่ Leaflet + OpenStreetMap (ไม่ต้องใช้ API key) แสดงตำแหน่งเรา วงรัศมีเช็คอิน และหมุดสถานที่
function PlaceMap({ pos, places, onPick }) {
  const el = useRef(null);
  const map = useRef(null);
  const layer = useRef(null);
  const pickRef = useRef(onPick);
  pickRef.current = onPick;

  useEffect(() => {
    if (!el.current || map.current) return;
    map.current = L.map(el.current).setView([pos.lat, pos.lng], 16);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map.current);
    layer.current = L.layerGroup().addTo(map.current);
    return () => { map.current.remove(); map.current = null; };
  }, []);

  useEffect(() => {
    if (!map.current) return;
    layer.current.clearLayers();
    L.circle([pos.lat, pos.lng], { radius: CHECKIN_RADIUS_M, color: "#6C5CE7", weight: 1.5, dashArray: "4 4", fillColor: "#6C5CE7", fillOpacity: 0.1 }).addTo(layer.current);
    L.circleMarker([pos.lat, pos.lng], { radius: 8, color: "#fff", weight: 3, fillColor: "#6C5CE7", fillOpacity: 1 }).addTo(layer.current);
    places.forEach(pl => {
      const m = L.circleMarker([pl.lat, pl.lng], { radius: 10, color: "#fff", weight: 3, fillColor: CAT_COLOR[pl.category] || "#9199A8", fillOpacity: 1 });
      const tip = document.createElement("div");
      tip.textContent = pl.name; // ใช้ textContent กันโค้ดแฝงในชื่อสถานที่
      m.bindTooltip(tip, { direction: "top" });
      m.on("click", () => pickRef.current(pl));
      m.addTo(layer.current);
    });
    map.current.setView([pos.lat, pos.lng], map.current.getZoom());
  }, [pos, places]);

  return <div ref={el} className="w-full rounded-2xl overflow-hidden" style={{ height: 260 }} role="img" aria-label="แผนที่แสดงตำแหน่งของคุณและสถานที่ใกล้เคียง" />;
}

function CheckinTab({ rest, onBack, showToast, onOpenPlace }) {
  const [pos, setPos] = useState(null);
  const [places, setPlaces] = useState([]);
  const [cat, setCat] = useState("all");
  const [busy, setBusy] = useState(false);
  const [target, setTarget] = useState(null); // สถานที่ที่กำลังเช็คอิน
  const [rating, setRating] = useState(5);
  const [caption, setCaption] = useState("");
  const [newName, setNewName] = useState("");
  const [newCat, setNewCat] = useState("cafe");

  const load = useCallback(async (p) => {
    try {
      setPlaces(await rest("/rest/v1/rpc/nearby_places_v2", { method: "POST", body: { p_lat: p.lat, p_lng: p.lng, p_radius_m: 5000 } }));
    } catch (e) { showToast("โหลดสถานที่ไม่สำเร็จ: " + e.message); }
  }, [rest]);

  const locate = () => {
    if (!navigator.geolocation) { showToast("อุปกรณ์นี้ไม่รองรับตำแหน่ง"); return; }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      (g) => { const p = { lat: g.coords.latitude, lng: g.coords.longitude }; setPos(p); load(p); setBusy(false); },
      () => { showToast("เปิดสิทธิ์ตำแหน่งก่อนนะ"); setBusy(false); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };
  useEffect(() => { locate(); }, []);

  const submitCheckin = async () => {
    try {
      await rest("/rest/v1/rpc/check_in", { method: "POST", body: { p_place_id: target.id, p_lat: pos.lat, p_lng: pos.lng, p_rating: rating, p_caption: caption } });
      showToast(`เช็คอินที่ ${target.name} สำเร็จ`);
      rest("/rest/v1/rpc/record_interest", { method: "POST", body: { p_topic: target.category, p_weight: 3 } }).catch(() => {});
      setTarget(null); setCaption(""); load(pos);
    } catch (e) {
      const m = e.message;
      showToast(m.includes("too far") ? "ไกลเกินไป ต้องอยู่ในรัศมี 150 ม." : m.includes("already") ? "วันนี้เช็คอินที่นี่ไปแล้ว" : m.includes("suspicious") ? "ตรวจพบการเดินทางเร็วผิดปกติ" : "เช็คอินไม่สำเร็จ: " + m);
    }
  };

  const addPlace = async () => {
    if (!newName.trim() || !pos) return;
    try {
      await rest("/rest/v1/rpc/add_place", { method: "POST", body: { p_name: newName, p_category: newCat, p_lat: pos.lat, p_lng: pos.lng } });
      setNewName(""); showToast("เพิ่มสถานที่แล้ว"); load(pos);
    } catch (e) { showToast(e.message.includes("exists") ? "มีสถานที่นี้อยู่แล้วใกล้ๆ" : "เพิ่มไม่สำเร็จ: " + e.message); }
  };

  const pickPlace = (pl) => {
    if (pl.distance_m <= CHECKIN_RADIUS_M) setTarget(pl);
    else showToast(`${pl.name} อยู่ไกลเกินไป (${Math.round(pl.distance_m)} ม.) ต้องอยู่ในรัศมี ${CHECKIN_RADIUS_M} ม.`);
  };

  const shown = places.filter(pl => cat === "all" || pl.category === cat);

  return (
    <div style={{ fontFamily: "'IBM Plex Sans Thai', sans-serif" }} className="min-h-screen bg-[#F3F5FA] text-[#1A1D29] pb-16">
      <style>{FONT_IMPORT}</style>
      <header className="sticky top-0 z-20 bg-[#F3F5FA]/90 backdrop-blur border-b border-black/5">
        <div className="max-w-xl mx-auto flex items-center gap-3 px-4 py-3">
          <button onClick={onBack} aria-label="กลับ" className="text-[#6B7280]"><ArrowLeft size={18} /></button>
          <h1 style={{ fontFamily: "'Kanit', sans-serif" }} className="text-xl font-semibold text-[#6C5CE7]">เช็คอิน</h1>
          <button onClick={locate} className="ml-auto text-xs text-[#6C5CE7] flex items-center gap-1"><MapPin size={14} />{busy ? "กำลังหาตำแหน่ง..." : "อัปเดตตำแหน่ง"}</button>
        </div>
      </header>
      <main className="max-w-xl mx-auto px-4 pt-3 space-y-3">
        {pos && (
          <div className="relative isolate z-0">
            <PlaceMap pos={pos} places={places} onPick={pickPlace} />
            <p className="text-[11px] text-[#9199A8] mt-1">จุดสีม่วง = คุณ · วงประ = รัศมีเช็คอิน 150 ม. · กดหมุดเพื่อเช็คอิน</p>
          </div>
        )}
        <div className="flex gap-2 overflow-x-auto">
          {["all", ...Object.keys(CATEGORY_TH)].map(c => (
            <button key={c} onClick={() => setCat(c)} className={`text-xs px-3 py-1.5 rounded-full whitespace-nowrap ${cat === c ? "bg-[#6C5CE7] text-white" : "bg-white border border-black/10"}`}>
              {c === "all" ? "ทั้งหมด" : CATEGORY_TH[c]}
            </button>
          ))}
        </div>

        {shown.map(pl => {
          const near = pl.distance_m <= CHECKIN_RADIUS_M;
          return (
            <div key={pl.id} className="bg-white rounded-2xl p-3 flex items-center gap-3 shadow-sm">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate"><button onClick={() => onOpenPlace(pl.id)} className="hover:underline text-left">{pl.name}</button>{pl.is_boosted && <span className="ml-1.5 text-[10px] text-[#B77600] bg-[#FFF4DD] rounded-full px-2 py-0.5">โปรโมท</span>}{pl.is_verified && <span className="ml-1.5 text-[10px] text-[#178A5D] bg-[#E8F8F1] rounded-full px-2 py-0.5">ยืนยันแล้ว</span>}</p>
                <p className="text-xs text-[#6B7280]">{CATEGORY_TH[pl.category]} · {pl.distance_m < 1000 ? `${Math.round(pl.distance_m)} ม.` : `${(pl.distance_m / 1000).toFixed(1)} กม.`} · เช็คอินแล้ว {pl.checkin_count} ครั้ง</p>
              </div>
              <button disabled={!near} onClick={() => setTarget(pl)} className={`text-sm font-medium px-3.5 py-2 rounded-full ${near ? "bg-[#6C5CE7] text-white" : "bg-[#EEF0F5] text-[#9199A8]"}`}>{near ? "เช็คอิน" : "ไกลไป"}</button>
            </div>
          );
        })}
        {pos && shown.length === 0 && <p className="text-center text-xs text-[#9199A8] py-4">ยังไม่มีสถานที่ใกล้คุณ เพิ่มสถานที่แรกได้เลย</p>}

        <div className="bg-white rounded-2xl p-3 shadow-sm space-y-2">
          <p className="text-sm font-medium">เพิ่มสถานที่ตรงตำแหน่งที่คุณอยู่</p>
          <div className="flex gap-2">
            <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="ชื่อสถานที่" className="flex-1 text-sm bg-[#F3F5FA] rounded-lg px-3 py-2 outline-none" />
            <select value={newCat} onChange={e => setNewCat(e.target.value)} className="text-sm bg-[#F3F5FA] rounded-lg px-2">
              {Object.entries(CATEGORY_TH).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <button onClick={addPlace} disabled={!newName.trim() || !pos} className="w-full bg-[#6C5CE7] disabled:opacity-40 text-white text-sm font-medium py-2 rounded-lg">เพิ่มสถานที่</button>
        </div>
      </main>

      {target && (
        <div className="fixed inset-0 bg-black/40 flex items-end justify-center z-50 px-4">
          <div className="bg-white rounded-t-2xl w-full max-w-sm p-4 relative space-y-3">
            <button onClick={() => setTarget(null)} aria-label="ปิด" className="absolute top-3 right-3 text-[#9199A8]"><X size={18} /></button>
            <h3 style={{ fontFamily: "'Kanit', sans-serif" }} className="font-semibold">{target.name}</h3>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map(n => <button key={n} onClick={() => setRating(n)} aria-label={`${n} ดาว`} className="text-2xl leading-none" style={{ color: n <= rating ? "#FFB020" : "#D5D9E2" }}>★</button>)}
            </div>
            <textarea value={caption} onChange={e => setCaption(e.target.value)} rows={2} placeholder="เล่าบรรยากาศสั้นๆ..." className="w-full text-sm bg-[#F3F5FA] rounded-lg px-3 py-2 outline-none resize-none" />
            <button onClick={submitCheckin} className="w-full bg-[#6C5CE7] text-white text-sm font-semibold py-2.5 rounded-full">เช็คอินที่นี่</button>
          </div>
        </div>
      )}
    </div>
  );
}

const Stars = ({ n, size = 13 }) => (
  <span style={{ color: "#FFB020", fontSize: size, letterSpacing: 1 }} aria-label={`${n} ดาว`}>{"★".repeat(Math.round(n))}<span style={{ color: "#D5D9E2" }}>{"★".repeat(5 - Math.round(n))}</span></span>
);

function dayLabel(iso) {
  const d = new Date(iso), n = new Date();
  const day = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(n) - day(d)) / 86400000);
  if (diff === 0) return "วันนี้";
  if (diff === 1) return "เมื่อวาน";
  return d.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
}

// หน้าสถานที่: คะแนนเฉลี่ย + รีวิวของทุกคนเรียงเป็นไทม์ไลน์รายวัน
function PlaceDetail({ placeId, rest, posts, userId, wallet, onBoosted, onLike, onBack, onProfile, onCheckin, showToast }) {
  const [info, setInfo] = useState(null);
  const [boosted, setBoosted] = useState(false);
  const [showBoost, setShowBoost] = useState(false);
  const boost = async (opt) => {
    if (wallet < opt.credits) { showToast("เครดิตไม่พอ"); return; }
    try {
      await rest("/rest/v1/rpc/boost_place", { method: "POST", body: { p_place_id: placeId, p_credits: opt.credits } });
      setBoosted(true); setShowBoost(false); onBoosted(); showToast(`โปรโมทสถานที่ ${opt.label} สำเร็จ`);
    } catch (e) { showToast("โปรโมทไม่สำเร็จ: " + e.message); }
  };
  useEffect(() => { rest("/rest/v1/rpc/place_boosted", { method: "POST", body: { p_place_id: placeId } }).then(setBoosted).catch(() => {}); }, [placeId]);
  useEffect(() => {
    (async () => {
      try { const r = await rest("/rest/v1/rpc/place_summary", { method: "POST", body: { p_place_id: placeId } }); setInfo(r[0] || null); }
      catch (e) { showToast("โหลดสถานที่ไม่สำเร็จ: " + e.message); }
    })();
  }, [placeId, posts.length]);

  const reviews = posts.filter(p => p.place_id === placeId).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const groups = [];
  reviews.forEach(r => {
    const label = dayLabel(r.created_at);
    const g = groups.find(x => x.label === label);
    g ? g.items.push(r) : groups.push({ label, items: [r] });
  });

  return (
    <div style={{ fontFamily: "'IBM Plex Sans Thai', sans-serif" }} className="min-h-screen bg-[#F3F5FA] text-[#1A1D29] pb-20">
      <style>{FONT_IMPORT}</style>
      <header className="sticky top-0 z-20 bg-[#F3F5FA]/90 backdrop-blur border-b border-black/5">
        <div className="max-w-xl mx-auto flex items-center gap-3 px-4 py-3">
          <button onClick={onBack} aria-label="กลับ" className="text-[#6B7280]"><ArrowLeft size={18} /></button>
          <h1 style={{ fontFamily: "'Kanit', sans-serif" }} className="text-lg font-semibold text-[#6C5CE7] truncate">{info?.name || "สถานที่"}</h1>
        </div>
      </header>
      <main className="max-w-xl mx-auto px-4 pt-4 space-y-3">
        {info && (
          <div className="bg-white rounded-2xl p-4 shadow-sm space-y-2">
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full text-white" style={{ background: CAT_COLOR[info.category] }}>{CATEGORY_TH[info.category]}</span>
            {info.is_verified && <span className="ml-1.5 text-[10px] text-[#178A5D] bg-[#E8F8F1] rounded-full px-2 py-0.5">ยืนยันแล้ว</span>}
            <div className="flex items-end gap-3">
              <span style={{ fontFamily: "'Kanit', sans-serif" }} className="text-3xl font-semibold">{info.avg_rating ?? "-"}</span>
              <div className="pb-1"><Stars n={Number(info.avg_rating || 0)} size={16} /><p className="text-xs text-[#6B7280]">{info.review_count} เช็คอิน · {info.visitors} คน</p></div>
            </div>
            <button onClick={onCheckin} className="w-full bg-[#6C5CE7] text-white text-sm font-semibold py-2.5 rounded-full flex items-center justify-center gap-1.5"><MapPin size={15} /> ไปเช็คอินที่นี่</button>
            <button onClick={() => setShowBoost(v => !v)} className="w-full border border-[#FFB020]/50 text-[#B77600] text-sm font-medium py-2 rounded-full flex items-center justify-center gap-1.5"><Zap size={15} /> {boosted ? "กำลังโปรโมท · ต่อเวลา" : "โปรโมทสถานที่นี้"} ({wallet} เครดิต)</button>
            {showBoost && (
              <div className="space-y-2 pt-1">
                {BOOST_OPTIONS.map(o => (
                  <button key={o.credits} onClick={() => boost(o)} className="w-full flex items-center justify-between border border-black/10 rounded-xl px-3 py-2 text-left">
                    <div><p className="text-sm font-medium">{o.label}</p><p className="text-xs text-[#9199A8]">ขึ้นบนสุดในรายการสถานที่ใกล้เคียง</p></div>
                    <span className="text-sm font-semibold text-[#B77600]">{o.credits} เครดิต</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {groups.length === 0 && <p className="text-center text-xs text-[#9199A8] py-6">ยังไม่มีรีวิว เป็นคนแรกเลย</p>}
        {groups.map(g => (
          <section key={g.label}>
            <p className="text-[11px] tracking-wide text-[#9199A8] mb-2 flex items-center gap-2">{g.label}<span className="flex-1 h-px bg-black/10" /></p>
            {g.items.map(r => {
              const liked = r.likes.some(l => l.user_id === userId);
              return (
                <article key={r.id} className="bg-white rounded-2xl p-3.5 shadow-sm mb-2.5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-[#6C5CE7]/10 text-[#6C5CE7] flex items-center justify-center font-semibold text-sm">{r.author.username[0]?.toUpperCase()}</div>
                    <div className="leading-tight flex-1">
                      <button onClick={() => onProfile(r.author.id)} className="text-sm font-medium hover:underline">{r.author.username}</button>
                      <p className="text-xs text-[#9199A8]">{new Date(r.created_at).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}</p>
                    </div>
                    <span className="text-[10px] border border-[#B77600] text-[#B77600] rounded px-1.5 py-0.5 -rotate-3">CHECK-IN</span>
                  </div>
                  <p className="text-sm my-2 whitespace-pre-wrap">{r.content}</p>
                  <div className="flex items-center justify-between">
                    {r.rating ? <Stars n={r.rating} /> : <span />}
                    <button onClick={() => onLike(r)} className={`flex items-center gap-1.5 text-sm ${liked ? "text-[#EF4565]" : "text-[#6B7280]"}`}>
                      <Heart size={16} fill={liked ? "#EF4565" : "none"} /> {r.likes.length}
                    </button>
                  </div>
                </article>
              );
            })}
          </section>
        ))}
      </main>
    </div>
  );
}

function RankTab({ rest, userId, onProfile, showToast }) {
  const [sort, setSort] = useState("checkins");
  const [rows, setRows] = useState(null);
  useEffect(() => {
    setRows(null);
    rest("/rest/v1/rpc/leaderboard", { method: "POST", body: { p_sort: sort } }).then(setRows).catch(e => { showToast("โหลดอันดับไม่สำเร็จ: " + e.message); setRows([]); });
  }, [sort]);
  const sorts = [["checkins", "เช็คอิน", "ครั้ง"], ["rating_sum", "คะแนนรีวิว", "คะแนน"], ["likes_received", "ยอดไลค์", "ไลค์"]];
  const unit = sorts.find(x => x[0] === sort)[2];
  return (
    <div style={{ fontFamily: "'IBM Plex Sans Thai', sans-serif" }} className="min-h-screen bg-[#F3F5FA] text-[#1A1D29] pb-20">
      <style>{FONT_IMPORT}</style>
      <header className="sticky top-0 z-20 bg-[#F3F5FA]/90 backdrop-blur border-b border-black/5">
        <div className="max-w-xl mx-auto px-4 py-3"><h1 style={{ fontFamily: "'Kanit', sans-serif" }} className="text-xl font-semibold text-[#6C5CE7]">อันดับนักเดินทาง</h1></div>
      </header>
      <main className="max-w-xl mx-auto px-4 pt-3 space-y-2">
        <div className="flex gap-2">
          {sorts.map(([k, l]) => <button key={k} onClick={() => setSort(k)} className={`text-xs px-3 py-1.5 rounded-full ${sort === k ? "bg-[#6C5CE7] text-white" : "bg-white border border-black/10"}`}>{l}</button>)}
        </div>
        {rows === null && <p className="text-center text-xs text-[#9199A8] py-6">กำลังโหลด...</p>}
        {rows && rows.length === 0 && <p className="text-center text-xs text-[#9199A8] py-6">ยังไม่มีใครเช็คอิน</p>}
        {rows && rows.map((r, i) => (
          <button key={r.user_id} onClick={() => onProfile(r.user_id)} className={`w-full bg-white rounded-2xl p-3 shadow-sm flex items-center gap-3 text-left ${r.user_id === userId ? "ring-1 ring-[#FFB020]" : ""}`}>
            <span className="w-6 text-center font-semibold" style={{ color: i < 3 ? "#B77600" : "#9199A8" }}>{i < 3 ? <Medal size={18} className="mx-auto" /> : i + 1}</span>
            <span className="flex-1 min-w-0"><span className="block text-sm font-medium truncate">{r.username}{r.user_id === userId ? " (คุณ)" : ""}</span><span className="block text-xs text-[#9199A8]">{r.checkins} เช็คอิน</span></span>
            <span className="text-sm font-semibold text-[#6C5CE7]">{r[sort]} {unit}</span>
          </button>
        ))}
      </main>
    </div>
  );
}

// พาสปอร์ตเดินทาง: ตราประทับ อันดับที่ไปบ่อย และ % การสำรวจแต่ละจังหวัด
function Passport({ t }) {
  const stamps = ACHIEVEMENTS.map(a => ({ ...a, on: a.test(t) }));
  return (
    <>
      <div className="bg-white rounded-2xl p-4 shadow-sm">
        <p className="text-sm font-medium mb-2">ตราประทับ {stamps.filter(x => x.on).length}/{stamps.length}</p>
        <div className="grid grid-cols-4 gap-2">
          {stamps.map(a => (
            <div key={a.id} title={a.desc} className="aspect-square rounded-full flex flex-col items-center justify-center text-center p-1 text-[10px]"
              style={a.on ? { border: "2px solid #B8862B", color: "#B8862B", background: "#FFF9EC", transform: "rotate(-5deg)" } : { border: "2px dashed #D5D9E2", color: "#B8BDC9" }}>
              <span className="text-lg leading-none">{a.on ? a.icon : "🔒"}</span>{a.label}
            </div>
          ))}
        </div>
      </div>
      {t.top.length > 0 && (
        <div className="bg-white rounded-2xl p-4 shadow-sm space-y-2">
          <p className="text-sm font-medium">สถานที่ที่ไปบ่อยที่สุด</p>
          {t.top.map((x, i) => (
            <div key={x.id} className="flex items-center gap-2 text-sm"><span className="w-5 text-[#B77600] font-semibold">#{i + 1}</span><span className="flex-1 truncate">{x.name}</span><span className="text-xs text-[#6B7280]">{CATEGORY_TH[x.category]} · {x.visits} ครั้ง</span></div>
          ))}
        </div>
      )}
      <div className="bg-white rounded-2xl p-4 shadow-sm space-y-2.5">
        <p className="text-sm font-medium">สำรวจแต่ละจังหวัด</p>
        {t.provinces.length === 0 && <p className="text-xs text-[#9199A8]">ยังไม่มีจังหวัดที่เช็คอิน</p>}
        {t.provinces.map(pv => {
          const pct = pv.total ? Math.round((pv.visited / pv.total) * 100) : 0;
          return (
            <div key={pv.name}>
              <div className="flex justify-between text-xs mb-1"><span>{pv.name}</span><span className="text-[#6B7280]">{pct}% ({pv.visited}/{pv.total} แห่ง)</span></div>
              <div className="h-1.5 rounded bg-[#EEF0F5] overflow-hidden"><div className="h-full bg-[#B8862B]" style={{ width: pct + "%" }} /></div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function ExploreTab({ rest, prov, setProv, onOpenPlace, showToast }) {
  const [provs, setProvs] = useState(null);
  const [places, setPlaces] = useState(null);
  const [cat, setCat] = useState("all");
  useEffect(() => {
    if (prov) return;
    rest("/rest/v1/rpc/explore_provinces", { method: "POST", body: {} }).then(setProvs).catch(e => { showToast("โหลดจังหวัดไม่สำเร็จ: " + e.message); setProvs([]); });
  }, [prov]);
  useEffect(() => {
    if (!prov) return;
    setPlaces(null);
    rest("/rest/v1/rpc/explore_places", { method: "POST", body: { p_province: prov } }).then(setPlaces).catch(e => { showToast("โหลดสถานที่ไม่สำเร็จ: " + e.message); setPlaces([]); });
  }, [prov]);
  const shown = (places || []).filter(x => cat === "all" || x.category === cat);
  return (
    <div style={{ fontFamily: "'IBM Plex Sans Thai', sans-serif" }} className="min-h-screen bg-[#F3F5FA] text-[#1A1D29] pb-20">
      <style>{FONT_IMPORT}</style>
      <header className="sticky top-0 z-20 bg-[#F3F5FA]/90 backdrop-blur border-b border-black/5">
        <div className="max-w-xl mx-auto flex items-center gap-3 px-4 py-3">
          {prov && <button onClick={() => { setProv(null); setCat("all"); }} aria-label="กลับ" className="text-[#6B7280]"><ArrowLeft size={18} /></button>}
          <h1 style={{ fontFamily: "'Kanit', sans-serif" }} className="text-xl font-semibold text-[#6C5CE7]">{prov ? prov : "สำรวจจังหวัด"}</h1>
        </div>
      </header>
      <main className="max-w-xl mx-auto px-4 pt-3 space-y-2">
        {!prov && provs === null && <p className="text-center text-xs text-[#9199A8] py-6">กำลังโหลด...</p>}
        {!prov && provs && provs.length === 0 && <p className="text-center text-xs text-[#9199A8] py-6">ยังไม่มีสถานที่ในระบบ</p>}
        {!prov && provs && provs.map(pv => {
          const pct = pv.places ? Math.round((pv.visited / pv.places) * 100) : 0;
          return (
            <button key={pv.name} onClick={() => setProv(pv.name)} className="w-full bg-white rounded-2xl p-3.5 shadow-sm text-left">
              <div className="flex justify-between items-center"><span className="text-sm font-medium">{pv.name}</span><span className="text-xs text-[#6B7280]">{pv.places} สถานที่ ›</span></div>
              <div className="h-1.5 rounded bg-[#EEF0F5] overflow-hidden mt-2"><div className="h-full bg-[#B8862B]" style={{ width: pct + "%" }} /></div>
              <p className="text-[11px] text-[#9199A8] mt-1">คุณไปมาแล้ว {pv.visited}/{pv.places} แห่ง ({pct}%)</p>
            </button>
          );
        })}
        {!prov && provs && provs.length > 0 && <p className="text-[11px] text-center text-[#9199A8] pt-2">จังหวัดอื่นจะขึ้นเมื่อมีคนเพิ่มสถานที่ในจังหวัดนั้น</p>}

        {prov && (
          <>
            <div className="flex gap-2 overflow-x-auto">
              {["all", ...Object.keys(CATEGORY_TH)].map(c => (
                <button key={c} onClick={() => setCat(c)} className={`text-xs px-3 py-1.5 rounded-full whitespace-nowrap ${cat === c ? "bg-[#6C5CE7] text-white" : "bg-white border border-black/10"}`}>{c === "all" ? "ทั้งหมด" : CATEGORY_TH[c]}</button>
              ))}
            </div>
            {places === null && <p className="text-center text-xs text-[#9199A8] py-6">กำลังโหลด...</p>}
            {places && shown.length === 0 && <p className="text-center text-xs text-[#9199A8] py-6">ยังไม่มีสถานที่ในหมวดนี้</p>}
            {shown.map(pl => (
              <button key={pl.id} onClick={() => onOpenPlace(pl.id)} className="w-full bg-white rounded-2xl p-3 shadow-sm flex items-center gap-3 text-left">
                <span className="w-2 self-stretch rounded-full" style={{ background: CAT_COLOR[pl.category] }} />
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-medium truncate">{pl.name}{pl.is_boosted && <span className="ml-1.5 text-[10px] text-[#B77600] bg-[#FFF4DD] rounded-full px-2 py-0.5">โปรโมท</span>}{pl.visited_by_me && <span className="ml-1.5 text-[10px] text-[#178A5D] bg-[#E8F8F1] rounded-full px-2 py-0.5">ไปแล้ว</span>}</span>
                  <span className="block text-xs text-[#6B7280]">{CATEGORY_TH[pl.category]} · {pl.checkin_count} เช็คอิน</span>
                </span>
                {pl.avg_rating && <span className="text-right"><Stars n={Number(pl.avg_rating)} size={12} /><span className="block text-[11px] text-[#6B7280]">{pl.avg_rating}</span></span>}
              </button>
            ))}
          </>
        )}
      </main>
    </div>
  );
}

function TabBar({ tab, setTab }) {
  const items = [["feed", "ฟีด", Home], ["explore", "สำรวจ", Compass], ["checkin", "เช็คอิน", MapPin], ["rank", "อันดับ", Trophy], ["profile", "โปรไฟล์", User]];
  return (
    <>
      <div className="h-16" />
      <nav className="fixed bottom-0 inset-x-0 z-30 bg-white border-t border-black/5 flex">
        {items.map(([k, label, Icon]) => (
          <button key={k} onClick={() => setTab(k)} className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-[11px] ${tab === k ? "text-[#6C5CE7] font-semibold" : "text-[#9199A8]"}`}>
            <Icon size={20} />{label}
          </button>
        ))}
      </nav>
    </>
  );
}

function ProfileTab({ rest, session, userId, onLogout, onPrivacy, showToast }) {
  const isMe = userId === session.user_id;
  const [p, setP] = useState(null);
  const [stats, setStats] = useState({ posts: 0, checkins: 0, friends: 0 });
  const [posts, setPosts] = useState([]);
  const [travel, setTravel] = useState(null);
  const [following, setFollowing] = useState(false);
  const [edit, setEdit] = useState(false);
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");

  useEffect(() => {
    (async () => {
      try {
        rest("/rest/v1/rpc/travel_stats", { method: "POST", body: { p_user: userId } }).then(setTravel).catch(() => {});
        if (!isMe) rest(`/rest/v1/follows?follower_id=eq.${session.user_id}&followee_id=eq.${userId}&select=followee_id`).then(r => setFollowing(r.length > 0)).catch(() => {});
        const [pr, st, ps] = await Promise.all([
          rest(`/rest/v1/profiles?id=eq.${userId}&select=display_name,bio`),
          rest("/rest/v1/rpc/profile_stats", { method: "POST", body: { p_user: userId } }),
          rest(`/rest/v1/posts?user_id=eq.${userId}&select=id,content,created_at&order=created_at.desc&limit=20`),
        ]);
        setP(pr[0]); setName(pr[0]?.display_name || ""); setBio(pr[0]?.bio || ""); setStats(st); setPosts(ps);
      } catch (e) { showToast("โหลดโปรไฟล์ไม่สำเร็จ: " + e.message); }
    })();
  }, [userId]);

  const save = async () => {
    try {
      const r = await rest(`/rest/v1/profiles?id=eq.${userId}`, { method: "PATCH", body: { display_name: name.trim(), bio: bio.trim() || null } });
      setP(r[0]); setEdit(false); showToast("บันทึกโปรไฟล์แล้ว");
    } catch (e) { showToast(e.message.includes("check") ? "ชื่อต้องยาว 2–30 ตัวอักษร คำแนะนำตัวไม่เกิน 160" : "บันทึกไม่สำเร็จ: " + e.message); }
  };

  const toggleFollow = async () => {
    try {
      if (following) await rest(`/rest/v1/follows?follower_id=eq.${session.user_id}&followee_id=eq.${userId}`, { method: "DELETE" });
      else await rest("/rest/v1/follows", { method: "POST", body: { follower_id: session.user_id, followee_id: userId } });
      setFollowing(!following);
      setTravel(t => t && { ...t, followers: t.followers + (following ? -1 : 1) });
    } catch (e) { showToast("ติดตามไม่สำเร็จ: " + e.message); }
  };

  if (!p) return <div className="min-h-screen bg-[#F3F5FA] flex items-center justify-center text-sm text-[#9199A8]">กำลังโหลด...</div>;

  return (
    <div style={{ fontFamily: "'IBM Plex Sans Thai', sans-serif" }} className="min-h-screen bg-[#F3F5FA] text-[#1A1D29]">
      <style>{FONT_IMPORT}</style>
      <main className="max-w-xl mx-auto px-4 pt-6 pb-24 space-y-3">
        <div className="bg-white rounded-2xl p-5 shadow-sm text-center">
          <div className="w-16 h-16 mx-auto rounded-full bg-[#6C5CE7]/10 text-[#6C5CE7] flex items-center justify-center text-2xl font-semibold">{p.display_name?.[0]?.toUpperCase()}</div>
          {edit ? (
            <div className="mt-3 space-y-2 text-left">
              <input value={name} maxLength={30} onChange={e => setName(e.target.value)} placeholder="ชื่อที่แสดง" className="w-full text-sm bg-[#F3F5FA] rounded-lg px-3 py-2 outline-none" />
              <textarea value={bio} maxLength={160} rows={3} onChange={e => setBio(e.target.value)} placeholder="แนะนำตัวสั้นๆ (ไม่เกิน 160 ตัวอักษร)" className="w-full text-sm bg-[#F3F5FA] rounded-lg px-3 py-2 outline-none resize-none" />
              <div className="flex gap-2">
                <button onClick={() => setEdit(false)} className="flex-1 border border-black/10 text-sm py-2 rounded-lg">ยกเลิก</button>
                <button onClick={save} disabled={name.trim().length < 2} className="flex-1 bg-[#6C5CE7] disabled:opacity-40 text-white text-sm font-medium py-2 rounded-lg">บันทึก</button>
              </div>
            </div>
          ) : (
            <>
              <h1 style={{ fontFamily: "'Kanit', sans-serif" }} className="text-xl font-semibold mt-3">{p.display_name}</h1>
              <p className="text-sm text-[#6B7280] mt-1 whitespace-pre-wrap">{p.bio || (isMe ? "ยังไม่มีคำแนะนำตัว" : "")}</p>
            </>
          )}
          <div className="grid grid-cols-3 gap-2 mt-4 text-center">
            {[["โพสต์", stats.posts], ["เช็คอิน", stats.checkins], ["เพื่อน", stats.friends]].map(([l, n]) => (
              <div key={l} className="bg-[#F3F5FA] rounded-xl py-2"><p className="text-lg font-semibold">{n}</p><p className="text-xs text-[#6B7280]">{l}</p></div>
            ))}
          </div>
          {travel && <p className="text-xs text-[#6B7280] mt-3">ผู้ติดตาม {travel.followers} · กำลังติดตาม {travel.following}</p>}
          {!isMe && <button onClick={toggleFollow} className={`mt-3 w-full text-sm font-medium py-2 rounded-lg ${following ? "border border-black/10 text-[#6B7280]" : "bg-[#6C5CE7] text-white"}`}>{following ? "กำลังติดตาม" : "ติดตาม"}</button>}
          {isMe && !edit && (
            <div className="flex gap-2 mt-4">
              <button onClick={() => setEdit(true)} className="flex-1 border border-[#6C5CE7]/30 text-[#6C5CE7] text-sm font-medium py-2 rounded-lg">แก้ไขโปรไฟล์</button>
              <button onClick={onLogout} className="flex-1 border border-black/10 text-[#6B7280] text-sm py-2 rounded-lg">ออกจากระบบ</button>
            </div>
          )}
        </div>
        {travel && <Passport t={travel} />}
        {isMe && <button onClick={onPrivacy} className="w-full bg-white rounded-2xl p-3 shadow-sm text-sm text-left text-[#6C5CE7]">ตั้งค่าความเป็นส่วนตัวและการใช้ข้อมูล</button>}
        {posts.map(po => (
          <div key={po.id} className="bg-white rounded-2xl p-4 shadow-sm">
            <p className="text-xs text-[#9199A8] mb-1">{timeAgo(po.created_at)}</p>
            <p className="text-sm whitespace-pre-wrap">{po.content}</p>
          </div>
        ))}
        {posts.length === 0 && <p className="text-center text-xs text-[#9199A8] py-4">ยังไม่มีโพสต์</p>}
      </main>
    </div>
  );
}

export default function FeedApp() {
  const [session, setSession] = useState(null); // { access_token, user_id, email }
  const [booting, setBooting] = useState(true);
  const [authMode, setAuthMode] = useState("login");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authName, setAuthName] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState("");

  const [posts, setPosts] = useState([]);
  const [wallet, setWallet] = useState(0);
  const [loadingFeed, setLoadingFeed] = useState(false);
  const [draft, setDraft] = useState("");
  const [openComments, setOpenComments] = useState({});
  const [commentDraft, setCommentDraft] = useState({});
  const [boostTarget, setBoostTarget] = useState(null);
  const [toast, setToast] = useState(null);
  const [topUpFlash, setTopUpFlash] = useState(false);
  const [leaderboardFor, setLeaderboardFor] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [friendStatus, setFriendStatus] = useState({});
  const [tab, setTab] = useState("feed");
  const [placeView, setPlaceView] = useState(null);
  const [exploreProv, setExploreProv] = useState(null);
  const [profileId, setProfileId] = useState(null); // null = โปรไฟล์ตัวเอง
  const [consent, setConsent] = useState(null);
  const [showConsent, setShowConsent] = useState(false);
  const [cA, setCA] = useState(false);
  const [cP, setCP] = useState(false);
  const sid = useRef(crypto.randomUUID());

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2500); };

  // ---------- REST helper: คุยกับ Supabase (Auth + PostgREST) ตรงๆ ผ่าน fetch ----------
  const sessionRef = useRef(null);
  sessionRef.current = session;

  // refresh token อัตโนมัติ: ถ้า access token เหลือน้อยกว่า 60 วินาที ขอใบใหม่ด้วย refresh_token
  const getToken = async () => {
    const s = sessionRef.current;
    if (!s) return null;
    if (s.expires_at && s.expires_at - Date.now() / 1000 > 60) return s.access_token;
    try {
      const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
        method: "POST",
        headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: s.refresh_token }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error("refresh failed");
      const next = { ...s, access_token: data.access_token, refresh_token: data.refresh_token, expires_at: data.expires_at };
      sessionRef.current = next;
      persistSession(next);
      return next.access_token;
    } catch {
      persistSession(null); // refresh ไม่ได้จริงๆ ค่อยให้ล็อกอินใหม่
      return null;
    }
  };

  const rest = useCallback(async (path, { method = "GET", body, auth = true } = {}) => {
    const token = auth ? await getToken() : null;
    const res = await fetch(`${SUPABASE_URL}${path}`, {
      method,
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${token || SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      const err = new Error(errBody.message || errBody.error_description || `HTTP ${res.status}`);
      err.status = res.status;
      throw err;
    }
    if (res.status === 204) return null;
    return res.json();
  }, [session]);

  // ---------- โหลด session ที่เคยบันทึกไว้ตอนเปิดแอปใหม่ ----------
  useEffect(() => {
    (async () => {
      if (!configured) { setBooting(false); return; }
      try {
        const saved = await window.storage.get(SESSION_KEY, false);
        if (saved) setSession(JSON.parse(saved.value));
      } catch { /* ยังไม่เคยล็อกอิน ไม่เป็นไร */ }
      setBooting(false);
    })();
  }, []);

  const persistSession = async (s) => {
    setSession(s);
    try {
      if (s) await window.storage.set(SESSION_KEY, JSON.stringify(s), false);
      else await window.storage.delete(SESSION_KEY, false);
    } catch { /* เก็บ session ไม่ได้ ยังใช้งานได้ในรอบนี้ */ }
  };

  // ---------- Auth ----------
  const handleAuth = async () => {
    setAuthBusy(true); setAuthError("");
    try {
      const path = authMode === "signup" ? "/auth/v1/signup" : "/auth/v1/token?grant_type=password";
      const res = await fetch(`${SUPABASE_URL}${path}`, {
        method: "POST",
        headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ email: authEmail, password: authPassword, ...(authMode === "signup" ? { data: { display_name: authName.trim() } } : {}) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error_description || data.msg || "เข้าสู่ระบบไม่สำเร็จ");
      if (!data.access_token) {
        showToast("สมัครสำเร็จ เช็คอีเมลเพื่อยืนยันตัวตน แล้วค่อยล็อกอิน");
        setAuthMode("login");
        return;
      }
      await persistSession({ access_token: data.access_token, refresh_token: data.refresh_token, expires_at: data.expires_at, user_id: data.user.id, email: data.user.email });
    } catch (e) {
      setAuthError(e.message);
    } finally {
      setAuthBusy(false);
    }
  };

  const logout = () => { persistSession(null); setPosts([]); };

  // ---------- โหลดฟีด + กระเป๋าเครดิต ----------
  const loadFeed = useCallback(async () => {
    setLoadingFeed(true);
    try {
      const rows = await rest(
        "/rest/v1/posts?select=id,content,is_boosted,boost_expire_at,created_at,place_id,rating,place:places(id,name,category),author:profiles!posts_user_id_fkey(id,username:display_name),comments(id,content,created_at,author:profiles!comments_user_id_fkey(username:display_name)),likes(user_id)&order=created_at.desc"
      );
      setPosts(rows.map(p => ({ ...p, is_boosted: boostActive(p) })).sort((a, b) => Number(b.is_boosted) - Number(a.is_boosted)));
      const w = await rest(`/rest/v1/wallets?user_id=eq.${session.user_id}&select=credit_balance`);
      setWallet(w[0]?.credit_balance ?? 0);
    } catch (e) {
      showToast("โหลดฟีดไม่สำเร็จ: " + e.message);
    } finally {
      setLoadingFeed(false);
    }
  }, [rest, session]);

  useEffect(() => { if (session) loadFeed(); }, [session, loadFeed]);

  // โหลดสถานะการยินยอม ถ้ายังไม่เคยเลือกให้ถามก่อน (ค่าเริ่มต้น = ไม่เก็บ)
  useEffect(() => {
    if (!session) return;
    rest(`/rest/v1/user_consents?user_id=eq.${session.user_id}&select=analytics,personalized_ads`)
      .then(r => { if (r[0]) { setConsent(r[0]); setCA(r[0].analytics); setCP(r[0].personalized_ads); } else setShowConsent(true); })
      .catch(() => {});
  }, [session]);

  // เก็บเวลาใช้งาน: ส่ง heartbeat ทุก 60 วินาทีเฉพาะตอนหน้าจอเปิดอยู่ และผู้ใช้ยินยอมแล้ว
  useEffect(() => {
    if (!session || !consent?.analytics) return;
    const beat = () => {
      if (document.visibilityState === "visible")
        rest("/rest/v1/rpc/track_session", { method: "POST", body: { p_session_id: sid.current } }).catch(() => {});
    };
    beat();
    const t = setInterval(beat, 60000);
    return () => clearInterval(t);
  }, [session, consent?.analytics]);

  // บันทึกความสนใจจากข้อความ (เฉพาะผู้ที่ยินยอมโฆษณาตรงใจ; เซิร์ฟเวอร์ตรวจซ้ำอีกชั้น)
  const track = (text, w) => {
    if (!consent?.personalized_ads) return;
    for (const [topic, words] of Object.entries(TOPIC_KEYWORDS)) {
      if (words.some(k => (text || "").includes(k)))
        rest("/rest/v1/rpc/record_interest", { method: "POST", body: { p_topic: topic, p_weight: w } }).catch(() => {});
    }
  };

  const saveConsent = async () => {
    try {
      await rest("/rest/v1/rpc/set_consent", { method: "POST", body: { p_analytics: cA, p_ads: cP } });
      setConsent({ analytics: cA, personalized_ads: cP });
      setShowConsent(false);
      showToast("บันทึกการตั้งค่าแล้ว");
    } catch (e) { showToast("บันทึกไม่สำเร็จ: " + e.message); }
  };

  const consentModal = showConsent && (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl w-full max-w-sm p-4 space-y-3">
        <h3 style={{ fontFamily: "'Kanit', sans-serif" }} className="font-semibold">ความเป็นส่วนตัวของคุณ</h3>
        <p className="text-xs text-[#6B7280]">เลือกได้ว่าจะให้ feedTH ใช้ข้อมูลอะไร ปิดได้ทุกเมื่อและข้อมูลที่เก็บไว้ในข้อนั้นจะถูกลบ แอปใช้งานได้ปกติไม่ว่าจะเลือกอะไร</p>
        <label className="flex gap-2 text-sm"><input type="checkbox" checked={cA} onChange={e => setCA(e.target.checked)} /><span>เก็บสถิติการใช้งาน (ช่วงเวลาและระยะเวลาที่ใช้แอป) เพื่อปรับปรุงแอป</span></label>
        <label className="flex gap-2 text-sm"><input type="checkbox" checked={cP} onChange={e => setCP(e.target.checked)} /><span>เรียนรู้ความสนใจของฉัน เพื่อแสดงโฆษณาที่ตรงใจ</span></label>
        <button onClick={saveConsent} className="w-full bg-[#6C5CE7] text-white text-sm font-semibold py-2.5 rounded-full">บันทึก</button>
      </div>
    </div>
  );

  // ---------- ให้คะแนนเพื่อนรัก (ครั้งเดียวต่อโพสต์ต่อประเภท กันฟาร์มด้วย unique constraint จริงในฐานข้อมูล) ----------
  const awardFanPoints = async (toUserId, toUsername, postId, action, points) => {
    if (toUserId === session.user_id) return;
    try {
      const awarded = await rest("/rest/v1/rpc/award_fan_points", { method: "POST", body: { p_post_id: postId, p_action: action } });
      if (awarded > 0) showToast(`+${awarded} คะแนนเพื่อนรัก (${action}) กับ ${toUsername}`);
    } catch (e) {
      showToast("ให้คะแนนไม่สำเร็จ: " + e.message);
      // 409 = เคยให้คะแนนโพสต์นี้ไปแล้ว ปกติ ไม่ต้องแจ้งเตือน
    }
  };

  const handlePost = async () => {
    if (!draft.trim()) return;
    try {
      await rest("/rest/v1/posts", { method: "POST", body: { user_id: session.user_id, content: draft.trim() } });
      track(draft, 2);
      setDraft("");
      loadFeed();
    } catch (e) { showToast("โพสต์ไม่สำเร็จ: " + e.message); }
  };

  const toggleLike = async (post) => {
    const myLike = post.likes.find(l => l.user_id === session.user_id);
    try {
      if (myLike) {
        await rest(`/rest/v1/likes?post_id=eq.${post.id}&user_id=eq.${session.user_id}`, { method: "DELETE" });
      } else {
        await rest("/rest/v1/likes", { method: "POST", body: { post_id: post.id, user_id: session.user_id } });
        await awardFanPoints(post.author.id, post.author.username, post.id, "like", 1);
        track(post.content, 1);
      }
      loadFeed();
    } catch (e) { showToast("กดไลค์ไม่สำเร็จ: " + e.message); }
  };

  const addComment = async (post) => {
    const text = (commentDraft[post.id] || "").trim();
    if (!text) return;
    try {
      await rest("/rest/v1/comments", { method: "POST", body: { post_id: post.id, user_id: session.user_id, content: text } });
      setCommentDraft(prev => ({ ...prev, [post.id]: "" }));
      await awardFanPoints(post.author.id, post.author.username, post.id, "comment", 2);
      track(text, 2);
      loadFeed();
    } catch (e) { showToast("คอมเมนต์ไม่สำเร็จ: " + e.message); }
  };

  const sharePost = (post) => awardFanPoints(post.author.id, post.author.username, post.id, "share", 3);

  const toggleFriend = async (author) => {
    try {
      await rest("/rest/v1/friendships", { method: "POST", body: { user_id: session.user_id, friend_id: author.id, status: "pending" } });
      setFriendStatus(prev => ({ ...prev, [author.id]: "pending" }));
      showToast(`ส่งคำขอเป็นเพื่อนถึง ${author.username} แล้ว`);
    } catch (e) { showToast("ส่งคำขอไม่สำเร็จ: " + e.message); }
  };

  const confirmBoost = async (option) => {
    if (wallet < option.credits) { showToast("เครดิตไม่พอ ลองเติมเครดิตก่อนนะ"); return; }
    try {
      setWallet(await rest("/rest/v1/rpc/boost_post", { method: "POST", body: { p_post_id: boostTarget, p_credits: option.credits } }));
      
      
      showToast(`บูสต์โพสต์สำเร็จ ใช้ไป ${option.credits} เครดิต`);
      setBoostTarget(null);
      loadFeed();
    } catch (e) { showToast("บูสต์ไม่สำเร็จ: " + e.message); }
  };

  const topUp = async () => {
    try {
      const bal = await rest("/rest/v1/rpc/demo_topup", { method: "POST", body: { p_amount: 100 } });
      
      setWallet(bal);
      setTopUpFlash(true);
      showToast("เติมเครดิตสำเร็จ +100");
      setTimeout(() => setTopUpFlash(false), 700);
    } catch (e) { showToast("เติมเครดิตไม่สำเร็จ: " + e.message); }
  };

  const openLeaderboard = async (author) => {
    setLeaderboardFor(author);
    try {
      const rows = await rest(`/rest/v1/fan_scores?to_user_id=eq.${author.id}&select=points,from:profiles!fan_scores_from_user_id_fkey(username:display_name)&order=points.desc&limit=10`);
      setLeaderboard(rows);
    } catch { setLeaderboard([]); }
  };

  const myPoints = (author) => {
    const row = leaderboardFor?.id === author.id ? leaderboard.find(r => r.from.username === session.email.split("@")[0]) : null;
    return row?.points || 0;
  };

  // ---------- หน้าจอ: ยังไม่ได้ตั้งค่า Supabase ----------
  if (!configured) {
    return (
      <div style={{ fontFamily: "'IBM Plex Sans Thai', sans-serif" }} className="min-h-screen bg-[#F3F5FA] flex items-center justify-center px-6 text-center">
        <style>{FONT_IMPORT}</style>
        <div>
          <p style={{ fontFamily: "'Kanit', sans-serif" }} className="text-lg font-semibold mb-2">ยังไม่ได้ตั้งค่า Supabase</p>
          <p className="text-sm text-[#6B7280]">ใส่ SUPABASE_URL และ SUPABASE_ANON_KEY ในโค้ดด้านบนก่อนใช้งาน</p>
        </div>
      </div>
    );
  }

  if (booting) {
    return (
      <div style={{ fontFamily: "'IBM Plex Sans Thai', sans-serif" }} className="min-h-screen bg-[#F3F5FA] flex items-center justify-center gap-2 text-[#9199A8]">
        <style>{FONT_IMPORT}</style><Loader2 size={18} className="animate-spin" /> กำลังโหลด...
      </div>
    );
  }

  // ---------- หน้าจอ: ล็อกอิน / สมัครสมาชิก ----------
  if (!session) {
    return (
      <div style={{ fontFamily: "'IBM Plex Sans Thai', sans-serif" }} className="min-h-screen bg-[#F3F5FA] flex items-center justify-center px-6">
        <style>{FONT_IMPORT}</style>
        <div className="bg-white rounded-2xl shadow-sm border border-black/5 p-6 w-full max-w-sm">
          <h1 style={{ fontFamily: "'Kanit', sans-serif" }} className="text-xl font-semibold text-[#6C5CE7] mb-4">feedTH</h1>
          <div className="space-y-2 mb-3">
            {authMode === "signup" && <input placeholder="ชื่อที่แสดง (2–30 ตัวอักษร)" maxLength={30} value={authName} onChange={e => setAuthName(e.target.value)} className="w-full text-sm bg-[#F3F5FA] rounded-lg px-3 py-2 outline-none" />}
            <input type="email" placeholder="อีเมล" value={authEmail} onChange={e => setAuthEmail(e.target.value)} className="w-full text-sm bg-[#F3F5FA] rounded-lg px-3 py-2 outline-none" />
            <input type="password" placeholder="รหัสผ่าน" value={authPassword} onChange={e => setAuthPassword(e.target.value)} className="w-full text-sm bg-[#F3F5FA] rounded-lg px-3 py-2 outline-none" />
          </div>
          {authError && <p className="text-xs text-[#C43D3D] mb-2">{authError}</p>}
          <button onClick={handleAuth} disabled={authBusy || !authEmail || !authPassword || (authMode === "signup" && authName.trim().length < 2)} className="w-full bg-[#6C5CE7] disabled:opacity-40 text-white text-sm font-medium py-2 rounded-lg mb-2">
            {authBusy ? "กำลังทำรายการ..." : authMode === "signup" ? "สมัครสมาชิก" : "เข้าสู่ระบบ"}
          </button>
          <button onClick={() => setAuthMode(m => m === "signup" ? "login" : "signup")} className="w-full text-xs text-[#6B7280]">
            {authMode === "signup" ? "มีบัญชีแล้ว? เข้าสู่ระบบ" : "ยังไม่มีบัญชี? สมัครสมาชิก"}
          </button>
        </div>
      </div>
    );
  }

  const openPlace = (id) => setPlaceView(id);
  const goTab = (t) => { if (t === "profile") setProfileId(null); setPlaceView(null); setTab(t); };
  if (placeView) return (
    <>
      <PlaceDetail placeId={placeView} rest={rest} posts={posts} userId={session.user_id} wallet={wallet} onBoosted={loadFeed} onLike={toggleLike} onBack={() => setPlaceView(null)}
        onProfile={(id) => { setPlaceView(null); setProfileId(id); setTab("profile"); }} onCheckin={() => { setPlaceView(null); setTab("checkin"); }} showToast={showToast} />
      <TabBar tab={tab} setTab={goTab} />
      {toast && <div className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-[#1A1D29] text-white text-sm px-4 py-2 rounded-full shadow-lg z-40 max-w-[90%] text-center">{toast}</div>}
    </>
  );
  if (tab === "checkin" || tab === "profile" || tab === "rank" || tab === "explore") return (
    <>
      {tab === "checkin"
        ? <CheckinTab rest={rest} onBack={() => setTab("feed")} showToast={showToast} onOpenPlace={openPlace} />
        : tab === "explore"
        ? <ExploreTab rest={rest} prov={exploreProv} setProv={setExploreProv} onOpenPlace={openPlace} showToast={showToast} />
        : tab === "rank"
        ? <RankTab rest={rest} userId={session.user_id} onProfile={(id) => { setProfileId(id); setTab("profile"); }} showToast={showToast} />
        : <ProfileTab key={profileId || session.user_id} rest={rest} session={session} userId={profileId || session.user_id} onLogout={logout} onPrivacy={() => setShowConsent(true)} showToast={showToast} />}
      <TabBar tab={tab} setTab={goTab} />
      {consentModal}
      {toast && <div className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-[#1A1D29] text-white text-sm px-4 py-2 rounded-full shadow-lg z-40 max-w-[90%] text-center">{toast}</div>}
    </>
  );

  // ---------- หน้าจอหลัก ----------
  return (
    <div style={{ fontFamily: "'IBM Plex Sans Thai', sans-serif" }} className="min-h-screen bg-[#F3F5FA] text-[#1A1D29] pb-16">
      <style>{FONT_IMPORT}</style>

      <header className="sticky top-0 z-20 bg-[#F3F5FA]/90 backdrop-blur border-b border-black/5">
        <div className="max-w-xl mx-auto flex items-center justify-between px-4 py-3">
          <h1 style={{ fontFamily: "'Kanit', sans-serif" }} className="text-xl font-semibold tracking-tight text-[#6C5CE7]">feedTH</h1>
          <div className="flex items-center gap-2">
            <button onClick={topUp} className={`flex items-center gap-1.5 rounded-full pl-2 pr-3 py-1.5 border transition-all ${topUpFlash ? "bg-[#FFB020] border-[#FFB020] scale-105" : "bg-white border-[#FFB020]/40"}`}>
              <Wallet size={15} className={topUpFlash ? "text-white" : "text-[#FFB020]"} />
              <span className={`text-sm font-medium ${topUpFlash ? "text-white" : "text-[#1A1D29]"}`}>{wallet} เครดิต</span>
            </button>
            <button onClick={() => setTab("checkin")} aria-label="เช็คอิน" className="text-[#6C5CE7]"><MapPin size={17} /></button>
            <button onClick={logout} aria-label="ออกจากระบบ" className="text-[#9199A8] hover:text-[#1A1D29]"><LogOut size={16} /></button>
          </div>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-4 pt-4 space-y-3">
        <div className="bg-white rounded-2xl border border-black/5 p-3 shadow-sm">
          <textarea value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="กำลังคิดอะไรอยู่..." rows={2} className="w-full resize-none outline-none text-sm placeholder:text-[#9199A8]" />
          <div className="flex justify-end mt-1">
            <button onClick={handlePost} disabled={!draft.trim()} className="bg-[#6C5CE7] disabled:opacity-30 text-white text-sm font-medium px-4 py-1.5 rounded-full">โพสต์</button>
          </div>
        </div>

        {loadingFeed && <p className="text-center text-xs text-[#9199A8] py-4">กำลังโหลดฟีด...</p>}

        {posts.map((post) => {
          const isOther = post.author.id !== session.user_id;
          const likedByMe = post.likes.some(l => l.user_id === session.user_id);
          const fStatus = friendStatus[post.author.id];

          return (
            <article key={post.id} className={`bg-white rounded-2xl p-4 shadow-sm relative overflow-hidden ${post.is_boosted ? "border-l-[3px] border-[#FFB020]" : "border border-black/5"}`}>
              {post.is_boosted && (
                <div className="absolute top-3 right-3 flex items-center gap-1 bg-[#FFB020]/10 text-[#B77600] text-[11px] font-medium px-2 py-0.5 rounded-full">
                  <Sparkles size={11} /> โปรโมท
                </div>
              )}

              <div className="flex items-center gap-2.5 mb-2">
                <div className="w-9 h-9 rounded-full bg-[#6C5CE7]/10 text-[#6C5CE7] flex items-center justify-center font-semibold text-sm shrink-0">{post.author.username[0]?.toUpperCase()}</div>
                <div className="leading-tight flex-1">
                  <button onClick={() => { setProfileId(post.author.id); setTab("profile"); }} className="block text-sm font-medium text-left hover:underline">{post.author.username}</button>
                  <p className="text-xs text-[#9199A8]">{timeAgo(post.created_at)}</p>
                </div>
                {isOther && (
                  <button onClick={() => toggleFriend(post.author)} disabled={!!fStatus} className={`text-xs font-medium flex items-center gap-1 px-2.5 py-1 rounded-full border ${fStatus ? "border-black/10 text-[#9199A8]" : "border-[#6C5CE7]/30 text-[#6C5CE7]"}`}>
                    {fStatus ? <UserCheck size={12} /> : <UserPlus size={12} />}
                    {fStatus === "pending" ? "รอยืนยัน" : "เพิ่มเพื่อน"}
                  </button>
                )}
              </div>

              <p className="text-sm leading-relaxed mb-2 whitespace-pre-wrap">{post.content}</p>

              {post.place && (
                <button onClick={() => openPlace(post.place.id)} className="flex items-center gap-1.5 mb-2 text-xs px-2.5 py-1 rounded-full w-fit" style={{ background: CAT_COLOR[post.place.category] + "1A", color: "#1A1D29" }}>
                  <MapPin size={12} style={{ color: CAT_COLOR[post.place.category] }} /> {post.place.name}
                  {post.rating && <Stars n={post.rating} size={11} />}
                </button>
              )}

              {isOther && (
                <button onClick={() => openLeaderboard(post.author)} className="flex items-center gap-1 mb-2 text-[11px] font-medium px-2 py-0.5 rounded-full w-fit text-[#6C5CE7] bg-[#F0EDFF]">
                  <Trophy size={11} /> ดูอันดับเพื่อนรักของ {post.author.username}
                </button>
              )}

              <div className="flex items-center gap-4 text-[#6B7280] text-sm border-t border-black/5 pt-2">
                <button onClick={() => toggleLike(post)} className={`flex items-center gap-1.5 ${likedByMe ? "text-[#EF4565]" : "hover:text-[#EF4565]"}`}>
                  <Heart size={16} fill={likedByMe ? "#EF4565" : "none"} /> {post.likes.length}
                </button>
                <button onClick={() => setOpenComments(p => ({ ...p, [post.id]: !p[post.id] }))} className="flex items-center gap-1.5 hover:text-[#6C5CE7]">
                  <MessageCircle size={16} /> {post.comments.length}
                </button>
                <button onClick={() => sharePost(post)} className="flex items-center gap-1.5 hover:text-[#17B890]">
                  <Share2 size={15} /> แชร์
                </button>
                {!post.is_boosted && !isOther && (
                  <button onClick={() => setBoostTarget(post.id)} className="flex items-center gap-1.5 ml-auto text-[#B77600] font-medium">
                    <Zap size={16} /> บูสต์โพสต์
                  </button>
                )}
              </div>

              {openComments[post.id] && (
                <div className="mt-3 pt-3 border-t border-black/5 space-y-2">
                  {post.comments.map((c) => (
                    <div key={c.id} className="flex gap-2 text-sm items-center">
                      <span className="font-medium shrink-0">{c.author.username}</span>
                      <span className="text-[#4B5160]">{c.content}</span>
                    </div>
                  ))}
                  <div className="flex items-center gap-2 pt-1">
                    <input value={commentDraft[post.id] || ""} onChange={(e) => setCommentDraft(prev => ({ ...prev, [post.id]: e.target.value }))} onKeyDown={(e) => e.key === "Enter" && addComment(post)} placeholder="แสดงความคิดเห็น..." className="flex-1 text-sm bg-[#F3F5FA] rounded-full px-3 py-1.5 outline-none" />
                    <button onClick={() => addComment(post)} className="text-[#6C5CE7]"><Send size={16} /></button>
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </main>

      {boostTarget !== null && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-4 relative">
            <button onClick={() => setBoostTarget(null)} className="absolute top-3 right-3 text-[#9199A8]"><X size={18} /></button>
            <h3 style={{ fontFamily: "'Kanit', sans-serif" }} className="font-semibold mb-1 flex items-center gap-1.5"><Zap size={16} className="text-[#FFB020]" /> เลือกแพ็กบูสต์</h3>
            <p className="text-xs text-[#9199A8] mb-3">คุณมี {wallet} เครดิต</p>
            <div className="space-y-2">
              {BOOST_OPTIONS.map((opt) => (
                <button key={opt.credits} onClick={() => confirmBoost(opt)} className="w-full flex items-center justify-between border border-black/10 rounded-xl px-3 py-2.5 text-left">
                  <div><p className="text-sm font-medium">{opt.label}</p><p className="text-xs text-[#9199A8]">{opt.desc}</p></div>
                  <span className="text-sm font-semibold text-[#B77600]">{opt.credits} เครดิต</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {leaderboardFor && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-4 relative">
            <button onClick={() => setLeaderboardFor(null)} className="absolute top-3 right-3 text-[#9199A8]"><X size={18} /></button>
            <h3 style={{ fontFamily: "'Kanit', sans-serif" }} className="font-semibold mb-3 flex items-center gap-1.5"><Trophy size={16} className="text-[#FFB020]" /> เพื่อนรักของ {leaderboardFor.username}</h3>
            {leaderboard.length === 0 && <p className="text-xs text-[#9199A8]">ยังไม่มีใครทำคะแนนกับคนนี้</p>}
            <div className="space-y-2">
              {leaderboard.map((f, i) => {
                const t = tierFor(f.points);
                const TIcon = t.icon;
                return (
                  <div key={i} className="flex items-center justify-between px-3 py-2 rounded-xl">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-[#9199A8] w-4">{i + 1}</span>
                      <span className="text-sm font-medium">{f.from.username}</span>
                      {TIcon && <TIcon size={12} className="text-[#B77600]" />}
                    </div>
                    <span className="text-xs font-medium" style={{ color: t.color }}>{f.points} คะแนน</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <TabBar tab="feed" setTab={goTab} />
      {consentModal}
      {toast && <div className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-[#1A1D29] text-white text-sm px-4 py-2 rounded-full shadow-lg z-40 max-w-[90%] text-center">{toast}</div>}
    </div>
  );
}
