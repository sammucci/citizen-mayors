import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AddGrantForm } from "@/components/add-grant-form";
import { GrantRow } from "@/components/grant-row";

export const dynamic = "force-dynamic";

// Same admin-gate + registry-cleanup shape as /admin/decision-makers —
// anyone signed in can add a grant while attaching one to a proposal
// (see grant-field.tsx), so cleanup (typos, dead links, duplicates)
// needs a home too.
export default async function GrantsAdminPage() {
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

  const { data: grants } = await supabase
    .from("grants")
    .select("id, name, funder, url, description, added_by, profiles:added_by ( display_name )")
    .order("name");

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/admin" className="text-xs text-neutral-500 underline hover:text-neutral-700">
        ← Back to admin dashboard
      </Link>
      <h1 className="mt-2 text-xl font-bold">Grants</h1>
      <p className="mt-1 text-sm text-neutral-500">
        A shared reference list of funding sources — worth checking when writing up a
        "secure funding" phase on a proposal. Click an entry to fix its name, funder, link,
        or description; deleting removes it from the registry for everyone.
      </p>

      <div className="mt-4">
        <AddGrantForm />
      </div>

      <ul className="mt-6 space-y-2">
        {grants?.map((g: any) => (
          <GrantRow
            key={g.id}
            id={g.id}
            name={g.name}
            funder={g.funder}
            url={g.url}
            description={g.description}
            addedByName={g.profiles?.display_name ?? null}
            addedById={g.added_by}
          />
        ))}
        {(!grants || grants.length === 0) && (
          <p className="text-sm text-neutral-500">Nothing in the registry yet.</p>
        )}
      </ul>
    </div>
  );
}
