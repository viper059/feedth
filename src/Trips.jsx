import { useState, useEffect, useCallback } from "react";
import { X, MapPin, Plus, Check, Users, CalendarDays } from "lucide-react";

const fmt = (iso) => {
  try { return new Date(iso).toLocaleString("th-TH", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }); } catch { return iso; }
};
const toLocalInput = (d) => { const p = (n) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };

function CreateTrip({ rest, showToast, onDone, onCancel }) {
  const [title, setTitle] = useState("");
  const [q, setQ] = useState("");
  const [found, setFound] = useState([]);
  const [place, setPlace] = useState(null); // {id,name}
  const [pname, setPname] = useState("");
  const [when, setWhen] = useState(() => { const d = new Date(Date.now() + 86400000); d.setMinutes(0, 0, 0); return toLocalInput(d); });
  const [note, setNote] = useState("");
  const [open, setOpen] = useState(true);
  const [friends, setFriends] = useState(null);
  const [pick, setPick] = useState({});
  const [busy, setBusy] = useState(false);

  useEffect(() => { rest("/rest/v1/rpc/people_list", { method: "POST", body: { p_kind: "friends" } }).then(r => setFriends(Array.isArray(r) ? r : [])).catch(() => setFriends([])); }, []); // eslint-disable-line
  useEffect(() => {
    const s = q.trim();
    if (s.length < 2 || place) { setFound([]); return; }
    let live = true;
    const t = setTimeout(() => {
      rest(`/rest/v1/places?name=ilike.*${encodeURIComponent(s.replace(/[*,()]/g, " "))}*&select=id,name,province&limit=6`).then(r => { if (live) setFound(Array.isArray(r) ? r : []); }).catch(() => {});
    }, 300);
    return () => { live = false; clearTimeout(t); };
  }, [q, place]); // eslint-disable-line

  const submit = async () => {
    if (!title.trim() || busy) return;
    setBusy(true);
    try {
      const ids = Object.keys(pick).filter(k => pick[k]);
      await rest("/rest/v1/rpc/create_trip", { method: "POST", body: { p_title: title.trim(), p_place_id: place ? place.id : null, p_place_name: place ? null : (pname.trim() || null), p_starts_at: new Date(when).toISOString(), p_note: note.trim() || null, p_open: open, p_invitees: ids } });
      showToast("สร้างทริปแล้ว");
      onDone();
    } catch (e) {
      const m = e.message || "";
      showToast(m.includes("invalid date") ? "วันเวลาไม่ถูกต้อง (ต้องไม่เกิน 180 วันข้างหน้า)" : m.includes("limit") ? "วันนี้สร้างทริปครบแล้ว ลองใหม่พรุ่งนี้" : "สร้างทริปไม่สำเร็จ: " + m);
    }
    setBusy(false);
  };

  const inp = "w-full text-sm bg-[#F3F5FA] rounded-lg px-3 py-2 outline-none";
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3" data-testid="trip-form">
      <p className="font-medium text-sm">สร้างทริปกับเพื่อน</p>
      <input value={title} onChange={e => setTitle(e.target.value)} maxLength={60} placeholder="ชื่อทริป เช่น ไปคาเฟ่เสาร์นี้" className={inp} data-testid="trip-title" />
      <div>
        <p className="text-[11px] text-[#9199A8] mb-1">สถานที่ (เลือกจากรายการเพื่อให้นับแต้มเที่ยวด้วยกัน)</p>
        {place ? (
          <div className="flex items-center gap-2 text-sm bg-[#E8F8F1] text-[#178A5D] rounded-full pl-3 pr-1 py-1 w-fit max-w-full"><MapPin size={13} /><span className="truncate">{place.name}</span>
            <button onClick={() => { setPlace(null); setQ(""); }} aria-label="เอาสถานที่ออก" className="w-6 h-6 flex items-center justify-center"><X size={13} /></button></div>
        ) : (
          <>
            <input value={q} onChange={e => { setQ(e.target.value); setPname(e.target.value); }} placeholder="พิมพ์ชื่อสถานที่ (อย่างน้อย 2 ตัวอักษร)" className={inp} data-testid="trip-place-q" />
            {found.length > 0 && <div className="mt-1 rounded-xl bg-[#F3F5FA] p-1 space-y-1">{found.map(f => <button key={f.id} onClick={() => { setPlace(f); setQ(""); }} data-testid="trip-place-opt" className="w-full text-left text-sm bg-white rounded-lg px-3 py-1.5 truncate">{f.name}{f.province ? <span className="text-[11px] text-[#9199A8]"> · {f.province}</span> : null}</button>)}</div>}
            {q.trim().length >= 2 && found.length === 0 && <p className="text-[11px] text-[#9199A8] mt-1">ไม่เลือกจากรายการ ก็ใช้ชื่อที่พิมพ์ได้ แต่จะไม่นับแต้มเช็คอินร่วมกัน</p>}
          </>
        )}
      </div>
      <div><p className="text-[11px] text-[#9199A8] mb-1">วันและเวลานัด</p><input type="datetime-local" value={when} onChange={e => setWhen(e.target.value)} className={inp} data-testid="trip-when" /></div>
      <textarea value={note} onChange={e => setNote(e.target.value)} maxLength={300} rows={2} placeholder="รายละเอียด นัดเจอกันที่ไหน (ไม่บังคับ)" className={inp + " resize-none"} />
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={open} onChange={e => setOpen(e.target.checked)} className="mt-1" data-testid="trip-open" /><span>เปิดให้เพื่อนของฉันกด "ลงชื่อ" เองได้<span className="block text-[11px] text-[#9199A8]">เฉพาะคนที่เป็นเพื่อนกับคุณในแอปเท่านั้น</span></span></label>
      <div>
        <p className="text-[11px] text-[#9199A8] mb-1">ชวนเพื่อนโดยตรง (ไม่บังคับ)</p>
        {friends === null && <p className="text-xs text-[#9199A8]">กำลังโหลด...</p>}
        {friends && friends.length === 0 && <p className="text-xs text-[#9199A8]">ยังไม่มีเพื่อนในแอป เปิดให้ลงชื่อไว้ก่อนก็ได้</p>}
        <div className="flex flex-wrap gap-1.5">{(friends || []).map(f => <button key={f.id} onClick={() => setPick(p => ({ ...p, [f.id]: !p[f.id] }))} data-testid="trip-friend" className={`text-xs rounded-full px-3 py-1 border ${pick[f.id] ? "bg-[#6C5CE7] text-white border-[#6C5CE7]" : "bg-white text-[#4B5468] border-[#E8EAF0]"}`}>{pick[f.id] ? "✓ " : ""}{f.name}</button>)}</div>
      </div>
      <div className="flex gap-2">
        <button onClick={onCancel} className="flex-1 border border-black/10 text-sm py-2 rounded-full">ยกเลิก</button>
        <button onClick={submit} disabled={!title.trim() || busy} data-testid="trip-submit" className="flex-1 bg-[#6C5CE7] text-white text-sm font-medium py-2 rounded-full disabled:opacity-40">{busy ? "กำลังสร้าง..." : "สร้างทริป"}</button>
      </div>
    </div>
  );
}

