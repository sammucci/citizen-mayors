"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  addPowerTreeNodeUpdate,
  approvePowerTreeNode,
  removePowerTreeNode,
  toggleNodeCompleted,
  updatePowerTreeNodeNote,
} from "@/app/proposals/actions";
import { readableTextColor } from "@/lib/readable-text-color";

type Update = {
  id: string;
  body: string;
  created_at: string;
  authorId: string;
  authorName: string;
  parentUpdateId: string | null;
  talkedTo: boolean;
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// Collapsed by default — name, role, and (if this is the top of the
// chain) a colored treatment marking it as the final decision-maker.
// Click the name to pop the full record open in a floating window
// (modal) instead of expanding in place: the running log of notes and
// civic dialogue about this decision-maker is the actual point of this
// feature, and a small inline accordion made it easy to add a note and
// then never see it again. The modal always shows the whole log, plus
// the role note and the add-note box, all in one place you can actually
// read.
//
// A node is one of two kinds now (node.nodeType): the original
// 'decision_maker' (a person/office), or 'funding' (money that has to
// be secured at this exact point in the chain — see grantUrl). Rather
// than a parallel set of styles, a funding node reuses the same
// name/subtitle slots (its "name" is the grant name or "Funding
// needed," its "subtitle" is the funder or "Source not yet
// identified") — the one visible difference is the 💰 badge below, so
// it still reads at a glance without a second, differently-shaped card
// type to learn.
export function PowerTreeNodeCard({
  proposalId,
  node,
  isFinal,
  isOwner,
  canContribute,
  categoryColor,
  dragHandleProps,
}: {
  proposalId: string;
  node: {
    id: string;
    nodeType: "decision_maker" | "funding";
    name: string;
    subtitle: string | null;
    note: string | null;
    status: "pending" | "approved";
    completed: boolean;
    submittedByName: string;
    submittedById: string | null;
    grantUrl: string | null;
    decisionMakerId: string | null;
    updates: Update[];
  };
  isFinal: boolean;
  isOwner: boolean;
  canContribute: boolean;
  categoryColor: string;
  dragHandleProps?: React.HTMLAttributes<HTMLSpanElement>;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingNote, setEditingNote] = useState(false);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  // Removing a node takes its whole note log with it, and it used to be
  // one click away right next to a card full of notes people worked hard
  // to add — an easy accidental-click target. Now the ✕ just opens an
  // inline "type delete to confirm" bar instead of removing immediately.
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const [removeConfirmText, setRemoveConfirmText] = useState("");
  const addUpdateFormRef = useRef<HTMLFormElement>(null);
  // Forces a real refetch after approve/remove/note actions, on top of
  // the resync-key fix, so a signed-in tab can never keep showing a
  // stale cached copy of the chain after one of these completes.
  const router = useRouter();
  const finalTextColor = readableTextColor(categoryColor);
  const isPending = node.status === "pending";
  const isFunding = node.nodeType === "funding";
  // Pending or final still get the two-row layout (badge row above the
  // name) same as before; a completed node now does too, so there's
  // somewhere for the "Done" badge to live without cramming it onto the
  // name/subtitle line.
  const showBadgeRow = isPending || isFinal || node.completed;

  // Top-level notes only, newest first (already the order they arrive
  // in) — replies are looked up per-parent below and rendered nested,
  // one level deep on purpose. A reply can't itself be replied to, so
  // there's no risk of the thread getting messy or hard to follow.
  const topLevel = node.updates.filter((u) => !u.parentUpdateId);
  const repliesByParent = new Map<string, Update[]>();
  for (const u of node.updates) {
    if (!u.parentUpdateId) continue;
    const list = repliesByParent.get(u.parentUpdateId) ?? [];
    list.push(u);
    repliesByParent.set(u.parentUpdateId, list);
  }
  for (const list of repliesByParent.values()) {
    list.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }
  // Unique people, not unique notes — someone flagging "talked to them"
  // on more than one note (e.g. an original note plus a later reply)
  // shouldn't inflate the count past the actual number of people who've
  // reached out.
  const talkedToCount = new Set(
    node.updates.filter((u) => u.talkedTo).map((u) => u.authorId)
  ).size;

  // Escape closes the modal, same as clicking the backdrop or the ✕ —
  // standard modal behavior, easy to miss if you only wire up clicks.
  useEffect(() => {
    if (!modalOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setModalOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [modalOpen]);

  function CompleteToggleButton({ className }: { className?: string }) {
    if (isPending || !isOwner) return null;
    return (
      <form
        action={async (formData) => {
          await toggleNodeCompleted(formData);
          router.refresh();
        }}
      >
        <input type="hidden" name="proposal_id" value={proposalId} />
        <input type="hidden" name="node_id" value={node.id} />
        <input type="hidden" name="completed" value={String(!node.completed)} />
        <button
          className={
            className ??
            `rounded-full border px-1.5 text-xs ${
              node.completed
                ? "border-green-600 bg-green-600 text-white"
                : "border-neutral-300 text-neutral-500 hover:border-green-600 hover:text-green-600"
            }`
          }
          title={node.completed ? "Mark as not done yet" : "Mark as done"}
        >
          ✔
        </button>
      </form>
    );
  }

  return (
    <>
      <li
        className={`overflow-hidden rounded-lg border bg-white ${isPending ? "border-dashed" : ""} ${
          node.completed ? "opacity-70" : ""
        }`}
        style={{
          borderColor: isPending
            ? "#a3a3a3"
            : node.completed
            ? "#16a34a"
            : isFinal
            ? categoryColor
            : `${categoryColor}55`,
        }}
      >
        <div
          className="p-3"
          style={
            isPending
              ? { backgroundColor: "#ffffff" }
              : { backgroundColor: isFinal ? categoryColor : `${categoryColor}1a` }
          }
        >
          {/* A badge (pending, final, or done) needs its own row above
              the name — cramming "Approve" + "✕" into the same row as
              the badge squeezed it onto two lines. But when there's NO
              badge (the common case — an ordinary, non-final,
              not-yet-done entry), splitting into two rows just left the
              drag dots stranded above an empty row with nothing next to
              them. So: two rows only when there's an actual badge to
              separate out; one aligned row otherwise. */}
          {showBadgeRow ? (
            <>
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                  {isOwner && (
                    <span
                      {...dragHandleProps}
                      className="shrink-0 cursor-grab select-none text-sm"
                      style={isFinal && !isPending ? { color: finalTextColor, opacity: 0.7 } : undefined}
                      title="Drag to reorder"
                      aria-hidden="true"
                    >
                      ⠿
                    </span>
                  )}
                  {isPending && (
                    <span className="inline-block shrink-0 whitespace-nowrap rounded-full border border-neutral-300 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-neutral-500">
                      ⏳ Pending approval
                    </span>
                  )}
                  {isFunding && (
                    <span
                      className="inline-block shrink-0 whitespace-nowrap rounded-full bg-black/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                      style={isFinal && !isPending ? { color: finalTextColor } : { color: "#a16207" }}
                    >
                      💰 Funding
                    </span>
                  )}
                  {isFinal && !isPending && (
                    <span
                      className="inline-block shrink-0 whitespace-nowrap rounded-full bg-black/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                      style={{ color: finalTextColor }}
                    >
                      🏁 Final decision-maker
                    </span>
                  )}
                  {node.completed && (
                    <span className="inline-block shrink-0 whitespace-nowrap rounded-full bg-green-600/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-green-700">
                      ✅ Done
                    </span>
                  )}
                </div>
                {isOwner && (
                  <div className="flex shrink-0 items-center gap-1">
                    {/* A full "Approve" text button here is what crowded
                        the pill in the first place — but cutting it
                        entirely (requiring the modal to approve) turned
                        out to be real friction of its own. A small
                        checkmark icon, the same size/shape as the ✕,
                        gets one-click approve back without the crowding. */}
                    {isPending && (
                      <form
                        action={async (formData) => {
                          await approvePowerTreeNode(formData);
                          router.refresh();
                        }}
                      >
                        <input type="hidden" name="proposal_id" value={proposalId} />
                        <input type="hidden" name="node_id" value={node.id} />
                        <button
                          className="rounded-full border border-neutral-300 px-1.5 text-xs text-neutral-500 hover:border-green-600 hover:text-green-600"
                          title="Approve this suggestion"
                        >
                          ✓
                        </button>
                      </form>
                    )}
                    <CompleteToggleButton />
                    <button
                      type="button"
                      onClick={() => setConfirmingRemove(true)}
                      className={`rounded-full border px-1.5 text-xs ${
                        isFinal && !isPending
                          ? ""
                          : "border-neutral-300 text-neutral-500 hover:border-duty-red hover:text-duty-red"
                      }`}
                      style={
                        isFinal && !isPending
                          ? { borderColor: `${finalTextColor}66`, color: finalTextColor, opacity: 0.8 }
                          : undefined
                      }
                      title={isPending ? "Reject this suggestion" : "Remove from this proposal's chain"}
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>
              {/* Approving is also available right in the modal (click
                  the card to open it) for anyone who wants the full
                  context — the note log, who suggested it — before
                  deciding. */}
              <button
                type="button"
                onClick={() => setModalOpen(true)}
                className="mt-1.5 block w-full min-w-0 text-left"
                title="View notes and civic dialogue"
              >
                <span
                  className="block truncate text-base font-semibold"
                  style={isFinal && !isPending ? { color: finalTextColor } : undefined}
                >
                  {node.name}
                </span>
                <span
                  className="block truncate text-xs"
                  style={
                    isFinal && !isPending
                      ? { color: finalTextColor, opacity: 0.8 }
                      : { color: "#737373" }
                  }
                >
                  {isPending ? `Suggested by ${node.submittedByName}` : node.subtitle}
                  {node.updates.length > 0
                    ? `${node.subtitle || isPending ? " · " : ""}${node.updates.length} note${
                        node.updates.length === 1 ? "" : "s"
                      }`
                    : ""}
                </span>
                {/* The actual point of this whole card — what this
                    decision-maker's role is in getting the proposal done
                    (e.g. "administer a permit"), or for a funding node,
                    what's needed and why — used to only be visible after
                    clicking into the modal. That defeated the purpose of
                    a high-level chain view: someone scanning the
                    collapsed cards couldn't tell "apply for permit" from
                    "administer permit" from "bring to council" without
                    opening every single one. */}
                {node.note && (
                  <span
                    className="mt-0.5 block truncate text-xs italic"
                    style={
                      isFinal && !isPending
                        ? { color: finalTextColor, opacity: 0.75 }
                        : { color: "#525252" }
                    }
                  >
                    {node.note}
                  </span>
                )}
              </button>
            </>
          ) : (
            <div className="flex items-start justify-between gap-2">
              <div className="flex min-w-0 items-start gap-2">
                {isOwner && (
                  <span
                    {...dragHandleProps}
                    className="mt-0.5 shrink-0 cursor-grab select-none text-sm"
                    title="Drag to reorder"
                    aria-hidden="true"
                  >
                    ⠿
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setModalOpen(true)}
                  className="min-w-0 text-left"
                  title="View notes and civic dialogue"
                >
                  <span className="block truncate text-base font-semibold">
                    {isFunding ? "💰 " : ""}
                    {node.name}
                  </span>
                  <span className="block truncate text-xs" style={{ color: "#737373" }}>
                    {node.subtitle}
                    {node.updates.length > 0
                      ? `${node.subtitle ? " · " : ""}${node.updates.length} note${
                          node.updates.length === 1 ? "" : "s"
                        }`
                      : ""}
                  </span>
                  {node.note && (
                    <span className="mt-0.5 block truncate text-xs italic text-neutral-600">
                      {node.note}
                    </span>
                  )}
                </button>
              </div>
              {isOwner && (
                <div className="flex shrink-0 items-center gap-1">
                  <CompleteToggleButton />
                  <button
                    type="button"
                    onClick={() => setConfirmingRemove(true)}
                    className="rounded-full border border-neutral-300 px-1.5 text-xs text-neutral-500 hover:border-duty-red hover:text-duty-red"
                    title="Remove from this proposal's chain"
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Removing a node takes its whole note log with it, so this
              isn't a one-click action anymore — has to actually type
              "delete" before the button will submit. */}
          {confirmingRemove && (
            <form
              action={async (formData) => {
                await removePowerTreeNode(formData);
                router.refresh();
              }}
              className="mt-2 space-y-1.5 rounded border border-duty-red/40 bg-duty-red/5 p-2"
            >
              <input type="hidden" name="proposal_id" value={proposalId} />
              <input type="hidden" name="node_id" value={node.id} />
              <p className="text-xs text-neutral-700">
                Type <span className="font-semibold">delete</span> to remove{" "}
                <span className="font-semibold">{node.name}</span>
                {isPending ? "" : " and all of its notes"}. This can&apos;t be undone.
              </p>
              <div className="flex items-center gap-1.5">
                <input
                  value={removeConfirmText}
                  onChange={(e) => setRemoveConfirmText(e.target.value)}
                  placeholder="delete"
                  autoFocus
                  className="min-w-0 flex-1 rounded border border-neutral-300 px-2 py-1 text-xs"
                />
                <button
                  disabled={removeConfirmText.trim().toLowerCase() !== "delete"}
                  className="shrink-0 rounded bg-duty-red px-2 py-1 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {isPending ? "Reject" : "Remove"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setConfirmingRemove(false);
                    setRemoveConfirmText("");
                  }}
                  className="shrink-0 rounded border border-neutral-300 px-2 py-1 text-xs text-neutral-600 hover:bg-neutral-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      </li>

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-lg bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="flex shrink-0 items-start justify-between gap-2 p-4"
              style={
                isPending
                  ? { backgroundColor: "#ffffff" }
                  : { backgroundColor: isFinal ? categoryColor : `${categoryColor}1a` }
              }
            >
              <div className="min-w-0">
                <div className="mb-1 flex flex-wrap items-center gap-1.5">
                  {isPending && (
                    <span className="inline-block rounded-full border border-neutral-300 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-neutral-500">
                      ⏳ Pending approval
                    </span>
                  )}
                  {isFunding && (
                    <span
                      className="inline-block rounded-full bg-black/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                      style={isFinal && !isPending ? { color: finalTextColor } : { color: "#a16207" }}
                    >
                      💰 Funding
                    </span>
                  )}
                  {isFinal && !isPending && (
                    <span
                      className="inline-block rounded-full bg-black/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                      style={{ color: finalTextColor }}
                    >
                      🏁 Final decision-maker
                    </span>
                  )}
                  {node.completed && (
                    <span className="inline-block rounded-full bg-green-600/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-green-700">
                      ✅ Done
                    </span>
                  )}
                </div>
                <h3
                  className="truncate text-lg font-semibold"
                  style={isFinal && !isPending ? { color: finalTextColor } : undefined}
                >
                  {node.name}
                </h3>
                <p
                  className="text-xs"
                  style={
                    isFinal && !isPending
                      ? { color: finalTextColor, opacity: 0.8 }
                      : { color: "#737373" }
                  }
                >
                  {isPending ? `Suggested by ${node.submittedByName}` : node.subtitle}
                </p>
                {isFunding && node.grantUrl && (
                  <a
                    href={node.grantUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs underline"
                    style={isFinal && !isPending ? { color: finalTextColor } : { color: "#a16207" }}
                  >
                    View funding program ↗
                  </a>
                )}
                {/* Only decision-maker nodes (not funding) have a real
                    profile to link to, and only once the node's actually
                    tied to a specific decision_makers row (a rare edge
                    case, but the "We the people" anchor and old data
                    could theoretically lack one). */}
                {!isFunding && node.decisionMakerId && (
                  <Link
                    href={`/decision-makers/${node.decisionMakerId}`}
                    className="block text-xs underline"
                    style={isFinal && !isPending ? { color: finalTextColor } : { color: "#6C3FD1" }}
                  >
                    View full profile ↗
                  </Link>
                )}
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  {isPending && isOwner && (
                    <form
                      action={async (formData) => {
                        await approvePowerTreeNode(formData);
                        router.refresh();
                      }}
                    >
                      <input type="hidden" name="proposal_id" value={proposalId} />
                      <input type="hidden" name="node_id" value={node.id} />
                      <button
                        className="rounded-full px-3 py-1 text-xs font-medium text-white"
                        style={{ backgroundColor: categoryColor }}
                      >
                        Approve this suggestion
                      </button>
                    </form>
                  )}
                  {!isPending && isOwner && (
                    <CompleteToggleButton
                      className={`rounded-full border px-3 py-1 text-xs font-medium ${
                        node.completed
                          ? "border-green-600 bg-green-600 text-white"
                          : "border-neutral-300 text-neutral-600 hover:border-green-600 hover:text-green-600"
                      }`}
                    />
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="shrink-0 rounded-full border px-2 py-0.5 text-sm"
                style={
                  isFinal && !isPending
                    ? { borderColor: `${finalTextColor}66`, color: finalTextColor }
                    : { borderColor: "#d4d4d4", color: "#525252" }
                }
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 overflow-y-auto p-4">
              {isOwner && !editingNote && (
                <button
                  type="button"
                  onClick={() => setEditingNote(true)}
                  className="text-xs text-neutral-500 underline hover:text-neutral-700"
                >
                  {node.note ? `Role: ${node.note}` : "Add a role note"}
                </button>
              )}
              {isOwner && editingNote && (
                <form
                  action={async (formData) => {
                    await updatePowerTreeNodeNote(formData);
                    setEditingNote(false);
                  }}
                  className="flex items-center gap-1.5"
                >
                  <input type="hidden" name="proposal_id" value={proposalId} />
                  <input type="hidden" name="node_id" value={node.id} />
                  <input
                    name="note"
                    defaultValue={node.note ?? ""}
                    placeholder="e.g. final sign-off"
                    className="min-w-0 flex-1 rounded border border-neutral-300 px-2 py-0.5 text-xs"
                    autoFocus
                  />
                  <button
                    className="shrink-0 rounded px-2 py-0.5 text-xs"
                    style={{ backgroundColor: categoryColor, color: finalTextColor }}
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingNote(false)}
                    className="shrink-0 rounded border border-neutral-300 px-2 py-0.5 text-xs text-neutral-600 hover:bg-neutral-50"
                  >
                    Cancel
                  </button>
                </form>
              )}
              {!isOwner && node.note && (
                <p className="text-xs text-neutral-500">Role: {node.note}</p>
              )}

              <div>
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-neutral-700">
                    Notes on working with them
                  </p>
                  {talkedToCount > 0 && (
                    <span className="text-xs font-medium text-neutral-600">
                      💬 {talkedToCount} {talkedToCount === 1 ? "person has" : "people have"}{" "}
                      talked to them
                    </span>
                  )}
                </div>
                <ul className="mt-1.5 space-y-1.5">
                  {topLevel.map((u) => (
                    <li key={u.id} className="rounded bg-neutral-50 p-2 text-xs text-neutral-700">
                      <div className="flex items-start justify-between gap-2">
                        <p className="whitespace-pre-wrap">{u.body}</p>
                        {u.talkedTo && (
                          <span className="shrink-0 rounded-full bg-[#bee1ca] px-2 py-0.5 text-[10px] font-medium text-neutral-700">
                            💬 Talked to them
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-neutral-400">
                        <span>
                          <Link href={`/u/${u.authorId}`} className="hover:underline">
                            {u.authorName}
                          </Link>{" "}
                          · {formatDate(u.created_at)}
                        </span>
                        {canContribute && (
                          <button
                            type="button"
                            onClick={() => setReplyingTo(replyingTo === u.id ? null : u.id)}
                            className="underline hover:text-neutral-600"
                          >
                            Reply
                          </button>
                        )}
                      </div>

                      {(repliesByParent.get(u.id) ?? []).length > 0 && (
                        <ul className="mt-1.5 space-y-1.5 border-l-2 border-neutral-200 pl-2.5">
                          {repliesByParent.get(u.id)!.map((r) => (
                            <li key={r.id}>
                              <div className="flex items-start justify-between gap-2">
                                <p className="whitespace-pre-wrap">{r.body}</p>
                                {r.talkedTo && (
                                  <span className="shrink-0 rounded-full bg-[#bee1ca] px-2 py-0.5 text-[10px] font-medium text-neutral-700">
                                    💬 Talked to them
                                  </span>
                                )}
                              </div>
                              <p className="mt-1 text-neutral-400">
                                <Link href={`/u/${r.authorId}`} className="hover:underline">
                                  {r.authorName}
                                </Link>{" "}
                                · {formatDate(r.created_at)}
                              </p>
                            </li>
                          ))}
                        </ul>
                      )}

                      {replyingTo === u.id && (
                        <form
                          action={async (formData) => {
                            await addPowerTreeNodeUpdate(formData);
                            setReplyingTo(null);
                          }}
                          className="mt-1.5 space-y-1"
                        >
                          <input type="hidden" name="proposal_id" value={proposalId} />
                          <input type="hidden" name="node_id" value={node.id} />
                          <input type="hidden" name="parent_update_id" value={u.id} />
                          <textarea
                            name="body"
                            required
                            rows={2}
                            autoFocus
                            placeholder="Reply — e.g. answer a question, add context"
                            className="input text-xs"
                          />
                          <label className="flex items-center gap-1.5 text-[11px] text-neutral-600">
                            <input type="checkbox" name="talked_to" />
                            I talked to them about this
                          </label>
                          <div className="flex gap-1.5">
                            <button
                              className="rounded px-2 py-0.5 text-[11px]"
                              style={{ backgroundColor: categoryColor, color: finalTextColor }}
                            >
                              Reply
                            </button>
                            <button
                              type="button"
                              onClick={() => setReplyingTo(null)}
                              className="rounded border border-neutral-300 px-2 py-0.5 text-[11px] text-neutral-600 hover:bg-neutral-50"
                            >
                              Cancel
                            </button>
                          </div>
                        </form>
                      )}
                    </li>
                  ))}
                  {topLevel.length === 0 && (
                    <li className="text-xs text-neutral-400">Nothing logged yet.</li>
                  )}
                </ul>
              </div>
            </div>

            {canContribute && (
              <form
                ref={addUpdateFormRef}
                action={async (formData) => {
                  await addPowerTreeNodeUpdate(formData);
                  addUpdateFormRef.current?.reset();
                }}
                className="shrink-0 space-y-1.5 border-t border-neutral-100 p-4"
              >
                <input type="hidden" name="proposal_id" value={proposalId} />
                <input type="hidden" name="node_id" value={node.id} />
                <textarea
                  name="body"
                  required
                  rows={2}
                  placeholder="When did you talk to them? What happened? Anything worth knowing for next time?"
                  className="input text-xs"
                />
                <label className="flex items-center gap-1.5 text-xs text-neutral-600">
                  <input type="checkbox" name="talked_to" />
                  I talked to them about this
                </label>
                <button
                  className="rounded px-2 py-1 text-xs"
                  style={{ backgroundColor: categoryColor, color: finalTextColor }}
                >
                  Add note
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
