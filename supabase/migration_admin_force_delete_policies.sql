-- Two RLS gaps found while building the grants/organizations admin
-- screens, both the same shape: an app-level admin check
-- (requireAdmin() in admin/actions.ts) isn't enough on its own — RLS is
-- what actually allows or blocks the write at the database level,
-- regardless of what the application already verified. Without a
-- matching admin policy, an admin's "force delete anyway" click just
-- gets silently rejected by Postgres for any row they don't personally
-- own.
--
-- 1) proposal_power_tree_nodes: the only existing delete policy is
--    "owner edits own power tree" (the proposal's owner only) — so
--    forceDeleteDecisionMaker's attempt to strip an abusive
--    decision-maker entry out of every OTHER person's proposal chain
--    was silently failing this whole time for any chain the admin
--    didn't personally own. This adds the missing admin override.
-- 2) profile_organizations: same issue for the brand-new
--    forceDeleteOrganizationAdmin — the only existing delete policy is
--    "members remove their own organizations" (each resident their own
--    attachment only). Admin override added here too, so removing a
--    junk organization entry actually detaches it from every resident's
--    profile instead of only the admin's own.
--
-- Safe to run more than once.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'proposal_power_tree_nodes' and policyname = 'admin removes any power tree node'
  ) then
    create policy "admin removes any power tree node" on public.proposal_power_tree_nodes for delete
      using (exists (select 1 from public.profiles where id = auth.uid() and is_admin));
  end if;

  if not exists (
    select 1 from pg_policies
    where tablename = 'profile_organizations' and policyname = 'admin removes any profile organization'
  ) then
    create policy "admin removes any profile organization" on public.profile_organizations for delete
      using (exists (select 1 from public.profiles where id = auth.uid() and is_admin));
  end if;
end $$;
