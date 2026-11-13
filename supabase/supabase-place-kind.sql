-- (ใช้แล้วผ่าน migration place_kind_and_pins_v2) ประเภทย่อยของสถานที่ + ฟังก์ชันหมุดที่ส่งประเภทกลับมา
alter table public.places add column if not exists kind text;
update public.places p set kind = case s.cat when 'park' then 'park' when 'national_park' then 'park' when 'beach' then 'beach'
  when 'waterfall' then 'waterfall' when 'museum' then 'museum' when 'place_of_worship' then 'temple' end
  from public.overture_stage s where p.osm_ref = 'ovt:' || s.id and s.cat in ('park','national_park','beach','waterfall','museum','place_of_worship') and p.kind is null;
update public.places set kind = 'temple' where kind is null and category = 'attraction' and (name like 'วัด%' or name ilike 'wat %');
update public.places set kind = 'park' where kind is null and category = 'attraction' and (name like '%อุทยาน%' or name ilike '%national park%');
create or replace function public.my_place_pins_v2()
returns table(id bigint, name text, lat double precision, lng double precision, province text, visits bigint, last_at timestamptz, category text, kind text)
language sql stable set search_path = public as $$
  select p.id, p.name, p.lat, p.lng, p.province, count(*)::bigint, max(c.created_at), p.category, p.kind
  from checkins c join places p on p.id = c.place_id
  where c.user_id = auth.uid() and p.lat is not null and p.lng is not null
  group by p.id order by max(c.created_at) desc limit 5000;
$$;
revoke execute on function public.my_place_pins_v2() from public, anon;
grant execute on function public.my_place_pins_v2() to authenticated;
