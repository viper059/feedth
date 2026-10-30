import { useState, useEffect, useCallback } from "react";
import { ArrowLeft, MapPin, Star, BadgeCheck, Plus, Loader2, Phone, Clock } from "lucide-react";

const CATS = [[null, "ทั้งหมด"], ["restaurant", "ร้านอาหาร"], ["cafe", "คาเฟ่"], ["hotel", "ที่พัก"], ["other", "อื่นๆ"]];
const CAT_TH = { restaurant: "ร้านอาหาร", cafe: "คาเฟ่", hotel: "ที่พัก", other: "ร้านอื่นๆ" };
const km = (m) => (m < 1000 ? `${Math.round(m)} ม.` : `${(m / 1000).toFixed(1)} กม.`);
const errTh = (m = "") =>
  m.includes("already exists") || m.includes("exists nearby") ? "มีร้านชื่อนี้อยู่ใกล้ๆ แล้ว ลองค้นในแกลเลอรี"
  : m.includes("limit reached") ? "ปักหมุดร้านได้ไม่เกิน 5 แห่งต่อวัน"
  : m.includes("already claimed") ? "ร้านนี้มีเจ้าของยืนยันแล้ว"
  : m.includes("claim already pending") ? "คุณส่งคำขอร้านนี้ไว้แล้ว รอแอดมินตรวจสอบ"
  : m.includes("contact required") ? "กรอกช่องทางติดต่ออย่างน้อย 5 ตัวอักษร"
  : m.includes("name too short") ? "ชื่อร้านสั้นเกินไป"
  : "ไม่สำเร็จ: " + m;
const inp = "w-full border border-black/10 rounded-xl px-3 py-2 text-sm bg-white";

function Stars({ v }) {
  if (v == null) return <span className="text-[11px] text-[#9199A8]">ยังไม่มีคะแนน</span>;
  return <span className="inline-flex items-center gap-0.5 text-[12px] font-medium text-[#B77600]"><Star size={12} fill="#FFB020" color="#FFB020" />{Number(v).toFixed(1)}</span>;
}

