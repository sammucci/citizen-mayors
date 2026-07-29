import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { BlockMemberButton } from "@/components/block-member-button";

export const dynamic = "force-dynamic";

// The third piece of the admin dashboard, alongside tag suggestions
// and the decision-maker registry. Also where an admin can block a
// member if they spot abuse — blocking stops new posts/comments/votes
// but never retroactively hides or deletes anything already posted
// (same reversible philosophy as the proposal publish/unpublish
// toggle). Full ban/delete-account is intentionally NOT built here —
// blocking future activity while leaving history intact is the safer
// default; ask if you also want a way to remove someone's account
// entirely.
export default async function AdminMembersPage() {
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

  const { data: members } = await supabase
    .from("profiles")
    .select("id, display_name, zip_code, council_district, is_admin, is_blocked, created_at, avatar_url")
    .order("created_at", { ascending: false });

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/admin" className="text-xs text-neutral-500 underline hover:text-neutral-700">
        ← Back to admin dashboard
      </Link>
      <h1 className="mt-2 text-xl font-bold">Members</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Everyone registered on the platform, newest first — {members?.length ?? 0} total.
      </p>

      <ul className="mt-6 space-y-2">
        {members?.map((m: any) => (
          <li
            key={m.id}
            className="flex items-center justify-between gap-3 rounded-lg border border-neutral-200 bg-white p-3"
          >
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full bg-duty-purple/10 text-duty-purple">
                {m.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.avatar_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-sm font-semibold">
                    {(m.display_name || "?").trim().charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <div>
                <p className="text-sm font-semibold">
                  {m.display_name || "Unnamed resident"}
                  {m.is_admin && (
                    <span className="ml-1.5 rounded-full bg-duty-purple/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-duty-purple">
                      Admin
                    </span>
                  )}
                  {m.is_blocked && (
                    <span className="ml-1.5 rounded-full bg-duty-red/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-duty-red">
                      Blocked
                    </span>
                  )}
                </p>
                <p className="text-xs text-neutral-500">
                  {m.zip_code ? `Zip ${m.zip_code}` : "No zip shared"}
                  {m.council_district ? ` · District ${m.council_district}` : ""}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Link
                href={`/u/${m.id}`}
                className="rounded-full border border-neutral-300 px-2.5 py-1 text-xs text-neutral-600 hover:bg-neutral-50"
              >
                View
              </Link>
              {m.id !== user.id && <BlockMemberButton memberId={m.id} blocked={Boolean(m.is_blocked)} />}
              <span className="text-xs text-neutral-400">
                Joined {new Date(m.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
              </span>
            </div>
          </li>
        ))}
        {(!members || members.length === 0) && (
          <p className="text-sm text-neutral-500">No one's registered yet.</p>
        )}
      </ul>
    </div>
  );
}
