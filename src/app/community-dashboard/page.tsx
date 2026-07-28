import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const STAT_COLORS = {
  proposals: "#6C3FD1",
  contributed: "#4069D9",
  comments: "#8358D3",
  decisionMakers: "#2E8B57",
  letters: "#D97706",
  meetings: "#0EA5A5",
  volunteerHours: "#C2410C",
  testimony: "#7C3AED",
  members: "#475569",
};

function Tile({ label, value, sublabel, color }: { label: string; value: number | string; sublabel?: string; color: string }) {
  return (
    <div className="rounded-lg p-3" style={{ backgroundColor: `${color}1a` }}>
      <p className="text-2xl font-bold" style={{ color }}>
        {value}
      </p>
      <p className="mt-0.5 text-xs font-medium text-neutral-600">{label}</p>
      {sublabel && <p className="text-[11px] text-neutral-500">{sublabel}</p>}
    </div>
  );
}

// Percent breakdown of a demographic field among profiles that actually
// shared it — "prefer not to say" / never-answered rows are excluded
// from the denominator so the percentages reflect real answers, not
// silence.
function breakdown(rows: { value: string | null }[]) {
  const answered = rows.filter((r) => r.value && r.value.trim() !== "");
  const counts = new Map<string, number>();
  for (const r of answered) {
    counts.set(r.value!, (counts.get(r.value!) ?? 0) + 1);
  }
  const total = answered.length;
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([label, count]) => ({
      label,
      count,
      pct: total > 0 ? Math.round((count / total) * 100) : 0,
    }));
}

