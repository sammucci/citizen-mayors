-- Project Phases feature. Samantha's call, confirmed: the decision
-- chain should be purely the approval/permission path ("who has to say
-- yes"); funding is something you secure during implementation, not
-- something you need permission for, so it moves out of the chain and
-- into a new, separate "phases" list. This is a real structural
-- override, not an additive change — existing funding-type chain nodes
-- get migrated into phases and then removed from the chain entirely.

-- 1) The new table.
create table if not exists public.proposal_phases (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.proposals(id) on delete cascade,
  label text not null,
  note text,
  sort_order int not null default 0,
  progress text not null default 'not_started' check (progress in ('not_started', 'in_progress', 'done')),
  status text not null default 'approved' check (status in ('pending', 'approved')),
  added_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.proposal_phases enable row level security;

drop policy if exists "public read proposal phases" on public.proposal_phases;
drop policy if exists "authenticated add proposal phases" on public.proposal_phases;
drop policy if exists "owner deletes own proposal phases" on public.proposal_phases;
drop policy if exists "admin deletes any proposal phase" on public.proposal_phases;
drop policy if exists "authenticated updates proposal phases" on public.proposal_phases;

create policy "public read proposal phases" on public.proposal_phases for select using (true);
create policy "authenticated add proposal phases" on public.proposal_phases for insert
  with check (auth.role() = 'authenticated');
create policy "owner deletes own proposal phases" on public.proposal_phases for delete
  using (exists (select 1 from public.proposals p where p.id = proposal_id and p.owner_id = auth.uid()));
create policy "admin deletes any proposal phase" on public.proposal_phases for delete
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin));
create policy "authenticated updates proposal phases" on public.proposal_phases for update
  using (auth.role() = 'authenticated');

-- 2) Migrate every existing funding-type chain node into a phase. Label
-- prefers the linked grant's name (same fallback text the old UI used:
-- "Funding needed" when no grant was picked yet); the funder and the
-- node's own free-text note both get folded into the phase's note so
-- nothing typed in gets silently dropped. completed -> progress ('done'
-- vs 'not_started' — there was no in-between state before this).
-- row_number() keeps each proposal's funding nodes in their old relative
-- order, re-based to start at 0 (new phases just append after via
-- max(sort_order)+1 in the app, so this doesn't need to match anything
-- else).
insert into public.proposal_phases (proposal_id, label, note, sort_order, progress, status, added_by, created_at, updated_at)
select
  n.proposal_id,
  coalesce(g.name, 'Secure funding'),
  nullif(
    trim(both ' — ' from concat_ws(' — ',
      case when g.funder is not null then 'Funder: ' || g.funder else null end,
      n.note
    )),
    ''
  ),
  row_number() over (partition by n.proposal_id order by n.sort_order) - 1,
  case when n.completed then 'done' else 'not_started' end,
  n.status,
  n.submitted_by,
  n.created_at,
  n.updated_at
from public.proposal_power_tree_nodes n
left join public.grants g on g.id = n.grant_id
where n.node_type = 'funding';

-- 3) Remove the migrated rows from the chain — the whole point of this
-- migration is that funding no longer lives there. Safe to run this
-- migration file twice: after the first run there are no more
-- node_type = 'funding' rows left to insert or delete, so it's a no-op.
delete from public.proposal_power_tree_nodes where node_type = 'funding';

-- 4) Lock the chain down to decision-maker-only going forward — both at
-- the column level (grant_id no longer has any meaning here) and the
-- check constraint (node_type can only ever be 'decision_maker' now).
alter table public.proposal_power_tree_nodes drop column if exists grant_id;
alter table public.proposal_power_tree_nodes drop constraint if exists power_tree_node_type_fields;
alter table public.proposal_power_tree_nodes drop constraint if exists proposal_power_tree_nodes_node_type_check;
alter table public.proposal_power_tree_nodes add constraint proposal_power_tree_nodes_node_type_check check (node_type = 'decision_maker');
-- Safe now that every remaining row is node_type = 'decision_maker' —
-- the original constraint already required decision_maker_id to be set
-- for every row of that type, and every row where it wasn't (the
-- funding ones) is gone as of step 3 above.
alter table public.proposal_power_tree_nodes alter column decision_maker_id set not null;
