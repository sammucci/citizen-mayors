// Small set of inline stroke icons (currentColor, so they pick up
// whatever text color the parent sets — same idea as the "solid white"
// treatment already used on the vote thumbs) — started for the
// notification bell specifically, but meant to be reused anywhere an
// emoji was standing in for a real icon before. 24x24 viewBox, sized
// down via className wherever they're used.

export function BellIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M6 8a6 6 0 0 1 12 0c0 4 1.5 5.5 2 6.5H4c.5-1 2-2.5 2-6.5Z" />
      <path d="M10 19a2 2 0 0 0 4 0" />
    </svg>
  );
}

export function CommentIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M20 14a2 2 0 0 1-2 2H8l-4 4V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8Z" />
    </svg>
  );
}

export function LinkIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M9 17H7a5 5 0 0 1 0-10h2" />
      <path d="M15 7h2a5 5 0 0 1 0 10h-2" />
      <path d="M8 12h8" />
    </svg>
  );
}

export function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12.5 2.5 2.5L16 9.5" />
    </svg>
  );
}

export function HourglassIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M6 3h12M6 21h12" />
      <path d="M8 3c0 4 4 4 4 8s-4 4-4 8M16 3c0 4-4 4-4 8s4 4 4 8" />
    </svg>
  );
}

export function TagIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M11.5 3.5H6a2.5 2.5 0 0 0-2.5 2.5v5.5a1 1 0 0 0 .29.71l8.5 8.5a1 1 0 0 0 1.42 0l7.09-7.09a1 1 0 0 0 0-1.42l-8.5-8.5a1 1 0 0 0-.71-.29Z" />
      <circle cx="8.25" cy="8.25" r="1.25" />
    </svg>
  );
}

// For the "a petition is now live" notification — a proposal you back
// (upvoted) now has a real, signable petition link. See
// lib/notifications.ts.
export function MegaphoneIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M3 11v2a2 2 0 0 0 2 2h1l3.5 5v-6" />
      <path d="M9 8 18.5 4a1 1 0 0 1 1.5.87v14.26a1 1 0 0 1-1.5.87L9 16Z" />
      <path d="M22 9.5a3 3 0 0 1 0 5" />
    </svg>
  );
}
