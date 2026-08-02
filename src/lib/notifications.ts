import { createClient } from "@/lib/supabase/server";

export type NotificationIcon = "comment" | "link" | "approved" | "pending" | "tag";

export type NotificationItem = {
  id: string;
  icon: NotificationIcon;
  text: string;
  href: string;
};

// Everything that's happened "to you" since you last looked, in one
// place — new comments on your proposals or replies to your own
// comments (the original version of this, from the profile page), plus
// two decision-chain events Samantha specifically asked for: someone
// else adding a link to a chain you own, and one of your own suggested
// links getting approved on someone else's proposal. Read-only — does
// NOT bump notifications_seen_at itself; that's markNotificationsSeen()
// in app/actions.ts, called separately when the bell dropdown opens, so
// the same "what's new" list can be computed anywhere (bell, profile)
// without accidentally clearing itself on every render.
//
// `items` is the time-gated "what's new since you last looked" list —
// opening the bell marks it seen and it empties out. `pendingItems` is
// a DIFFERERENT kind of thing: an ongoing status ("this still needs
// you"), not an event, so it does NOT clear when the bell is opened —
// it only goes away when the underlying thing is actually resolved.
// This exists because of a real bug report: an open suggested edit on
// one of your own proposals wasn't showing as unresolved anywhere —
// the old version of this only ever showed "new comment" once, and
// then it vanished from the bell forever the moment you opened it,
// even though the suggestion itself was still sitting there unaddressed.
export async function getNotifications(
  supabase: ReturnType<typeof createClient>,
  userId: string
): Promise<{ items: NotificationItem[]; pendingItems: NotificationItem[]; lastSeenAt: string }> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("notifications_seen_at")
    .eq("id", userId)
    .maybeSingle();
  const lastSeenAt = profile?.notifications_seen_at ?? new Date(0).toISOString();

  const [{ data: myProposals }, { data: myComments }, { data: myFollowedTags }] = await Promise.all([
    supabase.from("proposals").select("id").eq("owner_id", userId),
    supabase.from("comments").select("id").eq("author_id", userId),
    supabase.from("profile_followed_tags").select("tag_id").eq("profile_id", userId),
  ]);
  const myProposalIds = (myProposals ?? []).map((p: any) => p.id);
  const myCommentIds = (myComments ?? []).map((c: any) => c.id);
  const followedTagIds = (myFollowedTags ?? []).map((t: any) => t.tag_id);

  const [
    { data: newCommentsOnMyProposals },
    { data: newRepliesToMe },
    { data: newLinksOnMyProposals },
    { data: myApprovedLinks },
    { data: openSuggestionsOnMyProposals },
    { data: pendingLinksOnMyProposals },
    { data: taggedMatches },
  ] = await Promise.all([
    myProposalIds.length > 0
      ? supabase
          .from("comments")
          .select("id, created_at, proposal_id, proposals ( title )")
          .in("proposal_id", myProposalIds)
          .neq("author_id", userId)
          .gt("created_at", lastSeenAt)
      : Promise.resolve({ data: [] as any[] }),
    myCommentIds.length > 0
      ? supabase
          .from("comments")
          .select("id, created_at, proposal_id, proposals ( title )")
          .in("parent_comment_id", myCommentIds)
          .neq("author_id", userId)
          .gt("created_at", lastSeenAt)
      : Promise.resolve({ data: [] as any[] }),
    myProposalIds.length > 0
      ? supabase
          .from("proposal_power_tree_nodes")
          .select("id, created_at, proposal_id, decision_makers ( name ), proposals ( title )")
          .in("proposal_id", myProposalIds)
          .neq("submitted_by", userId)
          .gt("created_at", lastSeenAt)
      : Promise.resolve({ data: [] as any[] }),
    supabase
      .from("proposal_power_tree_nodes")
      .select("id, updated_at, proposal_id, decision_makers ( name ), proposals ( title, owner_id )")
      .eq("submitted_by", userId)
      .eq("status", "approved")
      .gt("updated_at", lastSeenAt),
    // Persistent, not time-gated: any suggested edit someone else left
    // on one of your proposals that's still open. Deliberately not
    // filtered by lastSeenAt — this should keep showing up until you
    // actually resolve it, not just until you happen to open the bell.
    myProposalIds.length > 0
      ? supabase
          .from("comments")
          .select("id, proposal_id, proposals ( title )")
          .in("proposal_id", myProposalIds)
          .eq("is_suggested_edit", true)
          .eq("status", "open")
          .neq("author_id", userId)
      : Promise.resolve({ data: [] as any[] }),
    // Persistent, not time-gated — same fix as the suggested-edits case
    // right above, for the same underlying bug report: a decision-maker
    // someone else suggested for your proposal (which lands "pending"
    // until you approve it — see addPowerTreeNode) used to only ever
    // surface once, as the time-gated "was added to the decision chain"
    // item below. The moment the bell got opened, it vanished — even
    // though the suggestion itself was still sitting there, unapproved,
    // with no other place on the site that showed it.
    myProposalIds.length > 0
      ? supabase
          .from("proposal_power_tree_nodes")
          .select("id, proposal_id, decision_makers ( name ), proposals ( title )")
          .in("proposal_id", myProposalIds)
          .eq("status", "pending")
          .neq("submitted_by", userId)
      : Promise.resolve({ data: [] as any[] }),
    // The "crowdsourced expertise" alert (see profile_followed_tags in
    // schema.sql): a proposal now carries one of your followed tags,
    // whether it's brand-new or an existing proposal that just got
    // tagged with it — proposal_tags.created_at covers both cases with
    // one time gate, since a new proposal's initial tags get that same
    // timestamp at creation too. Filtered down to published, not-your-own
    // proposals in JS below (your own proposals aren't useful to alert
    // yourself about, and drafts shouldn't surface at all).
    followedTagIds.length > 0
      ? supabase
          .from("proposal_tags")
          .select("proposal_id, created_at, tags ( label ), proposals ( id, title, owner_id, published )")
          .in("tag_id", followedTagIds)
          .gt("created_at", lastSeenAt)
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const newCommentsById = new Map<string, { title: string; proposalId: string }>();
  for (const c of [...(newCommentsOnMyProposals ?? []), ...(newRepliesToMe ?? [])] as any[]) {
    newCommentsById.set(c.id, { title: c.proposals?.title ?? "A proposal", proposalId: c.proposal_id });
  }

  const items: NotificationItem[] = [];

  for (const [id, v] of newCommentsById.entries()) {
    items.push({
      id: `comment-${id}`,
      icon: "comment",
      text: `New comment on "${v.title}"`,
      href: `/proposals/${v.proposalId}`,
    });
  }

  for (const n of (newLinksOnMyProposals ?? []) as any[]) {
    items.push({
      id: `link-${n.id}`,
      icon: "link",
      text: `${n.decision_makers?.name ?? "Someone"} was added to the decision chain on "${n.proposals?.title ?? "a proposal"}"`,
      href: `/proposals/${n.proposal_id}`,
    });
  }

  // Tag-match alerts (crowdsourced expertise) — grouped by proposal so a
  // proposal that matches two or three followed tags at once shows up as
  // one item ("matches your interest in X, Y") instead of one row per
  // tag. Excludes your own proposals (nothing to discover about your own
  // work) and anything unpublished (a draft shouldn't alert anyone).
  const taggedMatchesByProposal = new Map<string, { title: string; labels: string[] }>();
  for (const m of (taggedMatches ?? []) as any[]) {
    const proposal = m.proposals;
    if (!proposal || !proposal.published || proposal.owner_id === userId) continue;
    const existing = taggedMatchesByProposal.get(proposal.id);
    const label = m.tags?.label ?? "a topic you follow";
    if (existing) {
      if (!existing.labels.includes(label)) existing.labels.push(label);
    } else {
      taggedMatchesByProposal.set(proposal.id, { title: proposal.title ?? "A proposal", labels: [label] });
    }
  }
  for (const [proposalId, v] of taggedMatchesByProposal.entries()) {
    items.push({
      id: `tag-${proposalId}`,
      icon: "tag",
      text: `"${v.title}" matches your interest in ${v.labels.join(", ")} — maybe you can add your expertise?`,
      href: `/proposals/${proposalId}`,
    });
  }

  // Only relevant when suggesting on someone ELSE's proposal — on your
  // own proposal, your own additions land approved immediately, so
  // there's nothing new to tell you here.
  for (const n of (myApprovedLinks ?? []) as any[]) {
    if (n.proposals?.owner_id === userId) continue;
    items.push({
      id: `approved-${n.id}`,
      icon: "approved",
      text: `Your suggestion to add ${n.decision_makers?.name ?? "a decision-maker"} to "${n.proposals?.title ?? "a proposal"}" was approved`,
      href: `/proposals/${n.proposal_id}`,
    });
  }

  const pendingItems: NotificationItem[] = [];
  const openSuggestionsByProposal = new Map<string, { title: string; count: number }>();
  for (const c of (openSuggestionsOnMyProposals ?? []) as any[]) {
    const existing = openSuggestionsByProposal.get(c.proposal_id);
    if (existing) {
      existing.count += 1;
    } else {
      openSuggestionsByProposal.set(c.proposal_id, {
        title: c.proposals?.title ?? "A proposal",
        count: 1,
      });
    }
  }
  for (const [proposalId, v] of openSuggestionsByProposal.entries()) {
    pendingItems.push({
      id: `pending-suggestion-${proposalId}`,
      icon: "pending",
      text:
        v.count === 1
          ? `1 suggested edit still awaiting your review on "${v.title}"`
          : `${v.count} suggested edits still awaiting your review on "${v.title}"`,
      href: `/proposals/${proposalId}`,
    });
  }

  const pendingLinksByProposal = new Map<string, { title: string; names: string[] }>();
  for (const n of (pendingLinksOnMyProposals ?? []) as any[]) {
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
  for (const [proposalId, v] of pendingLinksByProposal.entries()) {
    pendingItems.push({
      id: `pending-link-${proposalId}`,
      icon: "pending",
      text:
        v.names.length === 1
          ? `${v.names[0]} was suggested for the decision chain on "${v.title}" — still awaiting your approval`
          : `${v.names.length} decision-maker suggestions still awaiting your approval on "${v.title}"`,
      href: `/proposals/${proposalId}`,
    });
  }

  return { items, pendingItems, lastSeenAt };
}
