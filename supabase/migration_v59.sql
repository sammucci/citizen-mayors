-- v59: optional "We the people" action note on proposals, plus admin
-- rename/edit parity that was missing for decision_makers, tags, and
-- categories (previously only volunteer_categories had full inline
-- rename support). Safe to re-run.

-- ---------------------------------------------------------------------------
-- Proposals: an optional, owner-editable note on the fixed "We the
-- people" anchor at the bottom of the decision chain — what the actual
-- first step looks like (e.g. "Write proposal", "Make petition"), since
-- that anchor previously had no fields of its own at all, just a static
-- label. Nothing here changes the anchor's fixed/non-draggable nature —
-- it's still not a real power-tree node, just a describable one now.
-- ---------------------------------------------------------------------------
alter table public.proposals add column if not exists people_action_note text;

-- The existing "owner updates own proposal" policy already covers any
-- column on the row (including this new one), so no new proposals
-- policy is needed.

-- ---------------------------------------------------------------------------
-- Decision makers: previously insert + delete only, no way to fix a typo
-- in place — the only option was deleting and re-adding, which fails
-- outright if the entry is already in use in any proposal's chain.
-- ---------------------------------------------------------------------------
drop policy if exists "admin updates decision makers" on public.decision_makers;
create policy "admin updates decision makers" on public.decision_makers for update
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin));

-- ---------------------------------------------------------------------------
-- Tags: previously only reachable via the suggestion-approval queue
-- (which creates NEW tags) — no policy existed to edit or remove an
-- already-real tag from the shared registry at all.
-- ---------------------------------------------------------------------------
drop policy if exists "admin updates tags" on public.tags;
create policy "admin updates tags" on public.tags for update
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin));

drop policy if exists "admin deletes tags" on public.tags;
create policy "admin deletes tags" on public.tags for delete
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin));

-- ---------------------------------------------------------------------------
-- Categories: the 7 founding budget categories had no write policy of
-- any kind — label/color/description/sort_order/requires_budget were
-- only ever editable by hand in the database. Edit-in-place only (no
-- insert/delete policy) since this is meant to stay a small, deliberate
-- fixed set, not something that grows on its own like tags or
-- decision_makers.
-- ---------------------------------------------------------------------------
drop policy if exists "admin updates categories" on public.categories;
create policy "admin updates categories" on public.categories for update
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin));
