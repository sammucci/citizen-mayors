import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Public index — mirrors /decision-makers. Grows as members attach
// neighborhood groups/civic orgs to their own profiles (see the "Your
// civic groups" section on /profile) rather than being pre-seeded.
export default async function OrganizationsIndexPage() {
  const supabase = createClient();
  const { data: organizations } = await supabase.from("organizations").select("id, name").order("name");

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-semibold">Organizations</h1>
      <p className="mt-1 text-sm text-neutral-600">
        Neighborhood groups and civic organizations, crowdsourced the same way as decision-maker
        profiles — click through to see (and add to) what&apos;s known about them.
      </p>

      <ul className="mt-5 space-y-1">
        {organizations?.map((org) => (
          <li key={org.id}>
            <Link href={`/organizations/${org.id}`} className="text-sm text-duty-purple underline">
              {org.name}
            </Link>
          </li>
        ))}
        {(!organizations || organizations.length === 0) && (
          <p className="text-sm text-neutral-500">
            Nothing here yet — add one from your{" "}
            <Link href="/profile" className="underline">
              profile page
            </Link>
            .
          </p>
        )}
      </ul>
    </div>
  );
}
