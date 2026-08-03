"use client";

import { useState } from "react";

const MAX_BYTES = 20 * 1024 * 1024; // matches every other upload control's server-side message

// Generic version of avatar-upload-control.tsx (src/app/actions.ts's
// updateAvatar) — same size-check-up-front and {error?} handling, just
// parameterized so decision-maker photos and organization logos can
// share one component instead of two near-identical copies.
// `hiddenFields` fills in whatever id the specific upload/remove action
// needs (decision_maker_id or organization_id).
//
// Redesigned from a photo + always-visible "Change photo"/"Remove"
// buttons sitting next to it (read as cluttered/unfinished) to a plain
// photo with those controls tucked behind a hover/focus overlay
// instead — a ✎ that opens the file picker directly (no separate
// "Upload" button; picking a file uploads it right away) and a small ✕
// badge for Remove, both invisible until you hover or tab onto the
// photo.
export function ProfilePhotoControl({
  imageUrl,
  fallbackLabel,
  shape = "circle",
  size = "md",
  fieldName,
  hiddenFields,
  uploadAction,
  removeAction,
  addLabel = "Add a photo",
  changeLabel = "Change photo",
}: {
  imageUrl: string | null;
  fallbackLabel: string;
  shape?: "circle" | "square";
  size?: "md" | "lg";
  fieldName: string;
  hiddenFields: Record<string, string>;
  uploadAction: (formData: FormData) => Promise<{ error?: string }>;
  removeAction?: (formData: FormData) => Promise<{ error?: string }>;
  addLabel?: string;
  changeLabel?: string;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const initial = (fallbackLabel || "?").trim().charAt(0).toUpperCase();
  const shapeClass = shape === "circle" ? "rounded-full" : "rounded-lg";
  const sizeClass = size === "lg" ? "h-24 w-24" : "h-14 w-14";
  const initialTextClass = size === "lg" ? "text-3xl" : "text-lg";

  async function handleFileSelected(file: File | undefined) {
    if (!file) return;
    if (file.size > MAX_BYTES) {
      setError("Your image is too big — try a smaller file (under 20MB).");
      return;
    }
    const fd = new FormData();
    Object.entries(hiddenFields).forEach(([k, v]) => fd.set(k, v));
    fd.set(fieldName, file);
    setError(null);
    setUploading(true);
    const result = await uploadAction(fd);
    setUploading(false);
    if (result?.error) {
      setError(result.error);
    }
  }

  async function handleConfirmRemove() {
    if (!removeAction) return;
    const fd = new FormData();
    Object.entries(hiddenFields).forEach(([k, v]) => fd.set(k, v));
    const result = await removeAction(fd);
    if (result?.error) {
      setError(result.error);
      return;
    }
    setConfirmingRemove(false);
  }

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div
        className={`group relative ${sizeClass} shrink-0 overflow-hidden ${shapeClass} bg-duty-purple/10 text-duty-purple`}
      >
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className={`flex h-full w-full items-center justify-center font-semibold ${initialTextClass}`}>
            {initial}
          </div>
        )}

        {/* Hover/focus-revealed overlay — invisible until you mouse over
            or tab onto the photo, so a clean photo (or plain initial) is
            all that shows the rest of the time. */}
        <label
          className={`absolute inset-0 flex cursor-pointer items-center justify-center text-transparent opacity-0 transition group-hover:bg-black/50 group-hover:text-white group-hover:opacity-100 group-focus-within:bg-black/50 group-focus-within:text-white group-focus-within:opacity-100 ${shapeClass}`}
          title={imageUrl ? changeLabel : addLabel}
        >
          <span aria-hidden="true" className="text-lg">
            ✎
          </span>
          <span className="sr-only">{imageUrl ? changeLabel : addLabel}</span>
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = ""; // lets picking the same file again re-fire onChange
              handleFileSelected(file);
            }}
            disabled={uploading}
          />
        </label>

        {imageUrl && removeAction && (
          <button
            type="button"
            onClick={() => setConfirmingRemove(true)}
            title="Remove photo"
            className="absolute right-1 top-1 hidden h-5 w-5 items-center justify-center rounded-full bg-white/90 text-xs leading-none text-neutral-600 hover:bg-white hover:text-duty-red group-hover:flex group-focus-within:flex"
          >
            <span aria-hidden="true">✕</span>
            <span className="sr-only">Remove photo</span>
          </button>
        )}

        {uploading && (
          <div className={`absolute inset-0 flex items-center justify-center bg-white/70 text-[10px] font-medium text-neutral-600 ${shapeClass}`}>
            Uploading…
          </div>
        )}
      </div>

      {confirmingRemove && (
        <div className="flex items-center gap-1.5 whitespace-nowrap rounded-md border border-neutral-200 bg-white px-2 py-1 text-[11px] shadow-sm">
          <span className="text-neutral-600">Remove?</span>
          <button type="button" onClick={handleConfirmRemove} className="font-medium text-duty-red">
            Remove
          </button>
          <button
            type="button"
            onClick={() => setConfirmingRemove(false)}
            className="text-neutral-500"
          >
            Cancel
          </button>
        </div>
      )}

      {error && <p className="max-w-[9rem] text-center text-[11px] text-duty-red">{error}</p>}
    </div>
  );
}
