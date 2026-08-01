"use client";

import { Fragment, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { addPowerTreeNode, reorderPowerTreeNodes, updatePeopleActionNote } from "@/app/proposals/actions";
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
  status: "pending" | "approved";
  completed: boolean;
  submittedByName: string;
  submittedById: string | null;
  decisionMakerId: string | null;
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
// Reordering is driven by a small grip handle on each card using Pointer
// Events (pointerdown/pointermove/pointerup) instead of HTML5 drag
// events — HTML5 drag never fires on a touch device at all, which is why
// this used to be desktop/mouse-only. Pointer Events fire the same way
// for a mouse, a finger, or a pen, so this is one code path that works
// everywhere rather than a separate mobile fallback. (A ▲▼ tap-to-move
// button approach was tried here previously for phones and pulled back
// out per Samantha's call — this replaces that attempt, not extends it.)
export function PowerTreeChain({
  proposalId,
  categoryColor,
  nodesAscending,
  decisionMakers,
  isOwner,
  canContribute,
  peopleActionNote,
}: {
  proposalId: string;
  categoryColor: string;
  nodesAscending: Node[];
  decisionMakers: { id: string; name: string; kind: string; currentOfficeholder: string | null }[];
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
  // Pointer Events (not HTML5 drag-and-drop) power the actual drag
  // gesture for every pointer type — mouse, touch, and pen all fire the
  // same pointerdown/pointermove/pointerup events, so this is the one
  // code path that makes reordering work on a phone, not just a mouse.
  // touchDragIndex is which DISPLAY card is being lifted; touchOverGap is
  // which gap (0..display.length) the pointer is currently over, judged
  // by comparing the pointer's Y position against each card's vertical
  // midpoint as it moves — the same logic a native sortable list uses.
  const [touchDragIndex, setTouchDragIndex] = useState<number | null>(null);
  const [touchOverGap, setTouchOverGap] = useState<number | null>(null);
  const cardRefs = useRef<Array<HTMLDivElement | null>>([]);
  const [openGap, setOpenGap] = useState<number | null>(null); // ascending insert index
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

  // Starts a drag from the grip handle — works identically whether it's
  // a mouse click or a finger touch, since both fire the same pointer
  // events. setPointerCapture keeps every subsequent pointermove/pointerup
  // routed to THIS element even once the pointer moves outside it, which
  // is what makes dragging past the card's own edges (up toward the top
  // of the chain, or down past the last card) work without needing a
  // window-level listener.
  function handlePointerDownOnHandle(e: React.PointerEvent, displayIndex: number, nodeId: string) {
    if (!isOwner) return;
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDragId(nodeId);
    setTouchDragIndex(displayIndex);
    setTouchOverGap(displayIndex);
  }

  function handlePointerMoveOnHandle(e: React.PointerEvent) {
    if (touchDragIndex === null) return;
    const y = e.clientY;
    let gap = 0;
    cardRefs.current.forEach((el, i) => {
      if (!el) return;
      const rect = el.getBoundingClientRect();
      if (y > rect.top + rect.height / 2) gap = i + 1;
    });
    setTouchOverGap(gap);
  }

  function handlePointerUpOnHandle() {
    if (touchOverGap !== null) {
      handleDropAtDisplayIndex(touchOverGap);
    }
    setTouchDragIndex(null);
    setTouchOverGap(null);
  }

  // Display gap index i -> ascending insert index. Gap 0 is above the
  // topmost card (adds a new final decision-maker); gap display.length
  // is below the bottommost real card, right above "We the people"
  // (adds a new first step).
  function ascendingInsertIndexForGap(displayGapIndex: number) {
    return ascending.length - displayGapIndex;
  }

  function GapInserter({ displayGapIndex, isDropTarget }: { displayGapIndex: number; isDropTarget?: boolean }) {
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
        className={`flex justify-center rounded transition-colors ${
          isDropTarget ? "bg-duty-purple/10 py-1 ring-2 ring-duty-purple/40" : ""
        }`}
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
            <input
              type="hidden"
              name="insert_index"
              value={ascendingInsertIndexForGap(displayGapIndex)}
            />
            <p className="text-[11px] text-neutral-500">{gapHint}</p>
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
      <GapInserter displayGapIndex={0} isDropTarget={touchDragIndex !== null && touchOverGap === 0} />
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
            ref={(el) => {
              cardRefs.current[i] = el;
            }}
            className={`transition-opacity ${touchDragIndex === i ? "opacity-50" : ""}`}
          >
            {/* The card already has its own grip-dot handle built in
                (the ⠿ next to the name) — this just wires that existing
                handle up to the real Pointer Events drag gesture instead
                of adding a second handle alongside it. */}
            <PowerTreeNodeCard
              proposalId={proposalId}
              node={node}
              isFinal={i === firstApprovedDisplayIndex}
              isOwner={isOwner}
              canContribute={canContribute}
              categoryColor={categoryColor}
              dragHandleProps={{
                onPointerDown: (e) => handlePointerDownOnHandle(e, i, node.id),
                onPointerMove: handlePointerMoveOnHandle,
                onPointerUp: handlePointerUpOnHandle,
                onPointerCancel: handlePointerUpOnHandle,
                style: { touchAction: "none" },
              }}
            />
          </div>
          <GapInserter displayGapIndex={i + 1} isDropTarget={touchDragIndex !== null && touchOverGap === i + 1} />
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
