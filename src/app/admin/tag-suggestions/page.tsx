import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { approveTagSuggestion, rejectTagSuggestion } from "@/app/admin/actions";

export const dynamic = "force-dynamic";

// Gated behind profiles.is_admin (not a separate password) — the same
// login already used everywhere else on the site, just with one flag
// flipped on Samantha's account. Signed-out or non-admin visitors get
// bounced with a plain message rather than a crash, same pattern as the
// profile page.
export default async function TagSuggestionsAdminPage() {
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

  const { data: suggestions } = await supabase
    .from("tag_suggestions")
    .select(
      "id, label, status, created_at, proposal_id, suggested_by, proposals ( title ), profiles:suggested_by ( display_name )"
    )
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-xl font-bold">Tag suggestions</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Approving creates the tag for real and attaches it to the proposal
        it was suggested on. Rejecting just dismisses it.
      </p>

      <ul className="mt-6 space-y-3">
        {suggestions?.map((s: any) => (
          <li
            key={s.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-neutral-200 bg-white p-4"
          >
            <div>
              <span className="text-base font-semibold">{s.label}</span>
              <p className="mt-0.5 text-xs text-neutral-500">
                Suggested by{" "}
                <Link href={`/u/${s.suggested_by}`} className="underline">
                  {s.profiles?.display_name ?? "a resident"}
                </Link>{" "}
                on{" "}
                <Link
                  href={`/proposals/${s.proposal_id}`}
                  className="underline"
                >
                  {s.proposals?.title ?? "a proposal"}
                </Link>
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <form action={approveTagSuggestion}>
                <input type="hidden" name="suggestion_id" value={s.id} />
                <input type="hidden" name="proposal_id" value={s.proposal_id} />
                <input type="hidden" name="label" value={s.label} />
                <button className="rounded-full bg-green-600 px-3 py-1 text-xs font-medium text-white hover:bg-green-700">
                  Approve
                </button>
              </form>
              <form action={rejectTagSuggestion}>
                <input type="hidden" name="suggestion_id" value={s.id} />
                <input type="hidden" name="proposal_id" value={s.proposal_id} />
                <button className="rounded-full border border-neutral-300 px-3 py-1 text-xs text-neutral-600 hover:border-duty-red hover:text-duty-red">
                  Reject
                </button>
              </form>
            </div>
          </li>
        ))}
        {(!suggestions || suggestions.length === 0) && (
          <p className="text-sm text-neutral-500">Nothing pending right now.</p>
        )}
      </ul>
    </div>
  );
}
