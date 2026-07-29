"use client";

import { useState } from "react";
import { StatIcon, type StatIconName } from "@/components/stat-icons";

// Samantha's ask: clicking a community-dashboard stat card should "turn
// around" and explain what's actually being measured, instead of just
// sitting there as a number. Built as a real CSS 3D flip (perspective +
// rotateY + backface-visibility) rather than a swap-the-contents toggle,
// so it reads as a physical card turning over, not a layout jump. Front
// face is untouched from the existing design (color cap, number, icon,
// label) — the back face is new.
export function FlippableStatTile({
  label,
  value,
  sublabel,
  color,
  icon,
  description,
  font,
}: {
  label: string;
  value: number | string;
  sublabel?: string;
  color: string;
  icon: StatIconName;
  description: string;
  font: string;
}) {
  const [flipped, setFlipped] = useState(false);

  return (
    <button
      type="button"
      onClick={() => setFlipped((f) => !f)}
      aria-label={`${label}: ${value}. Tap to ${flipped ? "see the number" : "learn what this measures"}.`}
      className="block w-full text-left [perspective:1000px]"
    >
      <div
        className="relative h-full transition-transform duration-500 [transform-style:preserve-3d]"
        style={{ transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)" }}
      >
        {/* Front — identical to the original static tile. */}
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg [backface-visibility:hidden]">
          <div className="h-3" style={{ backgroundColor: color }} aria-hidden="true" />
          <div className="p-4">
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
            <p className="mt-3 text-sm font-bold text-neutral-900">{label}</p>
            {sublabel && <p className="mt-0.5 text-[11px] text-neutral-500">{sublabel}</p>}
          </div>
        </div>

        {/* Back — explanation of what's being measured and why it
            matters. Absolutely positioned over the front so both faces
            occupy the same box (this is what makes it a card flip
            instead of the back pushing the layout taller). */}
        <div
          className="absolute inset-0 overflow-hidden rounded-2xl bg-white shadow-sm [backface-visibility:hidden]"
          style={{ transform: "rotateY(180deg)" }}
        >
          <div className="h-3" style={{ backgroundColor: color }} aria-hidden="true" />
          <div className="flex h-[calc(100%-0.75rem)] flex-col p-4">
            <p className="text-sm font-bold text-neutral-900">{label}</p>
            <p className="mt-1.5 flex-1 text-xs leading-relaxed text-neutral-600">{description}</p>
            <p className="mt-1 text-[10px] font-medium uppercase tracking-wide text-neutral-400">
              Tap to flip back
            </p>
          </div>
        </div>
      </div>
    </button>
  );
}
