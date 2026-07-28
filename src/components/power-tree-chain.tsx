"use client";

import { useState } from "react";
import { addPowerTreeNode, reorderPowerTreeNodes } from "@/app/proposals/actions";
import { DecisionMakerField } from "@/components/decision-maker-field";
import { PowerTreeNodeCard } from "@/components/power-tree-node-card";
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
type Node = {
  id: string;
  name: string;
  subtitle: string | null;
  note: string | null;
  updates: Update[];
};

// The decision chain, redesigned per your sketch: "We the people" is a
// fixed anchor at the very bottom (not a real node — there's nothing to
// drag, remove, or add notes to), the chain climbs from there, and
// whoever's on top is the final decision-maker, called out with a
// colored card instead of blending in with the rest. Drag-and-drop
// replaces the up/down arrows, and a "+" at the top, bottom, and
// between every pair of entries lets you insert a decision-maker at
// that exact spot instead of only ever appending at the end.
//
// First pass — drag-and-drop here is plain HTML5 drag events, which
// works well with a mouse but has patchy touch support on phones (most
// notably iOS Safari). If reordering on mobile turns out to matter a
// lot in practice, that's the piece most worth revisiting.
export function PowerTreeChain({
  proposalId,
  categoryColor,
  nodesAscending,
  decisionMakers,
  isOwner,
  canContribute,
}: {
  proposalId: string;
  categoryColor: string;
  nodesAscending: Node[];
  decisionMakers: { id: string; name: string; kind: string }[];
  isOwner: boolean;
  canContribute: boolean;
}) {
  // ascending = lowest sort_order first (closest to "We the people").
  // Local copy so a drag can move things around instantly, before the
  // server round-trip confirms it.
  const [ascending, setAscending] = useState(nodesAscending);
  const [dragId, setDragId] = useState<string | null>(null);
  const [openGap, setOpenGap] = useState<number | null>(null); // ascending insert index

  // Resync if the underlying data changed (node added/removed elsewhere,
  // or the server's revalidated result differs from our optimistic one).
  // Has to include more than just the id list — adding a note or editing
  // a role note doesn't change which nodes exist, just their content, and
  // that was getting silently swallowed: the key matched, so the stale
  // local copy (from before the note was added) kept being shown even
  // though the server had the new one all along.
  const currentKey = nodesAscending
    .map((n) => `${n.id}:${n.updates.length}:${n.note ?? ""}`)
    .join("|");
  const [syncedKey, setSyncedKey] = useState(currentKey);
  if (currentKey !== syncedKey) {
    setAscending(nodesAscending);
    setSyncedKey(currentKey);
    setOpenGap(null);
  }

  const display = [...ascending].reverse(); // final decision-maker first/top

  function persistOrder(newAscending: Node[]) {
    setAscending(newAscending);
    const fd = new FormData();
    fd.set("proposal_id", proposalId);
    newAscending.forEach((n) => fd.append("node_id", n.id));
    reorderPowerTreeNodes(fd);
  }

  function handleDropAtDisplayIndex(targetDisplayIndex: number) {
    if (!dragId) return;
    const current = [...display];
    const fromIndex = current.findIndex((n) => n.id === dragId);
    if (fromIndex === -1) return;
    const [moved] = current.splice(fromIndex, 1);
    const adjustedTarget = fromIndex < targetDisplayIndex ? targetDisplayIndex - 1 : targetDisplayIndex;
    current.splice(adjustedTarget, 0, moved);
    persistOrder([...current].reverse());
    setDragId(null);
  }

  // Display gap index i -> ascending insert index. Gap 0 is above the
  // topmost card (adds a new final decision-maker); gap display.length
  // is below the bottommost real card, right above "We the people"
  // (adds a new first step).
  function ascendingInsertIndexForGap(displayGapIndex: number) {
    return ascending.length - displayGapIndex;
  }

  function GapInserter({ displayGapIndex }: { displayGapIndex: number }) {
    if (!isOwner) return null;
    const isOpen = openGap === displayGapIndex;
    return (
      <li
        onDragOver={isOwner ? (e) => e.preventDefault() : undefined}
        onDrop={isOwner ? () => handleDropAtDisplayIndex(displayGapIndex) : undefined}
        className="flex justify-center"
      >
        {isOpen ? (
          <form
            action={async (formData) => {
              await addPowerTreeNode(formData);
              setOpenGap(null);
            }}
            className="w-full space-y-2 rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-2"
          >
            <input type="hidden" name="proposal_id" value={proposalId} />
            <input
              type="hidden"
              name="insert_index"
              value={ascendingInsertIndexForGap(displayGapIndex)}
            />
            <DecisionMakerField decisionMakers={decisionMakers} />
            <div className="flex gap-2">
              <button
                className="rounded px-2 py-1 text-xs"
                style={{ backgroundColor: categoryColor, color: readableTextColor(categoryColor) }}
              >
                Insert here
              </button>
              <button
                type="button"
                onClick={() => setOpenGap(null)}
                className="rounded border border-neutral-300 px-2 py-1 text-xs text-neutral-600 hover:bg-neutral-50"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setOpenGap(displayGapIndex)}
            className="flex h-6 w-6 items-center justify-center rounded-full border border-dashed border-neutral-300 text-sm text-neutral-400 hover:border-neutral-400 hover:text-neutral-600"
            title="Insert a decision-maker here"
          >
            +
          </button>
        )}
      </li>
    );
  }

  return (
    <ul className="mt-3 space-y-1.5">
      <GapInserter displayGapIndex={0} />
      {display.map((node, i) => (
        <div key={node.id}>
          <div
            draggable={isOwner}
            onDragStart={() => setDragId(node.id)}
            onDragEnd={() => setDragId(null)}
          >
            <PowerTreeNodeCard
              proposalId={proposalId}
              node={node}
              isFinal={i === 0}
              isOwner={isOwner}
              canContribute={canContribute}
              categoryColor={categoryColor}
            />
          </div>
          <GapInserter displayGapIndex={i + 1} />
        </div>
      ))}

      {display.length === 0 && (
        <li className="text-sm text-neutral-500">Not mapped out yet.</li>
      )}

      {/* Fixed anchor — not a real node, never draggable, never
          removable. Represents where every proposal actually starts. */}
      <li className="mt-1 rounded-lg border border-dashed border-neutral-300 bg-cream/60 p-3 text-center">
        <span className="text-sm font-medium text-neutral-600">🧑‍🤝‍🧑 We the people</span>
      </li>
    </ul>
  );
}
