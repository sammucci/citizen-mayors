-- Fixes a real bug: the decision-tree up/down arrows have been silently
-- doing nothing. proposal_power_tree_nodes had RLS policies for insert
-- and delete, but nobody ever added one for update — so every attempt to
-- swap sort_order was blocked by Postgres with no visible error, and the
-- button just looked broken. Safe to re-run.

drop policy if exists "owner reorders own power tree" on public.proposal_power_tree_nodes;

create policy "owner reorders own power tree" on public.proposal_power_tree_nodes for update
  using (exists (select 1 from public.proposals p where p.id = proposal_id and p.owner_id = auth.uid()));
