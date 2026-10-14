import { useState, useEffect, useCallback, useRef } from "react";
import {
  Heart, MessageCircle, Zap, Wallet, Send, X, Sparkles,
  Share2, UserPlus, UserCheck, Crown, Trophy, Loader2, LogOut, MapPin, ArrowLeft,
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

const CATEGORY_TH = { attraction: "ที่เที่ยว", hotel: "ที่พัก", restaurant: "ร้านอาหาร", cafe: "คาเฟ่", other: "อื่นๆ" };
const CHECKIN_RADIUS_M = 150;

function CheckinTab({ rest, onBack, showToast }) {
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
      setPlaces(await rest("/rest/v1/rpc/nearby_places", { method: "POST", body: { p_lat: p.lat, p_lng: p.lng, p_radius_m: 5000 } }));
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
        {/* แผนที่ OpenStreetMap + Leaflet จะใส่ตอนทำเป็นโปรเจกต์ที่ deploy (ในแชทโหลดรูปแผนที่ไม่ได้) */}
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
                <p className="text-sm font-medium truncate">{pl.name}{pl.is_verified && <span className="ml-1.5 text-[10px] text-[#178A5D] bg-[#E8F8F1] rounded-full px-2 py-0.5">ยืนยันแล้ว</span>}</p>
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
        <div className="fixed inset-0 bg-black/40 flex items-end justify-center z-30 px-4">
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

export default function FeedApp() {
  const [session, setSession] = useState(null); // { access_token, user_id, email }
  const [booting, setBooting] = useState(true);
  const [authMode, setAuthMode] = useState("login");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
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
        body: JSON.stringify({ email: authEmail, password: authPassword }),
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
        "/rest/v1/posts?select=id,content,is_boosted,boost_expire_at,created_at,author:profiles!posts_user_id_fkey(id,username),comments(id,content,created_at,author:profiles!comments_user_id_fkey(username)),likes(user_id)&order=created_at.desc"
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
      const rows = await rest(`/rest/v1/fan_scores?to_user_id=eq.${author.id}&select=points,from:profiles!fan_scores_from_user_id_fkey(username)&order=points.desc&limit=10`);
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
            <input type="email" placeholder="อีเมล" value={authEmail} onChange={e => setAuthEmail(e.target.value)} className="w-full text-sm bg-[#F3F5FA] rounded-lg px-3 py-2 outline-none" />
            <input type="password" placeholder="รหัสผ่าน" value={authPassword} onChange={e => setAuthPassword(e.target.value)} className="w-full text-sm bg-[#F3F5FA] rounded-lg px-3 py-2 outline-none" />
          </div>
          {authError && <p className="text-xs text-[#C43D3D] mb-2">{authError}</p>}
          <button onClick={handleAuth} disabled={authBusy || !authEmail || !authPassword} className="w-full bg-[#6C5CE7] disabled:opacity-40 text-white text-sm font-medium py-2 rounded-lg mb-2">
            {authBusy ? "กำลังทำรายการ..." : authMode === "signup" ? "สมัครสมาชิก" : "เข้าสู่ระบบ"}
          </button>
          <button onClick={() => setAuthMode(m => m === "signup" ? "login" : "signup")} className="w-full text-xs text-[#6B7280]">
            {authMode === "signup" ? "มีบัญชีแล้ว? เข้าสู่ระบบ" : "ยังไม่มีบัญชี? สมัครสมาชิก"}
          </button>
        </div>
      </div>
    );
  }

  if (tab === "checkin") return <><CheckinTab rest={rest} onBack={() => setTab("feed")} showToast={showToast} />{toast && <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#1A1D29] text-white text-sm px-4 py-2 rounded-full shadow-lg z-40">{toast}</div>}</>;

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
                  <p className="text-sm font-medium">{post.author.username}</p>
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
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-30 px-4">
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
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-30 px-4">
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

      {toast && <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#1A1D29] text-white text-sm px-4 py-2 rounded-full shadow-lg z-40 max-w-[90%] text-center">{toast}</div>}
    </div>
  );
}
