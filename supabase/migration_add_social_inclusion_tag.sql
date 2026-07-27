-- Adds the "Social Inclusion" tag. Safe to re-run.

insert into public.tags (slug, label) values
  ('social_inclusion', 'Social Inclusion')
on conflict (slug) do nothing;
