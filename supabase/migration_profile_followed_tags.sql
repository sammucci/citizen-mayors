-- "Crowdsourced expertise" feature: residents pick tags they're
-- interested in/knowledgeable about on their own profile, and the
-- notification bell alerts them when a proposal shows up carrying one of
-- those tags — whether that's a brand-new proposal or an existing one
-- that just got tagged with it later (tags get added after the fact a
-- lot via the tag-suggestion approval flow). Not scoped to geography on
-- purpose (Samantha's call): expertise isn't tied to where you live.

-- Needed so the bell can time-gate "a followed tag just showed up on a
-- proposal" the same way every other bell item is time-gated
-- (created_at > notifications_seen_at). Existing rows backfill to now()
-- via the column default — they'll all read as "already seen" the first
-- time this ships, which is the right behavior (nobody should get a
-- flood of alerts for tags that have applied to old proposals all along).
alter table public.proposal_tags add column if not exists created_at timestamptz not null default now();

create table if not exists public.profile_followed_tags (
  profile_id uuid references public.profiles(id) on delete cascade,
  tag_id int references public.tags(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profile_id, tag_id)
);

alter table public.profile_followed_tags enable row level security;

create policy "user reads own followed tags" on public.profile_followed_tags for select
  using (auth.uid() = profile_id);
create policy "user follows tags" on public.profile_followed_tags for insert
  with check (auth.uid() = profile_id);
create policy "user unfollows own tags" on public.profile_followed_tags for delete
  using (auth.uid() = profile_id);
