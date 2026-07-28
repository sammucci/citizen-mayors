-- Fixes the real cause of "suggested decision-maker always lands at the
-- top of the chain, even after approval."
--
-- Every insert into proposal_power_tree_nodes (including a non-owner's
-- suggestion) is immediately followed by a full reindex: every existing
-- node's sort_order gets rewritten to match its new array position, so
-- the new entry lands exactly where it was inserted. That reindex is a
-- batch of UPDATE statements.
--
-- The old "owner reorders own power tree" policy only let the proposal
-- OWNER run UPDATEs on this table. So when anyone else suggested a
-- decision-maker, the INSERT succeeded (a separate, already-open
-- policy), but every one of the follow-up reindex UPDATEs was silently
-- rejected by RLS — the app code never checked for that error. The new
-- node was left sitting at its placeholder sort_order, which is always
-- the highest value in the set, so it always rendered at the very top
-- of the chain, no matter which "+" was used to add it — and it stayed
-- there even after approval, since approving never touches sort_order.
--
-- This opens UPDATE to any authenticated user, matching the insert
-- policy already in place. The actions that actually need owner-only
-- enforcement (drag-to-reorder, approving a suggestion) already check
-- proposal ownership themselves inside the server action, before ever
-- touching the database — so this doesn't hand out any capability the
-- app doesn't already gate on its own.
--
-- Safe to run more than once.

drop policy if exists "owner reorders own power tree" on public.proposal_power_tree_nodes;
drop policy if exists "authenticated reindex power tree" on public.proposal_power_tree_nodes;

create policy "authenticated reindex power tree" on public.proposal_power_tree_nodes for update
  using (auth.role() = 'authenticated');
