-- Recolors the "Culture and Leisure" category from the original seed
-- green (#87D183) to #6BAB68. This is data, not schema, so it's a plain
-- update rather than an ALTER TABLE — run once in the Supabase SQL editor.
update public.categories
set color = '#6BAB68'
where slug = 'culture_leisure';
