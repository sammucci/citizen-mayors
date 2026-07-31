import Link from "next/link";
import { Fredoka } from "next/font/google";
import { createClient } from "@/lib/supabase/server";
import { CENSUS_DISTRICT_DEMOGRAPHICS, citywideCensusStats } from "@/lib/census-district-demographics";
import { InfoHeading } from "@/components/info-heading";
import { StatIcon, type StatIconName } from "@/components/stat-icons";
import { StatTileGrid, type StatTileData } from "@/components/stat-tile-grid";
import { brightnessOf } from "@/components/flippable-stat-tile";

export const dynamic = "force-dynamic";

// Sofia Pro (what Samantha asked for by name) is a commercial font sold
// through Mostardesign/Adobe Fonts, not something freely licensable to
// bundle here. Poppins was the first free stand-in tried, but bold
// Poppins numerals on plain white read as harsh/clinical rather than
// friendly — Fredoka is a genuinely rounded, soft-terminal display font
// (also free, also self-hostable via next/font/google) that's a closer
// match to the warm, approachable feel Sofia Pro has. Scoped to just the
// stat numbers, not swapped in site-wide. If Samantha gets an actual
// Sofia Pro license and drops the .woff2 files in public/fonts, swapping
// this for a real @font-face is a quick follow-up.
const statNumberFont = Fredoka({ subsets: ["latin"], weight: ["700"], display: "swap" });

// Pulled directly from the real category palette (supabase/schema.sql's
// `categories` seed — Public Safety, General Government, Benefits &
// Pensions, Infrastructure & Sanitation, Culture & Leisure, Education &
// Subsidies, Governance & Civic Process) instead of a separate made-up
// set of colors — these are the same 7 colors already used for category
// badges/accents everywhere else in the app, so the stat cards actually
// match the rest of the site instead of introducing their own palette.
// Only 7 real colors to cover 9 cards, so two repeat — positioned so the
// repeats don't land in the same grid column/row as each other.
const STAT_COLORS = {
  proposals: "#8358D3", // Public Safety
  contributed: "#4069D9", // General Government Operations
  comments: "#F86767", // Benefits and Pensions
  decisionMakers: "#FF74A5", // Infrastructure and Sanitation
  letters: "#6BAB68", // Culture and Leisure
  contactedOfficials: "#FF881A", // Education and Subsidies
  meetings: "#FBE968", // Governance and Civic Process (the yellow)
  volunteerHours: "#8358D3", // repeats Public Safety's purple
  testimony: "#4069D9", // repeats General Government's blue
  // Was an unused "members" placeholder color — repurposed for the
  // cross-partisan-usership card. Deliberately a neutral grey rather
  // than one of the 7 category colors: this card's whole point is that
  // the membership doesn't skew toward any one side, so it shouldn't
  // visually read as "belonging" to any one category either.
  crossPartisan: "#475569",
};

// What each card's back face explains when it's tapped — just the "why
// this matters" sentence now, not a definition of the stat too (the
// label on the back already says what it is). The first pass had a
// full paragraph per card and it got clipped at the bottom of the fixed-
// height card — one short sentence is what actually fits.
const TILE_DESCRIPTIONS: Record<string, string> = {
  proposalsMade: "More people bringing ideas forward, instead of waiting for someone else to.",
  contributedToOthers: "Good ideas get sharper with more eyes on them.",
  commentsMade: "Working through the details in the open is how an idea gets pressure-tested.",
  decisionMakersEngaged: "Knowing exactly who holds the power to act is the first step to moving something.",
  lettersWritten: "Puts an issue in front of people who aren't already paying attention, and builds pressure through local media.",
  contactedOfficials: "Direct contact is one of the most reliable ways a resident's voice reaches the person who can act.",
  meetingsAttended: "Local democracy runs on people actually being in the room.",
  volunteerHours: "Showing up to do the work is part of the same civic fabric as policy.",
  testimonyGiven: "Puts a resident's voice on the permanent public record.",
  crossPartisanUsership:
    "Quality-of-life issues draw support across the political spectrum, not just one side.",
};

