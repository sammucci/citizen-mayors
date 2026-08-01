-- Renames the "Benefits and Pensions" category to "Public Employment &
-- Benefits" — Samantha's call: more proposals are likely to be about
-- creating/funding public jobs (salaries) than about pension/benefit
-- policy specifically, so the name should invite both instead of reading
-- like it's only about retirement and health benefits. Slug stays
-- 'benefits_pensions' on purpose — nothing else in the app references
-- categories by label, only by slug/id, so this is purely a display-name
-- change with no other code to touch.
update public.categories
set
  label = 'Public Employment & Benefits',
  description = 'City jobs and salaries, plus employee retirement and health care benefits.'
where slug = 'benefits_pensions';
