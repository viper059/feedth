-- feedTH: แท็บสำรวจ (จังหวัด -> สถานที่) รันซ้ำได้ ไม่มีคำสั่งลบ
create or replace function public.explore_provinces()
returns table (name text, places bigint, visited bigint)
language sql stable security definer set search_path = public as $$
  select p.province, count(*),
         count(*) filter (where exists (select 1 from checkins c where c.place_id = p.id and c.user_id = auth.uid()))
  from places p where p.province is not null
  group by p.province order by 2 desc, 1;
$$;

create or replace function public.explore_places(p_province text)
returns table (id bigint, name text, category text, is_verified boolean, is_boosted boolean,
               avg_rating numeric, checkin_count bigint, visited_by_me boolean)
language sql stable security definer set search_path = public as $$
  select p.id, p.name, p.category, p.is_verified, coalesce(p.boost_expire_at > now(), false),
         round((select avg(rating) from checkins c where c.place_id = p.id and rating is not null)::numeric, 1),
         (select count(*) from checkins c where c.place_id = p.id),
         exists (select 1 from checkins c where c.place_id = p.id and c.user_id = auth.uid())
  from places p where p.province = p_province
  order by 5 desc, 7 desc, p.name limit 200;
$$;

revoke execute on function public.explore_provinces(), public.explore_places(text) from public, anon;
grant execute on function public.explore_provinces(), public.explore_places(text) to authenticated;
