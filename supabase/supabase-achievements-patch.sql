-- feedTH achievements patch: เพิ่มสถิติสำหรับตราประทับ (จำนวนพื้นที่ที่ปลดล็อก, จำนวนวันเช็คอิน, สตรีคสูงสุด)
-- รันหลัง fog-patch, รันซ้ำได้ปลอดภัย (create or replace เท่านั้น)
create or replace function public.travel_stats(p_user uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'total', (select count(*) from checkins where user_id = p_user),
    'places', (select count(distinct place_id) from checkins where user_id = p_user),
    'by_cat', coalesce((select jsonb_object_agg(category, n) from (
        select pl.category, count(*) n from checkins c join places pl on pl.id = c.place_id where c.user_id = p_user group by 1) t), '{}'::jsonb),
    'top', coalesce((select jsonb_agg(row_to_json(t)) from (
        select pl.id, pl.name, pl.category, count(*) as visits from checkins c join places pl on pl.id = c.place_id
        where c.user_id = p_user group by pl.id order by visits desc, max(c.created_at) desc limit 10) t), '[]'::jsonb),
    'provinces', coalesce((select jsonb_agg(row_to_json(t)) from (
        select pv.province as name, pv.visited, pv.total from (
          select pl.province, count(distinct c.place_id) visited,
                 (select count(*) from places x where x.province = pl.province) total
          from checkins c join places pl on pl.id = c.place_id
          where c.user_id = p_user and pl.province is not null group by pl.province) pv order by pv.visited desc) t), '[]'::jsonb),
    'followers', (select count(*) from follows where followee_id = p_user),
    'following', (select count(*) from follows where follower_id = p_user),
    'u', coalesce((select jsonb_object_agg(level, n) from (select level, count(*) n from area_unlocks where user_id = p_user group by level) t), '{}'::jsonb),
    'days', (select count(distinct checkin_date) from checkins where user_id = p_user),
    'best_streak', coalesce((select max(n) from (
        select count(*) n from (
          select dt - (row_number() over (order by dt))::int g from (select distinct checkin_date dt from checkins where user_id = p_user) d) x
        group by g) y), 0)
  );
$$;
