import { useState, useEffect } from "react";
import { X, Share, MoreVertical, Copy, Check, BookOpen, Download, MapPin } from "lucide-react";

const isIOSDev = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const isAndroidDev = () => /android/i.test(navigator.userAgent);
const appUrl = () => { try { return location.origin + location.pathname; } catch { return ""; } };

function Overlay({ label, onClose, dark, children }) {
  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto" style={{ background: dark ? "#0B1020" : "#F3F5FA", color: dark ? "#F1F3FA" : "#1A1D29" }} role="dialog" aria-label={label}>
      <div className="max-w-xl mx-auto px-5 pt-5 pb-16">
        <div className="flex items-center justify-between mb-4">
          <h2 style={{ fontFamily: "'Kanit', sans-serif" }} className="text-xl font-semibold">{label}</h2>
          <button onClick={onClose} aria-label="ปิด" className="w-11 h-11 rounded-full flex items-center justify-center" style={{ background: dark ? "#151C33" : "#fff" }}><X size={20} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

const Step = ({ n, children }) => (
  <li className="flex gap-3 items-start">
    <span className="w-7 h-7 shrink-0 rounded-full bg-[#6C5CE7] text-white text-sm font-semibold flex items-center justify-center">{n}</span>
    <p className="text-sm pt-0.5 leading-relaxed">{children}</p>
  </li>
);

// วิธีติดตั้งแอปลงหน้าจอ (PWA) แยก iPhone / Android / คอมพิวเตอร์ + วิธีเปิดสิทธิ์ตำแหน่ง
export function InstallGuide({ onClose }) {
  const [tab, setTab] = useState(isIOSDev() ? "ios" : isAndroidDev() ? "android" : "pc");
  const [copied, setCopied] = useState(false);
  const url = appUrl();
  const copy = async () => { try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* ไม่เป็นไร */ } };
  const TABS = [["ios", "iPhone / iPad"], ["android", "Android"], ["pc", "คอมพิวเตอร์"]];
  return (
    <Overlay label="วิธีติดตั้งแอป" onClose={onClose}>
      <div className="bg-white rounded-2xl p-4 shadow-sm">
        <p className="text-sm">ปักหมุดไม่ต้องโหลดจากสโตร์ เปิดลิงก์แล้ว "เพิ่มลงหน้าจอ" ใช้ได้เหมือนแอปทั่วไป ฟรี และไม่กินพื้นที่เครื่อง</p>
        <div className="mt-3 flex items-center gap-2 bg-[#F3F5FA] rounded-xl px-3 py-2">
          <span className="flex-1 text-xs break-all text-[#6C5CE7]" data-testid="guide-url">{url}</span>
          <button onClick={copy} className="shrink-0 text-xs font-medium bg-[#6C5CE7] text-white rounded-full px-3 py-1.5 flex items-center gap-1">{copied ? <Check size={13} /> : <Copy size={13} />}{copied ? "คัดลอกแล้ว" : "คัดลอกลิงก์"}</button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2" role="tablist">
        {TABS.map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`text-sm py-2.5 rounded-xl font-medium ${tab === k ? "bg-[#6C5CE7] text-white" : "bg-white text-[#6B7280]"}`}>{l}</button>
        ))}
      </div>

      <div className="mt-3 bg-white rounded-2xl p-4 shadow-sm" data-testid={`guide-${tab}`}>
        {tab === "ios" && (
          <>
            <p className="text-xs text-[#C43D3D] bg-[#FDECEC] rounded-lg px-3 py-2 mb-3">ต้องใช้ Safari เท่านั้น ถ้าเปิดลิงก์จาก LINE, Facebook หรือ Instagram ให้กดเมนู แล้วเลือก "เปิดใน Safari" ก่อน</p>
            <ol className="space-y-3">
              <Step n={1}>เปิดลิงก์ปักหมุดใน <b>Safari</b></Step>
              <Step n={2}>กดปุ่มแชร์ <Share size={14} className="inline -mt-0.5" /> (สี่เหลี่ยมมีลูกศรชี้ขึ้น) ที่แถบด้านล่างของหน้าจอ (บน iPad อยู่มุมขวาบน)</Step>
              <Step n={3}>เลื่อนรายการลง แล้วเลือก <b>"เพิ่มไปยังหน้าจอโฮม"</b></Step>
              <Step n={4}>กด <b>"เพิ่ม"</b> มุมขวาบน จะมีไอคอนปักหมุดโผล่บนหน้าจอ</Step>
              <Step n={5}>ต่อไปเปิดจากไอคอนนั้น ไม่ต้องเปิดผ่าน Safari อีก</Step>
            </ol>
            <p className="text-xs text-[#6B7280] mt-3">ไม่เห็นตัวเลือก "เพิ่มไปยังหน้าจอโฮม"? เลื่อนลงให้สุดรายการแล้วกด "แก้ไขการดำเนินการ" เพื่อเพิ่มเข้ามา</p>
          </>
        )}
        {tab === "android" && (
          <>
            <p className="text-xs text-[#C43D3D] bg-[#FDECEC] rounded-lg px-3 py-2 mb-3">ใช้ Chrome จะง่ายที่สุด ถ้าเปิดจาก LINE หรือ Facebook ให้กดจุดสามจุด แล้วเลือก "เปิดในเบราว์เซอร์" ก่อน</p>
            <ol className="space-y-3">
              <Step n={1}>เปิดลิงก์ปักหมุดใน <b>Chrome</b></Step>
              <Step n={2}>ถ้ามีแถบ "ติดตั้ง ปักหมุด" ด้านล่าง กด <b>ติดตั้ง</b> ได้เลย</Step>
              <Step n={3}>ถ้าไม่เห็นแถบ กดเมนู <MoreVertical size={14} className="inline -mt-0.5" /> (จุดสามจุดมุมขวาบน) แล้วเลือก <b>"ติดตั้งแอป"</b> หรือ <b>"เพิ่มลงในหน้าจอหลัก"</b></Step>
              <Step n={4}>กด <b>"ติดตั้ง"</b> ยืนยัน ไอคอนจะอยู่ในหน้าจอหลักและลิ้นชักแอป</Step>
            </ol>
            <p className="text-xs text-[#6B7280] mt-3">เบราว์เซอร์อื่น (Samsung Internet, Edge) ใช้เมนูเดียวกัน เลือก "เพิ่มหน้าลงใน" แล้วเลือกหน้าจอหลัก</p>
          </>
        )}
        {tab === "pc" && (
          <ol className="space-y-3">
            <Step n={1}>เปิดลิงก์ใน <b>Chrome</b> หรือ <b>Edge</b></Step>
            <Step n={2}>มองหาไอคอนติดตั้ง <Download size={14} className="inline -mt-0.5" /> ที่ท้ายแถบที่อยู่เว็บ แล้วกดติดตั้ง</Step>
            <Step n={3}>แอปจะเปิดเป็นหน้าต่างของตัวเองและมีทางลัดบนเครื่อง</Step>
          </ol>
        )}
      </div>

      <div className="mt-3 bg-white rounded-2xl p-4 shadow-sm">
        <h3 style={{ fontFamily: "'Kanit', sans-serif" }} className="font-semibold flex items-center gap-2"><MapPin size={16} className="text-[#6C5CE7]" />เปิดตำแหน่งให้เช็คอินได้</h3>
        <p className="text-xs text-[#6B7280] mt-1">เช็คอินต้องรู้ตำแหน่งจริงของคุณ (ในรัศมี 150 เมตร) ตอนกดเช็คอินครั้งแรก ให้เลือก "อนุญาต"</p>
        <ul className="mt-2 text-xs space-y-1.5 list-disc pl-5">
          <li><b>iPhone:</b> ตั้งค่า &gt; ความเป็นส่วนตัวและความปลอดภัย &gt; บริการหาตำแหน่ง &gt; เปิด แล้วเลือก Safari (หรือ ปักหมุด) เป็น "ขณะใช้แอป" และเปิด "ตำแหน่งที่แน่นอน"</li>
          <li><b>Android:</b> ตั้งค่า &gt; ตำแหน่ง &gt; เปิด แล้วในสิทธิ์ของ Chrome เลือก "อนุญาตเฉพาะขณะใช้แอป" และเปิด "ใช้ตำแหน่งที่แม่นยำ"</li>
        </ul>
      </div>
    </Overlay>
  );
}

