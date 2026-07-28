"use client";

import { useState } from "react";
import { updateAvatar } from "@/app/actions";

const MAX_BYTES = 20 * 1024 * 1024; // 20MB — matches the server-side message

// Small circular avatar with a "Change photo" control underneath —
// same open/close-on-success and size-check-up-front pattern as the
// proposal cover image control, just circular and profile-scoped.
export function AvatarUploadControl({
  displayName,
  avatarUrl,
}: {
  displayName: string | null;
  avatarUrl: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const initial = (displayName || "?").trim().charAt(0).toUpperCase();

  return (
    <div className="flex items-center gap-3">
      <div className="h-14 w-14 shrink-0 overflow-hidden rounded-full bg-duty-purple/10 text-duty-purple">
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-lg font-semibold">
            {initial}
          </div>
        )}
      </div>

      {!open ? (
        <button
          type="button"
          onClick={() => {
            setError(null);
            setOpen(true);
          }}
          className="rounded-full border border-neutral-300 px-3 py-1 text-xs text-neutral-600 hover:bg-neutral-50"
        >
          {avatarUrl ? "Change photo" : "Add a photo"}
        </button>
      ) : (
        <div>
          <form
            action={async (formData) => {
              const file = formData.get("avatar");
              if (file instanceof File && file.size > MAX_BYTES) {
                setError("Your image is too big — try a smaller file (under 20MB).");
                return;
              }
              setError(null);
              const result = await updateAvatar(formData);
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
              name="avatar"
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
          {error && <p className="mt-1 text-xs text-duty-red">{error}</p>}
        </div>
      )}
    </div>
  );
}
