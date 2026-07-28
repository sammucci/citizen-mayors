"use client";

import { useRef, useState } from "react";
import {
  addPowerTreeNodeUpdate,
  removePowerTreeNode,
  updatePowerTreeNodeNote,
} from "@/app/proposals/actions";
import { readableTextColor } from "@/lib/readable-text-color";

type Update = {
  id: string;
  body: string;
  created_at: string;
  authorName: string;
};

// Collapsed by default — name, role, and (if this is the top of the
// chain) a colored treatment marking it as the final decision-maker.
// Click to open it up: the role note becomes editable, and below that
// sits a running log of dated updates — when someone talked to this
// person/office, what came of it, what's useful to know working with
// them — plus a box to add another. That log is the new part; the
// note field already existed.
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
    updates: Update[];
  };
  isFinal: boolean;
  isOwner: boolean;
  canContribute: boolean;
  categoryColor: string;
  dragHandleProps?: React.HTMLAttributes<HTMLSpanElement>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editingNote, setEditingNote] = useState(false);
  const addUpdateFormRef = useRef<HTMLFormElement>(null);
  const finalTextColor = readableTextColor(categoryColor);

  return (
    <li
      className="overflow-hidden rounded-lg border border-neutral-200 bg-white"
      style={isFinal ? { borderColor: categoryColor } : undefined}
    >
      <div
        className="flex items-start justify-between gap-2 p-3"
        style={isFinal ? { backgroundColor: categoryColor } : { backgroundColor: "#fafafa" }}
      >
        <div className="flex min-w-0 items-start gap-2">
          {isOwner && (
            <span
              {...dragHandleProps}
              className="mt-0.5 shrink-0 cursor-grab select-none text-sm"
              style={isFinal ? { color: finalTextColor, opacity: 0.7 } : undefined}
              title="Drag to reorder"
              aria-hidden="true"
            >
              ⠿
            </span>
          )}
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="min-w-0 text-left"
          >
            <span
              className="block truncate text-base font-semibold"
              style={isFinal ? { color: finalTextColor } : undefined}
            >
              {isFinal ? "🏁 " : ""}
              {node.name}
            </span>
            <span
              className="block text-xs"
              style={isFinal ? { color: finalTextColor, opacity: 0.8 } : undefined}
            >
              {node.subtitle}
              {isFinal ? " · Final decision-maker" : ""}
            </span>
          </button>
        </div>
        {isOwner && (
          <form action={removePowerTreeNode}>
            <input type="hidden" name="proposal_id" value={proposalId} />
            <input type="hidden" name="node_id" value={node.id} />
            <button
              className={`shrink-0 rounded-full border px-1.5 text-xs ${
                isFinal ? "" : "border-neutral-300 text-neutral-500 hover:border-duty-red hover:text-duty-red"
              }`}
              style={
                isFinal
                  ? { borderColor: `${finalTextColor}66`, color: finalTextColor, opacity: 0.8 }
                  : undefined
              }
              title="Remove from this proposal's chain"
            >
              ✕
            </button>
          </form>
        )}
      </div>

      {expanded && (
        <div className="space-y-3 border-t border-neutral-100 p-3">
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
            <p className="text-xs font-medium text-neutral-700">
              Notes on working with them
            </p>
            <ul className="mt-1.5 space-y-1.5">
              {node.updates.map((u) => (
                <li key={u.id} className="rounded bg-neutral-50 p-2 text-xs text-neutral-700">
                  <p className="whitespace-pre-wrap">{u.body}</p>
                  <p className="mt-1 text-neutral-400">
                    {u.authorName} ·{" "}
                    {new Date(u.created_at).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                </li>
              ))}
              {node.updates.length === 0 && (
                <li className="text-xs text-neutral-400">Nothing logged yet.</li>
              )}
            </ul>
          </div>

          {canContribute && (
            <form
              ref={addUpdateFormRef}
              action={async (formData) => {
                await addPowerTreeNodeUpdate(formData);
                addUpdateFormRef.current?.reset();
              }}
              className="space-y-1.5"
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
              <button
                className="rounded px-2 py-1 text-xs"
                style={{ backgroundColor: categoryColor, color: finalTextColor }}
              >
                Add note
              </button>
            </form>
          )}
        </div>
      )}
    </li>
  );
}
