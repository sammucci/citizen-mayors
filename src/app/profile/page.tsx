import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ProfileInfoCard } from "@/components/profile-info-card";
import { statusColorClasses } from "@/lib/status-colors";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
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
        to see your profile.
      </p>
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  const { data: myProposals } = await supabase
    .from("proposals")
    .select(
      "id, title, type, created_at, image_url, image_position_x, image_position_y, categories ( label, color )"
    )
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false });

  const { data: myComments } = await supabase
    .from("comments")
    .select("id, body, is_suggested_edit, status, created_at, proposal_id, proposals ( title )")
    .eq("author_id", user.id)
    .order("created_at", { ascending: false });

  // Grouped by proposal so "Your comments" reads as one row per
  // conversation you've been part of, not a flat list repeating the
  // same proposal title over and over if you commented several times
  // in the same thread.
  const commentsByProposal = new Map<string, { title: string; comments: any[] }>();
  for (const c of (myComments ?? []) as any[]) {
    const key = c.proposal_id;
    if (!commentsByProposal.has(key)) {
      commentsByProposal.set(key, { title: c.proposals?.title ?? "A proposal", comments: [] });
    }
    commentsByProposal.get(key)!.comments.push(c);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Your profile</h1>
        <p className="mt-1 text-sm text-neutral-600">{user.email}</p>
      </div>

      <ProfileInfoCard profile={profile} />

      <div>
        <h2 className="text-lg font-semibold">Your proposals</h2>
        {/* Mini versions of the homepage dashboard cards, not the old flat
            tinted boxes — a small thumbnail plus title/category/type so
            these read as the same kind of card everywhere on the site. */}
        <ul className="mt-3 space-y-2">
          {myProposals?.map((p: any) => (
            <li
              key={p.id}
              className="flex items-center gap-3 overflow-hidden rounded-lg border border-neutral-200 bg-white p-2"
            >
              <div
                className="h-14 w-14 shrink-0 overflow-hidden rounded-md"
                style={{ backgroundColor: p.categories?.color ?? "#e5e5e5" }}
              >
                {p.image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.image_url}
                    alt=""
                    className="h-full w-full object-cover"
                    style={{
                      objectPosition: `${p.image_position_x ?? 50}% ${p.image_position_y ?? 50}%`,
                    }}
                  />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <Link
                  href={`/proposals/${p.id}`}
                  className="block truncate text-sm font-semibold hover:underline"
                >
                  {p.title}
                </Link>
                <p className="mt-0.5 text-xs uppercase tracking-wide text-neutral-500">
                  {p.categories?.label}
                  {p.categories?.label ? " · " : ""}
                  {p.type}
                </p>
              </div>
            </li>
          ))}
          {(!myProposals || myProposals.length === 0) && (
            <p className="text-sm text-neutral-500">
              You haven&apos;t posted a proposal yet.
            </p>
          )}
        </ul>
      </div>

      <div>
        <h2 className="text-lg font-semibold">Your comments</h2>
        {/* One dropdown per proposal you've commented on, instead of a
            flat list that repeats the proposal title for every comment —
            click to see the comments you made there. */}
        <ul className="mt-3 space-y-2">
          {[...commentsByProposal.entries()].map(([proposalId, group]) => (
            <li
              key={proposalId}
              className="overflow-hidden rounded-lg border border-neutral-200 bg-white"
            >
              <details>
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 text-sm font-medium marker:content-none">
                  <span className="truncate">{group.title}</span>
                  <span className="shrink-0 text-xs font-normal text-neutral-400">
                    {group.comments.length} comment{group.comments.length === 1 ? "" : "s"}
                  </span>
                </summary>
                <ul className="space-y-2 border-t border-neutral-100 p-3">
                  <li>
                    <Link
                      href={`/proposals/${proposalId}`}
                      className="text-xs text-neutral-500 underline"
                    >
                      View proposal
                    </Link>
                  </li>
                  {group.comments.map((c: any) => (
                    <li key={c.id} className="text-sm">
                      <p className="text-neutral-600">{c.body}</p>
                      {c.is_suggested_edit && (
                        <span
                          className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs ${statusColorClasses(c.status)}`}
                        >
                          Suggested edit · {c.status.replace(/_/g, " ")}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </details>
            </li>
          ))}
          {commentsByProposal.size === 0 && (
            <p className="text-sm text-neutral-500">
              You haven&apos;t commented on anything yet.
            </p>
          )}
        </ul>
      </div>
    </div>
  );
}
