"use client";

import { useState, type ReactNode } from "react";
import { FlippableStatTile } from "@/components/flippable-stat-tile";
import type { StatIconName } from "@/components/stat-icons";

export type StatTileData = {
  key: string;
  label: string;
  value: number | string;
  sublabel?: string;
  color: string;
  icon: StatIconName;
  description: string;
  // Optional pre-built back-face content (e.g. a mini bar chart) — see
  // flippable-stat-tile.tsx. Only the cross-partisan-usership card uses
  // this today; every other tile just passes `description` as before.
  backContent?: ReactNode;
};

// Owns the "which one is flipped" state so it lives in exactly one
// place, shared across all the tiles — each FlippableStatTile is fully
// controlled from here rather than managing its own flip state, which is
// what makes "flip one, the rest turn back over" possible. Without a
// shared parent, every card flipping independently was the only option.
export function StatTileGrid({ items, font }: { items: StatTileData[]; font: string }) {
  const [flippedKey, setFlippedKey] = useState<string | null>(null);

  return (
    <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
      {items.map((item) => (
        <FlippableStatTile
          key={item.key}
          label={item.label}
          value={item.value}
          sublabel={item.sublabel}
          color={item.color}
          icon={item.icon}
          description={item.description}
          backContent={item.backContent}
          font={font}
          flipped={flippedKey === item.key}
          onToggle={() => setFlippedKey((k) => (k === item.key ? null : item.key))}
        />
      ))}
    </div>
  );
}
