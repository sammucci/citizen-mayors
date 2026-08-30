import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { toggleFeedbackResolved, deleteFeedback } from "@/app/admin/actions";

export const dynamic = "force-dynamic";

// Inbox for the "Report an issue" widget (feedback-widget.tsx, on every
// page). Same admin-gate shape as every other /admin/* screen. Sorted
// unresolved-first so nothing needing a look gets buried under old,
// already-handled reports.
export default async function FeedbackAdminPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <p className="text-sm text-neutral-600">
        <Link href="/login" className="underline">
          Sign in
        </Link>{" "}
        to view this page.
      </p>
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) {
    return <p className="text-sm text-neutral-600">This page is admin-only.</p>;
  }

  const { data: reports } = await supabase
    .from("site_feedback")
    .select("id, message, page_path, resolved, created_at, profiles ( display_name )")
    .order("resolved", { ascending: true })
    .order("created_at", { ascending: false });

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/admin" className="text-xs text-neutral-500 underline hover:text-neutral-700">
        ← Back to admin dashboard
      </Link>
      <h1 className="mt-2 text-xl font-bold">Feedback</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Reports from the "Report an issue" button in the corner of every page — anyone can send
        one, signed in or not. Unresolved reports are listed first.
      </p>

      <ul className="mt-6 space-y-2">
        {reports?.map((r: any) => (
          <li
            key={r.id}
            className={`rounded-lg border p-3 ${
              r.resolved ? "border-neutral-200 bg-neutral-50" : "border-neutral-300 bg-white"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <p className={`text-sm ${r.resolved ? "text-neutral-500" : "text-neutral-800"}`}>
                {r.message}
              </p>
              {r.resolved && (
                <span className="shrink-0 rounded-full border border-neutral-300 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-neutral-500">
                  Resolved
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-neutral-400">
              {r.page_path ?? "Unknown page"} · {r.profiles?.display_name ?? "Not signed in"} ·{" "}
              {new Date(r.created_at).toLocaleString()}
            </p>
            <div className="mt-2 flex gap-1.5">
              <form action={toggleFeedbackResolved}>
                <input type="hidden" name="id" value={r.id} />
                <input type="hidden" name="resolved" value={String(r.resolved)} />
                <button className="rounded-full border border-neutral-300 px-2.5 py-1 text-xs text-neutral-600 hover:bg-white">
                  {r.resolved ? "Mark unresolved" : "Mark resolved"}
                </button>
              </form>
              <form action={deleteFeedback}>
                <input type="hidden" name="id" value={r.id} />
                <button className="rounded-full border border-neutral-300 px-2.5 py-1 text-xs text-duty-red hover:bg-white">
                  Delete
                </button>
              </form>
            </div>
          </li>
        ))}
        {(!reports || reports.length === 0) && (
          <p className="text-sm text-neutral-500">Nothing reported yet.</p>
        )}
      </ul>
    </div>
  );
}
