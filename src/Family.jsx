import { useState, useEffect, useCallback } from "react";
import { ArrowLeft, Users, Copy, Check, Eye, EyeOff, Crown, LogOut, Share2 } from "lucide-react";

const G = "#FFC24B";
const ROLES = [["father", "พ่อ"], ["mother", "แม่"], ["child", "ลูก"], ["other", "อื่นๆ"]];
const ROLE_TH = Object.fromEntries(ROLES);
const card = { background: "#151C33" };

function RolePicker({ value, onChange }) {
  return (
    <div className="flex gap-2" role="radiogroup" aria-label="บทบาทในครอบครัว">
      {ROLES.map(([k, l]) => (
        <button key={k} role="radio" aria-checked={value === k} onClick={() => onChange(k)} className="flex-1 min-h-[44px] rounded-xl text-sm font-semibold"
          style={value === k ? { background: G, color: "#1A1305" } : { background: "#0B1020", color: "#F1F3FA", border: "1.5px solid #3A4772" }}>{l}</button>
      ))}
    </div>
  );
}

function Shell({ onBack, children }) {
  return (
    <div style={{ fontFamily: "'IBM Plex Sans Thai', sans-serif", background: "#0B1020", color: "#F1F3FA" }} className="min-h-screen pb-24">
      <header className="max-w-xl mx-auto flex items-center gap-3 px-5 pt-5">
        <button onClick={onBack} aria-label="กลับ" className="w-11 h-11 rounded-full flex items-center justify-center" style={card}><ArrowLeft size={20} /></button>
        <h1 style={{ fontFamily: "'Kanit', sans-serif" }} className="text-xl font-semibold flex items-center gap-2"><Users size={20} color={G} />ครอบครัว</h1>
      </header>
      <main className="max-w-xl mx-auto px-5 mt-5 space-y-4">{children}</main>
    </div>
  );
}

