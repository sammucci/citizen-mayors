import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { OrganizationProfileEditor } from "@/components/organization-profile-editor";

export const dynamic = "force-dynamic";

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

// Public profile page — no login needed to view, same "public read"
// model as decision-maker profiles. "Serves # Citizen Mayors" counts
// rows in profile_organizations, never lists WHO — same aggregate-only,
// no-public-roster stance as the demographic-privacy work.
export default async function OrganizationProfilePage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: organization } = await supabase
    .from("organizations")
    .select("id, name")
    .eq("id", params.id)
    .maybeSingle();

  if (!organization) {
    return (
      <div className="mx-auto max-w-2xl">
        <p className="text-sm text-neutral-600">
          Couldn&apos;t find that organization.{" "}
          <Link href="/organizations" className="underline">
            View all organizations
          </Link>
        </p>
      </div>
    );
  }

  const [{ data: profile }, { count: servesCount }, { data: revisions }] = await Promise.all([
    supabase.from("organization_profiles").select("*").eq("organization_id", organization.id).maybeSingle(),
    supabase
      .from("profile_organizations")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organization.id),
    supabase
      .from("organization_revisions")
      .select("id, field_name, edited_at, profiles:edited_by ( display_name )")
      .eq("organization_id", organization.id)
      .order("edited_at", { ascending: false })
      .limit(30),
  ]);

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/organizations" className="text-xs text-neutral-500 underline hover:text-neutral-700">
        ← All organizations
      </Link>

      <div className="mt-2 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{organization.name}</h1>
          <p className="text-xs uppercase tracking-wide text-neutral-400">Civic organization</p>
        </div>
        <div className="shrink-0 rounded-lg bg-duty-purple/10 px-3 py-2 text-right">
          <p className="text-lg font-bold text-duty-purple">{servesCount ?? 0}</p>
          <p className="text-[11px] text-neutral-500">
            Serves {servesCount ?? 0} Citizen Mayor{servesCount === 1 ? "" : "s"}
          </p>
        </div>
      </div>

      {!user && (
        <p className="mt-3 text-xs text-neutral-500">
          <Link href="/login" className="underline">
            Sign in
          </Link>{" "}
          to help fill in or fix anything on this page, or to attach this group to your own
          profile.
        </p>
      )}

      <div className="mt-4">
        <OrganizationProfileEditor
          organizationId={organization.id}
          canEdit={Boolean(user)}
          profile={{
            geography_scope: profile?.geography_scope ?? "citywide",
            council_district: profile?.council_district ?? null,
            geography_label: profile?.geography_label ?? null,
            topics: profile?.topics ?? [],
            meets_when: profile?.meets_when ?? null,
            meets_where: profile?.meets_where ?? null,
            description: profile?.description ?? "",
          }}
        />
      </div>

      <details className="mt-6">
        <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-neutral-500">
          History ({(revisions ?? []).length})
        </summary>
        <ul className="mt-1.5 space-y-1 text-xs text-neutral-500">
          {(revisions ?? []).map((r: any) => (
            <li key={r.id}>
              <span className="font-medium text-neutral-700">{r.profiles?.display_name ?? "A resident"}</span>{" "}
              changed <span className="font-mono text-[11px]">{r.field_name}</span> · {formatDateTime(r.edited_at)}
            </li>
          ))}
          {(!revisions || revisions.length === 0) && <li className="text-neutral-400">No edits yet.</li>}
        </ul>
      </details>
    </div>
  );
}
