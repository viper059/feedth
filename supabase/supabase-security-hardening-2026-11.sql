-- บันทึกแพตช์ความปลอดภัยที่ใช้กับฐานข้อมูลแล้ว (2026-11-20) — เก็บไว้เป็นประวัติ/สร้างฐานข้อมูลใหม่
-- 1) กันปลอมโปรโมทโพสต์ฟรี
revoke insert, update on public.posts from authenticated, anon;
grant insert (user_id, content, media_urls, place_id, rating) on public.posts to authenticated;
revoke insert, update, delete on public.places from authenticated, anon;
-- 2) ประวัติเช็คอินเห็นเฉพาะของตัวเอง
drop policy if exists "checkins viewable by everyone" on public.checkins;
drop policy if exists "checkins readable by owner" on public.checkins;
create policy "checkins readable by owner" on public.checkins for select to authenticated using (auth.uid() = user_id);
revoke select on public.checkins from anon;
-- 3) กันสแปม: โพสต์ ≤30/ชม. ≤5000 ตัวอักษร / คอมเมนต์ ≤60/ชม. ≤1000 ตัวอักษร
create or replace function public._limit_posts() returns trigger language plpgsql set search_path = public as $$
begin
  if char_length(new.content) > 5000 then raise exception 'post too long'; end if;
  if (select count(*) from posts where user_id = new.user_id and created_at > now() - interval '1 hour') >= 30 then raise exception 'post rate limit reached'; end if;
  return new;
end $$;
create or replace function public._limit_comments() returns trigger language plpgsql set search_path = public as $$
begin
  if char_length(new.content) > 1000 then raise exception 'comment too long'; end if;
  if (select count(*) from comments where user_id = new.user_id and created_at > now() - interval '1 hour') >= 60 then raise exception 'comment rate limit reached'; end if;
  return new;
end $$;
drop trigger if exists limit_posts_trg on public.posts;
create trigger limit_posts_trg before insert on public.posts for each row execute function public._limit_posts();
drop trigger if exists limit_comments_trg on public.comments;
create trigger limit_comments_trg before insert on public.comments for each row execute function public._limit_comments();

-- SEO hub pages (2026-11-20): ฟังก์ชันอ่านอย่างเดียวสำหรับสร้างหน้ารวมจังหวัด/หมวด (scripts/prerender-hubs.mjs)
-- (ดู migration seo_hub_functions: seo_area_counts(), seo_area_top(province,category,kind,limit) — security invoker, anon execute)
