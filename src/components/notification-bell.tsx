"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { markNotificationsSeen } from "@/app/actions";
import type { NotificationItem, NotificationIcon } from "@/lib/notifications";
import { BellIcon, CommentIcon, LinkIcon, CheckCircleIcon, HourglassIcon, TagIcon, MegaphoneIcon } from "@/components/icons";

const ICONS_BY_TYPE: Record<NotificationIcon, (props: { className?: string }) => React.ReactElement> = {
  comment: CommentIcon,
  link: LinkIcon,
  approved: CheckCircleIcon,
  pending: HourglassIcon,
  tag: TagIcon,
  petition: MegaphoneIcon,
};

function NotificationRow({ item, onNavigate }: { item: NotificationItem; onNavigate: () => void }) {
  const Icon = ICONS_BY_TYPE[item.icon];
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className="flex items-start gap-2 px-3 py-2.5 text-sm hover:bg-neutral-50"
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-duty-purple" />
      <span className="text-neutral-700">{item.text}</span>
    </Link>
  );
}

// Site-wide bell in the header, replacing the old profile-page-only
// banner — this is computed in the root layout (server-side, every
// page) so it's visible no matter where you are, not just when you
// happen to visit /profile. Opening the dropdown marks the time-gated
// `items` as seen: that badge count clears immediately (optimistic, so
// it doesn't feel laggy) and markNotificationsSeen() persists that in
// the background, then router.refresh() re-fetches the layout so a
// page reload also starts clean. `pendingItems` (an open suggested edit
// still awaiting your review, etc.) is a different kind of thing — an
// ongoing status, not an event — so opening the bell does NOT clear it;
// it only goes away once the underlying thing is actually resolved.
export function NotificationBell({
  items,
  pendingItems,
}: {
  items: NotificationItem[];
  pendingItems: NotificationItem[];
}) {
  const [open, setOpen] = useState(false);
  const [seenLocally, setSeenLocally] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Real bug report: opening the bell marked `items` seen and called
  // router.refresh() immediately — which re-fetches this layout with the
  // now-updated notifications_seen_at, so the server's `items` prop came
  // back EMPTY while the dropdown was still open. The list you just
  // clicked to read would blank out from under you mid-read. Fix: freeze
  // what's shown in an independent snapshot the moment the dropdown
  // opens, and only let it track the live `items` prop while closed —
  // so a background refresh can never yank content out of an open
  // dropdown, only change what's ready for NEXT time you open it.
  const [displayedItems, setDisplayedItems] = useState<NotificationItem[]>(items);
  useEffect(() => {
    if (!open) setDisplayedItems(items);
  }, [items, open]);

  const newCount = seenLocally ? 0 : items.length;
  const count = newCount + pendingItems.length;

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
    // Only the time-gated `items` get marked seen here — pendingItems
    // are a status, not an event, so opening the dropdown must not make
    // them disappear. They only clear once the suggestion is actually
    // resolved (i.e. the next time this list is computed, it just won't
    // be in openSuggestionsOnMyProposals anymore).
    if (next && items.length > 0) {
      setSeenLocally(true);
      markNotificationsSeen().then(() => router.refresh());
    }
  }

  const hasAnything = pendingItems.length > 0 || displayedItems.length > 0;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={toggle}
        className="relative flex h-8 w-8 items-center justify-center rounded-full text-neutral-600 hover:bg-neutral-100"
        aria-label={count > 0 ? `${count} notifications` : "Notifications"}
      >
        <BellIcon className="h-5 w-5" />
        {count > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-duty-red px-1 text-[10px] font-semibold text-white">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-[2000] mt-2 w-80 overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-lg">
          <div className="border-b border-neutral-100 px-3 py-2 text-xs font-semibold text-neutral-500">
            Notifications
          </div>
          {!hasAnything ? (
            <p className="px-3 py-4 text-sm text-neutral-500">Nothing new since you were last here.</p>
          ) : (
            <div className="max-h-96 overflow-y-auto">
              {pendingItems.length > 0 && (
                <div>
                  <div className="bg-amber-50 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-amber-700">
                    Needs your review
                  </div>
                  <ul>
                    {pendingItems.map((item) => (
                      <li key={item.id} className="border-b border-neutral-50 last:border-0">
                        <NotificationRow item={item} onNavigate={() => setOpen(false)} />
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {displayedItems.length > 0 && (
                <div>
                  {pendingItems.length > 0 && (
                    <div className="bg-neutral-50 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                      New since you were last here
                    </div>
                  )}
                  <ul>
                    {displayedItems.map((item) => (
                      <li key={item.id} className="border-b border-neutral-50 last:border-0">
                        <NotificationRow item={item} onNavigate={() => setOpen(false)} />
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
