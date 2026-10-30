-- ความท้าทายธรรมชาติ v2 (migration nature_v2): อุทยานครบทุกภาค + ขั้นสูงต้องมีรูปถ่าย
-- ขั้นที่ต้องมีรูป: park ขั้น 3-4 (15, 30 แห่ง) · peak/falls/island ขั้น 3 · region ขั้น 2 (ครบ 6 ภาค)
-- "มีรูป" = มีโพสต์เช็คอินของจุดนั้น (เวลาใกล้เคียงกับการนับจุด) ที่แนบรูปแล้ว
-- โบนัสขั้นสูงจะเข้าเมื่อแนบรูป (ระบบเรียก nature_settle หลังแนบรูป หรือเมื่อเปิดแท็บพิชิต)

drop function if exists public._nature_tiers(text);
create or replace function public._nature_tiers(p_kind text)
returns table (thr int[], pts int[], photo_from int) language sql immutable as $$
  select case p_kind when 'park' then array[1,5,15,30] when 'peak' then array[3,10,25] when 'falls' then array[5,15,40] when 'region' then array[3,6] else array[3,10,25] end,
         case p_kind when 'park' then array[50,150,400,1000] when 'peak' then array[50,150,400] when 'falls' then array[40,120,350] when 'region' then array[300,1500] else array[50,150,400] end,
         case p_kind when 'region' then 2 else 3 end;
$$;
revoke execute on function public._nature_tiers(text) from public, anon, authenticated;

create or replace function public._nature_counts(p_uid uuid)
returns table (kind text, total int, verified int) language sql stable security definer set search_path = public as $$
  with h as (
    select nh.kind, a.region,
      exists (select 1 from posts po where po.user_id = nh.user_id and po.place_id = nh.place_id and cardinality(po.media_urls) > 0
              and abs(extract(epoch from (po.created_at - nh.created_at))) < 60) ver
    from nature_hits nh
    left join places p on p.id = nh.place_id
    left join admin_areas a on a.level = 'pro' and a.name_th = p.province
    where nh.user_id = p_uid)
  select k.kind,
    case when k.kind = 'region' then (select count(distinct region)::int from h where h.kind = 'park' and region is not null)
         else (select count(*)::int from h where h.kind = k.kind) end,
    case when k.kind = 'region' then (select count(distinct region)::int from h where h.kind = 'park' and region is not null and ver)
         else (select count(*)::int from h where h.kind = k.kind and ver) end
  from (values ('park'), ('peak'), ('falls'), ('island'), ('region')) k(kind);
$$;
revoke execute on function public._nature_counts(uuid) from public, anon, authenticated;

create or replace function public._nature_settle(p_uid uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r record; t record; i int; c int; n int; v_pts int := 0; v_new int := 0; v_pending int := 0;
begin
  for r in select * from public._nature_counts(p_uid) loop
    select * into t from public._nature_tiers(r.kind);
    for i in 1..array_length(t.thr, 1) loop
      c := case when i >= t.photo_from then r.verified else r.total end;
      if c >= t.thr[i] then
        insert into nature_awards (user_id, kind, tier, points) values (p_uid, r.kind, i, t.pts[i]) on conflict do nothing;
        get diagnostics n = row_count;
        if n > 0 then v_pts := v_pts + t.pts[i]; v_new := v_new + 1; end if;
      elsif i >= t.photo_from and r.total >= t.thr[i] then
        v_pending := v_pending + 1;
      end if;
    end loop;
  end loop;
  return jsonb_build_object('pts', v_pts, 'awarded', v_new, 'pending_photo', v_pending);
end $$;
revoke execute on function public._nature_settle(uuid) from public, anon, authenticated;

create or replace function public.nature_settle()
returns jsonb language sql security definer set search_path = public as $$ select public._nature_settle(auth.uid()); $$;
revoke execute on function public.nature_settle() from public, anon;
grant execute on function public.nature_settle() to authenticated;

create or replace function public.nature_progress()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_out jsonb := '[]'::jsonb; r record; t record; v_total int; v_done int; v_regions jsonb; v_regions_ver jsonb; v_item jsonb;
begin
  if auth.uid() is null then return v_out; end if;
  perform public._nature_settle(auth.uid());
  select coalesce(jsonb_agg(distinct a.region), '[]'::jsonb) into v_regions
    from nature_hits nh join places p on p.id = nh.place_id join admin_areas a on a.level = 'pro' and a.name_th = p.province
    where nh.user_id = auth.uid() and nh.kind = 'park';
  select coalesce(jsonb_agg(distinct a.region), '[]'::jsonb) into v_regions_ver
    from nature_hits nh join places p on p.id = nh.place_id join admin_areas a on a.level = 'pro' and a.name_th = p.province
    where nh.user_id = auth.uid() and nh.kind = 'park'
      and exists (select 1 from posts po where po.user_id = nh.user_id and po.place_id = nh.place_id and cardinality(po.media_urls) > 0
                  and abs(extract(epoch from (po.created_at - nh.created_at))) < 60);
  for r in select * from public._nature_counts(auth.uid()) loop
    select * into t from public._nature_tiers(r.kind);
    v_total := case when r.kind = 'region' then 6 else (select count(distinct spot_key) from nature_places where kind = r.kind) end;
    select count(*) into v_done from nature_awards where user_id = auth.uid() and kind = r.kind;
    v_item := jsonb_build_object('kind', r.kind, 'count', r.total, 'verified', r.verified, 'total', v_total,
      'thr', to_jsonb(t.thr), 'pts', to_jsonb(t.pts), 'photo_from', t.photo_from, 'tier', v_done);
    if r.kind = 'region' then v_item := v_item || jsonb_build_object('regions', v_regions, 'regions_verified', v_regions_ver); end if;
    v_out := v_out || jsonb_build_array(v_item);
  end loop;
  return v_out;
end $$;
revoke execute on function public.nature_progress() from public, anon;
grant execute on function public.nature_progress() to authenticated;
