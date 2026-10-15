// ข้อมูลเขตแดนสำหรับแผนที่หมอก — ไฟล์อยู่ใน public/geo (โหลดเมื่อใช้งานเท่านั้น)
// ขอบเขตประเทศไทย: OpenGISData-Thailand (CC BY 4.0) · ประเทศ/ทวีป: Natural Earth (public domain)
import { geoContains, geoBounds } from "d3-geo";

const BASE = (import.meta.env.BASE_URL || "./") + "geo/";
const cache = new Map();
const getJSON = (name) => {
  if (!cache.has(name)) {
    const p = fetch(BASE + name).then(r => { if (!r.ok) throw new Error("geo " + name + " " + r.status); return r.json(); });
    p.catch(() => cache.delete(name)); // ลองใหม่ได้ถ้าโหลดพลาด
    cache.set(name, p);
  }
  return cache.get(name);
};

export const loadBase = async () => {
  const b = await getJSON("base.json");
  if (!b._ready) { b.pro.features.forEach(f => { f.__bb = geoBounds(f); }); b._ready = true; }
  return b;
};
export const loadDis = () => getJSON("dis.json");
export const loadSub = (pc) => getJSON(`sub/${pc}.json`);

const inBB = (bb, lng, lat) => lng >= bb[0][0] && lng <= bb[1][0] && lat >= bb[0][1] && lat <= bb[1][1];

// หาจังหวัด/อำเภอ/ตำบลของพิกัด (ใช้ point-in-polygon จริง) คืน null ถ้าอยู่นอกประเทศไทย
export async function locateAt(lat, lng) {
  const pt = [lng, lat];
  const base = await loadBase();
  const pro = base.pro.features.find(f => inBB(f.__bb, lng, lat) && geoContains(f, pt));
  if (!pro) return null;
  const out = { pro: pro.properties.c, reg: pro.properties.r };
  const dis = (await loadDis()).features.find(f => f.properties.pc === out.pro && geoContains(f, pt));
  if (dis) {
    out.dis = dis.properties.c;
    const sub = (await loadSub(out.pro)).features.find(f => f.properties.dc === out.dis && geoContains(f, pt));
    if (sub) out.sub = sub.properties.c;
  }
  return out;
}

export const LEVELS = [
  { k: "con", name: "ทวีป", pts: 500 },
  { k: "cty", name: "ประเทศ", pts: 200 },
  { k: "reg", name: "ภูมิภาค", pts: 100 },
  { k: "pro", name: "จังหวัด", pts: 50 },
  { k: "dis", name: "อำเภอ", pts: 20 },
  { k: "sub", name: "ตำบล", pts: 10 },
];
export const BASE_POINTS = 5;
export const RANKS = [[0, "มือใหม่"], [100, "นักเดินทาง"], [300, "ผู้สำรวจ"], [900, "นักผจญภัย"], [2500, "ผู้พิชิตแผนที่"], [6000, "ตำนานนักเดินทาง"]];
export const REGION_TH = { North: "ภาคเหนือ", West: "ภาคตะวันตก", Central: "ภาคกลาง", Northeast: "ภาคตะวันออกเฉียงเหนือ", East: "ภาคตะวันออก", South: "ภาคใต้" };
export const CONTINENT_TH = { Africa: "แอฟริกา", Asia: "เอเชีย", "South America": "อเมริกาใต้", Europe: "ยุโรป", Oceania: "โอเชียเนีย", "North America": "อเมริกาเหนือ", Antarctica: "แอนตาร์กติกา" };
export const COUNTRY_TH = { THA: "ประเทศไทย" };
