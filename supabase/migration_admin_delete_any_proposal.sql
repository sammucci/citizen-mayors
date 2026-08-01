-- Lets an admin delete ANY proposal, not just their own — same idea as
-- "admin deletes decision makers." An admin testing the app ends up with
-- a pile of test proposals, and one-at-a-time deletion from each
-- proposal's own page was the only path before this.
drop policy if exists "admin deletes any proposal" on public.proposals;
create policy "admin deletes any proposal" on public.proposals for delete
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin));