// The "about your community" strip — members/zip codes/districts used
// to be three more tiles in the same grid as the civic-action stats,
// which flattened everything into one undifferentiated wall of boxes.
// Pulling these three out keeps the hierarchy (this is quiet context —
// "who's here" — the grid below is the celebration — "what everyone's
// done"), but widened to the full card width and centered per
// Samantha's ask, rather than the original tight left-aligned pill.
// Same real-icon treatment as the stat tiles (see stat-icons.tsx) —
// no emoji here either — just in muted grey chips instead of each
// stat's own bright color, since this row is meant to read as calmer
// background context, not another celebration.
function CommunityStrip({
  members,
  zipCodes,
  districts,
}: {
  members: number;
  zipCodes: number;
  districts: number;
}) {
  const items: { icon: StatIconName; value: string; label: string }[] = [
    { icon: "registeredMembers", value: String(members), label: `registered member${members === 1 ? "" : "s"}` },
    { icon: "zipCodes", value: String(zipCodes), label: `zip code${zipCodes === 1 ? "" : "s"}` },
    // Reuses the "elected official" icon rather than a dedicated
    // districts glyph (there wasn't one in the export set) — Samantha's
    // call, since council districts and elected officials read as the
    // same idea here.
    { icon: "contactedAnElected", value: `${districts}/10`, label: "districts represented" },
  ];
  return (
    <div className="mt-4 flex flex-wrap items-center justify-center gap-x-10 gap-y-3 rounded-2xl bg-neutral-50 px-6 py-4">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-200/70 text-neutral-500">
            <StatIcon name={item.icon} className="h-5 w-5" />
          </div>
          <p className="text-sm text-neutral-600">
            <span className="text-base font-bold text-neutral-900">{item.value}</span> {item.label}
          </p>
        </div>
      ))}
    </div>
  );
}

