"use client";

import type { ReactNode } from "react";
import { StatIcon, type StatIconName } from "@/components/stat-icons";

// Most of the real site palette (supabase/schema.sql's category colors)
// is dark/saturated enough to read fine as text on its own pale tint.
// The one exception is the governance-yellow (#FBE968) — plenty bold as
// a solid bar, unreadable as the color of a bold number or white text on
// top of it. Rather than special-case yellow by name (fragile if the
// palette ever changes), this measures perceived brightness and only
// adjusts colors that are actually too light, so every other color's
// bar/tint/number stays exactly the real site color, unchanged.
export function brightnessOf(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000;
}
function darken(hex: string, amount: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const scale = (c: number) => Math.round(c * amount).toString(16).padStart(2, "0");
  return `#${scale(r)}${scale(g)}${scale(b)}`;
}

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
  backContent,
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
  // Most cards just explain themselves in a sentence (`description`
  // above). The cross-partisan-usership card needs an actual mini bar
  // chart on the back instead of prose, so this lets a caller hand in
  // pre-built JSX (built server-side, where the real data lives) that
  // takes over the back face's middle section entirely — description
  // is ignored when this is provided.
  backContent?: ReactNode;
  font: string;
  flipped: boolean;
  onToggle: () => void;
}) {
  // color itself is always the real site category color, untouched —
  // the bar, the icon-circle tint, and the back face all use it exactly
  // as-is. accentColor is only different from color when color is too
  // light to read as text (currently just the governance yellow) — used
  // for the number and the icon glyph, so those stay legible without
  // changing what color the card visually reads as.
  const isLight = brightnessOf(color) > 180;
  const accentColor = isLight ? darken(color, 0.55) : color;
  const backTextColor = isLight ? "#3a3200" : "#ffffff";

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={`${label}: ${value}. Tap to ${flipped ? "see the number" : "learn why this matters"}.`}
      className="block h-52 w-full text-left [perspective:1000px]"
    >
      <div
        className="relative h-full transition-transform duration-500 [transform-style:preserve-3d]"
        style={{ transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)" }}
      >
        {/* Front — a slim solid-color accent bar (thinner than the last
            pass — that one read as way too heavy) plus a tinted body
            underneath. Bar and icon-circle tint use the real site color
            exactly; the number and icon glyph use accentColor so they
            stay readable even for a pale color like the site's yellow. */}
        <div className="absolute inset-0 flex flex-col overflow-hidden rounded-2xl shadow-sm transition hover:-translate-y-1 hover:shadow-lg [backface-visibility:hidden]">
          <div className="h-2 shrink-0" style={{ backgroundColor: color }} aria-hidden="true" />
          <div
            className="relative flex flex-1 flex-col p-5"
            style={{ backgroundColor: `${color}14` }}
          >
            {/* Icon is its own absolutely-positioned badge, not sharing a
                flex row with the number — a number sharing a row with a
                fixed-width icon works fine at 4-5 digits, but a big
                proposal/comment count (6-7 digits) would either get
                squeezed by the icon or force it off the edge. Pulling
                the icon out of that row means the number always has the
                FULL card width to itself and can wrap onto a second line
                if it ever needs to, instead of colliding with anything. */}
            <div
              className="absolute right-4 top-4 flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-2xl"
              style={{ backgroundColor: `${color}33`, color: accentColor }}
            >
              <StatIcon name={icon} className="h-6 w-6" />
            </div>
            <p
              className={`${font} pr-14 text-5xl leading-none tracking-tight`}
              style={{ color: accentColor }}
            >
              {value}
            </p>
            <p className="mt-3 text-sm font-bold leading-snug text-neutral-900">{label}</p>
            {sublabel && <p className="mt-0.5 text-[11px] text-neutral-500">{sublabel}</p>}
          </div>
        </div>

        {/* Back — fully opaque in the tile's own real color. Text is
            white on every color except the pale yellow, where white
            would be nearly invisible — that one gets a dark, near-black
            gold instead so it's still readable and still clearly "the
            yellow card." */}
        <div
          className="absolute inset-0 flex flex-col overflow-hidden rounded-2xl p-4 shadow-sm [backface-visibility:hidden]"
          style={{ backgroundColor: color, transform: "rotateY(180deg)" }}
        >
          <p className="text-sm font-bold leading-snug" style={{ color: backTextColor }}>
            {label}
          </p>
          <div className="mt-1.5 flex-1 overflow-hidden text-xs leading-snug" style={{ color: backTextColor }}>
            {backContent ?? <p style={{ opacity: 0.9 }}>{description}</p>}
          </div>
          <p
            className="text-[10px] font-medium uppercase tracking-wide"
            style={{ color: backTextColor, opacity: 0.6 }}
          >
            Tap to flip back
          </p>
        </div>
      </div>
    </button>
  );
}
