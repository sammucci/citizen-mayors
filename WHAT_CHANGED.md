# V3 — what changed

Just two files this round, both small:

- `src/app/layout.tsx` — the header now actually checks whether you're
  signed in. Signed out: shows "Sign in" like before. Signed in: shows
  "Signed in as [name]" and a real Sign out button. Previously it always
  showed "Sign in" regardless of your actual session — that's the bug you
  just ran into.
- `src/app/actions.ts` — new file, just holds the sign-out action the
  header button calls.

## Applying this

Copy these two files into the matching folders in your local project
(overwriting the existing `layout.tsx`, adding the new `actions.ts`), then
commit and push in GitHub Desktop as usual. No new SQL to run this time.
