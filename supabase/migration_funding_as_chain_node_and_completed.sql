-- Redesigns funding from a single proposal-wide flag + flat "Funding
-- leads" list into its own node type inside the decision chain itself
-- (proposal_power_tree_nodes), sequenced right alongside decision-maker
-- links. Rationale: a project can need money at more than one distinct
-- stage (permitting, then construction, ...) — a single flag couldn't
-- capture that, a node per funding need can.
--
-- Also adds a `completed` flag to every chain link (decision-maker or
-- funding) — a visual, motivating "this one's done" marker, independent
-- of approval status.
--
-- The old proposals.funding_needed column and the proposal_grants table
-- (from migration_funding_needed_and_grants.sql) are left in place,
-- unused going forward — dropping them isn't necessary and risks data
-- loss for no benefit; the app code simply no longer reads or writes
-- them. Safe to re-run.

alter table public.proposal_power_tree_nodes
  add column if not exists node_type text not null default 'decision_maker';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'proposal_power_tree_nodes_node_type_check'
  ) then
    alter table public.proposal_power_tree_nodes
      add constraint proposal_power_tree_nodes_node_type_check
      check (node_type in ('decision_maker', 'funding'));
  end if;
end $$;

alter table public.proposal_power_tree_nodes
  add column if not exists grant_id uuid references public.grants(id);

-- Has to become nullable to allow a funding node (which has no
-- decision-maker at all) — a no-op if it's already nullable from a
-- prior run of this migration.
alter table public.proposal_power_tree_nodes
  alter column decision_maker_id drop not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'power_tree_node_type_fields'
  ) then
    alter table public.proposal_power_tree_nodes
      add constraint power_tree_node_type_fields check (
        (node_type = 'decision_maker' and decision_maker_id is not null)
        or (node_type = 'funding' and decision_maker_id is null)
      );
  end if;
end $$;

alter table public.proposal_power_tree_nodes
  add column if not exists completed boolean not null default false;
alter table public.proposal_power_tree_nodes
  add column if not exists completed_at timestamptz;
