-- v62: non-owners can suggest tags with real teeth now, gated by a
-- two-step review that depends on whether the tag already exists.
-- Existing tag -> only the proposal owner needs to sign off (nothing
-- new is created). Brand-new tag -> the owner has to say yes first
-- (owner_approved), THEN an admin finalizes it (creates the real tags
-- row and attaches it) — an admin can never populate someone's proposal
-- on their own. Safe to re-run.

alter table public.tag_suggestions add column if not exists tag_id int references public.tags(id) on delete cascade;

alter table public.tag_suggestions drop constraint if exists tag_suggestions_status_check;
alter table public.tag_suggestions add constraint tag_suggestions_status_check
  check (status in ('pending', 'owner_approved', 'approved', 'rejected'));

drop policy if exists "owner responds to own proposal tag_suggestions" on public.tag_suggestions;
create policy "owner responds to own proposal tag_suggestions" on public.tag_suggestions for update
  using (exists (select 1 from public.proposals p where p.id = proposal_id and p.owner_id = auth.uid()))
  with check (
    status = 'rejected'
    or (status = 'approved' and tag_id is not null)
    or (status = 'owner_approved' and tag_id is null)
  );

-- New civic log type: "contacted an elected official" — kept separate
-- from letter_to_editor (public/media-facing, builds outside pressure)
-- rather than merged into it (direct, private contact with an office).
-- contact_method captures how (phone/email/letter/in-person); the
-- existing "organization" text column is reused to record who/which
-- office was contacted, same as it already does for community_meeting.
alter table public.civic_logs drop constraint if exists civic_logs_log_type_check;
alter table public.civic_logs add constraint civic_logs_log_type_check
  check (log_type in ('letter_to_editor', 'community_meeting', 'volunteer_hours', 'testimony', 'contacted_official'));

alter table public.civic_logs add column if not exists contact_method text;
alter table public.civic_logs drop constraint if exists civic_logs_contact_method_check;
alter table public.civic_logs add constraint civic_logs_contact_method_check
  check (contact_method is null or contact_method in ('phone', 'email', 'letter', 'in_person'));