// Turns the {value, count} pairs already aggregated by the
// demographic_breakdown() Postgres function (see migration_harden_
// private_demographics.sql) into the {label, count, pct} shape
// BreakdownList expects. Unlike the old version of this helper, this one
// never sees a raw per-person row — "prefer not to say" / unanswered
// rows are already excluded server-side (the function's WHERE clause
// skips null/empty), so every row here is a real, already-grouped answer.
function breakdownFromCounts(rows: { value: string; count: number }[] | null) {
  const safeRows = rows ?? [];
  const total = safeRows.reduce((sum, r) => sum + Number(r.count), 0);
  return [...safeRows]
    .sort((a, b) => Number(b.count) - Number(a.count))
    .map((r) => ({
      label: r.value,
      count: Number(r.count),
      pct: total > 0 ? Math.round((Number(r.count) / total) * 100) : 0,
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

// Proposals grouped into curated tag topics (Pedestrian & Bike Safety,
// Housing, ...) — same bar-list shape as HoursByCategory above, one
// row per topic Samantha's actually created on /admin/tags. Individual
// tags never show up here on their own; only tags she's assigned to a
// topic count toward anything, by design (see the proposalsByTopic
// computation above for why).
function ProposalsByTopic({ items }: { items: { label: string; count: number }[] }) {
  if (items.length === 0) {
    return (
      <p className="mt-1 text-xs text-neutral-400">
        No proposals tagged into a topic yet — assign tags to a topic on the admin
        tags page to see them here.
      </p>
    );
  }
  const max = items[0].count;
  return (
    <ul className="mt-1.5 space-y-1">
      {items.map(({ label, count }) => (
        <li key={label} className="flex items-center gap-2 text-xs">
          <span className="w-28 shrink-0 truncate text-neutral-600">{label}</span>
          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-100">
            <span
              className="block h-full rounded-full"
              style={{ width: `${max > 0 ? (count / max) * 100 : 0}%`, backgroundColor: STAT_COLORS.proposals }}
            />
          </span>
          <span className="w-20 shrink-0 text-right text-neutral-500">
            {count} proposal{count === 1 ? "" : "s"}
          </span>
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
    { data: proposalTagRows },
    { data: ageRows },
    { data: raceRows },
    { data: genderRows },
    { data: housingRows },
    { data: politicalRows },
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
    // Just the two non-sensitive location fields — the five private
    // demographic columns (age/race/gender/housing/political) are no
    // longer directly selectable at all (see
    // migration_harden_private_demographics.sql), from ANY query,
    // including this one. They're only reachable through the
    // aggregate-only demographic_breakdown() calls below.
    supabase.from("profiles").select("zip_code, council_district"),
    supabase
      .from("volunteer_categories")
      .select("label, volunteer_category_groups ( label )"),
    // Same rollup idea as volunteer hours by category, for project tags:
    // proposals!inner + the published filter (rather than a plain
    // embed) is what actually excludes drafts here — Postgrest treats a
    // plain embedded table as an optional left join, so without !inner
    // the filter would just null out `proposals` on non-matching rows
    // instead of dropping them (same gotcha documented on the homepage
    // query in src/app/page.tsx).
    supabase
      .from("proposal_tags")
      .select("proposal_id, tags ( group_id, tag_groups ( label ) ), proposals!inner ( published )")
      .eq("proposals.published", true),
    // Each of these does its group-by/count inside Postgres and hands
    // back only {value, count} pairs — never a raw per-person row. Same
    // district filter as everything else on this page.
    supabase.rpc("demographic_breakdown", { field: "age_range", filter_district: selectedDistrict }),
    supabase.rpc("demographic_breakdown", { field: "race_ethnicity", filter_district: selectedDistrict }),
    supabase.rpc("demographic_breakdown", { field: "gender", filter_district: selectedDistrict }),
    supabase.rpc("demographic_breakdown", { field: "housing_status", filter_district: selectedDistrict }),
    supabase.rpc("demographic_breakdown", { field: "political_affiliation", filter_district: selectedDistrict }),
  ]);

  const categoryToGroup = new Map<string, string>(
    (volunteerCategoryRows ?? [])
      .filter((c: any) => c.volunteer_category_groups?.label)
      .map((c: any) => [c.label, c.volunteer_category_groups.label])
  );

  // Distinct proposals per topic, not a sum of per-tag counts — a
  // proposal with two tags in the same topic ("bike lanes" AND
  // "pedestrians", say, both under "Pedestrian & Bike Safety") should
  // only count once, not twice. Tags with no topic assigned are simply
  // not represented here (by design, per Samantha's ask) — hundreds of
  // individual tags would swamp the chart, so only curated topics roll
  // up onto the dashboard.
  const proposalIdsByTopic = new Map<string, Set<string>>();
  for (const row of proposalTagRows ?? []) {
    const topicLabel = (row as any).tags?.tag_groups?.label;
    if (!topicLabel) continue;
    if (!proposalIdsByTopic.has(topicLabel)) proposalIdsByTopic.set(topicLabel, new Set());
    proposalIdsByTopic.get(topicLabel)!.add((row as any).proposal_id);
  }
  const proposalsByTopic = [...proposalIdsByTopic.entries()]
    .map(([label, ids]) => ({ label, count: ids.size }))
    .sort((a, b) => b.count - a.count);

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
  // Deliberately its own separate count, not folded into "Decision-makers
  // engaged" below — that stat is about named officials/bodies mapped
  // into a specific proposal's decision chain (a structural, per-proposal
  // thing), while this is raw volume of direct contact logged off-
  // platform, with no requirement it ties back to any one proposal. Two
  // different things worth seeing on their own rather than merged into
  // one number that would mean neither.
  const contactedOfficials = logs.filter((l: any) => l.log_type === "contacted_official").length;
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

  const ageBreakdown = breakdownFromCounts(ageRows);
  const raceBreakdown = breakdownFromCounts(raceRows);
  const genderBreakdown = breakdownFromCounts(genderRows);
  const housingBreakdown = breakdownFromCounts(housingRows);
  // No Census comparison for this one (obviously — ACS doesn't ask
  // political affiliation) — just the self-reported member breakdown, same
  // as everything else here: aggregate counts only, computed IN the
  // database by demographic_breakdown() (see migration_harden_private_
  // demographics.sql) — this page never sees a raw per-person answer.
  const politicalBreakdown = breakdownFromCounts(politicalRows);
  const politicalRespondents = politicalBreakdown.reduce((sum, r) => sum + r.count, 0);

  // Same brightness check flippable-stat-tile.tsx uses internally, run
  // here too since this card's back content is pre-built JSX handed in
  // from the server side — it has to pick its own readable bar/text
  // color rather than relying on the tile component to do it.
  const crossPartisanTextColor =
    brightnessOf(STAT_COLORS.crossPartisan) > 180 ? "#3a3200" : "#ffffff";
  const crossPartisanBackContent = (
    <ul className="space-y-1">
      {politicalBreakdown.length === 0 ? (
        <li style={{ color: crossPartisanTextColor, opacity: 0.85 }}>No answers shared yet.</li>
      ) : (
        politicalBreakdown.map((row) => (
          <li key={row.label} className="flex items-center gap-1.5">
            <span
              className="w-[4.5rem] shrink-0 truncate"
              style={{ color: crossPartisanTextColor }}
            >
              {row.label}
            </span>
            <span
              className="h-1.5 flex-1 overflow-hidden rounded-full"
              style={{ backgroundColor: `${crossPartisanTextColor}33` }}
            >
              <span
                className="block h-full rounded-full"
                style={{ width: `${row.pct}%`, backgroundColor: crossPartisanTextColor }}
              />
            </span>
            <span className="w-8 shrink-0 text-right" style={{ color: crossPartisanTextColor, opacity: 0.85 }}>
              {row.pct}%
            </span>
          </li>
        ))
      )}
    </ul>
  );

  const districts = Array.from({ length: 10 }, (_, i) => i + 1);

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-semibold">Community dashboard</h1>
      <p className="mt-1 text-sm text-neutral-600">
        The whole community's civic report card, added together — every proposal, comment,
        conversation, and logged action, from everyone.
      </p>

      <CommunityStrip members={totalMembers} zipCodes={zipCodesRepresented} districts={districtsRepresented} />

      <h2 className="mt-7 text-xs font-bold uppercase tracking-wider text-neutral-400">
        Civic actions, together
      </h2>
      <StatTileGrid
        font={statNumberFont.className}
        items={[
          {
            key: "proposalsMade",
            icon: "proposalsMade",
            label: "Proposals made",
            value: proposalsMade ?? 0,
            color: STAT_COLORS.proposals,
            description: TILE_DESCRIPTIONS.proposalsMade,
          },
          {
            key: "contributedToOthers",
            icon: "contributionToOthers",
            label: "Contributions to others",
            value: contributedToOthers,
            color: STAT_COLORS.contributed,
            description: TILE_DESCRIPTIONS.contributedToOthers,
          },
          {
            key: "commentsMade",
            icon: "commentsMade",
            label: "Comments made",
            value: commentsMade ?? 0,
            color: STAT_COLORS.comments,
            description: TILE_DESCRIPTIONS.commentsMade,
          },
          {
            key: "decisionMakersEngaged",
            icon: "decisionMakersEngaged",
            label: "Decision-makers engaged",
            value: decisionMakersEngaged,
            color: STAT_COLORS.decisionMakers,
            description: TILE_DESCRIPTIONS.decisionMakersEngaged,
          },
          {
            key: "lettersWritten",
            icon: "lettersToTheEditor",
            label: "Letters to the editor",
            value: lettersWritten,
            sublabel: lettersPublished > 0 ? `${lettersPublished} published` : undefined,
            color: STAT_COLORS.letters,
            description: TILE_DESCRIPTIONS.lettersWritten,
          },
          {
            key: "contactedOfficials",
            icon: "contactedAnElected",
            label: "Contacted an elected official",
            value: contactedOfficials,
            color: STAT_COLORS.contactedOfficials,
            description: TILE_DESCRIPTIONS.contactedOfficials,
          },
          {
            key: "meetingsAttended",
            icon: "communityMeetingsAttended",
            label: "Community meetings attended",
            value: meetingsAttended,
            color: STAT_COLORS.meetings,
            description: TILE_DESCRIPTIONS.meetingsAttended,
          },
          {
            key: "volunteerHours",
            icon: "hoursVolunteered",
            label: "Hours volunteered",
            value: volunteerHours,
            color: STAT_COLORS.volunteerHours,
            description: TILE_DESCRIPTIONS.volunteerHours,
          },
          {
            key: "testimonyGiven",
            icon: "testimonyGiven",
            label: "Testimony given",
            value: testimonyGiven,
            color: STAT_COLORS.testimony,
            description: TILE_DESCRIPTIONS.testimonyGiven,
          },
          {
            key: "crossPartisanUsership",
            icon: "registeredMembers",
            label: "Cross-partisan usership",
            value: politicalBreakdown.length,
            sublabel:
              politicalRespondents > 0
                ? `affiliations represented, ${politicalRespondents} member${
                    politicalRespondents === 1 ? "" : "s"
                  } shared theirs`
                : "affiliations represented",
            color: STAT_COLORS.crossPartisan,
            description: TILE_DESCRIPTIONS.crossPartisanUsership,
            backContent: crossPartisanBackContent,
          },
        ]}
      />

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
          <BreakdownList
            title="Political affiliation"
            items={politicalBreakdown}
            respondedCount={politicalBreakdown.reduce((s, i) => s + i.count, 0)}
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

        <div className="mt-5">
          <InfoHeading
            className="text-xs font-semibold text-neutral-700"
            tooltip="Citywide, not affected by the district filter above. Only published proposals count, and only tags that have been assigned to a topic on the admin page — an individual tag with no topic doesn't show up here on its own."
          >
            Proposals by topic
          </InfoHeading>
          <ProposalsByTopic items={proposalsByTopic} />
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
