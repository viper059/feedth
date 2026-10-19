import { useState, useEffect } from "react";
import { MapPin, Flame, Zap, Lock, Check, Compass, ChevronRight, X } from "lucide-react";

const CHAPTERS = [
  { t: "หมุดแรก", d: "ปักหมุดแรกของคุณลงบนโลก", unit: "หมุด" },
  { t: "หมู่บ้านแรก", d: "เช็คอินในพื้นที่หมู่บ้านให้ปลดล็อกหมู่บ้านแรก", unit: "หมู่บ้าน" },
  { t: "ตำบลของฉัน", d: "ปักหมุด 10 แห่งในตำบลเดียวกันเพื่อพิชิตตำบล", unit: "หมุด" },
  { t: "อำเภอ", d: "พิชิต 5 ตำบลในอำเภอเดียวกัน (หรือครบทุกตำบลถ้ามีน้อยกว่า 5)", unit: "ตำบล" },
  { t: "จังหวัด", d: "พิชิต 3 อำเภอในจังหวัดเดียวกัน", unit: "อำเภอ" },
  { t: "ห้าจังหวัด", d: "พิชิตจังหวัดให้ครบ 5 จังหวัด", unit: "จังหวัด" },
  { t: "ทุกภูมิภาค", d: "มีจังหวัดที่พิชิตแล้วในทั้ง 6 ภูมิภาค", unit: "ภูมิภาค" },
  { t: "สามประเทศ", d: "ปักหมุดใน 3 ประเทศ", unit: "ประเทศ" },
  { t: "ทั่วโลก", d: "ปักหมุดครบทุกทวีป", unit: "ทวีป" },
];
const G = "#FFC24B";

