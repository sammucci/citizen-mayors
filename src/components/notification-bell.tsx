"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { markNotificationsSeen } from "@/app/actions";
import type { NotificationItem } from "@/lib/notifications";

// Site-wide bell in the header, replacing the old profile-page-only
// banner — this is computed in the root layout (server-side, every
// page) so it's visible no matter where you are, not just when you
// happen to visit /profile. Opening the dropdown marks everything as
// seen: the badge clears immediately (optimistic, so it doesn't feel
// laggy) and markNotificationsSeen() persists that in the background,
// then router.refresh() re-fetches the layout so a page reload also
// starts clean.
export function NotificationBell({ items }: { items: NotificationItem[] }) {
  const [open, setOpen] = useState(false);
  const [seenLocally, setSeenLocally] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const count = seenLocally ? 0 : items.length;

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && items.length > 0) {
      setSeenLocally(true);
      markNotificationsSeen().then(() => router.refresh());
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={toggle}
        className="relative flex h-8 w-8 items-center justify-center rounded-full text-neutral-600 hover:bg-neutral-100"
        aria-label={count > 0 ? `${count} new notifications` : "Notifications"}
      >
        <span className="text-lg">🔔</span>
        {count > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-duty-red px-1 text-[10px] font-semibold text-white">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-2 w-80 overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-lg">
          <div className="border-b border-neutral-100 px-3 py-2 text-xs font-semibold text-neutral-500">
            Notifications
          </div>
          {items.length === 0 ? (
            <p className="px-3 py-4 text-sm text-neutral-500">Nothing new since you were last here.</p>
          ) : (
            <ul className="max-h-96 overflow-y-auto">
              {items.map((item) => (
                <li key={item.id} className="border-b border-neutral-50 last:border-0">
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className="flex items-start gap-2 px-3 py-2.5 text-sm hover:bg-neutral-50"
                  >
                    <span className="shrink-0">{item.icon}</span>
                    <span className="text-neutral-700">{item.text}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
