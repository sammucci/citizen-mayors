"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { addOrganizationToMyProfile, removeOrganizationFromMyProfile } from "@/app/organizations/actions";

// Samantha's ask: "neighborhood groups and civic organizations near me"
// on the profile page — attaching one here is what makes an organization
// profile's "# Citizen Mayors involved" count go up (see
// organization_profiles/profile_organizations in schema.sql). Typing an
// existing name (the datalist autocompletes against every org already
// in the shared registry) attaches that one; typing a new name creates
// it — same match-or-create pattern used for grants/decision-makers,
// just done here with a plain HTML datalist instead of a full custom
// combobox, since this is a lighter-weight add-on to an existing page
// rather than the main point of it.
export function MyOrganizationsSection({
  myOrganizations,
  allOrganizationNames,
}: {
  myOrganizations: { id: string; name: string }[];
  allOrganizationNames: string[];
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <div>
      <h2 className="text-lg font-semibold">Your civic groups</h2>
      <p className="mt-0.5 text-xs text-neutral-500">
        Neighborhood groups and civic organizations you&apos;re part of — each one gets its own
        crowdsourced profile page, same as decision-makers.
      </p>

      <ul className="mt-2 space-y-1">
        {myOrganizations.map((org) => (
          <li key={org.id} className="flex items-center justify-between gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-1.5">
            <Link href={`/organizations/${org.id}`} className="text-sm text-duty-purple underline">
              {org.name}
            </Link>
            <form
              action={async (formData) => {
                await removeOrganizationFromMyProfile(formData);
                router.refresh();
              }}
            >
              <input type="hidden" name="organization_id" value={org.id} />
              <button className="text-xs text-neutral-400 hover:text-duty-red" title="Remove">
                ✕
              </button>
            </form>
          </li>
        ))}
        {myOrganizations.length === 0 && (
          <li className="text-sm text-neutral-500">Nothing added yet.</li>
        )}
      </ul>

      <form
        ref={formRef}
        action={async (formData) => {
          await addOrganizationToMyProfile(formData);
          router.refresh();
          formRef.current?.reset();
        }}
        className="mt-2 flex gap-2"
      >
        <input
          name="name"
          required
          list="all-organization-names"
          placeholder="e.g. Point Breeze Civic Association"
          className="input min-w-0 flex-1 text-sm"
        />
        <datalist id="all-organization-names">
          {allOrganizationNames.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
        <button className="shrink-0 rounded bg-duty-purple px-3 py-1.5 text-sm font-medium text-white">
          Add
        </button>
      </form>
    </div>
  );
}
