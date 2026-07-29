# Citizen Mayors v61

New migration this time: run `supabase/migration_v61.sql` in the SQL Editor (adds one table, one column, four admin RLS policies). `schema.sql` is also updated for a fresh install.

## Community dashboard — redesigned for hierarchy

The top of the community dashboard was one flat wall of 11 identical boxes — no distinction between "who's here" (members, zip codes, districts) and "what everyone's done" (proposals, comments, volunteer hours, etc.). Reworked into two tiers:

- Members/zip codes/districts moved into a small pill-shaped strip under the subtitle — quiet context, not competing for attention.
- The 8 civic-action stats now live under a "Civic actions, together" label, each with an emoji icon in a color-tinted chip, a bigger bold number, a colored top edge, and a slight lift on hover.
- Cleaned up two labels: "Meetings attended" → "Community meetings attended," "Volunteer hours" → "Hours volunteered."
- No new dependencies — icons are plain emoji, same trick the homepage's 🎉 button already used.

## Admin tags page — add tags directly, and compact layout

- **You can now add a project tag directly from `/admin/tags`**, instead of the only path in being someone suggesting it on a proposal first. Same duplicate-avoidance as the suggestion queue.
- **The project tags list is now a grid** (3-4 per row on wider screens) instead of one long stack of full-width bars, so the page doesn't turn into an endless scroll once there are more than a handful of tags.

## Tag topics (new)

Project tags can now be grouped into curated topics, e.g. "Pedestrian & Bike Safety" containing "bike lanes," "bike safety," "pedestrians." Same two-tier pattern as the existing volunteer category groups:

- New "Topics" box on `/admin/tags` to create/rename/delete topics. Each individual tag's own dropdown assigns it to a topic (or leaves it ungrouped) — deleting a topic un-assigns its tags rather than deleting them.
- New "Proposals by topic" section on the community dashboard, counting distinct *published* proposals per topic. A proposal with two tags in the same topic only counts once. Only topics you've actually created show up — individual ungrouped tags never appear here on their own, so hundreds of tags won't swamp the chart.
- Nothing shows on the dashboard until you start assigning tags to topics — it'll read empty until then, by design.

## Still open

- Decision-maker profiles — next up; you're compiling the info fields for these.
- Organization profiles, events calendar, enhanced map geocoding, translation — prioritized but not started.
