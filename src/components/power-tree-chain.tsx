"use client";

import { Fragment, useState } from "react";
import { useRouter } from "next/navigation";
import { addPowerTreeNode, reorderPowerTreeNodes, updatePeopleActionNote } from "@/app/proposals/actions";
import { DecisionMakerField } from "@/components/decision-maker-field";
import { GrantField } from "@/components/grant-field";
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
  nodeType: "decision_maker" | "funding";
  name: string;
  subtitle: string | null;
  note: string | null;
  status: "pending" | "approved";
  completed: boolean;
  submittedByName: string;
  submittedById: string | null;
  grantUrl: string | null;
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
  grants,
  isOwner,
  canContribute,
  peopleActionNote,
}: {
  proposalId: string;
  categoryColor: string;
  nodesAscending: Node[];
  decisionMakers: { id: string; name: string; kind: string }[];
  grants: { id: string; name: string; funder: string | null }[];
  isOwner: boolean;
  canContribute: boolean;
  peopleActionNote?: string | null;
}) {
  // Server Actions invoked from a plain <form action> auto-refresh the
  // tab that submitted them, but that refresh can still be served from
  // Next's client-side router cache rather than a true refetch in some
  // cases. Calling router.refresh() explicitly after every mutation
  // forces a real refetch of this page's data, so there's no chance of
  // a stale cached copy showing an add/approve/reorder in the wrong
  // spot — belt-and-suspenders alongside the resync-key fix above.
  const router = useRouter();

  // ascending = lowest sort_order first (closest to "We the people").
  // Local copy so a drag can move things around instantly, before the
  // server round-trip confirms it.
  const [ascending, setAscending] = useState(nodesAscending);
  const [dragId, setDragId] = useState<string | null>(null);
  const [openGap, setOpenGap] = useState<number | null>(null); // ascending insert index
  // Which kind of link a currently-open gap is inserting — decision-maker
  // (the original, default) or funding (Samantha's chain-node redesign:
  // money needed at this exact point, rather than one flag for the whole
  // proposal). Resets to the default whenever a gap opens/closes so a
  // stale pick from a previous insert never carries over.
  const [insertType, setInsertType] = useState<"decision_maker" | "funding">("decision_maker");
  // Inline edit for the fixed "We the people" anchor's optional action
  // note (e.g. "Write proposal", "Make petition") — same pattern as a
  // power-tree node's role note, just against the proposal row directly
  // since this anchor isn't a real node.
  const [editingPeopleNote, setEditingPeopleNote] = useState(false);

  // Resync if the underlying data changed (node added/removed elsewhere,
  // or the server's revalidated result differs from our optimistic one).
  // Has to include more than just the id list — adding a note, editing a
  // role note, or approving a suggestion doesn't change which nodes
  // exist, just their content/status, and that was getting silently
  // swallowed: the key matched, so the stale local copy kept being shown
  // even though the server had the update all along. (This exact bug is
  // why clicking Approve looked like it did nothing — the database was
  // updated correctly, the card just never re-rendered to show it.)
  const currentKey = nodesAscending
    .map((n) => `${n.id}:${n.updates.length}:${n.note ?? ""}:${n.status}:${n.completed}`)
    .join("|");
  const [syncedKey, setSyncedKey] = useState(currentKey);
  if (currentKey !== syncedKey) {
    setAscending(nodesAscending);
    setSyncedKey(currentKey);
    setOpenGap(null);
  }

  const display = [...ascending].reverse(); // final decision-maker first/top

  // "Final decision-maker" only ever applies to an approved node — a
  // pending suggestion sitting at the top of the display shouldn't get
  // the colored final treatment (or bump the real final decision-maker
  // out of it) before anyone's actually approved it.
  const firstApprovedDisplayIndex = display.findIndex((n) => n.status === "approved");

  function persistOrder(newAscending: Node[]) {
    setAscending(newAscending);
    const fd = new FormData();
    fd.set("proposal_id", proposalId);
    newAscending.forEach((n) => fd.append("node_id", n.id));
    reorderPowerTreeNodes(fd).then(() => router.refresh());
  }

  // Dropping on a GAP is unambiguous — a gap already means "exactly
  // here" — so this stays a straight insert-at-this-position.
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

  // Dropping directly ON A CARD is different — it used to always mean
  // "insert above this card" (same math as a gap drop), which made
  // dragging a card down onto the very next card a no-op: removing the
  // dragged card shifts the target up by one, and "insert above the
  // target's new position" lands you right back where you started. A
  // downward drag reads naturally as "put it after this card," an
  // upward drag as "put it before this card" — so which side it lands
  // on now follows the direction you dragged, matching how sortable
  // lists elsewhere (Trello, etc.) behave.
  function handleDropOnCard(targetDisplayIndex: number) {
    if (!dragId) return;
    const current = [...display];
    const fromIndex = current.findIndex((n) => n.id === dragId);
    if (fromIndex === -1 || fromIndex === targetDisplayIndex) return;
    const draggingDown = fromIndex < targetDisplayIndex;
    const [moved] = current.splice(fromIndex, 1);
    let adjustedTarget = draggingDown ? targetDisplayIndex - 1 : targetDisplayIndex;
    if (draggingDown) adjustedTarget += 1; // land after the target, not above it
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
    // Anyone signed in can suggest an addition, not just the owner —
    // it just lands pending until the owner approves it.
    if (!canContribute) return null;
    const isOpen = openGap === displayGapIndex;

    // The insert-position math checks out for every gap, but the topmost
    // and bottommost "+" have special meaning that wasn't obvious from a
    // generic "+" button: the very top one doesn't just insert "near the
    // top," it makes the new entry the final decision-maker, which reads
    // as "it jumped to the top of the chain" if you weren't expecting
    // that. Spelling it out here so the position is a deliberate choice,
    // not a surprise after the fact.
    const gapHint =
      display.length === 0
        ? "Insert the first decision-maker here"
        : displayGapIndex === 0
        ? "Insert here — this becomes the final decision-maker, at the top of the chain"
        : displayGapIndex === display.length
        ? "Insert here — this becomes the first step, closest to We the people"
        : "Insert a decision-maker here, between the two adjacent entries";

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
              router.refresh();
              setOpenGap(null);
            }}
            className="w-full space-y-2 rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-2"
          >
            <input type="hidden" name="proposal_id" value={proposalId} />
            <input type="hidden" name="node_type" value={insertType} />
            <input
              type="hidden"
              name="insert_index"
              value={ascendingInsertIndexForGap(displayGapIndex)}
            />
            <p className="text-[11px] text-neutral-500">{gapHint}</p>
            {/* Same chain, two kinds of link — pick which this spot is
                before showing the matching field. Funding needed to be
                its own kind of entry rather than one flag for the whole
                proposal, since money can be needed at more than one
                distinct stage. */}
            <div className="flex overflow-hidden rounded-full border border-neutral-300 text-xs">
              <button
                type="button"
                onClick={() => setInsertType("decision_maker")}
                className={`flex-1 px-2 py-1 ${
                  insertType === "decision_maker"
                    ? "font-medium text-white"
                    : "bg-white text-neutral-500 hover:bg-neutral-50"
                }`}
                style={insertType === "decision_maker" ? { backgroundColor: categoryColor } : undefined}
              >
                Decision-maker
              </button>
              <button
                type="button"
                onClick={() => setInsertType("funding")}
                className={`flex-1 border-l border-neutral-300 px-2 py-1 ${
                  insertType === "funding"
                    ? "bg-amber-600 font-medium text-white"
                    : "bg-white text-neutral-500 hover:bg-neutral-50"
                }`}
              >
                💰 Funding
              </button>
            </div>
            {insertType === "decision_maker" ? (
              <DecisionMakerField decisionMakers={decisionMakers} />
            ) : (
              <GrantField grants={grants} />
            )}
            <div className="flex gap-2">
              <button
                className="rounded px-2 py-1 text-xs"
                style={{ backgroundColor: categoryColor, color: readableTextColor(categoryColor) }}
              >
                Insert here
              </button>
              <button
                type="button"
                onClick={() => {
                  setOpenGap(null);
                  setInsertType("decision_maker");
                }}
                className="rounded border border-neutral-300 px-2 py-1 text-xs text-neutral-600 hover:bg-neutral-50"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => {
              setOpenGap(displayGapIndex);
              setInsertType("decision_maker");
            }}
            className="flex h-6 w-6 items-center justify-center rounded-full border border-dashed border-neutral-300 text-sm text-neutral-400 hover:border-neutral-400 hover:text-neutral-600"
            title={gapHint}
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
        // Each card and its trailing gap are separate direct children of
        // the <ul> (via this Fragment) rather than both nested inside one
        // wrapping <div> — that div used to be the only thing space-y-1.5
        // actually applied margin between, so a card and the "+" right
        // below it sat flush against each other while the "+" and the
        // NEXT card got the real gap. Made the "+" look glued to the
        // card above it instead of centered between the two.
        <Fragment key={node.id}>
          <div
            draggable={isOwner}
            onDragStart={() => setDragId(node.id)}
            onDragEnd={() => setDragId(null)}
            // The only real drop targets used to be the thin "+" gap
            // strips between cards — dropping anywhere on a card itself
            // (which is what you'd naturally try) did nothing, so
            // dragging looked broken even though it was technically
            // wired up. Dropping directly on a card now lands above or
            // below it depending on which way you dragged (see
            // handleDropOnCard) instead of always "above," which used to
            // make a downward drag onto the next card do nothing.
            onDragOver={isOwner ? (e) => e.preventDefault() : undefined}
            onDrop={isOwner ? () => handleDropOnCard(i) : undefined}
          >
            <PowerTreeNodeCard
              proposalId={proposalId}
              node={node}
              isFinal={i === firstApprovedDisplayIndex}
              isOwner={isOwner}
              canContribute={canContribute}
              categoryColor={categoryColor}
            />
          </div>
          <GapInserter displayGapIndex={i + 1} />
        </Fragment>
      ))}

      {display.length === 0 && (
        <li className="text-sm text-neutral-500">Not mapped out yet.</li>
      )}

      {/* Fixed anchor — not a real node, never draggable, never
          removable. Represents where every proposal actually starts.
          The role note below is the one thing about it that IS
          editable: an optional description of what that first step
          actually looks like (e.g. "Write proposal", "Make petition"). */}
      <li className="mt-1 space-y-1.5 rounded-lg border border-dashed border-neutral-300 bg-cream/60 p-3 text-center">
        <span className="text-sm font-medium text-neutral-600">🧑‍🤝‍🧑 We the people</span>
        {isOwner && !editingPeopleNote && (
          <button
            type="button"
            onClick={() => setEditingPeopleNote(true)}
            className="block w-full text-xs text-neutral-500 underline hover:text-neutral-700"
          >
            {peopleActionNote ? `Role: ${peopleActionNote}` : "Add a role note"}
          </button>
        )}
        {!isOwner && peopleActionNote && (
          <p className="text-xs text-neutral-500">Role: {peopleActionNote}</p>
        )}
        {isOwner && editingPeopleNote && (
          <form
            action={async (formData) => {
              await updatePeopleActionNote(formData);
              router.refresh();
              setEditingPeopleNote(false);
            }}
            className="flex items-center justify-center gap-1.5"
          >
            <input type="hidden" name="proposal_id" value={proposalId} />
            <input
              name="people_action_note"
              defaultValue={peopleActionNote ?? ""}
              placeholder="e.g. Write proposal, Make petition"
              className="min-w-0 flex-1 rounded border border-neutral-300 px-2 py-0.5 text-xs"
              autoFocus
            />
            <button
              className="shrink-0 rounded px-2 py-0.5 text-xs"
              style={{ backgroundColor: categoryColor, color: readableTextColor(categoryColor) }}
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setEditingPeopleNote(false)}
              className="shrink-0 rounded border border-neutral-300 px-2 py-0.5 text-xs text-neutral-600 hover:bg-neutral-50"
            >
              Cancel
            </button>
          </form>
        )}
      </li>
    </ul>
  );
}
