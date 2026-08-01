import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AddOrganizationForm } from "@/components/add-organization-form";
import { OrganizationRow } from "@/components/organization-row";

export const dynamic = "force-dynamic";

// Same admin-gate + registry-cleanup shape as /admin/decision-makers and
// /admin/grants — anyone signed in can add an organization while
// attaching one to their own civic profile (see
// my-organizations-section.tsx), so cleanup lives here.
export default async function OrganizationsAdminPage() {
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

  const { data: organizations } = await supabase
    .from("organizations")
    .select("id, name, added_by, profiles:added_by ( display_name )")
    .order("name");

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/admin" className="text-xs text-neutral-500 underline hover:text-neutral-700">
        ← Back to admin dashboard
      </Link>
      <h1 className="mt-2 text-xl font-bold">Organizations</h1>
      <p className="mt-1 text-sm text-neutral-500">
        The shared registry of civic groups and neighborhood organizations residents can attach
        to their profile. Click a name to fix a typo or duplicate — deleting removes it for
        everyone and fails safely if any resident currently has it attached. Each organization's
        actual profile (service area, topics, description, meeting info) is wiki-edited on its
        own public page, not here.
      </p>

      <div className="mt-4">
        <AddOrganizationForm />
      </div>

      <ul className="mt-6 space-y-2">
        {organizations?.map((o: any) => (
          <OrganizationRow
            key={o.id}
            id={o.id}
            name={o.name}
            addedByName={o.profiles?.display_name ?? null}
            addedById={o.added_by}
          />
        ))}
        {(!organizations || organizations.length === 0) && (
          <p className="text-sm text-neutral-500">Nothing in the registry yet.</p>
        )}
      </ul>
    </div>
  );
}
