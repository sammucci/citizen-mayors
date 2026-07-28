"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toggleMemberBlocked } from "@/app/admin/actions";

// Blocking stops new posts/comments/votes from this member going
// forward — it never touches anything they've already posted. Blocking
// gets a one-step confirm (it does restrict someone); unblocking
// doesn't need one.
export function BlockMemberButton({ memberId, blocked }: { memberId: string; blocked: boolean }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [working, setWorking] = useState(false);

  async function submit(nextBlocked: boolean) {
    setWorking(true);
    const fd = new FormData();
    fd.set("member_id", memberId);
    fd.set("blocked", String(nextBlocked));
    await toggleMemberBlocked(fd);
    router.refresh();
    setWorking(false);
    setConfirming(false);
  }

  if (blocked) {
    return (
      <button
        type="button"
        disabled={working}
        onClick={() => submit(false)}
        className="rounded-full border border-neutral-300 px-2.5 py-1 text-xs text-neutral-600 hover:bg-neutral-50 disabled:opacity-50"
      >
        Unblock
      </button>
    );
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="rounded-full border border-neutral-300 px-2.5 py-1 text-xs text-neutral-600 hover:border-duty-red hover:text-duty-red"
      >
        Block
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        disabled={working}
        onClick={() => submit(true)}
        className="rounded-full bg-duty-red px-2.5 py-1 text-xs font-medium text-white disabled:opacity-50"
      >
        Confirm block
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="rounded-full border border-neutral-300 px-2.5 py-1 text-xs text-neutral-600 hover:bg-neutral-50"
      >
        Cancel
      </button>
    </div>
  );
}
