"use client";

import { useEffect } from "react";
import Link from "next/link";

// Route-level error boundary. Before this existed, ANY unhandled
// exception anywhere on the site (a bad geocode response, a Supabase
// query erroring, whatever) fell all the way through to Next's generic
// "Application error: a server-side exception has occurred" page — no
// header, no nav, no link back in, just a dead end with a digest number
// and nothing else. This renders in the same slot as the page content,
// so the header/nav from layout.tsx (including the logo link home)
// still show — but even without that, there's an explicit "Back to
// homepage" link and a "Try again" button below, so getting stuck with
// no way out shouldn't happen again regardless of what actually broke.
//
// This does NOT fix whatever caused a given crash — it just guarantees
// there's always a way back while that's investigated. If you hit this,
// the digest shown is the thing to go look up in Vercel's own deployment
// logs (or send it over) — that's the only place the real underlying
// error message and stack trace live; this component never sees more
// than the digest itself.
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Route error boundary caught:", error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-3 py-20 text-center">
      <p className="text-3xl">⚠️</p>
      <h1 className="text-lg font-semibold text-neutral-800">Something went wrong on this page</h1>
      <p className="text-sm text-neutral-600">
        This is a bug, not something you did — sorry about that. Trying again sometimes works, or head back to the
        homepage.
      </p>
      {error.digest && (
        <p className="text-xs text-neutral-400">
          Error reference: <span className="font-mono">{error.digest}</span>
        </p>
      )}
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-full bg-duty-purple px-4 py-1.5 text-sm font-semibold text-white shadow-sm hover:opacity-90"
        >
          Try again
        </button>
        <Link
          href="/"
          className="rounded-full border border-neutral-300 px-4 py-1.5 text-sm text-neutral-600 hover:bg-neutral-50"
        >
          Back to homepage
        </Link>
      </div>
    </div>
  );
}
