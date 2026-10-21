// สร้างการ์ดภาพ "พาสปอร์ตนักเที่ยว" (1080x1350) สำหรับแชร์ลงโซเชียล วาดด้วย canvas ในเครื่อง ไม่ส่งข้อมูลไปไหน
const W = 1080, H = 1350;

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

export async function buildShareCard({ name, stats, link }) {
  try { await Promise.all([document.fonts.load("600 64px Kanit"), document.fonts.load("400 32px 'Noto Sans Thai'")]); } catch { /* ใช้ฟอนต์สำรอง */ }
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const x = c.getContext("2d");
  const F = "Kanit, 'Noto Sans Thai', system-ui, sans-serif";
  const g = x.createLinearGradient(0, 0, W, H); g.addColorStop(0, "#7B61FF"); g.addColorStop(1, "#FF5C8A");
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  // วงตกแต่ง
  x.fillStyle = "rgba(255,255,255,0.08)"; x.beginPath(); x.arc(W - 120, 160, 260, 0, 7); x.fill(); x.beginPath(); x.arc(100, H - 220, 220, 0, 7); x.fill();
  // หมุด (path เดียวกับไอคอนแอป)
  x.save(); x.translate(30, 20); x.scale(0.4, 0.4); x.translate(-110, -90);
  x.fillStyle = "#fff"; x.fill(new Path2D("M256 96c-62 0-112 48-112 108 0 78 112 212 112 212s112-134 112-212c0-60-50-108-112-108z"));
  x.fillStyle = "#7B61FF"; x.beginPath(); x.arc(256, 204, 42, 0, 7); x.fill(); x.restore();
  x.fillStyle = "#fff"; x.textBaseline = "alphabetic";
  x.font = `600 56px ${F}`; x.fillText("ปักหมุด", 210, 100);
  x.font = `400 30px ${F}`; x.globalAlpha = 0.9; x.fillText("พาสปอร์ตนักเที่ยว", 210, 145); x.globalAlpha = 1;

  const nm = (name || "นักเที่ยว").slice(0, 22);
  x.font = `600 88px ${F}`; x.fillText(nm, 70, 360);
  x.font = `400 38px ${F}`; x.globalAlpha = 0.92; x.fillText("ใครจะเที่ยวเยอะกว่ากัน? มาแข่งกัน 😎", 70, 425); x.globalAlpha = 1;

  const prov = (stats.u && stats.u.pro) || (stats.provinces || []).length || 0;
  const items = [
    [stats.total || 0, "เช็คอินทั้งหมด"],
    [prov, "จังหวัดที่ไปมาแล้ว"],
    [stats.places || 0, "สถานที่ไม่ซ้ำ"],
    [stats.stampsOn + "/" + stats.stampsTotal, "ตราประทับ"],
  ];
  items.forEach(([v, l], i) => {
    const bx = 70 + (i % 2) * 470, by = 500 + Math.floor(i / 2) * 270;
    x.fillStyle = "rgba(255,255,255,0.95)"; rr(x, bx, by, 440, 240, 40); x.fill();
    x.fillStyle = "#6C5CE7"; x.font = `600 120px ${F}`; x.textAlign = "center"; x.fillText(String(v), bx + 220, by + 138);
    x.fillStyle = "#4B5468"; x.font = `400 36px ${F}`; x.fillText(l, bx + 220, by + 196); x.textAlign = "left";
  });
  if (stats.best_streak > 1) {
    x.fillStyle = "#fff"; x.font = `500 40px ${F}`; x.fillText(`🔥 เช็คอินต่อเนื่องสูงสุด ${stats.best_streak} วัน`, 70, 1100);
  }
  x.fillStyle = "rgba(255,255,255,0.95)"; rr(x, 70, 1160, W - 140, 130, 36); x.fill();
  x.fillStyle = "#1A1D29"; x.font = `600 40px ${F}`; x.fillText("มาปักหมุดด้วยกัน • ใช้ฟรี", 110, 1222);
  x.fillStyle = "#6C5CE7"; x.font = `400 30px ${F}`; x.fillText((link || "").replace(/^https?:\/\//, "").slice(0, 52), 110, 1268);
  return await new Promise((res) => c.toBlob(res, "image/png"));
}

export async function shareCard({ name, stats, link, text }) {
  const blob = await buildShareCard({ name, stats, link });
  const file = new File([blob], "pinworld-passport.png", { type: "image/png" });
  if (navigator.canShare && navigator.canShare({ files: [file] }) && navigator.share) {
    try { await navigator.share({ files: [file], title: "ปักหมุด", text: `${text}\n${link}` }); } catch { /* ผู้ใช้ปิด */ }
    return "shared";
  }
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = file.name; document.body.appendChild(a); a.click(); a.remove();
  return "downloaded";
}
