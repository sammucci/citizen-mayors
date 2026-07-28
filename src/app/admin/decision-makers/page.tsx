import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { DeleteDecisionMakerButton } from "@/components/delete-decision-maker-button";
import { splitDecisionMakerLabel } from "@/lib/decision-maker-label";

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
    .select("id, name, kind, created_at, profiles:added_by ( display_name )")
    .order("name");

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-xl font-bold">Decision makers</h1>
      <p className="mt-1 text-sm text-neutral-500">
        The shared registry anyone can add to when building a proposal's
        decision chain. Deleting here removes it from the registry for
        everyone — it fails safely if it's still in use somewhere.
      </p>

      <ul className="mt-6 space-y-2">
        {decisionMakers?.map((dm: any) => {
          const { primary, subtitle } = splitDecisionMakerLabel(dm.name);
          return (
            <li
              key={dm.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-neutral-200 bg-white p-3"
            >
              <div>
                <span className="text-sm font-semibold">{primary}</span>
                <p className="mt-0.5 text-xs text-neutral-500">
                  {subtitle ?? dm.kind.replace(/_/g, " ")}
                  {dm.profiles?.display_name && ` · added by ${dm.profiles.display_name}`}
                </p>
              </div>
              <DeleteDecisionMakerButton id={dm.id} name={dm.name} />
            </li>
          );
        })}
        {(!decisionMakers || decisionMakers.length === 0) && (
          <p className="text-sm text-neutral-500">Nothing in the registry yet.</p>
        )}
      </ul>
    </div>
  );
}
