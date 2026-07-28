import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Simple hub now that there's more than one admin screen — links out to
// each rather than making the "Admin" nav link a guess about which one
// you wanted.
export default async function AdminHomePage() {
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

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-xl font-bold">Admin</h1>
      <ul className="mt-6 space-y-2">
        <li className="rounded-lg border border-neutral-200 bg-white p-4">
          <Link href="/admin/tag-suggestions" className="text-sm font-semibold underline">
            Tag suggestions
          </Link>
          <p className="mt-0.5 text-xs text-neutral-500">
            Review and approve or reject tags people have suggested.
          </p>
        </li>
        <li className="rounded-lg border border-neutral-200 bg-white p-4">
          <Link href="/admin/decision-makers" className="text-sm font-semibold underline">
            Decision makers
          </Link>
          <p className="mt-0.5 text-xs text-neutral-500">
            Clean up typos and duplicates in the shared decision-maker registry.
          </p>
        </li>
      </ul>
    </div>
  );
}
