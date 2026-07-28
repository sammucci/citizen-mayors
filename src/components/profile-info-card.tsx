"use client";

import { useState } from "react";
import Link from "next/link";
import { updateProfile } from "@/app/actions";
import { AvatarUploadControl } from "@/components/avatar-upload-control";

type Profile = {
  id: string;
  display_name: string | null;
  zip_code: string | null;
  council_district: number | null;
  age_range: string | null;
  race_ethnicity: string | null;
  gender: string | null;
  housing_status: string | null;
  bio: string | null;
  avatar_url: string | null;
} | null;

// Was a permanently-open form — even fields you'd already filled in and
// saved just sat there as editable boxes, which read as unfinished
// rather than like a real profile. This shows a plain display "card" by
// default, with an Edit button that swaps in the form; saving swaps
// back to the card. A brand-new profile (no display name yet) opens
// straight into edit mode instead of showing an empty card first.
export function ProfileInfoCard({ profile }: { profile: Profile }) {
  const [editing, setEditing] = useState(!profile?.display_name);
  const [error, setError] = useState<string | null>(null);
  const districts = Array.from({ length: 10 }, (_, i) => i + 1);

  const demographicRows = [
    ["Age range", profile?.age_range],
    ["Race / ethnicity", profile?.race_ethnicity],
    ["Gender", profile?.gender],
    ["Housing status", profile?.housing_status],
  ].filter(([, value]) => value) as [string, string][];

  if (!editing) {
    return (
      <div className="rounded-lg border border-neutral-200 bg-white p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 shrink-0 overflow-hidden rounded-full bg-duty-purple/10 text-duty-purple">
              {profile?.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-base font-semibold">
                  {(profile?.display_name || "?").trim().charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <div>
              <h2 className="text-base font-semibold">
                {profile?.display_name || "Unnamed resident"}
              </h2>
              <p className="mt-0.5 text-xs text-neutral-500">
                {profile?.zip_code ? `Zip ${profile.zip_code}` : "No zip code shared"}
                {profile?.council_district ? ` · District ${profile.council_district}` : ""}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="shrink-0 rounded-full border border-neutral-300 px-3 py-1 text-xs text-neutral-600 hover:bg-neutral-50"
          >
            Edit
          </button>
        </div>

        {profile?.bio && (
          <p className="mt-3 border-t border-neutral-100 pt-3 text-sm text-neutral-700">
            {profile.bio}
          </p>
        )}

        {profile?.id && (
          <Link
            href={`/u/${profile.id}`}
            className="mt-2 inline-block text-xs text-duty-purple underline"
          >
            View your public profile
          </Link>
        )}

        {demographicRows.length > 0 ? (
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 border-t border-neutral-100 pt-3 text-sm">
            {demographicRows.map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs text-neutral-500">{label}</dt>
                <dd className="text-neutral-800">{value}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="mt-3 border-t border-neutral-100 pt-3 text-xs text-neutral-400">
            No demographic info shared.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-sm font-semibold">Your info</h2>
        {profile?.display_name && (
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="shrink-0 rounded-full border border-neutral-300 px-3 py-1 text-xs text-neutral-600 hover:bg-neutral-50"
          >
            Cancel
          </button>
        )}
      </div>
      <p className="mt-1 text-xs text-neutral-500">
        Everything here is optional and self-reported — we never geocode this
        from a home address.
      </p>

      <div className="mt-3">
        <AvatarUploadControl
          displayName={profile?.display_name ?? null}
          avatarUrl={profile?.avatar_url ?? null}
        />
      </div>

      <form
        action={async (formData) => {
          setError(null);
          const result = await updateProfile(formData);
          if (result?.error) {
            setError(result.error);
            return;
          }
          setEditing(false);
        }}
        className="mt-3 space-y-3"
      >
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
            Short civic bio (optional)
          </span>
          <textarea
            name="bio"
            rows={2}
            maxLength={280}
            defaultValue={profile?.bio ?? ""}
            placeholder="A sentence or two about what you're civically into — this is the one thing here that shows on your public profile."
            className="input text-sm"
          />
          <span className="mt-1 block text-[11px] text-neutral-400">
            Shown on your public profile, alongside your name, proposals, and comments. Everything
            else on this page stays private.
          </span>
        </label>
        {error && (
          <p className="rounded-md bg-duty-red/10 px-3 py-2 text-xs text-duty-red">{error}</p>
        )}
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
            eventually the public — can see whether who's actually showing up
            to propose, comment, and vote roughly reflects Philadelphia's
            real population and council districts. They're never required,
            never shown next to your name, and never used for anything else.
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

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-neutral-700">
            Housing status (optional)
          </span>
          <select
            name="housing_status"
            defaultValue={profile?.housing_status ?? ""}
            className="input"
          >
            <option value="">Prefer not to say</option>
            <option value="Homeowner">Homeowner</option>
            <option value="Renter">Renter</option>
            <option value="Unhoused">Unhoused</option>
          </select>
        </label>

        <button className="rounded-md bg-duty-purple px-4 py-2 text-sm font-medium text-white">
          Save
        </button>
      </form>
    </div>
  );
}
