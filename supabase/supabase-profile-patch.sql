-- feedTH profile patch (รันหลังไฟล์ schema, security-patch, places-patch) — รันซ้ำได้ปลอดภัย

alter table public.profiles add column if not exists bio text;

-- "not valid" = ไม่ตรวจแถวเก่า (บัญชีทดสอบเดิม) ตรวจเฉพาะแถวที่เพิ่ม/แก้จากนี้ไป
alter table public.profiles drop constraint if exists profiles_display_name_len;
alter table public.profiles add constraint profiles_display_name_len
  check (display_name is null or char_length(display_name) between 2 and 30) not valid;
alter table public.profiles drop constraint if exists profiles_bio_len;
alter table public.profiles add constraint profiles_bio_len
  check (bio is null or char_length(bio) <= 160) not valid;

-- สมัครใหม่: ใช้ชื่อที่ผู้ใช้ตั้งเอง ส่วน username เป็นรหัสสุ่ม ไม่เอาส่วนหน้าอีเมลมาแสดงอีกต่อไป
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_name text;
begin
  v_name := left(trim(coalesce(new.raw_user_meta_data->>'display_name', '')), 30);
  if char_length(v_name) < 2 then v_name := 'สมาชิกใหม่'; end if;
  insert into profiles (id, username, display_name)
    values (new.id, 'user_' || substr(replace(new.id::text, '-', ''), 1, 8), v_name);
  insert into wallets (user_id, credit_balance) values (new.id, 80);
  return new;
end $$;

-- สถิติบนหน้าโปรไฟล์ (โพสต์ / เช็คอิน / เพื่อนที่ยืนยันแล้ว)
create or replace function public.profile_stats(p_user uuid)
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'posts', (select count(*) from posts where user_id = p_user),
    'checkins', (select count(*) from checkins where user_id = p_user),
    'friends', (select count(*) from friendships
                where status = 'accepted' and (user_id = p_user or friend_id = p_user))
  );
$$;

revoke execute on function public.profile_stats(uuid) from public, anon;
grant execute on function public.profile_stats(uuid) to authenticated;
