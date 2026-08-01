"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { signOut } from "@/app/actions";

// Was three separate things in the header — an Admin link, a "Hello,
// {name}" link, and a Sign out button — competing for space and reading
// like three unrelated nav items. Consolidated into one dropdown under
// your name: Admin only shows up in here for whoever actually has
// is_admin set, same as before, just tucked into the same menu instead
// of its own top-level link.
export function UserMenu({
  displayName,
  isAdmin,
}: {
  displayName: string;
  isAdmin: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

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

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 text-neutral-600 hover:underline"
      >
        Hello, {displayName}
        <span className="text-[10px]">▾</span>
      </button>

      {open && (
        <div className="absolute right-0 z-[2000] mt-2 w-44 overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-lg">
          <Link
            href="/profile"
            onClick={() => setOpen(false)}
            className="block px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50"
          >
            Your profile
          </Link>
          {isAdmin && (
            <Link
              href="/admin"
              onClick={() => setOpen(false)}
              className="block px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50"
            >
              Admin
            </Link>
          )}
          <form action={signOut}>
            <button
              type="submit"
              className="block w-full border-t border-neutral-100 px-3 py-2 text-left text-sm font-medium text-neutral-700 hover:bg-neutral-50"
            >
              Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
