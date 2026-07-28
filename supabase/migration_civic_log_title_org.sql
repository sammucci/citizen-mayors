-- Adds two optional fields to civic_logs:
--   title        — for letter_to_editor entries, the letter/article's title
--   organization — for community_meeting entries, who hosted it. Free text
--                  for now; per platform-future-iterations.pdf this is meant
--                  to eventually link to a real organization profile, but
--                  that's its own future feature — this is just the field
--                  to capture the name in the meantime.
--
-- Safe to re-run.

alter table public.civic_logs add column if not exists title text;
alter table public.civic_logs add column if not exists organization text;
