import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const KIND_LABELS: Record<string, string> = {
  elected_official: "Elected officials",
  department: "Departments",
  board_commission: "Boards / commissions",
  other: "Other",
};

// Fixed display order for the kind groups themselves — Mayor's office
// and Council first (the actual power hierarchy Samantha asked for),
// then departments, then boards/commissions, then anything uncategorized.
const KIND_ORDER = ["elected_official", "department", "board_commission", "other"];

// Within "Elected officials," rank by the real chain of authority
// rather than alphabetically (which would scatter "Councilmember,
// District 1" next to "Councilmember, District 10" next to "Mayor of
// Philadelphia" with no meaningful order). Matches the same naming
// convention lib/decision-maker-represents.ts already relies on for
// these seeded seats — a custom-added elected official whose name
// doesn't match any of these patterns just falls to the end,
// alphabetically, rather than erroring or guessing at its rank.
function electedOfficialRank(name: string): [number, number, string] {
  const trimmed = name.trim();
  if (/^mayor of philadelphia$/i.test(trimmed)) return [0, 0, trimmed];
  if (/^council president/i.test(trimmed)) return [1, 0, trimmed];
  const districtSeat = trimmed.match(/^councilmember,\s*district\s*(\d+)$/i);
  if (districtSeat) return [2, Number(districtSeat[1]), trimmed];
  if (/^councilmember at-large/i.test(trimmed)) return [3, 0, trimmed];
  return [4, 0, trimmed];
}

// Public index — anyone can browse the shared registry, same "public
// read" policy as the registry itself. Every kind links through to its
// own profile page now (decision-makers/[id]/page.tsx already renders
// something meaningful for a department or board — photo, issue tags,
// proposals it's shown up in — even without the full elected-official
// wiki treatment), where before only elected officials were clickable
// and everything else was flat, dead text.
export default async function DecisionMakersIndexPage() {
  const supabase = createClient();
  const [{ data: decisionMakers }, { data: profiles }] = await Promise.all([
    supabase.from("decision_makers").select("id, name, kind").order("name"),
    supabase.from("decision_maker_profiles").select("decision_maker_id, current_officeholder"),
  ]);

  // Elected-official entries are named for the office/seat, not the
  // person ("Councilmember, District 1"), so the seat stays the same
  // across elections — see decision-makers/[id]/page.tsx. That means the
  // office title alone isn't enough to recognize someone at a glance
  // while browsing, so the current officeholder's name (when different
  // from the title itself) is appended here too.
  const officeholderByDm = new Map((profiles ?? []).map((p: any) => [p.decision_maker_id, p.current_officeholder as string | null]));

  const grouped = new Map<string, { id: string; name: string; officeholder: string | null }[]>();
  for (const dm of decisionMakers ?? []) {
    const officeholder = officeholderByDm.get(dm.id) ?? null;
    const list = grouped.get(dm.kind) ?? [];
    list.push({
      id: dm.id,
      name: dm.name,
      officeholder: officeholder && !dm.name.toLowerCase().includes(officeholder.toLowerCase()) ? officeholder : null,
    });
    grouped.set(dm.kind, list);
  }

  // Elected officials get the hierarchy sort; every other kind just
  // sorts alphabetically (a department or board has no equivalent chain
  // of command to rank by).
  for (const [kind, rows] of grouped.entries()) {
    if (kind === "elected_official") {
      rows.sort((a, b) => {
        const ra = electedOfficialRank(a.name);
        const rb = electedOfficialRank(b.name);
        if (ra[0] !== rb[0]) return ra[0] - rb[0];
        if (ra[1] !== rb[1]) return ra[1] - rb[1];
        return ra[2].localeCompare(rb[2]);
      });
    } else {
      rows.sort((a, b) => a.name.localeCompare(b.name));
    }
  }

  const orderedGroups = [...grouped.entries()].sort(
    ([kindA], [kindB]) => KIND_ORDER.indexOf(kindA) - KIND_ORDER.indexOf(kindB)
  );

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-semibold">Leadership directory</h1>
      <p className="mt-1 text-sm text-neutral-600">
        Every elected official, department, and board in the registry, organized top-down —
        Mayor, then Council, then the departments and boards under them. Elected officials have
        a full crowdsourced profile (office details, legislation, wiki text); departments and
        boards have a simpler page, but every name below clicks through to one.
      </p>

      <div className="mt-5 space-y-6">
        {orderedGroups.map(([kind, rows]) => (
          <div key={kind}>
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
              {KIND_LABELS[kind] ?? kind}
            </p>
            <ul className="mt-1.5 space-y-1">
              {rows.map((dm) => (
                <li key={dm.id}>
                  <Link href={`/decision-makers/${dm.id}`} className="text-sm text-duty-purple underline">
                    {dm.name}
                  </Link>
                  {dm.officeholder && <span className="text-sm text-neutral-500"> — {dm.officeholder}</span>}
                </li>
              ))}
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
