-- ความท้าทายธรรมชาติ: อุทยาน / ภูเขา / น้ำตก / เกาะ  (ใช้งานในฐานข้อมูลจริงแล้ว: migration nature_challenges)
-- นับเมื่อเช็คอินห่างจากสถานที่ไม่เกิน 100 ม. (เช็คอินปกติยังยอมได้ 150 ม. แต่ไม่ถือเป็นความท้าทาย)
-- 1 จุดต่อ 1 ครั้งต่อคน (spot_key) · ได้ +10 ต่อจุดใหม่ + โบนัสเมื่อถึงขั้น (nature_awards) · รวมใน my_explore().score และ leaderboard

create table if not exists public.nature_places (
  place_id bigint primary key references public.places(id) on delete cascade,
  kind text not null check (kind in ('park', 'peak', 'falls', 'island')),
  spot_key text not null
);
create index if not exists nature_places_kind_key on public.nature_places (kind, spot_key);

create table if not exists public.nature_hits (
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null,
  spot_key text not null,
  place_id bigint,
  checkin_id bigint,
  points int not null default 10,
  created_at timestamptz not null default now(),
  primary key (user_id, kind, spot_key)
);
create table if not exists public.nature_awards (
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null,
  tier int not null,
  points int not null,
  created_at timestamptz not null default now(),
  primary key (user_id, kind, tier)
);
alter table public.nature_places enable row level security;
alter table public.nature_hits enable row level security;
alter table public.nature_awards enable row level security;
drop policy if exists "read own nature hits" on public.nature_hits;
create policy "read own nature hits" on public.nature_hits for select using (auth.uid() = user_id);
drop policy if exists "read own nature awards" on public.nature_awards;
create policy "read own nature awards" on public.nature_awards for select using (auth.uid() = user_id);

-- จัดประเภทสถานที่จากชื่อ (อุทยาน 1 แห่ง = 1 จุด แม้มีหลายจุดย่อยใน OSM)
insert into public.nature_places (place_id, kind, spot_key)
select id, 'park', regexp_replace(name, '^(อุทยานแห่งชาติ|วนอุทยาน|เขตรักษาพันธุ์สัตว์ป่า)\s*(\S+).*$', '\1\2')
from public.places where name ~ '^(อุทยานแห่งชาติ|วนอุทยาน|เขตรักษาพันธุ์สัตว์ป่า)\s*\S'
on conflict do nothing;
insert into public.nature_places (place_id, kind, spot_key)
select id, 'peak', btrim(name) from public.places
where category = 'attraction' and name ~ '^(ภู|ดอย|ยอดเขา|เขา)\S' and name !~ '(รีสอร์ท|ร้าน|ฟาร์ม|ที่พัก|คาเฟ่|โฮมสเตย์|วัด|ศาล)'
on conflict do nothing;
insert into public.nature_places (place_id, kind, spot_key)
select id, 'falls', btrim(name) from public.places where category = 'attraction' and name ~ '^น้ำตก\S'
on conflict do nothing;
insert into public.nature_places (place_id, kind, spot_key)
select id, 'island', btrim(name) from public.places where category = 'attraction' and name ~ '^เกาะ\S' and name !~ '(รีสอร์ท|ร้าน|ที่พัก|โฮมสเตย์)'
on conflict do nothing;

-- ขั้นของแต่ละหมวด: เป้าหมาย / คะแนนโบนัส
create or replace function public._nature_tiers(p_kind text)
returns table (thr int[], pts int[]) language sql immutable as $$
  select case p_kind when 'park' then array[1,5,15,30] when 'peak' then array[3,10,25] when 'falls' then array[5,15,40] else array[3,10,25] end,
         case p_kind when 'park' then array[50,150,400,1000] when 'peak' then array[50,150,400] when 'falls' then array[40,120,350] else array[50,150,400] end;
$$;
revoke execute on function public._nature_tiers(text) from public, anon, authenticated;

create or replace function public.check_in_v4(p_place_id bigint, p_lat double precision, p_lng double precision, p_rating integer, p_caption text, p_cty text, p_pro text, p_dis text, p_sub text)
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare
  r jsonb; v_place places%rowtype; v_vil villages%rowtype; v_n int; v_id bigint;
  v_nat nature_places%rowtype; v_cnt int; v_thr int[]; v_pt int[]; v_gain int; v_tier int; v_i int;
