-- Opens up the decision chain to the whole community, not just the
-- proposal owner: anyone signed in can suggest a decision-maker.
-- Owner's own additions land approved immediately (unchanged); anyone
-- else's land pending until the owner approves or removes them.
alter table public.proposal_power_tree_nodes
  add column if not exists status text not null default 'approved' check (status in ('pending', 'approved')),
  add column if not exists submitted_by uuid references public.profiles(id);

-- Was owner-only; anyone signed in can now insert (the app layer
-- decides pending vs approved based on ownership).
drop policy if exists "owner builds own power tree" on public.proposal_power_tree_nodes;
drop policy if exists "authenticated contribute to power tree" on public.proposal_power_tree_nodes;

create policy "authenticated contribute to power tree" on public.proposal_power_tree_nodes for insert
  with check (auth.role() = 'authenticated');
