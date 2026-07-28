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
    .select(
      "id, body, is_suggested_edit, status, created_at, proposal_id, proposals ( title, categories ( color ) )"
    )
    .eq("author_id", user.id)
    .order("created_at", { ascending: false });

  // Grouped by proposal so "Your comments" reads as one row per
  // conversation you've been part of, not a flat list repeating the
  // same proposal title over and over if you commented several times
  // in the same thread. Carries the category color along too, so you
  // can tell what kind of project each conversation was about at a
  // glance, same as the proposal cards.
  const commentsByProposal = new Map<
    string,
    { title: string; color: string | null; comments: any[] }
  >();
  for (const c of (myComments ?? []) as any[]) {
    const key = c.proposal_id;
    if (!commentsByProposal.has(key)) {
      commentsByProposal.set(key, {
        title: c.proposals?.title ?? "A proposal",
        color: c.proposals?.categories?.color ?? null,
        comments: [],
      });
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
        {/* Two-column grid of small "mini cards" — half the width of the
            old full-width rows — each tinted with its category color so
            the colors read at a glance again, not just on the thumbnail. */}
        <ul className="mt-3 grid grid-cols-2 gap-2.5">
          {myProposals?.map((p: any) => {
            const color = p.categories?.color ?? "#e5e5e5";
            return (
              <li
                key={p.id}
                className="flex flex-col overflow-hidden rounded-lg border"
                style={{ backgroundColor: `${color}1a`, borderColor: `${color}66` }}
              >
                <div
                  className="h-16 w-full shrink-0 overflow-hidden"
                  style={{ backgroundColor: color }}
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
                <div className="min-w-0 p-2">
                  <Link
                    href={`/proposals/${p.id}`}
                    className="block truncate text-xs font-semibold hover:underline"
                  >
                    {p.title}
                  </Link>
                  <p className="mt-0.5 truncate text-[10px] uppercase tracking-wide text-neutral-500">
                    {p.categories?.label}
                    {p.categories?.label ? " · " : ""}
                    {p.type}
                  </p>
                </div>
              </li>
            );
          })}
          {(!myProposals || myProposals.length === 0) && (
            <p className="col-span-2 text-sm text-neutral-500">
              You haven&apos;t posted a proposal yet.
            </p>
          )}
        </ul>
      </div>

      <div>
        <h2 className="text-lg font-semibold">Your comments</h2>
        {/* One dropdown per proposal you've commented on, instead of a
            flat list that repeats the proposal title for every comment —
            click to see the comments you made there. A left-edge color
            stripe (same idea as the proposal cards) gives a quick visual
            read of what kind of project each conversation was about. */}
        <ul className="mt-3 space-y-2">
          {[...commentsByProposal.entries()].map(([proposalId, group]) => (
            <li
              key={proposalId}
              className="overflow-hidden rounded-lg border border-l-4 border-neutral-200 bg-white"
              style={{ borderLeftColor: group.color ?? "#d4d4d4" }}
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