begin
  if exists (select 1 from shop_profiles where place_id = p_place_id and owner_id = auth.uid()) then
    raise exception 'owner cannot check in own shop';
  end if;
  perform set_config('app.repeat_checkin', '0', true);
  r := public.check_in_v3(p_place_id, p_lat, p_lng, p_rating, p_caption, p_cty, p_pro, p_dis, p_sub);
  if current_setting('app.repeat_checkin', true) = '1' then
    return jsonb_build_object('checkin_id', r->'checkin_id', 'points', 0, 'unlocks', '[]'::jsonb, 'repeat', true);
  end if;
  v_id := (r->>'checkin_id')::bigint;
  if p_sub ~ '^\d{6}$' then
    update checkins set sub=p_sub, dis=left(p_sub,4), pro=left(p_sub,2) where id=v_id and user_id=auth.uid();
  end if;
  select * into v_place from places where id = p_place_id;
  select * into v_vil from villages
    where lat between v_place.lat - 0.0145 and v_place.lat + 0.0145
      and lng between v_place.lng - 0.0145 and v_place.lng + 0.0145
      and dist_m(v_place.lat, v_place.lng, lat, lng) <= 1500
    order by dist_m(v_place.lat, v_place.lng, lat, lng) limit 1;
  if found then
    insert into village_unlocks (user_id, village_id, points, checkin_id) values (auth.uid(), v_vil.id, 5, v_id)
      on conflict do nothing;
    get diagnostics v_n = row_count;
    if v_n > 0 then
      r := jsonb_set(r, '{unlocks}', (r->'unlocks') || jsonb_build_array(jsonb_build_object('level','vil','code',v_vil.id::text,'name',v_vil.name,'points',5)));
      r := jsonb_set(r, '{points}', to_jsonb((r->>'points')::int + 5));
    end if;
  end if;

  -- ความท้าทายธรรมชาติ (ต้องอยู่ห่างจุดไม่เกิน 100 ม.)
  select * into v_nat from nature_places where place_id = p_place_id;
  if found then
    if dist_m(p_lat, p_lng, v_place.lat, v_place.lng) > 100 then
      r := r || jsonb_build_object('nature', jsonb_build_object('kind', v_nat.kind, 'name', v_nat.spot_key, 'far', true));
    else
      insert into nature_hits (user_id, kind, spot_key, place_id, checkin_id, points)
        values (auth.uid(), v_nat.kind, v_nat.spot_key, p_place_id, v_id, 10) on conflict do nothing;
      get diagnostics v_n = row_count;
      if v_n > 0 then
        v_gain := 10; v_tier := null;
        select count(*) into v_cnt from nature_hits where user_id = auth.uid() and kind = v_nat.kind;
        select t.thr, t.pts into v_thr, v_pt from public._nature_tiers(v_nat.kind) t;
        for v_i in 1..array_length(v_thr, 1) loop
          if v_cnt >= v_thr[v_i] then
            insert into nature_awards (user_id, kind, tier, points) values (auth.uid(), v_nat.kind, v_i, v_pt[v_i]) on conflict do nothing;
            get diagnostics v_n = row_count;
            if v_n > 0 then v_gain := v_gain + v_pt[v_i]; v_tier := v_i; end if;
          end if;
        end loop;
        r := jsonb_set(r, '{points}', to_jsonb((r->>'points')::int + v_gain));
        r := r || jsonb_build_object('nature', jsonb_build_object('kind', v_nat.kind, 'name', v_nat.spot_key, 'new', true, 'points', v_gain, 'count', v_cnt, 'tier', v_tier));
      else
        r := r || jsonb_build_object('nature', jsonb_build_object('kind', v_nat.kind, 'name', v_nat.spot_key, 'new', false));
      end if;
    end if;
  end if;
  return r;
end $function$;

-- ความคืบหน้าความท้าทายของฉัน
create or replace function public.nature_progress()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_out jsonb := '[]'::jsonb; k text; v_cnt int; v_total int; v_thr int[]; v_pt int[]; v_done int;
begin
  foreach k in array array['park', 'peak', 'falls', 'island'] loop
    select count(*) into v_cnt from nature_hits where user_id = auth.uid() and kind = k;
    select count(distinct spot_key) into v_total from nature_places where kind = k;
    select t.thr, t.pts into v_thr, v_pt from public._nature_tiers(k) t;
    select count(*) into v_done from unnest(v_thr) x where v_cnt >= x;
    v_out := v_out || jsonb_build_array(jsonb_build_object('kind', k, 'count', v_cnt, 'total', v_total, 'thr', to_jsonb(v_thr), 'pts', to_jsonb(v_pt), 'tier', v_done));
  end loop;
  return v_out;
end $$;
revoke execute on function public.nature_progress() from public, anon;
grant execute on function public.nature_progress() to authenticated;

-- รวมคะแนนธรรมชาติใน my_explore().score
create or replace function public.my_explore()
returns jsonb language plpgsql stable security definer set search_path to 'public' as $function$
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
    + coalesce((select sum(points) from village_unlocks where user_id = v_uid), 0)
    + coalesce((select sum(points) from mission_claims where user_id = v_uid), 0)
    + coalesce((select sum(points) from nature_hits where user_id = v_uid), 0)
    + coalesce((select sum(points) from nature_awards where user_id = v_uid), 0)
    + public._referral_bonus(v_uid)
    + public._trip_bonus(v_uid);
  return jsonb_build_object(
    'score', v_score, 'checkins', v_checkins,
    'streak', jsonb_build_object('current', v_cur, 'best', v_best, 'today', v_done),
    'missions', public._mission_defs(v_uid, v_wk),
    'unlocks', coalesce((select jsonb_agg(jsonb_build_object('level', level, 'code', code)) from area_unlocks where user_id = v_uid), '[]'::jsonb),
    'villages', coalesce((select jsonb_agg(village_id) from village_unlocks where user_id = v_uid), '[]'::jsonb),
    'totals', (select coalesce(jsonb_object_agg(level, n), '{}'::jsonb) from (select level, count(*) n from admin_areas group by level) t)
              || jsonb_build_object('vil', (select count(*) from villages))
  );
end $function$;

-- อันดับ (leaderboard_v2) ใช้คะแนนเดียวกัน
create or replace function public._user_score(p_uid uuid, p_since timestamptz default null)
returns bigint language plpgsql stable security definer set search_path = public as $$
declare v bigint; x bigint;
begin
  v := (select count(*) * 5 from checkins c where c.user_id = p_uid and (p_since is null or c.created_at >= p_since))
     + coalesce((select sum(points) from area_unlocks a where a.user_id = p_uid and (p_since is null or a.created_at >= p_since)), 0)
     + coalesce((select sum(points) from mission_claims m where m.user_id = p_uid and (p_since is null or m.created_at >= p_since)), 0)
     + coalesce((select sum(points) from nature_hits h where h.user_id = p_uid and (p_since is null or h.created_at >= p_since)), 0)
     + coalesce((select sum(points) from nature_awards w where w.user_id = p_uid and (p_since is null or w.created_at >= p_since)), 0);
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
