-- เจ้าของร้านอัปโหลดรูปแกลเลอรีของร้านเองได้หลายรูป (migration shop_gallery_photos) — ไม่มี DROP/DELETE
alter table public.shop_profiles add column if not exists gallery text[] not null default '{}';

create or replace function public.set_shop_gallery(p_place_id bigint, p_urls text[])
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_urls is null then p_urls := '{}'; end if;
  if cardinality(p_urls) > 12 then raise exception 'too many photos'; end if;
  if exists (select 1 from unnest(p_urls) u where u not like 'https://qozkybfaayjsmzrwxtyb.supabase.co/storage/v1/object/public/post-images/%') then raise exception 'invalid photo url'; end if;
  update shop_profiles set gallery = p_urls, updated_at = now() where place_id = p_place_id and owner_id = auth.uid();
  if not found then raise exception 'not the owner'; end if;
end $$;
revoke execute on function public.set_shop_gallery(bigint, text[]) from public, anon;
grant execute on function public.set_shop_gallery(bigint, text[]) to authenticated;

create or replace function public.shop_detail(p_place_id bigint)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'place_id', p.id, 'name', p.name, 'category', p.category, 'lat', p.lat, 'lng', p.lng,
    'about', s.about, 'phone', s.phone, 'hours', s.hours, 'cover_url', s.cover_url,
    'claimed', s.owner_id is not null,
    'is_owner', coalesce(s.owner_id = auth.uid(), false),
    'my_claim', (select c.status from shop_claims c where c.place_id = p.id and c.user_id = auth.uid() order by c.created_at desc limit 1),
    'gallery', to_jsonb(coalesce(s.gallery, '{}')),
    'photos', (coalesce(to_jsonb(s.gallery), '[]'::jsonb) || coalesce((select jsonb_agg(u) from (select unnest(po.media_urls) u from posts po where po.place_id = p.id and cardinality(po.media_urls) > 0 order by po.created_at desc limit 12) t), '[]'::jsonb)),
    'avg_rating', (select round(avg(ck.rating)::numeric, 1) from checkins ck where ck.place_id = p.id and ck.rating is not null),
    'review_count', (select count(*) from checkins ck where ck.place_id = p.id))
  from places p left join shop_profiles s on s.place_id = p.id where p.id = p_place_id;
$$;