export default function FamilyView({ rest, onBack, showToast }) {
  const [fam, setFam] = useState(undefined); // undefined = โหลด, null = ยังไม่มีครอบครัว
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [role, setRole] = useState("father");
  const [ageOk, setAgeOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [viewing, setViewing] = useState(null); // {name, rows}
  const [sureLeave, setSureLeave] = useState(false);

  const load = useCallback(() => rest("/rest/v1/rpc/family_me", { method: "POST", body: {} }).then(setFam).catch(e => { showToast("โหลดครอบครัวไม่สำเร็จ: " + e.message); setFam(null); }), [rest]);
  useEffect(() => { load(); }, [load]);

  const run = async (fn, body, okMsg) => {
    setBusy(true);
    try { await rest(`/rest/v1/rpc/${fn}`, { method: "POST", body }); if (okMsg) showToast(okMsg); await load(); return true; }
    catch (e) {
      const m = String(e.message || e);
      showToast(/invalid code/.test(m) ? "ไม่พบรหัสครอบครัวนี้" : /already in a family/.test(m) ? "คุณอยู่ในครอบครัวอยู่แล้ว" : /family full/.test(m) ? "ครอบครัวนี้เต็มแล้ว (สูงสุด 12 คน)" : "ไม่สำเร็จ: " + m);
      return false;
    } finally { setBusy(false); }
  };
  const needAge = role === "child" && !ageOk;

  const copy = async () => {
    try { await navigator.clipboard.writeText(fam.invite_code); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { showToast("คัดลอกไม่ได้ จดรหัสเองนะ"); }
  };
  const share = async () => {
    const text = `มาร่วมครอบครัว "${fam.name}" ใน ปักหมุด ด้วยรหัส ${fam.invite_code}`;
    try { if (navigator.share) await navigator.share({ text }); else { await navigator.clipboard.writeText(text); showToast("คัดลอกข้อความเชิญแล้ว"); } } catch { /* ยกเลิก */ }
  };
  const open = async (m) => {
    try { const rows = await rest("/rest/v1/rpc/family_member_checkins", { method: "POST", body: { p_user: m.user_id } }); setViewing({ name: m.name, rows }); }
    catch (e) { showToast("ดูไม่ได้: " + e.message); }
  };


  if (fam === undefined) return <Shell onBack={onBack}><p className="text-center text-xs py-8" style={{ color: "#A3ABC4" }}>กำลังโหลด...</p></Shell>;

  if (fam === null) return (
    <Shell onBack={onBack}>
      <p className="text-sm" style={{ color: "#A3ABC4" }}>รวมหมุดของคนในบ้านเป็นความคืบหน้าเดียวกัน ทำเควสร่วมกัน และดูอันดับกันเองในบ้าน</p>
      <section className="rounded-3xl p-5 space-y-3" style={card}>
        <p className="text-xs font-semibold" style={{ color: G }}>บทบาทของคุณ</p>
        <RolePicker value={role} onChange={setRole} />
        {role === "child" && (
          <label className="flex items-start gap-2 text-xs cursor-pointer" style={{ color: "#A3ABC4" }}>
            <input type="checkbox" checked={ageOk} onChange={e => setAgeOk(e.target.checked)} className="mt-0.5" />
            ฉันอายุ 13 ปีขึ้นไป หรือมีผู้ปกครองรับทราบและยินยอมให้ใช้งาน
          </label>
        )}
      </section>
      <section className="rounded-3xl p-5 space-y-3" style={card}>
        <h2 style={{ fontFamily: "'Kanit', sans-serif" }} className="font-semibold">สร้างครอบครัวใหม่</h2>
        <input value={name} onChange={e => setName(e.target.value)} maxLength={40} placeholder="ชื่อครอบครัว เช่น บ้านสุขใจ" aria-label="ชื่อครอบครัว" className="w-full rounded-xl px-3 py-3 outline-none" style={{ background: "#0B1020", border: "1.5px solid #3A4772", color: "#F1F3FA" }} />
        <button disabled={busy || needAge || !name.trim()} onClick={() => run("family_create", { p_name: name, p_role: role }, "สร้างครอบครัวแล้ว")} className="w-full min-h-[48px] rounded-2xl font-semibold disabled:opacity-40" style={{ background: G, color: "#1A1305", fontFamily: "'Kanit', sans-serif" }}>สร้างครอบครัว</button>
      </section>
      <section className="rounded-3xl p-5 space-y-3" style={card}>
        <h2 style={{ fontFamily: "'Kanit', sans-serif" }} className="font-semibold">เข้าร่วมด้วยรหัสเชิญ</h2>
        <input value={code} onChange={e => setCode(e.target.value.toUpperCase())} maxLength={8} placeholder="รหัส 8 ตัว" aria-label="รหัสเชิญ" className="w-full rounded-xl px-3 py-3 outline-none tracking-widest" style={{ background: "#0B1020", border: "1.5px solid #3A4772", color: "#F1F3FA" }} />
        <button disabled={busy || needAge || code.trim().length < 8} onClick={() => run("family_join", { p_code: code, p_role: role }, "เข้าร่วมครอบครัวแล้ว")} className="w-full min-h-[48px] rounded-2xl font-semibold disabled:opacity-40" style={{ border: `1.5px solid ${G}`, color: G, fontFamily: "'Kanit', sans-serif" }}>เข้าร่วม</button>
      </section>
    </Shell>
  );

  const members = [...fam.members].sort((a, b) => b.pins - a.pins);
  const me = fam.members.find(m => m.user_id === fam.me);
  const total = fam.members.reduce((s, m) => s + m.pins, 0);

  return (
    <Shell onBack={onBack}>
      <section className="rounded-3xl p-5" style={card}>
        <p className="text-xs font-semibold" style={{ color: G }}>ครอบครัวของเรา</p>
        <h2 style={{ fontFamily: "'Kanit', sans-serif" }} className="text-2xl font-semibold">{fam.name}</h2>
        <p className="text-sm mt-1" style={{ color: "#A3ABC4" }}>หมุดรวมทั้งบ้าน <span style={{ color: G }} className="font-semibold">{total}</span> · สมาชิก {fam.members.length} คน</p>
        <div className="flex items-center gap-2 mt-4">
          <div className="flex-1 rounded-xl px-3 py-2.5" style={{ background: "#0B1020" }}>
            <p className="text-[11px]" style={{ color: "#A3ABC4" }}>รหัสเชิญ</p>
            <p className="font-semibold tracking-widest">{fam.invite_code}</p>
          </div>
          <button onClick={copy} aria-label="คัดลอกรหัส" className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: "#0B1020" }}>{copied ? <Check size={18} color={G} /> : <Copy size={18} />}</button>
          <button onClick={share} aria-label="ชวนคนในบ้าน" className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: "#0B1020" }}><Share2 size={18} /></button>
        </div>
      </section>

      <section className="rounded-3xl p-5 space-y-4" style={card}>
        <h2 style={{ fontFamily: "'Kanit', sans-serif" }} className="font-semibold">เควสครอบครัว</h2>
        {fam.quests.map(q => (
          <div key={q.id}>
            <div className="flex justify-between text-sm"><span>{q.title}</span><span className="font-semibold">{q.cur}/{q.tgt}</span></div>
            <div className="h-2 rounded-full mt-1.5 overflow-hidden" style={{ background: "#0B1020" }}><div className="h-full" style={{ width: `${Math.min(100, (q.cur / Math.max(q.tgt, 1)) * 100)}%`, background: G }} /></div>
          </div>
        ))}
      </section>

      <section className="rounded-3xl p-5" style={card}>
        <h2 style={{ fontFamily: "'Kanit', sans-serif" }} className="font-semibold mb-3">อันดับในบ้าน</h2>
        <ol className="space-y-2">
          {members.map((m, i) => (
            <li key={m.user_id} className="flex items-center gap-3 rounded-2xl px-3 py-2.5" style={{ background: "#0B1020" }}>
              <span className="w-6 text-center font-semibold" style={{ color: i === 0 ? G : "#A3ABC4" }}>{i + 1}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate flex items-center gap-1.5">{m.name}{m.user_id === fam.me && <span className="text-[10px] font-normal" style={{ color: G }}>(คุณ)</span>}{m.is_guardian && <Crown size={12} color={G} aria-label="ผู้ดูแล" />}</p>
                <p className="text-[11px]" style={{ color: "#A3ABC4" }}>{ROLE_TH[m.role]} · สัปดาห์นี้ {m.week} · {m.today ? "ปักหมุดวันนี้แล้ว" : "วันนี้ยังไม่ปัก"}</p>
              </div>
              <span className="font-semibold" style={{ color: G }}>{m.pins}</span>
              {fam.i_am_guardian && m.user_id !== fam.me && (m.can_view
                ? <button onClick={() => open(m)} aria-label={`ดูเช็คอินของ ${m.name}`} className="w-9 h-9 rounded-full flex items-center justify-center" style={card}><Eye size={16} /></button>
                : <span className="w-9 h-9 flex items-center justify-center" title="สมาชิกยังไม่อนุญาตให้ดู"><EyeOff size={16} color="#8791AE" /></span>)}
            </li>
          ))}
        </ol>
      </section>

      <section className="rounded-3xl p-5 space-y-3" style={card}>
        <h2 style={{ fontFamily: "'Kanit', sans-serif" }} className="font-semibold">ตั้งค่าของฉัน</h2>
        <p className="text-xs" style={{ color: "#A3ABC4" }}>บทบาท</p>
        <RolePicker value={fam.my_role} onChange={r => run("family_set_prefs", { p_role: r })} />
        <label className="flex items-start gap-3 cursor-pointer pt-1">
          <input type="checkbox" checked={!!me?.guardians_can_view} onChange={e => run("family_set_prefs", { p_guardians_can_view: e.target.checked }, e.target.checked ? "อนุญาตให้พ่อแม่ดูเช็คอินของคุณแล้ว" : "ปิดการให้ดูแล้ว")} className="mt-1" />
          <span className="text-sm">ให้พ่อแม่ในบ้านดูรายการเช็คอินล่าสุดของฉัน<span className="block text-xs" style={{ color: "#A3ABC4" }}>ปิดไว้เป็นค่าเริ่มต้น เปลี่ยนได้ทุกเมื่อ ผู้ดูเห็นแค่ชื่อสถานที่และเวลา</span></span>
        </label>
        {!sureLeave
          ? <button onClick={() => setSureLeave(true)} className="flex items-center gap-1.5 text-sm pt-2" style={{ color: "#FF8A8A" }}><LogOut size={15} />ออกจากครอบครัว</button>
          : <div className="flex gap-2 pt-2"><button onClick={() => setSureLeave(false)} className="flex-1 min-h-[44px] rounded-xl text-sm" style={{ border: "1.5px solid #3A4772" }}>ยกเลิก</button><button onClick={async () => { if (await run("family_leave", {}, "ออกจากครอบครัวแล้ว")) setSureLeave(false); }} className="flex-1 min-h-[44px] rounded-xl text-sm font-semibold" style={{ background: "#C43D3D" }}>ยืนยันออก</button></div>}
      </section>

      {viewing && (
        <div className="fixed inset-0 z-50 flex items-end justify-center px-4" style={{ background: "rgba(0,0,0,.6)" }} role="dialog" aria-label={`เช็คอินของ ${viewing.name}`}>
          <div className="w-full max-w-sm rounded-t-3xl p-5 max-h-[70vh] overflow-y-auto" style={{ background: "#151C33" }}>
            <div className="flex justify-between items-center mb-3"><h3 style={{ fontFamily: "'Kanit', sans-serif" }} className="font-semibold">เช็คอินล่าสุดของ {viewing.name}</h3><button onClick={() => setViewing(null)} className="text-sm underline" style={{ color: "#B7ABFF" }}>ปิด</button></div>
            {viewing.rows.length === 0 ? <p className="text-sm" style={{ color: "#A3ABC4" }}>ยังไม่มีเช็คอิน</p> : (
              <ul className="space-y-2">{viewing.rows.map((r, i) => <li key={i} className="flex justify-between text-sm gap-3"><span className="truncate">{r.name}</span><span className="shrink-0 text-xs" style={{ color: "#A3ABC4" }}>{new Date(r.created_at).toLocaleString("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span></li>)}</ul>
            )}
          </div>
        </div>
      )}
    </Shell>
  );
}
