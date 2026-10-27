# Worker ลิงก์แชร์รายโพสต์
1. Cloudflare → Workers → สร้าง Worker ใหม่ (หรือใช้ตัวเดิม) → วางโค้ดจาก worker.js แล้ว Deploy
2. Settings → Variables: SUPABASE_URL, SUPABASE_ANON_KEY (ค่า anon/publishable เหมือนที่แอปใช้), APP_URL = https://pinsworld.net/
3. ทดสอบ: เปิด https://<ชื่อ>.workers.dev/p/<id โพสต์> ต้องเด้งเข้าแอป และ Facebook Sharing Debugger ต้องเห็นรูปโพสต์
4. ตั้ง VITE_SHARE_BASE=https://<ชื่อ>.workers.dev ตอน build แอป
