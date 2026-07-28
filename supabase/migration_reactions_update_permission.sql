-- The reactions table (used for both proposal and comment votes) has
-- insert and delete policies but was missing an update policy. The
-- react() action switches a vote in place with an UPDATE when you click
-- the opposite thumb without first un-voting — without this policy,
-- that update silently affects 0 rows (RLS denies by default), so the
-- vote just doesn't visibly switch. Same class of bug as the power-tree
-- reorder fix. Safe to re-run.

drop policy if exists "user updates own reaction" on public.reactions;

create policy "user updates own reaction" on public.reactions for update
  using (auth.uid() = user_id);
