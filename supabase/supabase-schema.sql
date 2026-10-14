-- ==========================================================
-- feedTH — Supabase schema (Phase 2: ฐานข้อมูลจริง + auth)
-- วิธีใช้: เปิด Supabase Dashboard > SQL Editor > วางทั้งหมดนี้ > Run
-- ==========================================================

-- 1) โปรไฟล์ผู้ใช้ (ผูกกับ auth.users ของ Supabase)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  display_name text,
  avatar_url text,
  created_at timestamptz default now()
);

-- 2) กระเป๋าเครดิต
create table public.wallets (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  credit_balance int not null default 80,
  updated_at timestamptz default now()
);

-- 3) ธุรกรรมเครดิต (ledger — ห้ามลบ/แก้ ใช้ตรวจสอบย้อนหลัง)
create table public.credit_transactions (
  id bigserial primary key,
  user_id uuid references public.profiles(id) on delete cascade,
  type text not null check (type in ('topup', 'spend', 'refund')),
  amount int not null,
  related_post_id bigint,
  created_at timestamptz default now()
);

-- 4) โพสต์
create table public.posts (
  id bigserial primary key,
  user_id uuid references public.profiles(id) on delete cascade,
  content text not null,
  media_urls text[] default '{}',
  is_boosted boolean default false,
  boost_expire_at timestamptz,
  created_at timestamptz default now()
);

-- 5) คอมเมนต์
create table public.comments (
  id bigserial primary key,
  post_id bigint references public.posts(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  content text not null,
  created_at timestamptz default now()
);

-- 6) ไลค์ (1 คนไลค์ 1 โพสต์ได้ครั้งเดียว บังคับด้วย primary key)
create table public.likes (
  post_id bigint references public.posts(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (post_id, user_id)
);

-- 7) เพื่อน
create table public.friendships (
  user_id uuid references public.profiles(id) on delete cascade,
  friend_id uuid references public.profiles(id) on delete cascade,
  status text not null check (status in ('pending', 'accepted')),
  created_at timestamptz default now(),
  primary key (user_id, friend_id)
);

-- 8) เหตุการณ์คะแนนเพื่อนรัก (ledger — unique constraint กันฟาร์มคะแนนซ้ำ)
create table public.fan_score_events (
  id bigserial primary key,
  from_user_id uuid references public.profiles(id) on delete cascade,
  to_user_id uuid references public.profiles(id) on delete cascade,
  post_id bigint references public.posts(id) on delete cascade,
  action text not null check (action in ('like', 'comment', 'share')),
  points_awarded int not null,
  created_at timestamptz default now(),
  unique (from_user_id, to_user_id, post_id, action) -- กันกดซ้ำโพสต์เดิมได้คะแนนซ้ำ
);

-- 9) คะแนนสะสม (คำนวณสรุปจาก fan_score_events ผ่าน trigger ด้านล่าง)
create table public.fan_scores (
  from_user_id uuid references public.profiles(id) on delete cascade,
  to_user_id uuid references public.profiles(id) on delete cascade,
  points int not null default 0,
  updated_at timestamptz default now(),
  primary key (from_user_id, to_user_id)
);

-- ==========================================================
-- Triggers อัตโนมัติ
-- ==========================================================

-- เมื่อมีผู้ใช้สมัครใหม่ผ่าน Supabase Auth -> สร้างโปรไฟล์ + กระเป๋าเครดิตให้อัตโนมัติ
create function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username, display_name)
  values (new.id, split_part(new.email, '@', 1), split_part(new.email, '@', 1));
  insert into public.wallets (user_id, credit_balance) values (new.id, 80);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- เมื่อมี fan_score_event ใหม่ -> บวกคะแนนสะสมให้อัตโนมัติ (upsert)
create function public.apply_fan_score_event()
returns trigger as $$
begin
  insert into public.fan_scores (from_user_id, to_user_id, points, updated_at)
  values (new.from_user_id, new.to_user_id, new.points_awarded, now())
  on conflict (from_user_id, to_user_id)
  do update set points = public.fan_scores.points + new.points_awarded, updated_at = now();
  return new;
end;
$$ language plpgsql security definer;

create trigger on_fan_score_event
  after insert on public.fan_score_events
  for each row execute procedure public.apply_fan_score_event();

-- ==========================================================
-- Row Level Security (RLS) — เปิดไว้เป็นค่าเริ่มต้นที่ปลอดภัย
-- ==========================================================

alter table public.profiles enable row level security;
alter table public.wallets enable row level security;
alter table public.credit_transactions enable row level security;
alter table public.posts enable row level security;
alter table public.comments enable row level security;
alter table public.likes enable row level security;
alter table public.friendships enable row level security;
alter table public.fan_score_events enable row level security;
alter table public.fan_scores enable row level security;

-- อ่านได้ทุกคน (ฟีดเป็นสาธารณะ), เขียน/แก้ได้เฉพาะเจ้าของแถวตัวเอง
create policy "profiles are viewable by everyone" on public.profiles for select using (true);
create policy "users can update own profile" on public.profiles for update using (auth.uid() = id);

create policy "wallets viewable by owner" on public.wallets for select using (auth.uid() = user_id);
create policy "users can update own wallet" on public.wallets for update using (auth.uid() = user_id);

create policy "transactions viewable by owner" on public.credit_transactions for select using (auth.uid() = user_id);
create policy "users can insert own transactions" on public.credit_transactions for insert with check (auth.uid() = user_id);

create policy "posts are viewable by everyone" on public.posts for select using (true);
create policy "users can insert own posts" on public.posts for insert with check (auth.uid() = user_id);
create policy "users can update own posts" on public.posts for update using (auth.uid() = user_id);

create policy "comments are viewable by everyone" on public.comments for select using (true);
create policy "users can insert own comments" on public.comments for insert with check (auth.uid() = user_id);

create policy "likes are viewable by everyone" on public.likes for select using (true);
create policy "users can like as themselves" on public.likes for insert with check (auth.uid() = user_id);
create policy "users can unlike own like" on public.likes for delete using (auth.uid() = user_id);

create policy "friendships viewable by participants" on public.friendships for select using (auth.uid() = user_id or auth.uid() = friend_id);
create policy "users can create own friend requests" on public.friendships for insert with check (auth.uid() = user_id);

create policy "fan score events viewable by participants" on public.fan_score_events for select using (auth.uid() = from_user_id or auth.uid() = to_user_id);
create policy "users can insert own fan score events" on public.fan_score_events for insert with check (auth.uid() = from_user_id);

create policy "fan scores viewable by everyone" on public.fan_scores for select using (true);
