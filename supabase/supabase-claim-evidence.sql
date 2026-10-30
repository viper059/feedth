-- รูปหลักฐานยืนยันเจ้าของร้าน: bucket ส่วนตัว (ไม่เปิดสาธารณะ) — เจ้าของไฟล์และแอดมินเท่านั้นที่เปิดดูได้
insert into storage.buckets (id, name, public) values ('claim-evidence', 'claim-evidence', false) on conflict (id) do nothing;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'claim evidence insert own') then
    create policy "claim evidence insert own" on storage.objects for insert to authenticated
      with check (bucket_id = 'claim-evidence' and (storage.foldername(name))[1] = auth.uid()::text);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'claim evidence read own or admin') then
    create policy "claim evidence read own or admin" on storage.objects for select to authenticated
      using (bucket_id = 'claim-evidence' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
  end if;
end $$;
