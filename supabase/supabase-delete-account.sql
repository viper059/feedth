-- feedTH: ลบบัญชีตัวเอง (PDPA: สิทธิในการลบข้อมูล)
-- ไฟล์นี้มีคำสั่ง DELETE จึงต้องรันเองใน Supabase Dashboard > SQL Editor (ครั้งเดียว) ผมไม่ได้รันให้อัตโนมัติ
-- ลบแล้วข้อมูลที่ผูกกับบัญชีจะถูกลบตาม (โปรไฟล์ โพสต์ คอมเมนต์ เช็คอิน กระเป๋าเครดิต ฯลฯ) ผ่าน on delete cascade
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = public, auth as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  delete from auth.users where id = auth.uid();
end $$;
revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
