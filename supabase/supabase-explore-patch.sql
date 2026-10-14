-- feedTH explore patch (รอบ 2-4): สถิติ/ตราประทับ/อันดับ, จังหวัด, ติดตาม, บูสต์สถานที่
-- รันหลัง reviews-patch, รันซ้ำได้ปลอดภัย (ไม่มีคำสั่งลบ)

-- ===== จังหวัด (จับด้วยพิกัดศาลากลาง/เมืองหลักที่ใกล้ที่สุด ถ้าไกลเกิน 150 กม. = ไม่ระบุ) =====
create table if not exists public.provinces (name text primary key, lat float8 not null, lng float8 not null);
alter table public.provinces enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='provinces' and policyname='provinces viewable') then
    create policy "provinces viewable" on public.provinces for select using (true);
  end if;
end $$;
insert into public.provinces (name, lat, lng) values
  ('กรุงเทพมหานคร',13.7563,100.5018),
  ('กระบี่',8.0863,98.9063),
  ('กาญจนบุรี',14.0228,99.5328),
  ('กาฬสินธุ์',16.4322,103.5061),
  ('กำแพงเพชร',16.4828,99.5227),
  ('ขอนแก่น',16.4419,102.8360),
  ('จันทบุรี',12.6114,102.1039),
  ('ฉะเชิงเทรา',13.6904,101.0779),
  ('ชลบุรี',13.3611,100.9847),
  ('ชัยนาท',15.1851,100.1251),
  ('ชัยภูมิ',15.8068,102.0316),
  ('ชุมพร',10.4930,99.1800),
  ('เชียงราย',19.9105,99.8406),
  ('เชียงใหม่',18.7883,98.9853),
  ('ตรัง',7.5563,99.6114),
  ('ตราด',12.2428,102.5175),
  ('ตาก',16.8840,99.1258),
  ('นครนายก',14.2069,101.2131),
  ('นครปฐม',13.8199,100.0443),
  ('นครพนม',17.4108,104.7784),
  ('นครราชสีมา',14.9799,102.0978),
  ('นครศรีธรรมราช',8.4304,99.9631),
  ('นครสวรรค์',15.7047,100.1372),
  ('นนทบุรี',13.8591,100.5217),
  ('นราธิวาส',6.4264,101.8253),
  ('น่าน',18.7756,100.7730),
  ('บึงกาฬ',18.3609,103.6466),
  ('บุรีรัมย์',14.9930,103.1029),
  ('ปทุมธานี',14.0208,100.5250),
  ('ประจวบคีรีขันธ์',11.8124,99.7973),
  ('ปราจีนบุรี',14.0509,101.3727),
  ('ปัตตานี',6.8696,101.2501),
  ('พระนครศรีอยุธยา',14.3532,100.5689),
  ('พังงา',8.4509,98.5255),
  ('พัทลุง',7.6167,100.0779),
  ('พิจิตร',16.4429,100.3488),
  ('พิษณุโลก',16.8211,100.2659),
  ('เพชรบุรี',13.1112,99.9391),
  ('เพชรบูรณ์',16.4190,101.1606),
  ('แพร่',18.1446,100.1410),
  ('พะเยา',19.1664,99.9019),
  ('ภูเก็ต',7.8804,98.3923),
  ('มหาสารคาม',16.1851,103.3007),
  ('มุกดาหาร',16.5435,104.7235),
  ('แม่ฮ่องสอน',19.3020,97.9654),
  ('ยะลา',6.5411,101.2804),
  ('ยโสธร',15.7921,104.1453),
  ('ร้อยเอ็ด',16.0538,103.6520),
  ('ระนอง',9.9529,98.6085),
  ('ระยอง',12.6814,101.2816),
  ('ราชบุรี',13.5283,99.8134),
  ('ลพบุรี',14.7995,100.6534),
  ('ลำปาง',18.2888,99.4908),
  ('ลำพูน',18.5745,99.0087),
  ('เลย',17.4860,101.7223),
  ('ศรีสะเกษ',15.1186,104.3220),
  ('สกลนคร',17.1664,104.1486),
  ('สงขลา',7.1756,100.6143),
  ('สตูล',6.6238,100.0674),
  ('สมุทรปราการ',13.5991,100.5998),
  ('สมุทรสงคราม',13.4098,100.0023),
  ('สมุทรสาคร',13.5475,100.2740),
  ('สระแก้ว',13.8240,102.0646),
  ('สระบุรี',14.5289,100.9108),
  ('สิงห์บุรี',14.8936,100.4020),
  ('สุโขทัย',17.0056,99.8264),
  ('สุพรรณบุรี',14.4745,100.1222),
  ('สุราษฎร์ธานี',9.1382,99.3217),
  ('สุรินทร์',14.8818,103.4937),
  ('หนองคาย',17.8783,102.7413),
  ('หนองบัวลำภู',17.2040,102.4260),
  ('อ่างทอง',14.5896,100.4550),
  ('อำนาจเจริญ',15.8657,104.6258),
  ('อุดรธานี',17.4138,102.7872),
  ('อุตรดิตถ์',17.6200,100.0993),
  ('อุทัยธานี',15.3835,100.0245),
  ('อุบลราชธานี',15.2448,104.8473)
