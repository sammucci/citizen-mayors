-- Adds two new tags. Safe to re-run.

insert into public.tags (slug, label) values
  ('better_governance', 'Better Governance'),
  ('health_wellness', 'Health & Wellness')
on conflict (slug) do nothing;
