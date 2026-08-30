-- Adds educational attainment as a sixth optional, self-reported
-- demographic field on profiles — same privacy treatment as the
-- existing five (age_range, race_ethnicity, gender, housing_status,
-- political_affiliation): revoked from direct SELECT for both API
-- roles, only reachable through get_my_demographics() (the owner
-- reading their own answer back) or demographic_breakdown() (aggregate
-- counts only, for the community dashboard). See
-- migration_harden_private_demographics.sql for the full reasoning.
-- Safe to re-run.

alter table public.profiles add column if not exists educational_attainment text;

revoke select (educational_attainment) on public.profiles from anon, authenticated;

-- get_my_demographics()'s return shape is changing (a 6th column), and
-- Postgres won't let CREATE OR REPLACE change a function's OUT columns
-- — has to be dropped and recreated.
drop function if exists public.get_my_demographics();

create function public.get_my_demographics()
returns table (
  age_range text,
  race_ethnicity text,
  gender text,
  housing_status text,
  political_affiliation text,
  educational_attainment text
)
language sql
security definer
set search_path = public
stable
as $$
  select age_range, race_ethnicity, gender, housing_status, political_affiliation, educational_attainment
  from public.profiles
  where id = auth.uid();
$$;

revoke all on function public.get_my_demographics() from public;
grant execute on function public.get_my_demographics() to authenticated;

-- demographic_breakdown()'s signature/return shape is unchanged (still
-- just field text, filter_district int -> value/count pairs), so this
-- one's a plain CREATE OR REPLACE — just widening the allowlist.
create or replace function public.demographic_breakdown(field text, filter_district int default null)
returns table (value text, count bigint)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if field not in ('age_range', 'race_ethnicity', 'gender', 'housing_status', 'political_affiliation', 'educational_attainment') then
    raise exception 'demographic_breakdown: invalid field %', field;
  end if;
  return query execute format(
    'select %1$I as value, count(*) as count
     from public.profiles
     where %1$I is not null and %1$I <> '''' %2$s
     group by %1$I
     order by count(*) desc',
    field,
    case when filter_district is not null then format('and council_district = %L', filter_district) else '' end
  );
end;
$$;

revoke all on function public.demographic_breakdown(text, int) from public;
grant execute on function public.demographic_breakdown(text, int) to authenticated, anon;
