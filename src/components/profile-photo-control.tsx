"use client";

import { useState } from "react";

const MAX_BYTES = 20 * 1024 * 1024; // matches every other upload control's server-side message

// Generic version of avatar-upload-control.tsx (src/app/actions.ts's
// updateAvatar) — same open/close-on-success, size-check-up-front, and
// {error?} handling, just parameterized so decision-maker photos and
// organization logos can share one component instead of two near-
// identical copies. `hiddenFields` fills in whatever id the specific
// upload/remove action needs (decision_maker_id or organization_id).
export function ProfilePhotoControl({
  imageUrl,
  fallbackLabel,
  shape = "circle",
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
  fieldName: string;
  hiddenFields: Record<string, string>;
  uploadAction: (formData: FormData) => Promise<{ error?: string }>;
  removeAction?: (formData: FormData) => Promise<{ error?: string }>;
  addLabel?: string;
  changeLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const initial = (fallbackLabel || "?").trim().charAt(0).toUpperCase();
  const shapeClass = shape === "circle" ? "rounded-full" : "rounded-lg";

  return (
    <div className="flex items-center gap-3">
      <div className={`h-14 w-14 shrink-0 overflow-hidden ${shapeClass} bg-duty-purple/10 text-duty-purple`}>
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-lg font-semibold">
            {initial}
          </div>
        )}
      </div>

      {!open ? (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setError(null);
              setOpen(true);
            }}
            className="rounded-full border border-neutral-300 px-3 py-1 text-xs text-neutral-600 hover:bg-neutral-50"
          >
            {imageUrl ? changeLabel : addLabel}
          </button>
          {imageUrl && removeAction && (
            !confirmingRemove ? (
              <button
                type="button"
                onClick={() => setConfirmingRemove(true)}
                className="rounded-full border border-neutral-300 px-3 py-1 text-xs text-neutral-500 hover:border-duty-red hover:text-duty-red"
              >
                Remove
              </button>
            ) : (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={async () => {
                    const fd = new FormData();
                    Object.entries(hiddenFields).forEach(([k, v]) => fd.set(k, v));
                    const result = await removeAction(fd);
                    if (result?.error) {
                      setError(result.error);
                      return;
                    }
                    setConfirmingRemove(false);
                  }}
                  className="rounded-full bg-duty-red px-3 py-1 text-xs font-medium text-white"
                >
                  Confirm
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingRemove(false)}
                  className="rounded-full border border-neutral-300 px-3 py-1 text-xs text-neutral-600 hover:bg-neutral-50"
                >
                  Cancel
                </button>
              </div>
            )
          )}
        </div>
      ) : (
        <div>
          <form
            action={async (formData) => {
              const file = formData.get(fieldName);
              if (file instanceof File && file.size > MAX_BYTES) {
                setError("Your image is too big — try a smaller file (under 20MB).");
                return;
              }
              Object.entries(hiddenFields).forEach(([k, v]) => formData.set(k, v));
              setError(null);
              const result = await uploadAction(formData);
              if (result?.error) {
                setError(result.error);
                return;
              }
              setOpen(false);
            }}
            className="flex flex-wrap items-center gap-2"
          >
            <input
              type="file"
              name={fieldName}
              accept="image/*"
              className="text-xs"
              onChange={() => setError(null)}
            />
            <button className="shrink-0 rounded bg-duty-purple px-3 py-1 text-xs text-white">
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
        </div>
      )}
      {error && <p className="mt-1 w-full text-xs text-duty-red">{error}</p>}
    </div>
  );
}
