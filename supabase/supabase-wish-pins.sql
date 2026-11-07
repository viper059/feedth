-- หมุด "อยากไป": ผู้ใช้กดค้างบนแผนที่ระดับตำบลเพื่อปักหมุดล่วงหน้า
-- รันไฟล์นี้ใน Supabase > SQL Editor หนึ่งครั้ง (ปลอดภัยที่จะรันซ้ำ)
create table if not exists public.wish_pins (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade, -- ลบบัญชี = หมุดหายตาม
  name text not null check (char_length(name) between 1 and 60),
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  created_at timestamptz not null default now()
);
create index if not exists wish_pins_user on public.wish_pins (user_id, created_at desc);
alter table public.wish_pins enable row level security;
revoke all on public.wish_pins from anon, authenticated;
revoke all on sequence public.wish_pins_id_seq from anon, authenticated;

create or replace function public.my_wish_pins()
returns table (id bigint, name text, lat double precision, lng double precision)
language sql stable security definer set search_path = public as $$
  select w.id, w.name, w.lat, w.lng from wish_pins w where w.user_id = auth.uid() order by w.id desc limit 100;
$$;

create or replace function public.add_wish_pin(p_name text, p_lat double precision, p_lng double precision)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_id bigint; v_name text := btrim(coalesce(p_name, ''));
begin
  if auth.uid() is null then raise exception 'login required'; end if;
  if char_length(v_name) < 1 or char_length(v_name) > 60 then raise exception 'invalid name'; end if;
  if p_lat is null or p_lng is null or p_lat not between -90 and 90 or p_lng not between -180 and 180 then raise exception 'invalid position'; end if;
  if (select count(*) from wish_pins where user_id = auth.uid()) >= 100 then raise exception 'wish pin limit reached'; end if;
  insert into wish_pins (user_id, name, lat, lng) values (auth.uid(), v_name, p_lat, p_lng) returning id into v_id;
  return v_id;
end $$;

create or replace function public.delete_wish_pin(p_id bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'login required'; end if;
  delete from wish_pins where id = p_id and user_id = auth.uid();
end $$;

revoke execute on function public.my_wish_pins() from public, anon;
revoke execute on function public.add_wish_pin(text, double precision, double precision) from public, anon;
revoke execute on function public.delete_wish_pin(bigint) from public, anon;
grant execute on function public.my_wish_pins() to authenticated;
grant execute on function public.add_wish_pin(text, double precision, double precision) to authenticated;
grant execute on function public.delete_wish_pin(bigint) to authenticated;
