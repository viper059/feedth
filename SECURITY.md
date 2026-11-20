# ความปลอดภัยฝั่งเว็บ (Security headers)

## ที่อยู่ในโค้ดแล้ว
- `index.html` มี `<meta http-equiv="Content-Security-Policy">` (บล็อกสคริปต์/รูป/การเชื่อมต่อจากโดเมนที่ไม่อยู่ในรายการ, ห้าม object/base ปลอม)
- หน้าสถานที่ที่ prerender (`scripts/prerender-places.mjs`) มี CSP แบบปิดสนิท (ไม่รันสคริปต์ใดๆ)
- ถ้าเพิ่มบริการภายนอกใหม่ (เช่น วิเคราะห์ผู้เข้าชม, ฟอนต์ใหม่) ต้องเพิ่มโดเมนใน CSP ไม่งั้นจะถูกบล็อก

## ต้องตั้งที่ Cloudflare (GitHub Pages ตั้ง header เองไม่ได้)
Cloudflare → โดเมน pinsworld.net → Rules → Transform Rules → Modify Response Header → Create rule
(When: Hostname equals pinsworld.net) → Set static:

| Header | ค่า |
|---|---|
| Content-Security-Policy | `frame-ancestors 'none'` |
| X-Content-Type-Options | `nosniff` |
| Strict-Transport-Security | `max-age=31536000; includeSubDomains` |
| Permissions-Policy | `camera=(), microphone=(), payment=(), geolocation=(self)` |
| Cross-Origin-Opener-Policy | `same-origin-allow-popups` |

หมายเหตุ: `frame-ancestors` ใส่ใน meta ไม่ได้ ต้องเป็น header เท่านั้น (กันคนเอาเว็บเราไปครอบ iframe หลอกให้กด)
`geolocation=(self)` เพราะแอปใช้ตำแหน่งตอนเช็คอิน