function BreakdownList({ title, items, respondedCount, totalCount }: {
  title: string;
  items: { label: string; count: number; pct: number }[];
  respondedCount: number;
  totalCount: number;
}) {
  return (
    <div>
      <p className="text-xs font-semibold text-neutral-700">{title}</p>
      <p className="text-[11px] text-neutral-400">
        {respondedCount} of {totalCount} shared this
      </p>
      {items.length === 0 ? (
        <p className="mt-1 text-xs text-neutral-400">No answers shared yet.</p>
      ) : (
        <ul className="mt-1.5 space-y-1">
          {items.map((item) => (
            <li key={item.label} className="flex items-center gap-2 text-xs">
              <span className="w-28 shrink-0 truncate text-neutral-600">{item.label}</span>
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-100">
                <span
                  className="block h-full rounded-full bg-duty-purple"
                  style={{ width: `${item.pct}%` }}
                />
              </span>
              <span className="w-10 shrink-0 text-right text-neutral-500">{item.pct}%</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default async function CommunityDashboardPage({
  searchParams,
}: {
  searchParams: { district?: string };
}) {
  const supabase = createClient();
  const selectedDistrict = searchParams.district ? Number(searchParams.district) : null;

  const [
    { count: proposalsMade },
    { count: commentsMade },
    { data: suggestedEdits },
    { data: powerTreeUpdates },
    civicTotals,
    { data: allProfiles },
  ] = await Promise.all([
    supabase.from("proposals").select("id", { count: "exact", head: true }),
    supabase.from("comments").select("id", { count: "exact", head: true }),
    // Postgrest can't compare two columns (author vs. proposal owner) in
    // a single filter, so this pulls each suggested edit's author and
    // its proposal's owner and does the "not the same person" check in
    // JS below, instead of trying to force it into one query.
    supabase
      .from("comments")
      .select("id, author_id, proposals ( owner_id )")
      .eq("is_suggested_edit", true),
    supabase.from("power_tree_node_updates").select("proposal_power_tree_nodes ( decision_maker_id )"),
    supabase
      .from("civic_logs")
      .select("log_type, published, hours")
      .eq("status", "published"),
    supabase.from("profiles").select("age_range, race_ethnicity, gender, council_district"),
  ]);

  const contributedToOthers = (suggestedEdits ?? []).filter(
    (c: any) => c.proposals?.owner_id && c.proposals.owner_id !== c.author_id
  ).length;

  const decisionMakersEngaged = new Set(
    (powerTreeUpdates ?? [])
      .map((u: any) => u.proposal_power_tree_nodes?.decision_maker_id)
      .filter(Boolean)
  ).size;

  const logs = civicTotals.data ?? [];
  const lettersWritten = logs.filter((l: any) => l.log_type === "letter_to_editor").length;
  const lettersPublished = logs.filter((l: any) => l.log_type === "letter_to_editor" && l.published).length;
  const meetingsAttended = logs.filter((l: any) => l.log_type === "community_meeting").length;
  const testimonyGiven = logs.filter((l: any) => l.log_type === "testimony").length;
  const volunteerHours = logs
    .filter((l: any) => l.log_type === "volunteer_hours")
    .reduce((sum: number, l: any) => sum + (l.hours ?? 0), 0);

  const totalMembers = allProfiles?.length ?? 0;
  const districtProfiles = selectedDistrict
    ? (allProfiles ?? []).filter((p: any) => p.council_district === selectedDistrict)
    : allProfiles ?? [];

  const ageBreakdown = breakdown(districtProfiles.map((p: any) => ({ value: p.age_range })));
  const raceBreakdown = breakdown(districtProfiles.map((p: any) => ({ value: p.race_ethnicity })));
  const genderBreakdown = breakdown(districtProfiles.map((p: any) => ({ value: p.gender })));

  const districts = Array.from({ length: 10 }, (_, i) => i + 1);

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-semibold">Community dashboard</h1>
      <p className="mt-1 text-sm text-neutral-600">
        The whole community's civic report card, added together — every proposal, comment,
        conversation, and logged action, from everyone.
      </p>

      <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <Tile label="Proposals made" value={proposalsMade ?? 0} color={STAT_COLORS.proposals} />
        <Tile label="Comments made" value={commentsMade ?? 0} color={STAT_COLORS.comments} />
        <Tile
          label="Contributed to others'"
          value={contributedToOthers}
          color={STAT_COLORS.contributed}
        />
        <Tile
          label="Decision-makers engaged"
          value={decisionMakersEngaged}
          color={STAT_COLORS.decisionMakers}
        />
        <Tile
          label="Letters written"
          value={lettersWritten}
          sublabel={lettersPublished > 0 ? `${lettersPublished} published` : undefined}
          color={STAT_COLORS.letters}
        />
        <Tile label="Meetings attended" value={meetingsAttended} color={STAT_COLORS.meetings} />
        <Tile label="Volunteer hours" value={volunteerHours} color={STAT_COLORS.volunteerHours} />
        <Tile label="Testimony given" value={testimonyGiven} color={STAT_COLORS.testimony} />
        <Tile label="Registered members" value={totalMembers} color={STAT_COLORS.members} />
      </div>

      <div className="mt-8">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Who's showing up</h2>
          <div className="flex flex-wrap gap-1.5">
            <Link
              href="/community-dashboard"
              className={`rounded-full border px-2.5 py-1 text-xs ${
                !selectedDistrict
                  ? "border-duty-purple bg-duty-purple/10 text-duty-purple"
                  : "border-neutral-300 text-neutral-600 hover:bg-neutral-50"
              }`}
            >
              Citywide
            </Link>
            {districts.map((d) => (
              <Link
                key={d}
                href={`/community-dashboard?district=${d}`}
                className={`rounded-full border px-2.5 py-1 text-xs ${
                  selectedDistrict === d
                    ? "border-duty-purple bg-duty-purple/10 text-duty-purple"
                    : "border-neutral-300 text-neutral-600 hover:bg-neutral-50"
                }`}
              >
                D{d}
              </Link>
            ))}
          </div>
        </div>
        <p className="mt-1 text-xs text-neutral-500">
          Self-reported, optional demographics — never required, never geocoded from an address.
          {selectedDistrict
            ? ` Showing the ${districtProfiles.length} member${districtProfiles.length === 1 ? "" : "s"} who put themselves in District ${selectedDistrict}.`
            : ` Showing all ${totalMembers} registered members.`}
        </p>

        <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-3">
          <BreakdownList
            title="Age range"
            items={ageBreakdown}
            respondedCount={ageBreakdown.reduce((s, i) => s + i.count, 0)}
            totalCount={districtProfiles.length}
          />
          <BreakdownList
            title="Race / ethnicity"
            items={raceBreakdown}
            respondedCount={raceBreakdown.reduce((s, i) => s + i.count, 0)}
            totalCount={districtProfiles.length}
          />
          <BreakdownList
            title="Gender"
            items={genderBreakdown}
            respondedCount={genderBreakdown.reduce((s, i) => s + i.count, 0)}
            totalCount={districtProfiles.length}
          />
        </div>

        {/* Honest gap, not a guess: comparing "who's showing up" against
            Philadelphia's actual population by council district needs
            real Census/ACS demographic data joined to district
            boundaries — the same kind of real-data problem as the zip
            crosswalk. Flagging it instead of inventing numbers that
            would look authoritative but aren't. */}
        <div className="mt-4 rounded-md border border-dashed border-neutral-300 bg-neutral-50 p-3 text-xs text-neutral-500">
          Not built yet: comparing this against Philadelphia's actual population by district.
          That needs real Census/ACS demographic data joined to council district boundaries —
          similar to the zip-code crosswalk work. Worth doing properly with real sourced data
          rather than an estimate, whenever it's time to prioritize it.
        </div>
      </div>
    </div>
  );
}
