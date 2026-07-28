-- Adds two things to the decision-maker notes log:
-- 1. Single-level replies (a reply can't itself be replied to — kept
--    simple since this is a dated log, not a full comment thread).
-- 2. A "talked to them" flag, to actually track whether people are
--    following through and contacting decision-makers, not just
--    discussing them.
alter table public.power_tree_node_updates
  add column if not exists parent_update_id uuid references public.power_tree_node_updates(id) on delete cascade,
  add column if not exists talked_to boolean not null default false;
