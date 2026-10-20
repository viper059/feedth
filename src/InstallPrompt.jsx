import { useState, useEffect } from "react";
import { Download, Share, X } from "lucide-react";

const KEY = "feedth:install-dismissed";
const safeGet = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
const safeSet = () => { try { localStorage.setItem(KEY, String(Date.now())); } catch { /* ไม่เป็นไร */ } };
const isStandalone = () => window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

// แถบชวนติดตั้งแอป: Android/Chrome มีปุ่มติดตั้งจริง (beforeinstallprompt), iPhone แสดงวิธีเพิ่มลงหน้าจอโฮม
export default function InstallPrompt() {
  const [evt, setEvt] = useState(null);
  const [hidden, setHidden] = useState(() => isStandalone() || !!safeGet());
  const [showIos, setShowIos] = useState(false);
  useEffect(() => {
    const onPrompt = (e) => { e.preventDefault(); setEvt(e); };
    const onInstalled = () => { setHidden(true); setEvt(null); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => { window.removeEventListener("beforeinstallprompt", onPrompt); window.removeEventListener("appinstalled", onInstalled); };
  }, []);
  const ios = isIOS();
  if (hidden || (!evt && !ios)) return null;
  const dismiss = () => { safeSet(); setHidden(true); };
  const install = async () => {
    if (evt) { evt.prompt(); try { await evt.userChoice; } catch { /* ignore */ } setEvt(null); setHidden(true); }
    else setShowIos(v => !v);
  };
  return (
    <div className="bg-white rounded-2xl border border-[#6C5CE7]/30 p-3 shadow-sm" data-testid="install-banner">
      <div className="flex items-center gap-3">
        <img src="./icon-192.png" alt="" className="w-10 h-10 rounded-xl" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">ติดตั้ง ปักหมุด ลงหน้าจอ</p>
          <p className="text-xs text-[#6B7280]">เปิดไวเหมือนแอป ไม่ต้องเข้าผ่านเบราว์เซอร์</p>
        </div>
        <button onClick={install} className="bg-[#6C5CE7] text-white text-sm font-medium px-3.5 py-2 rounded-full flex items-center gap-1.5 shrink-0"><Download size={15} />ติดตั้ง</button>
        <button onClick={dismiss} aria-label="ปิดแถบติดตั้ง" className="text-[#9199A8] p-1 shrink-0"><X size={16} /></button>
      </div>
      {showIos && (
        <ol className="mt-3 text-xs text-[#1A1D29] space-y-1 list-decimal pl-5" data-testid="ios-steps">
          <li>เปิดหน้านี้ใน Safari (ไม่ใช่ในแอป Line/Facebook)</li>
          <li>กดปุ่มแชร์ <Share size={12} className="inline -mt-0.5" /> ที่แถบด้านล่าง</li>
          <li>เลื่อนลงแล้วเลือก "เพิ่มไปยังหน้าจอโฮม"</li>
          <li>กด "เพิ่ม" มุมขวาบน</li>
        </ol>
      )}
    </div>
  );
}
