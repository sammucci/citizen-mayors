import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { DecisionMakerProfileEditor } from "@/components/decision-maker-profile-editor";
import { ProposalMiniCardGrid } from "@/components/proposal-mini-card-grid";

export const dynamic = "force-dynamic";

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

// Public profile page — no login needed to view (matches the "public
// read" RLS policies on all three new tables), only to edit. v1 is
// elected-officials-only per Samantha's call: a department or board
// still resolves here (so a stray link never 404s), but just shows the
// basic registry info instead of the full wiki treatment, since terms/
// elections/committees don't mean anything for those kinds.
export default async function DecisionMakerProfilePage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: decisionMaker } = await supabase
    .from("decision_makers")
    .select("id, name, kind")
    .eq("id", params.id)
    .maybeSingle();

  if (!decisionMaker) {
    return (
      <div className="mx-auto max-w-2xl">
        <p className="text-sm text-neutral-600">
          Couldn&apos;t find that decision-maker.{" "}
          <Link href="/decision-makers" className="underline">
            View all decision-makers
          </Link>
        </p>
      </div>
    );
  }

  const isElectedOfficial = decisionMaker.kind === "elected_official";

  let profile = null;
  let legislationRaw: any[] = [];
  let revisions: any[] = [];
  let representsCount: number | null = null;
  let isAdmin = false;

  if (user) {
    const { data: viewerProfile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .maybeSingle();
    isAdmin = Boolean(viewerProfile?.is_admin);
  }

  if (isElectedOfficial) {
    const [{ data: profileRow }, { data: legislationData }, { data: revisionsData }] = await Promise.all([
      supabase.from("decision_maker_profiles").select("*").eq("decision_maker_id", decisionMaker.id).maybeSingle(),
      supabase
        .from("decision_maker_legislation")
        .select("id, title, stance, note, occurred_on, added_by, profiles:added_by ( display_name )")
        .eq("decision_maker_id", decisionMaker.id)
        .order("occurred_on", { ascending: false, nullsFirst: false }),
      supabase
        .from("decision_maker_revisions")
        .select("id, field_name, old_value, new_value, edited_at, profiles:edited_by ( display_name )")
        .eq("decision_maker_id", decisionMaker.id)
        .order("edited_at", { ascending: false })
        .limit(30),
    ]);

    profile = profileRow;
    legislationRaw = legislationData ?? [];
    revisions = revisionsData ?? [];

    if (profile?.represents_scope === "citywide") {
      const { count } = await supabase.from("profiles").select("id", { count: "exact", head: true });
      representsCount = count ?? 0;
    } else if (profile?.represents_scope === "district" && profile.represents_district) {
      const { count } = await supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("council_district", profile.represents_district);
      representsCount = count ?? 0;
    }
  }

  // Every proposal this decision-maker shows up in — pending or approved,
  // both shown (a pending suggestion is still someone flagging this
  // person as relevant, worth surfacing) but visually distinguished. Same
  // mini-card fields the profile page's "Your proposals" pulls, so this
  // can render with the shared ProposalMiniCardGrid instead of a plain
  // link list — Samantha's ask to streamline this look across the site.
  const { data: chainAppearances } = await supabase
    .from("proposal_power_tree_nodes")
    .select(
      "status, proposals ( id, title, type, image_url, image_position_x, image_position_y, categories ( label, color ) )"
    )
    .eq("decision_maker_id", decisionMaker.id);

  const proposalsSeen = new Map<
    string,
    {
      title: string;
      type: string;
      imageUrl: string | null;
      imagePositionX: number | null;
      imagePositionY: number | null;
      categoryLabel: string | null;
      categoryColor: string | null;
      anyApproved: boolean;
    }
  >();
  for (const row of (chainAppearances ?? []) as any[]) {
    const p = row.proposals;
    if (!p) continue;
    const existing = proposalsSeen.get(p.id);
    if (existing) {
      existing.anyApproved = existing.anyApproved || row.status === "approved";
    } else {
      proposalsSeen.set(p.id, {
        title: p.title,
        type: p.type,
        imageUrl: p.image_url,
        imagePositionX: p.image_position_x,
        imagePositionY: p.image_position_y,
        categoryLabel: p.categories?.label ?? null,
        categoryColor: p.categories?.color ?? null,
        anyApproved: row.status === "approved",
      });
    }
  }

  const legislation = legislationRaw.map((l: any) => ({
    id: l.id,
    title: l.title,
    stance: l.stance,
    note: l.note,
    occurred_on: l.occurred_on,
    addedByName: l.profiles?.display_name ?? "A resident",
    addedById: l.added_by,
  }));

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/decision-makers" className="text-xs text-neutral-500 underline hover:text-neutral-700">
        ← All decision-makers
      </Link>

      <div className="mt-2 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{decisionMaker.name}</h1>
          <p className="text-xs uppercase tracking-wide text-neutral-400">
            {decisionMaker.kind.replace(/_/g, " ")}
          </p>
        </div>
        {/* Shown even before this is filled in — Samantha couldn't find it
            at first because it only rendered once "who they represent"
            had already been set, with no hint that it existed at all.
            Now it always shows, with a plain state pointing at where to
            set it (Office details → Edit) when it hasn't been yet. */}
        {isElectedOfficial && (
          <div className="shrink-0 rounded-lg bg-duty-purple/10 px-3 py-2 text-right">
            {representsCount !== null ? (
              <>
                <p className="text-lg font-bold text-duty-purple">
                  {profile?.represents_scope === "citywide" ? "100%" : representsCount}
                </p>
                <p className="text-[11px] text-neutral-500">
                  Represents{profile?.represents_scope === "citywide" ? "" : ` ${representsCount}`} Citizen Mayor
                  {representsCount === 1 ? "" : "s"}
                </p>
              </>
            ) : (
              <p className="text-[11px] text-neutral-500">
                Who they represent
                <br />
                not set yet
              </p>
            )}
          </div>
        )}
      </div>

      {!user && (
        <p className="mt-3 text-xs text-neutral-500">
          <Link href="/login" className="underline">
            Sign in
          </Link>{" "}
          to help fill in or fix anything on this page.
        </p>
      )}

      <div className="mt-4">
        {isElectedOfficial ? (
          <DecisionMakerProfileEditor
            decisionMakerId={decisionMaker.id}
            canEdit={Boolean(user)}
            isAdmin={isAdmin}
            currentUserId={user?.id ?? null}
            profile={{
              office_title: profile?.office_title ?? null,
              party_affiliation: profile?.party_affiliation ?? null,
              elected_date: profile?.elected_date ?? null,
              term_end_date: profile?.term_end_date ?? null,
              next_election_date: profile?.next_election_date ?? null,
              represents_scope: profile?.represents_scope ?? "n/a",
              represents_district: profile?.represents_district ?? null,
              committees: profile?.committees ?? [],
              how_they_show_up: profile?.how_they_show_up ?? "",
              what_they_care_about: profile?.what_they_care_about ?? "",
            }}
            legislation={legislation}
          />
        ) : (
          <p className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-600">
            Full crowdsourced profiles (office details, committees, legislation) are elected-
            officials-only right now. {decisionMaker.name} is a {decisionMaker.kind.replace(/_/g, " ")},
            so there's nothing more to add here yet — but you can still see every proposal that's
            engaged them below.
          </p>
        )}
      </div>

      <div className="mt-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Shows up in {proposalsSeen.size} proposal{proposalsSeen.size === 1 ? "" : "s"}
        </p>
        <div className="mt-1.5">
          <ProposalMiniCardGrid
            emptyText="Not linked to any proposal yet."
            proposals={[...proposalsSeen.entries()].map(([id, p]) => ({
              id,
              title: p.title,
              type: p.type,
              imageUrl: p.imageUrl,
              imagePositionX: p.imagePositionX,
              imagePositionY: p.imagePositionY,
              categoryLabel: p.categoryLabel,
              categoryColor: p.categoryColor,
              note: p.anyApproved ? undefined : "Suggested, not yet approved",
            }))}
          />
        </div>
      </div>

      {isElectedOfficial && (
        <div className="mt-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">History</p>
          <ul className="mt-1.5 space-y-1 text-xs text-neutral-500">
            {revisions.map((r: any) => (
              <li key={r.id}>
                <span className="font-medium text-neutral-700">{r.profiles?.display_name ?? "A resident"}</span>{" "}
                changed <span className="font-mono text-[11px]">{r.field_name}</span> · {formatDateTime(r.edited_at)}
              </li>
            ))}
            {revisions.length === 0 && <li className="text-neutral-400">No edits yet.</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
