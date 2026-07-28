-- Recolors two categories for better contrast/accessibility. Data, not
-- schema — plain updates, run once in the Supabase SQL editor.
update public.categories
set color = '#FF74A5'
where slug = 'infrastructure_sanitation';

update public.categories
set color = '#FF881A'
where slug = 'education_subsidies';
