-- Lets a comment's own author update it (separate from the proposal
-- owner's existing ability to resolve a suggested edit's status). The app
-- only allows editing your own comment while it's still the most recent
-- one on the proposal — that rule lives in the app code, this just makes
-- the update possible at the database level. Safe to re-run.

drop policy if exists "author edits own comment" on public.comments;

create policy "author edits own comment" on public.comments for update
  using (auth.uid() = author_id);
