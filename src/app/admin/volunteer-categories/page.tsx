import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AddVolunteerCategoryForm } from "@/components/add-volunteer-category-form";
import { AddVolunteerCategoryGroupForm } from "@/components/add-volunteer-category-group-form";
import { VolunteerCategoryRow } from "@/components/volunteer-category-row";
import { VolunteerCategoryGroupRow } from "@/components/volunteer-category-group-row";

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

  const [{ data: categories }, { data: groups }] = await Promise.all([
    supabase.from("volunteer_categories").select("id, label, group_id").order("label"),
    supabase.from("volunteer_category_groups").select("id, label").order("label"),
  ]);

  const groupOptions = (groups ?? []).map((g: any) => ({ id: String(g.id), label: g.label }));
  const tagCountByGroup = new Map<string, number>();
  for (const c of categories ?? []) {
    if (c.group_id == null) continue;
    const key = String(c.group_id);
    tagCountByGroup.set(key, (tagCountByGroup.get(key) ?? 0) + 1);
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-xl font-bold">Volunteer categories</h1>
      <p className="mt-1 text-sm text-neutral-500">
        The shared list people pick from when logging volunteer hours — grows automatically as
        people type new ones, same as decision-makers.
      </p>

      <div className="mt-8">
        <h2 className="text-base font-semibold">Groups</h2>
        <p className="mt-1 text-sm text-neutral-500">
          A small, curated list you manage yourself (Environmental, Animals, ...) — unlike tags
          below, this never grows on its own. The community dashboard's "hours by category" rolls
          up to these groups.
        </p>
        <div className="mt-3">
          <AddVolunteerCategoryGroupForm />
        </div>
        <ul className="mt-3 space-y-2">
          {groupOptions.map((g) => (
            <VolunteerCategoryGroupRow
              key={g.id}
              id={g.id}
              label={g.label}
              tagCount={tagCountByGroup.get(g.id) ?? 0}
            />
          ))}
          {groupOptions.length === 0 && <p className="text-sm text-neutral-500">No groups yet.</p>}
        </ul>
      </div>

      <div className="mt-8">
        <h2 className="text-base font-semibold">Tags</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Renaming or deleting a tag updates every past log entry that used it, so a correction
          (fixing capitalization, a typo) shows up everywhere that tag is displayed — someone's
          own log, their report card, and the dashboard. A brand-new tag starts ungrouped; assign
          it to a group with the dropdown below its name whenever you get to it.
        </p>
        <div className="mt-3">
          <AddVolunteerCategoryForm />
        </div>
        <ul className="mt-6 space-y-2">
          {categories?.map((c: any) => (
            <VolunteerCategoryRow
              key={c.id}
              id={String(c.id)}
              label={c.label}
              groupId={c.group_id != null ? String(c.group_id) : null}
              groups={groupOptions}
            />
          ))}
          {(!categories || categories.length === 0) && (
            <p className="text-sm text-neutral-500">No categories yet.</p>
          )}
        </ul>
      </div>
    </div>
  );
}
