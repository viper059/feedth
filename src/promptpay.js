// สร้าง payload ของ PromptPay QR (EMVCo / Thai QR) ฝังยอดเงิน — รองรับเบอร์มือถือ (10 หลัก) และเลขบัตรประชาชน/นิติบุคคล (13 หลัก)
import qrcode from "qrcode-generator";

const f = (id, v) => id + String(v.length).padStart(2, "0") + v;
function crc16(s) {
  let c = 0xffff;
  for (let i = 0; i < s.length; i++) {
    c ^= s.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b++) c = c & 0x8000 ? ((c << 1) ^ 0x1021) & 0xffff : (c << 1) & 0xffff;
  }
  return c.toString(16).toUpperCase().padStart(4, "0");
}
export function promptPayPayload(target, amount) {
  const t = String(target || "").replace(/\D/g, "");
  let acct;
  if (t.length === 10 && t.startsWith("0")) acct = f("01", "0066" + t.slice(1));
  else if (t.length === 13) acct = f("02", t);
  else return null;
  const merchant = f("29", f("00", "A000000677010111") + acct);
  const amt = Number(amount);
  const body = f("00", "01") + f("01", amt > 0 ? "12" : "11") + merchant + f("53", "764") + (amt > 0 ? f("54", amt.toFixed(2)) : "") + f("58", "TH");
  const raw = body + "6304";
  return raw + crc16(raw);
}
export function qrDataUrl(payload) {
  const q = qrcode(0, "M"); q.addData(payload); q.make();
  return q.createDataURL(6, 2);
}
