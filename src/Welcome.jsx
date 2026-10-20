import { useState } from "react";
import { MapPin, Trophy, Users, X } from "lucide-react";

const KEY = "feedth:welcome-dismissed";
const safeGet = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
const safeSet = () => { try { localStorage.setItem(KEY, "1"); } catch { /* ไม่เป็นไร */ } };

const STEPS = [
  { Icon: MapPin, t: "เช็คอิน", d: "ไปถึงสถานที่จริง (ในรัศมี 150 เมตร) แล้วกดเช็คอิน จะแนบรูปและเขียนรีวิวด้วยก็ได้" },
  { Icon: Trophy, t: "พิชิตพื้นที่", d: "ทุกหมุดทำให้แผนที่สว่างขึ้น จากหมู่บ้าน ตำบล อำเภอ ไปจนถึงทั้งโลก ดูเส้นทาง 9 บทได้ที่แท็บ \"พิชิต\"" },
  { Icon: Users, t: "ชวนเพื่อนและครอบครัว", d: "ติดตามเพื่อน แข่งอันดับ หรือสร้างครอบครัวเพื่อทำเควสร่วมกัน" },
];

// ข้อความแนะนำสั้นๆ บนหน้าล็อกอิน/สมัคร (เห็นก่อนเข้าแอป)
export function AppIntro() {
  return (
    <div className="w-full max-w-sm mb-4 text-center" data-testid="app-intro">
      <h2 style={{ fontFamily: "'Kanit', sans-serif" }} className="text-2xl font-semibold text-[#1A1D29] leading-snug">เช็คอินทั่วไทย<br />สะสมหมุด พิชิตโลก</h2>
      <p className="text-sm text-[#6B7280] mt-2">feedTH คือโซเชียลเช็คอินท่องเที่ยว ปักหมุดที่ที่คุณไปจริง ปลดล็อกแผนที่ แบ่งปันกับเพื่อน</p>
      <ul className="mt-3 flex justify-center gap-2 text-[11px] text-[#6C5CE7] font-medium">
        <li className="bg-white rounded-full px-3 py-1 border border-[#6C5CE7]/20">เช็คอิน</li>
        <li className="bg-white rounded-full px-3 py-1 border border-[#6C5CE7]/20">พิชิตแผนที่</li>
        <li className="bg-white rounded-full px-3 py-1 border border-[#6C5CE7]/20">เพื่อน & ครอบครัว</li>
      </ul>
    </div>
  );
}

// การ์ดต้อนรับบนฟีด: วิธีเล่นใน 3 ขั้น ปิดได้และจำไว้
export default function WelcomeCard() {
  const [hidden, setHidden] = useState(() => !!safeGet());
  if (hidden) return null;
  return (
    <section className="bg-white rounded-2xl border border-[#6C5CE7]/25 p-4 shadow-sm" data-testid="welcome-card" aria-label="วิธีใช้ feedTH">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 style={{ fontFamily: "'Kanit', sans-serif" }} className="font-semibold text-[#6C5CE7]">ยินดีต้อนรับสู่ feedTH</h2>
          <p className="text-xs text-[#6B7280]">เล่นง่ายๆ ใน 3 ขั้น</p>
        </div>
        <button onClick={() => { safeSet(); setHidden(true); }} aria-label="ปิดคำแนะนำ" className="text-[#9199A8] p-1 -mt-1 -mr-1"><X size={16} /></button>
      </div>
      <ol className="mt-3 space-y-3">
        {STEPS.map(({ Icon, t, d }, i) => (
          <li key={t} className="flex gap-3">
            <span className="w-9 h-9 shrink-0 rounded-full bg-[#6C5CE7]/10 text-[#6C5CE7] flex items-center justify-center"><Icon size={18} /></span>
            <div className="min-w-0"><p className="text-sm font-semibold">{i + 1}. {t}</p><p className="text-xs text-[#6B7280]">{d}</p></div>
          </li>
        ))}
      </ol>
      <button onClick={() => { safeSet(); setHidden(true); }} className="mt-3 w-full bg-[#6C5CE7] text-white text-sm font-medium py-2.5 rounded-full">เข้าใจแล้ว เริ่มเลย</button>
    </section>
  );
}
