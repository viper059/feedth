-- ฟังก์ชันออกจากครอบครัว (ต้องรันเองใน Supabase SQL Editor เพราะมี DELETE)
create or replace function public.family_leave()
returns void language plpgsql security definer set search_path to 'public' as $$
declare v_uid uuid := auth.uid(); v_fid uuid;
begin
  select family_id into v_fid from family_members where user_id = v_uid;
  if v_fid is null then return; end if;
  delete from family_members where user_id = v_uid;
  if not exists (select 1 from family_members where family_id = v_fid) then delete from families where id = v_fid; end if;
end $$;
revoke execute on function public.family_leave() from public, anon;
grant execute on function public.family_leave() to authenticated;
