-- Civic report card / "add a log" feature: a per-user civic profile
-- showing platform engagement (computed live from existing tables —
-- proposals, comments, decision-maker notes — no new columns needed
-- for that half) plus self-reported off-platform civic actions logged
-- here (letters to the editor, community meetings, volunteer hours,
-- testimony).
--
-- One flexible table for all four log types rather than four separate
-- tables — the "shape" of each type only differs by which columns are
-- filled in, which keeps a single feed/list easy ("your civic log")
-- instead of needing to merge four queries every time.
--
-- Safe to re-run.

create table if not exists public.civic_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  log_type text not null check (log_type in ('letter_to_editor', 'community_meeting', 'volunteer_hours', 'testimony')),
  occurred_on date not null default current_date,
  -- letter_to_editor only:
  published boolean not null default false,
  published_link text,
  -- volunteer_hours only:
  hours numeric,
  category text,
  -- any type, optional:
  note text,
  -- 'draft' = an in-progress entry auto-saved when the add-a-log window
  -- was closed before finishing (so it's never just lost), shown only
  -- to the person who started it and left out of their public report
  -- card counts until they come back and finish it.
  status text not null default 'published' check (status in ('draft', 'published')),
  created_at timestamptz not null default now()
);

alter table public.civic_logs enable row level security;

drop policy if exists "read published or own civic logs" on public.civic_logs;
create policy "read published or own civic logs" on public.civic_logs for select
  using (status = 'published' or user_id = auth.uid());

drop policy if exists "authenticated create own civic logs" on public.civic_logs;
create policy "authenticated create own civic logs" on public.civic_logs for insert
  with check (auth.uid() = user_id);

drop policy if exists "owner updates own civic logs" on public.civic_logs;
create policy "owner updates own civic logs" on public.civic_logs for update
  using (auth.uid() = user_id);

drop policy if exists "owner deletes own civic logs" on public.civic_logs;
create policy "owner deletes own civic logs" on public.civic_logs for delete
  using (auth.uid() = user_id);
