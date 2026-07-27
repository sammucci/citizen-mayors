# citizen mayors v5 — full replace, read this first

This is the ENTIRE project, complete — not a partial patch. Use this to
wipe out any accumulated mess (stray files, wrong-cased folders, etc.) and
start clean from a known-good state.

## Exactly what to do

1. Open your local "citizen mayors" project folder — the one GitHub
   Desktop tracks (the folder with the `.git` info inside it, even though
   you can't normally see that part).

2. Inside that folder, select and delete everything you see EXCEPT any
   file or folder whose name starts with a dot (like `.git`) — don't touch
   those, ever. Concretely: delete the `src` folder entirely, delete
   `package.json`, `README.md`, and everything else visible, including any
   loose files like `client.ts` or `server.ts` sitting at the top level,
   and any folder called `Supabase` (capital S) if you still see one.

3. Unzip this citizen-mayors-v5.zip. Copy everything that was inside it —
   `src`, `supabase`, `package.json`, all of it — directly into your now-
   empty "citizen mayors" folder, so it looks exactly like the folder
   structure in this zip.

4. In GitHub Desktop, you'll see a big list of changes (a lot of "deleted"
   and "added" entries — that's expected, since we're replacing
   everything). Write a commit message like "Clean full replace," Commit
   to main, Push origin.

5. No new SQL to run — your database already has everything it needs from
   before.

## If you're not sure a file is "hidden" or not

On a Mac, hidden files/folders (like `.git`) normally don't show up in
Finder at all unless you've turned on "show hidden files" — so if you
haven't done that, you likely won't even see `.git` to worry about
accidentally deleting it. Only worry about this if you know you've enabled
that setting.
