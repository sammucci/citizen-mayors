-- Precedent & case studies — a proposal-specific sidebar box (below
-- Tags) where anyone can attach a real-world example: a similar
-- project elsewhere, how it got funded, who was involved, what
-- challenges came up. Meant to help with grant applications — "here's
-- precedent this kind of thing works and gets funded."
--
-- Same trust model as proposal_grants (an existing, similar
-- "informational lead attached to a proposal" table): wide-open insert
-- for any signed-in resident, no approval step, but only the proposal
-- OWNER or an admin can remove one back out (not the person who added
-- it) — see proposals/actions.ts's addCaseStudy/removeCaseStudy.
create table public.proposal_case_studies (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.proposals(id) on delete cascade,
  project_name text not null,
  location text,
  cost text, -- free text on purpose ("$2.4M", "~$500K", "unknown") — real-world figures are often approximate or ranges, forcing a strict numeric field would just push people to guess a fake-precise number
  funding_source text,
  who_was_involved text,
  challenges_feedback text,
  source_url text,
  submitted_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

alter table public.proposal_case_studies enable row level security;

create policy "public read proposal case studies" on public.proposal_case_studies for select using (true);
create policy "authenticated add proposal case studies" on public.proposal_case_studies for insert
  with check (auth.uid() = submitted_by);
create policy "owner or admin remove proposal case studies" on public.proposal_case_studies for delete
  using (
    exists (select 1 from public.proposals p where p.id = proposal_id and p.owner_id = auth.uid())
    or exists (select 1 from public.profiles where id = auth.uid() and is_admin)
  );
