// สร้างหน้าชำระเงิน Stripe Checkout (PromptPay) ให้ผู้ใช้ที่ล็อกอินอยู่
// ยังไม่ได้ทดสอบกับ Stripe จริง — ต้องตั้ง secrets ตาม supabase/PAYMENTS.md ก่อน deploy
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type" };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const url = Deno.env.get("SUPABASE_URL")!;
    const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "not signed in" }), { status: 401, headers: cors });

    const { package_id } = await req.json();
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: pkg } = await admin.from("credit_packages").select("*").eq("id", package_id).eq("active", true).single();
    if (!pkg) return new Response(JSON.stringify({ error: "package not available" }), { status: 400, headers: cors });

    const site = Deno.env.get("SITE_URL")!; // เช่น https://viper059.github.io/feedth/
    const form = new URLSearchParams({
      mode: "payment",
      "payment_method_types[0]": "promptpay",
      "line_items[0][quantity]": "1",
      "line_items[0][price_data][currency]": "thb",
      "line_items[0][price_data][unit_amount]": String(Math.round(Number(pkg.price_thb) * 100)),
      "line_items[0][price_data][product_data][name]": `เครดิต feedTH ${pkg.credits}`,
      success_url: `${site}?paid=1`,
      cancel_url: `${site}?paid=0`,
      client_reference_id: user.id,
    });
    const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: { Authorization: `Bearer ${Deno.env.get("STRIPE_SECRET_KEY")}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: form,
    });
    const session = await res.json();
    if (!res.ok) return new Response(JSON.stringify({ error: session.error?.message ?? "stripe error" }), { status: 502, headers: cors });

    const { error } = await admin.from("orders").insert({
      user_id: user.id, package_id: pkg.id, credits: pkg.credits, amount_thb: pkg.price_thb, provider: "stripe", provider_ref: session.id,
    });
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: cors });
    return new Response(JSON.stringify({ url: session.url }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: cors });
  }
});
