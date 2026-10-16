# เปิดรับชำระเงินจริง (Stripe + PromptPay) — ขั้นตอนที่เจ้าของต้องทำ

สถานะ: ฐานข้อมูลพร้อมแล้ว (ตาราง `credit_packages`, `orders`, ฟังก์ชัน `fulfill_order` — ทดสอบแล้วว่าเติมครั้งเดียวต่อออเดอร์)
โค้ด Edge Function ใน `supabase/functions/` **ยังไม่ได้ทดสอบกับ Stripe จริง** และยังไม่ได้ deploy; ปุ่มซื้อเครดิตในแอปยังไม่มี

1. สมัครบัญชี Stripe ประเทศไทย และเปิดใช้ PromptPay (ต้องยืนยันตัวตนธุรกิจ/บุคคลตามที่ Stripe กำหนด)
2. ตั้งแพ็กเกจและราคาเอง (ราคาเป็นการตัดสินใจของเจ้าของ) ใน SQL Editor เช่น
   `insert into credit_packages (id, credits, price_thb, active) values ('p100', 100, <ราคา>, true);`
3. ตั้ง secrets: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SITE_URL` (https://viper059.github.io/feedth/)
4. deploy: `create-checkout` (ปกติ) และ `stripe-webhook` (ต้องใส่ `--no-verify-jwt`)
5. ใน Stripe Dashboard สร้าง webhook ชี้ไปที่ `https://<project>.supabase.co/functions/v1/stripe-webhook` รับเหตุการณ์
   `checkout.session.completed` และ `checkout.session.async_payment_succeeded`
6. ทดสอบด้วยโหมดทดสอบของ Stripe ให้ครบก่อนใช้คีย์จริง แล้วค่อยให้ผมต่อปุ่มซื้อเครดิตในแอป
7. ก่อนเก็บเงินจริง: ตรวจข้อกำหนด/นโยบายคืนเงิน และภาษี (VAT) กับผู้เชี่ยวชาญ
