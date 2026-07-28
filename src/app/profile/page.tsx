import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CivicReportCard, type CivicLog, type CivicStats } from "@/components/civic-report-card";
import { ProfileInfoCard } from "@/components/profile-info-card";
import { statusColorClasses } from "@/lib/status-colors";

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

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  const { data: myProposals } = await supabase
    .from("proposals")
    .select(
      "id, title, type, created_at, image_url, image_position_x, image_position_y, categories ( label, color )"
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

  // --- "What's new since you were last here": read the OLD
  // notifications_seen_at first (so this visit's banner reflects
  // "since last time," not "since right now"), then bump it to now()
  // near the end of this render. There was previously no way to tell
  // a brand-new comment/reply apart from an old one you'd already
  // seen — this is the simplest fix that doesn't need a whole separate
  // notifications table.
  const lastSeenAt = profile?.notifications_seen_at ?? new Date(0).toISOString();
  const myProposalIds = (myProposals ?? []).map((p: any) => p.id);
  const myCommentIdsForNotifications = (myComments ?? []).map((c: any) => c.id);

  const [{ data: newCommentsOnMyProposals }, { data: newRepliesToMe }] = await Promise.all([
    myProposalIds.length > 0
      ? supabase
          .from("comments")
          .select("id, created_at, proposal_id, proposals ( title )")
          .in("proposal_id", myProposalIds)
          .neq("author_id", user.id)
          .gt("created_at", lastSeenAt)
      : Promise.resolve({ data: [] as any[] }),
    myCommentIdsForNotifications.length > 0
      ? supabase
          .from("comments")
          .select("id, created_at, proposal_id, proposals ( title )")
          .in("parent_comment_id", myCommentIdsForNotifications)
          .neq("author_id", user.id)
          .gt("created_at", lastSeenAt)
      : Promise.resolve({ data: [] as any[] }),
  ]);
  const newCommentsById = new Map<string, { title: string; proposalId: string }>();
  for (const c of [...(newCommentsOnMyProposals ?? []), ...(newRepliesToMe ?? [])] as any[]) {
    newCommentsById.set(c.id, { title: c.proposals?.title ?? "A proposal", proposalId: c.proposal_id });
  }
  const newComments = [...newCommentsById.entries()].map(([id, v]) => ({ id, ...v }));

  const unresolvedContributions = (myComments ?? []).filter(
    (c: any) => c.is_suggested_edit && c.status === "open"
  );

  // --- Civic report card: platform-engagement half is all computed
  // live from tables that already exist ("compute, don't duplicate" —
  // the same call made on the Meantime project) rather than tracked in
  // new counter columns that could drift out of sync.
  const myCommentIds = (myComments ?? []).map((c: any) => c.id);
  const parentIdsIRepliedTo = (myComments ?? [])
    .map((c: any) => c.parent_comment_id)
    .filter((id: string | null): id is string => Boolean(id));

  const [{ data: repliesToMe }, { data: peopleIRepliedTo }, { data: myPowerTreeUpdates }] =
    await Promise.all([
      myCommentIds.length > 0
        ? supabase.from("comments").select("author_id").in("parent_comment_id", myCommentIds)
        : Promise.resolve({ data: [] as { author_id: string }[] }),
      parentIdsIRepliedTo.length > 0
        ? supabase.from("comments").select("author_id").in("id", parentIdsIRepliedTo)
        : Promise.resolve({ data: [] as { author_id: string }[] }),
      supabase
        .from("power_tree_node_updates")
        .select("proposal_power_tree_nodes ( decision_maker_id, decision_makers ( name ) )")
        .eq("author_id", user.id),
    ]);

  const peopleConversedWithIds = [
    ...new Set(
      [...(repliesToMe ?? []), ...(peopleIRepliedTo ?? [])]
        .map((r: any) => r.author_id)
        .filter((id: string) => id !== user.id)
    ),
  ];
  const peopleConversedWith = peopleConversedWithIds.length;

  const { data: conversedProfiles } =
    peopleConversedWithIds.length > 0
      ? await supabase.from("profiles").select("id, display_name").in("id", peopleConversedWithIds)
      : { data: [] as { id: string; display_name: string | null }[] };

  const decisionMakerNamesById = new Map<string, string>();
  for (const u of (myPowerTreeUpdates ?? []) as any[]) {
    const dmId = u.proposal_power_tree_nodes?.decision_maker_id;
    const dmName = u.proposal_power_tree_nodes?.decision_makers?.name;
    if (dmId && dmName && !decisionMakerNamesById.has(dmId)) {
      decisionMakerNamesById.set(dmId, dmName);
    }
  }
  const decisionMakersEngaged = decisionMakerNamesById.size;

  const contributedProposals = new Map<string, string>();
  for (const c of (myComments ?? []) as any[]) {
    if (c.is_suggested_edit && c.proposals?.owner_id && c.proposals.owner_id !== user.id) {
      contributedProposals.set(c.proposal_id, c.proposals?.title ?? "A proposal");
    }
  }
  const contributedToOthers = contributedProposals.size;

  const { data: civicLogsRaw } = await supabase
    .from("civic_logs")
    .select("*")
    .eq("user_id", user.id)
    .order("occurred_on", { ascending: false });

  const { data: volunteerCategoryRows } = await supabase
    .from("volunteer_categories")
    .select("label")
    .order("label");
  const volunteerCategories = (volunteerCategoryRows ?? []).map((c: any) => c.label);

  const civicLogs: CivicLog[] = (civicLogsRaw ?? []).map((l: any) => ({
    id: l.id,
    logType: l.log_type,
    occurredOn: l.occurred_on,
    title: l.title,
    published: l.published,
    publishedLink: l.published_link,
    organization: l.organization,
    hours: l.hours,
    category: l.category,
    note: l.note,
    status: l.status,
  }));

  const publishedLogs = civicLogs.filter((l) => l.status === "published");
  const civicStats: CivicStats = {
    proposalsMade: myProposals?.length ?? 0,
    contributedToOthers,
    commentsMade: myComments?.length ?? 0,
    peopleConversedWith,
    decisionMakersEngaged,
    lettersWritten: publishedLogs.filter((l) => l.logType === "letter_to_editor").length,
    lettersPublished: publishedLogs.filter((l) => l.logType === "letter_to_editor" && l.published)
      .length,
    meetingsAttended: publishedLogs.filter((l) => l.logType === "community_meeting").length,
    volunteerHours: publishedLogs
      .filter((l) => l.logType === "volunteer_hours")
      .reduce((sum, l) => sum + (l.hours ?? 0), 0),
    testimonyGiven: publishedLogs.filter((l) => l.logType === "testimony").length,
  };

  // Feeds the "click a stat tile to see what's behind it" popups for
  // the platform-engagement half (the four self-reported log types
  // just use the `logs` list directly on the client, no extra data
  // needed for those).
  const civicDetails = {
    proposalsMade: (myProposals ?? []).map((p: any) => ({
      label: p.title,
      href: `/proposals/${p.id}`,
    })),
    contributedToOthers: [...contributedProposals.entries()].map(([id, title]) => ({
      label: title,
      href: `/proposals/${id}`,
    })),
    commentsMade: (myComments ?? []).map((c: any) => ({
      label: c.body.length > 80 ? `${c.body.slice(0, 80)}…` : c.body,
      sublabel: c.proposals?.title ?? undefined,
      href: `/proposals/${c.proposal_id}`,
    })),
    peopleConversedWith: (conversedProfiles ?? []).map((p: any) => ({
      label: p.display_name ?? "A resident",
      href: `/u/${p.id}`,
    })),
    decisionMakersEngaged: [...decisionMakerNamesById.values()].map((name) => ({ label: name })),
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

  // Fire-and-forget: bump the "last seen" marker to now so the NEXT
  // visit's banner only shows what's happened since this one. Uses the
  // value read above for this render's own banner, so this update
  // doesn't affect what's shown right now.
  await supabase
    .from("profiles")
    .update({ notifications_seen_at: new Date().toISOString() })
    .eq("id", user.id);

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Your profile</h1>
        <p className="mt-1 text-sm text-neutral-600">{user.email}</p>
      </div>

      {(newComments.length > 0 || unresolvedContributions.length > 0) && (
        <div className="space-y-2 rounded-lg border border-duty-purple/30 bg-duty-purple/5 p-3">
          {newComments.length > 0 && (
            <div>
              <p className="text-sm font-medium text-neutral-800">
                🔔 {newComments.length} new comment{newComments.length === 1 ? "" : "s"} since you
                were last here
              </p>
              <ul className="mt-1 space-y-0.5">
                {newComments.map((c) => (
                  <li key={c.id}>
                    <Link href={`/proposals/${c.proposalId}`} className="text-xs text-duty-purple underline">
                      {c.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {unresolvedContributions.length > 0 && (
            <div>
              <p className="text-sm font-medium text-neutral-800">
                ⏳ {unresolvedContributions.length} of your suggested edit
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

      <ProfileInfoCard profile={profile} />

      <CivicReportCard
        stats={civicStats}
        logs={civicLogs}
        details={civicDetails}
        categoryColor="#6C3FD1"
        volunteerCategories={volunteerCategories}
        displayName={profile?.display_name || "A resident"}
      />

      <div>
        <h2 className="text-lg font-semibold">Your proposals</h2>
        {/* Two-column grid of small "mini cards", split vertically —
            a square image on one side, title/category/type on the
            other — each tinted with its category color so the colors
            read at a glance again, not just on the thumbnail. */}
        <ul className="mt-3 grid grid-cols-2 gap-2.5">
          {myProposals?.map((p: any) => {
            const color = p.categories?.color ?? "#e5e5e5";
            return (
              <li
                key={p.id}
                className="flex items-center overflow-hidden rounded-lg border"
                style={{ backgroundColor: `${color}1a`, borderColor: `${color}66` }}
              >
                <div
                  className="h-16 w-16 shrink-0 overflow-hidden"
                  style={{ backgroundColor: color }}
                >
                  {p.image_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.image_url}
                      alt=""
                      className="h-full w-full object-cover"
                      style={{
                        objectPosition: `${p.image_position_x ?? 50}% ${p.image_position_y ?? 50}%`,
                      }}
                    />
                  )}
                </div>
                <div className="min-w-0 p-2">
                  <Link
                    href={`/proposals/${p.id}`}
                    className="block truncate text-sm font-semibold hover:underline"
                  >
                    {p.title}
                  </Link>
                  <p className="mt-0.5 truncate text-[10px] uppercase tracking-wide text-neutral-500">
                    {p.categories?.label}
                    {p.categories?.label ? " · " : ""}
                    {p.type}
                  </p>
                </div>
              </li>
            );
          })}
          {(!myProposals || myProposals.length === 0) && (
            <p className="col-span-2 text-sm text-neutral-500">
              You haven&apos;t posted a proposal yet.
            </p>
          )}
        </ul>
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