export default function ConquestTab({ rest, onCheckin, onMap, showToast }) {
  const [data, setData] = useState(null);
  const [me, setMe] = useState(null);
  const [sheet, setSheet] = useState(false);
  useEffect(() => {
    rest("/rest/v1/rpc/conquest_progress", { method: "POST", body: {} }).then(setData).catch(e => { showToast("โหลดความคืบหน้าไม่สำเร็จ: " + e.message); setData({ pins: 0, chapters: [] }); });
    rest("/rest/v1/rpc/my_explore", { method: "POST", body: {} }).then(setMe).catch(() => setMe({}));
  }, []);
  const ch = data?.chapters || [];
  const done = c => c && c.cur >= c.tgt;
  const curIdx = ch.findIndex(c => !done(c));
  const active = curIdx === -1 ? Math.max(ch.length - 1, 0) : curIdx;
  const a = ch[active] || (data ? { cur: 0, tgt: 1 } : null);
  const pct = a ? Math.round((a.cur / a.tgt) * 100) : 0;

  return (
    <div style={{ fontFamily: "'IBM Plex Sans Thai', sans-serif", background: "#0B1020", color: "#F1F3FA" }} className="min-h-screen pb-24">
      <header className="max-w-xl mx-auto flex items-center justify-between px-5 pt-5">
        <h1 style={{ fontFamily: "'Kanit', sans-serif" }} className="text-xl font-semibold" >พิชิตโลก</h1>
        <div className="flex gap-2">
          <span className="flex items-center gap-1 rounded-full px-2.5 py-1.5 text-[13px] font-semibold" style={{ background: "#151C33" }}><Flame size={15} color="#FF8A4B" />{me?.streak?.current ?? 0} วัน</span>
          <span className="flex items-center gap-1 rounded-full px-2.5 py-1.5 text-[13px] font-semibold" style={{ background: "#151C33" }}><Zap size={15} color={G} />{me?.score ?? 0}</span>
        </div>
      </header>
      <main className="max-w-xl mx-auto px-5">
        <p className="mt-6 text-xs tracking-wide" style={{ color: "#A3ABC4" }}>ดินแดนที่พิชิตแล้ว</p>
        <div className="flex items-baseline gap-2">
          <span style={{ fontFamily: "'Kanit', sans-serif", color: G }} className="text-6xl font-semibold leading-none">{data ? data.pins : "–"}</span>
          <span style={{ fontFamily: "'Kanit', sans-serif" }} className="text-2xl">หมุด</span>
        </div>
        <p className="text-[13px] mt-1.5" style={{ color: "#A3ABC4" }}>{data && data.pins === 0 ? "โลกทั้งใบยังเป็นความมืด รอให้คุณไปปักหมุด" : `พิชิตตำบลแล้ว ${data?.tambons_done ?? 0} · หมู่บ้าน ${data?.villages ?? 0}`}</p>

        {a && (
          <section className="mt-5 rounded-3xl p-5" style={{ background: "#151C33" }}>
            <div className="flex justify-between text-xs"><span style={{ color: G }} className="font-semibold">บทที่ {active + 1} จาก 9</span>{curIdx === -1 && <span style={{ color: G }}>ครบทุกบทแล้ว!</span>}</div>
            <h2 style={{ fontFamily: "'Kanit', sans-serif" }} className="text-xl font-semibold mt-0.5">{CHAPTERS[active].t}{a.place ? ` · ${a.place}` : ""}</h2>
            <div className="flex items-center gap-3 mt-3">
              <div className="flex-1 h-2.5 rounded-full overflow-hidden" style={{ background: "#0B1020" }}><div style={{ width: `${pct}%`, background: G }} className="h-full rounded-full transition-all" /></div>
              <span className="text-[13px] font-semibold">{a.cur} / {a.tgt}</span>
            </div>
            <p className="text-xs mt-1.5" style={{ color: "#A3ABC4" }}>{CHAPTERS[active].d}</p>
            <button onClick={onCheckin} className="mt-4 w-full min-h-[52px] rounded-2xl flex items-center justify-center gap-2 text-lg font-semibold" style={{ background: G, color: "#1A1305", fontFamily: "'Kanit', sans-serif" }}><MapPin size={21} />ปักหมุดที่นี่</button>
            <div className="flex justify-between mt-3">
              <button onClick={() => setSheet(true)} className="text-[13px] underline" style={{ color: "#B7ABFF" }}>ดูเส้นทางพิชิตทั้ง 9 บท</button>
              <button onClick={onMap} className="text-[13px] underline flex items-center gap-1" style={{ color: "#B7ABFF" }}><Compass size={14} />แผนที่สำรวจ</button>
            </div>
          </section>
        )}
        {!data && <p className="text-center text-xs py-8" style={{ color: "#A3ABC4" }}>กำลังโหลด...</p>}
      </main>

      {sheet && (
        <div className="fixed inset-0 z-50 overflow-y-auto" style={{ background: "#0B1020" }} role="dialog" aria-label="เส้นทางพิชิต 9 บท">
          <div className="max-w-xl mx-auto px-5 pt-5 pb-10">
            <div className="flex items-center justify-between">
              <h2 style={{ fontFamily: "'Kanit', sans-serif" }} className="text-xl font-semibold">เส้นทางพิชิต 9 บท</h2>
              <button onClick={() => setSheet(false)} aria-label="ปิด" className="w-11 h-11 rounded-full flex items-center justify-center" style={{ background: "#151C33" }}><X size={20} /></button>
            </div>
            <ol className="mt-5 space-y-3">
              {CHAPTERS.map((c, i) => {
                const p = ch[i] || { cur: 0, tgt: 1 };
                const ok = p.cur >= p.tgt, locked = i > active;
                return (
                  <li key={i} className="rounded-2xl p-4 flex items-center gap-3" style={{ background: i === active ? "#1D2744" : "#151C33", border: i === active ? `1.5px solid ${G}` : "1.5px solid transparent", opacity: locked ? 0.7 : 1 }}>
                    <div className="w-10 h-10 shrink-0 rounded-full flex items-center justify-center font-semibold" style={{ background: ok ? G : "#0B1020", color: ok ? "#1A1305" : locked ? "#8791AE" : G, border: ok ? "none" : "1.5px solid #3A4772" }}>{ok ? <Check size={20} /> : locked ? <Lock size={16} /> : i + 1}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px]" style={{ color: G }}>บทที่ {i + 1}</p>
                      <p className="font-semibold text-[15px]">{c.t}</p>
                      <p className="text-xs" style={{ color: "#A3ABC4" }}>{c.d}</p>
                      {!locked && !ok && <div className="flex items-center gap-2 mt-2"><div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "#0B1020" }}><div className="h-full" style={{ width: `${(p.cur / p.tgt) * 100}%`, background: G }} /></div><span className="text-[11px]" style={{ color: "#A3ABC4" }}>{p.cur}/{p.tgt} {c.unit}</span></div>}
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}
