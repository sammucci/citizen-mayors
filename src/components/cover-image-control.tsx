"use client";

import { useState } from "react";
import { updateProposalImage } from "@/app/proposals/actions";

// Was a native <details> in the owner-utility row — like the old Reply
// toggle, once opened (to pick a file and upload) it just stayed open
// through the page refresh after a successful upload, leaving the
// file-picker sitting there looking unfinished. This tracks open/closed
// itself and collapses back down after a successful upload.
//
// Two visual forms depending on whether a cover image already exists:
// "pill" (no image yet — same small button as before, sits in the
// owner-utility row) and "overlay" (an image exists — small underlined
// "Change image" link in the image's own bottom-right corner instead,
// so the utility row isn't cluttered with a control for something
// that's already visibly right there).
export function CoverImageControl({
  proposalId,
  hasImage,
  categoryColor,
  variant,
}: {
  proposalId: string;
  hasImage: boolean;
  categoryColor: string;
  variant: "pill" | "overlay";
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    if (variant === "overlay") {
      return (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="absolute bottom-2 right-2 rounded bg-black/55 px-2 py-1 text-xs text-white underline decoration-white/70 hover:bg-black/70"
        >
          Change image
        </button>
      );
    }
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-full border border-neutral-300 px-2.5 py-1 text-xs text-neutral-600 hover:bg-neutral-50"
      >
        🖼️ {hasImage ? "Change cover image" : "Add a cover image"}
      </button>
    );
  }

  return (
    <form
      action={async (formData) => {
        await updateProposalImage(formData);
        setOpen(false);
      }}
      className={
        variant === "overlay"
          ? "absolute bottom-2 right-2 flex items-center gap-1.5 rounded bg-white/95 p-1.5 shadow"
          : "mt-2 flex flex-wrap items-center gap-2"
      }
    >
      <input type="hidden" name="proposal_id" value={proposalId} />
      <input type="file" name="image" accept="image/*" className="text-xs" />
      <button
        className="shrink-0 rounded px-3 py-1 text-xs text-white"
        style={{ backgroundColor: categoryColor }}
      >
        Upload
      </button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="shrink-0 rounded border border-neutral-300 px-2 py-1 text-xs text-neutral-600 hover:bg-neutral-50"
      >
        Cancel
      </button>
    </form>
  );
}
