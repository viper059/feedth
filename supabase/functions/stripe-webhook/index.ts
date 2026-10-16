// รับ webhook จาก Stripe แล้วเติมเครดิตเมื่อจ่ายสำเร็จ (ยืนยันลายเซ็นก่อนเสมอ)
// ยังไม่ได้ทดสอบกับ Stripe จริง — ต้อง deploy ด้วย --no-verify-jwt (Stripe ไม่ส่ง JWT) ตาม supabase/PAYMENTS.md
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const enc = new TextEncoder();
async function verify(payload: string, header: string, secret: string): Promise<boolean> {
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=") as [string, string]));
  const t = parts["t"], v1 = parts["v1"];
  if (!t || !v1 || Math.abs(Date.now() / 1000 - Number(t)) > 300) return false;
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(`${t}.${payload}`)));
  const hex = Array.from(sig).map((b) => b.toString(16).padStart(2, "0")).join("");
  return hex === v1;
}

Deno.serve(async (req) => {
  const payload = await req.text();
  const ok = await verify(payload, req.headers.get("stripe-signature") ?? "", Deno.env.get("STRIPE_WEBHOOK_SECRET")!);
  if (!ok) return new Response("bad signature", { status: 400 });
  const event = JSON.parse(payload);
  // PromptPay จ่ายแบบไม่ทันที: ใช้ async_payment_succeeded ด้วย
  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    const s = event.data.object;
    if (s.payment_status === "paid") {
      const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const { error } = await admin.rpc("fulfill_order", { p_provider_ref: s.id });
      if (error) return new Response(error.message, { status: 500 }); // ให้ Stripe ลองส่งใหม่
    }
  }
  return new Response("ok");
});
