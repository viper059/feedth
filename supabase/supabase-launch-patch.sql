-- feedTH pre-launch patch: โหมดทดลอง (ปิดเติมเครดิตฟรี), รายงานโพสต์, ลบโพสต์/คอมเมนต์ของตัวเอง
-- รันหลัง social-patch, รันซ้ำได้ปลอดภัย (ไม่มี DROP/DELETE)
-- ลบบัญชี: ดู supabase-delete-account.sql (ต้องรันเองใน SQL Editor เพราะมีคำสั่ง DELETE)

create table if not exists public.app_settings (
  key text primary key,
  value text not null
);
alter table public.app_settings enable row level security;
insert into public.app_settings (key, value) values ('demo_mode', 'true') on conflict do nothing;

-- เปิดเผยค่าตั้งค่าที่ปลอดภัยให้แอป (ตอนนี้มีแค่ demo_mode)
create or replace function public.app_config()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('demo_mode', coalesce((select value from app_settings where key = 'demo_mode'), 'false') = 'true');
$$;

-- เติมเครดิตทดลองใช้ได้เฉพาะตอน demo_mode = true  (ปิดก่อนเปิดจริง: update app_settings set value='false' where key='demo_mode';)
create or replace function public.demo_topup(p_amount integer)
returns integer language plpgsql security definer set search_path = public as $$
declare v_balance int;
begin
  if coalesce((select value from app_settings where key = 'demo_mode'), 'false') <> 'true' then
    raise exception 'top-up disabled';
  end if;
  if p_amount <> 100 then raise exception 'invalid amount'; end if;
  update wallets set credit_balance = credit_balance + p_amount, updated_at = now()
    where user_id = auth.uid() returning credit_balance into v_balance;
  insert into credit_transactions (user_id, type, amount) values (auth.uid(), 'topup', p_amount);
  return v_balance;
end $$;

-- รายงานโพสต์ (ผู้ดูแลดูได้ที่ตาราง reports ใน Dashboard)
create table if not exists public.reports (
  id bigserial primary key,
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  post_id bigint not null references public.posts(id) on delete cascade,
  reason text not null check (reason in ('spam', 'inappropriate', 'false_info', 'other')),
  created_at timestamptz not null default now(),
  unique (reporter_id, post_id)
);
alter table public.reports enable row level security;

create or replace function public.report_post(p_post_id bigint, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from posts where id = p_post_id) then raise exception 'post not found'; end if;
  if (select count(*) from reports where reporter_id = auth.uid() and created_at > now() - interval '1 day') >= 20 then
    raise exception 'report limit reached';
  end if;
  insert into reports (reporter_id, post_id, reason) values (auth.uid(), p_post_id, p_reason)
    on conflict do nothing;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'posts' and policyname = 'users can delete own posts') then
    create policy "users can delete own posts" on public.posts for delete using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'comments' and policyname = 'users can delete own comments') then
    create policy "users can delete own comments" on public.comments for delete using (auth.uid() = user_id);
  end if;
end $$;

revoke execute on function public.app_config() from public, anon;
revoke execute on function public.report_post(bigint, text) from public, anon;
grant execute on function public.app_config() to authenticated;
grant execute on function public.report_post(bigint, text) to authenticated;
