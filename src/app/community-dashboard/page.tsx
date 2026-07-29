import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CENSUS_DISTRICT_DEMOGRAPHICS, citywideCensusStats } from "@/lib/census-district-demographics";
import { InfoHeading } from "@/components/info-heading";

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

// Volunteer hours by category group — separate from BreakdownList above
// because this weighs by total hours logged, not by percent of people
// who answered a demographic question. Rolls individual tags up to
// Samantha's curated groups (Environmental, Animals, ...) so this stays
// a handful of readable buckets even as the tag list underneath grows;
// a tag with no group yet (or a category string from before groups
// existed) falls into "Ungrouped."
function HoursByCategory({
  rows,
  categoryToGroup,
}: {
  rows: { category: string | null; hours: number | null }[];
  categoryToGroup: Map<string, string>;
}) {
  const totals = new Map<string, number>();
  for (const r of rows) {
    if (!r.category) continue;
    const group = categoryToGroup.get(r.category) ?? "Ungrouped";
    totals.set(group, (totals.get(group) ?? 0) + (r.hours ?? 0));
  }
  const sorted = [...totals.entries()].sort((a, b) => b[1] - a[1]);
  const max = sorted.length > 0 ? sorted[0][1] : 0;

  if (sorted.length === 0) {
    return <p className="mt-1 text-xs text-neutral-400">No categorized volunteer hours logged yet.</p>;
  }

  return (
    <ul className="mt-1.5 space-y-1">
      {sorted.map(([group, hours]) => (
        <li key={group} className="flex items-center gap-2 text-xs">
          <span className="w-28 shrink-0 truncate text-neutral-600">{group}</span>
          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-100">
            <span
              className="block h-full rounded-full"
              style={{ width: `${max > 0 ? (hours / max) * 100 : 0}%`, backgroundColor: STAT_COLORS.volunteerHours }}
            />
          </span>
          <span className="w-16 shrink-0 text-right text-neutral-500">{hours} hrs</span>
        </li>
      ))}
    </ul>
  );
}

// Side-by-side comparison of the self-reported member breakdown above
// against real Philadelphia population data (see
// lib/census-district-demographics.ts for sourcing). Two bars per row
// instead of one — "you" vs. "Philly" — so the gap (or lack of one) is
// visible at a glance instead of needing to compare two separate lists.
function ComparisonRow({
  label,
  memberPct,
  censusPct,
}: {
  label: string;
  memberPct: number;
  censusPct: number;
}) {
  return (
    <li className="text-xs">
      <div className="flex items-center justify-between">
        <span className="truncate font-medium text-neutral-700">{label}</span>
        {/* Just the two numbers now — "50% here · 34% Philly" on every
            single row read as noisy repetition once there were several
            rows in a column. The one-time Key at the bottom of the card
            explains what purple vs. grey means instead. */}
        <span className="shrink-0">
          <span className="font-semibold text-duty-purple">{memberPct}%</span>
          <span className="mx-1 text-neutral-300">•</span>
          <span className="text-neutral-500">{censusPct}%</span>
        </span>
      </div>
      <div className="mt-1.5 space-y-1.5">
        <span className="block h-1.5 overflow-hidden rounded-full bg-neutral-100">
          <span className="block h-full rounded-full bg-duty-purple" style={{ width: `${memberPct}%` }} />
        </span>
        <span className="block h-1.5 overflow-hidden rounded-full bg-neutral-100">
          <span className="block h-full rounded-full bg-neutral-400" style={{ width: `${censusPct}%` }} />
        </span>
      </div>
    </li>
  );
}

// One-time legend for the purple-vs-grey convention used by every
// ComparisonRow in the card — replaces repeating "here"/"Philly" as text
// on every single row.
function ComparisonKey() {
  return (
    <div className="flex items-center gap-3 text-xs">
      <span className="font-semibold text-neutral-500">Key</span>
      <span className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-duty-purple" />
        <span className="font-medium text-duty-purple">Here</span>
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-neutral-400" />
        <span className="font-medium text-neutral-500">Philly</span>
      </span>
    </div>
  );
}

// The profile form's own options don't use the same words as the
// Census's categories (a member picks "Woman"/"Man"; ACS reports
// "Female"/"Male" — same underlying question, different label) or split
// things more finely than ACS's own "Other" bucket does (American
// Indian/Alaska Native, Native Hawaiian/Pacific Islander, and
// multiracial residents are each their own option here, but grouped
// together in the ACS numbers this dashboard pulls from). These two
// remaps exist purely so the comparison lines up two versions of the
// SAME category instead of silently showing two different ones side by
// side — "Non-binary" and "Other" are left as their own bars on
// purpose, correctly showing 0% on the Census side, since ACS doesn't
// collect that as a category at all.
function remapGenderForComparison(label: string): string {
  if (label === "Woman") return "Female";
  if (label === "Man") return "Male";
  return label;
}
function remapRaceForComparison(label: string): string {
  if (
    label === "American Indian or Alaska Native" ||
    label === "Native Hawaiian or Other Pacific Islander" ||
    label === "Two or more races"
  ) {
    return "Other";
  }
  return label;
}

