# citizen mayors v6 — full replace again

Same drill as v5, since it worked well: in your local "citizen mayors"
folder, select all (Cmd+A) and delete — this only touches visible files,
.git stays untouched automatically. Then unzip this and copy everything
from inside it into that now-empty folder. Commit, push.

## New SQL to run

Run `supabase/migration_003_v6.sql` in the Supabase SQL Editor. This adds
the category colors and fixes the vote-duplication bug at the database
level. Safe to run even if you're not sure what's already been run.

## What changed this round

- **Vote bug fixed.** Votes now toggle: click again to undo your vote,
  click the other one to switch. This was a real bug — the original
  database rule meant to stop duplicate votes had a blind spot for votes
  directly on proposals (as opposed to on comments), so those weren't
  actually being blocked.
- **Filters are now dropdowns** instead of a wall of buttons.
- **Version history** is viewable — a "Version history" section on each
  proposal shows every past version, its "what changed" note, and lets you
  expand to read that version's exact text.
- **Decision-maker reordering** via simple up/down buttons (owner only) —
  not drag-and-drop, since buttons are simpler to get right and work
  better on phones.
- **Category colors** are wired in — the 7 colors you picked now show as a
  bar across the top of each proposal card and each proposal's detail
  page. You can change any of them later in Table Editor without a
  redeploy.
- Upvote/downvote buttons are now visually distinct (highlighted) when
  they reflect your actual vote.
