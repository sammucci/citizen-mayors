-- Adds support for an image on each proposal: a column to store the
-- public URL, plus a Supabase Storage bucket + policies so images can
-- actually be uploaded and served. No dashboard clicking needed — this
-- creates the bucket via SQL. Safe to re-run.

alter table public.proposals add column if not exists image_url text;

insert into storage.buckets (id, name, public)
values ('proposal-images', 'proposal-images', true)
on conflict (id) do nothing;

drop policy if exists "public read proposal images" on storage.objects;
create policy "public read proposal images" on storage.objects for select
  using (bucket_id = 'proposal-images');

drop policy if exists "authenticated upload proposal images" on storage.objects;
create policy "authenticated upload proposal images" on storage.objects for insert
  with check (bucket_id = 'proposal-images' and auth.role() = 'authenticated');

drop policy if exists "authenticated update own proposal images" on storage.objects;
create policy "authenticated update own proposal images" on storage.objects for update
  using (bucket_id = 'proposal-images' and auth.role() = 'authenticated');
