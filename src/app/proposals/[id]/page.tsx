import { createClient } from "@/lib/supabase/server";
import {
  addComment,
  addPowerTreeNode,
  advanceVersion,
  flagProposal,
  flagUnresolved,
  movePowerTreeNode,
  react,
  resolveComment,
} from "@/app/proposals/actions";

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
      `*, categories ( label, color ), proposal_tags ( tags ( label ) ),
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

  return (
    <div className="mx-auto max-w-2xl space-y-8">
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
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            {proposal.proposal_tags?.map((pt: any, i: number) => (
              <span key={i} className="rounded-full bg-neutral-100 px-2 py-0.5">
                #{pt.tags?.label}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <form action={react}>
          <input type="hidden" name="proposal_id" value={proposal.id} />
          <input type="hidden" name="value" value="1" />
          <button
            className={`rounded-md border px-4 py-2 text-lg ${
              myVote === 1
                ? "border-duty-blue bg-duty-blue text-white"
                : "border-neutral-300 hover:bg-neutral-50"
            }`}
          >
            ▲
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
            ▼
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
          label="🏛 Ready to bring to officials"
          count={escalateCount}
        />
        <FlagButton
          proposalId={proposal.id}
          flagType="needs_legal_counsel"
          label="⚖️ Needs legal/policy help"
          count={counselCount}
        />
      </div>
      <p className="-mt-4 text-xs text-neutral-500">
        Flags are visible signals only — nothing gets auto-sent to officials
        or counsel. Enough flags surface a proposal for review ahead of
        scheduled council conversations.
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
            <button className="rounded-md bg-duty-blue px-3 py-1.5 text-sm text-white">
              Publish new version
            </button>
          </form>
        </details>
      )}

      <div>
        <h2 className="text-lg font-semibold">Who'd actually decide this</h2>
        <p className="mt-1 text-sm text-neutral-600">
          The decision-making chain for this proposal — who it would move
          through, in order.
        </p>

        <datalist id="decision-makers-list">
          {allDecisionMakers?.map((dm) => (
            <option key={dm.id} value={dm.name} />
          ))}
        </datalist>

        <ul className="mt-3 space-y-2">
          {powerTreeNodes?.map((node: any, i: number) => (
            <li
              key={node.id}
              className="flex items-center justify-between rounded-lg border border-neutral-200 bg-white p-3 text-sm"
            >
              <div>
                <span className="font-medium">{node.decision_makers?.name}</span>
                <span className="ml-2 text-xs uppercase text-neutral-400">
                  {node.decision_makers?.kind?.replace(/_/g, " ")}
                </span>
                {node.note && <p className="mt-1 text-xs text-neutral-500">{node.note}</p>}
              </div>
              {isOwner && (
                <div className="flex gap-1">
                  <form action={movePowerTreeNode}>
                    <input type="hidden" name="proposal_id" value={proposal.id} />
                    <input type="hidden" name="node_id" value={node.id} />
                    <input type="hidden" name="direction" value="up" />
                    <button
                      disabled={i === 0}
                      className="rounded border border-neutral-300 px-2 py-1 text-xs disabled:opacity-30"
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
                      className="rounded border border-neutral-300 px-2 py-1 text-xs disabled:opacity-30"
                    >
                      ▼
                    </button>
                  </form>
                </div>
              )}
            </li>
          ))}
          {(!powerTreeNodes || powerTreeNodes.length === 0) && (
            <p className="text-sm text-neutral-500">Not mapped out yet.</p>
          )}
        </ul>

        {isOwner && (
          <form action={addPowerTreeNode} className="mt-3 flex flex-wrap items-end gap-2 rounded-lg border border-neutral-200 bg-white p-3">
            <input type="hidden" name="proposal_id" value={proposal.id} />
            <div>
              <label className="block text-xs text-neutral-500">Decision-maker</label>
              <input
                name="decision_maker_name"
                list="decision-makers-list"
                placeholder="Start typing to search, or add a new one"
                className="rounded border border-neutral-300 px-2 py-1 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-neutral-500">If new: kind</label>
              <select name="kind" className="rounded border border-neutral-300 px-2 py-1 text-sm">
                <option value="elected_official">Elected official</option>
                <option value="department">City department</option>
                <option value="board_commission">Board / commission</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-neutral-500">Role in this decision (optional)</label>
              <input
                name="note"
                placeholder="e.g. final sign-off"
                className="rounded border border-neutral-300 px-2 py-1 text-sm"
              />
            </div>
            <button className="rounded bg-duty-blue px-3 py-1.5 text-sm text-white">
              Add
            </button>
          </form>
        )}
      </div>

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
                  <select name="status" className="rounded border border-neutral-300 px-2 py-1 text-xs">
                    <option value="accepted">Accept</option>
                    <option value="accepted_with_contingency">Accept with contingency</option>
                    <option value="rejected">Reject</option>
                  </select>
                  <input
                    name="status_note"
                    placeholder="Optional note (e.g. the contingency)"
                    className="rounded border border-neutral-300 px-2 py-1 text-xs"
                  />
                  <button className="rounded bg-duty-blue px-2 py-1 text-xs text-white">
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
                Suggest specific replacement language instead
              </summary>
              <textarea
                name="suggested_body"
                rows={4}
                placeholder="Propose the exact language you'd suggest instead..."
                className="input mt-2 font-mono text-xs"
              />
            </details>
            <button className="rounded-md bg-duty-blue px-3 py-1.5 text-sm text-white">
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
