-- feedTH analytics patch: เก็บสถิติ/ความสนใจ "เฉพาะผู้ที่ยินยอม" (รันหลัง profile-patch, รันซ้ำได้)
-- หลักการ: ค่าเริ่มต้น = ไม่เก็บ, ผู้ใช้ปิดแล้วข้อมูลถูกลบทันที, ฝั่งเซิร์ฟเวอร์ตรวจ consent ทุกครั้ง

create table if not exists public.user_consents (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  analytics boolean not null default false,        -- เก็บช่วงเวลา/ระยะเวลาใช้งาน
  personalized_ads boolean not null default false, -- เรียนรู้ความสนใจเพื่อโฆษณา
  updated_at timestamptz default now()
);

create table if not exists public.usage_sessions (
  id uuid primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  started_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  start_hour int not null default (extract(hour from now() at time zone 'Asia/Bangkok')::int)
);
create index if not exists usage_sessions_user_idx on public.usage_sessions(user_id);

create table if not exists public.interest_scores (
  user_id uuid references public.profiles(id) on delete cascade,
  topic text not null,
  score float8 not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, topic)
);

alter table public.user_consents enable row level security;
alter table public.usage_sessions enable row level security;
alter table public.interest_scores enable row level security;
drop policy if exists "own consent" on public.user_consents;
drop policy if exists "own sessions" on public.usage_sessions;
drop policy if exists "own interests" on public.interest_scores;
create policy "own consent" on public.user_consents for select using (auth.uid() = user_id);
create policy "own sessions" on public.usage_sessions for select using (auth.uid() = user_id);
create policy "own interests" on public.interest_scores for select using (auth.uid() = user_id);
-- ไม่มี policy insert/update: เขียนผ่านฟังก์ชันด้านล่างเท่านั้น

-- บันทึกการยินยอม ถ้าปิดข้อใด ข้อมูลของข้อนั้นถูกลบทันที
create or replace function public.set_consent(p_analytics boolean, p_ads boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into user_consents (user_id, analytics, personalized_ads) values (auth.uid(), p_analytics, p_ads)
  on conflict (user_id) do update
    set analytics = excluded.analytics, personalized_ads = excluded.personalized_ads, updated_at = now();
  if not p_analytics then delete from usage_sessions where user_id = auth.uid(); end if;
  if not p_ads then delete from interest_scores where user_id = auth.uid(); end if;
end $$;

-- heartbeat การใช้งาน (แอปเรียกทุก 60 วินาทีขณะเปิดหน้าจออยู่)
create or replace function public.track_session(p_session_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from user_consents where user_id = auth.uid() and analytics) then return; end if;
  insert into usage_sessions (id, user_id) values (p_session_id, auth.uid())
  on conflict (id) do update set last_seen_at = now() where usage_sessions.user_id = auth.uid();
end $$;

-- อัลกอริทึมความสนใจ: คะแนนเดิมลดลงครึ่งหนึ่งทุก 30 วัน แล้วบวกน้ำหนักใหม่ (สนใจล่าสุดมีน้ำหนักมากกว่า)
create or replace function public.record_interest(p_topic text, p_weight float8 default 1)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from user_consents where user_id = auth.uid() and personalized_ads) then return; end if;
  if p_topic !~ '^[a-z_]{2,30}$' or p_weight not between 0 and 5 then raise exception 'invalid interest'; end if;
  insert into interest_scores (user_id, topic, score) values (auth.uid(), p_topic, p_weight)
  on conflict (user_id, topic) do update set
    score = interest_scores.score
            * power(0.5, extract(epoch from (now() - interest_scores.updated_at)) / 86400.0 / 30.0)
            + p_weight,
    updated_at = now();
end $$;

revoke execute on function public.set_consent(boolean, boolean) from public, anon;
revoke execute on function public.track_session(uuid) from public, anon;
revoke execute on function public.record_interest(text, float8) from public, anon;
grant execute on function public.set_consent(boolean, boolean) to authenticated;
grant execute on function public.track_session(uuid) to authenticated;
grant execute on function public.record_interest(text, float8) to authenticated;

-- มุมมองสรุปสำหรับเจ้าของแอปเท่านั้น (เปิดดูใน Supabase Table Editor / SQL Editor)
-- ไม่เปิดให้ผู้ใช้ผ่าน API และเป็นตัวเลขรวม ไม่ระบุตัวบุคคล
create or replace view public.usage_by_hour as
  select start_hour as hour, count(*) as sessions,
         round(avg(extract(epoch from (last_seen_at - started_at)) / 60)::numeric, 1) as avg_minutes
  from public.usage_sessions group by start_hour order by start_hour;

create or replace view public.daily_usage as
  select (started_at at time zone 'Asia/Bangkok')::date as day,
         count(distinct user_id) as users,
         round((sum(extract(epoch from (last_seen_at - started_at))) / 60 / count(distinct user_id))::numeric, 1) as avg_minutes_per_user
  from public.usage_sessions group by 1 order by 1 desc;

-- กลุ่มเป้าหมายโฆษณา: นับจำนวนผู้ใช้ที่ยินยอมและมีคะแนนความสนใจตั้งแต่ 3 ขึ้นไป
-- ก่อนขายโฆษณาจริง ควรกำหนดขั้นต่ำต่อกลุ่ม (เช่น 20 คน) เพื่อไม่ให้ชี้ตัวบุคคลได้
create or replace view public.ad_segments as
  select s.topic, count(*) as interested_users
  from public.interest_scores s join public.user_consents c using (user_id)
  where c.personalized_ads and s.score >= 3
  group by s.topic order by interested_users desc;

revoke all on public.usage_by_hour, public.daily_usage, public.ad_segments from public, anon, authenticated;
