import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { TagRow } from "@/components/tag-row";

export const dynamic = "force-dynamic";

// The full tags repository — previously the only admin screen touching
// tags was /admin/tag-suggestions, which only handles the pending-
// suggestion queue (approve creates a NEW tag; reject just dismisses the
// request). There was no way to rename or remove an already-real tag at
// all. Same admin gate as every other admin screen.
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

  const [{ data: tags }, { count: pendingCount }] = await Promise.all([
    supabase.from("tags").select("id, label, proposal_tags ( proposal_id )").order("label"),
    supabase.from("tag_suggestions").select("id", { count: "exact", head: true }).eq("status", "pending"),
  ]);

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-xl font-bold">Tags</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Every tag in the shared registry. Click one to rename it — deleting
        removes it from every proposal it's attached to (there's no
        undo).{" "}
        <Link href="/admin/tag-suggestions" className="underline">
          Review pending suggestions
          {typeof pendingCount === "number" && pendingCount > 0 ? ` (${pendingCount})` : ""}
        </Link>{" "}
        to add new ones instead.
      </p>

      <ul className="mt-6 space-y-2">
        {tags?.map((t: any) => (
          <TagRow key={t.id} id={String(t.id)} label={t.label} usageCount={t.proposal_tags?.length ?? 0} />
        ))}
        {(!tags || tags.length === 0) && (
          <p className="text-sm text-neutral-500">No tags yet.</p>
        )}
      </ul>
    </div>
  );
}
