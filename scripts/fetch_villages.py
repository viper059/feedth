#!/usr/bin/env python3
"""ดึงหมู่บ้านทั้งประเทศไทยจาก OpenStreetMap (Overpass) ทีละจังหวัด -> th_villages_osm.csv (id,name,lat,lng)
รัน:  python3 fetch_villages.py        (ใช้ได้ต่อเนื่อง: จังหวัดที่ดึงแล้วจะข้าม ถ้าสะดุดรันซ้ำได้)
ข้อมูล © OpenStreetMap contributors (ODbL)"""
import csv, json, os, sys, time, urllib.parse, urllib.request

CODES = [10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52,53,54,55,56,57,58,60,61,62,63,64,65,66,67,70,71,72,73,74,75,76,77,80,81,82,83,84,85,86,90,91,92,93,94,95,96]
SERVERS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"]
OUT, DONE = "th_villages_osm.csv", "th_villages_done.txt"

def query(code):
    q = f'[out:json][timeout:180];area["ISO3166-2"="TH-{code}"]->.a;node["place"~"^(village|hamlet)$"](area.a);out;'
    data = urllib.parse.urlencode({"data": q}).encode()
    for attempt in range(6):
        url = SERVERS[attempt % len(SERVERS)]
        try:
            with urllib.request.urlopen(urllib.request.Request(url, data, headers={"User-Agent": "pinworld-village-import/1.0"}), timeout=200) as r:
                return json.load(r)["elements"]
        except Exception as e:
            print(f"  {code}: {e} (retry {attempt+1})", file=sys.stderr); time.sleep(10 * (attempt + 1))
    raise SystemExit(f"จังหวัด {code} ดึงไม่สำเร็จ — รันใหม่อีกครั้งเพื่อทำต่อ")

done = set(open(DONE).read().split()) if os.path.exists(DONE) else set()
new_file = not os.path.exists(OUT)
with open(OUT, "a", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    if new_file: w.writerow(["id", "name", "lat", "lng"])
    for c in CODES:
        if str(c) in done: continue
        els = query(c); n = 0
        for e in els:
            t = e.get("tags", {}); name = (t.get("name:th") or t.get("name") or "").strip()
            if name: w.writerow([e["id"], name, e["lat"], e["lon"]]); n += 1
        f.flush(); open(DONE, "a").write(f"{c}\n")
        print(f"TH-{c}: {n} หมู่บ้าน"); time.sleep(5)
print("เสร็จ ->", OUT)
