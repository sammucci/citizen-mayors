"use client";

import { StatIcon, type StatIconName } from "@/components/stat-icons";

// Samantha's ask: clicking a community-dashboard stat card should "turn
// around" and explain what's being measured, instead of just sitting
// there as a number. A few rounds of feedback since the first version:
// - Every card is now a fixed height (`h-44`), front AND back, so the
//   grid stays even regardless of whether a card has a sublabel (e.g.
//   "Letters written" gets a "N published" second line, most don't) —
//   before this, cards with a sublabel were visibly taller than their
//   neighbors and threw off the whole grid.
// - The back face is a solid, fully opaque fill in the tile's own color
//   with white text, not a second white card — reads as a distinct
//   "answer" state instead of just a re-skinned front.
// - `flipped`/`onToggle` are controlled from the parent (see
//   stat-tile-grid.tsx) rather than each tile owning its own state, so
//   flipping one card flips any other open one back — only one card is
//   ever turned over at a time.
export function FlippableStatTile({
  label,
  value,
  sublabel,
  color,
  icon,
  description,
  font,
  flipped,
  onToggle,
}: {
  label: string;
  value: number | string;
  sublabel?: string;
  color: string;
  icon: StatIconName;
  description: string;
  font: string;
  flipped: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={`${label}: ${value}. Tap to ${flipped ? "see the number" : "learn why this matters"}.`}
      className="block h-44 w-full text-left [perspective:1000px]"
    >
      <div
        className="relative h-full transition-transform duration-500 [transform-style:preserve-3d]"
        style={{ transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)" }}
      >
        {/* Front — same design as before: color cap, number + icon,
            bold label, optional sublabel. */}
        <div className="absolute inset-0 flex flex-col overflow-hidden rounded-2xl bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg [backface-visibility:hidden]">
          <div className="h-3 shrink-0" style={{ backgroundColor: color }} aria-hidden="true" />
          <div className="flex flex-1 flex-col p-4">
            <div className="flex items-start justify-between gap-2">
              <p className={`${font} text-5xl leading-none tracking-tight`} style={{ color }}>
                {value}
              </p>
              <div
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full"
                style={{ backgroundColor: `${color}1a`, color }}
              >
                <StatIcon name={icon} className="h-7 w-7" />
              </div>
            </div>
            <p className="mt-2 text-sm font-bold leading-snug text-neutral-900">{label}</p>
            {sublabel && <p className="mt-0.5 text-[11px] text-neutral-500">{sublabel}</p>}
          </div>
        </div>

        {/* Back — fully opaque in the tile's own color, white text. Just
            the label and a single "why this matters" sentence, tight
            line-height, no room for the copy to get cut off now that
            it's one sentence instead of a paragraph. */}
        <div
          className="absolute inset-0 flex flex-col overflow-hidden rounded-2xl p-4 shadow-sm [backface-visibility:hidden]"
          style={{ backgroundColor: color, transform: "rotateY(180deg)" }}
        >
          <p className="text-sm font-bold leading-snug text-white">{label}</p>
          <p className="mt-1.5 flex-1 text-xs leading-snug text-white/90">{description}</p>
          <p className="text-[10px] font-medium uppercase tracking-wide text-white/60">
            Tap to flip back
          </p>
        </div>
      </div>
    </button>
  );
}
