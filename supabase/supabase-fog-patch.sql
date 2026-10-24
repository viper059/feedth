-- feedTH fog-of-war patch: แผนที่หมอก (ปลดล็อกจังหวัด/อำเภอ/ตำบลด้วยการเช็คอิน) + สตรีค + ภารกิจประจำสัปดาห์
-- รันหลัง reviews-patch / explore-patch, รันซ้ำได้ปลอดภัย (ไม่มี DROP)
-- ข้อมูล admin_areas (77 จังหวัด 928 อำเภอ 7,367 ตำบล) โหลดแยกจาก public/geo/admin_areas.json
-- ที่มาขอบเขต: OpenGISData-Thailand (CC BY 4.0)

create table if not exists public.admin_areas (
  level text not null check (level in ('pro','dis','sub')),
  code text not null,
  name_th text not null,
  parent text,                 -- dis -> รหัสจังหวัด, sub -> รหัสอำเภอ
  lat float8 not null,         -- จุดกึ่งกลางพื้นที่
  lng float8 not null,
  radius_km float8 not null,   -- ระยะจากจุดกึ่งกลางถึงขอบไกลสุด (+0.5 กม.) ใช้ตรวจว่าสถานที่อยู่ในพื้นที่ที่อ้างจริง
  region text,                 -- เฉพาะจังหวัด: North/Central/...
  primary key (level, code)
);
create index if not exists admin_areas_parent_idx on public.admin_areas(level, parent);
alter table public.admin_areas enable row level security;

create table if not exists public.area_unlocks (
  user_id uuid not null references public.profiles(id) on delete cascade,
  level text not null check (level in ('con','cty','reg','pro','dis','sub')),
  code text not null,
  points int not null,
  checkin_id bigint references public.checkins(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (user_id, level, code)
);
alter table public.area_unlocks enable row level security;

create table if not exists public.mission_claims (
  user_id uuid not null references public.profiles(id) on delete cascade,
  week date not null,
  mission text not null,
  points int not null,
  created_at timestamptz not null default now(),
  primary key (user_id, week, mission)
);
alter table public.mission_claims enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='admin_areas' and policyname='admin areas viewable by everyone') then
    create policy "admin areas viewable by everyone" on public.admin_areas for select using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='area_unlocks' and policyname='users read own unlocks') then
    create policy "users read own unlocks" on public.area_unlocks for select using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='mission_claims' and policyname='users read own claims') then
    create policy "users read own claims" on public.mission_claims for select using (auth.uid() = user_id);
  end if;
end $$;
-- ไม่มี policy insert/update: เขียนผ่านฟังก์ชันด้านล่างเท่านั้น (กันปลอมคะแนน)

