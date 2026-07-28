import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AddVolunteerCategoryForm } from "@/components/add-volunteer-category-form";
import { VolunteerCategoryRow } from "@/components/volunteer-category-row";

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

  const { data: categories } = await supabase
    .from("volunteer_categories")
    .select("id, label")
    .order("label");

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-xl font-bold">Volunteer categories</h1>
      <p className="mt-1 text-sm text-neutral-500">
        The shared list people pick from when logging volunteer hours — grows automatically as
        people type new ones, same as decision-makers. Renaming or deleting here never touches
        anyone's past log entries, only what shows up as a suggestion going forward.
      </p>

      <div className="mt-4">
        <AddVolunteerCategoryForm />
      </div>

      <ul className="mt-6 space-y-2">
        {categories?.map((c: any) => (
          <VolunteerCategoryRow key={c.id} id={String(c.id)} label={c.label} />
        ))}
        {(!categories || categories.length === 0) && (
          <p className="text-sm text-neutral-500">No categories yet.</p>
        )}
      </ul>
    </div>
  );
}
