import { createClient } from "@/lib/supabase/server";
import {
  addComment,
  addProposalTags,
  advanceVersion,
  flagUnresolved,
  react,
  removeProposalTag,
  suggestTag,
} from "@/app/proposals/actions";
import { CollapsibleReplies } from "@/components/collapsible-replies";
import { CommentBody } from "@/components/comment-body";
import { CoverImageControl } from "@/components/cover-image-control";
import { EditProposalForm } from "@/components/edit-proposal-form";
import { PowerTreeChain } from "@/components/power-tree-chain";
import { RepositionableImage } from "@/components/repositionable-image";
import { ReplyToggle } from "@/components/reply-toggle";
import { ResolveCommentForm } from "@/components/resolve-comment-form";
import { SortableComments } from "@/components/sortable-comments";
import { ThreadCollapser } from "@/components/thread-collapser";
import { ResettableForm } from "@/components/resettable-form";
import { VersionCarousel } from "@/components/version-carousel";
import { readableTextColor } from "@/lib/readable-text-color";
import { splitDecisionMakerLabel } from "@/lib/decision-maker-label";
import { statusColorClasses } from "@/lib/status-colors";

export const dynamic = "force-dynamic";

export default async function ProposalPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: proposal } = await supabase
    .from("proposals")
    .select(
      `*, categories ( label, color ), proposal_tags ( tag_id, tags ( label ) ),
       proposal_versions ( id, version_number, body, change_note, created_at )`
    )
    .eq("id", params.id)
    .single();

  if (!proposal) {
    return <p>Proposal not found.</p>;
  }

  const isOwner = user?.id === proposal.owner_id;
  const versions = (proposal.proposal_versions ?? [])
    .slice()
    .sort((a: any, b: any) => b.version_number - a.version_number);
  const currentVersion = versions[0];
  // Every action button on this page now uses the proposal's own
  // category color instead of a flat brand purple, so the whole page
  // feels tied to that category — falls back to the brand purple only
  // if a proposal somehow has no category color set.
  const categoryColor = proposal.categories?.color ?? "#6C3FD1";

  const { data: ownerProfile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", proposal.owner_id)
    .maybeSingle();

  // For the "Add a comment" box's avatar — was a generic 🙂 placeholder
  // for everyone, regardless of whether the signed-in person actually
  // has a photo uploaded.
  const { data: myProfile } = user
    ? await supabase
        .from("profiles")
        .select("display_name, avatar_url")
        .eq("id", user.id)
        .maybeSingle()
    : { data: null };

  const location =
    proposal.geography_scope === "citywide"
      ? "Citywide (applies to every council district)"
      : proposal.geography_scope === "council_district" && proposal.council_district
      ? `Council District ${proposal.council_district}`
      : proposal.geography_label ?? proposal.geography_scope;

  const { data: comments } = await supabase
    .from("comments")
    .select("*, profiles ( display_name, avatar_url )")
    .eq("proposal_id", proposal.id)
    .order("created_at", { ascending: true });

  // Comment-level votes. These live in the same reactions table as
  // proposal votes but with comment_id set instead of proposal_id, so
  // they can't be pulled in by the proposal_id filter above — has to be
  // its own query, scoped to just this proposal's comment ids.
  const commentIds = (comments ?? []).map((c) => c.id);
  const { data: commentReactions } =
    commentIds.length > 0
      ? await supabase
          .from("reactions")
          .select("comment_id, user_id, value")
          .in("comment_id", commentIds)
      : { data: [] as { comment_id: string; user_id: string; value: number }[] };

  const commentScores = new Map<string, number>();
  const myCommentVotes = new Map<string, number>();
  for (const r of commentReactions ?? []) {
    commentScores.set(r.comment_id, (commentScores.get(r.comment_id) ?? 0) + r.value);
    if (user && r.user_id === user.id) myCommentVotes.set(r.comment_id, r.value);
  }

  // Replies (true recursive threading — a reply can itself be replied
  // to, as deep as a conversation needs) grouped by their parent.
  // Sorting itself now happens client-side (SortableComments) instead
  // of via a ?sort= URL param — the underlying query stays oldest-first
  // ascending, which is what latestCommentId (right below) depends on to
  // find the single most recent comment overall.
  const topLevelComments = (comments ?? []).filter((c) => !c.parent_comment_id);
  const repliesByParent = new Map<string, NonNullable<typeof comments>>();
  for (const c of comments ?? []) {
    if (c.parent_comment_id) {
      const list = repliesByParent.get(c.parent_comment_id) ?? [];
      list.push(c);
      repliesByParent.set(c.parent_comment_id, list);
    }
  }

  // Total nested replies below a comment, recursively — used for the
  // "Show N more replies in this thread" count on ThreadCollapser, which
  // collapses a deep chain rather than just a wide one (that's what
  // CollapsibleReplies, above/below this, already handles).
  function countDescendants(commentId: string): number {
    const direct = repliesByParent.get(commentId) ?? [];
    let total = direct.length;
    for (const child of direct) total += countDescendants(child.id);
    return total;
  }
  // Only the single most recent comment on the whole proposal is still
  // editable by its author — once anything else gets posted after it,
  // editing locks so nobody can retroactively change context others have
  // already responded to.
  const latestCommentId =
    comments && comments.length > 0 ? comments[comments.length - 1].id : null;

  const { data: reactions } = await supabase
    .from("reactions")
    .select("user_id, value")
    .eq("proposal_id", proposal.id);
  const score = (reactions ?? []).reduce((sum, r) => sum + r.value, 0);
  const myVote = user
    ? reactions?.find((r) => r.user_id === user.id)?.value ?? null
    : null;

  const { data: allDecisionMakers } = await supabase
    .from("decision_makers")
    .select("id, name, kind")
    .order("name");

  const { data: powerTreeNodes } = await supabase
    .from("proposal_power_tree_nodes")
    .select(
      "id, note, parent_node_id, status, submitted_by, decision_makers ( name, kind ), profiles ( display_name ), power_tree_node_updates ( id, body, created_at, author_id, parent_update_id, talked_to, profiles ( display_name ) )"
    )
    .eq("proposal_id", proposal.id)
    .order("sort_order");

  const { data: allTags } = await supabase.from("tags").select("id, label").order("label");
  const appliedTagIds = new Set(
    (proposal.proposal_tags ?? []).map((pt: any) => pt.tag_id)
  );
  const availableTags = (allTags ?? []).filter((t) => !appliedTagIds.has(t.id));

  // Shown as muted "pending review" chips so people can see a tag's
  // already been requested instead of suggesting the same one twice.
  const { data: pendingTagSuggestions } = await supabase
    .from("tag_suggestions")
    .select("id, label")
    .eq("proposal_id", proposal.id)
    .eq("status", "pending")
    .order("created_at");

  const { data: allCategories } = await supabase
    .from("categories")
    .select("id, label")
    .order("sort_order");

  // Renders one comment's <li> — used for both top-level comments and
  // replies. Replies can themselves be replied to (true recursive
  // threading, not capped at one level) since real back-and-forth needs
  // more than a single reply layer. Each level indents a bit further via
  // the border-l wrapper below, so depth stays visible without needing
  // "replying to @X" labels.
  function renderComment(c: any, depth: number) {
    const score = commentScores.get(c.id) ?? 0;
    const myVoteOnComment = myCommentVotes.get(c.id) ?? null;
    const replies = repliesByParent.get(c.id) ?? [];

    return (
      <li key={c.id} className="rounded-lg border border-neutral-200 bg-white p-3">
        {/* Vote controls moved up here, inline with the name — used to
            sit in their own row below the comment text, which pushed
            everything after it (Reply, replies) further down for no
            real reason. */}
        <div className="flex items-center justify-between text-xs text-neutral-500">
          <span className="flex items-center gap-1.5">
            <span className="h-5 w-5 shrink-0 overflow-hidden rounded-full bg-duty-purple/10 text-duty-purple">
              {c.profiles?.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={c.profiles.avatar_url}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-[10px] font-semibold">
                  {(c.profiles?.display_name || "?").trim().charAt(0).toUpperCase()}
                </span>
              )}
            </span>
            {c.profiles?.display_name ?? "A resident"}
          </span>
          <div className="flex items-center gap-2">
            {c.is_suggested_edit && (
              <span className={`rounded-full px-2 py-0.5 ${statusColorClasses(c.status)}`}>
                {c.status.replace(/_/g, " ")}
              </span>
            )}
            <div className="flex items-center gap-1.5">
              <form action={react}>
                <input type="hidden" name="proposal_id" value={proposal.id} />
                <input type="hidden" name="comment_id" value={c.id} />
                <input type="hidden" name="value" value="1" />
                <button
                  aria-label="Upvote comment"
                  className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] transition-colors ${
                    myVoteOnComment === 1 ? "bg-green-600" : "bg-[#bee1ca] hover:bg-[#abcbb6]"
                  }`}
                >
                  <span
                    className="inline-block leading-none"
                    style={{ filter: "brightness(0) invert(1)" }}
                  >
                    👍
                  </span>
                </button>
              </form>
              <form action={react}>
                <input type="hidden" name="proposal_id" value={proposal.id} />
                <input type="hidden" name="comment_id" value={c.id} />
                <input type="hidden" name="value" value="-1" />
                <button
                  aria-label="Downvote comment"
                  className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] transition-colors ${
                    myVoteOnComment === -1 ? "bg-duty-red" : "bg-red-300 hover:bg-red-400"
                  }`}
                >
                  <span
                    className="inline-block leading-none"
                    style={{ filter: "brightness(0) invert(1)" }}
                  >
                    👎
                  </span>
                </button>
              </form>
              <span className="text-xs text-neutral-500">
                {score >= 0 ? `+${score}` : score}
              </span>
            </div>
          </div>
        </div>
        {/* Own, still-editable comment gets a client component that
            swaps its display text for the edit form in place, instead
            of showing the edit box as a separate duplicate underneath
            (per your drawing — that read as confusingly redundant).
            Everyone else just sees the plain static text as before. */}
        {user?.id === c.author_id && c.id === latestCommentId ? (
          <CommentBody
            key={c.body}
            comment={c}
            proposalId={proposal.id}
            categoryColor={categoryColor}
          />
        ) : (
          <>
            <p className="mt-1 text-sm">{c.body}</p>
            {c.is_suggested_edit && (
              <p className="mt-2 whitespace-pre-wrap rounded bg-neutral-50 p-2 text-sm text-neutral-700">
                {c.suggested_body}
              </p>
            )}
          </>
        )}
        {c.status_note && (
          <p className="mt-1 text-xs italic text-neutral-500">
            Contingency: {c.status_note}
          </p>
        )}
        {c.unresolved_flagged && (
          <p className="mt-1 text-xs text-amber-700">
            Flagged as still not addressed in the latest version.
          </p>
        )}

        {/* Resolve/flag controls on the left, Reply pinned to the right
            edge of the card — used to just flow inline next to each
            other on the left, which read like Reply belonged to the
            same cluster of "decide what happened here" controls instead
            of being its own separate action. */}
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {isOwner && c.is_suggested_edit && (
              <ResolveCommentForm
                key={`${c.status}-${c.status_note ?? ""}`}
                commentId={c.id}
                proposalId={proposal.id}
                status={c.status}
                statusNote={c.status_note}
              />
            )}

            {!isOwner && c.status !== "open" && !c.unresolved_flagged && (
              <form action={flagUnresolved}>
                <input type="hidden" name="comment_id" value={c.id} />
                <input type="hidden" name="proposal_id" value={proposal.id} />
                <button className="text-xs text-amber-700 underline">
                  Still not addressed
                </button>
              </form>
            )}
          </div>

          {user && (
            <ReplyToggle
              key={replies.length}
              proposalId={proposal.id}
              versionId={currentVersion?.id ?? ""}
              parentCommentId={c.id}
              categoryColor={categoryColor}
            />
          )}
        </div>

        {replies.length > 0 && (
          <ul className="mt-3 space-y-3 border-l-2 border-neutral-100 pl-3">
            {depth >= 1 ? (
              <ThreadCollapser count={countDescendants(c.id)}>
                <CollapsibleReplies
                  replies={replies.map((reply: any) => renderComment(reply, depth + 1))}
                />
              </ThreadCollapser>
            ) : (
              <CollapsibleReplies
                replies={replies.map((reply: any) => renderComment(reply, depth + 1))}
              />
            )}
          </ul>
        )}
      </li>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main column */}
        <div className="space-y-6 lg:col-span-2">
          <div>
            {/* "Filing tab" sticking up from the card's top-left corner,
                colored to the category — category + type now live here
                instead of as pills inside the card, per Samantha's
                drawing. Sits flush against the card with no gap, and the
                card's own top-left corner is left square (rounded-tl
                omitted) so the tab reads as physically attached to it,
                like a folder tab. */}
            <div
              className="inline-block whitespace-nowrap rounded-t-lg px-5 py-3 text-xs uppercase tracking-wide"
              style={{
                backgroundColor: proposal.categories?.color ?? "#a3a3a3",
                color: readableTextColor(proposal.categories?.color ?? "#a3a3a3"),
              }}
            >
              <span className="font-semibold">{proposal.categories?.label}</span>{" "}
              • <span className="font-normal">{proposal.type}</span>
            </div>
            <div
              className="overflow-hidden rounded-tr-lg rounded-br-lg rounded-bl-lg border bg-white"
              style={{ borderColor: `${proposal.categories?.color ?? "#d4d4d4"}aa` }}
            >
              {proposal.image_url && (
                <RepositionableImage
                  proposalId={proposal.id}
                  src={proposal.image_url}
                  alt=""
                  className="h-48 w-full object-cover sm:h-64"
                  initialX={proposal.image_position_x ?? 50}
                  initialY={proposal.image_position_y ?? 50}
                  isOwner={isOwner}
                >
                  {isOwner && (
                    <CoverImageControl
                      proposalId={proposal.id}
                      hasImage
                      categoryColor={categoryColor}
                      variant="overlay"
                    />
                  )}
                </RepositionableImage>
              )}
              <div className="p-4">
                <span className="text-xs text-neutral-500">📍 {location}</span>

                <h1 className="mt-2 text-2xl font-bold leading-tight sm:text-3xl">
                  {proposal.title}
                </h1>

                <div className="mt-3 flex items-center justify-between">
                  <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                    {proposal.type} by {ownerProfile?.display_name ?? "a resident"}
                  </span>
                  {/* Stacked back to buttons-on-top, count-below (how
                      this looked before, and how it's drawn in your
                      mockup) — a v22 restructure accidentally flattened
                      this into one horizontal row. */}
                  <div className="flex flex-col items-center gap-1">
                    <div className="flex items-center gap-2">
                      <form action={react}>
                        <input type="hidden" name="proposal_id" value={proposal.id} />
                        <input type="hidden" name="value" value="1" />
                        <button
                          aria-label="Upvote"
                          className={`flex h-9 w-9 items-center justify-center rounded-full text-base transition-colors ${
                            myVote === 1
                              ? "bg-green-600"
                              : "bg-[#bee1ca] hover:bg-[#abcbb6]"
                          }`}
                        >
                          {/* CSS trick: emoji render with their own
                              built-in color (thumbs-up is yellow by
                              default) — this forces it to solid white
                              always, in both the voted and unvoted
                              state, so no yellow ever shows up. The
                              colored circle (green/red) is what signals
                              voted vs. not, so the icon itself stays one
                              consistent white regardless. */}
                          <span
                            className="inline-block leading-none"
                            style={{ filter: "brightness(0) invert(1)" }}
                          >
                            👍
                          </span>
                        </button>
                      </form>
                      <form action={react}>
                        <input type="hidden" name="proposal_id" value={proposal.id} />
                        <input type="hidden" name="value" value="-1" />
                        <button
                          aria-label="Downvote"
                          className={`flex h-9 w-9 items-center justify-center rounded-full text-base transition-colors ${
                            myVote === -1
                              ? "bg-duty-red"
                              : "bg-red-300 hover:bg-red-400"
                          }`}
                        >
                          <span
                            className="inline-block leading-none"
                            style={{ filter: "brightness(0) invert(1)" }}
                          >
                            👎
                          </span>
                        </button>
                      </form>
                    </div>
                    <span className="text-xs font-medium text-neutral-600">
                      {score >= 0 ? `+${score}` : score} net support
                    </span>
                  </div>
                </div>

                {isOwner && (
                  // Owner-only utility toggles, grouped in a row and
                  // styled as small pill buttons instead of default
                  // <details> disclosure triangles — those read as plain
                  // browser dropdowns, which looked out of place next to
                  // everything else here being deliberately designed.
                  // list-none + hiding the ::-webkit-details-marker strips
                  // the native triangle; the <details>/<summary> behavior
                  // (click to expand) is unchanged underneath.
                  <div className="mt-3 flex flex-wrap gap-2">
                    {/* Once there's an image, the control to change it
                        lives as an overlay on the image itself (see
                        above) instead of duplicating it here too. */}
                    {!proposal.image_url && (
                      <CoverImageControl
                        proposalId={proposal.id}
                        hasImage={false}
                        categoryColor={categoryColor}
                        variant="pill"
                      />
                    )}

                    {/* Lets the owner change title/type/category/geography
                        after posting — previously the only way to fix a
                        wrong category was to delete the whole proposal
                        and repost it. Keyed to the fields it edits so it
                        remounts (picking up the saved values, and
                        re-syncing its internal scope state) right after a
                        successful save. */}
                    <details
                      key={`${proposal.title}-${proposal.category_id}-${proposal.geography_scope}-${proposal.geography_label}-${proposal.council_district}`}
                    >
                      <summary className="inline-flex list-none cursor-pointer items-center gap-1.5 rounded-full border border-neutral-300 px-2.5 py-1 text-xs text-neutral-600 hover:bg-neutral-50 [&::-webkit-details-marker]:hidden">
                        ✎ Edit proposal details
                      </summary>
                      <EditProposalForm
                        proposalId={proposal.id}
                        categories={allCategories ?? []}
                        categoryColor={categoryColor}
                        initial={{
                          title: proposal.title,
                          type: proposal.type,
                          category_id: proposal.category_id,
                          geography_scope: proposal.geography_scope,
                          geography_label: proposal.geography_label,
                          council_district: proposal.council_district,
                        }}
                      />
                    </details>
                  </div>
                )}
              </div>

              {/* Thin colored divider, same category color as the tab —
                  keeps the header and the version text as one continuous
                  card instead of two separate boxes, matching the mockup. */}
              <div
                className="h-[3px]"
                style={{ backgroundColor: proposal.categories?.color ?? "#e5e5e5" }}
              />

              <div className="p-4">
                {/* Keyed to how many versions exist so the carousel
                    remounts and its internal index recalculates to the
                    newest version right after "Advance to a new version"
                    — otherwise it kept showing whatever version was
                    selected before the publish, which read as if the new
                    version hadn't shown up. */}
                <VersionCarousel
                  key={versions.length}
                  versions={versions}
                  categoryColor={categoryColor}
                />
              </div>

              {/* Escalation flag buttons ("ready to bring to officials" /
                  "needs legal help") pulled per Samantha's request — she'd
                  rather have a "project stage" bar instead (proposal ->
                  discussion -> petition -> ready for officials, etc.) once
                  that's designed. See project notes. The proposal_flags
                  table and flagProposal action are left in place, just
                  unused, so nothing's lost if we bring a version of this
                  back. */}

              {isOwner && (
                // Moved from a separate box below the card into the
                // bottom of the card itself, styled as a solid color bar
                // instead of a plain white bordered panel, per Samantha's
                // new drawing — reads less "backend," more like a real
                // call-to-action. Being the last element inside the
                // overflow-hidden card means it automatically picks up
                // the card's rounded bottom corners whether collapsed or
                // expanded. Keyed to how many versions exist so it
                // collapses back down right after a successful publish.
                <details key={versions.length}>
                  <summary
                    className="flex cursor-pointer items-center justify-between gap-3 px-4 py-2.5 text-sm font-semibold"
                    style={{
                      backgroundColor: proposal.categories?.color ?? "#a3a3a3",
                      color: readableTextColor(proposal.categories?.color ?? "#a3a3a3"),
                    }}
                  >
                    <span>Advance to a new version</span>
                    <span
                      className="text-xs font-normal"
                      style={{
                        color: readableTextColor(proposal.categories?.color ?? "#a3a3a3"),
                        opacity: 0.75,
                      }}
                    >
                      Last updated:{" "}
                      {new Date(
                        currentVersion?.created_at ?? proposal.created_at
                      ).toLocaleDateString()}
                    </span>
                  </summary>
                  <div
                    className="p-4"
                    style={{ backgroundColor: `${proposal.categories?.color ?? "#e5e5e5"}33` }}
                  >
                    <p className="text-xs text-neutral-600">
                      Starts pre-filled with the current version's text —
                      edit what you need to, or select all and delete it to
                      start from scratch. Start a line with{" "}
                      <code className="rounded bg-white px-1">#</code> for a
                      heading, or{" "}
                      <code className="rounded bg-white px-1">##</code> for a
                      smaller one.
                    </p>
                    <ResettableForm
                      key={currentVersion?.id ?? "new"}
                      action={advanceVersion}
                      className="mt-3 space-y-3"
                    >
                      <input type="hidden" name="proposal_id" value={proposal.id} />
                      <textarea
                        name="body"
                        defaultValue={currentVersion?.body ?? proposal.body}
                        rows={8}
                        className="input font-mono text-sm"
                      />
                      <input
                        name="change_note"
                        placeholder="What changed and why?"
                        className="input"
                      />
                      <button
                        className="rounded-md px-3 py-1.5 text-sm"
                        style={{ backgroundColor: categoryColor, color: readableTextColor(categoryColor) }}
                      >
                        Publish new version
                      </button>
                    </ResettableForm>
                  </div>
                </details>
              )}
            </div>
          </div>

          <div>
            {/* Sorting happens entirely client-side now — no ?sort= URL
                param, no server round-trip. Each comment's already
                rendered here (renderComment), so this just hands the
                elements plus their sort keys to a component that
                reorders them in the browser (and owns the "Discussion"
                heading row too, so the sort toggle still sits right
                next to it like before). */}
            <SortableComments
              categoryColor={categoryColor}
              items={topLevelComments.map((c) => ({
                id: c.id,
                score: commentScores.get(c.id) ?? 0,
                createdAt: c.created_at,
                element: renderComment(c, 0),
              }))}
            />

            {user ? (
              // Keyed to the comment count so the whole form remounts
              // after a successful post — ResettableForm's reset() clears
              // the text, but a plain DOM reset doesn't close an already-
              // expanded <details>, so "Suggest specific replacement
              // language" was staying open. Remounting fixes both at once.
              <ResettableForm
                key={comments?.length ?? 0}
                action={addComment}
                className="mt-6 space-y-2 rounded-lg border border-neutral-200 bg-white p-3"
              >
                <input type="hidden" name="proposal_id" value={proposal.id} />
                <input type="hidden" name="version_id" value={currentVersion?.id ?? ""} />
                <div className="flex items-start gap-3">
                  {/* Was a generic 🙂 for every signed-in person regardless
                      of whether they'd actually uploaded a photo — now
                      shows their real avatar (or their initial, same
                      fallback style used everywhere else) in this same
                      size circle. */}
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-duty-purple/10 text-sm font-semibold text-duty-purple">
                    {myProfile?.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={myProfile.avatar_url}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      (myProfile?.display_name || "?").trim().charAt(0).toUpperCase()
                    )}
                  </div>
                  <textarea
                    name="body"
                    required
                    rows={3}
                    placeholder="Add a comment — be specific and respectful."
                    className="input"
                  />
                </div>
                {/* pl-11 = avatar (w-8) + gap (gap-3), so this lines up
                    with the textarea above instead of sitting flush left. */}
                <details className="pl-11">
                  <summary className="cursor-pointer text-xs text-neutral-500">
                    Suggest specific replacement language
                  </summary>
                  <textarea
                    name="suggested_body"
                    rows={4}
                    placeholder="Propose the exact language you'd suggest instead..."
                    className="input mt-2 font-mono text-xs"
                  />
                </details>
                <div className="flex justify-end">
                  <button
                    className="rounded-md px-3 py-1.5 text-sm"
                    style={{ backgroundColor: categoryColor, color: readableTextColor(categoryColor) }}
                  >
                    Post comment
                  </button>
                </div>
              </ResettableForm>
            ) : (
              <p className="mt-4 text-sm text-neutral-500">
                <a href="/login" className="underline">
                  Sign in
                </a>{" "}
                to comment, suggest edits, or vote.
              </p>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Wraps the spacer and the decision-chain box together with no
              gap between them (mirroring how the tab sits flush against
              the card in the main column), so this whole pair still
              behaves as a single item for the sidebar's own space-y-6
              spacing against the Tags box below. */}
          <div>
            {/* Invisible spacer that mirrors the filing tab's own
                padding/text/line-height (just without color or a visible
                background) — pushes the sidebar's first white box down
                by the same height as the tab, so the two white areas
                start flush with each other instead of the sidebar lining
                up with the top of the tab. Both this and the real tab are
                forced to a single line (whitespace-nowrap): the sidebar
                column is narrower than the main column, so without this
                a long category name could wrap here but not on the real
                tab, throwing the heights out of sync — that was the bug
                behind some proposals lining up and others not.
                overflow-hidden just keeps any invisible overflow from
                affecting page width. */}
            <div
              className="invisible overflow-hidden whitespace-nowrap px-5 py-3 text-xs uppercase tracking-wide"
              aria-hidden="true"
            >
              {proposal.categories?.label} • {proposal.type}
            </div>
          <div className="rounded-lg border border-neutral-200 bg-white p-4">
            <h2 className="text-base font-semibold">Decision chain</h2>
            <p className="mt-1 text-xs text-neutral-500">
              Who this proposal would move through, in order — climbing from
              "We the people" at the bottom up to the final decision-maker on
              top.
            </p>

            <PowerTreeChain
              proposalId={proposal.id}
              categoryColor={categoryColor}
              isOwner={isOwner}
              canContribute={Boolean(user)}
              decisionMakers={allDecisionMakers ?? []}
              nodesAscending={(powerTreeNodes ?? []).map((node: any) => {
                const { primary, subtitle } = splitDecisionMakerLabel(
                  node.decision_makers?.name ?? ""
                );
                return {
                  id: node.id,
                  name: primary,
                  subtitle: subtitle ?? node.decision_makers?.kind?.replace(/_/g, " ") ?? null,
                  note: node.note,
                  status: node.status === "pending" ? "pending" : "approved",
                  submittedByName: node.profiles?.display_name ?? "A resident",
                  updates: (node.power_tree_node_updates ?? [])
                    .slice()
                    .sort(
                      (a: any, b: any) =>
                        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                    )
                    .map((u: any) => ({
                      id: u.id,
                      body: u.body,
                      created_at: u.created_at,
                      authorId: u.author_id,
                      authorName: u.profiles?.display_name ?? "A resident",
                      parentUpdateId: u.parent_update_id ?? null,
                      talkedTo: Boolean(u.talked_to),
                    })),
                };
              })}
            />
          </div>
          </div>

          <div className="rounded-lg border border-neutral-200 bg-white p-4">
            <h2 className="text-base font-semibold">Tags</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {proposal.proposal_tags?.map((pt: any) => (
                <span
                  key={pt.tag_id}
                  className="flex items-center gap-1 rounded-full border px-3 py-1 text-xs text-neutral-800"
                  style={{
                    backgroundColor: `${proposal.categories?.color ?? "#e5e5e5"}33`,
                    borderColor: `${proposal.categories?.color ?? "#e5e5e5"}88`,
                  }}
                >
                  {pt.tags?.label}
                  {isOwner && (
                    <form action={removeProposalTag}>
                      <input type="hidden" name="proposal_id" value={proposal.id} />
                      <input type="hidden" name="tag_id" value={pt.tag_id} />
                      <button
                        className="flex h-4 w-4 items-center justify-center rounded-full text-neutral-500 hover:bg-white hover:text-duty-red"
                        title="Remove tag"
                        aria-label={`Remove ${pt.tags?.label}`}
                      >
                        ✕
                      </button>
                    </form>
                  )}
                </span>
              ))}
              {(!proposal.proposal_tags || proposal.proposal_tags.length === 0) && (
                <p className="text-xs text-neutral-500">No tags on this one.</p>
              )}
              {pendingTagSuggestions?.map((s) => (
                <span
                  key={s.id}
                  className="rounded-full border border-dashed border-neutral-300 px-3 py-1 text-xs text-neutral-500"
                  title="Suggested, waiting on review"
                >
                  {s.label} (pending review)
                </span>
              ))}
            </div>

            {isOwner && availableTags.length > 0 && (
              <div className="mt-3 border-t border-neutral-100 pt-3">
                <p className="text-xs text-neutral-500">Add a tag</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {availableTags.map((t) => (
                    <form key={t.id} action={addProposalTags}>
                      <input type="hidden" name="proposal_id" value={proposal.id} />
                      <input type="hidden" name="tag_ids" value={t.id} />
                      <button
                        className="rounded-full border border-neutral-300 px-3 py-1 text-xs text-neutral-600 hover:border-[var(--cat-color)] hover:text-[var(--cat-color)]"
                        style={{ ["--cat-color" as string]: categoryColor } as React.CSSProperties}
                      >
                        + {t.label}
                      </button>
                    </form>
                  ))}
                </div>
              </div>
            )}

            {/* Open to anyone signed in, not just the owner — unlike
                "Add a tag" above, this doesn't touch the real tags list.
                It just logs a request an admin reviews. */}
            {user && (
              <div className="mt-3 border-t border-neutral-100 pt-3">
                <p className="text-xs text-neutral-500">Don't see the right tag?</p>
                <ResettableForm
                  action={suggestTag}
                  className="mt-2 flex flex-wrap items-center gap-2"
                >
                  <input type="hidden" name="proposal_id" value={proposal.id} />
                  <input
                    name="label"
                    required
                    placeholder="Suggest a new tag..."
                    className="min-w-0 flex-1 rounded border border-neutral-300 px-2 py-1 text-xs"
                  />
                  <button className="shrink-0 rounded-full border border-neutral-300 px-3 py-1 text-xs text-neutral-600 hover:bg-neutral-50">
                    Suggest
                  </button>
                </ResettableForm>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
