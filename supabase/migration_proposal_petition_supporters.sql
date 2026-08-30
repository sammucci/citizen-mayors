-- Petition support — the on-platform half of the petition feature.
--
-- This is deliberately NOT a signature-collection system: Change.org
-- (and similar free platforms) already do that well — verification,
-- sharing, press credibility — and duplicating it would be a lot of
-- infrastructure for something outside Citizen Mayors' actual job. The
-- proposal page instead auto-drafts petition text from the proposal's
-- own title/summary and hands off to Change.org's own start-a-petition
-- flow (there's no working URL-based prefill on Change.org's side —
-- verified by testing it directly — so this is copy-paste, not a deep
-- link).
--
-- What this table IS: the simple "N Citizen Mayors are behind this"
-- counter shown alongside that draft, same wide-open trust model as
-- proposal_grants/proposal_case_studies (any signed-in resident, no
-- approval step). Removal is the one place this differs from those two:
-- the SUPPORTER themselves (or an admin) can remove their own row, not
-- the proposal owner — a signature is a statement about the signer, not
-- something the owner curates.
--
-- Gating for when the petition tools appear lives in the app layer, not
-- this table: phases-section.tsx matches on the phase's own label (e.g.
-- "Start a petition") and shows the draft + this counter inside THAT
-- phase's own detail panel, once it's an approved phase — not as a
-- separate box gated on some unrelated phase being marked done.
create table public.proposal_petition_supporters (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.proposals(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (proposal_id, user_id)
);

alter table public.proposal_petition_supporters enable row level security;

create policy "public read proposal petition supporters" on public.proposal_petition_supporters for select using (true);
create policy "authenticated add petition support" on public.proposal_petition_supporters for insert
  with check (auth.uid() = user_id);
create policy "supporter or admin remove petition support" on public.proposal_petition_supporters for delete
  using (
    auth.uid() = user_id
    or exists (select 1 from public.profiles where id = auth.uid() and is_admin)
  );
