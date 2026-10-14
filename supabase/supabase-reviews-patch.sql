-- feedTH reviews patch (รอบ 1): เช็คอินกลายเป็นโพสต์ในฟีด + หน้าสถานที่/รีวิว
-- รันหลัง places-patch, รันซ้ำได้ปลอดภัย (ไม่ลบข้อมูล)

alter table public.posts add column if not exists place_id bigint references public.places(id) on delete set null;
alter table public.posts add column if not exists rating int check (rating between 1 and 5);
create index if not exists posts_place_idx on public.posts(place_id, created_at desc);

-- เช็คอิน: ตรวจเหมือนเดิม + สร้างโพสต์ผูกกับสถานที่ให้อัตโนมัติ
create or replace function public.check_in(p_place_id bigint, p_lat float8, p_lng float8, p_rating int, p_caption text)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_place places%rowtype; v_last record; v_id bigint; v_hours float8; v_text text;
begin
  select * into v_place from places where id = p_place_id;
  if not found then raise exception 'place not found'; end if;
  if dist_m(p_lat, p_lng, v_place.lat, v_place.lng) > 150 then raise exception 'too far from place'; end if;

  select c.created_at, pl.lat, pl.lng into v_last
    from checkins c join places pl on pl.id = c.place_id
    where c.user_id = auth.uid() order by c.created_at desc limit 1;
  if found then
    v_hours := greatest(extract(epoch from (now() - v_last.created_at)) / 3600.0, 0.01);
    if dist_m(v_last.lat, v_last.lng, v_place.lat, v_place.lng) / 1000.0 / v_hours > 300 then
      raise exception 'suspicious travel speed';
    end if;
  end if;

  v_text := coalesce(nullif(trim(p_caption), ''), 'เช็คอินที่ ' || v_place.name);
  begin
    insert into checkins (user_id, place_id, rating, caption)
      values (auth.uid(), p_place_id, p_rating, nullif(trim(p_caption), '')) returning id into v_id;
  exception when unique_violation then
    raise exception 'already checked in today';
  end;
  insert into posts (user_id, content, place_id, rating) values (auth.uid(), v_text, p_place_id, p_rating);
  return v_id;
end $$;

-- สรุปสถานที่: คะแนนเฉลี่ย จำนวนรีวิว จำนวนคนไม่ซ้ำ
create or replace function public.place_summary(p_place_id bigint)
returns table (id bigint, name text, category text, lat float8, lng float8, is_verified boolean,
               avg_rating numeric, review_count bigint, visitors bigint)
language sql stable security definer set search_path = public as $$
  select p.id, p.name, p.category, p.lat, p.lng, p.is_verified,
         round((select avg(rating) from checkins c where c.place_id = p.id and rating is not null)::numeric, 1),
         (select count(*) from checkins c where c.place_id = p.id),
         (select count(distinct user_id) from checkins c where c.place_id = p.id)
  from places p where p.id = p_place_id;
$$;

revoke execute on function public.place_summary(bigint) from public, anon;
grant execute on function public.place_summary(bigint) to authenticated;
revoke execute on function public.check_in(bigint, float8, float8, int, text) from public, anon;
grant execute on function public.check_in(bigint, float8, float8, int, text) to authenticated;

-- กันปลอมรีวิว: โพสต์ธรรมดาที่ insert ตรงๆ ห้ามมี place_id/rating (ต้องผ่าน check_in เท่านั้น)
alter policy "users can insert own posts" on public.posts
  with check (auth.uid() = user_id and place_id is null and rating is null);
