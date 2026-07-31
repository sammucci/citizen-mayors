import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AddDecisionMakerForm } from "@/components/add-decision-maker-form";
import { DecisionMakerRow } from "@/components/decision-maker-row";

export const dynamic = "force-dynamic";

// Same admin gate as /admin/tag-suggestions — profiles.is_admin, checked
// here for the page render and again inside deleteDecisionMaker itself.
// Built after a lowercase "quetcy lozada" ended up duplicating the real
// "Quetcy Lozada" entry in the shared registry: anyone signed in can add
// to this list, so cleanup needs a place to live too.
export default async function DecisionMakersAdminPage() {
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

  const { data: decisionMakers } = await supabase
    .from("decision_makers")
    .select("id, name, kind, created_at, added_by, profiles:added_by ( display_name )")
    .order("name");

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/admin" className="text-xs text-neutral-500 underline hover:text-neutral-700">
        ← Back to admin dashboard
      </Link>
      <h1 className="mt-2 text-xl font-bold">Decision makers</h1>
      <p className="mt-1 text-sm text-neutral-500">
        The shared registry anyone can add to when building a proposal's
        decision chain. Click a name to rename it (or fix its kind) in place —
        deleting removes it from the registry for everyone and fails safely if
        it's still in use somewhere.
      </p>

      <div className="mt-4">
        <AddDecisionMakerForm />
      </div>

      <ul className="mt-6 space-y-2">
        {decisionMakers?.map((dm: any) => (
          <div key={dm.id}>
            <DecisionMakerRow
              id={dm.id}
              name={dm.name}
              kind={dm.kind}
              addedByName={dm.profiles?.display_name ?? null}
              addedById={dm.added_by}
            />
            {dm.kind === "elected_official" && (
              <Link
                href={`/decision-makers/${dm.id}`}
                className="ml-1 mt-0.5 inline-block text-xs text-duty-purple underline"
              >
                View / edit public profile →
              </Link>
            )}
          </div>
        ))}
        {(!decisionMakers || decisionMakers.length === 0) && (
          <p className="text-sm text-neutral-500">Nothing in the registry yet.</p>
        )}
      </ul>
    </div>
  );
}
