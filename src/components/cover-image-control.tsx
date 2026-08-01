"use client";

import { useState } from "react";
import { removeProposalImage, updateProposalImage } from "@/app/proposals/actions";
import { readableTextColor } from "@/lib/readable-text-color";

const MAX_BYTES = 20 * 1024 * 1024; // 20MB — matches the server-side message

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
//
// The overlay also has a "Remove" link next to "Change image" — up until
// now the only way to get rid of a cover image was to upload a
// replacement, with no way back if you just wanted it gone. Asks for a
// quick "Remove image? Yes/Cancel" confirm first since it's a real
// delete, but doesn't need the heavier "type delete to confirm" bar used
// elsewhere (a note log) — an image is one re-upload away from being
// back if this turns out to be a misclick.
//
// Also fixes a real "is this broken?" moment: a too-large file used to
// just fail silently — the upload action swallowed every error and only
// logged it server-side, so clicking Upload on a big photo looked like
// nothing happened at all. Checks file size up front for instant
// feedback, and now actually surfaces whatever the server reports back
// too (wrong file type, storage hiccup, etc.), not just size.
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
  const [error, setError] = useState<string | null>(null);
  const [confirmingRemove, setConfirmingRemove] = useState(false);

  if (!open) {
    if (variant === "overlay") {
      if (confirmingRemove) {
        return (
          <div className="absolute bottom-2 right-2 max-w-[85%] rounded bg-black/70 px-2 py-1 text-xs text-white">
            <form
              action={async (formData) => {
                setError(null);
                const result = await removeProposalImage(formData);
                if (result?.error) {
                  setError(result.error);
                  return;
                }
                setConfirmingRemove(false);
              }}
              className="flex items-center gap-2"
            >
              <input type="hidden" name="proposal_id" value={proposalId} />
              <span>Remove image?</span>
              <button className="underline decoration-white/70 hover:opacity-80">
                Yes, remove
              </button>
              <button
                type="button"
                onClick={() => setConfirmingRemove(false)}
                className="underline decoration-white/70 hover:opacity-80"
              >
                Cancel
              </button>
            </form>
            {error && <p className="mt-1 text-white">{error}</p>}
          </div>
        );
      }
      return (
        <div className="absolute bottom-2 right-2 flex items-center gap-1.5 rounded bg-black/55 px-2 py-1 text-xs text-white">
          <button
            type="button"
            onClick={() => {
              setError(null);
              setOpen(true);
            }}
            className="underline decoration-white/70 hover:opacity-80"
          >
            Change image
          </button>
          <span aria-hidden="true" className="text-white/50">
            ·
          </span>
          <button
            type="button"
            onClick={() => setConfirmingRemove(true)}
            className="underline decoration-white/70 hover:opacity-80"
          >
            Remove
          </button>
        </div>
      );
    }
    return (
      <button
        type="button"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
        className="inline-flex items-center gap-1.5 rounded-full border border-neutral-300 px-2.5 py-1 text-xs text-neutral-600 hover:bg-neutral-50"
      >
        🖼️ {hasImage ? "Change cover image" : "Add a cover image"}
      </button>
    );
  }

  return (
    <div
      className={
        variant === "overlay"
          ? "absolute bottom-2 right-2 max-w-[85%] rounded bg-white/95 p-1.5 shadow"
          : "mt-2"
      }
    >
      <form
        action={async (formData) => {
          const file = formData.get("image");
          if (file instanceof File && file.size > MAX_BYTES) {
            setError("Your image is too big — try a smaller file (under 20MB).");
            return;
          }
          setError(null);
          const result = await updateProposalImage(formData);
          if (result?.error) {
            setError(result.error);
            return;
          }
          setOpen(false);
        }}
        className="flex flex-wrap items-center gap-2"
      >
        <input type="hidden" name="proposal_id" value={proposalId} />
        <input
          type="file"
          name="image"
          accept="image/*"
          className="text-xs"
          onChange={() => setError(null)}
        />
        <button
          className="shrink-0 rounded px-3 py-1 text-xs"
          style={{ backgroundColor: categoryColor, color: readableTextColor(categoryColor) }}
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
      {error && <p className="mt-1 text-xs text-duty-red">{error}</p>}
    </div>
  );
}
