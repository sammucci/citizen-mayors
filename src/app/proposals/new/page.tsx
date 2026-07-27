import { createClient } from "@/lib/supabase/server";
import { NewProposalForm } from "@/components/new-proposal-form";

export default async function NewProposalPage() {
  const supabase = createClient();
  const [{ data: categories }, { data: tags }] = await Promise.all([
    supabase.from("categories").select("*").order("sort_order"),
    supabase.from("tags").select("*").order("label"),
  ]);

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-xl font-semibold">If I were mayor, I'd...</h1>
      <p className="mt-1 text-sm text-neutral-600">
        Write it like real ordinance or project language where you can —
        others will be able to comment, suggest edits, and support it.
      </p>

      {(!categories || categories.length === 0) && (
        <p className="mt-4 rounded-md bg-amber-50 p-3 text-sm text-amber-800">
          No categories are loaded yet, so this form won't be submittable.
          That usually means supabase/schema.sql hasn't been run yet in the
          Supabase SQL Editor (or didn't finish) — check the "categories"
          table in Supabase's Table Editor for rows.
        </p>
      )}

      <NewProposalForm categories={categories ?? []} tags={tags ?? []} />
    </div>
  );
}
