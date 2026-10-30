-- ร้านค้า: แกลเลอรีหมุดร้าน + ยื่นยืนยันความเป็นเจ้าของ (แอดมินอนุมัติ)  (migration shops_v1)
-- ร้านคือแถวใน places เดิม (รีวิว/เช็คอิน/คะแนน ใช้ระบบเดิม) + shop_profiles เก็บรายละเอียดร้าน
-- ใครก็ปักหมุดร้านได้ (create_shop) · ร้านไหนจัดการข้อมูลได้ต้องยื่นขอ (submit_shop_claim) แล้วแอดมินอนุมัติ (admin_review_shop_claim)
-- เจ้าของร้านเช็คอิน/รีวิวร้านตัวเองไม่ได้ (กันปั่นคะแนน)

create table if not exists public.shop_profiles (
  place_id bigint primary key references public.places(id) on delete cascade,
  owner_id uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  about text, phone text, hours text, cover_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.shop_claims (
  id bigserial primary key,
  place_id bigint not null references public.places(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  contact text not null, note text, evidence_urls text[] default '{}',
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reason text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz, reviewed_by uuid
);
create unique index if not exists shop_claims_one_pending on public.shop_claims (place_id, user_id) where status = 'pending';
alter table public.shop_profiles enable row level security;
alter table public.shop_claims enable row level security;

-- ปักหมุดร้านใหม่ (ผู้สร้างยังไม่ใช่เจ้าของ ต้องยื่นยืนยันก่อน)
create or replace function public.create_shop(p_name text, p_category text, p_lat float8, p_lng float8, p_about text default null, p_phone text default null, p_hours text default null)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_id bigint;
begin
  if auth.uid() is null then raise exception 'login required'; end if;
  if p_category not in ('restaurant', 'cafe', 'hotel', 'other') then raise exception 'invalid category'; end if;
  if length(trim(coalesce(p_name, ''))) < 2 then raise exception 'name too short'; end if;
  v_id := public.add_place(p_name, p_category, p_lat, p_lng);
  insert into shop_profiles (place_id, created_by, about, phone, hours)
    values (v_id, auth.uid(), left(p_about, 500), left(p_phone, 30), left(p_hours, 120));
  return v_id;
end $$;

-- แกลเลอรีร้านใกล้ฉัน: ร้านที่มีโปรไฟล์ หรือมีรีวิวพร้อมรูป
create or replace function public.shop_gallery(p_lat float8, p_lng float8, p_radius_m int default 5000, p_category text default null)
returns table (id bigint, name text, category text, lat float8, lng float8, about text, cover_url text, avg_rating numeric, review_count bigint, claimed boolean, distance_m float8)
language sql stable security definer set search_path = public as $$
  with r as (select least(greatest(p_radius_m, 500), 30000) m),
  c as (
    select p.id, p.name, p.category, p.lat, p.lng, dist_m(p_lat, p_lng, p.lat, p.lng) d
    from places p, r
    where p.lat between p_lat - r.m / 111000.0 and p_lat + r.m / 111000.0
      and p.lng between p_lng - r.m / (111000.0 * greatest(cos(radians(p_lat)), 0.2)) and p_lng + r.m / (111000.0 * greatest(cos(radians(p_lat)), 0.2))
      and (p_category is null or p.category = p_category)
      and p.category in ('restaurant', 'cafe', 'hotel', 'other')
      and (exists (select 1 from shop_profiles s where s.place_id = p.id)
           or exists (select 1 from posts po where po.place_id = p.id and cardinality(po.media_urls) > 0))
  )
  select c.id, c.name, c.category, c.lat, c.lng, s.about,
         coalesce(s.cover_url, (select po.media_urls[1] from posts po where po.place_id = c.id and cardinality(po.media_urls) > 0 order by po.created_at desc limit 1)),
         (select round(avg(ck.rating)::numeric, 1) from checkins ck where ck.place_id = c.id and ck.rating is not null),
         (select count(*) from checkins ck where ck.place_id = c.id),
         s.owner_id is not null, c.d
  from c left join shop_profiles s on s.place_id = c.id, r
  where c.d <= r.m
  order by (s.owner_id is not null) desc, c.d limit 60;
$$;

-- รายละเอียดร้าน + สถานะของฉัน
create or replace function public.shop_detail(p_place_id bigint)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'place_id', p.id, 'name', p.name, 'category', p.category, 'lat', p.lat, 'lng', p.lng,
    'about', s.about, 'phone', s.phone, 'hours', s.hours, 'cover_url', s.cover_url,
    'claimed', s.owner_id is not null,
    'is_owner', coalesce(s.owner_id = auth.uid(), false),
    'my_claim', (select c.status from shop_claims c where c.place_id = p.id and c.user_id = auth.uid() order by c.created_at desc limit 1),
    'photos', coalesce((select jsonb_agg(u) from (select unnest(po.media_urls) u from posts po where po.place_id = p.id and cardinality(po.media_urls) > 0 order by po.created_at desc limit 12) t), '[]'::jsonb),
    'avg_rating', (select round(avg(ck.rating)::numeric, 1) from checkins ck where ck.place_id = p.id and ck.rating is not null),
    'review_count', (select count(*) from checkins ck where ck.place_id = p.id))
  from places p left join shop_profiles s on s.place_id = p.id where p.id = p_place_id;
$$;

-- ยื่นขอเป็นเจ้าของร้าน
create or replace function public.submit_shop_claim(p_place_id bigint, p_contact text, p_note text default null, p_evidence text[] default '{}')
returns bigint language plpgsql security definer set search_path = public as $$
declare v_id bigint;
begin
  if auth.uid() is null then raise exception 'login required'; end if;
  if not exists (select 1 from places where id = p_place_id) then raise exception 'place not found'; end if;
  if exists (select 1 from shop_profiles where place_id = p_place_id and owner_id is not null) then raise exception 'already claimed'; end if;
  if length(trim(coalesce(p_contact, ''))) < 5 then raise exception 'contact required'; end if;
  insert into shop_claims (place_id, user_id, contact, note, evidence_urls)
    values (p_place_id, auth.uid(), left(trim(p_contact), 120), left(p_note, 500), coalesce(p_evidence, '{}'))
    returning id into v_id;
  return v_id;
exception when unique_violation then raise exception 'claim already pending';
end $$;

-- เจ้าของ (ที่แอดมินอนุมัติแล้ว) แก้ข้อมูลร้านตัวเอง
create or replace function public.update_my_shop(p_place_id bigint, p_about text, p_phone text, p_hours text, p_cover_url text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  update shop_profiles set about = left(p_about, 500), phone = left(p_phone, 30), hours = left(p_hours, 120),
         cover_url = coalesce(left(p_cover_url, 500), cover_url), updated_at = now()
   where place_id = p_place_id and owner_id = auth.uid();
  if not found then raise exception 'not the owner'; end if;
end $$;

-- แอดมิน: ดู/อนุมัติ/ปฏิเสธคำขอ
create or replace function public.admin_shop_claims(p_status text default 'pending')
returns table (id bigint, place_id bigint, place_name text, username text, contact text, note text, evidence_urls text[], status text, reason text, created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return query select c.id, c.place_id, p.name, pr.display_name, c.contact, c.note, c.evidence_urls, c.status, c.reason, c.created_at
    from shop_claims c join places p on p.id = c.place_id join profiles pr on pr.id = c.user_id
    where p_status is null or c.status = p_status order by c.created_at desc limit 100;
end $$;

create or replace function public.admin_review_shop_claim(p_claim_id bigint, p_approve boolean, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare c shop_claims%rowtype;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  select * into c from shop_claims where id = p_claim_id and status = 'pending' for update;
  if not found then raise exception 'claim not pending'; end if;
  if p_approve then
    if exists (select 1 from shop_profiles where place_id = c.place_id and owner_id is not null) then raise exception 'already claimed'; end if;
    insert into shop_profiles (place_id, owner_id, created_by) values (c.place_id, c.user_id, c.user_id)
      on conflict (place_id) do update set owner_id = c.user_id, updated_at = now();
    update shop_claims set status = 'approved', reviewed_at = now(), reviewed_by = auth.uid(), reason = left(p_reason, 300) where id = c.id;
    update shop_claims set status = 'rejected', reviewed_at = now(), reviewed_by = auth.uid(), reason = 'มีเจ้าของอื่นได้รับอนุมัติแล้ว'
      where place_id = c.place_id and status = 'pending' and id <> c.id;
  else
    update shop_claims set status = 'rejected', reviewed_at = now(), reviewed_by = auth.uid(), reason = left(p_reason, 300) where id = c.id;
  end if;
end $$;

revoke execute on function public.create_shop(text, text, float8, float8, text, text, text), public.shop_gallery(float8, float8, int, text),
  public.shop_detail(bigint), public.submit_shop_claim(bigint, text, text, text[]), public.update_my_shop(bigint, text, text, text, text),
  public.admin_shop_claims(text), public.admin_review_shop_claim(bigint, boolean, text) from public, anon;
grant execute on function public.create_shop(text, text, float8, float8, text, text, text), public.shop_gallery(float8, float8, int, text),
  public.shop_detail(bigint), public.submit_shop_claim(bigint, text, text, text[]), public.update_my_shop(bigint, text, text, text, text),
  public.admin_shop_claims(text), public.admin_review_shop_claim(bigint, boolean, text) to authenticated;

-- เจ้าของร้านเช็คอินร้านตัวเองไม่ได้: เพิ่มเงื่อนไขต้น check_in_v4 แล้ว (migration check_in_v4_block_shop_owner; ฟังก์ชันเต็มอยู่ใน supabase-nature-challenges.sql)
