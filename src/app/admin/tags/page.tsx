import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { TagRow } from "@/components/tag-row";
import { AddVolunteerCategoryForm } from "@/components/add-volunteer-category-form";
import { AddVolunteerCategoryGroupForm } from "@/components/add-volunteer-category-group-form";
import { VolunteerCategoryRow } from "@/components/volunteer-category-row";
import { VolunteerCategoryGroupRow } from "@/components/volunteer-category-group-row";
import {
  approveTagSuggestion,
  rejectTagSuggestion,
  resolveOrphanedVolunteerCategory,
} from "@/app/admin/actions";

export const dynamic = "force-dynamic";

// One master "Tags" screen — every crowdsourced/admin-curated tag list
// on the site, in one place instead of three separate pages people had
// to click between: pending proposal-tag suggestions, the real project
// tags registry, and volunteer-hours categories (groups + tags). Kept as
// clearly separated sections rather than one flat list, since these are
// different tables serving different parts of the app (proposals vs.
// civic logs) that just happen to share the same "grows as people type,
// admin cleans it up" shape. Same admin gate as every other admin
// screen.
export default async function TagsAdminPage() {
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

  const [
    { data: tags },
    { data: suggestions },
    { data: volunteerCategories },
    { data: volunteerGroups },
    { data: logCategoryRows },
  ] = await Promise.all([
    supabase.from("tags").select("id, label, proposal_tags ( proposal_id )").order("label"),
    supabase
      .from("tag_suggestions")
      .select(
        "id, label, status, created_at, proposal_id, suggested_by, proposals ( title ), profiles:suggested_by ( display_name )"
      )
      .eq("status", "pending")
      .order("created_at", { ascending: true }),
    supabase.from("volunteer_categories").select("id, label, group_id").order("label"),
    supabase.from("volunteer_category_groups").select("id, label").order("label"),
    supabase.from("civic_logs").select("category").not("category", "is", null),
  ]);

  const groupOptions = (volunteerGroups ?? []).map((g: any) => ({ id: String(g.id), label: g.label }));

  const tagsByGroup = new Map<string, any[]>();
  const ungroupedTags: any[] = [];
  for (const c of volunteerCategories ?? []) {
    if (c.group_id == null) {
      ungroupedTags.push(c);
      continue;
    }
    const key = String(c.group_id);
    if (!tagsByGroup.has(key)) tagsByGroup.set(key, []);
    tagsByGroup.get(key)!.push(c);
  }

  // Same "used in logs, but no longer a tag" recovery list as before —
  // see resolveOrphanedVolunteerCategory for the merge-vs-recreate logic.
  const knownLabels = new Set((volunteerCategories ?? []).map((c: any) => c.label));
  const labelsByLowercase = new Map(
    (volunteerCategories ?? []).map((c: any) => [c.label.toLowerCase(), c.label as string])
  );
  const orphanedLabels = [
    ...new Set(
      (logCategoryRows ?? [])
        .map((r: any) => r.category as string)
        .filter((label) => label && !knownLabels.has(label))
    ),
  ]
    .sort()
    .map((label) => ({ label, mergeInto: labelsByLowercase.get(label.toLowerCase()) ?? null }));

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/admin" className="text-xs text-neutral-500 underline hover:text-neutral-700">
        ← Back to admin dashboard
      </Link>
      <h1 className="mt-2 text-xl font-bold">Tags</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Every crowdsourced tag list on the site, in one place.
      </p>

      {/* ------------------------------------------------------------ */}
      <div className="mt-6">
        <h2 className="text-sm font-semibold text-neutral-700">
          Pending tag suggestions ({suggestions?.length ?? 0})
        </h2>
        <p className="mt-0.5 text-xs text-neutral-500">
          Approving creates the tag for real and attaches it to the proposal it
          was suggested on. Rejecting just dismisses it.
        </p>
        <ul className="mt-3 space-y-3">
          {suggestions?.map((s: any) => (
            <li
              key={s.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-neutral-200 bg-white p-4"
            >
              <div>
                <span className="text-base font-semibold">{s.label}</span>
                <p className="mt-0.5 text-xs text-neutral-500">
                  Suggested by{" "}
                  <Link href={`/u/${s.suggested_by}`} className="underline">
                    {s.profiles?.display_name ?? "a resident"}
                  </Link>{" "}
                  on{" "}
                  <Link href={`/proposals/${s.proposal_id}`} className="underline">
                    {s.proposals?.title ?? "a proposal"}
                  </Link>
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <form action={approveTagSuggestion}>
                  <input type="hidden" name="suggestion_id" value={s.id} />
                  <input type="hidden" name="proposal_id" value={s.proposal_id} />
                  <input type="hidden" name="label" value={s.label} />
                  <button className="rounded-full bg-green-600 px-3 py-1 text-xs font-medium text-white hover:bg-green-700">
                    Approve
                  </button>
                </form>
                <form action={rejectTagSuggestion}>
                  <input type="hidden" name="suggestion_id" value={s.id} />
                  <input type="hidden" name="proposal_id" value={s.proposal_id} />
                  <button className="rounded-full border border-neutral-300 px-3 py-1 text-xs text-neutral-600 hover:border-duty-red hover:text-duty-red">
                    Reject
                  </button>
                </form>
              </div>
            </li>
          ))}
          {(!suggestions || suggestions.length === 0) && (
            <p className="text-sm text-neutral-500">Nothing pending right now.</p>
          )}
        </ul>
      </div>

      {/* ------------------------------------------------------------ */}
      <div className="mt-8 border-t border-neutral-200 pt-6">
        <h2 className="text-sm font-semibold text-neutral-700">
          Project tags ({tags?.length ?? 0})
        </h2>
        <p className="mt-0.5 text-xs text-neutral-500">
          Click one to rename it — deleting removes it from every proposal it's
          attached to (there's no undo).
        </p>
        <ul className="mt-3 space-y-2">
          {tags?.map((t: any) => (
            <TagRow key={t.id} id={String(t.id)} label={t.label} usageCount={t.proposal_tags?.length ?? 0} />
          ))}
          {(!tags || tags.length === 0) && (
            <p className="text-sm text-neutral-500">No tags yet.</p>
          )}
        </ul>
      </div>

      {/* ------------------------------------------------------------ */}
      <div className="mt-8 border-t border-neutral-200 pt-6">
        <h2 className="text-sm font-semibold text-neutral-700">Volunteer categories</h2>
        <p className="mt-0.5 text-xs text-neutral-500">
          Groups (Environmental, Animals, ...) are a small, curated list you manage
          yourself and never grow on their own — the community dashboard's "hours
          by category" rolls up to these. Tags underneath each one grow
          automatically as people type new ones while logging hours, same as
          project tags above. Renaming or deleting a tag updates every past log
          entry that used it.
        </p>

        <div className="mt-4">
          <AddVolunteerCategoryGroupForm />
        </div>
        <div className="mt-3">
          <AddVolunteerCategoryForm />
        </div>

        <ul className="mt-6 space-y-3">
          {groupOptions.map((g) => {
            const groupTags = tagsByGroup.get(g.id) ?? [];
            return (
              <li key={g.id}>
                <VolunteerCategoryGroupRow id={g.id} label={g.label} tagCount={groupTags.length} />
                <details className="ml-3 mt-1 rounded-lg border border-neutral-100 bg-neutral-50/50">
                  <summary className="cursor-pointer list-none px-3 py-2 text-xs text-neutral-500 marker:content-none">
                    {groupTags.length} tag{groupTags.length === 1 ? "" : "s"} — click to{" "}
                    {groupTags.length > 0 ? "show" : "expand"}
                  </summary>
                  <ul className="space-y-2 p-3 pt-0">
                    {groupTags.map((c: any) => (
                      <VolunteerCategoryRow
                        key={c.id}
                        id={String(c.id)}
                        label={c.label}
                        groupId={c.group_id != null ? String(c.group_id) : null}
                        groups={groupOptions}
                      />
                    ))}
                    {groupTags.length === 0 && (
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
                  These show up as "Ungrouped" hours on the community dashboard
                  because someone logged hours under them before the tag was
                  deleted. Some are just a capitalization or wording variant of a
                  tag that already exists — those merge into the existing tag
                  instead of creating a second one. Anything else gets recreated
                  fresh, so you can then assign it to a group above.
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
    </div>
  );
}
