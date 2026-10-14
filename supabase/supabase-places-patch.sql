-- feedTH places + check-ins patch (รันหลัง supabase-schema.sql และ supabase-security-patch.sql)
-- ไฟล์นี้รันซ้ำได้ปลอดภัย (ไม่ลบข้อมูลเดิม)
-- หมายเหตุ: ใช้สูตร haversine ธรรมดาเพื่อให้เริ่มง่าย ถ้าสถานที่เกินหลักหมื่นแห่งค่อยย้ายไป PostGIS

create table if not exists public.places (
  id bigserial primary key,
  name text not null check (char_length(name) between 2 and 80),
  category text not null check (category in ('attraction','hotel','restaurant','cafe','other')),
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  is_verified boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now()
);

create table if not exists public.checkins (
  id bigserial primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  place_id bigint not null references public.places(id) on delete cascade,
  rating int check (rating between 1 and 5),
  caption text check (char_length(caption) <= 500),
  checkin_date date not null default ((now() at time zone 'Asia/Bangkok')::date),
  created_at timestamptz default now(),
  unique (user_id, place_id, checkin_date) -- เช็คอินที่เดียวกันได้วันละครั้ง
);

alter table public.places enable row level security;
alter table public.checkins enable row level security;
drop policy if exists "places viewable by everyone" on public.places;
create policy "places viewable by everyone" on public.places for select using (true);
drop policy if exists "checkins viewable by everyone" on public.checkins;
create policy "checkins viewable by everyone" on public.checkins for select using (true);
-- ไม่มี policy insert: การเพิ่มสถานที่/เช็คอินต้องผ่านฟังก์ชันด้านล่างเท่านั้น

create or replace function public.dist_m(lat1 float8, lng1 float8, lat2 float8, lng2 float8)
returns float8 language sql immutable as $$
  select 2 * 6371000 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)));
$$;

create or replace function public.nearby_places(p_lat float8, p_lng float8, p_radius_m int default 5000)
returns table (id bigint, name text, category text, lat float8, lng float8, is_verified boolean, distance_m float8, checkin_count bigint)
language sql stable security definer set search_path = public as $$
  select p.id, p.name, p.category, p.lat, p.lng, p.is_verified,
         dist_m(p_lat, p_lng, p.lat, p.lng) as d,
         (select count(*) from checkins c where c.place_id = p.id)
  from places p
  where dist_m(p_lat, p_lng, p.lat, p.lng) <= least(p_radius_m, 20000)
  order by d limit 50;
$$;

create or replace function public.add_place(p_name text, p_category text, p_lat float8, p_lng float8)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_id bigint;
begin
  if (select count(*) from places where created_by = auth.uid() and created_at > now() - interval '1 day') >= 5 then
    raise exception 'add place limit reached (5 per day)';
  end if;
  if exists (select 1 from places where lower(name) = lower(trim(p_name)) and dist_m(lat, lng, p_lat, p_lng) < 100) then
    raise exception 'place already exists nearby';
  end if;
  insert into places (name, category, lat, lng, created_by)
    values (trim(p_name), p_category, p_lat, p_lng, auth.uid()) returning id into v_id;
  return v_id;
end $$;

-- เช็คอิน: ตรวจระยะ + ตรวจการเดินทางเร็วเกินจริง ฝั่งเซิร์ฟเวอร์
create or replace function public.check_in(p_place_id bigint, p_lat float8, p_lng float8, p_rating int, p_caption text)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_place places%rowtype; v_last record; v_id bigint; v_hours float8;
begin
  select * into v_place from places where id = p_place_id;
  if not found then raise exception 'place not found'; end if;
  if dist_m(p_lat, p_lng, v_place.lat, v_place.lng) > 150 then raise exception 'too far from place'; end if;

  select c.created_at, pl.lat, pl.lng into v_last
    from checkins c join places pl on pl.id = c.place_id
    where c.user_id = auth.uid() order by c.created_at desc limit 1;
  if found then
    v_hours := greatest(extract(epoch from (now() - v_last.created_at)) / 3600.0, 0.01);
    if dist_m(v_last.lat, v_last.lng, v_place.lat, v_place.lng) / 1000.0 / v_hours > 300 then
      raise exception 'suspicious travel speed';
    end if;
  end if;

  begin
    insert into checkins (user_id, place_id, rating, caption)
      values (auth.uid(), p_place_id, p_rating, nullif(trim(p_caption), '')) returning id into v_id;
  exception when unique_violation then
    raise exception 'already checked in today';
  end;
  return v_id;
end $$;

revoke execute on function public.nearby_places(float8, float8, int) from public, anon;
revoke execute on function public.add_place(text, text, float8, float8) from public, anon;
revoke execute on function public.check_in(bigint, float8, float8, int, text) from public, anon;
grant execute on function public.nearby_places(float8, float8, int) to authenticated;
grant execute on function public.add_place(text, text, float8, float8) to authenticated;
grant execute on function public.check_in(bigint, float8, float8, int, text) to authenticated;
