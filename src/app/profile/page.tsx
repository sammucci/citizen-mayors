import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { updateProfile } from "@/app/actions";
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
    .select("id, title, type, created_at, categories ( label, color )")
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

          <div className="rounded-md bg-neutral-50 p-3">
            <p className="text-xs text-neutral-500">
              The fields below are entirely optional. We ask so we — and
              eventually the public — can see whether who's actually
              showing up to propose, comment, and vote roughly reflects
              Philadelphia's real population and council districts. They're
              never required, never shown next to your name, and never
              used for anything else.
            </p>
          </div>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-neutral-700">
              Age range (optional)
            </span>
            <select name="age_range" defaultValue={profile?.age_range ?? ""} className="input">
              <option value="">Prefer not to say</option>
              <option value="18-24">18–24</option>
              <option value="25-34">25–34</option>
              <option value="35-44">35–44</option>
              <option value="45-54">45–54</option>
              <option value="55-64">55–64</option>
              <option value="65+">65+</option>
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-neutral-700">
              Race / ethnicity (optional)
            </span>
            <select
              name="race_ethnicity"
              defaultValue={profile?.race_ethnicity ?? ""}
              className="input"
            >
              <option value="">Prefer not to say</option>
              <option value="Black or African American">Black or African American</option>
              <option value="White">White</option>
              <option value="Hispanic or Latino">Hispanic or Latino (any race)</option>
              <option value="Asian">Asian</option>
              <option value="American Indian or Alaska Native">
                American Indian or Alaska Native
              </option>
              <option value="Native Hawaiian or Other Pacific Islander">
                Native Hawaiian or Other Pacific Islander
              </option>
              <option value="Two or more races">Two or more races</option>
              <option value="Other">Other</option>
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-neutral-700">
              Gender (optional)
            </span>
            <select name="gender" defaultValue={profile?.gender ?? ""} className="input">
              <option value="">Prefer not to say</option>
              <option value="Woman">Woman</option>
              <option value="Man">Man</option>
              <option value="Non-binary">Non-binary</option>
              <option value="Prefer to self-describe">Prefer to self-describe</option>
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
          {myProposals?.map((p: any) => (
            <li
              key={p.id}
              className="rounded-lg border p-3 text-sm"
              style={{
                backgroundColor: `${p.categories?.color ?? "#e5e5e5"}33`,
                borderColor: `${p.categories?.color ?? "#e5e5e5"}88`,
              }}
            >
              <Link href={`/proposals/${p.id}`} className="font-medium hover:underline">
                {p.title}
              </Link>
              {p.categories?.label && (
                <span className="ml-2 text-xs uppercase text-neutral-500">
                  {p.categories.label}
                </span>
              )}
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
                <span
                  className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs ${statusColorClasses(c.status)}`}
                >
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
