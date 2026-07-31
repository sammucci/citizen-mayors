import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const KIND_LABELS: Record<string, string> = {
  elected_official: "Elected official",
  department: "Department",
  board_commission: "Board / commission",
  other: "Other",
};

// Public index — anyone can browse the shared registry, same "public
// read" policy as the registry itself. Elected officials link through to
// their crowdsourced profile (office details, legislation, wiki text);
// every other kind just lists here for now, since the profile treatment
// is elected-officials-only in v1.
export default async function DecisionMakersIndexPage() {
  const supabase = createClient();
  const { data: decisionMakers } = await supabase
    .from("decision_makers")
    .select("id, name, kind")
    .order("name");

  const grouped = new Map<string, { id: string; name: string }[]>();
  for (const dm of decisionMakers ?? []) {
    const list = grouped.get(dm.kind) ?? [];
    list.push({ id: dm.id, name: dm.name });
    grouped.set(dm.kind, list);
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-semibold">Decision-makers</h1>
      <p className="mt-1 text-sm text-neutral-600">
        Elected officials have a full crowdsourced profile — click through to see (and add to)
        what residents actually know about them.
      </p>

      <div className="mt-5 space-y-6">
        {[...grouped.entries()].map(([kind, rows]) => (
          <div key={kind}>
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
              {KIND_LABELS[kind] ?? kind}
            </p>
            <ul className="mt-1.5 space-y-1">
              {rows.map((dm) =>
                kind === "elected_official" ? (
                  <li key={dm.id}>
                    <Link href={`/decision-makers/${dm.id}`} className="text-sm text-duty-purple underline">
                      {dm.name}
                    </Link>
                  </li>
                ) : (
                  <li key={dm.id} className="text-sm text-neutral-700">
                    {dm.name}
                  </li>
                )
              )}
            </ul>
          </div>
        ))}
        {(!decisionMakers || decisionMakers.length === 0) && (
          <p className="text-sm text-neutral-500">Nothing in the registry yet.</p>
        )}
      </div>
    </div>
  );
}
