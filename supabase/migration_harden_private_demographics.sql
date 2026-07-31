-- Hardens the private demographic fields (age_range, race_ethnicity, gender,
-- housing_status, political_affiliation) from "private by app-code
-- discipline" to "private by database rule."
--
-- The gap this closes: Postgres RLS is row-level, not column-level. The
-- "public read profiles" policy (using (true)) has to stay broad, because
-- dozens of existing queries across this app embed `profiles ( display_name )`
-- to show comment/proposal authors — rewriting every one of those to go
-- through a restricted view is a much bigger, riskier change than the
-- actual problem calls for. But that same broad row-level policy means
-- nothing at the database level stops some FUTURE query from doing
-- `select("*")` on profiles and accidentally shipping someone's political
-- affiliation to a public page. Until now, the only thing preventing that
-- was every query author remembering not to.
--
-- Fix: revoke SELECT on just these five columns from both API roles
-- (anon = logged out, authenticated = logged in as anyone) at the
-- database level. That makes it structurally impossible for ANY query —
-- present or future, careful or careless — to read these columns
-- directly off the table, regardless of RLS. The two legitimate uses
-- that need them are routed through narrow, purpose-built functions
-- instead:
--   - get_my_demographics(): a signed-in user reading their OWN five
--     answers back, to pre-fill their own edit form. Enforced by
--     `where id = auth.uid()` inside the function itself, not by the
--     caller's query.
--   - demographic_breakdown(field, filter_district): the community
--     dashboard's aggregate percentages. Does the group-by/count INSIDE
--     Postgres and returns only {value, count} pairs — never a raw
--     per-person row, so there's no row-shaped data to leak even in
--     principle.
-- Safe to re-run.

revoke select (age_range, race_ethnicity, gender, housing_status, political_affiliation)
  on public.profiles from anon, authenticated;

create or replace function public.get_my_demographics()
returns table (
  age_range text,
  race_ethnicity text,
  gender text,
  housing_status text,
  political_affiliation text
)
language sql
security definer
set search_path = public
stable
as $$
  select age_range, race_ethnicity, gender, housing_status, political_affiliation
  from public.profiles
  where id = auth.uid();
$$;

revoke all on function public.get_my_demographics() from public;
grant execute on function public.get_my_demographics() to authenticated;

-- field is one of the five column names above, validated against an
-- allowlist before being used in dynamic SQL (never taken as raw,
-- unvalidated input) — filter_district is optional, matching the
-- community dashboard's district-filter toggle. Callable by anon too:
-- the dashboard itself is publicly viewable, and an aggregate count by
-- itself was always meant to be the public-facing output here.
create or replace function public.demographic_breakdown(field text, filter_district int default null)
returns table (value text, count bigint)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if field not in ('age_range', 'race_ethnicity', 'gender', 'housing_status', 'political_affiliation') then
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
