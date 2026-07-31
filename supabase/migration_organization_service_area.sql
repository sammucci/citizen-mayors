-- Replaces organization_profiles' free-text area_represented with a
-- structured service area (citywide / council district / zip), same
-- shape proposals already use. Run this script. Safe to run more than
-- once.
alter table public.organization_profiles
  add column if not exists geography_scope text not null default 'citywide';
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'organization_profiles_geography_scope_check'
  ) then
    alter table public.organization_profiles
      add constraint organization_profiles_geography_scope_check
      check (geography_scope in ('citywide', 'council_district', 'zip'));
  end if;
end $$;
alter table public.organization_profiles
  add column if not exists council_district int;
alter table public.organization_profiles
  add column if not exists geography_label text;
alter table public.organization_profiles
  drop column if exists area_represented;
