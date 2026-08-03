-- Reverts three category colors back to the original palette you
-- uploaded (citizen-mayor-categories.png) — Infrastructure and
-- Sanitation, Culture and Leisure, and Education and Subsidies had each
-- been recolored once already (migration_infra_sanitation_color.sql and
-- migration_culture_leisure_color.sql), for "better contrast," but that
-- recolor is what made pink/orange/red hard to tell apart. This restores
-- the original hex values from before those two migrations ran. Data,
-- not schema — plain updates, safe to re-run.
update public.categories set color = '#FFAFCB' where slug = 'infrastructure_sanitation';
update public.categories set color = '#87D183' where slug = 'culture_leisure';
update public.categories set color = '#FFA550' where slug = 'education_subsidies';
