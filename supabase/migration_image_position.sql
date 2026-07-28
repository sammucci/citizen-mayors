-- Adds a draggable focal point for proposal cover images, so an
-- object-cover crop doesn't cut off the important part of the photo.
-- Stored as a 0-100 percentage pair and fed into CSS object-position.
alter table public.proposals
  add column if not exists image_position_x smallint not null default 50
    check (image_position_x between 0 and 100),
  add column if not exists image_position_y smallint not null default 50
    check (image_position_y between 0 and 100);
