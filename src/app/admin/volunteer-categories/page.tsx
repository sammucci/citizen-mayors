import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AddVolunteerCategoryForm } from "@/components/add-volunteer-category-form";
import { AddVolunteerCategoryGroupForm } from "@/components/add-volunteer-category-group-form";
import { VolunteerCategoryRow } from "@/components/volunteer-category-row";
import { VolunteerCategoryGroupRow } from "@/components/volunteer-category-group-row";
import { resolveOrphanedVolunteerCategory } from "@/app/admin/actions";

export const dynamic = "force-dynamic";

// Same admin gate as the other admin screens. Lets Samantha clean up or
// pre-seed the volunteer-hours category list instead of only reacting
// to whatever people happen to type in the "add a log" combobox.
export default async function VolunteerCategoriesAdminPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <p className="text-sm text-neutral-600">
        <Link href="/login" className="underline">
          Sign in
        </Link>{" "}
        to view this page.
      </p>
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) {
    return <p className="text-sm text-neutral-600">This page is admin-only.</p>;
  }

  const [{ data: categories }, { data: groups }, { data: logCategoryRows }] = await Promise.all([
    supabase.from("volunteer_categories").select("id, label, group_id").order("label"),
    supabase.from("volunteer_category_groups").select("id, label").order("label"),
    supabase.from("civic_logs").select("category").not("category", "is", null),
  ]);

  const groupOptions = (groups ?? []).map((g: any) => ({ id: String(g.id), label: g.label }));

  const tagsByGroup = new Map<string, any[]>();
  const ungroupedTags: any[] = [];
  for (const c of categories ?? []) {
    if (c.group_id == null) {
      ungroupedTags.push(c);
      continue;
    }
    const key = String(c.group_id);
    if (!tagsByGroup.has(key)) tagsByGroup.set(key, []);
    tagsByGroup.get(key)!.push(c);
  }

  // A category can end up used in civic_logs with no matching row here
  // at all — most commonly because a tag was deleted (deleteVolunteerCategory
  // never touches past logs, by design) after people had already logged
  // hours under it. Those hours still show up on the community dashboard,
  // bucketed into "Ungrouped" as a fallback, but there was previously no
  // way to find or fix them from this page since they don't have a tag
  // row to show. This surfaces them explicitly so they can be re-added
  // (and then assigned to a group) instead of silently sitting there.
  const knownLabels = new Set((categories ?? []).map((c: any) => c.label));
  const labelsByLowercase = new Map(
    (categories ?? []).map((c: any) => [c.label.toLowerCase(), c.label as string])
  );
  const orphanedLabels = [
    ...new Set(
      (logCategoryRows ?? [])
        .map((r: any) => r.category as string)
        .filter((label) => label && !knownLabels.has(label))
    ),
  ]
    .sort()
    // A near-duplicate that only differs by capitalization/spacing (e.g.
    // "Civic and Government" vs. "Civic & Government") already has a
    // real tag to merge into — surfaced separately so the button copy
    // can say "merge into X" instead of the more generic "add back",
    // and so it's clear this won't create a second, confusing tag.
    .map((label) => ({ label, mergeInto: labelsByLowercase.get(label.toLowerCase()) ?? null }));

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-xl font-bold">Volunteer categories</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Groups (Environmental, Animals, ...) are a small, curated list you manage yourself and
        never grow on their own — the community dashboard's "hours by category" rolls up to
        these. Tags underneath each one grow automatically as people type new ones while logging
        hours, same as decision-makers. Renaming or deleting a tag updates every past log entry
        that used it, so a correction shows up everywhere that tag is displayed.
      </p>

      <div className="mt-4">
        <AddVolunteerCategoryGroupForm />
      </div>
      <div className="mt-3">
        <AddVolunteerCategoryForm />
      </div>

      <ul className="mt-6 space-y-3">
        {groupOptions.map((g) => {
          const tags = tagsByGroup.get(g.id) ?? [];
          return (
            <li key={g.id}>
              <VolunteerCategoryGroupRow id={g.id} label={g.label} tagCount={tags.length} />
              <details className="ml-3 mt-1 rounded-lg border border-neutral-100 bg-neutral-50/50">
                <summary className="cursor-pointer list-none px-3 py-2 text-xs text-neutral-500 marker:content-none">
                  {tags.length} tag{tags.length === 1 ? "" : "s"} — click to {tags.length > 0 ? "show" : "expand"}
                </summary>
                <ul className="space-y-2 p-3 pt-0">
                  {tags.map((c: any) => (
                    <VolunteerCategoryRow
                      key={c.id}
                      id={String(c.id)}
                      label={c.label}
                      groupId={c.group_id != null ? String(c.group_id) : null}
                      groups={groupOptions}
                    />
                  ))}
                  {tags.length === 0 && (
                    <p className="text-xs text-neutral-400">No tags assigned to this group yet.</p>
                  )}
                </ul>
              </details>
            </li>
          );
        })}
        {groupOptions.length === 0 && <p className="text-sm text-neutral-500">No groups yet.</p>}
      </ul>

      <div className="mt-6">
        <details className="rounded-lg border border-neutral-200 bg-neutral-50/50">
          <summary className="cursor-pointer list-none px-3 py-2 text-sm font-semibold text-neutral-700 marker:content-none">
            Ungrouped ({ungroupedTags.length})
          </summary>
          <ul className="space-y-2 p-3 pt-0">
            {ungroupedTags.map((c: any) => (
              <VolunteerCategoryRow
                key={c.id}
                id={String(c.id)}
                label={c.label}
                groupId={null}
                groups={groupOptions}
              />
            ))}
            {ungroupedTags.length === 0 && (
              <p className="text-xs text-neutral-400">Nothing ungrouped — everything's sorted.</p>
            )}
          </ul>
        </details>
      </div>

      {orphanedLabels.length > 0 && (
        <div className="mt-3">
          <details className="rounded-lg border border-amber-200 bg-amber-50/50">
            <summary className="cursor-pointer list-none px-3 py-2 text-sm font-semibold text-amber-800 marker:content-none">
              Used in logs, but no longer a tag ({orphanedLabels.length})
            </summary>
            <div className="space-y-2 p-3 pt-0">
              <p className="text-xs text-amber-700">
                These show up as "Ungrouped" hours on the community dashboard because someone
                logged hours under them before the tag was deleted — deleting a tag never touches
                past logs, so the text stuck around even though the tag didn't. Some are just a
                capitalization or wording variant of a tag that already exists (often from typing a
                slightly different version into "Add a log" before the real tag existed, or a rename
                that landed as a near-duplicate instead of updating in place) — those merge into the
                existing tag instead of creating a second one. Anything else gets recreated fresh, so
                you can then assign it to a group above.
              </p>
              {orphanedLabels.map(({ label, mergeInto }) => (
                <form
                  key={label}
                  action={resolveOrphanedVolunteerCategory}
                  className="flex items-center justify-between gap-2 rounded-md bg-white px-2.5 py-1.5 text-sm"
                >
                  <input type="hidden" name="label" value={label} />
                  <span className="text-neutral-700">
                    {label}
                    {mergeInto && (
                      <span className="ml-1.5 text-[11px] text-neutral-400">
                        → matches existing tag "{mergeInto}"
                      </span>
                    )}
                  </span>
                  <button
                    type="submit"
                    className="shrink-0 rounded border border-amber-300 px-2 py-0.5 text-xs font-medium text-amber-800 hover:bg-amber-100"
                  >
                    {mergeInto ? `Merge into "${mergeInto}"` : "+ Add back as a tag"}
                  </button>
                </form>
              ))}
            </div>
          </details>
        </div>
      )}
    </div>
  );
}
