import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { updateProfile } from "@/app/actions";

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
    .select("id, title, type, created_at")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false });

  const { data: myComments } = await supabase
    .from("comments")
    .select("id, body, is_suggested_edit, status, created_at, proposal_id, proposals ( title )")
    .eq("author_id", user.id)
    .order("created_at", { ascending: false });

  const districts = Array.from({ length: 10 }, (_, i) => i + 1);

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Your profile</h1>
        <p className="mt-1 text-sm text-neutral-600">{user.email}</p>
      </div>

      <div className="rounded-lg border border-neutral-200 bg-white p-4">
        <h2 className="text-sm font-semibold">Your info</h2>
        <p className="mt-1 text-xs text-neutral-500">
          Everything here is optional and self-reported — we never geocode
          this from a home address.
        </p>
        <form action={updateProfile} className="mt-3 space-y-3">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-neutral-700">
              Display name
            </span>
            <input
              name="display_name"
              defaultValue={profile?.display_name ?? ""}
              className="input"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-neutral-700">
              Zip code (optional)
            </span>
            <input
              name="zip_code"
              defaultValue={profile?.zip_code ?? ""}
              className="input"
              placeholder="e.g. 19125"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-neutral-700">
              Your council district (optional)
            </span>
            <select
              name="council_district"
              defaultValue={profile?.council_district ?? ""}
              className="input"
            >
              <option value="">Prefer not to say / not sure</option>
              {districts.map((d) => (
                <option key={d} value={d}>
                  District {d}
                </option>
              ))}
            </select>
          </label>
          <button className="rounded-md bg-duty-purple px-4 py-2 text-sm font-medium text-white">
            Save
          </button>
        </form>
      </div>

      <div>
        <h2 className="text-lg font-semibold">Your proposals</h2>
        <ul className="mt-3 space-y-2">
          {myProposals?.map((p) => (
            <li key={p.id} className="rounded-lg border border-neutral-200 bg-white p-3 text-sm">
              <Link href={`/proposals/${p.id}`} className="font-medium hover:underline">
                {p.title}
              </Link>
              <span className="ml-2 text-xs uppercase text-neutral-400">{p.type}</span>
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
        <ul className="mt-3 space-y-2">
          {myComments?.map((c: any) => (
            <li key={c.id} className="rounded-lg border border-neutral-200 bg-white p-3 text-sm">
              <Link href={`/proposals/${c.proposal_id}`} className="font-medium hover:underline">
                {c.proposals?.title ?? "A proposal"}
              </Link>
              <p className="mt-1 text-neutral-600">{c.body}</p>
              {c.is_suggested_edit && (
                <span className="mt-1 inline-block rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">
                  Suggested edit · {c.status.replace(/_/g, " ")}
                </span>
              )}
            </li>
          ))}
          {(!myComments || myComments.length === 0) && (
            <p className="text-sm text-neutral-500">
              You haven&apos;t commented on anything yet.
            </p>
          )}
        </ul>
      </div>
    </div>
  );
}
