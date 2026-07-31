// Plain, "use client"-free math, on purpose. This used to live inside
// flippable-stat-tile.tsx (a "use client" file) and community-dashboard/
// page.tsx (a Server Component) imported brightnessOf() from it directly
// to compute readable text/bar colors for the cross-partisan-usership
// card's back face. That's what broke the community dashboard in
// production ("Application error: a server-side exception has
// occurred") even though the build succeeded: once a file is marked
// "use client", every one of its exports — not just its React
// components — gets replaced with a client-reference stand-in when a
// Server Component imports it. Calling that stand-in as a real function
// during server-side rendering throws, and TypeScript/webpack have no
// way to catch that at build time, only at request time. Moving this
// pure math into its own plain file, with no "use client" directive,
// means both sides can import the real function safely.

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

export function darken(hex: string, amount: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const scale = (c: number) => Math.round(c * amount).toString(16).padStart(2, "0");
  return `#${scale(r)}${scale(g)}${scale(b)}`;
}
