import { useState, useEffect, useCallback, useRef } from "react";
import FogMapPanel from "./FogMap.jsx";
import { BuyCredits, AdminPanel } from "./Shop.jsx";
import { locateAt, LEVELS, REGION_TH, CONTINENT_TH, COUNTRY_TH } from "./geo.js";
import {
  Heart, MessageCircle, Zap, Wallet, Send, X, Sparkles,
  Share2, Trash2, Flag, Bell, ImagePlus, UserPlus, UserCheck, Crown, Trophy, Loader2, LogOut, MapPin, ArrowLeft, Home, User, Medal, Compass, Shield,
} from "lucide-react";

// ==========================================================
// 1) ใส่ค่าจาก Supabase Project Settings > API ตรงนี้
// ==========================================================
// ค่าสาธารณะของโปรเจกต์ (URL + anon key ออกแบบให้เปิดเผยในเว็บได้ ความปลอดภัยอยู่ที่ RLS/ฟังก์ชันฝั่งฐานข้อมูล)
// ใช้ค่าจาก GitHub Secrets ถ้าถูกต้อง ถ้าว่าง/ผิดรูปแบบ (เช่นมีช่องว่าง ไม่ใช่ https) จะใช้ค่าสำรองนี้แทน
const DEFAULT_SUPABASE_URL = "https://qozkybfaayjsmzrwxtyb.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFvemt5YmZhYXlqc216cnd4dHliIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE5NzkxMTEsImV4cCI6MjEwNzU1NTExMX0.eMbY-_MF4akPyl0gjTGgfurlgbDmxBkq6-8iVfOlgSU";
const envUrl = String(import.meta.env.VITE_SUPABASE_URL || "").trim().replace(/\/+$/, "");
const envKey = String(import.meta.env.VITE_SUPABASE_ANON_KEY || "").trim();
const SUPABASE_URL = /^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(envUrl) ? envUrl : DEFAULT_SUPABASE_URL;
const SUPABASE_ANON_KEY = /^eyJ[\w-]+\.[\w-]+\.[\w-]+$/.test(envKey) ? envKey : DEFAULT_SUPABASE_ANON_KEY;

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

// ย่อรูปก่อนอัปโหลด (ด้านยาวสุด 1280px, JPEG) ให้เบาและกันรูปใหญ่เกินโควตา
async function compressImage(file) {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error("ใช้ได้เฉพาะรูป JPG, PNG หรือ WebP");
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, 1280 / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(bmp.width * k)); c.height = Math.max(1, Math.round(bmp.height * k));
  c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
  const blob = await new Promise(res => c.toBlob(res, "image/jpeg", 0.82));
  if (!blob) throw new Error("ย่อรูปไม่สำเร็จ");
  return blob;
}
const IMG_PUBLIC = (path) => `${SUPABASE_URL}/storage/v1/object/public/post-images/${path}`;

