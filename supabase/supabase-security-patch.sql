-- ==========================================================
-- feedTH security patch
-- รันใน SQL Editor "หลัง" รัน supabase-schema.sql
-- ย้ายเรื่องเงิน/คะแนนไปเป็นฟังก์ชันฝั่งเซิร์ฟเวอร์ ผู้ใช้แก้ตัวเลขเองผ่าน API ไม่ได้อีก
-- ==========================================================

-- 1) ปิดช่องที่ผู้ใช้โกงได้
drop policy if exists "users can update own wallet" on public.wallets;
drop policy if exists "users can update own posts" on public.posts;
drop policy if exists "users can insert own transactions" on public.credit_transactions;
drop policy if exists "users can insert own fan score events" on public.fan_score_events;

alter table public.wallets drop constraint if exists wallets_balance_nonneg;
alter table public.wallets add constraint wallets_balance_nonneg check (credit_balance >= 0);

-- 2) บูสต์โพสต์ (atomic: เช็คเจ้าของ + ตัดเครดิต + ledger + เปิดบูสต์ ในธุรกรรมเดียว)
--    ราคา/ระยะเวลากำหนดฝั่งเซิร์ฟเวอร์ ผู้ใช้เปลี่ยนเองไม่ได้
create or replace function public.boost_post(p_post_id bigint, p_credits int)
returns int language plpgsql security definer set search_path = public as $$
declare v_hours int; v_balance int;
begin
  v_hours := case p_credits when 10 then 6 when 25 then 24 when 50 then 72 else null end;
  if v_hours is null then raise exception 'invalid boost package'; end if;
  if not exists (select 1 from posts where id = p_post_id and user_id = auth.uid()) then
    raise exception 'not your post';
  end if;
  update wallets
    set credit_balance = credit_balance - p_credits, updated_at = now()
    where user_id = auth.uid() and credit_balance >= p_credits
    returning credit_balance into v_balance;
  if v_balance is null then raise exception 'insufficient credits'; end if;
  insert into credit_transactions (user_id, type, amount, related_post_id)
    values (auth.uid(), 'spend', p_credits, p_post_id);
  update posts
    set is_boosted = true,
        boost_expire_at = greatest(coalesce(boost_expire_at, now()), now()) + make_interval(hours => v_hours)
    where id = p_post_id;
  return v_balance;
end $$;

-- 3) เติมเครดิตสำหรับเดโม่เท่านั้น
--    ⚠️ ก่อนเปิดใช้งานจริงให้ลบฟังก์ชันนี้ทิ้ง (drop function public.demo_topup)
--    ของจริงต้องเติมผ่าน payment webhook ฝั่งเซิร์ฟเวอร์ที่ใช้ service_role key เท่านั้น
create or replace function public.demo_topup(p_amount int)
returns int language plpgsql security definer set search_path = public as $$
declare v_balance int;
begin
  if p_amount <> 100 then raise exception 'invalid amount'; end if;
  update wallets set credit_balance = credit_balance + p_amount, updated_at = now()
    where user_id = auth.uid() returning credit_balance into v_balance;
  insert into credit_transactions (user_id, type, amount) values (auth.uid(), 'topup', p_amount);
  return v_balance;
end $$;

-- 4) ให้คะแนนเพื่อนรัก: เซิร์ฟเวอร์คำนวณคะแนนและผู้รับเอง
--    เช็คว่ามีไลค์/คอมเมนต์จริงก่อน, ให้ซ้ำไม่ได้ (unique constraint), ให้ตัวเองไม่ได้
create or replace function public.award_fan_points(p_post_id bigint, p_action text)
returns int language plpgsql security definer set search_path = public as $$
declare v_owner uuid; v_pts int; v_rows int;
begin
  select user_id into v_owner from posts where id = p_post_id;
  if v_owner is null or v_owner = auth.uid() then return 0; end if;
  v_pts := case p_action when 'like' then 1 when 'comment' then 2 when 'share' then 3 else null end;
  if v_pts is null then raise exception 'invalid action'; end if;
  if p_action = 'like' and not exists
    (select 1 from likes where post_id = p_post_id and user_id = auth.uid()) then return 0; end if;
  if p_action = 'comment' and not exists
    (select 1 from comments where post_id = p_post_id and user_id = auth.uid()) then return 0; end if;
  insert into fan_score_events (from_user_id, to_user_id, post_id, action, points_awarded)
    values (auth.uid(), v_owner, p_post_id, p_action, v_pts)
    on conflict (from_user_id, to_user_id, post_id, action) do nothing;
  get diagnostics v_rows = row_count;
  return case when v_rows > 0 then v_pts else 0 end;
end $$;

-- 5) อนุญาตเฉพาะผู้ที่ล็อกอินแล้วเรียกใช้
revoke execute on function public.boost_post(bigint, int) from public, anon;
revoke execute on function public.demo_topup(int) from public, anon;
revoke execute on function public.award_fan_points(bigint, text) from public, anon;
grant execute on function public.boost_post(bigint, int) to authenticated;
grant execute on function public.demo_topup(int) to authenticated;
grant execute on function public.award_fan_points(bigint, text) to authenticated;
