-- Adds an optional profile picture: a column on profiles plus a
-- Supabase Storage bucket + policies, same pattern as proposal cover
-- images. Safe to re-run.

alter table public.profiles
  add column if not exists avatar_url text;

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "public read avatars" on storage.objects;
drop policy if exists "authenticated upload avatars" on storage.objects;
drop policy if exists "authenticated update own avatars" on storage.objects;

create policy "public read avatars" on storage.objects for select
  using (bucket_id = 'avatars');
create policy "authenticated upload avatars" on storage.objects for insert
  with check (bucket_id = 'avatars' and auth.role() = 'authenticated');
create policy "authenticated update own avatars" on storage.objects for update
  using (bucket_id = 'avatars' and auth.role() = 'authenticated');
