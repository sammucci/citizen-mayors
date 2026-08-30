"use client";

import { useState } from "react";
import { CivicReportCard, type CivicLog, type CivicDetails } from "@/components/civic-report-card";
import { MyOrganizationsSection } from "@/components/my-organizations-section";
import { FollowedTagsSection } from "@/components/followed-tags-section";

type TagOption = { id: number; label: string; following: boolean };
type TagGroup = { id: number | string; label: string; tags: TagOption[] };

// Samantha's ask: these three profile sections (civic report card,
// civic groups, expertise & interests) used to just stack on top of
// each other — a long scroll of unrelated-looking blocks. Brings in the
// same "folder tab" motif already used for a proposal's category tab
// (proposals/[id]/page.tsx): one tab sticking up per section, the
// active one solid brand-purple and visually attached to the card
// below (flush border, square top-left corner where the active tab
// meets it), inactive tabs a transparent purple tint instead of solid
// gray — same brand color throughout rather than three invented,
// unrelated hues, since these aren't really different "categories" of
// anything, just three views into one person's own profile.
//
// Only the active section's data ever gets queried differently — this
// component doesn't change what each section fetches or does, purely
// how the three are displayed. Each section underneath is untouched;
// this is just what wraps them.
export function ProfileTabbedSections({
  civicLogs,
  civicDetails,
  categoryColor,
  volunteerCategories,
  populationCategories,
  displayName,
  myOrganizations,
  allOrganizationNames,
  tagGroups,
}: {
  civicLogs: CivicLog[];
  civicDetails: CivicDetails;
  categoryColor: string;
  volunteerCategories: string[];
  populationCategories: string[];
  displayName: string;
  myOrganizations: { id: string; name: string }[];
  allOrganizationNames: string[];
  tagGroups: TagGroup[];
}) {
  const [tab, setTab] = useState<"report" | "groups" | "expertise">("report");

  const TABS: { key: typeof tab; label: string }[] = [
    { key: "report", label: "Civic report card" },
    { key: "groups", label: "Civic groups" },
    { key: "expertise", label: "Expertise & interests" },
  ];

  return (
    <div>
      <div className="flex items-end gap-1">
        {TABS.map((t) => {
          const active = t.key === tab;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`whitespace-nowrap rounded-t-lg text-xs font-semibold uppercase tracking-wide transition ${
                active ? "px-5 py-3 text-white" : "px-4 py-2 text-duty-purple"
              }`}
              style={{ backgroundColor: active ? "#6C3FD1" : "#6C3FD11a" }}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      <div className="rounded-tr-lg rounded-br-lg rounded-bl-lg border border-duty-purple/40 bg-white p-4">
        {tab === "report" && (
          <CivicReportCard
            logs={civicLogs}
            details={civicDetails}
            categoryColor={categoryColor}
            volunteerCategories={volunteerCategories}
            populationCategories={populationCategories}
            displayName={displayName}
          />
        )}
        {tab === "groups" && (
          <MyOrganizationsSection
            myOrganizations={myOrganizations}
            allOrganizationNames={allOrganizationNames}
          />
        )}
        {tab === "expertise" && <FollowedTagsSection tagGroups={tagGroups} />}
      </div>
    </div>
  );
}
