import { useState, useEffect, useCallback } from "react";
import { ArrowLeft, Loader2, Copy } from "lucide-react";

const ST = { pending: ["รอตรวจสอบ", "bg-[#FFF4D6] text-[#B77600]"], paid: ["ชำระแล้ว", "bg-[#DDF6EA] text-[#0E8F5A]"], failed: ["ปฏิเสธ", "bg-[#FDE3E8] text-[#C0243F]"], refunded: ["คืนเงินแล้ว", "bg-[#E8EAF0] text-[#6B7280]"] };
const Badge = ({ s }) => { const [l, c] = ST[s] || [s, "bg-[#E8EAF0]"]; return <span className={`text-[10px] px-2 py-0.5 rounded-full shrink-0 ${c}`}>{l}</span>; };
const baht = (n) => "฿" + Number(n).toLocaleString("th-TH", { maximumFractionDigits: 2 });
const when = (iso) => iso ? new Date(iso).toLocaleString("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "";
const Shell = ({ title, onBack, children }) => (
  <div className="min-h-screen bg-[#F7F8FC] pb-24"><div className="max-w-xl mx-auto px-4 pt-4">
    <div className="flex items-center gap-2 mb-3"><button onClick={onBack} aria-label="กลับ" className="text-[#6C5CE7]"><ArrowLeft size={20} /></button>
      <h1 style={{ fontFamily: "'Kanit', sans-serif" }} className="text-lg font-semibold text-[#1A1D29]">{title}</h1></div>{children}</div></div>
);

// ---------- ลูกค้า: ซื้อเครดิต (โอนพร้อมเพย์ แล้วแจ้งโอน รอเจ้าของยืนยัน) ----------
export function BuyCredits({ rest, cfg, onBack, showToast, onChanged }) {
  const [order, setOrder] = useState(null);
  const [orders, setOrders] = useState(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => rest("/rest/v1/rpc/my_orders", { method: "POST", body: {} }).then(r => setOrders(Array.isArray(r) ? r : [])).catch(() => setOrders([])), [rest]);
  useEffect(() => { load(); }, [load]);
  const buy = async (id) => {
    setBusy(true);
    try { const o = await rest("/rest/v1/rpc/create_manual_order", { method: "POST", body: { p_package_id: id } }); setOrder(o); load(); }
    catch (e) { showToast(e.message.includes("too many") ? "มีรายการรอตรวจสอบครบ 3 รายการแล้ว" : "สร้างรายการไม่สำเร็จ: " + e.message); }
    setBusy(false);
  };
  const notify = async () => {
    setBusy(true);
    try { await rest("/rest/v1/rpc/notify_paid", { method: "POST", body: { p_order_id: order.id, p_note: note } }); showToast("แจ้งโอนแล้ว รอเจ้าของตรวจสอบ"); setOrder(null); setNote(""); load(); onChanged?.(); }
    catch (e) { showToast("แจ้งไม่สำเร็จ: " + e.message); }
    setBusy(false);
  };
  const copy = (t) => { try { navigator.clipboard.writeText(t); showToast("คัดลอกแล้ว"); } catch { /* ignore */ } };
  return (
    <Shell title="เติมเครดิต" onBack={onBack}>
      {cfg.mode !== "manual" ? <p className="text-sm text-[#6B7280] bg-white rounded-2xl p-4">ขณะนี้ยังไม่เปิดให้เติมเครดิต</p> : !order ? (
        <div className="space-y-2">
          {cfg.packages.length === 0 && <p className="text-sm text-[#6B7280] bg-white rounded-2xl p-4">ยังไม่มีแพ็กเกจให้เลือก</p>}
          {cfg.packages.map(p => (
            <button key={p.id} disabled={busy} onClick={() => buy(p.id)} className="w-full flex items-center justify-between bg-white border border-[#E8EAF0] rounded-2xl px-4 py-3">
              <span className="font-medium text-[#1A1D29]">{p.credits} เครดิต</span><span className="text-[#6C5CE7] font-semibold">{baht(p.price_thb)}</span></button>))}
        </div>
      ) : (
        <div className="bg-white border border-[#E8EAF0] rounded-2xl p-4 space-y-3 text-sm">
          <p className="font-medium text-[#1A1D29]">โอนเงิน {baht(order.amount)} เพื่อรับ {order.credits} เครดิต</p>
          <div className="bg-[#F7F8FC] rounded-xl p-3 space-y-1">
            <p className="text-[#6B7280] text-xs">พร้อมเพย์</p>
            <p className="flex items-center gap-2 font-semibold text-[#1A1D29]">{cfg.promptpay_id || "(เจ้าของยังไม่ได้ตั้งเลขพร้อมเพย์)"}{cfg.promptpay_id && <button onClick={() => copy(cfg.promptpay_id)} aria-label="คัดลอก"><Copy size={14} /></button>}</p>
            {cfg.promptpay_name && <p className="text-xs text-[#6B7280]">ชื่อบัญชี {cfg.promptpay_name}</p>}
            <p className="text-xs text-[#6B7280] pt-1">รหัสอ้างอิง <b className="text-[#1A1D29]">{order.ref}</b> (ใส่ในบันทึกช่วยจำการโอนถ้าทำได้)</p>
          </div>
          {cfg.note && <p className="text-xs text-[#6B7280] whitespace-pre-line">{cfg.note}</p>}
          <input value={note} onChange={e => setNote(e.target.value)} maxLength={200} placeholder="หมายเหตุ เช่น เวลาโอน / 4 ตัวท้ายบัญชี (ไม่บังคับ)" className="w-full min-w-0 border border-[#E8EAF0] rounded-xl px-3 py-2 text-sm" />
          <button disabled={busy} onClick={notify} className="w-full bg-[#6C5CE7] text-white rounded-full py-2.5 font-medium">{busy ? <Loader2 size={16} className="animate-spin mx-auto" /> : "โอนแล้ว แจ้งเจ้าของ"}</button>
          <button onClick={() => setOrder(null)} className="w-full text-xs text-[#9199A8]">กลับ (รายการยังค้างอยู่ในประวัติ)</button>
        </div>
      )}
      <h2 className="text-xs font-medium text-[#6B7280] mt-5 mb-2">ประวัติการสั่งซื้อ</h2>
      {orders === null ? <p className="text-xs text-[#9199A8]">กำลังโหลด...</p> : orders.length === 0 ? <p className="text-xs text-[#9199A8]">ยังไม่มีรายการ</p> :
        <div className="space-y-1.5">{orders.map(o => (
          <div key={o.id} className="flex items-center justify-between gap-2 bg-white border border-[#E8EAF0] rounded-xl px-3 py-2 text-xs">
            <div className="min-w-0"><p className="font-medium text-[#1A1D29]">{o.credits} เครดิต · {baht(o.amount_thb)}</p><p className="text-[#9199A8] truncate">{o.ref} · {when(o.created_at)}{o.status === "pending" && o.notified_at ? " · แจ้งโอนแล้ว" : ""}</p></div>
            <Badge s={o.status} /></div>))}</div>}
    </Shell>
  );
}

// ---------- เจ้าของ: จัดการร้าน ----------
export function AdminPanel({ rest, onBack, showToast, onChanged }) {
  const [tab, setTab] = useState("orders");
  const [filter, setFilter] = useState("pending");
  const [orders, setOrders] = useState(null);
  const [stats, setStats] = useState(null);
  const [pk, setPk] = useState(null);
  const [cfg, setCfg] = useState(null);
  const [busy, setBusy] = useState(false);
  const call = (fn, body = {}) => rest("/rest/v1/rpc/" + fn, { method: "POST", body });
  const loadOrders = useCallback(() => call("admin_orders", { p_status: filter === "all" ? null : filter }).then(r => setOrders(Array.isArray(r) ? r : [])).catch(e => { setOrders([]); showToast("โหลดไม่สำเร็จ: " + e.message); }), [filter]); // eslint-disable-line
  const loadStats = () => call("admin_stats").then(setStats).catch(() => {});
  const loadPk = () => call("admin_packages").then(r => setPk(Array.isArray(r) ? r : [])).catch(() => setPk([]));
  const loadCfg = () => call("payment_config").then(setCfg).catch(() => {});
  useEffect(() => { loadOrders(); }, [loadOrders]);
  useEffect(() => { loadStats(); loadPk(); loadCfg(); }, []); // eslint-disable-line

  const act = async (fn, o, okMsg, ask) => {
    if (ask && !window.confirm(ask)) return;
    setBusy(true);
    try { await call(fn, { p_order_id: o.id }); showToast(okMsg); await loadOrders(); loadStats(); onChanged?.(); }
    catch (e) { showToast(e.message.includes("spent") ? "คืนไม่ได้: ผู้ใช้ใช้เครดิตไปแล้ว" : "ไม่สำเร็จ: " + e.message); }
    setBusy(false);
  };
  const setSetting = async (k, v) => { try { await call("admin_set_setting", { p_key: k, p_value: v }); showToast("บันทึกแล้ว"); loadCfg(); } catch (e) { showToast("บันทึกไม่สำเร็จ: " + e.message); } };
  const savePk = async (p) => { try { await call("admin_save_package", { p_id: p.id, p_credits: Number(p.credits), p_price: Number(p.price_thb), p_active: !!p.active }); showToast("บันทึกแพ็กเกจแล้ว"); loadPk(); } catch (e) { showToast("บันทึกไม่สำเร็จ: " + e.message); } };

  return (
    <Shell title="จัดการร้าน" onBack={onBack}>
      {stats && <div className="grid grid-cols-3 gap-2 mb-3 text-center">
        {[["รอตรวจสอบ", stats.pending], ["ยอด 30 วัน", baht(stats.revenue_30d)], ["ยอดรวม", baht(stats.revenue)]].map(([l, v]) => <div key={l} className="bg-white border border-[#E8EAF0] rounded-xl py-2"><p className="text-[10px] text-[#9199A8]">{l}</p><p className="text-sm font-semibold text-[#1A1D29]">{v}</p></div>)}</div>}
      <div className="flex gap-1 mb-3 text-xs">{[["orders", "ออเดอร์"], ["packages", "แพ็กเกจ"], ["settings", "ตั้งค่า"]].map(([k, l]) => <button key={k} onClick={() => setTab(k)} className={`px-3 py-1.5 rounded-full ${tab === k ? "bg-[#6C5CE7] text-white" : "bg-white text-[#6B7280] border border-[#E8EAF0]"}`}>{l}</button>)}</div>

      {tab === "orders" && <>
        <div className="flex gap-1 mb-2 overflow-x-auto text-[11px]">{[["pending", "รอตรวจสอบ"], ["paid", "ชำระแล้ว"], ["failed", "ปฏิเสธ"], ["refunded", "คืนเงิน"], ["all", "ทั้งหมด"]].map(([k, l]) => <button key={k} onClick={() => { setOrders(null); setFilter(k); }} className={`px-2.5 py-1 rounded-full shrink-0 ${filter === k ? "bg-[#1A1D29] text-white" : "bg-white text-[#6B7280] border border-[#E8EAF0]"}`}>{l}</button>)}</div>
        {orders === null ? <p className="text-xs text-[#9199A8]">กำลังโหลด...</p> : orders.length === 0 ? <p className="text-xs text-[#9199A8] py-4 text-center">ไม่มีรายการ</p> :
          <div className="space-y-2">{orders.map(o => (
            <div key={o.id} className="bg-white border border-[#E8EAF0] rounded-xl p-3 text-xs space-y-1.5">
              <div className="flex items-center justify-between gap-2"><p className="font-medium text-[#1A1D29] truncate">{o.username || "ผู้ใช้"} · {o.credits} เครดิต · {baht(o.amount_thb)}</p><Badge s={o.status} /></div>
              <p className="text-[#9199A8] break-all">{o.ref} · {o.provider} · สั่ง {when(o.created_at)}{o.notified_at ? ` · แจ้งโอน ${when(o.notified_at)}` : o.status === "pending" ? " · ยังไม่แจ้งโอน" : ""}{o.paid_at ? ` · ชำระ ${when(o.paid_at)}` : ""}</p>
              {o.note && <p className="text-[#6B7280]">หมายเหตุ: {o.note}</p>}
              {o.status === "pending" && <div className="flex gap-2 pt-1">
                <button disabled={busy} onClick={() => act("admin_confirm_order", o, "ยืนยันแล้ว เติมเครดิตให้ผู้ซื้อ", `ยืนยันว่าได้รับเงิน ${baht(o.amount_thb)} แล้ว และเติม ${o.credits} เครดิต?`)} className="flex-1 bg-[#0E8F5A] text-white rounded-full py-1.5">ยืนยันรับเงิน</button>
                <button disabled={busy} onClick={() => act("admin_reject_order", o, "ปฏิเสธแล้ว", "ปฏิเสธรายการนี้?")} className="flex-1 border border-[#EF4565] text-[#EF4565] rounded-full py-1.5">ปฏิเสธ</button></div>}
              {o.status === "paid" && <button disabled={busy} onClick={() => act("admin_refund_order", o, "คืนเงินแล้ว หักเครดิตคืน", `คืนเงินและหัก ${o.credits} เครดิตจากผู้ใช้? (ต้องโอนเงินคืนเองนอกระบบ)`)} className="text-[#C0243F] underline pt-1">คืนเงิน/หักเครดิต</button>}
            </div>))}</div>}
      </>}

      {tab === "packages" && (pk === null ? <p className="text-xs text-[#9199A8]">กำลังโหลด...</p> : <PackageEditor pk={pk} onSave={savePk} />)}

      {tab === "settings" && cfg && <SettingsForm cfg={cfg} onSave={setSetting} />}
    </Shell>
  );
}

function PackageEditor({ pk, onSave }) {
  const [rows, setRows] = useState(pk);
  useEffect(() => setRows(pk), [pk]);
  const [nw, setNw] = useState({ id: "", credits: "", price_thb: "", active: true });
  const upd = (i, k, v) => setRows(r => r.map((x, j) => j === i ? { ...x, [k]: v } : x));
  const inp = "min-w-0 border border-[#E8EAF0] rounded-lg px-2 py-1 text-sm";
  return (
    <div className="space-y-2">
      {rows.map((p, i) => (
        <div key={p.id} className="bg-white border border-[#E8EAF0] rounded-xl p-3 flex flex-wrap items-center gap-2 text-xs">
          <b className="w-14 shrink-0 truncate">{p.id}</b>
          <input aria-label="เครดิต" type="number" value={p.credits} onChange={e => upd(i, "credits", e.target.value)} className={inp + " w-20"} />
          <span>เครดิต</span>
          <input aria-label="ราคา" type="number" value={p.price_thb} onChange={e => upd(i, "price_thb", e.target.value)} className={inp + " w-20"} /><span>บาท</span>
          <label className="flex items-center gap-1"><input type="checkbox" checked={!!p.active} onChange={e => upd(i, "active", e.target.checked)} />เปิดขาย</label>
          <button onClick={() => onSave(p)} className="ml-auto bg-[#6C5CE7] text-white rounded-full px-3 py-1">บันทึก</button>
        </div>))}
      <div className="bg-white border border-dashed border-[#C9CDE0] rounded-xl p-3 space-y-2 text-xs">
        <p className="font-medium">เพิ่มแพ็กเกจ</p>
        <div className="flex flex-wrap gap-2 items-center">
          <input placeholder="รหัส เช่น p100" value={nw.id} onChange={e => setNw({ ...nw, id: e.target.value.toLowerCase() })} className={inp + " w-24"} />
          <input placeholder="เครดิต" type="number" value={nw.credits} onChange={e => setNw({ ...nw, credits: e.target.value })} className={inp + " w-20"} />
          <input placeholder="ราคา(บาท)" type="number" value={nw.price_thb} onChange={e => setNw({ ...nw, price_thb: e.target.value })} className={inp + " w-24"} />
          <button disabled={!nw.id || !nw.credits || !nw.price_thb} onClick={() => { onSave(nw); setNw({ id: "", credits: "", price_thb: "", active: true }); }} className="ml-auto bg-[#1A1D29] text-white rounded-full px-3 py-1 disabled:opacity-40">เพิ่ม</button>
        </div>
        <p className="text-[#9199A8]">ราคาเป็นการตัดสินใจของเจ้าของ แพ็กเกจจะแสดงให้ผู้ใช้เมื่อเปิดขาย และเปิดโหมดรับชำระในแท็บตั้งค่า</p>
      </div>
    </div>
  );
}

function SettingsForm({ cfg, onSave }) {
  const [f, setF] = useState({ promptpay_id: cfg.promptpay_id || "", promptpay_name: cfg.promptpay_name || "", payment_note: cfg.note || "" });
  const inp = "w-full min-w-0 border border-[#E8EAF0] rounded-lg px-3 py-2 text-sm";
  return (
    <div className="space-y-3 text-xs bg-white border border-[#E8EAF0] rounded-xl p-3">
      <div><p className="mb-1 font-medium">โหมดรับชำระเงิน</p>
        <div className="flex gap-1">{[["off", "ปิด"], ["manual", "โอนพร้อมเพย์ (ยืนยันเอง)"]].map(([k, l]) => <button key={k} onClick={() => onSave("payments_mode", k)} className={`px-3 py-1.5 rounded-full ${cfg.mode === k ? "bg-[#6C5CE7] text-white" : "border border-[#E8EAF0] text-[#6B7280]"}`}>{l}</button>)}</div>
        <p className="text-[#9199A8] mt-1">ปุ่มซื้อเครดิตในแอปจะใช้งานได้เมื่อเปิดโหมดโอนพร้อมเพย์ และมีแพ็กเกจเปิดขาย</p></div>
      <div><p className="mb-1 font-medium">เลขพร้อมเพย์ (เบอร์/เลขบัตร/เลขนิติบุคคล)</p><input value={f.promptpay_id} onChange={e => setF({ ...f, promptpay_id: e.target.value })} className={inp} /></div>
      <div><p className="mb-1 font-medium">ชื่อบัญชีที่แสดงให้ผู้โอนตรวจสอบ</p><input value={f.promptpay_name} onChange={e => setF({ ...f, promptpay_name: e.target.value })} className={inp} /></div>
      <div><p className="mb-1 font-medium">ข้อความแจ้งผู้ซื้อ (ไม่บังคับ)</p><textarea rows={3} value={f.payment_note} onChange={e => setF({ ...f, payment_note: e.target.value })} className={inp} /></div>
      <button onClick={() => { onSave("promptpay_id", f.promptpay_id); onSave("promptpay_name", f.promptpay_name); onSave("payment_note", f.payment_note); }} className="w-full bg-[#6C5CE7] text-white rounded-full py-2">บันทึกการตั้งค่า</button>
    </div>
  );
}
