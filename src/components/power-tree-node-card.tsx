"use client";

import { useEffect, useRef, useState } from "react";
import {
  addPowerTreeNodeUpdate,
  approvePowerTreeNode,
  removePowerTreeNode,
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
    name: string;
    subtitle: string | null;
    note: string | null;
    status: "pending" | "approved";
    submittedByName: string;
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
  const addUpdateFormRef = useRef<HTMLFormElement>(null);
  const finalTextColor = readableTextColor(categoryColor);
  const isPending = node.status === "pending";

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

  return (
    <>
      <li
        className={`overflow-hidden rounded-lg border bg-white ${isPending ? "border-dashed" : ""}`}
        style={{
          borderColor: isPending ? "#a3a3a3" : isFinal ? categoryColor : `${categoryColor}55`,
        }}
      >
        <div
          className="flex items-start justify-between gap-2 p-3"
          style={
            isPending
              ? { backgroundColor: "#ffffff" }
              : { backgroundColor: isFinal ? categoryColor : `${categoryColor}1a` }
          }
        >
          <div className="flex min-w-0 items-start gap-2">
            {isOwner && (
              <span
                {...dragHandleProps}
                className="mt-0.5 shrink-0 cursor-grab select-none text-sm"
                style={isFinal && !isPending ? { color: finalTextColor, opacity: 0.7 } : undefined}
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
              {isPending ? (
                <span className="mb-0.5 inline-block rounded-full border border-neutral-300 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-neutral-500">
                  ⏳ Pending approval
                </span>
              ) : (
                isFinal && (
                  <span
                    className="mb-0.5 inline-block rounded-full bg-black/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                    style={{ color: finalTextColor }}
                  >
                    🏁 Final decision-maker
                  </span>
                )
              )}
              <span
                className="block truncate text-base font-semibold"
                style={isFinal && !isPending ? { color: finalTextColor } : undefined}
              >
                {node.name}
              </span>
              <span
                className="block text-xs"
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
            </button>
          </div>
          {isOwner && (
            <div className="flex shrink-0 items-center gap-1">
              {isPending && (
                <form
                  action={async (formData) => {
                    await approvePowerTreeNode(formData);
                  }}
                >
                  <input type="hidden" name="proposal_id" value={proposalId} />
                  <input type="hidden" name="node_id" value={node.id} />
                  <button
                    className="rounded-full px-2 py-0.5 text-xs font-medium text-white"
                    style={{ backgroundColor: categoryColor }}
                    title="Approve this suggestion"
                  >
                    Approve
                  </button>
                </form>
              )}
              <form action={removePowerTreeNode}>
                <input type="hidden" name="proposal_id" value={proposalId} />
                <input type="hidden" name="node_id" value={node.id} />
                <button
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
              </form>
            </div>
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
                {isPending ? (
                  <span className="mb-1 inline-block rounded-full border border-neutral-300 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-neutral-500">
                    ⏳ Pending approval
                  </span>
                ) : (
                  isFinal && (
                    <span
                      className="mb-1 inline-block rounded-full bg-black/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                      style={{ color: finalTextColor }}
                    >
                      🏁 Final decision-maker
                    </span>
                  )
                )}
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
                {isPending && isOwner && (
                  <form
                    action={async (formData) => {
                      await approvePowerTreeNode(formData);
                    }}
                    className="mt-1.5"
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
                          {u.authorName} · {formatDate(u.created_at)}
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
                                {r.authorName} · {formatDate(r.created_at)}
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
