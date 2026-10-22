// service worker แบบเบา: เก็บหน้าเว็บ/ไฟล์ของแอปไว้เปิดเร็วและเปิดได้แม้สัญญาณหลุด
// ไม่แคชคำขอไป Supabase (ข้ามโดเมน) ข้อมูลจึงสดเสมอ
const CACHE = "feedth-v12";
self.addEventListener("install", (e) => { self.skipWaiting(); });
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(req).then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); return res; })
      .catch(() => caches.match(req).then(r => r || caches.match("./")))
  );
});