on conflict (name) do nothing;

alter table public.places add column if not exists province text;
alter table public.places add column if not exists boost_expire_at timestamptz;

create or replace function public.province_for(p_lat float8, p_lng float8)
returns text language sql stable set search_path = public as $$
  select name from (select name, dist_m(p_lat, p_lng, lat, lng) d from provinces order by d limit 1) x where d <= 150000;
$$;

create or replace function public.set_place_province() returns trigger language plpgsql set search_path = public as $$
begin new.province := province_for(new.lat, new.lng); return new; end $$;
do $$ begin
  if not exists (select 1 from pg_trigger where tgname='places_set_province') then
    create trigger places_set_province before insert on public.places for each row execute function public.set_place_province();
  end if;
end $$;
update public.places set province = province_for(lat, lng) where province is null;

-- ===== ติดตามผู้ใช้ =====
create table if not exists public.follows (
  follower_id uuid references public.profiles(id) on delete cascade,
  followee_id uuid references public.profiles(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);
alter table public.follows enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='follows' and policyname='follows viewable') then
    create policy "follows viewable" on public.follows for select using (true);
    create policy "follow as self" on public.follows for insert with check (auth.uid() = follower_id);
    create policy "unfollow own" on public.follows for delete using (auth.uid() = follower_id);
  end if;
end $$;

-- ===== สถิติเดินทางของผู้ใช้ (อันดับที่ไปบ่อย, จังหวัด, หมวด, ผู้ติดตาม) =====
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
    'following', (select count(*) from follows where follower_id = p_user)
  );
$$;

-- ===== ลีดเดอร์บอร์ด =====
create or replace function public.leaderboard(p_sort text default 'checkins')
returns table (user_id uuid, username text, checkins bigint, rating_sum bigint, likes_received bigint)
language sql stable security definer set search_path = public as $$
  select u.id, u.display_name,
         (select count(*) from checkins c where c.user_id = u.id),
         (select coalesce(sum(rating), 0) from checkins c where c.user_id = u.id),
         (select count(*) from likes l join posts po on po.id = l.post_id where po.user_id = u.id and po.place_id is not null)
  from profiles u
  where exists (select 1 from checkins c where c.user_id = u.id)
  order by case p_sort when 'rating_sum' then (select coalesce(sum(rating), 0) from checkins c where c.user_id = u.id)
                       when 'likes_received' then (select count(*) from likes l join posts po on po.id = l.post_id where po.user_id = u.id and po.place_id is not null)
                       else (select count(*) from checkins c where c.user_id = u.id) end desc
  limit 50;
$$;

-- ===== บูสต์สถานที่ด้วยเครดิต (ร้านค้า/ที่พักขึ้นบนสุดในรายการใกล้เคียง) =====
create or replace function public.boost_place(p_place_id bigint, p_credits int)
returns int language plpgsql security definer set search_path = public as $$
declare v_hours int; v_balance int;
begin
  v_hours := case p_credits when 10 then 6 when 25 then 24 when 50 then 72 else null end;
  if v_hours is null then raise exception 'invalid boost package'; end if;
  if not exists (select 1 from places where id = p_place_id) then raise exception 'place not found'; end if;
  update wallets set credit_balance = credit_balance - p_credits, updated_at = now()
    where user_id = auth.uid() and credit_balance >= p_credits returning credit_balance into v_balance;
  if v_balance is null then raise exception 'insufficient credits'; end if;
  insert into credit_transactions (user_id, type, amount) values (auth.uid(), 'spend', p_credits);
  update places set boost_expire_at = greatest(coalesce(boost_expire_at, now()), now()) + make_interval(hours => v_hours)
    where id = p_place_id;
  return v_balance;
end $$;

create or replace function public.nearby_places_v2(p_lat float8, p_lng float8, p_radius_m int default 5000)
returns table (id bigint, name text, category text, lat float8, lng float8, is_verified boolean, distance_m float8, checkin_count bigint, is_boosted boolean)
language sql stable security definer set search_path = public as $$
  select p.id, p.name, p.category, p.lat, p.lng, p.is_verified, dist_m(p_lat, p_lng, p.lat, p.lng) as d,
         (select count(*) from checkins c where c.place_id = p.id),
         coalesce(p.boost_expire_at > now(), false) as b
  from places p
  where dist_m(p_lat, p_lng, p.lat, p.lng) <= least(p_radius_m, 20000)
  order by b desc, d limit 50;
$$;

-- place_summary รอบนี้ไม่เปลี่ยนรูปแบบ แต่เพิ่มฟังก์ชันบอกสถานะบูสต์แยก
create or replace function public.place_boosted(p_place_id bigint)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(boost_expire_at > now(), false) from places where id = p_place_id;
$$;

revoke execute on function public.travel_stats(uuid), public.leaderboard(text), public.boost_place(bigint, int),
  public.nearby_places_v2(float8, float8, int), public.place_boosted(bigint) from public, anon;
grant execute on function public.travel_stats(uuid), public.leaderboard(text), public.boost_place(bigint, int),
  public.nearby_places_v2(float8, float8, int), public.place_boosted(bigint) to authenticated;
revoke execute on function public.province_for(float8, float8), public.set_place_province() from public, anon, authenticated;
