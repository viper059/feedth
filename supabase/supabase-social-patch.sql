-- feedTH social patch: คำขอเป็นเพื่อน + รายชื่อเพื่อน/ผู้ติดตาม + อัลกอริทึมความสนิทแบบสองทาง (B)
-- รันหลัง fog-patch, รันซ้ำได้ปลอดภัย (ไม่มี DROP)

-- ช่องโหว่เดิม: ผู้ใช้ insert friendships ด้วย status='accepted' เองได้ -> บังคับให้เป็น pending เท่านั้น
alter policy "users can create own friend requests" on public.friendships
  with check (auth.uid() = user_id and status = 'pending' and user_id <> friend_id);

-- สถานะความสัมพันธ์ของฉันกับทุกคน (ใช้แสดงปุ่มในฟีด)
create or replace function public.my_relations()
returns table (other uuid, status text) language sql stable security definer set search_path = public as $$
  select case when user_id = auth.uid() then friend_id else user_id end,
         case when status = 'accepted' then 'friends' when user_id = auth.uid() then 'sent' else 'received' end
  from friendships where auth.uid() in (user_id, friend_id);
$$;

create or replace function public.send_friend_request(p_user uuid)
returns text language plpgsql security definer set search_path = public as $$
declare v_me uuid := auth.uid(); v_row friendships%rowtype;
begin
  if p_user is null or p_user = v_me then raise exception 'invalid user'; end if;
  if not exists (select 1 from profiles where id = p_user) then raise exception 'user not found'; end if;
  select * into v_row from friendships
    where (user_id = v_me and friend_id = p_user) or (user_id = p_user and friend_id = v_me);
  if found then
    if v_row.status = 'accepted' then return 'friends'; end if;
    if v_row.user_id = v_me then return 'sent'; end if;
    -- อีกฝ่ายขอมาก่อนแล้ว: ถือว่ายอมรับ
    update friendships set status = 'accepted' where user_id = p_user and friend_id = v_me;
    return 'friends';
  end if;
  if (select count(*) from friendships where user_id = v_me and created_at > now() - interval '1 day') >= 30 then
    raise exception 'request limit reached';
  end if;
  insert into friendships (user_id, friend_id, status) values (v_me, p_user, 'pending');
  return 'sent';
end $$;

-- ยอมรับคำขอ (ปฏิเสธ/เลิกเป็นเพื่อน/ยกเลิกคำขอ ใช้ DELETE ผ่าน policy ด้านล่าง)
create or replace function public.accept_friend_request(p_user uuid)
returns text language plpgsql security definer set search_path = public as $$
begin
  update friendships set status = 'accepted' where user_id = p_user and friend_id = auth.uid() and status = 'pending';
  if not found then raise exception 'no request'; end if;
  return 'friends';
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'friendships' and policyname = 'participants can delete friendship') then
    create policy "participants can delete friendship" on public.friendships for delete using (auth.uid() in (user_id, friend_id));
  end if;
end $$;

-- ความสนิทแบบสองทาง (B)
-- ทิศทางเดียว x->y = ผลรวมคะแนนไลค์/คอมเมนต์/แชร์ 90 วันล่าสุด ลดครึ่งทุก 30 วัน
create or replace function public._dir_score(x uuid, y uuid)
returns numeric language sql stable security definer set search_path = public as $$
  select coalesce(sum(points_awarded * power(0.5::numeric, extract(epoch from (now() - created_at)) / 86400.0 / 30.0)), 0)
  from fan_score_events where from_user_id = x and to_user_id = y and created_at > now() - interval '90 days';
$$;
-- ความสนิท = ค่าต่ำของสองฝั่ง (ฝั่งเดียวคุยไม่ถือว่าสนิท) + เช็คอินที่เดียวกันวันเดียวกัน (ครั้งละ 2 สูงสุด 10 ครั้ง) + ติดตามกันทั้งคู่ 3
create or replace function public._closeness(a uuid, b uuid)
returns numeric language sql stable security definer set search_path = public as $$
  select round((
    least(public._dir_score(a, b), public._dir_score(b, a))
    + 2 * least((select count(*) from checkins c1 join checkins c2
                  on c2.place_id = c1.place_id and c2.checkin_date = c1.checkin_date
                 where c1.user_id = a and c2.user_id = b and c1.checkin_date > current_date - 90), 10)
    + case when exists (select 1 from follows where follower_id = a and followee_id = b)
            and exists (select 1 from follows where follower_id = b and followee_id = a) then 3 else 0 end
  )::numeric, 1);
$$;
revoke execute on function public._dir_score(uuid, uuid) from public, anon, authenticated;
revoke execute on function public._closeness(uuid, uuid) from public, anon, authenticated;

-- รายชื่อ: friends/requests/sent (เฉพาะของตัวเอง) และ followers/following (ของใครก็ได้)
create or replace function public.people_list(p_kind text, p_user uuid default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_me uuid := auth.uid(); v_t uuid := coalesce(p_user, auth.uid());
begin
  if p_kind not in ('friends', 'requests', 'sent', 'followers', 'following') then raise exception 'invalid kind'; end if;
  if p_kind in ('friends', 'requests', 'sent') and v_t <> v_me then raise exception 'not allowed'; end if;
  return coalesce((
    select jsonb_agg(x.r order by x.cl desc nulls last, x.nm)
    from (
      select p.display_name nm,
             case when p_kind = 'friends' then public._closeness(v_me, p.id) end cl,
             jsonb_build_object('id', p.id, 'name', p.display_name, 'bio', p.bio,
               'closeness', case when p_kind = 'friends' then public._closeness(v_me, p.id) end,
               'i_follow', exists (select 1 from follows f where f.follower_id = v_me and f.followee_id = p.id)) r
      from profiles p
      where p.id in (
        select case when f.user_id = v_me then f.friend_id else f.user_id end from friendships f
          where p_kind = 'friends' and f.status = 'accepted' and v_me in (f.user_id, f.friend_id)
        union select f.user_id from friendships f where p_kind = 'requests' and f.friend_id = v_me and f.status = 'pending'
        union select f.friend_id from friendships f where p_kind = 'sent' and f.user_id = v_me and f.status = 'pending'
        union select fo.follower_id from follows fo where p_kind = 'followers' and fo.followee_id = v_t
        union select fo.followee_id from follows fo where p_kind = 'following' and fo.follower_id = v_t)
      limit 200) x), '[]'::jsonb);
end $$;

do $$
declare f text;
begin
  foreach f in array array[
    'public.my_relations()', 'public.send_friend_request(uuid)', 'public.accept_friend_request(uuid)', 'public.people_list(text, uuid)'] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