function regroup(items: { label: string; count: number }[], remap: (label: string) => string) {
  const totals = new Map<string, number>();
  for (const i of items) {
    const label = remap(i.label);
    totals.set(label, (totals.get(label) ?? 0) + i.count);
  }
  return [...totals.entries()].map(([label, count]) => ({ label, count }));
}

function CensusComparisonSection({
  title,
  tooltip,
  memberItems,
  censusItems,
}: {
  title: string;
  tooltip?: string;
  memberItems: { label: string; count: number }[];
  censusItems: { label: string; count: number }[];
}) {
  const memberTotal = memberItems.reduce((s, i) => s + i.count, 0);
  const censusTotal = censusItems.reduce((s, i) => s + i.count, 0);
  // Union of labels from both sides, in census-count order, so a label
  // members use but Philly's data doesn't track (or vice versa) still
  // shows up rather than silently disappearing.
  const censusByLabel = new Map(censusItems.map((i) => [i.label, i.count]));
  const memberByLabel = new Map(memberItems.map((i) => [i.label, i.count]));
  const labels = [...new Set([...censusItems.map((i) => i.label), ...memberItems.map((i) => i.label)])];

  return (
    <div>
      {tooltip ? (
        <InfoHeading className="text-xs font-semibold text-neutral-700" tooltip={tooltip}>
          {title}
        </InfoHeading>
      ) : (
        <p className="text-xs font-semibold text-neutral-700">{title}</p>
      )}
      <ul className="mt-3 space-y-3">
        {labels.map((label) => (
          <ComparisonRow
            key={label}
            label={label}
            memberPct={memberTotal > 0 ? Math.round(((memberByLabel.get(label) ?? 0) / memberTotal) * 100) : 0}
            censusPct={censusTotal > 0 ? Math.round(((censusByLabel.get(label) ?? 0) / censusTotal) * 100) : 0}
          />
        ))}
      </ul>
    </div>
  );
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
    { data: volunteerCategoryRows },
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
      .select("log_type, published, hours, category")
      .eq("status", "published"),
    supabase
      .from("profiles")
      .select("age_range, race_ethnicity, gender, housing_status, zip_code, council_district"),
    supabase
      .from("volunteer_categories")
      .select("label, volunteer_category_groups ( label )"),
  ]);

  const categoryToGroup = new Map<string, string>(
    (volunteerCategoryRows ?? [])
      .filter((c: any) => c.volunteer_category_groups?.label)
      .map((c: any) => [c.label, c.volunteer_category_groups.label])
  );

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
  const zipCodesRepresented = new Set(
    (allProfiles ?? []).map((p: any) => p.zip_code).filter((z: string | null) => z && z.trim() !== "")
  ).size;
  const districtsRepresented = new Set(
    (allProfiles ?? [])
      .map((p: any) => p.council_district)
      .filter((d: number | null) => d !== null && d !== undefined)
  ).size;
  const districtProfiles = selectedDistrict
    ? (allProfiles ?? []).filter((p: any) => p.council_district === selectedDistrict)
    : allProfiles ?? [];

  const ageBreakdown = breakdown(districtProfiles.map((p: any) => ({ value: p.age_range })));
  const raceBreakdown = breakdown(districtProfiles.map((p: any) => ({ value: p.race_ethnicity })));
  const genderBreakdown = breakdown(districtProfiles.map((p: any) => ({ value: p.gender })));
  const housingBreakdown = breakdown(districtProfiles.map((p: any) => ({ value: p.housing_status })));

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
        <Tile
          label="Contributions to others"
          value={contributedToOthers}
          color={STAT_COLORS.contributed}
        />
        <Tile label="Comments made" value={commentsMade ?? 0} color={STAT_COLORS.comments} />
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
        <Tile label="Zip codes represented" value={zipCodesRepresented} color={STAT_COLORS.members} />
        <Tile label="Council districts represented" value={`${districtsRepresented} / 10`} color={STAT_COLORS.members} />
      </div>

      <div className="mt-8">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <InfoHeading
            as="h2"
            className="text-lg font-semibold"
            tooltip={`Self-reported, optional demographics — never required, never geocoded from an address. ${
              selectedDistrict
                ? `Showing the ${districtProfiles.length} member${districtProfiles.length === 1 ? "" : "s"} who put themselves in District ${selectedDistrict}.`
                : `Showing all ${totalMembers} registered members.`
            }`}
          >
            Who's showing up
          </InfoHeading>
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
        <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-4">
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
          <BreakdownList
            title="Housing status"
            items={housingBreakdown}
            respondedCount={housingBreakdown.reduce((s, i) => s + i.count, 0)}
            totalCount={districtProfiles.length}
          />
        </div>

        <div className="mt-5">
          <InfoHeading
            className="text-xs font-semibold text-neutral-700"
            tooltip={`Ranked by group (citywide, not affected by the district filter above) — individual tags people pick from in "Add a log" roll up to whichever group they've been assigned to on the admin page; anything not yet assigned shows as "Ungrouped."`}
          >
            Volunteer hours by category
          </InfoHeading>
          <HoursByCategory
            rows={logs.filter((l: any) => l.log_type === "volunteer_hours")}
            categoryToGroup={categoryToGroup}
          />
        </div>

        {/* Real comparison now, not a placeholder: Philadelphia's actual
            2020-2024 ACS population data (refreshed in v60 from the prior
            2022 vintage), joined to council districts the
            same way as the zip crosswalk (tract centroid vs. district
            polygon). See lib/census-district-demographics.ts for the
            full sourcing note and known limitations (no non-binary
            category in Census data, "Other" groups several small race
            categories together, "Unhoused" isn't something ACS housing
            tenure can measure). Age isn't included yet — same data
            source, just needs one more processing pass. Each row now
            just shows the two bare percentages (purple = here, grey =
            Philly) instead of repeating "here"/"Philly" as text on every
            line — the one-time Key at the bottom of the card explains
            the color convention instead. */}
        <div className="mt-5 rounded-md border border-neutral-200 bg-white p-4">
          <InfoHeading
            className="text-sm font-semibold text-neutral-800"
            tooltip={`Real 2020-2024 Census (ACS5) data by council district, not an estimate. ${
              selectedDistrict ? `Comparing District ${selectedDistrict} only.` : "Citywide comparison."
            } Race/ethnicity and gender categories don't map 1:1 to the options above — see each column's own info icon for specifics. Age isn't in this comparison yet.`}
          >
            How this compares to Philadelphia
          </InfoHeading>
          <div className="mt-5 grid grid-cols-1 gap-7 sm:grid-cols-3">
            <CensusComparisonSection
              title="Race / ethnicity"
              tooltip='ACS reports "Other" as one bucket covering American Indian/Alaska Native, Native Hawaiian/Pacific Islander, and multiracial residents, who each get their own option on the profile form — those are combined here so the two sides compare the same categories.'
              memberItems={regroup(raceBreakdown, remapRaceForComparison)}
              censusItems={
                (selectedDistrict ? CENSUS_DISTRICT_DEMOGRAPHICS[selectedDistrict]?.race : citywideCensusStats().race) ?? []
              }
            />
            <CensusComparisonSection
              title="Gender (vs. Census sex)"
              tooltip={`Sex and gender aren't the same thing. The Census only collects "sex" (male/female) — it has no gender-identity category at all. "Woman"/"Man" are shown here matched against "Female"/"Male" as the closest available comparison, not a claim they mean the same thing. "Non-binary" and "Other" are real answers people gave here; they show 0% on the Census side because ACS simply doesn't ask that question, not because the number is actually zero.`}
              memberItems={regroup(genderBreakdown, remapGenderForComparison)}
              censusItems={
                (selectedDistrict ? CENSUS_DISTRICT_DEMOGRAPHICS[selectedDistrict]?.gender : citywideCensusStats().gender) ?? []
              }
            />
            <CensusComparisonSection
              title="Housing status"
              tooltip={`ACS measures owner- vs. renter-occupied housing units, which lines up with "Homeowner"/"Renter" here. It has no way to count "Unhoused" — people without housing aren't captured by a housing-unit survey — so that option only ever shows on the "here" side.`}
              memberItems={housingBreakdown.map((i) => ({ label: i.label, count: i.count }))}
              censusItems={
                (selectedDistrict ? CENSUS_DISTRICT_DEMOGRAPHICS[selectedDistrict]?.housing : citywideCensusStats().housing) ?? []
              }
            />
          </div>
          <div className="mt-5 flex justify-end border-t border-neutral-100 pt-3">
            <ComparisonKey />
          </div>
        </div>
      </div>
    </div>
  );
}
