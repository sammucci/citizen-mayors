import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Public profile — deliberately narrow. All that's ever shown here is a
// name, an optional short bio the person wrote themselves, and their
// proposals/comments (both already fully public elsewhere on the site,
// just gathered in one place — same idea as a Reddit user page). Zip
// code, council district, and every demographic field (age, race,
// gender, housing status) are NEVER queried or rendered on this page,
// full stop, regardless of what's set on the profile — those stay
// aggregate-only on the community dashboard. Public by default (no
// opt-in toggle) since the rest of the platform already works this way
// — proposals, comments, and decision-maker notes are all public too.
export default async function PublicProfilePage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, display_name, bio, avatar_url")
    .eq("id", params.id)
    .maybeSingle();

  if (!profile) {
    return <p className="text-sm text-neutral-600">This resident couldn&apos;t be found.</p>;
  }

  const [{ data: proposals }, { data: comments }] = await Promise.all([
    supabase
      .from("proposals")
      .select(
        "id, title, type, created_at, image_url, image_position_x, image_position_y, categories ( label, color )"
      )
      .eq("owner_id", profile.id)
      // Same fix as the homepage grid: this page's whole premise is "only
      // ever shows what's already public elsewhere," so an unpublished
      // draft has no business appearing on someone's public profile.
      .eq("published", true)
      .order("created_at", { ascending: false }),
    supabase
      .from("comments")
      .select("id, body, created_at, proposal_id, proposals ( title, categories ( color ) )")
      .eq("author_id", profile.id)
      .order("created_at", { ascending: false }),
  ]);

  // Grouped by proposal, same shape as the "Your comments" section on
  // the owner's own /profile page. A comment whose parent proposal is
  // unpublished (or gone) comes back with `proposals: null` here —
  // Postgres RLS on the proposals table applies inside this join too —
  // so those are dropped entirely rather than shown with a blank title
  // and a dead link. Comments have their own always-public read policy
  // with no awareness of the proposal's published state, so without
  // this filter a stray comment could keep showing here after its
  // proposal was taken down.
  const commentsByProposal = new Map<string, { title: string; color: string | null; comments: any[] }>();
  for (const c of (comments ?? []) as any[]) {
    if (!c.proposals) continue;
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
      <div className="flex items-center gap-3">
        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-full bg-duty-purple/10 text-duty-purple">
          {profile.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xl font-semibold">
              {(profile.display_name || "?").trim().charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        <div>
          <h1 className="text-xl font-semibold">{profile.display_name || "Unnamed resident"}</h1>
          {profile.bio && <p className="mt-0.5 text-sm text-neutral-600">{profile.bio}</p>}
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold">Proposals</h2>
        <ul className="mt-3 grid grid-cols-2 gap-2.5">
          {proposals?.map((p: any) => {
            const color = p.categories?.color ?? "#e5e5e5";
            return (
              <li
                key={p.id}
                className="flex items-center overflow-hidden rounded-lg border"
                style={{ backgroundColor: `${color}1a`, borderColor: `${color}66` }}
              >
                <div className="h-16 w-16 shrink-0 overflow-hidden" style={{ backgroundColor: color }}>
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
                  <Link href={`/proposals/${p.id}`} className="block truncate text-sm font-semibold hover:underline">
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
          {(!proposals || proposals.length === 0) && (
            <p className="col-span-2 text-sm text-neutral-500">No proposals yet.</p>
          )}
        </ul>
      </div>

      <div>
        <h2 className="text-lg font-semibold">Comments</h2>
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
                    <Link href={`/proposals/${proposalId}`} className="text-xs text-neutral-500 underline">
                      View proposal
                    </Link>
                  </li>
                  {group.comments.map((c: any) => (
                    <li key={c.id} className="text-sm text-neutral-600">
                      {c.body}
                    </li>
                  ))}
                </ul>
              </details>
            </li>
          ))}
          {commentsByProposal.size === 0 && (
            <p className="text-sm text-neutral-500">No comments yet.</p>
          )}
        </ul>
      </div>
    </div>
  );
}
