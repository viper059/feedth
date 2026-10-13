# feedTH

1. Supabase: รัน supabase/ ทั้ง 3 ไฟล์ตามลำดับ (schema -> security-patch -> places-patch) ใน SQL Editor
2. รันในเครื่อง: `npm install` แล้วคัดลอก `.env.example` เป็น `.env` ใส่ค่าจริง จากนั้น `npm run dev`
3. ขึ้น GitHub Pages: push ขึ้น repo (branch main) > Settings > Pages > Source = GitHub Actions
   > Settings > Secrets and variables > Actions เพิ่ม VITE_SUPABASE_URL และ VITE_SUPABASE_ANON_KEY
4. Supabase > Authentication > URL Configuration ใส่ Site URL เป็นที่อยู่เว็บบน github.io
ห้ามใส่ service_role key ในโปรเจกต์นี้เด็ดขาด
