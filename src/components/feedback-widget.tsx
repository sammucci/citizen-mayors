"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { submitFeedback } from "@/app/actions";

// Floating "Report an issue" button, present on every page (rendered
// once from the root layout, not per-page). Built for the soft-launch
// working-group batch — a low-friction way to flag something confusing
// or broken without emailing Samantha directly, and real signal for
// what the click-through tutorial (still unbuilt) needs to cover.
//
// Deliberately works whether or not you're signed in — see
// submitFeedback in app/actions.ts. page_path is captured automatically
// via usePathname, not typed by hand, so a report always says where it
// happened even if the message itself doesn't mention it.
export function FeedbackWidget() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  function close() {
    setOpen(false);
    // Reset after the close animation-less collapse, not before — a
    // half-second delay would show the form clearing itself while still
    // visible, which reads as the message getting wiped, not sent.
    setTimeout(() => {
      setStatus("idle");
      setMessage("");
      setError(null);
    }, 200);
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {open && (
        <div className="mb-2 w-72 rounded-lg border border-neutral-200 bg-white p-3 shadow-lg">
          {status === "sent" ? (
            <div className="py-2 text-center">
              <p className="text-sm font-semibold text-neutral-800">Thanks — got it.</p>
              <p className="mt-0.5 text-xs text-neutral-500">
                Samantha reviews these directly.
              </p>
              <button
                type="button"
                onClick={close}
                className="mt-2 rounded-full border border-neutral-300 px-3 py-1 text-xs text-neutral-600 hover:bg-neutral-50"
              >
                Close
              </button>
            </div>
          ) : (
            <form
              action={async (formData) => {
                setStatus("sending");
                setError(null);
                const result = await submitFeedback(formData);
                if (result?.error) {
                  setError(result.error);
                  setStatus("error");
                } else {
                  setStatus("sent");
                }
              }}
            >
              <input type="hidden" name="page_path" value={pathname} />
              <p className="text-sm font-semibold text-neutral-800">Report an issue</p>
              <p className="mt-0.5 text-xs text-neutral-500">
                Something confusing or broken? Tell us what happened — no need to be signed in.
              </p>
              <textarea
                name="message"
                required
                autoFocus
                rows={4}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="What were you trying to do, and what happened instead?"
                className="mt-2 w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
              />
              <div className="mt-2 flex items-center gap-1.5">
                <button
                  disabled={status === "sending"}
                  className="rounded-full bg-duty-purple px-3 py-1 text-xs font-semibold text-white disabled:opacity-60"
                >
                  {status === "sending" ? "Sending…" : "Send"}
                </button>
                <button
                  type="button"
                  onClick={close}
                  className="rounded-full border border-neutral-300 px-3 py-1 text-xs text-neutral-600 hover:bg-neutral-50"
                >
                  Cancel
                </button>
              </div>
              {error && <p className="mt-1 text-xs text-duty-red">{error}</p>}
            </form>
          )}
        </div>
      )}

      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-full bg-neutral-800 px-4 py-2 text-xs font-semibold text-white shadow-lg hover:bg-neutral-700"
        >
          Report an issue
        </button>
      )}
    </div>
  );
}