export default function TripsView({ rest, session, onClose, onChanged, showToast }) {
  const [rows, setRows] = useState(null);
  const [creating, setCreating] = useState(false);
  const load = useCallback(async () => {
    try { const r = await rest("/rest/v1/rpc/my_trips", { method: "POST", body: {} }); setRows(Array.isArray(r) ? r : []); }
    catch (e) { showToast("โหลดทริปไม่สำเร็จ: " + e.message); setRows([]); }
  }, [rest]); // eslint-disable-line
  useEffect(() => { load(); }, [load]);
  const respond = async (id, status) => {
    try { await rest("/rest/v1/rpc/respond_trip", { method: "POST", body: { p_trip: id, p_status: status } }); showToast(status === "going" ? "ลงชื่อไปด้วยแล้ว" : "ไม่ไปแล้ว"); await load(); onChanged && onChanged(); }
    catch (e) { showToast("ทำรายการไม่สำเร็จ: " + e.message); }
  };
  const mine = session.user_id;
  const invites = (rows || []).filter(t => t.my_status === "invited");
  const others = (rows || []).filter(t => t.my_status !== "invited");

  const Card = ({ t }) => {
    const going = t.members.filter(m => m.status === "going");
    const done = going.filter(m => m.checked_in).length;
    return (
      <div className="bg-white rounded-2xl p-4 shadow-sm space-y-2" data-testid="trip-card">
        <div className="flex items-start justify-between gap-2"><p className="font-medium text-[#1A1D29]">{t.title}</p>
          {t.my_status === "going" && <span className="text-[10px] bg-[#E8F8F1] text-[#178A5D] rounded-full px-2 py-0.5 shrink-0">ไปด้วย</span>}</div>
        <p className="text-xs text-[#6B7280] flex items-center gap-1"><CalendarDays size={13} />{fmt(t.starts_at)}</p>
        {(t.place_name) && <p className="text-xs text-[#6B7280] flex items-center gap-1"><MapPin size={13} />{t.place_name}</p>}
        <p className="text-[11px] text-[#9199A8]">ชวนโดย {t.host_id === mine ? "คุณ" : t.host}</p>
        {t.note && <p className="text-sm text-[#4B5468]">{t.note}</p>}
        <div className="flex flex-wrap gap-1.5" data-testid="trip-members">{going.map(m => <span key={m.id} className="text-[11px] rounded-full px-2 py-0.5 bg-[#F3F5FA] text-[#4B5468]">{m.checked_in ? "✓ " : ""}{m.name}</span>)}</div>
        <p className="text-[11px] text-[#9199A8] flex items-center gap-1"><Users size={12} />ไปด้วย {going.length} คน{t.place_id ? ` · เช็คอินแล้ว ${done}` : ""}</p>
        {t.place_id && <p className="text-[11px] text-[#6C5CE7]">ไปเช็คอินที่สถานที่นี้ใกล้เวลานัด ตั้งแต่ 2 คนขึ้นไป ได้ +5 แต้มทุกคน</p>}
        <div className="flex gap-2 pt-1">
          {t.my_status === "invited" && <><button onClick={() => respond(t.id, "going")} data-testid="trip-accept" className="flex-1 bg-[#6C5CE7] text-white text-sm py-1.5 rounded-full">ไปด้วย</button><button onClick={() => respond(t.id, "declined")} className="flex-1 border border-black/10 text-sm py-1.5 rounded-full">ไม่ไป</button></>}
          {t.my_status === null && <button onClick={() => respond(t.id, "going")} data-testid="trip-join" className="flex-1 bg-[#6C5CE7] text-white text-sm py-1.5 rounded-full flex items-center justify-center gap-1"><Check size={14} />ลงชื่อไปด้วย</button>}
          {t.my_status === "going" && t.host_id !== mine && <button onClick={() => respond(t.id, "declined")} className="border border-black/10 text-xs px-4 py-1.5 rounded-full text-[#6B7280]">ไม่ไปแล้ว</button>}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-[#F3F5FA] text-[#1A1D29]" role="dialog" aria-label="ทริปกับเพื่อน" data-testid="trips-view">
      <div className="max-w-xl mx-auto px-5 pt-5 pb-16 space-y-3">
        <div className="flex items-center justify-between">
          <h2 style={{ fontFamily: "'Kanit', sans-serif" }} className="text-xl font-semibold">ทริปกับเพื่อน</h2>
          <button onClick={onClose} aria-label="ปิด" className="w-11 h-11 rounded-full bg-white flex items-center justify-center"><X size={20} /></button>
        </div>
        {!creating && <button onClick={() => setCreating(true)} data-testid="trip-new" className="w-full text-white text-sm font-medium py-2.5 rounded-2xl flex items-center justify-center gap-1.5" style={{ background: "linear-gradient(135deg,#7B61FF,#FF5C8A)" }}><Plus size={16} />สร้างทริปใหม่</button>}
        {creating && <CreateTrip rest={rest} showToast={showToast} onCancel={() => setCreating(false)} onDone={() => { setCreating(false); load(); onChanged && onChanged(); }} />}
        {rows === null && <p className="text-center text-xs text-[#9199A8] py-6">กำลังโหลด...</p>}
        {invites.length > 0 && <p className="text-xs text-[#9199A8] pt-1">คำเชิญที่รอตอบ</p>}
        {invites.map(t => <Card key={t.id} t={t} />)}
        {others.length > 0 && <p className="text-xs text-[#9199A8] pt-1">ทริปของคุณและเพื่อน</p>}
        {others.map(t => <Card key={t.id} t={t} />)}
        {rows && rows.length === 0 && !creating && <p className="text-center text-sm text-[#9199A8] py-8">ยังไม่มีทริป กดสร้างแล้วชวนเพื่อนไปเที่ยวด้วยกันได้เลย</p>}
      </div>
    </div>
  );
}
