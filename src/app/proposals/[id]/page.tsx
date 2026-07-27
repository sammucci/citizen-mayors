import { createClient } from "@/lib/supabase/server";
import {
  addComment,
  addPowerTreeNode,
  addProposalTags,
  advanceVersion,
  editComment,
  flagUnresolved,
  movePowerTreeNode,
  react,
  removePowerTreeNode,
  removeProposalTag,
  resolveComment,
  updatePowerTreeNodeNote,
  updateProposalImage,
} from "@/app/proposals/actions";
import { DecisionMakerField } from "@/components/decision-maker-field";
import { ResettableForm } from "@/components/resettable-form";
import { VersionCarousel } from "@/components/version-carousel";

export const dynamic = "force-dynamic";

// Council-roster entries are stored as "Name (Role, District X)" — this
// splits that into a bold primary name and a smaller subtitle underneath,
// instead of showing the whole string as one flat bolded line.
function splitDecisionMakerLabel(name: string): { primary: string; subtitle: string | null } {
  const match = name.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  if (match) {
    return { primary: match[1].trim(), subtitle: match[2].trim() };
  }
  return { primary: name, subtitle: null };
}

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

  const { data: ownerProfile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", proposal.owner_id)
    .maybeSingle();

  const location =
    proposal.geography_scope === "citywide"
      ? "Citywide (applies to every council district)"
      : proposal.geography_scope === "council_district" && proposal.council_district
      ? `Council District ${proposal.council_district}`
      : proposal.geography_label ?? proposal.geography_scope;

  const { data: comments } = await supabase
    .from("comments")
    .select("*, profiles ( display_name )")
    .eq("proposal_id", proposal.id)
    .order("created_at", { ascending: true });
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
    .select("id, note, parent_node_id, decision_makers ( name, kind )")
    .eq("proposal_id", proposal.id)
    .order("sort_order");

  const { data: allTags } = await supabase.from("tags").select("id, label").order("label");
  const appliedTagIds = new Set(
    (proposal.proposal_tags ?? []).map((pt: any) => pt.tag_id)
  );
  const availableTags = (allTags ?? []).filter((t) => !appliedTagIds.has(t.id));

  return (
    <div className="mx-auto max-w-5xl">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main column */}
        <div className="space-y-6 lg:col-span-2">
          <div
            className="overflow-hidden rounded-lg border bg-white"
            style={{ borderColor: `${proposal.categories?.color ?? "#d4d4d4"}aa` }}
          >
            {proposal.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={proposal.image_url}
                alt=""
                className="h-48 w-full object-cover sm:h-64"
              />
            ) : (
              <div
                className="h-3"
                style={{ backgroundColor: proposal.categories?.color ?? "#e5e5e5" }}
              />
            )}
            <div className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className="rounded-full px-2 py-0.5 text-xs font-medium text-neutral-700"
                    style={{ backgroundColor: `${proposal.categories?.color ?? "#e5e5e5"}33` }}
                  >
                    {proposal.categories?.label}
                  </span>
                  <span className="text-xs uppercase tracking-wide text-neutral-400">
                    {proposal.type}
                  </span>
                </div>
                <span className="shrink-0 text-xs text-neutral-500">📍 {location}</span>
              </div>

              <h1 className="mt-2 text-2xl font-bold leading-tight sm:text-3xl">
                {proposal.title}
              </h1>

              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs text-neutral-500">
                  by {ownerProfile?.display_name ?? "a resident"}
                </span>
                <div className="flex items-center gap-2">
                  <form action={react}>
                    <input type="hidden" name="proposal_id" value={proposal.id} />
                    <input type="hidden" name="value" value="1" />
                    <button
                      aria-label="Upvote"
                      className={`flex h-9 w-9 items-center justify-center rounded-full text-base transition-colors ${
                        myVote === 1
                          ? "bg-green-600"
                          : "bg-green-100 hover:bg-green-200"
                      }`}
                    >
                      {/* CSS trick: emoji render with their own built-in
                          color (thumbs-up is yellow by default) — this
                          forces it to solid white so it reads as a clean
                          icon on the colored circle instead of clashing. */}
                      <span
                        className="inline-block"
                        style={
                          myVote === 1
                            ? { filter: "brightness(0) invert(1)" }
                            : undefined
                        }
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
                          : "bg-red-100 hover:bg-red-200"
                      }`}
                    >
                      <span
                        className="inline-block"
                        style={
                          myVote === -1
                            ? { filter: "brightness(0) invert(1)" }
                            : undefined
                        }
                      >
                        👎
                      </span>
                    </button>
                  </form>
                  <span className="text-sm font-medium">
                    {score >= 0 ? `+${score}` : score} net support
                  </span>
                </div>
              </div>

              {isOwner && (
                <details className="mt-3">
                  <summary className="cursor-pointer text-xs text-neutral-400 hover:text-neutral-600">
                    {proposal.image_url ? "Change cover image" : "Add a cover image"}
                  </summary>
                  <form
                    action={updateProposalImage}
                    className="mt-2 flex flex-wrap items-center gap-2"
                  >
                    <input type="hidden" name="proposal_id" value={proposal.id} />
                    <input type="file" name="image" accept="image/*" className="text-xs" />
                    <button className="rounded bg-duty-purple px-3 py-1 text-xs text-white">
                      Upload
                    </button>
                  </form>
                </details>
              )}
            </div>

            {/* Thin colored divider, same category color as the top —
                keeps the header and the version text as one continuous
                card instead of two separate boxes, matching the mockup. */}
            <div
              className="h-[3px]"
              style={{ backgroundColor: proposal.categories?.color ?? "#e5e5e5" }}
            />

            <div className="p-4">
              <VersionCarousel versions={versions} />
            </div>
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
            // Keyed to how many versions exist so the whole panel remounts
            // (and collapses back down) right after a successful publish —
            // otherwise it just sat open with what looked like the same
            // text still in the box, and there was no clear sign it had
            // actually worked.
            <details
              key={versions.length}
              className="overflow-hidden rounded-lg border border-neutral-200"
            >
              <summary className="flex cursor-pointer items-center justify-between gap-3 bg-white p-4 text-sm font-semibold">
                <span>Advance to a new version (owner only)</span>
                <span className="text-xs font-normal text-neutral-400">
                  Last updated:{" "}
                  {new Date(
                    currentVersion?.created_at ?? proposal.created_at
                  ).toLocaleDateString()}
                </span>
              </summary>
              <div
                className="p-4"
                style={{ backgroundColor: `${proposal.categories?.color ?? "#e5e5e5"}22` }}
              >
              <p className="text-xs text-neutral-600">
                Starts pre-filled with the current version's text — edit
                what you need to, or select all and delete it to start
                from scratch.
              </p>
              <form action={advanceVersion} className="mt-3 space-y-3">
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
                <button className="rounded-md bg-duty-purple px-3 py-1.5 text-sm text-white">
                  Publish new version
                </button>
              </form>
              </div>
            </details>
          )}

          <div>
            <h2 className="text-lg font-semibold">Discussion</h2>
            <ul className="mt-3 space-y-4">
              {comments?.map((c) => (
                <li key={c.id} className="rounded-lg border border-neutral-200 bg-white p-3">
                  <div className="flex items-center justify-between text-xs text-neutral-500">
                    <span>{c.profiles?.display_name ?? "A resident"}</span>
                    {c.is_suggested_edit && (
                      <span className="rounded-full bg-blue-50 px-2 py-0.5 text-blue-700">
                        Suggested edit · {c.status.replace(/_/g, " ")}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm">{c.body}</p>
                  {c.is_suggested_edit && (
                    <p className="mt-2 whitespace-pre-wrap rounded bg-neutral-50 p-2 text-sm text-neutral-700">
                      {c.suggested_body}
                    </p>
                  )}
                  {c.status_note && (
                    <p className="mt-1 text-xs italic text-neutral-500">
                      Owner note: {c.status_note}
                    </p>
                  )}
                  {c.unresolved_flagged && (
                    <p className="mt-1 text-xs text-amber-700">
                      Flagged as still not addressed in the latest version.
                    </p>
                  )}

                  {isOwner && c.is_suggested_edit && (
                    <form action={resolveComment} className="mt-2 flex flex-wrap items-center gap-2">
                      <input type="hidden" name="comment_id" value={c.id} />
                      <input type="hidden" name="proposal_id" value={proposal.id} />
                      <select
                        name="status"
                        defaultValue={c.status === "open" ? "accepted" : c.status}
                        className="shrink-0 rounded border border-neutral-300 px-2 py-1 text-xs"
                      >
                        <option value="accepted">Accept</option>
                        <option value="accepted_with_contingency">Accept with contingency</option>
                        <option value="rejected">Reject</option>
                      </select>
                      <input
                        name="status_note"
                        defaultValue={c.status_note ?? ""}
                        placeholder="Optional note (e.g. the contingency)"
                        className="min-w-[10rem] flex-1 rounded border border-neutral-300 px-2 py-1 text-xs"
                      />
                      <button className="shrink-0 rounded bg-duty-purple px-2 py-1 text-xs text-white">
                        {c.status === "open" ? "Resolve" : "Change decision"}
                      </button>
                    </form>
                  )}

                  {!isOwner && c.status !== "open" && !c.unresolved_flagged && (
                    <form action={flagUnresolved} className="mt-2">
                      <input type="hidden" name="comment_id" value={c.id} />
                      <input type="hidden" name="proposal_id" value={proposal.id} />
                      <button className="text-xs text-amber-700 underline">
                        Still not addressed
                      </button>
                    </form>
                  )}

                  {user?.id === c.author_id && c.id === latestCommentId && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-xs text-neutral-400 hover:text-neutral-600">
                        Edit your comment
                      </summary>
                      <form action={editComment} className="mt-2 space-y-2">
                        <input type="hidden" name="comment_id" value={c.id} />
                        <input type="hidden" name="proposal_id" value={proposal.id} />
                        <textarea
                          name="body"
                          defaultValue={c.body}
                          rows={2}
                          className="input text-sm"
                        />
                        {c.is_suggested_edit && (
                          <textarea
                            name="suggested_body"
                            defaultValue={c.suggested_body ?? ""}
                            rows={3}
                            className="input font-mono text-xs"
                          />
                        )}
                        <button className="rounded bg-duty-purple px-2 py-1 text-xs text-white">
                          Save edit
                        </button>
                      </form>
                    </details>
                  )}
                </li>
              ))}
              {(!comments || comments.length === 0) && (
                <p className="text-sm text-neutral-500">
                  No comments yet — be the first to weigh in.
                </p>
              )}
            </ul>

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
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-200 text-sm">
                    🙂
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
                  <button className="rounded-md bg-duty-purple px-3 py-1.5 text-sm text-white">
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
          <div className="rounded-lg border border-neutral-200 bg-white p-4">
            <h2 className="text-base font-semibold">Decision chain</h2>
            <p className="mt-1 text-xs text-neutral-500">
              Who this proposal would move through, in order.
            </p>

            <ul className="mt-3 space-y-2">
              {powerTreeNodes?.map((node: any, i: number) => {
                const { primary, subtitle } = splitDecisionMakerLabel(
                  node.decision_makers?.name ?? ""
                );
                return (
                <li
                  key={node.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-sm"
                >
                  <div>
                    <span className="text-base font-semibold">{primary}</span>
                    <span className="block text-xs font-normal text-neutral-500">
                      {subtitle ?? node.decision_makers?.kind?.replace(/_/g, " ")}
                    </span>
                    {node.note && <p className="mt-1 text-xs text-neutral-500">{node.note}</p>}
                    {isOwner && (
                      <details key={node.note ?? ""} className="mt-1">
                        <summary className="cursor-pointer text-xs text-neutral-400 hover:text-neutral-600">
                          Edit role
                        </summary>
                        <form
                          action={updatePowerTreeNodeNote}
                          className="mt-1 flex items-center gap-1"
                        >
                          <input type="hidden" name="proposal_id" value={proposal.id} />
                          <input type="hidden" name="node_id" value={node.id} />
                          <input
                            name="note"
                            defaultValue={node.note ?? ""}
                            placeholder="e.g. final sign-off"
                            className="min-w-0 flex-1 rounded border border-neutral-300 px-2 py-0.5 text-xs"
                          />
                          <button className="shrink-0 rounded bg-duty-purple px-2 py-0.5 text-xs text-white">
                            Save
                          </button>
                        </form>
                      </details>
                    )}
                  </div>
                  {isOwner && (
                    <div className="flex shrink-0 flex-col gap-1">
                      <form action={movePowerTreeNode}>
                        <input type="hidden" name="proposal_id" value={proposal.id} />
                        <input type="hidden" name="node_id" value={node.id} />
                        <input type="hidden" name="direction" value="up" />
                        <button
                          disabled={i === 0}
                          className="rounded border border-neutral-300 bg-white px-2 py-0.5 text-xs disabled:opacity-30"
                        >
                          ▲
                        </button>
                      </form>
                      <form action={movePowerTreeNode}>
                        <input type="hidden" name="proposal_id" value={proposal.id} />
                        <input type="hidden" name="node_id" value={node.id} />
                        <input type="hidden" name="direction" value="down" />
                        <button
                          disabled={i === powerTreeNodes.length - 1}
                          className="rounded border border-neutral-300 bg-white px-2 py-0.5 text-xs disabled:opacity-30"
                        >
                          ▼
                        </button>
                      </form>
                      <form action={removePowerTreeNode}>
                        <input type="hidden" name="proposal_id" value={proposal.id} />
                        <input type="hidden" name="node_id" value={node.id} />
                        <button
                          className="rounded border border-neutral-300 bg-white px-2 py-0.5 text-xs text-neutral-500 hover:border-duty-red hover:text-duty-red"
                          title="Remove from this proposal's chain"
                        >
                          ✕
                        </button>
                      </form>
                    </div>
                  )}
                </li>
                );
              })}
              {(!powerTreeNodes || powerTreeNodes.length === 0) && (
                <p className="text-sm text-neutral-500">Not mapped out yet.</p>
              )}
            </ul>

            {isOwner && (
              <form action={addPowerTreeNode} className="mt-3 space-y-2 rounded-lg border border-neutral-200 bg-neutral-50 p-3">
                <input type="hidden" name="proposal_id" value={proposal.id} />
                {/* Keyed to the node count so this fully remounts (and
                    clears back to blank) right after a successful add —
                    it's a controlled component internally, so a plain
                    form.reset() wouldn't touch its React state. */}
                <DecisionMakerField
                  key={powerTreeNodes?.length ?? 0}
                  decisionMakers={allDecisionMakers ?? []}
                />
                <button className="w-full rounded bg-duty-purple px-3 py-1.5 text-sm text-white">
                  + Add decision maker
                </button>
              </form>
            )}
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
            </div>

            {isOwner && availableTags.length > 0 && (
              <div className="mt-3 border-t border-neutral-100 pt-3">
                <p className="text-xs text-neutral-500">Add a tag</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {availableTags.map((t) => (
                    <form key={t.id} action={addProposalTags}>
                      <input type="hidden" name="proposal_id" value={proposal.id} />
                      <input type="hidden" name="tag_ids" value={t.id} />
                      <button className="rounded-full border border-neutral-300 px-3 py-1 text-xs text-neutral-600 hover:border-duty-purple hover:text-duty-purple">
                        + {t.label}
                      </button>
                    </form>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
