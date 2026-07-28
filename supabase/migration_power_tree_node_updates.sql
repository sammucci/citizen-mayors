-- Decision-chain redesign, part of the "notes/updates" feature: a
-- running log of dated notes on a specific decision-maker within a
-- specific proposal's chain — when someone talked to them, what came
-- of it, what's useful to know for next time. Separate from the
-- existing single "note" field (role, e.g. "final sign-off") on
-- proposal_power_tree_nodes; this is many entries over time, not one.
--
-- Crowdsourced like the decision-maker registry itself and most of the
-- rest of the platform: any signed-in person can add an update, not
-- just the proposal owner — knowledge about how a council office
-- actually responds is useful from whoever has it, not just whoever
-- filed the proposal. No edit/delete yet in this first pass.
create table public.power_tree_node_updates (
  id uuid primary key default gen_random_uuid(),
  node_id uuid not null references public.proposal_power_tree_nodes(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

alter table public.power_tree_node_updates enable row level security;

create policy "public read power_tree_node_updates" on public.power_tree_node_updates for select using (true);
create policy "authenticated add power_tree_node_updates" on public.power_tree_node_updates for insert
  with check (auth.uid() = author_id);
