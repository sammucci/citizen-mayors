-- v11 migration: allow the proposal owner to remove a tag they've added.
-- Adds the missing delete policy on proposal_tags — insert already
-- existed, delete never did. Safe to re-run.

drop policy if exists "owner removes own proposal_tags" on public.proposal_tags;

create policy "owner removes own proposal_tags" on public.proposal_tags for delete
  using (exists (select 1 from public.proposals p where p.id = proposal_id and p.owner_id = auth.uid()));
