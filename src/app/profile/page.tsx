import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { type CivicLog } from "@/components/civic-report-card";
import { ProfileInfoCard } from "@/components/profile-info-card";
import { ProposalMiniCardGrid } from "@/components/proposal-mini-card-grid";
import { ProfileTabbedSections } from "@/components/profile-tabbed-sections";
import { statusColorClasses } from "@/lib/status-colors";
import { HourglassIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
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
        to see your profile.
      </p>
    );
  }

  // age_range/race_ethnicity/gender/housing_status/political_affiliation
  // are deliberately NOT selectable directly anymore (see
  // migration_harden_private_demographics.sql) — even for the owner
  // reading their own row, that's now enforced at the database level,
  // not just by app-code discipline. get_my_demographics() is the one
  // sanctioned way back to those five answers, scoped to auth.uid()
  // inside the function itself.
  // The Supabase client here isn't generated against a typed schema, so
  // TypeScript has no way to know what get_my_demographics() returns and
  // quietly infers it as having no fields at all — that's what broke the
  // Vercel build (fullProfile "missing" the 5 demographic properties even
  // though they're really there at runtime). This explicit type is the
  // fix: it tells TypeScript what the function actually hands back, which
  // is exactly the columns get_my_demographics() selects in
  // migration_harden_private_demographics.sql.
  const [{ data: profile }, { data: demographicsRaw }] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "id, display_name, zip_code, council_district, bio, avatar_url, notifications_seen_at, is_admin, is_blocked, accepted_guidelines_at, created_at"
      )
      .eq("id", user.id)
      .single(),
    supabase.rpc("get_my_demographics").maybeSingle(),
  ]);
  const demographics = demographicsRaw as {
    age_range: string | null;
    race_ethnicity: string | null;
    gender: string | null;
    housing_status: string | null;
    political_affiliation: string | null;
    educational_attainment: string | null;
  } | null;
  // Not a plain `...(demographics ?? {})` spread — when the right side of
  // a spread might be `{}` (the no-demographics-yet case), TypeScript
  // marks every one of those keys OPTIONAL on the merged object (i.e.
  // `string | null | undefined`), since as far as it knows they might not
  // be there at all. ProfileInfoCard's Profile type requires exactly
  // `string | null`, no `undefined` — that mismatch is what broke this
  // build. Setting each field explicitly with `??` guarantees every key
  // is always present with a real `string | null` value, never omitted.
  const fullProfile = profile
    ? {
        ...profile,
        age_range: demographics?.age_range ?? null,
        race_ethnicity: demographics?.race_ethnicity ?? null,
        gender: demographics?.gender ?? null,
        housing_status: demographics?.housing_status ?? null,
        political_affiliation: demographics?.political_affiliation ?? null,
        educational_attainment: demographics?.educational_attainment ?? null,
      }
    : null;

  const { data: myProposals } = await supabase
    .from("proposals")
    .select(
      "id, title, type, geography_scope, geography_label, created_at, image_url, image_position_x, image_position_y, categories ( label, color )"
    )
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false });

  const { data: myComments } = await supabase
    .from("comments")
    .select(
      "id, body, is_suggested_edit, status, created_at, proposal_id, parent_comment_id, proposals ( title, owner_id, categories ( color ) )"
    )
    .eq("author_id", user.id)
    .order("created_at", { ascending: false });

  // "New since last visit" (comments, decision-chain activity) now lives
  // in the header's notification bell, computed the same way for every
  // page via getNotifications() — no need to duplicate that here.
  // Unresolved contributions below is different in kind, not a "what's
  // new" event but an ongoing status ("still waiting"), so it stays as
  // its own persistent panel on this page rather than moving to the
  // bell's time-gated list.
  const unresolvedContributions = (myComments ?? []).filter(
    (c: any) => c.is_suggested_edit && c.status === "open"
  );

  // The other side of the same coin: open suggested edits someone ELSE
  // left on one of YOUR proposals, still awaiting your review. This is
  // the direct fix for a real bug report — this used to only ever
  // surface as a one-time "new comment" notification that vanished the
  // moment the bell was opened, even though the suggestion itself was
  // still sitting there unresolved. It's the same persistent-status
  // panel (not a "what's new" event) already used for the box above,
  // just from the proposal-owner's side instead of the suggester's.
  const myProposalIds = (myProposals ?? []).map((p: any) => p.id);
  const { data: openSuggestionsOnMyProposalsRaw } =
    myProposalIds.length > 0
      ? await supabase
          .from("comments")
          .select("id, body, proposal_id, proposals ( title )")
          .in("proposal_id", myProposalIds)
          .eq("is_suggested_edit", true)
          .eq("status", "open")
          .neq("author_id", user.id)
      : { data: [] as any[] };

  const pendingReviewByProposal = new Map<string, { title: string; count: number }>();
  for (const c of (openSuggestionsOnMyProposalsRaw ?? []) as any[]) {
    const existing = pendingReviewByProposal.get(c.proposal_id);
    if (existing) {
      existing.count += 1;
    } else {
      pendingReviewByProposal.set(c.proposal_id, {
        title: c.proposals?.title ?? "A proposal",
        count: 1,
      });
    }
  }
  const pendingReviewOnMyProposals = [...pendingReviewByProposal.entries()];

  // Same persistent-status idea as the panel above, for a different real
  // bug report: a decision-maker someone else suggested for one of your
  // proposals (which lands "pending" until you approve it) used to only
  // ever show up once, as a one-time notification-bell blip that
  // vanished the moment the bell was opened — with no other place on the
  // site showing it, even though the suggestion itself was still sitting
  // there, unapproved. This mirrors pendingReviewOnMyProposals exactly.
  const { data: pendingLinksOnMyProposalsRaw } =
    myProposalIds.length > 0
      ? await supabase
          .from("proposal_power_tree_nodes")
          .select("id, proposal_id, decision_makers ( name ), proposals ( title )")
          .in("proposal_id", myProposalIds)
          .eq("status", "pending")
          .neq("submitted_by", user.id)
      : { data: [] as any[] };

  const pendingLinksByProposal = new Map<string, { title: string; names: string[] }>();
  for (const n of (pendingLinksOnMyProposalsRaw ?? []) as any[]) {
    const existing = pendingLinksByProposal.get(n.proposal_id);
    const name = n.decision_makers?.name ?? "Someone";
    if (existing) {
      existing.names.push(name);
    } else {
      pendingLinksByProposal.set(n.proposal_id, {
        title: n.proposals?.title ?? "A proposal",
        names: [name],
      });
    }
  }
  const pendingLinksOnMyProposals = [...pendingLinksByProposal.entries()];

  // --- Civic report card: platform-engagement half is all computed
  // live from tables that already exist ("compute, don't duplicate" —
  // the same call made on the Meantime project) rather than tracked in
  // new counter columns that could drift out of sync.
  const myCommentIds = (myComments ?? []).map((c: any) => c.id);
  const parentIdsIRepliedTo = (myComments ?? [])
    .map((c: any) => c.parent_comment_id)
    .filter((id: string | null): id is string => Boolean(id));

  // created_at added to each of these three (wasn't needed before the
  // civic report card had a year filter) so a "distinct person/decision-
  // maker engaged with" count can be scoped to a single year — it's a
  // real per-interaction timestamp, not something invented after the
  // fact, so "engaged with in 2025" means someone you actually talked to
  // or logged an update for that year, dedupe happening within the year
  // rather than across your whole account history.
  const [{ data: repliesToMe }, { data: peopleIRepliedTo }, { data: myPowerTreeUpdates }] =
    await Promise.all([
      myCommentIds.length > 0
        ? supabase.from("comments").select("author_id, created_at").in("parent_comment_id", myCommentIds)
        : Promise.resolve({ data: [] as { author_id: string; created_at: string }[] }),
      parentIdsIRepliedTo.length > 0
        ? supabase.from("comments").select("author_id, created_at").in("id", parentIdsIRepliedTo)
        : Promise.resolve({ data: [] as { author_id: string; created_at: string }[] }),
      supabase
        .from("power_tree_node_updates")
        .select("created_at, proposal_power_tree_nodes ( decision_maker_id, decision_makers ( name ) )")
        .eq("author_id", user.id),
    ]);

  const yearsByPersonId = new Map<string, Set<number>>();
  for (const r of [...(repliesToMe ?? []), ...(peopleIRepliedTo ?? [])] as any[]) {
    if (r.author_id === user.id) continue;
    const years = yearsByPersonId.get(r.author_id) ?? new Set<number>();
    years.add(new Date(r.created_at).getFullYear());
    yearsByPersonId.set(r.author_id, years);
  }
  const peopleConversedWithIds = [...yearsByPersonId.keys()];
  const peopleConversedWith = peopleConversedWithIds.length;

  const { data: conversedProfiles } =
    peopleConversedWithIds.length > 0
      ? await supabase.from("profiles").select("id, display_name").in("id", peopleConversedWithIds)
      : { data: [] as { id: string; display_name: string | null }[] };

  const decisionMakerYearsById = new Map<string, { name: string; years: Set<number> }>();
  for (const u of (myPowerTreeUpdates ?? []) as any[]) {
    const dmId = u.proposal_power_tree_nodes?.decision_maker_id;
    const dmName = u.proposal_power_tree_nodes?.decision_makers?.name;
    if (!dmId || !dmName) continue;
    const existing = decisionMakerYearsById.get(dmId) ?? { name: dmName, years: new Set<number>() };
    existing.years.add(new Date(u.created_at).getFullYear());
    decisionMakerYearsById.set(dmId, existing);
  }
  const decisionMakersEngaged = decisionMakerYearsById.size;

  const contributedProposals = new Map<string, { title: string; years: Set<number> }>();
  for (const c of (myComments ?? []) as any[]) {
    if (c.is_suggested_edit && c.proposals?.owner_id && c.proposals.owner_id !== user.id) {
      const existing = contributedProposals.get(c.proposal_id) ?? {
        title: c.proposals?.title ?? "A proposal",
        years: new Set<number>(),
      };
      existing.years.add(new Date(c.created_at).getFullYear());
      contributedProposals.set(c.proposal_id, existing);
    }
  }
  const contributedToOthers = contributedProposals.size;

  const { data: civicLogsRaw } = await supabase
    .from("civic_logs")
    .select("*")
    .eq("user_id", user.id)
    .order("occurred_on", { ascending: false });

  const [{ data: volunteerCategoryRows }, { data: populationCategoryRows }] = await Promise.all([
    supabase.from("volunteer_categories").select("label").order("label"),
    supabase.from("population_categories").select("label").order("label"),
  ]);
  const volunteerCategories = (volunteerCategoryRows ?? []).map((c: any) => c.label);
  const populationCategories = (populationCategoryRows ?? []).map((c: any) => c.label);

  const civicLogs: CivicLog[] = (civicLogsRaw ?? []).map((l: any) => ({
    id: l.id,
    logType: l.log_type,
    occurredOn: l.occurred_on,
    title: l.title,
    published: l.published,
    publishedLink: l.published_link,
    organization: l.organization,
    contactMethod: l.contact_method,
    hours: l.hours,
    category: l.category,
    populationServed: l.population_served,
    note: l.note,
    status: l.status,
  }));

  // Samantha's ask: the civic report card should stay all-time by
  // default, but with a year filter so past years are still visible
  // instead of getting buried. That means every detail item needs to
  // carry the year(s) it actually happened in — a proposal or comment
  // has exactly one, but "people you've talked with" and "decision-
  // makers engaged" are DISTINCT-per-year counts (see yearsByPersonId /
  // decisionMakerYearsById above), so those carry every year they had a
  // real interaction in. civic-report-card.tsx does the actual year
  // filtering/counting from these — no separately pre-computed
  // CivicStats object anymore, so the displayed numbers can't drift out
  // of sync with what's actually in `details`/`logs`.
  const civicDetails = {
    proposalsMade: (myProposals ?? []).map((p: any) => ({
      label: p.title,
      sublabel: `${p.type === "policy" ? "Policy" : "Project"}${
        p.geography_label ? ` · ${p.geography_label}` : p.geography_scope === "citywide" ? " · Citywide" : ""
      }`,
      href: `/proposals/${p.id}`,
      years: [new Date(p.created_at).getFullYear()],
    })),
    contributedToOthers: [...contributedProposals.entries()].map(([id, v]) => ({
      label: v.title,
      href: `/proposals/${id}`,
      years: [...v.years].sort(),
    })),
    commentsMade: (myComments ?? []).map((c: any) => ({
      label: c.body.length > 80 ? `${c.body.slice(0, 80)}…` : c.body,
      sublabel: c.proposals?.title ?? undefined,
      href: `/proposals/${c.proposal_id}`,
      years: [new Date(c.created_at).getFullYear()],
    })),
    peopleConversedWith: (conversedProfiles ?? []).map((p: any) => ({
      label: p.display_name ?? "A resident",
      href: `/u/${p.id}`,
      years: [...(yearsByPersonId.get(p.id) ?? new Set<number>())].sort(),
    })),
    decisionMakersEngaged: [...decisionMakerYearsById.values()].map((v) => ({
      label: v.name,
      years: [...v.years].sort(),
    })),
  };

  // Grouped by proposal so "Your comments" reads as one row per
  // conversation you've been part of, not a flat list repeating the
  // same proposal title over and over if you commented several times
  // in the same thread. Carries the category color along too, so you
  // can tell what kind of project each conversation was about at a
  // glance, same as the proposal cards.
  const commentsByProposal = new Map<
    string,
    { title: string; color: string | null; comments: any[] }
  >();
  for (const c of (myComments ?? []) as any[]) {
    const key = c.proposal_id;
    if (!commentsByProposal.has(key)) {
      commentsByProposal.set(key, {
        title: c.proposals?.title ?? "A proposal",
        color: c.proposals?.categories?.color ?? null,
        comments: [],
      });
    }
    commentsByProposal.get(key)!.comments.push(c);
  }

  // "Your civic groups" — neighborhood groups/civic orgs attached to
  // your own profile (see profile_organizations in schema.sql). Kept as
  // two simple sequential queries rather than folded into the big
  // Promise.all above — this section is independent of everything else
  // on the page and not on the critical path for anything above it.
  const [{ data: myOrgRows }, { data: allOrganizations }] = await Promise.all([
    supabase
      .from("profile_organizations")
      .select("organization_id, organizations ( id, name )")
      .eq("profile_id", user.id),
    supabase.from("organizations").select("name").order("name"),
  ]);
  const myOrganizations = (myOrgRows ?? [])
    .map((r: any) => r.organizations)
    .filter(Boolean) as { id: string; name: string }[];
  const allOrganizationNames = (allOrganizations ?? []).map((o: any) => o.name);

  // "Your expertise & interests" — the tag half of the crowdsourced-
  // expertise feature (see profile_followed_tags in schema.sql). Grouped
  // exactly the way the admin tag repository groups them (same
  // order("label") on both tags and tag_groups) so a resident sees the
  // same topic buckets Samantha curates, not a second, different
  // grouping invented just for this screen. Tags with no group_id fall
  // into an "Other" bucket rather than getting silently dropped.
  const [{ data: allTagsRaw }, { data: tagGroupsRaw }, { data: myFollowedTagsRaw }] = await Promise.all([
    supabase.from("tags").select("id, label, group_id").order("label"),
    supabase.from("tag_groups").select("id, label").order("label"),
    supabase.from("profile_followed_tags").select("tag_id").eq("profile_id", user.id),
  ]);
  const followedTagIds = new Set((myFollowedTagsRaw ?? []).map((r: any) => r.tag_id));
  const tagsByGroup = new Map<number | "other", { id: number; label: string; following: boolean }[]>();
  for (const t of (allTagsRaw ?? []) as any[]) {
    const key = t.group_id ?? "other";
    const list = tagsByGroup.get(key) ?? [];
    list.push({ id: t.id, label: t.label, following: followedTagIds.has(t.id) });
    tagsByGroup.set(key, list);
  }
  const tagGroups = [
    ...(tagGroupsRaw ?? []).map((g: any) => ({
      id: g.id,
      label: g.label,
      tags: tagsByGroup.get(g.id) ?? [],
    })),
    ...(tagsByGroup.has("other")
      ? [{ id: "other", label: "Other", tags: tagsByGroup.get("other")! }]
      : []),
  ];

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Your profile</h1>
        <p className="mt-1 text-sm text-neutral-600">{user.email}</p>
      </div>

      {pendingReviewOnMyProposals.length > 0 && (
        <div className="space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-3">
          <p className="flex items-center gap-1.5 text-sm font-medium text-amber-900">
            <HourglassIcon className="h-4 w-4 shrink-0" />
            {pendingReviewOnMyProposals.reduce((sum, [, v]) => sum + v.count, 0)} suggested edit
            {pendingReviewOnMyProposals.reduce((sum, [, v]) => sum + v.count, 0) === 1 ? "" : "s"} on your
            proposals still awaiting your review
          </p>
          <ul className="mt-1 space-y-0.5">
            {pendingReviewOnMyProposals.map(([proposalId, v]) => (
              <li key={proposalId}>
                <Link href={`/proposals/${proposalId}`} className="text-xs text-amber-800 underline">
                  {v.title} {v.count > 1 ? `(${v.count})` : ""}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {pendingLinksOnMyProposals.length > 0 && (
        <div className="space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-3">
          <p className="flex items-center gap-1.5 text-sm font-medium text-amber-900">
            <HourglassIcon className="h-4 w-4 shrink-0" />
            {pendingLinksOnMyProposals.reduce((sum, [, v]) => sum + v.names.length, 0)} decision-maker
            suggestion{pendingLinksOnMyProposals.reduce((sum, [, v]) => sum + v.names.length, 0) === 1 ? "" : "s"}{" "}
            on your proposals still awaiting your approval
          </p>
          <ul className="mt-1 space-y-0.5">
            {pendingLinksOnMyProposals.map(([proposalId, v]) => (
              <li key={proposalId}>
                <Link href={`/proposals/${proposalId}`} className="text-xs text-amber-800 underline">
                  {v.title} — {v.names.join(", ")}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {unresolvedContributions.length > 0 && (
        <div className="space-y-2 rounded-lg border border-duty-purple/30 bg-duty-purple/5 p-3">
          {unresolvedContributions.length > 0 && (
            <div>
              <p className="flex items-center gap-1.5 text-sm font-medium text-neutral-800">
                <HourglassIcon className="h-4 w-4 shrink-0 text-duty-purple" />
                {unresolvedContributions.length} of your suggested edit
                {unresolvedContributions.length === 1 ? "" : "s"} still awaiting a response
              </p>
              <ul className="mt-1 space-y-0.5">
                {unresolvedContributions.map((c: any) => (
                  <li key={c.id}>
                    <Link href={`/proposals/${c.proposal_id}`} className="text-xs text-duty-purple underline">
                      {c.proposals?.title ?? "A proposal"}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <ProfileInfoCard profile={fullProfile} />

      {/* Was three separately-stacked sections (report card, civic
          groups, expertise & interests) — Samantha's ask to bring the
          proposal page's "filing tab" motif here too, as a single
          three-tab folder instead of a long scroll of unrelated-looking
          blocks. See profile-tabbed-sections.tsx. */}
      <ProfileTabbedSections
        civicLogs={civicLogs}
        civicDetails={civicDetails}
        categoryColor="#6C3FD1"
        volunteerCategories={volunteerCategories}
        populationCategories={populationCategories}
        displayName={profile?.display_name || "A resident"}
        myOrganizations={myOrganizations}
        allOrganizationNames={allOrganizationNames}
        tagGroups={tagGroups}
      />

      <div>
        <h2 className="text-lg font-semibold">Your proposals</h2>
        {/* Shared mini-card grid (src/components/proposal-mini-card-grid.tsx)
            — same treatment now used on the decision-maker profile's
            "Shows up in N proposals" section, so this look is defined in
            one place instead of copy-pasted per page. */}
        <div className="mt-3">
          <ProposalMiniCardGrid
            emptyText="You haven't posted a proposal yet."
            showDelete
            proposals={(myProposals ?? []).map((p: any) => ({
              id: p.id,
              title: p.title,
              type: p.type,
              imageUrl: p.image_url,
              imagePositionX: p.image_position_x,
              imagePositionY: p.image_position_y,
              categoryLabel: p.categories?.label ?? null,
              categoryColor: p.categories?.color ?? null,
            }))}
          />
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold">Your comments</h2>
        {/* One dropdown per proposal you've commented on, instead of a
            flat list that repeats the proposal title for every comment —
            click to see the comments you made there. A left-edge color
            stripe (same idea as the proposal cards) gives a quick visual
            read of what kind of project each conversation was about. */}
        <ul className="mt-3 space-y-2">
          {[...commentsByProposal.entries()].map(([proposalId, group]) => (
            <li
              key={proposalId}
              className="overflow-hidden rounded-lg border border-l-4 border-neutral-200 bg-white"
              style={{ borderLeftColor: group.color ?? "#d4d4d4" }}
            >
              <details>
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 text-sm font-medium marker:content-none">
                  <span className="truncate">{group.title}</span>
                  <span className="shrink-0 text-xs font-normal text-neutral-400">
                    {group.comments.length} comment{group.comments.length === 1 ? "" : "s"}
                  </span>
                </summary>
                <ul className="space-y-2 border-t border-neutral-100 p-3">
                  <li>
                    <Link
                      href={`/proposals/${proposalId}`}
                      className="text-xs text-neutral-500 underline"
                    >
                      View proposal
                    </Link>
                  </li>
                  {group.comments.map((c: any) => (
                    <li key={c.id} className="text-sm">
                      <p className="text-neutral-600">{c.body}</p>
                      {c.is_suggested_edit && (
                        <span
                          className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs ${statusColorClasses(c.status)}`}
                        >
                          Suggested edit · {c.status.replace(/_/g, " ")}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </details>
            </li>
          ))}
          {commentsByProposal.size === 0 && (
            <p className="text-sm text-neutral-500">
              You haven&apos;t commented on anything yet.
            </p>
          )}
        </ul>
      </div>
    </div>
  );
}
