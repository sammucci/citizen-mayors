import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CategoryRow } from "@/components/category-row";

export const dynamic = "force-dynamic";

// The 7 founding budget categories previously had no admin screen at
// all — label, color, description, the budget-line flag, and sort order
// were only ever editable by hand in Supabase's table editor. Edit-only
// (no add/delete): this is meant to stay a small, deliberate fixed set,
// same reasoning as volunteer_category_groups.
export default async function CategoriesAdminPage() {
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
    .from("categories")
    .select("id, label, description, color, requires_budget, sort_order")
    .order("sort_order");

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/admin" className="text-xs text-neutral-500 underline hover:text-neutral-700">
        ← Back to admin dashboard
      </Link>
      <h1 className="mt-2 text-xl font-bold">Categories</h1>
      <p className="mt-1 text-sm text-neutral-500">
        The 7 founding budget categories every proposal picks from. Fixed set
        by design — no adding or removing here, just fixing a label, color,
        description, budget flag, or sort position.
      </p>

      <ul className="mt-6 space-y-2">
        {categories?.map((c: any) => (
          <CategoryRow
            key={c.id}
            id={c.id}
            label={c.label}
            description={c.description}
            color={c.color ?? "#a3a3a3"}
            requiresBudget={c.requires_budget}
            sortOrder={c.sort_order}
          />
        ))}
        {(!categories || categories.length === 0) && (
          <p className="text-sm text-neutral-500">No categories loaded.</p>
        )}
      </ul>
    </div>
  );
}
