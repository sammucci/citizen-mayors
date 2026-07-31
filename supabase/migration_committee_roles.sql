-- Adds a chair / vice-chair / member distinction to committee
-- assignments. Previously `committees` was a flat text[] of names; this
-- converts it to jsonb, an array of {"name": "...", "role": "..."}
-- objects, so a profile can say who actually chairs a committee (public
-- information, and useful) instead of just listing membership.
--
-- Safe to re-run: only touches the column if it's still the old text[]
-- shape, so running this twice (or against a fresh install that hasn't
-- hit this point yet) is a no-op the second time. Any committee names
-- already saved carry over as role "member" — nobody's chair status gets
-- silently invented, that has to be added by hand from here on.

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'decision_maker_profiles'
      and column_name = 'committees'
      and data_type = 'ARRAY'
  ) then
    alter table public.decision_maker_profiles add column committees_jsonb jsonb not null default '[]'::jsonb;

    update public.decision_maker_profiles
    set committees_jsonb = (
      select coalesce(jsonb_agg(jsonb_build_object('name', c, 'role', 'member')), '[]'::jsonb)
      from unnest(committees) as c
    );

    alter table public.decision_maker_profiles drop column committees;
    alter table public.decision_maker_profiles rename column committees_jsonb to committees;
  end if;
end $$;
