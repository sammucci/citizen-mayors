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
          <Link href="/admin/tags" className="text-sm font-semibold underline">
            Tags
          </Link>
          <p className="mt-0.5 text-xs text-neutral-500">
            Pending suggestions, project tags, and volunteer-hours categories
            &amp; groups — everything crowdsourced, in one place.
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
        <li className="rounded-lg border border-neutral-200 bg-white p-4">
          <Link href="/admin/members" className="text-sm font-semibold underline">
            Members
          </Link>
          <p className="mt-0.5 text-xs text-neutral-500">
            Everyone who's registered on the platform.
          </p>
        </li>
        <li className="rounded-lg border border-neutral-200 bg-white p-4">
          <Link href="/admin/categories" className="text-sm font-semibold underline">
            Categories
          </Link>
          <p className="mt-0.5 text-xs text-neutral-500">
            The 7 founding budget categories every proposal picks from.
          </p>
        </li>
        <li className="rounded-lg border border-neutral-200 bg-white p-4">
          <Link href="/admin/grants" className="text-sm font-semibold underline">
            Grants
          </Link>
          <p className="mt-0.5 text-xs text-neutral-500">
            Clean up typos, dead links, and duplicates in the shared grants registry.
          </p>
        </li>
        <li className="rounded-lg border border-neutral-200 bg-white p-4">
          <Link href="/admin/organizations" className="text-sm font-semibold underline">
            Organizations
          </Link>
          <p className="mt-0.5 text-xs text-neutral-500">
            Clean up typos and duplicates in the shared civic-organization registry.
          </p>
        </li>
        <li className="rounded-lg border border-neutral-200 bg-white p-4">
          <Link href="/admin/feedback" className="text-sm font-semibold underline">
            Feedback
          </Link>
          <p className="mt-0.5 text-xs text-neutral-500">
            Reports from the "Report an issue" button — anyone can send one, signed in or not.
          </p>
        </li>
      </ul>
    </div>
  );
}