-- ภารกิจประจำสัปดาห์ (สัปดาห์เริ่มวันจันทร์ เวลาไทย) คำนวณจากข้อมูลจริงทุกครั้ง
create or replace function public._mission_defs(p_uid uuid, p_wk date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_days int; v_sub int; v_food int; v_claimed text[];
begin
  select count(distinct checkin_date) into v_days from checkins where user_id = p_uid and checkin_date >= p_wk;
  select count(*) into v_sub from area_unlocks
    where user_id = p_uid and level = 'sub' and (created_at at time zone 'Asia/Bangkok')::date >= p_wk;
  select count(distinct c.place_id) into v_food from checkins c join places p on p.id = c.place_id
    where c.user_id = p_uid and c.checkin_date >= p_wk and p.category in ('restaurant','cafe');
  select coalesce(array_agg(mission), '{}') into v_claimed from mission_claims where user_id = p_uid and week = p_wk;
  return jsonb_build_array(
    jsonb_build_object('id','days3','title','เช็คอิน 3 วันต่างกัน','goal',3,'progress',least(v_days,3),'points',30,'claimed','days3' = any(v_claimed)),
    jsonb_build_object('id','sub2','title','ปลดล็อกตำบลใหม่ 2 แห่ง','goal',2,'progress',least(v_sub,2),'points',40,'claimed','sub2' = any(v_claimed)),
    jsonb_build_object('id','food2','title','เช็คอินร้านอาหาร/คาเฟ่ 2 ที่','goal',2,'progress',least(v_food,2),'points',20,'claimed','food2' = any(v_claimed))
  );
end $$;
revoke execute on function public._mission_defs(uuid, date) from public, anon, authenticated;

-- เช็คอิน + ปลดล็อกพื้นที่ (ตรวจรหัสที่ client อ้างกับตาราง admin_areas ฝั่งเซิร์ฟเวอร์)
create or replace function public.check_in_v2(p_place_id bigint, p_lat float8, p_lng float8, p_rating int, p_caption text,
                                              p_pro text, p_dis text, p_sub text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_id bigint; v_place places%rowtype; v_pro admin_areas%rowtype; v_dis admin_areas%rowtype; v_sub admin_areas%rowtype;
  v_new jsonb := '[]'::jsonb; v_pts int := 5; v_n int;

begin
  v_id := public.check_in(p_place_id, p_lat, p_lng, p_rating, p_caption); -- ตรวจระยะ/ความเร็ว/สร้างโพสต์เหมือนเดิม
  select * into v_place from places where id = p_place_id;

  select * into v_pro from admin_areas where level = 'pro' and code = p_pro
    and dist_m(v_place.lat, v_place.lng, lat, lng) <= radius_km * 1000;
  if found then
    -- ทวีป/ประเทศ/ภูมิภาค อนุมานจากจังหวัดที่ตรวจแล้ว
    with ins as (
      insert into area_unlocks (user_id, level, code, points, checkin_id) values
        (auth.uid(), 'con', 'Asia', 500, v_id), (auth.uid(), 'cty', 'THA', 200, v_id),
        (auth.uid(), 'reg', v_pro.region, 100, v_id), (auth.uid(), 'pro', v_pro.code, 50, v_id)
      on conflict do nothing returning level, code, points)
    select coalesce(jsonb_agg(jsonb_build_object('level', level, 'code', code, 'name', case when level = 'pro' then v_pro.name_th end, 'points', points)), '[]'::jsonb),
           coalesce(sum(points), 0) into v_new, v_n from ins;
    v_pts := v_pts + v_n;

    select * into v_dis from admin_areas where level = 'dis' and code = p_dis and parent = v_pro.code
      and dist_m(v_place.lat, v_place.lng, lat, lng) <= radius_km * 1000;
    if found then
      insert into area_unlocks (user_id, level, code, points, checkin_id) values (auth.uid(), 'dis', v_dis.code, 20, v_id)
        on conflict do nothing;
      get diagnostics v_n = row_count;
      if v_n > 0 then
        v_new := v_new || jsonb_build_array(jsonb_build_object('level','dis','code',v_dis.code,'name',v_dis.name_th,'points',20)); v_pts := v_pts + 20;
      end if;

      select * into v_sub from admin_areas where level = 'sub' and code = p_sub and parent = v_dis.code
        and dist_m(v_place.lat, v_place.lng, lat, lng) <= radius_km * 1000;
      if found then
        insert into area_unlocks (user_id, level, code, points, checkin_id) values (auth.uid(), 'sub', v_sub.code, 10, v_id)
          on conflict do nothing;
        get diagnostics v_n = row_count;
        if v_n > 0 then
          v_new := v_new || jsonb_build_array(jsonb_build_object('level','sub','code',v_sub.code,'name',v_sub.name_th,'points',10)); v_pts := v_pts + 10;
        end if;
      end if;
    end if;
  end if;
  return jsonb_build_object('checkin_id', v_id, 'points', v_pts, 'unlocks', v_new);
end $$;

-- รับรางวัลภารกิจ (ตรวจว่าทำครบจริง รับได้ครั้งเดียวต่อสัปดาห์)
create or replace function public.claim_mission(p_mission text)
returns int language plpgsql security definer set search_path = public as $$
declare v_wk date := date_trunc('week', now() at time zone 'Asia/Bangkok')::date; m jsonb;
begin
  select e into m from jsonb_array_elements(public._mission_defs(auth.uid(), v_wk)) e where e->>'id' = p_mission;
  if m is null then raise exception 'unknown mission'; end if;
  if (m->>'progress')::int < (m->>'goal')::int then raise exception 'mission not complete'; end if;
  insert into mission_claims (user_id, week, mission, points) values (auth.uid(), v_wk, p_mission, (m->>'points')::int)
    on conflict do nothing;
  if not found then raise exception 'already claimed'; end if;
  return (m->>'points')::int;
end $$;

-- ภาพรวมการสำรวจของฉัน: คะแนน สตรีค ภารกิจ พื้นที่ที่ปลดล็อก
create or replace function public.my_explore()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_today date := (now() at time zone 'Asia/Bangkok')::date;
  v_wk date := date_trunc('week', now() at time zone 'Asia/Bangkok')::date;
  v_best int; v_cur int; v_done boolean; v_score int; v_checkins int;
begin
  with d as (select distinct checkin_date dt from checkins where user_id = v_uid),
       g as (select dt, dt - (row_number() over (order by dt))::int as grp from d),
       isl as (select count(*) n, max(dt) last from g group by grp)
  select coalesce(max(n), 0), coalesce(max(n) filter (where last >= v_today - 1), 0) into v_best, v_cur from isl;
  select exists (select 1 from checkins where user_id = v_uid and checkin_date = v_today) into v_done;
  select count(*) into v_checkins from checkins where user_id = v_uid;
  v_score := v_checkins * 5
    + coalesce((select sum(points) from area_unlocks where user_id = v_uid), 0)
    + coalesce((select sum(points) from mission_claims where user_id = v_uid), 0);
  return jsonb_build_object(
    'score', v_score, 'checkins', v_checkins,
    'streak', jsonb_build_object('current', v_cur, 'best', v_best, 'today', v_done),
    'missions', public._mission_defs(v_uid, v_wk),
    'unlocks', coalesce((select jsonb_agg(jsonb_build_object('level', level, 'code', code)) from area_unlocks where user_id = v_uid), '[]'::jsonb),
    'totals', (select coalesce(jsonb_object_agg(level, n), '{}'::jsonb) from (select level, count(*) n from admin_areas group by level) t)
  );
end $$;

revoke execute on function public.check_in_v2(bigint, float8, float8, int, text, text, text, text) from public, anon;
revoke execute on function public.claim_mission(text) from public, anon;
revoke execute on function public.my_explore() from public, anon;
grant execute on function public.check_in_v2(bigint, float8, float8, int, text, text, text, text) to authenticated;
grant execute on function public.claim_mission(text) to authenticated;
grant execute on function public.my_explore() to authenticated;

-- 2026-10-24 rebalance_area_points (applied via migration): คะแนนปลดล็อกพื้นที่ใหม่
-- ทวีป 50 / ประเทศ 30 / ภูมิภาค 40 / จังหวัด 60 / อำเภอ 25 / ตำบล 15 / หมุด 5 (check_in_v3 + คำนวณ area_unlocks.points ย้อนหลัง)
