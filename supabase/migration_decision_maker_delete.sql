-- Lets admins delete entries from the shared decision-makers registry
-- (typos, duplicates, etc.) — previously there was no delete policy at
-- all, so even an admin's delete would have been silently blocked by RLS.
create policy "admin deletes decision makers" on public.decision_makers for delete
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin));

-- One-off cleanup: removes the lowercase "quetcy lozada" duplicate you
-- flagged, leaving the properly-capitalized "Quetcy Lozada" entry in
-- place. Only deletes if it isn't currently used in any proposal's
-- decision chain (if it is, this does nothing — remove it from that
-- proposal's chain first, then re-run).
delete from public.decision_makers
where name = 'quetcy lozada'
  and id not in (select decision_maker_id from public.proposal_power_tree_nodes);