function timeAgo(iso) {
  const mins = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "เมื่อสักครู่";
  if (mins < 60) return `${mins} นาทีที่แล้ว`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h} ชม.ที่แล้ว`;
  return `${Math.floor(h / 24)} วันที่แล้ว`;
}

const configured = true;

const TOPIC_KEYWORDS = {
  van_custom: ["รถตู้", "แต่งรถ", "ช่วงล่าง", "พ่นสี"],
  food: ["กิน", "อร่อย", "ร้านอาหาร", "ก๋วยเตี๋ยว", "หมูปิ้ง"],
  cafe: ["คาเฟ่", "กาแฟ"],
  travel: ["เที่ยว", "ทริป", "ทะเล", "ภูเขา"],
  hotel: ["ที่พัก", "โรงแรม", "รีสอร์ท"],
};
const CATEGORY_TH = { attraction: "ที่เที่ยว", hotel: "ที่พัก", restaurant: "ร้านอาหาร", cafe: "คาเฟ่", other: "อื่นๆ" };
const CHECKIN_RADIUS_M = 150;

// ตราประทับ: ปลดล็อกอัตโนมัติจากสถิติ (t = ผลของ travel_stats) แบ่งเป็นหมวด
const U = (t, k) => Number((t.u || {})[k] || 0);
const CAT = (t, k) => Number((t.by_cat || {})[k] || 0);
const ACHIEVEMENTS = [
  { g: "เช็คอิน", id: "first", icon: "🌱", label: "ก้าวแรก", desc: "เช็คอินครั้งแรก", test: t => t.total >= 1 },
  { g: "เช็คอิน", id: "five", icon: "🔥", label: "นักเดินทาง", desc: "เช็คอินครบ 5 ครั้ง", test: t => t.total >= 5 },
  { g: "เช็คอิน", id: "ten", icon: "🏆", label: "ขาลุย", desc: "เช็คอินครบ 10 ครั้ง", test: t => t.total >= 10 },
  { g: "เช็คอิน", id: "fifty", icon: "💯", label: "ตัวจริง", desc: "เช็คอินครบ 50 ครั้ง", test: t => t.total >= 50 },
  { g: "เช็คอิน", id: "hundred", icon: "🚀", label: "สายบิน", desc: "เช็คอินครบ 100 ครั้ง", test: t => t.total >= 100 },
  { g: "เช็คอิน", id: "places10", icon: "📍", label: "นักสะสมที่เที่ยว", desc: "เช็คอิน 10 สถานที่ไม่ซ้ำกัน", test: t => t.places >= 10 },
  { g: "เช็คอิน", id: "places50", icon: "🧭", label: "นักสำรวจตัวยง", desc: "เช็คอิน 50 สถานที่ไม่ซ้ำกัน", test: t => t.places >= 50 },
  { g: "แผนที่", id: "con1", icon: "🌏", label: "ผู้พิชิตทวีป", desc: "ปลดล็อกทวีปแรก", test: t => U(t, "con") >= 1 },
  { g: "แผนที่", id: "con3", icon: "🌍", label: "ข้ามทวีป", desc: "ปลดล็อก 3 ทวีป", test: t => U(t, "con") >= 3 },
  { g: "แผนที่", id: "cty1", icon: "🚩", label: "ผู้พิชิตประเทศ", desc: "ปลดล็อกประเทศแรก", test: t => U(t, "cty") >= 1 },
  { g: "แผนที่", id: "cty5", icon: "🛂", label: "พาสปอร์ตเต็มเล่ม", desc: "ปลดล็อก 5 ประเทศ", test: t => U(t, "cty") >= 5 },
  { g: "แผนที่", id: "reg3", icon: "🧳", label: "สามภาค", desc: "ปลดล็อก 3 ภูมิภาค", test: t => U(t, "reg") >= 3 },
  { g: "แผนที่", id: "reg6", icon: "🗾", label: "ผู้พิชิตภูมิภาค", desc: "ปลดล็อกครบ 6 ภูมิภาค", test: t => U(t, "reg") >= 6 },
  { g: "แผนที่", id: "reg1", icon: "🧭", label: "ก้าวสู่ภูมิภาค", desc: "ปลดล็อกภูมิภาคแรก", test: t => U(t, "reg") >= 1 },
  { g: "แผนที่", id: "prov3", icon: "🗺️", label: "ล่าจังหวัด", desc: "เช็คอินครบ 3 จังหวัด", test: t => (t.provinces || []).length >= 3 },
  { g: "แผนที่", id: "pro1", icon: "📌", label: "จังหวัดแรก", desc: "ปลดล็อกจังหวัดแรก", test: t => U(t, "pro") >= 1 },
  { g: "แผนที่", id: "pro10", icon: "🏔️", label: "นักสะสมจังหวัด", desc: "ปลดล็อก 10 จังหวัด", test: t => U(t, "pro") >= 10 },
  { g: "แผนที่", id: "pro30", icon: "🛣️", label: "ครึ่งทางแผนที่", desc: "ปลดล็อก 30 จังหวัด", test: t => U(t, "pro") >= 30 },
  { g: "แผนที่", id: "pro50", icon: "🗻", label: "เกินครึ่งประเทศ", desc: "ปลดล็อก 50 จังหวัด", test: t => U(t, "pro") >= 50 },
  { g: "แผนที่", id: "pro77", icon: "👑", label: "ราชาแผนที่", desc: "ปลดล็อกครบ 77 จังหวัด", test: t => U(t, "pro") >= 77 },
  { g: "แผนที่", id: "dis1", icon: "🏡", label: "อำเภอแรก", desc: "ปลดล็อกอำเภอแรก", test: t => U(t, "dis") >= 1 },
  { g: "แผนที่", id: "dis30", icon: "🌆", label: "สามสิบอำเภอ", desc: "ปลดล็อก 30 อำเภอ", test: t => U(t, "dis") >= 30 },
  { g: "แผนที่", id: "dis10", icon: "🏘️", label: "นักตะลุยอำเภอ", desc: "ปลดล็อก 10 อำเภอ", test: t => U(t, "dis") >= 10 },
  { g: "แผนที่", id: "dis100", icon: "🏙️", label: "ร้อยอำเภอ", desc: "ปลดล็อก 100 อำเภอ", test: t => U(t, "dis") >= 100 },
  { g: "แผนที่", id: "dis300", icon: "🌇", label: "สามร้อยอำเภอ", desc: "ปลดล็อก 300 อำเภอ", test: t => U(t, "dis") >= 300 },
  { g: "แผนที่", id: "sub1", icon: "🏠", label: "ตำบลแรก", desc: "ปลดล็อกตำบลแรก", test: t => U(t, "sub") >= 1 },
  { g: "แผนที่", id: "sub50", icon: "🗝️", label: "ห้าสิบตำบล", desc: "ปลดล็อก 50 ตำบล", test: t => U(t, "sub") >= 50 },
  { g: "แผนที่", id: "sub10", icon: "🔎", label: "นักเก็บตำบล", desc: "ปลดล็อก 10 ตำบล", test: t => U(t, "sub") >= 10 },
  { g: "แผนที่", id: "sub100", icon: "🧩", label: "ตำบลทะลุร้อย", desc: "ปลดล็อก 100 ตำบล", test: t => U(t, "sub") >= 100 },
  { g: "แผนที่", id: "sub500", icon: "🏅", label: "ตำนานตำบล", desc: "ปลดล็อก 500 ตำบล", test: t => U(t, "sub") >= 500 },
  { g: "แผนที่", id: "sub1000", icon: "🌟", label: "พันตำบล", desc: "ปลดล็อก 1,000 ตำบล", test: t => U(t, "sub") >= 1000 },
  { g: "แผนที่", id: "vil1", icon: "🛖", label: "หมู่บ้านแรก", desc: "ปลดล็อกหมู่บ้านแรก", test: t => U(t, "vil") >= 1 },
  { g: "แผนที่", id: "vil10", icon: "🌾", label: "นักตระเวนหมู่บ้าน", desc: "ปลดล็อก 10 หมู่บ้าน", test: t => U(t, "vil") >= 10 },
  { g: "แผนที่", id: "vil50", icon: "🛕", label: "รู้จักทุกซอกหมู่บ้าน", desc: "ปลดล็อก 50 หมู่บ้าน", test: t => U(t, "vil") >= 50 },
  { g: "สายกิน-สายเที่ยว", id: "cafe3", icon: "☕", label: "สายคาเฟ่", desc: "เช็คอินคาเฟ่ 3 ครั้ง", test: t => CAT(t, "cafe") >= 3 },
  { g: "สายกิน-สายเที่ยว", id: "cafe15", icon: "🧋", label: "ขาประจำคาเฟ่", desc: "เช็คอินคาเฟ่ 15 ครั้ง", test: t => CAT(t, "cafe") >= 15 },
  { g: "สายกิน-สายเที่ยว", id: "food3", icon: "🍜", label: "นักชิม", desc: "เช็คอินร้านอาหาร 3 ครั้ง", test: t => CAT(t, "restaurant") >= 3 },
  { g: "สายกิน-สายเที่ยว", id: "food15", icon: "🍽️", label: "เทพนักชิม", desc: "เช็คอินร้านอาหาร 15 ครั้ง", test: t => CAT(t, "restaurant") >= 15 },
  { g: "สายกิน-สายเที่ยว", id: "temple3", icon: "⛩️", label: "สายมู", desc: "เช็คอินที่เที่ยว 3 ครั้ง", test: t => CAT(t, "attraction") >= 3 },
  { g: "สายกิน-สายเที่ยว", id: "temple15", icon: "🪷", label: "สายมูขั้นเทพ", desc: "เช็คอินที่เที่ยว 15 ครั้ง", test: t => CAT(t, "attraction") >= 15 },
  { g: "สายกิน-สายเที่ยว", id: "hotel", icon: "🏨", label: "นักนอน", desc: "เช็คอินที่พัก 1 ครั้ง", test: t => CAT(t, "hotel") >= 1 },
  { g: "สายกิน-สายเที่ยว", id: "hotel5", icon: "🛌", label: "เซียนที่พัก", desc: "เช็คอินที่พัก 5 ครั้ง", test: t => CAT(t, "hotel") >= 5 },
  { g: "สตรีคและสังคม", id: "streak3", icon: "📆", label: "ไฟติด", desc: "เช็คอินต่อเนื่อง 3 วัน", test: t => (t.best_streak || 0) >= 3 },
  { g: "สตรีคและสังคม", id: "streak7", icon: "⚡", label: "ไฟลุกทั้งสัปดาห์", desc: "เช็คอินต่อเนื่อง 7 วัน", test: t => (t.best_streak || 0) >= 7 },
  { g: "สตรีคและสังคม", id: "streak30", icon: "🌋", label: "มาราธอน 30 วัน", desc: "เช็คอินต่อเนื่อง 30 วัน", test: t => (t.best_streak || 0) >= 30 },
  { g: "สตรีคและสังคม", id: "fans1", icon: "👥", label: "มีแฟนคลับ", desc: "มีผู้ติดตาม 1 คน", test: t => (t.followers || 0) >= 1 },
  { g: "สตรีคและสังคม", id: "fans10", icon: "🌟", label: "ดาวเด่น", desc: "มีผู้ติดตาม 10 คน", test: t => (t.followers || 0) >= 10 },
];

const OsmCredit = () => (
  <p className="text-[10px] text-[#9199A8] text-center py-2">ข้อมูลสถานที่บางส่วนจาก <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="underline">© OpenStreetMap contributors</a> (ODbL)</p>
);

// ร่างข้อกำหนดและนโยบายความเป็นส่วนตัว (PDPA) — เป็นแบบร่าง ควรให้ผู้เชี่ยวชาญกฎหมายตรวจและใส่ช่องทางติดต่อก่อนเปิดใช้จริง
const LEGAL = {
  terms: [
    ["การใช้งาน", "feedTH เป็นพื้นที่แชร์ประสบการณ์ท่องเที่ยวและเช็คอินสถานที่ คุณต้องให้ข้อมูลที่เป็นจริง ไม่ปลอมตำแหน่ง ไม่ปั่นคะแนน และไม่เผยแพร่เนื้อหาที่ผิดกฎหมาย ละเมิดสิทธิผู้อื่น หลอกลวง หรือคุกคาม"],
    ["เนื้อหาของคุณ", "โพสต์ รีวิว และรูปที่คุณเผยแพร่ยังเป็นของคุณ แต่คุณอนุญาตให้ feedTH แสดงเนื้อหานั้นในบริการ ลบเนื้อหาของคุณได้ทุกเมื่อ"],
    ["การดูแลเนื้อหา", "เราอาจซ่อนหรือลบเนื้อหาที่ถูกรายงานว่าฝ่าฝืนข้อกำหนด และระงับบัญชีที่ฝ่าฝืนซ้ำ"],
    ["เครดิตและการโปรโมท", "เครดิตใช้โปรโมทโพสต์หรือสถานที่ในแอปเท่านั้น ไม่สามารถแลกเป็นเงินสด ช่วงทดลองอาจมีการเติมเครดิตทดลองซึ่งไม่มีมูลค่า"],
    ["ข้อมูลสถานที่", "ข้อมูลสถานที่บางส่วนมาจาก OpenStreetMap contributors (ODbL) และอาจคลาดเคลื่อน โปรดตรวจสอบก่อนเดินทาง"],
    ["การยกเลิก", "คุณลบบัญชีและข้อมูลของคุณได้เองในหน้าโปรไฟล์"],
  ],
  privacy: [
    ["ข้อมูลที่เก็บ", "อีเมล ชื่อที่แสดง โพสต์ คอมเมนต์ ไลค์ ความสัมพันธ์เพื่อน/ผู้ติดตาม และตำแหน่งตอนคุณกดเช็คอิน (ใช้ตรวจว่าอยู่ใกล้สถานที่จริง) ถ้าคุณยินยอมเพิ่ม จะเก็บเวลาใช้งานและความสนใจเพื่อปรับเนื้อหาและโฆษณา"],
    ["วัตถุประสงค์", "ให้บริการเช็คอิน ฟีด แผนที่สำรวจ คะแนน และความสัมพันธ์ ป้องกันการโกง และดูแลความปลอดภัย"],
    ["การเปิดเผย", "โพสต์เช็คอินและรีวิวของคุณมองเห็นได้โดยผู้ใช้อื่น เราไม่ขายข้อมูลส่วนบุคคล ผู้ให้บริการโครงสร้างพื้นฐานที่เราใช้ (เช่น Supabase) ประมวลผลข้อมูลตามคำสั่งของเรา"],
    ["ระยะเวลาเก็บ", "เก็บตลอดที่บัญชียังใช้งาน เมื่อลบบัญชี ข้อมูลที่ผูกกับบัญชีจะถูกลบ"],
    ["สิทธิของคุณ", "ขอเข้าถึง แก้ไข ลบข้อมูล ถอนความยินยอม (ตั้งค่าความเป็นส่วนตัวในโปรไฟล์) และร้องเรียนต่อสำนักงานคณะกรรมการคุ้มครองข้อมูลส่วนบุคคลได้ตาม พ.ร.บ.คุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562"],
    ["ติดต่อ", "[ใส่อีเมล/ช่องทางติดต่อของผู้ดูแลระบบก่อนเปิดใช้จริง]"],
  ],
};
function LegalModal({ onClose, initial = "terms" }) {
  const [t, setT] = useState(initial);
  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl w-full max-w-sm max-h-[80vh] overflow-y-auto p-4 relative" role="dialog" aria-label="ข้อกำหนดและความเป็นส่วนตัว">
        <button onClick={onClose} aria-label="ปิด" className="absolute top-3 right-3 text-[#9199A8]"><X size={18} /></button>
        <div className="flex gap-2 mb-3">
          {[["terms", "ข้อกำหนดการใช้งาน"], ["privacy", "ความเป็นส่วนตัว"]].map(([k, l]) => <button key={k} onClick={() => setT(k)} className={`text-xs px-3 py-1.5 rounded-full ${t === k ? "bg-[#6C5CE7] text-white" : "bg-[#F3F5FA]"}`}>{l}</button>)}
        </div>
        <p className="text-[11px] text-[#B77600] bg-[#FFF4DD] rounded-lg px-2.5 py-1.5 mb-3">ฉบับร่างช่วงทดลองใช้งาน</p>
        <div className="space-y-3">
          {LEGAL[t].map(([h, b]) => <div key={h}><p className="text-sm font-medium">{h}</p><p className="text-xs text-[#4B5160] leading-relaxed">{b}</p></div>)}
        </div>
      </div>
    </div>
  );
}

const CAT_COLOR = { attraction: "#17B890", hotel: "#4A90E2", restaurant: "#EF4565", cafe: "#FFB020", other: "#9199A8" };

function CheckinTab({ rest, onBack, showToast, onOpenPlace, onOpenMap }) {
  const [pos, setPos] = useState(null);
  const [places, setPlaces] = useState([]);
  const [cat, setCat] = useState("all");
  const [busy, setBusy] = useState(false);
  const [target, setTarget] = useState(null); // สถานที่ที่กำลังเช็คอิน
  const [rating, setRating] = useState(5);
  const [caption, setCaption] = useState("");
  const [newName, setNewName] = useState("");
  const [newCat, setNewCat] = useState("cafe");
  const [result, setResult] = useState(null); // ผลเช็คอิน: คะแนน + พื้นที่ที่ปลดล็อก

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
      // หาจังหวัด/อำเภอ/ตำบลของสถานที่ (เซิร์ฟเวอร์ตรวจซ้ำกับตาราง admin_areas)
      const loc = (await locateAt(target.lat, target.lng).catch(() => null)) || {};
      const r = await rest("/rest/v1/rpc/check_in_v4", { method: "POST", body: { p_place_id: target.id, p_lat: pos.lat, p_lng: pos.lng, p_rating: rating, p_caption: caption, p_cty: loc.cty || null, p_pro: loc.pro || null, p_dis: loc.dis || null, p_sub: loc.sub || null } });
      if (r.repeat) showToast("เช็คอินซ้ำสำเร็จ (ไม่ได้แต้มเพิ่ม)");
      setResult({ place: target.name, points: r.points, unlocks: r.unlocks || [], repeat: !!r.repeat });
      rest("/rest/v1/rpc/record_interest", { method: "POST", body: { p_topic: target.category, p_weight: 3 } }).catch(() => {});
      setTarget(null); setCaption(""); load(pos);
    } catch (e) {
      const m = e.message;
      showToast(m.includes("too far") ? "ไกลเกินไป ต้องอยู่ในรัศมี 150 ม." : m.includes("after 4 hours") ? "เช็คอินที่นี่ซ้ำได้อีกหลังผ่านไป 4 ชั่วโมง" : m.includes("limit reached") ? "เช็คอินซ้ำครบ 10 ครั้งต่อวันแล้ว" : m.includes("already") ? "วันนี้เช็คอินที่นี่ไปแล้ว" : m.includes("suspicious") ? "ตรวจพบการเดินทางเร็วผิดปกติ" : "เช็คอินไม่สำเร็จ: " + m);
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
        {pos && <p className="text-[11px] text-[#9199A8]">เช็คอินได้เมื่ออยู่ในรัศมี {CHECKIN_RADIUS_M} ม. จากสถานที่ · เช็คอินเพื่อปลดล็อกตำบล/อำเภอ/จังหวัดบนแผนที่สำรวจ</p>}
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
              <a href={`https://www.google.com/maps/search/?api=1&query=${pl.lat},${pl.lng}`} target="_blank" rel="noopener noreferrer" aria-label={`เปิด ${pl.name} ใน Google Maps`} className="text-[#6C5CE7] p-1.5"><MapPin size={16} /></a>
              <button disabled={!near} onClick={() => setTarget(pl)} className={`text-sm font-medium px-3.5 py-2 rounded-full ${near ? "bg-[#6C5CE7] text-white" : "bg-[#EEF0F5] text-[#9199A8]"}`}>{near ? "เช็คอิน" : "ไกลไป"}</button>
            </div>
          );
        })}
        {pos && shown.length === 0 && <p className="text-center text-xs text-[#9199A8] py-4">ยังไม่มีสถานที่ใกล้คุณ เพิ่มสถานที่แรกได้เลย</p>}

        <div className="bg-white rounded-2xl p-3 shadow-sm space-y-2">
          <p className="text-sm font-medium">เพิ่มสถานที่ตรงตำแหน่งที่คุณอยู่</p>
          <div className="flex gap-2">
            <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="ชื่อสถานที่" className="flex-1 min-w-0 text-sm bg-[#F3F5FA] rounded-lg px-3 py-2 outline-none" />
            <select value={newCat} onChange={e => setNewCat(e.target.value)} className="w-24 shrink-0 text-sm bg-[#F3F5FA] rounded-lg px-2">
              {Object.entries(CATEGORY_TH).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <button onClick={addPlace} disabled={!newName.trim() || !pos} className="w-full bg-[#6C5CE7] disabled:opacity-40 text-white text-sm font-medium py-2 rounded-lg">เพิ่มสถานที่</button>
        </div>
        <OsmCredit />
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
      {result && (
        <div className="fixed inset-0 bg-black/40 flex items-end justify-center z-50 px-4">
          <div className="bg-white rounded-t-2xl w-full max-w-sm p-4 relative space-y-2" role="status">
            <button onClick={() => setResult(null)} aria-label="ปิด" className="absolute top-3 right-3 text-[#9199A8]"><X size={18} /></button>
            <h3 style={{ fontFamily: "'Kanit', sans-serif" }} className="font-semibold">เช็คอินสำเร็จ <span className="text-[#B8862B]">+{result.points}</span></h3>
            <p className="text-xs text-[#6B7280]">{result.place}</p>
            <ul className="text-sm space-y-1">
              <li className="flex justify-between"><span>เช็คอิน</span><span className="text-[#178A5D]">+5</span></li>
              {result.unlocks.map(u => (
                <li key={u.level + u.code} className="flex justify-between"><span>ปลดล็อก{LEVELS.find(l => l.k === u.level).name} {u.name || (u.level === "reg" ? REGION_TH[u.code] : u.level === "con" ? CONTINENT_TH[u.code] : COUNTRY_TH[u.code]) || u.code}</span><span className="text-[#178A5D]">+{u.points}</span></li>
              ))}
            </ul>
            <button onClick={() => { setResult(null); onOpenMap(); }} className="w-full bg-[#6C5CE7] text-white text-sm font-semibold py-2.5 rounded-full">ดูแผนที่สำรวจ</button>
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
        <OsmCredit />
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
      <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
        <p className="text-sm font-medium">ตราประทับ {stamps.filter(x => x.on).length}/{stamps.length}</p>
        {[...new Set(stamps.map(x => x.g))].map(g => {
          const list = stamps.filter(x => x.g === g);
          return (
            <div key={g}>
              <p className="text-[11px] text-[#9199A8] mb-1.5">{g} · {list.filter(x => x.on).length}/{list.length}</p>
              <div className="grid grid-cols-4 gap-2">
                {list.map(a => (
                  <div key={a.id} title={a.desc} className="aspect-square rounded-full flex flex-col items-center justify-center text-center p-1 text-[10px] leading-tight"
                    style={a.on ? { border: "2px solid #B8862B", color: "#B8862B", background: "#FFF9EC", transform: "rotate(-5deg)" } : { border: "2px dashed #D5D9E2", color: "#B8BDC9" }}>
                    <span className="text-lg leading-none">{a.on ? a.icon : "🔒"}</span>{a.label}
                    {!a.on && <span className="text-[8px] mt-0.5">{a.soon ? "เร็วๆ นี้" : a.desc}</span>}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
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
  const [view, setView] = useState("map");
  useEffect(() => {
    if (prov || view !== "list") return;
    rest("/rest/v1/rpc/explore_provinces", { method: "POST", body: {} }).then(setProvs).catch(e => { showToast("โหลดจังหวัดไม่สำเร็จ: " + e.message); setProvs([]); });
  }, [prov, view]);
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
          <h1 style={{ fontFamily: "'Kanit', sans-serif" }} className="text-xl font-semibold text-[#6C5CE7]">{prov ? prov : view === "map" ? "สำรวจ" : "สำรวจจังหวัด"}</h1>
          {!prov && (
            <div className="ml-auto flex bg-white rounded-full border border-black/10 p-0.5 text-xs">
              {[["map", "แผนที่"], ["list", "รายการจังหวัด"]].map(([k, l]) => <button key={k} onClick={() => setView(k)} className={`px-3 py-1 rounded-full ${view === k ? "bg-[#6C5CE7] text-white" : "text-[#6B7280]"}`}>{l}</button>)}
            </div>
          )}
        </div>
      </header>
      <main className="max-w-xl mx-auto px-4 pt-3 space-y-2">
        {!prov && view === "map" && <FogMapPanel rest={rest} showToast={showToast} />}
        {!prov && view === "list" && provs === null && <p className="text-center text-xs text-[#9199A8] py-6">กำลังโหลด...</p>}
        {!prov && view === "list" && provs && provs.length === 0 && <p className="text-center text-xs text-[#9199A8] py-6">ยังไม่มีสถานที่ในระบบ</p>}
        {!prov && view === "list" && provs && provs.map(pv => {
          const pct = pv.places ? Math.round((pv.visited / pv.places) * 100) : 0;
          return (
            <button key={pv.name} onClick={() => setProv(pv.name)} className="w-full bg-white rounded-2xl p-3.5 shadow-sm text-left">
              <div className="flex justify-between items-center"><span className="text-sm font-medium">{pv.name}</span><span className="text-xs text-[#6B7280]">{pv.places} สถานที่ ›</span></div>
              <div className="h-1.5 rounded bg-[#EEF0F5] overflow-hidden mt-2"><div className="h-full bg-[#B8862B]" style={{ width: pct + "%" }} /></div>
              <p className="text-[11px] text-[#9199A8] mt-1">คุณไปมาแล้ว {pv.visited}/{pv.places} แห่ง ({pct}%)</p>
            </button>
          );
        })}
        {!prov && view === "list" && provs && provs.length > 0 && <p className="text-[11px] text-center text-[#9199A8] pt-2">จังหวัดอื่นจะขึ้นเมื่อมีคนเพิ่มสถานที่ในจังหวัดนั้น</p>}

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
        <OsmCredit />
      </main>
    </div>
  );
}

function TabBar({ tab, setTab, badge = 0 }) {
  const items = [["feed", "ฟีด", Home], ["explore", "สำรวจ", Compass], ["checkin", "เช็คอิน", MapPin], ["rank", "อันดับ", Trophy], ["profile", "โปรไฟล์", User]];
  return (
    <>
      <div className="h-16" />
      <nav className="fixed bottom-0 inset-x-0 z-30 bg-white border-t border-black/5 flex">
        {items.map(([k, label, Icon]) => (
          <button key={k} onClick={() => setTab(k)} className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-[11px] ${tab === k ? "text-[#6C5CE7] font-semibold" : "text-[#9199A8]"}`}>
            <span className="relative"><Icon size={20} />{k === "profile" && badge > 0 && <span className="absolute -top-1 -right-2 min-w-[14px] h-[14px] rounded-full bg-[#EF4565] text-white text-[9px] leading-[14px] text-center px-0.5">{badge}</span>}</span>{label}
          </button>
        ))}
      </nav>
    </>
  );
}

// หน้าเพื่อน/ผู้ติดตาม: รายชื่อ + รับ/ปฏิเสธคำขอ + ความสนิทแบบสองทาง (ดูอัลกอริทึมที่ _closeness ในฐานข้อมูล)
const NOTIF_TEXT = {
  like: "ถูกใจโพสต์ของคุณ", comment: "แสดงความคิดเห็นในโพสต์ของคุณ", follow: "เริ่มติดตามคุณ",
  friend_request: "ส่งคำขอเป็นเพื่อนถึงคุณ", friend_accept: "ยอมรับคำขอเป็นเพื่อนของคุณแล้ว",
};
function NotificationsView({ rest, onBack, onOpen, onRead }) {
  const [rows, setRows] = useState(null);
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const r = await rest("/rest/v1/rpc/my_notifications", { method: "POST", body: { p_limit: 50 } });
        if (live) setRows(Array.isArray(r) ? r : []);
        await rest("/rest/v1/rpc/mark_notifications_read", { method: "POST", body: {} });
        onRead && onRead();
      } catch { if (live) setRows([]); }
    })();
    return () => { live = false; };
  }, []);
  return (
    <div style={{ fontFamily: "'IBM Plex Sans Thai', sans-serif" }} className="min-h-screen bg-[#F3F5FA] text-[#1A1D29] pb-20">
      <style>{FONT_IMPORT}</style>
      <header className="sticky top-0 z-20 bg-[#F3F5FA]/90 backdrop-blur border-b border-black/5">
        <div className="max-w-xl mx-auto flex items-center gap-3 px-4 py-3">
          <button onClick={onBack} aria-label="กลับ" className="text-[#6B7280]"><ArrowLeft size={18} /></button>
          <h1 style={{ fontFamily: "'Kanit', sans-serif" }} className="text-xl font-semibold text-[#6C5CE7]">การแจ้งเตือน</h1>
        </div>
      </header>
      <main className="max-w-xl mx-auto px-4 pt-3 space-y-2">
        {rows === null && <p className="text-center text-sm text-[#9199A8] py-10">กำลังโหลด...</p>}
        {rows && rows.length === 0 && <p className="text-center text-sm text-[#9199A8] py-10">ยังไม่มีการแจ้งเตือน</p>}
        {rows && rows.map(n => (
          <button key={n.id} onClick={() => onOpen(n)} className={`w-full text-left rounded-2xl p-3 shadow-sm flex items-start gap-3 ${n.read ? "bg-white" : "bg-[#F0EDFF]"}`}>
            <span className="w-9 h-9 shrink-0 rounded-full bg-[#6C5CE7]/10 text-[#6C5CE7] flex items-center justify-center font-semibold">{n.actor?.[0]?.toUpperCase()}</span>
            <span className="min-w-0 flex-1">
              <span className="text-sm block"><b>{n.actor}</b> {NOTIF_TEXT[n.type] || ""}</span>
              {n.snippet && <span className="text-xs text-[#6B7280] block truncate">“{n.snippet}”</span>}
              <span className="text-[11px] text-[#9199A8]">{timeAgo(n.created_at)}</span>
            </span>
          </button>
        ))}
      </main>
    </div>
  );
}

function PeopleView({ rest, session, userId, initialTab, onBack, onProfile, onChanged, showToast }) {
  const me = session.user_id;
  const isMe = userId === me;
  const tabs = isMe ? [["friends", "เพื่อน"], ["requests", "คำขอ"], ["followers", "ผู้ติดตาม"], ["following", "กำลังติดตาม"]] : [["followers", "ผู้ติดตาม"], ["following", "กำลังติดตาม"]];
  const [tab, setTab] = useState(tabs.some(t => t[0] === initialTab) ? initialTab : tabs[0][0]);
  const [rows, setRows] = useState(null);
  const [sent, setSent] = useState([]);
  const [sure, setSure] = useState(null);
  const call = (kind) => rest("/rest/v1/rpc/people_list", { method: "POST", body: { p_kind: kind, p_user: userId } });
  const load = useCallback(async () => {
    try {
      setRows(await call(tab));
      if (isMe && tab === "requests") setSent(await call("sent"));
    } catch (e) { showToast("โหลดรายชื่อไม่สำเร็จ: " + e.message); setRows([]); }
  }, [tab, userId]);
  useEffect(() => { setRows(null); load(); }, [load]);
  const done = (msg) => { if (msg) showToast(msg); setSure(null); load(); onChanged && onChanged(); };
  const act = async (fn, msg) => { try { await fn(); done(msg); } catch (e) { showToast("ทำรายการไม่สำเร็จ: " + e.message); } };
  const accept = (id) => act(() => rest("/rest/v1/rpc/accept_friend_request", { method: "POST", body: { p_user: id } }), "เป็นเพื่อนกันแล้ว");
  const reject = (id) => act(() => rest(`/rest/v1/friendships?user_id=eq.${id}&friend_id=eq.${me}`, { method: "DELETE" }), "ปฏิเสธคำขอแล้ว");
  const cancel = (id) => act(() => rest(`/rest/v1/friendships?user_id=eq.${me}&friend_id=eq.${id}`, { method: "DELETE" }), "ยกเลิกคำขอแล้ว");
  const unfriend = (id) => act(() => rest(`/rest/v1/friendships?or=(and(user_id.eq.${me},friend_id.eq.${id}),and(user_id.eq.${id},friend_id.eq.${me}))`, { method: "DELETE" }), "เลิกเป็นเพื่อนแล้ว");
  const follow = (r) => act(async () => {
    if (r.i_follow) await rest(`/rest/v1/follows?follower_id=eq.${me}&followee_id=eq.${r.id}`, { method: "DELETE" });
    else await rest("/rest/v1/follows", { method: "POST", body: { follower_id: me, followee_id: r.id } });
  });
  const Row = ({ r, children }) => {
    const t = r.closeness != null ? tierFor(r.closeness) : null;
    return (
      <div className="bg-white rounded-2xl p-3 shadow-sm flex items-center gap-3">
        <button onClick={() => onProfile(r.id)} className="w-10 h-10 rounded-full bg-[#6C5CE7]/10 text-[#6C5CE7] flex items-center justify-center font-semibold shrink-0">{r.name?.[0]?.toUpperCase()}</button>
        <button onClick={() => onProfile(r.id)} className="flex-1 min-w-0 text-left">
          <span className="block text-sm font-medium truncate">{r.name}{t && <span className="ml-1.5 text-[10px] rounded-full px-2 py-0.5" style={{ color: t.color, background: t.bg }}>{t.label}</span>}</span>
          <span className="block text-xs text-[#9199A8] truncate">{r.closeness != null ? `ความสนิท ${r.closeness}` : r.bio || ""}</span>
        </button>
        {children}
      </div>
    );
  };
  const empty = { friends: "ยังไม่มีเพื่อน กดเพิ่มเพื่อนจากโพสต์ในฟีดได้เลย", requests: "ไม่มีคำขอใหม่", followers: "ยังไม่มีผู้ติดตาม", following: "ยังไม่ได้ติดตามใคร" }[tab];
  return (
    <div style={{ fontFamily: "'IBM Plex Sans Thai', sans-serif" }} className="min-h-screen bg-[#F3F5FA] text-[#1A1D29] pb-20">
      <style>{FONT_IMPORT}</style>
      <header className="sticky top-0 z-20 bg-[#F3F5FA]/90 backdrop-blur border-b border-black/5">
        <div className="max-w-xl mx-auto flex items-center gap-3 px-4 py-3">
          <button onClick={onBack} aria-label="กลับ" className="text-[#6B7280]"><ArrowLeft size={18} /></button>
          <h1 style={{ fontFamily: "'Kanit', sans-serif" }} className="text-xl font-semibold text-[#6C5CE7]">{isMe ? "เพื่อนและผู้ติดตาม" : "ผู้ติดตาม"}</h1>
        </div>
        <div className="max-w-xl mx-auto flex gap-2 px-4 pb-2 overflow-x-auto" role="tablist">
          {tabs.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`text-xs px-3 py-1.5 rounded-full whitespace-nowrap ${tab === k ? "bg-[#6C5CE7] text-white" : "bg-white border border-black/10"}`}>{l}</button>)}
        </div>
      </header>
      <main className="max-w-xl mx-auto px-4 pt-3 space-y-2">
        {rows === null && <p className="text-center text-xs text-[#9199A8] py-6">กำลังโหลด...</p>}
        {rows && rows.length === 0 && (tab !== "requests" || sent.length === 0) && <p className="text-center text-xs text-[#9199A8] py-6">{empty}</p>}
        {rows && tab === "friends" && rows.length > 0 && <p className="text-[11px] text-[#9199A8]">เรียงตามความสนิท (คะแนนสองฝั่งที่ลดลงตามเวลา + เช็คอินที่เดียวกัน + ติดตามกัน)</p>}
        {rows && rows.map(r => (
          <Row key={r.id} r={r}>
            {tab === "requests" && (<div className="flex gap-1.5"><button onClick={() => accept(r.id)} className="text-xs font-medium bg-[#6C5CE7] text-white px-3 py-1.5 rounded-full">รับ</button><button onClick={() => reject(r.id)} className="text-xs border border-black/10 text-[#6B7280] px-3 py-1.5 rounded-full">ปฏิเสธ</button></div>)}
            {tab === "friends" && (sure === r.id
              ? <button onClick={() => unfriend(r.id)} className="text-xs font-medium text-white bg-[#C43D3D] px-3 py-1.5 rounded-full">ยืนยันเลิก</button>
              : <button onClick={() => setSure(r.id)} className="text-xs border border-black/10 text-[#6B7280] px-3 py-1.5 rounded-full">เลิกเป็นเพื่อน</button>)}
            {(tab === "followers" || tab === "following") && r.id !== me && <button onClick={() => follow(r)} className={`text-xs px-3 py-1.5 rounded-full ${r.i_follow ? "border border-black/10 text-[#6B7280]" : "bg-[#6C5CE7] text-white font-medium"}`}>{r.i_follow ? "กำลังติดตาม" : "ติดตาม"}</button>}
          </Row>
        ))}
        {tab === "requests" && sent.length > 0 && (
          <>
            <p className="text-[11px] text-[#9199A8] pt-2">คำขอที่ส่งไปแล้ว (รอยืนยัน)</p>
            {sent.map(r => <Row key={r.id} r={r}><button onClick={() => cancel(r.id)} className="text-xs border border-black/10 text-[#6B7280] px-3 py-1.5 rounded-full">ยกเลิก</button></Row>)}
          </>
        )}
      </main>
    </div>
  );
}

function ProfileTab({ rest, session, userId, onLogout, onPrivacy, onPeople, onLegal, onDelete, pending, showToast }) {
  const isMe = userId === session.user_id;
  const [p, setP] = useState(null);
  const [stats, setStats] = useState({ posts: 0, checkins: 0, friends: 0 });
  const [posts, setPosts] = useState([]);
  const [travel, setTravel] = useState(null);
  const [following, setFollowing] = useState(false);
  const [edit, setEdit] = useState(false);
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [sureDel, setSureDel] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        rest("/rest/v1/rpc/travel_stats", { method: "POST", body: { p_user: userId } }).then(setTravel).catch(() => {});
        if (!isMe) rest(`/rest/v1/follows?follower_id=eq.${session.user_id}&followee_id=eq.${userId}&select=followee_id`).then(r => setFollowing(r.length > 0)).catch(() => {});
        const [pr, st, ps] = await Promise.all([
          rest(`/rest/v1/profiles?id=eq.${userId}&select=display_name,bio`),
          rest("/rest/v1/rpc/profile_stats", { method: "POST", body: { p_user: userId } }),
          rest(`/rest/v1/posts?user_id=eq.${userId}&select=id,content,media_urls,created_at&order=created_at.desc&limit=20`),
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
            {[["โพสต์", stats.posts], ["เช็คอิน", stats.checkins], ["เพื่อน", stats.friends]].map(([l, n]) => {
              const link = l === "เพื่อน" && isMe;
              const inner = <><p className="text-lg font-semibold">{n}</p><p className="text-xs text-[#6B7280]">{l}</p></>;
              return link
                ? <button key={l} onClick={() => onPeople(userId, "friends")} className="bg-[#F3F5FA] rounded-xl py-2">{inner}</button>
                : <div key={l} className="bg-[#F3F5FA] rounded-xl py-2">{inner}</div>;
            })}
          </div>
          {travel && <p className="text-xs text-[#6B7280] mt-3"><button onClick={() => onPeople(userId, "followers")} className="underline-offset-2 hover:underline">ผู้ติดตาม {travel.followers}</button> · <button onClick={() => onPeople(userId, "following")} className="underline-offset-2 hover:underline">กำลังติดตาม {travel.following}</button></p>}
          {!isMe && <button onClick={toggleFollow} className={`mt-3 w-full text-sm font-medium py-2 rounded-lg ${following ? "border border-black/10 text-[#6B7280]" : "bg-[#6C5CE7] text-white"}`}>{following ? "กำลังติดตาม" : "ติดตาม"}</button>}
          {isMe && !edit && (
            <div className="flex gap-2 mt-4">
              <button onClick={() => setEdit(true)} className="flex-1 border border-[#6C5CE7]/30 text-[#6C5CE7] text-sm font-medium py-2 rounded-lg">แก้ไขโปรไฟล์</button>
              <button onClick={onLogout} className="flex-1 border border-black/10 text-[#6B7280] text-sm py-2 rounded-lg">ออกจากระบบ</button>
            </div>
          )}
        </div>
        {travel && <Passport t={travel} />}
        {isMe && <button onClick={() => onPeople(userId, pending > 0 ? "requests" : "friends")} className="w-full bg-white rounded-2xl p-3 shadow-sm text-sm text-left text-[#6C5CE7] flex items-center justify-between">เพื่อนและคำขอ{pending > 0 && <span className="text-[11px] bg-[#EF4565] text-white rounded-full px-2 py-0.5">{pending} คำขอใหม่</span>}</button>}
        {isMe && <button onClick={onPrivacy} className="w-full bg-white rounded-2xl p-3 shadow-sm text-sm text-left text-[#6C5CE7]">ตั้งค่าความเป็นส่วนตัวและการใช้ข้อมูล</button>}
        {isMe && <button onClick={onLegal} className="w-full bg-white rounded-2xl p-3 shadow-sm text-sm text-left text-[#6C5CE7]">ข้อกำหนดการใช้งานและนโยบายความเป็นส่วนตัว</button>}
        {isMe && (sureDel
          ? <div className="bg-white rounded-2xl p-3 shadow-sm space-y-2"><p className="text-xs text-[#C43D3D]">ลบแล้วกู้คืนไม่ได้ โพสต์ เช็คอิน คะแนน และเครดิตทั้งหมดจะหายไป</p><div className="flex gap-2"><button onClick={() => setSureDel(false)} className="flex-1 border border-black/10 text-sm py-2 rounded-lg">ยกเลิก</button><button onClick={onDelete} className="flex-1 bg-[#C43D3D] text-white text-sm font-medium py-2 rounded-lg">ยืนยันลบบัญชี</button></div></div>
          : <button onClick={() => setSureDel(true)} className="w-full bg-white rounded-2xl p-3 shadow-sm text-sm text-left text-[#C43D3D]">ลบบัญชีและข้อมูลทั้งหมด</button>)}
        {posts.map(po => (
          <div key={po.id} className="bg-white rounded-2xl p-4 shadow-sm">
            <p className="text-xs text-[#9199A8] mb-1">{timeAgo(po.created_at)}</p>
            {po.content && <p className="text-sm whitespace-pre-wrap">{po.content}</p>}
            {(po.media_urls || []).map(u => <img key={u} src={u} alt="รูปในโพสต์" loading="lazy" className="mt-2 rounded-xl w-full max-h-80 object-cover" />)}
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
  const [agree, setAgree] = useState(false);
  const [legal, setLegal] = useState(null); // null | "terms" | "privacy"
  const [recovery, setRecovery] = useState(null); // token จากลิงก์รีเซ็ตรหัสผ่านในอีเมล
  const [demoMode, setDemoMode] = useState(true);
  const [reportFor, setReportFor] = useState(null);
  const [deleteFor, setDeleteFor] = useState(null);

  const [posts, setPosts] = useState([]);
  const [wallet, setWallet] = useState(0);
  const [loadingFeed, setLoadingFeed] = useState(false);
  const [draft, setDraft] = useState("");
  const [img, setImg] = useState(null); // { blob, url }
  const [posting, setPosting] = useState(false);
  const fileRef = useRef(null);
  const [openComments, setOpenComments] = useState({});
  const [commentDraft, setCommentDraft] = useState({});
  const [boostTarget, setBoostTarget] = useState(null);
  const [toast, setToast] = useState(null);
  const [topUpFlash, setTopUpFlash] = useState(false);
  const [leaderboardFor, setLeaderboardFor] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [relations, setRelations] = useState({}); // { userId: friends|sent|received }
  const [people, setPeople] = useState(null); // { userId, tab }
  const [notif, setNotif] = useState(false);
  const [shop, setShop] = useState(null); // "buy" | "admin"
  const [payCfg, setPayCfg] = useState({ mode: "off", packages: [], is_admin: false });
  const [unread, setUnread] = useState(0);
  const [tab, setTab] = useState("feed");
  const [placeView, setPlaceView] = useState(null);
  const [exploreProv, setExploreProv] = useState(null);
  const [profileId, setProfileId] = useState(null); // null = โปรไฟล์ตัวเอง
  const [consent, setConsent] = useState(null);
  const [showConsent, setShowConsent] = useState(false);
  const [cA, setCA] = useState(false);
  const [cP, setCP] = useState(false);
  const sid = useRef(crypto.randomUUID());

  const toastTimer = useRef(null);
  const showToast = (msg) => { setToast(msg); clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToast(null), 2500); };

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
      // ลิงก์รีเซ็ตรหัสผ่านจากอีเมล: #access_token=...&type=recovery
      const h = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      if (h.get("type") === "recovery" && h.get("access_token")) {
        setRecovery({ access_token: h.get("access_token"), refresh_token: h.get("refresh_token"), expires_at: Number(h.get("expires_at")) || Math.floor(Date.now() / 1000) + 3000 });
        setAuthMode("reset");
        window.history.replaceState(null, "", window.location.pathname + window.location.search);
        setBooting(false);
        return;
      }
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
  const authErrMsg = (data) => {
    const m = data.error_description || data.msg || data.message || "";
    if (/invalid login/i.test(m)) return "อีเมลหรือรหัสผ่านไม่ถูกต้อง";
    if (/already registered|already exists/i.test(m)) return "อีเมลนี้สมัครไว้แล้ว ลองเข้าสู่ระบบ";
    if (/at least|weak|short/i.test(m)) return "รหัสผ่านสั้นหรือง่ายเกินไป (อย่างน้อย 6 ตัวอักษร)";
    if (/rate limit|too many/i.test(m)) return "ทำรายการถี่เกินไป รอสักครู่แล้วลองใหม่";
    return m || "เข้าสู่ระบบไม่สำเร็จ";
  };
  const handleAuth = async () => {
    setAuthBusy(true); setAuthError("");
    try {
      if (authMode === "forgot") {
        const res = await fetch(`${SUPABASE_URL}/auth/v1/recover?redirect_to=${encodeURIComponent(window.location.origin + window.location.pathname)}`, {
          method: "POST", headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ email: authEmail.trim() }),
        });
        if (!res.ok) throw new Error(authErrMsg(await res.json().catch(() => ({}))));
        showToast("ส่งลิงก์ตั้งรหัสผ่านใหม่ไปที่อีเมลแล้ว (ถ้ามีบัญชีนี้) เช็คกล่องจดหมายและสแปม");
        setAuthMode("login");
        return;
      }
      if (authMode === "reset") {
        const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
          method: "PUT", headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${recovery.access_token}`, "Content-Type": "application/json" }, body: JSON.stringify({ password: authPassword }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(authErrMsg(data));
        const rec = recovery; setRecovery(null); setAuthPassword("");
        await persistSession({ access_token: rec.access_token, refresh_token: rec.refresh_token, expires_at: rec.expires_at, user_id: data.id, email: data.email });
        showToast("ตั้งรหัสผ่านใหม่แล้ว");
        return;
      }
      const path = authMode === "signup" ? "/auth/v1/signup" : "/auth/v1/token?grant_type=password";
      const res = await fetch(`${SUPABASE_URL}${path}`, {
        method: "POST",
        headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ email: authEmail.trim(), password: authPassword, ...(authMode === "signup" ? { data: { display_name: authName.trim() } } : {}) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(authErrMsg(data));
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

  const deleteAccount = async () => {
    try {
      await rest("/rest/v1/rpc/delete_my_account", { method: "POST", body: {} });
      persistSession(null); setPosts([]);
      showToast("ลบบัญชีและข้อมูลแล้ว");
    } catch (e) {
      showToast(/function|not find|404/i.test(e.message) ? "ยังไม่เปิดให้ลบบัญชีอัตโนมัติ โปรดติดต่อผู้ดูแลระบบ" : "ลบบัญชีไม่สำเร็จ: " + e.message);
    }
  };

  const logout = () => { persistSession(null); setPosts([]); };

  // ---------- โหลดฟีด + กระเป๋าเครดิต ----------
  const loadFeed = useCallback(async () => {
    setLoadingFeed(true);
    try {
      const rows = await rest(
        "/rest/v1/posts?select=id,content,media_urls,is_boosted,boost_expire_at,created_at,place_id,rating,place:places(id,name,category),author:profiles!posts_user_id_fkey(id,username:display_name),comments(id,content,created_at,author:profiles!comments_user_id_fkey(username:display_name)),likes(user_id)&order=created_at.desc"
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

  const legalModal = legal && <LegalModal initial={legal} onClose={() => setLegal(null)} />;
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

  const pickImage = async (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!f) return;
    try {
      const blob = await compressImage(f);
      if (img) URL.revokeObjectURL(img.url);
      setImg({ blob, url: URL.createObjectURL(blob) });
    } catch (err) { showToast(err.message || "เลือกรูปไม่สำเร็จ"); }
  };
  const clearImage = () => { if (img) URL.revokeObjectURL(img.url); setImg(null); };

  const handlePost = async () => {
    if ((!draft.trim() && !img) || posting) return;
    setPosting(true);
    let path = null;
    try {
      let media_urls = null;
      if (img) {
        const token = await getToken();
        path = `${session.user_id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
        const up = await fetch(`${SUPABASE_URL}/storage/v1/object/post-images/${path}`, {
          method: "POST",
          headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}`, "Content-Type": "image/jpeg", "x-upsert": "false" },
          body: img.blob,
        });
        if (!up.ok) { path = null; const eb = await up.json().catch(() => ({})); throw new Error(eb.message || `อัปโหลดรูปไม่สำเร็จ (${up.status})`); }
        media_urls = [IMG_PUBLIC(path)];
      }
      await rest("/rest/v1/posts", { method: "POST", body: { user_id: session.user_id, content: draft.trim(), ...(media_urls ? { media_urls } : {}) } });
      track(draft, 2);
      setDraft(""); clearImage();
      loadFeed();
    } catch (e) {
      if (path) fetch(`${SUPABASE_URL}/storage/v1/object/post-images/${path}`, { method: "DELETE", headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${await getToken()}` } }).catch(() => {});
      showToast("โพสต์ไม่สำเร็จ: " + e.message);
    }
    setPosting(false);
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

  const loadRelations = useCallback(async () => {
    try {
      const r = await rest("/rest/v1/rpc/my_relations", { method: "POST", body: {} });
      setRelations(Object.fromEntries(r.map(x => [x.other, x.status])));
    } catch { /* ไม่เป็นไร ปุ่มจะแสดงเป็น "เพิ่มเพื่อน" */ }
  }, [rest]);
  useEffect(() => { if (session) loadRelations(); }, [session, loadRelations]);
  useEffect(() => {
    if (!session) return;
    rest("/rest/v1/rpc/app_config", { method: "POST", body: {} }).then(c => setDemoMode(!!c?.demo_mode)).catch(() => {});
    rest("/rest/v1/rpc/payment_config", { method: "POST", body: {} }).then(c => c && setPayCfg(c)).catch(() => {});
  }, [session]);
  const reportPost = async (reason) => {
    try {
      await rest("/rest/v1/rpc/report_post", { method: "POST", body: { p_post_id: reportFor, p_reason: reason } });
      showToast("ส่งรายงานแล้ว ขอบคุณที่ช่วยดูแลชุมชน");
    } catch (e) { showToast("รายงานไม่สำเร็จ: " + e.message); }
    setReportFor(null);
  };
  const deletePost = async () => {
    try {
      const delPost = posts.find(x => x.id === deleteFor);
      await rest(`/rest/v1/posts?id=eq.${deleteFor}`, { method: "DELETE" });
      (delPost?.media_urls || []).forEach(async (u) => {
        const path = u.split("/post-images/")[1];
        if (path) fetch(`${SUPABASE_URL}/storage/v1/object/post-images/${path}`, { method: "DELETE", headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${await getToken()}` } }).catch(() => {});
      });
      showToast("ลบโพสต์แล้ว");
      loadFeed();
    } catch (e) { showToast("ลบโพสต์ไม่สำเร็จ: " + e.message); }
    setDeleteFor(null);
  };
  const loadUnread = useCallback(async () => {
    try { const n = await rest("/rest/v1/rpc/unread_count", { method: "POST", body: {} }); setUnread(Number(n) || 0); } catch {}
  }, [rest]);
  useEffect(() => {
    if (!session) return;
    loadUnread();
    const t = setInterval(loadUnread, 60000);
    return () => clearInterval(t);
  }, [session, loadUnread]);
  const pending = Object.values(relations).filter(v => v === "received").length;

  const toggleFriend = async (author) => {
    try {
      if (relations[author.id] === "received") {
        await rest("/rest/v1/rpc/accept_friend_request", { method: "POST", body: { p_user: author.id } });
        setRelations(prev => ({ ...prev, [author.id]: "friends" }));
        showToast(`เป็นเพื่อนกับ ${author.username} แล้ว`);
      } else {
        const st = await rest("/rest/v1/rpc/send_friend_request", { method: "POST", body: { p_user: author.id } });
        setRelations(prev => ({ ...prev, [author.id]: st }));
        showToast(st === "friends" ? `เป็นเพื่อนกับ ${author.username} แล้ว` : `ส่งคำขอเป็นเพื่อนถึง ${author.username} แล้ว`);
      }
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

  // ---------- หน้าจอ: ล็อกอิน / สมัครสมาชิก / ลืมรหัสผ่าน / ตั้งรหัสผ่านใหม่ ----------
  if (!session) {
    const titles = { login: "เข้าสู่ระบบ", signup: "สมัครสมาชิก", forgot: "ลืมรหัสผ่าน", reset: "ตั้งรหัสผ่านใหม่" };
    const canSubmit = !authBusy && (authMode === "reset" ? authPassword.length >= 6
      : authMode === "forgot" ? !!authEmail
      : authEmail && authPassword && (authMode !== "signup" || (authName.trim().length >= 2 && agree)));
    return (
      <div style={{ fontFamily: "'IBM Plex Sans Thai', sans-serif" }} className="min-h-screen bg-[#F3F5FA] flex items-center justify-center px-6">
        <style>{FONT_IMPORT}</style>
        <div className="bg-white rounded-2xl shadow-sm border border-black/5 p-6 w-full max-w-sm">
          <h1 style={{ fontFamily: "'Kanit', sans-serif" }} className="text-xl font-semibold text-[#6C5CE7] mb-1">feedTH</h1>
          <p className="text-xs text-[#9199A8] mb-4">{titles[authMode]}</p>
          <form onSubmit={(e) => { e.preventDefault(); if (canSubmit) handleAuth(); }}>
            <div className="space-y-2 mb-3">
              {authMode === "signup" && <input placeholder="ชื่อที่แสดง (2–30 ตัวอักษร)" maxLength={30} value={authName} onChange={e => setAuthName(e.target.value)} className="w-full text-sm bg-[#F3F5FA] rounded-lg px-3 py-2 outline-none" />}
              {authMode !== "reset" && <input type="email" placeholder="อีเมล" value={authEmail} onChange={e => setAuthEmail(e.target.value)} className="w-full text-sm bg-[#F3F5FA] rounded-lg px-3 py-2 outline-none" />}
              {authMode !== "forgot" && <input type="password" placeholder={authMode === "reset" ? "รหัสผ่านใหม่ (อย่างน้อย 6 ตัว)" : "รหัสผ่าน"} value={authPassword} onChange={e => setAuthPassword(e.target.value)} className="w-full text-sm bg-[#F3F5FA] rounded-lg px-3 py-2 outline-none" />}
            </div>
            {authMode === "signup" && (
              <label className="flex items-start gap-2 text-xs text-[#6B7280] mb-3">
                <input type="checkbox" checked={agree} onChange={e => setAgree(e.target.checked)} className="mt-0.5" />
                <span>ฉันยอมรับ<button type="button" onClick={() => setLegal("terms")} className="text-[#6C5CE7] underline">ข้อกำหนดการใช้งาน</button>และ<button type="button" onClick={() => setLegal("privacy")} className="text-[#6C5CE7] underline">นโยบายความเป็นส่วนตัว</button></span>
              </label>
            )}
            {authError && <p className="text-xs text-[#C43D3D] mb-2">{authError}</p>}
            <button type="submit" disabled={!canSubmit} className="w-full bg-[#6C5CE7] disabled:opacity-40 text-white text-sm font-medium py-2 rounded-lg mb-2">
              {authBusy ? "กำลังทำรายการ..." : authMode === "signup" ? "สมัครสมาชิก" : authMode === "forgot" ? "ส่งลิงก์ตั้งรหัสผ่านใหม่" : authMode === "reset" ? "บันทึกรหัสผ่านใหม่" : "เข้าสู่ระบบ"}
            </button>
          </form>
          {authMode !== "reset" && (
            <button onClick={() => { setAuthError(""); setAuthMode(m => m === "signup" || m === "forgot" ? "login" : "signup"); }} className="w-full text-xs text-[#6B7280] mb-1">
              {authMode === "signup" || authMode === "forgot" ? "มีบัญชีแล้ว? เข้าสู่ระบบ" : "ยังไม่มีบัญชี? สมัครสมาชิก"}
            </button>
          )}
          {authMode === "login" && <button onClick={() => { setAuthError(""); setAuthMode("forgot"); }} className="w-full text-xs text-[#6C5CE7]">ลืมรหัสผ่าน?</button>}
        </div>
        {legal && <LegalModal initial={legal} onClose={() => setLegal(null)} />}
        {toast && <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#1A1D29] text-white text-sm px-4 py-2 rounded-full shadow-lg z-40 max-w-[90%] text-center">{toast}</div>}
      </div>
    );
  }

  const openPlace = (id) => setPlaceView(id);
  const goTab = (t) => { if (t === "profile") setProfileId(null); setPlaceView(null); setPeople(null); setNotif(false); setTab(t); };
  const openNotif = (n) => {
    setNotif(false);
    if (n.type === "friend_request") { setPeople({ userId: session.user_id, tab: "requests" }); return; }
    if (n.type === "friend_accept") { setPeople({ userId: session.user_id, tab: "friends" }); return; }
    setProfileId(n.actor_id); setTab("profile");
  };
  if (shop) return (
    <>
      {shop === "admin" ? <AdminPanel rest={rest} onBack={() => setShop(null)} showToast={showToast} onChanged={() => rest("/rest/v1/rpc/payment_config", { method: "POST", body: {} }).then(c => c && setPayCfg(c)).catch(() => {})} />
        : <BuyCredits rest={rest} cfg={payCfg} onBack={() => setShop(null)} showToast={showToast} onChanged={() => {}} />}
      <TabBar tab={tab} setTab={(t) => { setShop(null); goTab(t); }} badge={pending} />
      {toast && <div className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-[#1A1D29] text-white text-sm px-4 py-2 rounded-full shadow-lg z-40 max-w-[90%] text-center">{toast}</div>}
    </>
  );
  if (notif) return (
    <>
      <NotificationsView rest={rest} onBack={() => setNotif(false)} onOpen={openNotif} onRead={() => { setUnread(0); loadRelations(); }} />
      <TabBar tab={tab} setTab={goTab} badge={pending} />
    </>
  );
  if (people) return (
    <>
      <PeopleView key={people.userId + people.tab} rest={rest} session={session} userId={people.userId} initialTab={people.tab} onBack={() => setPeople(null)}
        onProfile={(id) => { setPeople(null); setProfileId(id); setTab("profile"); }} onChanged={loadRelations} showToast={showToast} />
      <TabBar tab={tab} setTab={goTab} badge={pending} />
      {toast && <div className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-[#1A1D29] text-white text-sm px-4 py-2 rounded-full shadow-lg z-40 max-w-[90%] text-center">{toast}</div>}
    </>
  );
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
        ? <CheckinTab rest={rest} onBack={() => setTab("feed")} showToast={showToast} onOpenPlace={openPlace} onOpenMap={() => { setExploreProv(null); setTab("explore"); }} />
        : tab === "explore"
        ? <ExploreTab rest={rest} prov={exploreProv} setProv={setExploreProv} onOpenPlace={openPlace} showToast={showToast} />
        : tab === "rank"
        ? <RankTab rest={rest} userId={session.user_id} onProfile={(id) => { setProfileId(id); setTab("profile"); }} showToast={showToast} />
        : <ProfileTab key={profileId || session.user_id} rest={rest} session={session} userId={profileId || session.user_id} onLogout={logout} onPrivacy={() => setShowConsent(true)} onPeople={(uid, t) => setPeople({ userId: uid, tab: t })} pending={pending} onLegal={() => setLegal("terms")} onDelete={deleteAccount} showToast={showToast} />}
      <TabBar tab={tab} setTab={goTab} badge={pending} />
      {consentModal}
      {legalModal}
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
            <button onClick={demoMode ? topUp : () => { rest("/rest/v1/rpc/payment_config", { method: "POST", body: {} }).then(c => c && setPayCfg(c)).catch(() => {}); if (payCfg.mode === "manual") setShop("buy"); else showToast("ยังไม่เปิดให้เติมเครดิต"); }} className={`flex items-center gap-1.5 rounded-full pl-2 pr-3 py-1.5 border transition-all ${topUpFlash ? "bg-[#FFB020] border-[#FFB020] scale-105" : "bg-white border-[#FFB020]/40"}`}>
              <Wallet size={15} className={topUpFlash ? "text-white" : "text-[#FFB020]"} />
              <span className={`text-sm font-medium ${topUpFlash ? "text-white" : "text-[#1A1D29]"}`}>{wallet} เครดิต</span>
            </button>
            {payCfg.is_admin && <button onClick={() => setShop("admin")} aria-label="จัดการร้าน" className="text-[#6C5CE7]"><Shield size={17} /></button>}
            <button onClick={() => setNotif(true)} aria-label="การแจ้งเตือน" className="relative text-[#6C5CE7]"><Bell size={17} />{unread > 0 && <span className="absolute -top-1.5 -right-2 min-w-[15px] h-[15px] rounded-full bg-[#EF4565] text-white text-[9px] leading-[15px] text-center px-1">{unread > 9 ? "9+" : unread}</span>}</button>
            <button onClick={() => setTab("checkin")} aria-label="เช็คอิน" className="text-[#6C5CE7]"><MapPin size={17} /></button>
            <button onClick={logout} aria-label="ออกจากระบบ" className="text-[#9199A8] hover:text-[#1A1D29]"><LogOut size={16} /></button>
          </div>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-4 pt-4 space-y-3">
        <div className="bg-white rounded-2xl border border-black/5 p-3 shadow-sm">
          <textarea value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="กำลังคิดอะไรอยู่..." rows={2} className="w-full resize-none outline-none text-sm placeholder:text-[#9199A8]" />
          {img && (
            <div className="relative mt-2">
              <img src={img.url} alt="ตัวอย่างรูป" className="rounded-xl w-full max-h-64 object-cover" />
              <button onClick={clearImage} aria-label="เอารูปออก" className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center"><X size={14} /></button>
            </div>
          )}
          <div className="flex items-center justify-between mt-1">
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={pickImage} data-testid="img-input" />
            <button onClick={() => fileRef.current && fileRef.current.click()} aria-label="เพิ่มรูป" className="text-[#6C5CE7] p-1"><ImagePlus size={20} /></button>
            <button onClick={handlePost} disabled={(!draft.trim() && !img) || posting} className="bg-[#6C5CE7] disabled:opacity-30 text-white text-sm font-medium px-4 py-1.5 rounded-full">{posting ? "กำลังโพสต์..." : "โพสต์"}</button>
          </div>
        </div>

        {loadingFeed && <p className="text-center text-xs text-[#9199A8] py-4">กำลังโหลดฟีด...</p>}

        {posts.map((post) => {
          const isOther = post.author.id !== session.user_id;
          const likedByMe = post.likes.some(l => l.user_id === session.user_id);
          const fStatus = relations[post.author.id];

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
                  <button onClick={() => toggleFriend(post.author)} disabled={fStatus === "sent" || fStatus === "friends"} className={`text-xs font-medium flex items-center gap-1 px-2.5 py-1 rounded-full border ${fStatus === "sent" || fStatus === "friends" ? "border-black/10 text-[#9199A8]" : "border-[#6C5CE7]/30 text-[#6C5CE7]"}`}>
                    {fStatus === "sent" || fStatus === "friends" ? <UserCheck size={12} /> : <UserPlus size={12} />}
                    {fStatus === "sent" ? "รอยืนยัน" : fStatus === "friends" ? "เพื่อน" : fStatus === "received" ? "ยอมรับคำขอ" : "เพิ่มเพื่อน"}
                  </button>
                )}
              </div>

              {post.content && <p className="text-sm leading-relaxed mb-2 whitespace-pre-wrap">{post.content}</p>}
              {(post.media_urls || []).map(u => <img key={u} src={u} alt="รูปในโพสต์" loading="lazy" className="mb-2 rounded-xl w-full max-h-96 object-cover" />)}

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
                {isOther
                  ? <button onClick={() => setReportFor(post.id)} aria-label="รายงานโพสต์" className="ml-auto text-[#9199A8] hover:text-[#C43D3D]"><Flag size={15} /></button>
                  : <button onClick={() => setDeleteFor(post.id)} aria-label="ลบโพสต์" className={`${post.is_boosted ? "ml-auto" : ""} text-[#9199A8] hover:text-[#C43D3D]`}><Trash2 size={15} /></button>}
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

      {reportFor !== null && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-4 relative space-y-2">
            <button onClick={() => setReportFor(null)} aria-label="ปิด" className="absolute top-3 right-3 text-[#9199A8]"><X size={18} /></button>
            <h3 style={{ fontFamily: "'Kanit', sans-serif" }} className="font-semibold">รายงานโพสต์นี้เพราะ...</h3>
            {[["spam", "สแปม/โฆษณาหลอกลวง"], ["inappropriate", "เนื้อหาไม่เหมาะสม/คุกคาม"], ["false_info", "ข้อมูลเท็จ"], ["other", "อื่นๆ"]].map(([k, l]) => (
              <button key={k} onClick={() => reportPost(k)} className="w-full text-left text-sm border border-black/10 rounded-xl px-3 py-2.5">{l}</button>
            ))}
          </div>
        </div>
      )}

      {deleteFor !== null && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-4 space-y-3">
            <h3 style={{ fontFamily: "'Kanit', sans-serif" }} className="font-semibold">ลบโพสต์นี้?</h3>
            <p className="text-xs text-[#6B7280]">คอมเมนต์และไลค์ของโพสต์นี้จะถูกลบด้วย</p>
            <div className="flex gap-2"><button onClick={() => setDeleteFor(null)} className="flex-1 border border-black/10 text-sm py-2 rounded-lg">ยกเลิก</button><button onClick={deletePost} className="flex-1 bg-[#C43D3D] text-white text-sm font-medium py-2 rounded-lg">ลบ</button></div>
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
      {legalModal}
      {toast && <div className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-[#1A1D29] text-white text-sm px-4 py-2 rounded-full shadow-lg z-40 max-w-[90%] text-center">{toast}</div>}
    </div>
  );
}
