-- v10 migration: optional self-reported demographic fields on profiles.
-- Purpose: let us (and eventually the public) see whether who's actually
-- showing up to propose/comment/vote roughly matches Philadelphia's real
-- population and council-district makeup — not for anything else. Every
-- field here is optional and defaults to "prefer not to say."
-- Safe to re-run.

alter table public.profiles add column if not exists age_range text;
alter table public.profiles add column if not exists race_ethnicity text;
alter table public.profiles add column if not exists gender text;
