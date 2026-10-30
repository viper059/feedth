-- อันดับนักเดินทางแบบ "คะแนน" (leaderboard_v2) — รันใน Supabase SQL Editor
-- p_sort: 'score' | 'checkins' | 'rating_sum' | 'likes_received'    p_period: 'all' | 'week'
-- คะแนนรวม = เช็คอิน*5 + area_unlocks + village_unlocks (ถ้ามีตาราง) + mission_claims + โบนัสชวนเพื่อน/ทริป (ถ้ามีฟังก์ชัน)
-- รายสัปดาห์ นับเฉพาะเช็คอิน ปลดล็อก และภารกิจที่เกิดตั้งแต่ต้นสัปดาห์ (เวลาไทย) ไม่รวมโบนัส
-- ตรวจให้ตรงกับ my_explore().score: select pg_get_functiondef('public.my_explore()'::regprocedure);

create or replace function public._user_score(p_uid uuid, p_since timestamptz default null)
returns bigint language plpgsql stable security definer set search_path = public as $$
declare v bigint; x bigint;
begin
  v := (select count(*) * 5 from checkins c where c.user_id = p_uid and (p_since is null or c.created_at >= p_since))
     + coalesce((select sum(points) from area_unlocks a where a.user_id = p_uid and (p_since is null or a.created_at >= p_since)), 0)
     + coalesce((select sum(points) from mission_claims m where m.user_id = p_uid and (p_since is null or m.created_at >= p_since)), 0);
  if p_since is null then
    if to_regclass('public.village_unlocks') is not null then
      execute 'select coalesce(sum(points), 0) from village_unlocks where user_id = $1' into x using p_uid; v := v + coalesce(x, 0);
    end if;
    if to_regprocedure('public._referral_bonus(uuid)') is not null then
      execute 'select public._referral_bonus($1)::bigint' into x using p_uid; v := v + coalesce(x, 0);
    end if;
    if to_regprocedure('public._trip_bonus(uuid)') is not null then
      execute 'select public._trip_bonus($1)::bigint' into x using p_uid; v := v + coalesce(x, 0);
    end if;
  end if;
  return v;
end $$;
revoke execute on function public._user_score(uuid, timestamptz) from public, anon, authenticated;

create or replace function public.leaderboard_v2(p_sort text default 'score', p_period text default 'all')
returns table (user_id uuid, username text, checkins bigint, rating_sum bigint, likes_received bigint, score bigint, total_score bigint)
language sql stable security definer set search_path = public as $$
  with since as (select case when p_period = 'week' then date_trunc('week', now() at time zone 'Asia/Bangkok') at time zone 'Asia/Bangkok' end s),
  t as (
    select u.id, u.display_name,
           (select count(*) from checkins c where c.user_id = u.id) ck,
           (select coalesce(sum(rating), 0) from checkins c where c.user_id = u.id) rs,
           (select count(*) from likes l join posts po on po.id = l.post_id where po.user_id = u.id and po.place_id is not null) lk,
           public._user_score(u.id, (select s from since)) sc,
           public._user_score(u.id, null) tsc
    from profiles u where exists (select 1 from checkins c where c.user_id = u.id)
  )
  select id, display_name, ck, rs, lk, sc, tsc from t
  where p_sort <> 'score' or sc > 0
  order by case p_sort when 'rating_sum' then rs when 'likes_received' then lk when 'checkins' then ck else sc end desc, tsc desc
  limit 50;
$$;
revoke execute on function public.leaderboard_v2(text, text) from public, anon;
grant execute on function public.leaderboard_v2(text, text) to authenticated;

-- ===== หมุดตำบล/อำเภอ ปักตรงสถานที่จริงที่เช็คอินครั้งแรกในพื้นที่นั้น =====
create or replace function public.my_area_pins()
returns table (level text, code text, lat float8, lng float8, place_name text)
language sql stable security invoker set search_path = public as $$
  select a.level, a.code, p.lat, p.lng, p.name
  from area_unlocks a
  join checkins c on c.id = a.checkin_id
  join places p on p.id = c.place_id
  where a.user_id = auth.uid() and a.level in ('dis', 'sub');
$$;
revoke execute on function public.my_area_pins() from public, anon;
grant execute on function public.my_area_pins() to authenticated;
