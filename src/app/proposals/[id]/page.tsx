import { createClient } from "@/lib/supabase/server";
import {
  addComment,
  addPowerTreeNode,
  addProposalTags,
  advanceVersion,
  flagProposal,
  flagUnresolved,
  movePowerTreeNode,
  react,
  removePowerTreeNode,
  removeProposalTag,
  resolveComment,
} from "@/app/proposals/actions";
import { DecisionMakerField } from "@/components/decision-maker-field";

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

  const { data: reactions } = await supabase
    .from("reactions")
    .select("user_id, value")
    .eq("proposal_id", proposal.id);
  const score = (reactions ?? []).reduce((sum, r) => sum + r.value, 0);
  const myVote = user
    ? reactions?.find((r) => r.user_id === user.id)?.value ?? null
    : null;

  const { data: flags } = await supabase
    .from("proposal_flags")
    .select("flag_type")
    .eq("proposal_id", proposal.id);
  const escalateCount = (flags ?? []).filter((f) => f.flag_type === "ready_to_escalate").length;
  const counselCount = (flags ?? []).filter((f) => f.flag_type === "needs_legal_counsel").length;

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
          <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
            <div
              className="h-3"
              style={{ backgroundColor: proposal.categories?.color ?? "#e5e5e5" }}
            />
            <div className="p-4">
              <span className="text-xs uppercase tracking-wide text-neutral-500">
                {proposal.type} · {proposal.categories?.label}
              </span>
              <h1 className="mt-1 text-2xl font-semibold">{proposal.title}</h1>
              <p className="mt-1 text-sm text-neutral-600">📍 {location}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <form action={react}>
              <input type="hidden" name="proposal_id" value={proposal.id} />
              <input type="hidden" name="value" value="1" />
              <button
                className={`rounded-md border px-4 py-2 text-lg ${
                  myVote === 1
                    ? "border-duty-purple bg-duty-purple text-white"
                    : "border-neutral-300 hover:bg-neutral-50"
                }`}
              >
                👍
              </button>
            </form>
            <form action={react}>
              <input type="hidden" name="proposal_id" value={proposal.id} />
              <input type="hidden" name="value" value="-1" />
              <button
                className={`rounded-md border px-4 py-2 text-lg ${
                  myVote === -1
                    ? "border-duty-red bg-duty-red text-white"
                    : "border-neutral-300 hover:bg-neutral-50"
                }`}
              >
                👎
              </button>
            </form>
            <span className="text-lg font-medium">
              {score >= 0 ? `+${score}` : score}
            </span>
            <span className="text-sm text-neutral-500">net support</span>
          </div>

          <div className="rounded-lg border border-neutral-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">
                Version {currentVersion?.version_number ?? proposal.current_version}
              </h2>
              {versions.length > 1 && (
                <span className="text-xs text-neutral-400">
                  {versions.length} versions total
                </span>
              )}
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm">
              {currentVersion?.body ?? proposal.body}
            </p>
          </div>

          {versions.length > 1 && (
            <details className="rounded-lg border border-neutral-200 bg-white p-4">
              <summary className="cursor-pointer text-sm font-semibold">
                Version history
              </summary>
              <ul className="mt-3 space-y-3">
                {versions.map((v: any) => (
                  <li key={v.id} className="border-t border-neutral-100 pt-3 first:border-t-0 first:pt-0">
                    <div className="flex items-center justify-between text-xs text-neutral-500">
                      <span className="font-medium text-neutral-700">
                        Version {v.version_number}
                        {v.version_number === currentVersion.version_number && " (current)"}
                      </span>
                      <span>{new Date(v.created_at).toLocaleDateString()}</span>
                    </div>
                    {v.change_note && (
                      <p className="mt-1 text-xs italic text-neutral-500">
                        What changed: {v.change_note}
                      </p>
                    )}
                    <details className="mt-1">
                      <summary className="cursor-pointer text-xs text-neutral-400">
                        View this version&apos;s text
                      </summary>
                      <p className="mt-1 whitespace-pre-wrap rounded bg-neutral-50 p-2 text-xs text-neutral-700">
                        {v.body}
                      </p>
                    </details>
                  </li>
                ))}
              </ul>
            </details>
          )}

          <div className="flex flex-wrap gap-3">
            <FlagButton
              proposalId={proposal.id}
              flagType="ready_to_escalate"
              label="🏛 I think this is ready to bring to officials"
              count={escalateCount}
            />
            <FlagButton
              proposalId={proposal.id}
              flagType="needs_legal_counsel"
              label="⚖️ I think this needs legal/policy help"
              count={counselCount}
            />
          </div>
          <p className="-mt-4 text-xs text-neutral-500">
            These are just a headcount of residents who feel that way — no
            email or legal request goes out automatically. Flagged proposals
            get reviewed by hand ahead of scheduled council conversations.
          </p>

          {isOwner && (
            <details className="rounded-lg border border-neutral-200 bg-white p-4">
              <summary className="cursor-pointer text-sm font-semibold">
                Advance to a new version (owner only)
              </summary>
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

                  {isOwner && c.is_suggested_edit && c.status === "open" && (
                    <form action={resolveComment} className="mt-2 flex flex-wrap items-center gap-2">
                      <input type="hidden" name="comment_id" value={c.id} />
                      <input type="hidden" name="proposal_id" value={proposal.id} />
                      <select name="status" className="shrink-0 rounded border border-neutral-300 px-2 py-1 text-xs">
                        <option value="accepted">Accept</option>
                        <option value="accepted_with_contingency">Accept with contingency</option>
                        <option value="rejected">Reject</option>
                      </select>
                      <input
                        name="status_note"
                        placeholder="Optional note (e.g. the contingency)"
                        className="min-w-[10rem] flex-1 rounded border border-neutral-300 px-2 py-1 text-xs"
                      />
                      <button className="shrink-0 rounded bg-duty-purple px-2 py-1 text-xs text-white">
                        Resolve
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
                </li>
              ))}
              {(!comments || comments.length === 0) && (
                <p className="text-sm text-neutral-500">
                  No comments yet — be the first to weigh in.
                </p>
              )}
            </ul>

            {user ? (
              <form action={addComment} className="mt-6 space-y-2 rounded-lg border border-neutral-200 bg-white p-3">
                <input type="hidden" name="proposal_id" value={proposal.id} />
                <input type="hidden" name="version_id" value={currentVersion?.id ?? ""} />
                <textarea
                  name="body"
                  required
                  rows={3}
                  placeholder="Add a comment — be specific and respectful."
                  className="input"
                />
                <details>
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
                <button className="rounded-md bg-duty-purple px-3 py-1.5 text-sm text-white">
                  Post comment
                </button>
              </form>
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
                <DecisionMakerField decisionMakers={allDecisionMakers ?? []} />
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
                  className="flex items-center gap-1 rounded-full px-3 py-1 text-xs text-neutral-800"
                  style={{ backgroundColor: `${proposal.categories?.color ?? "#e5e5e5"}33` }}
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

function FlagButton({
  proposalId,
  flagType,
  label,
  count,
}: {
  proposalId: string;
  flagType: string;
  label: string;
  count: number;
}) {
  return (
    <form action={flagProposal}>
      <input type="hidden" name="proposal_id" value={proposalId} />
      <input type="hidden" name="flag_type" value={flagType} />
      <button className="rounded-md border border-neutral-300 px-3 py-1 text-xs hover:bg-neutral-50">
        {label} ({count})
      </button>
    </form>
  );
}