export default function ShopsView({ rest, onBack, onOpenPlace, showToast }) {
  const [pos, setPos] = useState(null);
  const [cat, setCat] = useState(null);
  const [rows, setRows] = useState(null);
  const [sel, setSel] = useState(null); // place_id ที่เปิดดู
  const [creating, setCreating] = useState(false);
  const call = (fn, body = {}) => rest("/rest/v1/rpc/" + fn, { method: "POST", body });

  useEffect(() => {
    if (!navigator.geolocation) { showToast("อุปกรณ์นี้ไม่รองรับตำแหน่ง"); setRows([]); return; }
    navigator.geolocation.getCurrentPosition(
      p => setPos({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => { showToast("เปิดตำแหน่งที่ตั้งเพื่อดูร้านใกล้คุณ"); setRows([]); },
      { enableHighAccuracy: true, timeout: 15000 });
  }, []); // eslint-disable-line

  const load = useCallback(() => {
    if (!pos) return;
    setRows(null);
    call("shop_gallery", { p_lat: pos.lat, p_lng: pos.lng, p_radius_m: 10000, p_category: cat })
      .then(r => setRows(Array.isArray(r) ? r : [])).catch(e => { showToast("โหลดร้านไม่สำเร็จ: " + e.message); setRows([]); });
  }, [pos, cat]); // eslint-disable-line
  useEffect(() => { load(); }, [load]);

  if (sel) return <ShopDetail id={sel} call={call} onBack={() => { setSel(null); load(); }} onOpenPlace={onOpenPlace} showToast={showToast} />;
  if (creating) return <CreateShop pos={pos} call={call} onBack={() => setCreating(false)} onDone={(id) => { setCreating(false); setSel(id); }} showToast={showToast} />;

  return (
    <div style={{ fontFamily: "'IBM Plex Sans Thai', sans-serif" }} className="min-h-screen bg-[#F3F5FA] text-[#1A1D29] pb-24">
      <header className="sticky top-0 z-20 bg-[#F3F5FA]/90 backdrop-blur border-b border-black/5">
        <div className="max-w-xl mx-auto flex items-center gap-2 px-4 py-3">
          <button onClick={onBack} aria-label="กลับ" className="text-[#6C5CE7]"><ArrowLeft size={20} /></button>
          <h1 style={{ fontFamily: "'Kanit', sans-serif" }} className="text-xl font-semibold text-[#6C5CE7] flex-1">แกลเลอรีร้านค้า</h1>
          <button onClick={() => setCreating(true)} disabled={!pos} className="flex items-center gap-1 text-xs bg-[#6C5CE7] text-white rounded-full px-3 py-1.5 disabled:opacity-50"><Plus size={14} />ปักหมุดร้าน</button>
        </div>
      </header>
      <main className="max-w-xl mx-auto px-4 pt-3 space-y-3" data-testid="shop-gallery">
        <div className="flex gap-2 overflow-x-auto">
          {CATS.map(([k, l]) => <button key={String(k)} onClick={() => setCat(k)} className={`text-xs px-3 py-1.5 rounded-full shrink-0 ${cat === k ? "bg-[#6C5CE7] text-white" : "bg-white border border-black/10"}`}>{l}</button>)}
        </div>
        {rows === null && <p className="text-center text-xs text-[#9199A8] py-8">กำลังโหลด...</p>}
        {rows && rows.length === 0 && (
          <div className="text-center py-10 text-xs text-[#9199A8] space-y-1">
            <p>ยังไม่มีร้านในรัศมี 10 กม.</p>
            <p>เป็นคนแรกที่ปักหมุดร้านใกล้คุณ หรือเช็คอินร้านพร้อมรูป ร้านจะขึ้นในแกลเลอรีเอง</p>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          {rows && rows.map(s => (
            <button key={s.id} onClick={() => setSel(s.id)} className="bg-white rounded-2xl shadow-sm overflow-hidden text-left">
              <div className="aspect-[4/3] bg-[#E8EAF0]">{s.cover_url ? <img src={s.cover_url} alt={s.name} loading="lazy" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-3xl">🏪</div>}</div>
              <div className="p-2.5 space-y-0.5">
                <p className="text-sm font-medium truncate flex items-center gap-1">{s.name}{s.claimed && <BadgeCheck size={14} className="text-[#0E8F5A] shrink-0" aria-label="เจ้าของยืนยันแล้ว" />}</p>
                <p className="text-[11px] text-[#9199A8]">{CAT_TH[s.category] || s.category} · {km(s.distance_m)}</p>
                <div className="flex items-center justify-between"><Stars v={s.avg_rating} /><span className="text-[11px] text-[#9199A8]">{s.review_count} รีวิว</span></div>
              </div>
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}

function CreateShop({ pos, call, onBack, onDone, showToast }) {
  const [f, setF] = useState({ name: "", category: "restaurant", about: "", phone: "", hours: "" });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF(x => ({ ...x, [k]: e.target.value }));
  const save = async () => {
    setBusy(true);
    try {
      const id = await call("create_shop", { p_name: f.name, p_category: f.category, p_lat: pos.lat, p_lng: pos.lng, p_about: f.about || null, p_phone: f.phone || null, p_hours: f.hours || null });
      showToast("ปักหมุดร้านแล้ว ยื่นยืนยันเจ้าของได้ในหน้าร้าน"); onDone(id);
    } catch (e) { showToast(errTh(e.message)); }
    setBusy(false);
  };
  return (
    <div style={{ fontFamily: "'IBM Plex Sans Thai', sans-serif" }} className="min-h-screen bg-[#F3F5FA] text-[#1A1D29] pb-24">
      <div className="max-w-xl mx-auto px-4 pt-4 space-y-3">
        <div className="flex items-center gap-2"><button onClick={onBack} aria-label="กลับ" className="text-[#6C5CE7]"><ArrowLeft size={20} /></button><h1 style={{ fontFamily: "'Kanit', sans-serif" }} className="text-lg font-semibold">ปักหมุดร้านค้า</h1></div>
        <p className="text-xs text-[#6B7280] flex items-center gap-1"><MapPin size={13} />หมุดจะปักที่ตำแหน่งปัจจุบันของคุณ ให้ยืนอยู่หน้าร้าน</p>
        <input aria-label="ชื่อร้าน" placeholder="ชื่อร้าน" value={f.name} onChange={set("name")} className={inp} maxLength={80} />
        <select aria-label="ประเภท" value={f.category} onChange={set("category")} className={inp}>{CATS.filter(c => c[0]).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        <textarea aria-label="แนะนำร้าน" placeholder="แนะนำร้าน (ไม่บังคับ)" value={f.about} onChange={set("about")} className={inp} rows={3} maxLength={500} />
        <input aria-label="เบอร์โทร" placeholder="เบอร์โทร (ไม่บังคับ)" value={f.phone} onChange={set("phone")} className={inp} maxLength={30} />
        <input aria-label="เวลาเปิด-ปิด" placeholder="เวลาเปิด-ปิด เช่น 08:00-17:00 (ไม่บังคับ)" value={f.hours} onChange={set("hours")} className={inp} maxLength={120} />
        <button onClick={save} disabled={busy || f.name.trim().length < 2} className="w-full bg-[#6C5CE7] text-white rounded-full py-2.5 text-sm font-medium disabled:opacity-50">{busy ? "กำลังบันทึก..." : "ปักหมุดร้าน"}</button>
        <p className="text-[11px] text-[#9199A8]">ใครก็ปักหมุดร้านได้ แต่การแก้ข้อมูลร้านต้องยื่นยืนยันเป็นเจ้าของ และให้แอดมินอนุมัติก่อน</p>
      </div>
    </div>
  );
}

function ShopDetail({ id, call, onBack, onOpenPlace, showToast }) {
  const [d, setD] = useState(null);
  const [mode, setMode] = useState(null); // "claim" | "edit"
  const [busy, setBusy] = useState(false);
  const [claim, setClaim] = useState({ contact: "", note: "" });
  const [edit, setEdit] = useState({ about: "", phone: "", hours: "", cover_url: "" });
  const load = useCallback(() => call("shop_detail", { p_place_id: id }).then(r => { setD(r); setEdit({ about: r?.about || "", phone: r?.phone || "", hours: r?.hours || "", cover_url: r?.cover_url || "" }); }).catch(e => showToast("โหลดร้านไม่สำเร็จ: " + e.message)), [id]); // eslint-disable-line
  useEffect(() => { load(); }, [load]);
  if (!d) return <div className="min-h-screen bg-[#F3F5FA] flex items-center justify-center"><Loader2 className="animate-spin text-[#6C5CE7]" /></div>;

  const send = async () => {
    setBusy(true);
    try { await call("submit_shop_claim", { p_place_id: id, p_contact: claim.contact, p_note: claim.note || null, p_evidence: [] }); showToast("ส่งคำขอแล้ว รอแอดมินตรวจสอบ"); setMode(null); load(); }
    catch (e) { showToast(errTh(e.message)); }
    setBusy(false);
  };
  const save = async () => {
    setBusy(true);
    try { await call("update_my_shop", { p_place_id: id, p_about: edit.about, p_phone: edit.phone, p_hours: edit.hours, p_cover_url: edit.cover_url || null }); showToast("บันทึกข้อมูลร้านแล้ว"); setMode(null); load(); }
    catch (e) { showToast("บันทึกไม่สำเร็จ: " + e.message); }
    setBusy(false);
  };
  const photos = d.photos || [];
  return (
    <div style={{ fontFamily: "'IBM Plex Sans Thai', sans-serif" }} className="min-h-screen bg-[#F3F5FA] text-[#1A1D29] pb-24" data-testid="shop-detail">
      <div className="max-w-xl mx-auto px-4 pt-4 space-y-3">
        <div className="flex items-center gap-2"><button onClick={onBack} aria-label="กลับ" className="text-[#6C5CE7]"><ArrowLeft size={20} /></button>
          <h1 style={{ fontFamily: "'Kanit', sans-serif" }} className="text-lg font-semibold flex items-center gap-1 min-w-0"><span className="truncate">{d.name}</span>{d.claimed && <BadgeCheck size={18} className="text-[#0E8F5A] shrink-0" aria-label="เจ้าของยืนยันแล้ว" />}</h1></div>
        {(d.cover_url || photos[0]) && <img src={d.cover_url || photos[0]} alt={d.name} className="w-full aspect-[16/9] object-cover rounded-2xl" />}
        <div className="bg-white rounded-2xl p-4 shadow-sm space-y-2 text-sm">
          <div className="flex items-center justify-between"><span className="text-xs text-[#6B7280]">{CAT_TH[d.category] || d.category}</span><span className="flex items-center gap-2"><Stars v={d.avg_rating} /><span className="text-[11px] text-[#9199A8]">{d.review_count} รีวิว</span></span></div>
          {d.about && <p>{d.about}</p>}
          {d.hours && <p className="text-xs text-[#6B7280] flex items-center gap-1"><Clock size={13} />{d.hours}</p>}
          {d.phone && <p className="text-xs text-[#6B7280] flex items-center gap-1"><Phone size={13} /><a href={`tel:${d.phone}`} className="underline">{d.phone}</a></p>}
          {!d.about && !d.hours && !d.phone && <p className="text-xs text-[#9199A8]">ร้านนี้ยังไม่มีข้อมูลแนะนำ</p>}
        </div>
        {photos.length > 0 && <div className="flex gap-2 overflow-x-auto">{photos.map((u, i) => <img key={i} src={u} alt="" loading="lazy" className="h-24 w-24 object-cover rounded-xl shrink-0" />)}</div>}
        <button onClick={() => onOpenPlace(d.place_id)} className="w-full bg-[#6C5CE7] text-white rounded-full py-2.5 text-sm font-medium">ดูรีวิวและเช็คอินที่ร้านนี้</button>
        {d.is_owner && !d.claimed ? null : d.is_owner && mode !== "edit" && <button onClick={() => setMode("edit")} className="w-full border border-[#6C5CE7] text-[#6C5CE7] rounded-full py-2 text-sm">จัดการร้านของฉัน</button>}
        {d.is_owner && <p className="text-[11px] text-[#0E8F5A]">คุณเป็นเจ้าของร้านนี้ (เช็คอิน/รีวิวร้านตัวเองไม่ได้)</p>}
        {!d.is_owner && !d.claimed && !d.my_claim && mode !== "claim" && <button onClick={() => setMode("claim")} className="w-full border border-black/15 text-[#1A1D29] rounded-full py-2 text-sm">ฉันเป็นเจ้าของร้านนี้ · ยื่นยืนยัน</button>}
        {!d.is_owner && d.my_claim === "pending" && <p className="text-xs bg-[#FFF4D6] text-[#B77600] rounded-xl px-3 py-2">คำขอเป็นเจ้าของของคุณอยู่ระหว่างตรวจสอบ</p>}
        {!d.is_owner && d.my_claim === "rejected" && !d.claimed && <p className="text-xs bg-[#FDE3E8] text-[#C0243F] rounded-xl px-3 py-2">คำขอก่อนหน้าไม่ผ่าน ยื่นใหม่ได้พร้อมข้อมูลที่ชัดเจนขึ้น</p>}
        {!d.is_owner && !d.claimed && d.my_claim === "rejected" && mode !== "claim" && <button onClick={() => setMode("claim")} className="w-full border border-black/15 rounded-full py-2 text-sm">ยื่นขอใหม่</button>}
        {mode === "claim" && (
          <div className="bg-white rounded-2xl p-4 shadow-sm space-y-2">
            <p className="text-sm font-medium">ยื่นยืนยันความเป็นเจ้าของ</p>
            <input aria-label="ช่องทางติดต่อ" placeholder="เบอร์โทร / LINE / เพจร้าน ที่แอดมินติดต่อกลับได้" value={claim.contact} onChange={e => setClaim(x => ({ ...x, contact: e.target.value }))} className={inp} maxLength={120} />
            <textarea aria-label="รายละเอียดยืนยัน" placeholder="บอกวิธียืนยัน เช่น ลิงก์เพจร้าน ทะเบียนพาณิชย์ หรือให้โทรที่เบอร์ร้าน" value={claim.note} onChange={e => setClaim(x => ({ ...x, note: e.target.value }))} className={inp} rows={3} maxLength={500} />
            <div className="flex gap-2"><button onClick={() => setMode(null)} className="flex-1 border border-black/15 rounded-full py-2 text-sm">ยกเลิก</button>
              <button onClick={send} disabled={busy || claim.contact.trim().length < 5} className="flex-1 bg-[#6C5CE7] text-white rounded-full py-2 text-sm disabled:opacity-50">ส่งคำขอ</button></div>
          </div>
        )}
        {mode === "edit" && d.is_owner && (
          <div className="bg-white rounded-2xl p-4 shadow-sm space-y-2">
            <p className="text-sm font-medium">แก้ข้อมูลร้าน</p>
            <textarea aria-label="แนะนำร้าน" value={edit.about} onChange={e => setEdit(x => ({ ...x, about: e.target.value }))} className={inp} rows={3} maxLength={500} placeholder="แนะนำร้าน" />
            <input aria-label="เบอร์โทร" value={edit.phone} onChange={e => setEdit(x => ({ ...x, phone: e.target.value }))} className={inp} maxLength={30} placeholder="เบอร์โทร" />
            <input aria-label="เวลาเปิด-ปิด" value={edit.hours} onChange={e => setEdit(x => ({ ...x, hours: e.target.value }))} className={inp} maxLength={120} placeholder="เวลาเปิด-ปิด" />
            <input aria-label="ลิงก์รูปปก" value={edit.cover_url} onChange={e => setEdit(x => ({ ...x, cover_url: e.target.value }))} className={inp} maxLength={500} placeholder="ลิงก์รูปปก https://..." />
            <div className="flex gap-2"><button onClick={() => setMode(null)} className="flex-1 border border-black/15 rounded-full py-2 text-sm">ยกเลิก</button>
              <button onClick={save} disabled={busy} className="flex-1 bg-[#6C5CE7] text-white rounded-full py-2 text-sm">บันทึก</button></div>
          </div>
        )}
      </div>
    </div>
  );
}

// แท็บแอดมิน: คำขอเป็นเจ้าของร้าน
export function AdminShopClaims({ call, showToast }) {
  const [filter, setFilter] = useState("pending");
  const [rows, setRows] = useState(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => { setRows(null); call("admin_shop_claims", { p_status: filter === "all" ? null : filter }).then(r => setRows(Array.isArray(r) ? r : [])).catch(e => { setRows([]); showToast("โหลดไม่สำเร็จ: " + e.message); }); }, [filter]); // eslint-disable-line
  useEffect(() => { load(); }, [load]);
  const review = async (c, approve) => {
    let reason = null;
    if (!approve) { reason = window.prompt("เหตุผลที่ไม่ผ่าน (ผู้ยื่นจะเห็น)", "ยืนยันความเป็นเจ้าของไม่ได้"); if (reason === null) return; }
    else if (!window.confirm(`อนุมัติให้ ${c.username} เป็นเจ้าของ "${c.place_name}"?`)) return;
    setBusy(true);
    try { await call("admin_review_shop_claim", { p_claim_id: c.id, p_approve: approve, p_reason: reason }); showToast(approve ? "อนุมัติแล้ว" : "ปฏิเสธแล้ว"); load(); }
    catch (e) { showToast("ไม่สำเร็จ: " + e.message); }
    setBusy(false);
  };
  const ST = { pending: "รอตรวจ", approved: "อนุมัติ", rejected: "ไม่ผ่าน" };
  return (
    <>
      <div className="flex gap-1 mb-2 text-[11px]">{[["pending", "รอตรวจ"], ["approved", "อนุมัติแล้ว"], ["rejected", "ไม่ผ่าน"], ["all", "ทั้งหมด"]].map(([k, l]) => <button key={k} onClick={() => setFilter(k)} className={`px-2.5 py-1 rounded-full ${filter === k ? "bg-[#1A1D29] text-white" : "bg-white text-[#6B7280] border border-[#E8EAF0]"}`}>{l}</button>)}</div>
      {rows === null ? <p className="text-xs text-[#9199A8]">กำลังโหลด...</p> : rows.length === 0 ? <p className="text-xs text-[#9199A8] py-4 text-center">ไม่มีรายการ</p> :
        <div className="space-y-2">{rows.map(c => (
          <div key={c.id} className="bg-white border border-[#E8EAF0] rounded-xl p-3 text-xs space-y-1.5">
            <div className="flex items-center justify-between gap-2"><p className="font-medium text-[#1A1D29] truncate">{c.place_name}</p><span className="text-[10px] px-2 py-0.5 rounded-full bg-[#E8EAF0] text-[#6B7280] shrink-0">{ST[c.status] || c.status}</span></div>
            <p className="text-[#6B7280]">ผู้ยื่น: {c.username} · ติดต่อ: {c.contact}</p>
            {c.note && <p className="text-[#6B7280]">รายละเอียด: {c.note}</p>}
            {c.reason && <p className="text-[#9199A8]">เหตุผล: {c.reason}</p>}
            {c.status === "pending" && <div className="flex gap-2 pt-1">
              <button disabled={busy} onClick={() => review(c, true)} className="flex-1 bg-[#0E8F5A] text-white rounded-full py-1.5">อนุมัติ</button>
              <button disabled={busy} onClick={() => review(c, false)} className="flex-1 border border-[#EF4565] text-[#EF4565] rounded-full py-1.5">ปฏิเสธ</button></div>}
          </div>))}</div>}
    </>
  );
}
