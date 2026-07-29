// Small shared helper, same spirit as status-colors.ts / readable-text-color.ts.
// Compact "how long ago" for timestamps on things like comments — falls
// back to a short date once something's more than a week old, since
// "23d ago" is less useful at that point than just seeing the date.
// Safe to compute at request time even on a server component: nothing
// here depends on the client's clock or re-renders after mount, so
// there's no hydration mismatch risk.
export function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const diffMs = Date.now() - then;

  const minute = 60_000;
  const hour = 3_600_000;
  const day = 86_400_000;

  if (diffMs < minute) return "just now";
  if (diffMs < hour) return `${Math.floor(diffMs / minute)}m ago`;
  if (diffMs < day) return `${Math.floor(diffMs / hour)}h ago`;
  if (diffMs < day * 7) return `${Math.floor(diffMs / day)}d ago`;

  const then_ = new Date(iso);
  const sameYear = then_.getFullYear() === new Date().getFullYear();
  return then_.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}
