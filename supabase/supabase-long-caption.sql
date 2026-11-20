-- ให้โพสต์พร้อมเช็คอินพิมพ์ยาวได้ถึง 5000 ตัวอักษร (เดิม 500) เพื่อใช้โปรโมทสถานที่
-- รันใน Supabase > SQL Editor ได้เลย (รันซ้ำได้ ไม่เสียหาย)
do $$
declare c record;
begin
  -- ลบ check เดิมที่จำกัดความยาว caption ของ checkins (ชื่อ constraint อาจต่างกัน จึงค้นหาให้)
  for c in
    select conname from pg_constraint
    where conrelid = 'public.checkins'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%char_length(caption)%'
  loop
    execute format('alter table public.checkins drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.checkins
  add constraint checkins_caption_len check (caption is null or char_length(caption) <= 5000);

-- ตรวจผล: ควรเห็น checkins_caption_len ... <= 5000
select conname, pg_get_constraintdef(oid) from pg_constraint
where conrelid = 'public.checkins'::regclass and contype = 'c';