// ตัวอ่านนิยาย "ผู้กล้าผู้ปักหมุด" 60 ตอน (โหลดเนื้อเรื่องแยกชิ้นเมื่อเปิดอ่าน)
const LAST_KEY = "feedth:story-last";
const getLast = () => { try { const n = parseInt(localStorage.getItem(LAST_KEY), 10); return Number.isFinite(n) ? n : null; } catch { return null; } };
const setLast = (n) => { try { localStorage.setItem(LAST_KEY, String(n)); } catch { /* ไม่เป็นไร */ } };

export function StoryReader({ onClose }) {
  const [mod, setMod] = useState(null);
  const [err, setErr] = useState(false);
  const [idx, setIdx] = useState(null);
  const G = "#FFC24B";
  useEffect(() => { import("./story.js").then(setMod).catch(() => setErr(true)); }, []);
  const title = mod?.STORY_TITLE || "ผู้กล้าผู้ปักหมุด";
  if (err) return <Overlay label={title} onClose={onClose} dark><p className="text-sm" style={{ color: "#A3ABC4" }}>โหลดนิยายไม่สำเร็จ ลองใหม่อีกครั้งเมื่อออนไลน์</p></Overlay>;
  if (!mod) return <Overlay label={title} onClose={onClose} dark><p className="text-sm" style={{ color: "#A3ABC4" }}>กำลังโหลดนิยาย...</p></Overlay>;
  const { STORY, PARTS, STORY_SUB } = mod;
  const open = (n) => { setIdx(n); setLast(n); window.scrollTo?.(0, 0); };
  if (idx === null) {
    const last = getLast();
    let base = 0;
    return (
      <Overlay label={title} onClose={onClose} dark>
        <p className="text-sm" style={{ color: "#A3ABC4" }}>{STORY_SUB}</p>
        {last !== null && last >= 0 && last < STORY.length && (
          <button onClick={() => open(last)} data-testid="story-resume" className="mt-4 w-full rounded-2xl p-3.5 text-left font-semibold text-sm" style={{ background: G, color: "#1A1305" }}>อ่านต่อ · {STORY[last].t}</button>
        )}
        <div data-testid="story-toc">
          {PARTS.map((p, pi) => {
            const start = base; base += p.eps.length;
            return (
              <section key={pi} className="mt-6">
                <h3 style={{ fontFamily: "'Kanit', sans-serif", color: G }} className="text-lg font-semibold">{p.t}</h3>
                <p className="text-xs mb-2" style={{ color: "#A3ABC4" }}>{p.d}</p>
                <ol className="space-y-2">
                  {p.eps.map((c, i) => (
                    <li key={start + i}>
                      <button onClick={() => open(start + i)} className="w-full text-left rounded-xl px-4 py-3 flex items-center gap-3" style={{ background: "#151C33" }}>
                        <span className="w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-xs font-semibold" style={{ border: `1.5px solid ${G}`, color: G }}>{start + i + 1}</span>
                        <span className="font-medium text-[14px]">{c.t.replace(/^ตอนที่ \d+ · /, "")}</span>
                      </button>
                    </li>
                  ))}
                </ol>
              </section>
            );
          })}
        </div>
      </Overlay>
    );
  }
  const c = STORY[idx];
  const go = (n) => { open(n); setTimeout(() => document.querySelector("[data-story-top]")?.scrollIntoView?.(), 0); };
  return (
    <Overlay label={title} onClose={onClose} dark>
      <div data-story-top />
      <button onClick={() => setIdx(null)} className="text-[13px] underline flex items-center gap-1 mb-3" style={{ color: "#B7ABFF" }}><BookOpen size={14} />สารบัญ</button>
      <article data-testid="story-chapter">
        <h3 style={{ fontFamily: "'Kanit', sans-serif", color: G }} className="text-2xl font-semibold leading-snug">{c.t}</h3>
        <div className="mt-4 space-y-4 text-[16px] leading-[1.9]" style={{ color: "#E4E8F5" }}>
          {c.body.split("\n\n").map((p, i) => <p key={i}>{p}</p>)}
        </div>
      </article>
      <div className="mt-8 flex gap-3">
        <button disabled={idx === 0} onClick={() => go(idx - 1)} className="flex-1 py-3 rounded-2xl text-sm font-medium disabled:opacity-30" style={{ background: "#151C33" }}>ตอนก่อนหน้า</button>
        {idx < STORY.length - 1
          ? <button onClick={() => go(idx + 1)} className="flex-1 py-3 rounded-2xl text-sm font-semibold" style={{ background: G, color: "#1A1305" }}>ตอนต่อไป</button>
          : <button onClick={onClose} className="flex-1 py-3 rounded-2xl text-sm font-semibold" style={{ background: G, color: "#1A1305" }}>ไปปักหมุดแรกของคุณ</button>}
      </div>
      <p className="text-center text-xs mt-4" style={{ color: "#8791AE" }}>{idx + 1} / {STORY.length}</p>
    </Overlay>
  );
}
