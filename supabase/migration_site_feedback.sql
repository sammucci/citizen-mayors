-- "Report an issue" — the floating widget in the corner of every page
-- (see feedback-widget.tsx, rendered from the root layout). Built for
-- the soft-launch working-group batch: a low-friction way to flag
-- something confusing or broken without emailing Samantha directly, and
-- a real signal for what the click-through tutorial (still unbuilt)
-- needs to cover. Deliberately NOT gated on being signed in — someone
-- can hit a confusing moment before they've ever logged in, and
-- shouldn't have to sign in just to say so. page_path is captured
-- automatically (whatever page they were on), not typed by hand.
-- Admin-only to read, same as the rest of this app's moderation-style
-- tables; nobody needs to see what anyone else reported.
create table public.site_feedback (
  id uuid primary key default gen_random_uuid(),
  message text not null,
  page_path text,
  user_id uuid references public.profiles(id) on delete set null,
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.site_feedback enable row level security;

-- Wide open to insert (including anonymous — no `with check` restricting
-- who), since the whole point is someone doesn't need an account to flag
-- that something's confusing. Only an admin can read or update/delete —
-- this is a moderation inbox, not a public feed.
create policy "anyone inserts site feedback" on public.site_feedback for insert
  with check (true);
create policy "admin reads site feedback" on public.site_feedback for select
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin));
create policy "admin updates site feedback" on public.site_feedback for update
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin));
create policy "admin deletes site feedback" on public.site_feedback for delete
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin));
