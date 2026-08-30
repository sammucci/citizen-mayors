"use client";

import { useEffect, useRef, useState } from "react";
import {
  addCivicLog,
  deleteCivicLog,
  publishCivicLogDraft,
  saveDraftCivicLog,
  updateDraftCivicLog,
} from "@/app/civic-log/actions";
import { VolunteerCategoryField } from "@/components/volunteer-category-field";
import { PopulationServedField } from "@/components/population-served-field";
import { CivicReportCardExport } from "@/components/civic-report-card-export";
import { StatIcon, type StatIconName } from "@/components/stat-icons";
import { brightnessOf, darken } from "@/lib/color-brightness";
import { SelectField } from "@/components/select-field";

export type CivicStats = {
  proposalsMade: number;
  contributedToOthers: number;
  commentsMade: number;
  peopleConversedWith: number;
  decisionMakersEngaged: number;
  lettersWritten: number;
  lettersPublished: number;
  contactedOfficials: number;
  meetingsAttended: number;
  volunteerHours: number;
  testimonyGiven: number;
};

// `years` is every calendar year this item actually counts toward — a
// proposal or comment has exactly one (when it was made), but "people
// you've talked with" and "decision-makers engaged" are distinct-per-
// year counts (see profile/page.tsx), so a person you talked to in both
// 2025 and 2026 carries both years and shows up in either year's count,
// same as they would if you re-talked to them for real.
export type CivicDetailItem = { label: string; href?: string; sublabel?: string; years: number[] };
export type CivicDetails = {
  proposalsMade: CivicDetailItem[];
  contributedToOthers: CivicDetailItem[];
  commentsMade: CivicDetailItem[];
  peopleConversedWith: CivicDetailItem[];
  decisionMakersEngaged: CivicDetailItem[];
};

const CONTACT_METHOD_LABEL: Record<string, string> = {
  phone: "Phone call",
  email: "Email",
  letter: "Letter",
  in_person: "In-person meeting",
};

export type CivicLog = {
  id: string;
  logType:
    | "letter_to_editor"
    | "community_meeting"
    | "volunteer_hours"
    | "testimony"
    | "contacted_official";
  occurredOn: string;
  title: string | null;
  published: boolean;
  publishedLink: string | null;
  organization: string | null;
  contactMethod: string | null;
  hours: number | null;
  category: string | null;
  populationServed: string | null;
  note: string | null;
  status: "draft" | "published";
};

const LOG_TYPE_LABEL: Record<CivicLog["logType"], string> = {
  letter_to_editor: "Letter to the editor",
  community_meeting: "Community meeting",
  volunteer_hours: "Volunteer hours",
  testimony: "Gave testimony",
  contacted_official: "Contacted an elected official",
};

// Each log type's color matches its stat tile below, so the "+ Add a
// log" flow and the report card read as one connected system instead
// of the modal feeling like a generic, unrelated form.
const LOG_TYPE_COLOR: Record<CivicLog["logType"], string> = {
  letter_to_editor: "#D97706",
  community_meeting: "#0EA5A5",
  volunteer_hours: "#C2410C",
  testimony: "#7C3AED",
  contacted_official: "#DB2777",
};

function formatDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// The stat tiles here are meant to be screenshot-able as-is (a
// Spotify-Wrapped-style "civic report card" to post to socials) —
// that's why this leans on bold color blocks and big numbers rather
// than a plain table. A real "export as image" button is a reasonable
// fast-follow; for now this is designed to look good in a screenshot.
export function CivicReportCard({
  logs,
  details,
  categoryColor,
  volunteerCategories,
  populationCategories,
  displayName,
}: {
  logs: CivicLog[];
  details: CivicDetails;
  categoryColor: string;
  volunteerCategories: string[];
  populationCategories: string[];
  displayName: string;
}) {
  const [modalMode, setModalMode] = useState<null | "new" | CivicLog>(null);
  const [pendingNewType, setPendingNewType] = useState<CivicLog["logType"] | null>(null);
  const [detailKey, setDetailKey] = useState<ClickableStatKey | null>(null);
  const [exporting, setExporting] = useState(false);
  // "All time" is the default — nothing resets on its own each January —
  // but Samantha's ask was for a real year filter so a past year's work
  // stays visible instead of just getting buried under this year's.
  // Everything below (the stat numbers, the detail-list popups, the
  // published-log list AND its count, the export) is computed from this
  // one selection, so nothing here can quietly drift out of sync with
  // what's actually filtered.
  const [year, setYear] = useState<number | "all">("all");
  const dirtyRef = useRef(false);

  const drafts = logs.filter((l) => l.status === "draft");

  function logYear(l: CivicLog) {
    return new Date(`${l.occurredOn}T00:00:00`).getFullYear();
  }
  function inYear(itemYears: number[]) {
    return year === "all" || itemYears.includes(year);
  }

  // Every year that has SOMETHING in it (a log, a proposal, a comment,
  // a real conversation) — plus the current year always, even for a
  // brand-new account with nothing logged yet, so "this year" is never
  // missing from the picker.
  const availableYears = Array.from(
    new Set([
      new Date().getFullYear(),
      ...logs.map(logYear),
      ...Object.values(details).flatMap((items) => items.flatMap((i) => i.years)),
    ])
  ).sort((a, b) => b - a);

  const published = logs.filter((l) => l.status === "published" && (year === "all" || logYear(l) === year));

  const filteredDetails: CivicDetails = {
    proposalsMade: details.proposalsMade.filter((i) => inYear(i.years)),
    contributedToOthers: details.contributedToOthers.filter((i) => inYear(i.years)),
    commentsMade: details.commentsMade.filter((i) => inYear(i.years)),
    peopleConversedWith: details.peopleConversedWith.filter((i) => inYear(i.years)),
    decisionMakersEngaged: details.decisionMakersEngaged.filter((i) => inYear(i.years)),
  };

  // Computed here, not passed in as a prop — the four self-reported log
  // stats and the five "distinct thing engaged with" stats both boil
  // down to "how many things are in the filtered list right now," so
  // there's one source of truth (details + logs) instead of a separately
  // pre-computed CivicStats that could fall out of sync with what's
  // actually in those lists once a year filter entered the picture.
  const stats: CivicStats = {
    proposalsMade: filteredDetails.proposalsMade.length,
    contributedToOthers: filteredDetails.contributedToOthers.length,
    commentsMade: filteredDetails.commentsMade.length,
    peopleConversedWith: filteredDetails.peopleConversedWith.length,
    decisionMakersEngaged: filteredDetails.decisionMakersEngaged.length,
    lettersWritten: published.filter((l) => l.logType === "letter_to_editor").length,
    lettersPublished: published.filter((l) => l.logType === "letter_to_editor" && l.published).length,
    contactedOfficials: published.filter((l) => l.logType === "contacted_official").length,
    meetingsAttended: published.filter((l) => l.logType === "community_meeting").length,
    volunteerHours: published
      .filter((l) => l.logType === "volunteer_hours")
      .reduce((sum, l) => sum + (l.hours ?? 0), 0),
    testimonyGiven: published.filter((l) => l.logType === "testimony").length,
  };

  // Opens the "add a log" modal pre-set to a specific type — used by the
  // "log this now" prompt inside an empty stat-tile popup, so clicking
  // "Volunteer hours" (say) from an empty popup doesn't dump you into
  // the generic "what kind of log is this?" picker you'd get from the
  // header's "+ Add a log" button.
  function openNewLog(type?: CivicLog["logType"]) {
    setPendingNewType(type ?? null);
    setModalMode("new");
    setDetailKey(null);
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        {/* No h2 here — the tab above this card (see
            profile-tabbed-sections.tsx) already says "Civic report
            card"; repeating it as a title right underneath just
            duplicated the same words twice in a row. */}
        <p className="text-xs text-neutral-500">
          A year-in-review of what you've actually done — shareable, so far.
        </p>
        <div className="flex shrink-0 items-center gap-1.5">
          <SelectField
            value={year}
            onChange={(e) => setYear(e.target.value === "all" ? "all" : Number(e.target.value))}
            fullWidth={false}
            className="!py-1.5 !text-xs"
            aria-label="Filter the report card by year"
          >
            <option value="all">All time</option>
            {availableYears.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </SelectField>
          <button
            type="button"
            onClick={() => setExporting(true)}
            className="rounded-full border border-neutral-300 px-3 py-1.5 text-xs font-semibold text-neutral-600 hover:bg-neutral-50"
          >
            Export
          </button>
          <button
            type="button"
            onClick={() => setModalMode("new")}
            className="rounded-full bg-duty-purple px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
          >
            + Add a log
          </button>
        </div>
      </div>

      {/* Same card look as the community dashboard's flip tiles (colored
          bar, tinted body, icon badge) — Samantha's ask to streamline this
          across the site. Click instead of flip, though: the useful thing
          here is opening the actual detail list (your proposals, your
          logs), not a static "why this matters" sentence, so this keeps
          its modal instead of adopting the flip mechanic too. */}
      {/* items-start — without it, CSS grid's default row-stretch makes
          every card in a row match the height of its tallest neighbor.
          "Letters written to the editor" is taller than its row-mates
          because it's the only one of the three with a sublabel ("1
          published"), which was stretching "People you've talked with"
          and "Decision-makers engaged" to match, leaving dead empty
          space at the bottom of both — the "something weird" in that
          row. Same fix already applied to the landing page's map/card
          row earlier this session. */}
      <div className="mt-3 grid grid-cols-2 items-start gap-2.5 sm:grid-cols-3">
        <StatTile
          label="Proposals made"
          value={stats.proposalsMade}
          color="#6C3FD1"
          icon="proposalsMade"
          onClick={() => setDetailKey("proposalsMade")}
        />
        <StatTile
          label="Contributions to others"
          value={stats.contributedToOthers}
          color="#4069D9"
          icon="contributionToOthers"
          onClick={() => setDetailKey("contributedToOthers")}
        />
        <StatTile
          label="Comments made"
          value={stats.commentsMade}
          color="#8358D3"
          icon="commentsMade"
          onClick={() => setDetailKey("commentsMade")}
        />
        <StatTile
          label="People you've talked with"
          value={stats.peopleConversedWith}
          color="#F86767"
          icon="registeredMembers"
          onClick={() => setDetailKey("peopleConversedWith")}
        />
        <StatTile
          label="Decision-makers engaged"
          value={stats.decisionMakersEngaged}
          color="#2E8B57"
          icon="decisionMakersEngaged"
          onClick={() => setDetailKey("decisionMakersEngaged")}
        />
        {/* Testimony given and Letters written swapped (v124) — the
            letters tile grows a sublabel ("N published") whenever
            you've published one, making it the tallest tile in its row;
            moving it to the last slot means that row-stretch only ever
            pushes against tiles after it instead of the ones next to
            plain, always-one-line tiles like Contacted an elected. */}
        <StatTile
          label="Testimony given"
          value={stats.testimonyGiven}
          color={LOG_TYPE_COLOR.testimony}
          icon="testimonyGiven"
          onClick={() => setDetailKey("testimonyGiven")}
        />
        <StatTile
          label="Contacted an elected"
          value={stats.contactedOfficials}
          color={LOG_TYPE_COLOR.contacted_official}
          icon="contactedAnElected"
          onClick={() => setDetailKey("contactedOfficials")}
        />
        <StatTile
          label="Meetings attended"
          value={stats.meetingsAttended}
          color={LOG_TYPE_COLOR.community_meeting}
          icon="communityMeetingsAttended"
          onClick={() => setDetailKey("meetingsAttended")}
        />
        <StatTile
          label="Volunteer hours"
          value={stats.volunteerHours}
          color={LOG_TYPE_COLOR.volunteer_hours}
          icon="hoursVolunteered"
          onClick={() => setDetailKey("volunteerHours")}
        />
        <StatTile
          label="Letters written to the editor"
          value={stats.lettersWritten}
          sublabel={stats.lettersPublished > 0 ? `${stats.lettersPublished} published` : undefined}
          color={LOG_TYPE_COLOR.letter_to_editor}
          icon="lettersToTheEditor"
          onClick={() => setDetailKey("lettersWritten")}
        />
      </div>

      {drafts.length > 0 && (
        <div className="mt-3 rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-3">
          <p className="text-xs font-medium text-neutral-600">
            You have {drafts.length} unfinished log{drafts.length === 1 ? "" : "s"} — these don't
            count toward your totals yet.
          </p>
          <ul className="mt-2 space-y-1.5">
            {drafts.map((log) => (
              <li key={log.id} className="flex items-center justify-between gap-2 text-xs">
                <span className="text-neutral-700">
                  {LOG_TYPE_LABEL[log.logType]} · {formatDate(log.occurredOn)}
                </span>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setModalMode(log)}
                    className="rounded-full border border-neutral-300 bg-white px-2 py-0.5 text-neutral-600 hover:bg-neutral-100"
                  >
                    Edit
                  </button>
                  <form action={deleteCivicLog}>
                    <input type="hidden" name="id" value={log.id} />
                    <button className="rounded-full border border-neutral-300 bg-white px-2 py-0.5 text-neutral-600 hover:border-duty-red hover:text-duty-red">
                      Discard
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {published.length > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer list-none text-xs text-neutral-500 underline marker:content-none">
            View /edit your full log ({published.length})
          </summary>
          <ul className="mt-2 space-y-1.5">
            {published.map((log) => (
              <LogRow key={log.id} log={log} onEdit={() => setModalMode(log)} />
            ))}
          </ul>
        </details>
      )}

      {modalMode && (
        <AddLogModal
          existing={modalMode === "new" ? null : modalMode}
          initialLogType={modalMode === "new" ? pendingNewType : null}
          categoryColor={categoryColor}
          volunteerCategories={volunteerCategories}
          populationCategories={populationCategories}
          onDirty={() => {
            dirtyRef.current = true;
          }}
          onClose={() => {
            dirtyRef.current = false;
            setModalMode(null);
            setPendingNewType(null);
          }}
          isDirty={() => dirtyRef.current}
        />
      )}

      {exporting && (
        <CivicReportCardExport
          displayName={displayName}
          stats={stats}
          proposals={filteredDetails.proposalsMade}
          comments={filteredDetails.commentsMade}
          logs={published}
          onClose={() => setExporting(false)}
        />
      )}

      {detailKey && (
        <DetailModal
          title={STAT_TITLES[detailKey]}
          onClose={() => setDetailKey(null)}
        >
          {detailKey === "lettersWritten" || detailKey === "meetingsAttended" ||
          detailKey === "volunteerHours" || detailKey === "testimonyGiven" ||
          detailKey === "contactedOfficials" ? (
            <LogTypeDetailList
              logs={published.filter((l) => l.logType === STAT_TO_LOG_TYPE[detailKey])}
              onLogNow={() => openNewLog(STAT_TO_LOG_TYPE[detailKey])}
            />
          ) : (
            <PlainDetailList items={filteredDetails[detailKey]} />
          )}
        </DetailModal>
      )}
    </div>
  );
}

type ClickableStatKey = Exclude<keyof CivicStats, "lettersPublished">;

const STAT_TITLES: Record<ClickableStatKey, string> = {
  proposalsMade: "Proposals you've made",
  contributedToOthers: "Proposals you've contributed to",
  commentsMade: "Comments you've made",
  peopleConversedWith: "People you've talked with",
  decisionMakersEngaged: "Decision-makers you've engaged with",
  lettersWritten: "Letters written to the editor",
  contactedOfficials: "Elected officials you've contacted",
  meetingsAttended: "Community meetings",
  volunteerHours: "Volunteer hours",
  testimonyGiven: "Testimony given",
};

const STAT_TO_LOG_TYPE: Partial<Record<ClickableStatKey, CivicLog["logType"]>> = {
  lettersWritten: "letter_to_editor",
  contactedOfficials: "contacted_official",
  meetingsAttended: "community_meeting",
  volunteerHours: "volunteer_hours",
  testimonyGiven: "testimony",
};

function DetailModal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-lg bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-neutral-100 p-4">
          <h3 className="text-base font-semibold">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-neutral-300 px-2 py-0.5 text-sm text-neutral-600"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <div className="overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  );
}

function PlainDetailList({ items }: { items: CivicDetailItem[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-neutral-500">Nothing here yet.</p>;
  }
  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li key={i} className="rounded border border-neutral-100 bg-neutral-50 p-2 text-sm">
          {item.href ? (
            <a href={item.href} className="font-medium text-duty-purple underline">
              {item.label}
            </a>
          ) : (
            <span className="font-medium text-neutral-700">{item.label}</span>
          )}
          {item.sublabel && <p className="mt-0.5 text-xs text-neutral-500">{item.sublabel}</p>}
        </li>
      ))}
    </ul>
  );
}

function LogTypeDetailList({ logs, onLogNow }: { logs: CivicLog[]; onLogNow: () => void }) {
  if (logs.length === 0) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-neutral-500">Nothing logged yet.</p>
        <button
          type="button"
          onClick={onLogNow}
          className="rounded-full bg-duty-purple px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
        >
          + Log one now
        </button>
      </div>
    );
  }
  return (
    <ul className="space-y-2">
      {logs.map((log) => (
        <li key={log.id} className="rounded border border-neutral-100 bg-neutral-50 p-2 text-sm">
          <p className="font-medium text-neutral-700">
            {log.title || formatDate(log.occurredOn)}
            {log.logType === "volunteer_hours" && log.hours
              ? ` · ${log.hours} hrs${log.category ? ` (${log.category})` : ""}`
              : ""}
          </p>
          <p className="text-xs text-neutral-500">
            {formatDate(log.occurredOn)}
            {log.logType === "volunteer_hours" && log.populationServed ? ` · For ${log.populationServed}` : ""}
            {log.logType === "community_meeting" && log.organization ? ` · Hosted by ${log.organization}` : ""}
            {log.logType === "contacted_official" && log.organization ? ` · ${log.organization}` : ""}
            {log.logType === "contacted_official" && log.contactMethod
              ? ` · ${CONTACT_METHOD_LABEL[log.contactMethod] ?? log.contactMethod}`
              : ""}
            {log.logType === "letter_to_editor" && log.published ? " · Published" : ""}
          </p>
          {log.note && <p className="mt-1 text-neutral-600">{log.note}</p>}
          {log.publishedLink && (
            <a
              href={log.publishedLink}
              target="_blank"
              rel="noreferrer"
              className="mt-1 block truncate text-duty-purple underline"
            >
              {log.publishedLink}
            </a>
          )}
        </li>
      ))}
    </ul>
  );
}

function LogRow({ log, onEdit }: { log: CivicLog; onEdit: () => void }) {
  // A finished log is real work someone already did — a stray click
  // shouldn't be able to wipe it out the way it could before. First
  // click just reveals a "really remove this?" confirm; the actual
  // delete only fires on the second, deliberate click.
  const [confirming, setConfirming] = useState(false);

  return (
    <li className="flex items-start justify-between gap-2 rounded-lg border border-neutral-200 bg-white p-2 text-xs">
      <div className="min-w-0">
        <p className="font-medium text-neutral-700">
          {log.title ? `${log.title} · ` : ""}
          {LOG_TYPE_LABEL[log.logType]} · {formatDate(log.occurredOn)}
          {log.logType === "volunteer_hours" && log.hours
            ? ` · ${log.hours} hrs${log.category ? ` (${log.category})` : ""}`
            : ""}
          {log.logType === "letter_to_editor" && log.published ? " · Published" : ""}
          {log.logType === "contacted_official" && log.contactMethod
            ? ` · ${CONTACT_METHOD_LABEL[log.contactMethod] ?? log.contactMethod}`
            : ""}
        </p>
        {log.logType === "volunteer_hours" && log.populationServed && (
          <p className="mt-0.5 text-neutral-500">For {log.populationServed}</p>
        )}
        {log.logType === "community_meeting" && log.organization && (
          <p className="mt-0.5 text-neutral-500">Hosted by {log.organization}</p>
        )}
        {log.logType === "contacted_official" && log.organization && (
          <p className="mt-0.5 text-neutral-500">{log.organization}</p>
        )}
        {log.note && <p className="mt-0.5 text-neutral-500">{log.note}</p>}
        {log.publishedLink && (
          <a
            href={log.publishedLink}
            target="_blank"
            rel="noreferrer"
            className="mt-0.5 block truncate text-duty-purple underline"
          >
            {log.publishedLink}
          </a>
        )}
      </div>
      {confirming ? (
        <div className="flex shrink-0 items-center gap-1">
          <form action={deleteCivicLog}>
            <input type="hidden" name="id" value={log.id} />
            <button className="rounded-full bg-duty-red px-2 py-0.5 text-white">Remove</button>
          </form>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="rounded-full border border-neutral-300 px-2 py-0.5 text-neutral-600 hover:bg-neutral-50"
          >
            Cancel
          </button>
        </div>
      ) : (
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={onEdit}
            className="rounded-full border border-neutral-300 bg-white px-2 py-0.5 text-neutral-600 hover:bg-neutral-100"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="rounded-full border border-neutral-300 px-1.5 text-neutral-500 hover:border-duty-red hover:text-duty-red"
            title="Remove this log entry"
          >
            ✕
          </button>
        </div>
      )}
    </li>
  );
}

function StatTile({
  label,
  value,
  sublabel,
  color,
  icon,
  onClick,
}: {
  label: string;
  value: number;
  sublabel?: string;
  color: string;
  icon: StatIconName;
  onClick: () => void;
}) {
  // Same readability fix as the dashboard cards: a pale color (there
  // isn't one in this palette today, but a future log type could add
  // one) gets a darkened number/icon color instead of becoming
  // unreadable, without changing what color the card visually reads as.
  const isLight = brightnessOf(color) > 180;
  const accentColor = isLight ? darken(color, 0.55) : color;

  return (
    <button
      type="button"
      onClick={onClick}
      // A pale ~8% tint against stark white was hard to make out,
      // especially for the lighter colors in this set — same fix
      // already used on the mini proposal cards below (a real border in
      // the tile's own color, not just a tinted fill) so these read
      // clearly against the white page instead of nearly blending in.
      className="overflow-hidden rounded-2xl border text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
      style={{ borderColor: `${color}66` }}
    >
      <div className="h-2" style={{ backgroundColor: color }} aria-hidden="true" />
      <div className="relative p-4" style={{ backgroundColor: `${color}14` }}>
        <div
          className="absolute right-3 top-3 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg"
          style={{ backgroundColor: `${color}33`, color: accentColor }}
        >
          <StatIcon name={icon} className="h-4 w-4" />
        </div>
        <p className="pr-10 text-2xl font-bold leading-none" style={{ color: accentColor }}>
          {value}
        </p>
        <p className="mt-2 text-xs font-semibold leading-snug text-neutral-900">{label}</p>
        {sublabel && <p className="mt-0.5 text-[11px] text-neutral-500">{sublabel}</p>}
      </div>
    </button>
  );
}

// Floating window, same idea as the decision-maker card's pop-out —
// pick a log type, fill in what's relevant to it, save. If you close
// this without saving (backdrop click, Escape, or the ✕) and you'd
// actually typed something, it's auto-saved as a draft instead of just
// disappearing — nothing you started here gets lost by accident. If
// you're editing an existing draft, the auto-save updates that same
// row instead of creating a second one.
function AddLogModal({
  existing,
  initialLogType,
  categoryColor,
  volunteerCategories,
  populationCategories,
  onDirty,
  onClose,
  isDirty,
}: {
  existing: CivicLog | null;
  initialLogType?: CivicLog["logType"] | null;
  categoryColor: string;
  volunteerCategories: string[];
  populationCategories: string[];
  onDirty: () => void;
  onClose: () => void;
  isDirty: () => boolean;
}) {
  const [logType, setLogType] = useState<CivicLog["logType"]>(
    existing?.logType ?? initialLogType ?? "community_meeting"
  );
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const savedRef = useRef(false);
  const activeColor = LOG_TYPE_COLOR[logType];

  function saveAsDraftIfDirty() {
    if (savedRef.current) return;
    if (!isDirty() || !formRef.current) {
      onClose();
      return;
    }
    const fd = new FormData(formRef.current);
    fd.set("log_type", logType);
    if (existing) {
      fd.set("id", existing.id);
      updateDraftCivicLog(fd);
    } else {
      saveDraftCivicLog(fd);
    }
    onClose();
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") saveAsDraftIfDirty();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={saveAsDraftIfDirty}
    >
      <div
        className="w-full max-w-md rounded-lg bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 border-b border-neutral-100 p-4">
          <h3 className="text-base font-semibold">
            {existing ? "Finish this log" : "Add a log"}
          </h3>
          <button
            type="button"
            onClick={saveAsDraftIfDirty}
            className="rounded-full border border-neutral-300 px-2 py-0.5 text-sm text-neutral-600"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <form
          ref={formRef}
          onKeyDown={(e) => {
            // The Save button is a real submit button (as it should be),
            // but that also means pressing Enter in any single-line
            // field — typing a title, tabbing through, hitting Enter out
            // of habit — fires the whole form early, before you've
            // filled in the rest. Textareas are fine (Enter there is
            // just a newline); this only guards plain text/number/date
            // inputs.
            const target = e.target as HTMLElement;
            if (e.key === "Enter" && target.tagName === "INPUT") {
              e.preventDefault();
            }
          }}
          action={async (formData) => {
            formData.set("log_type", logType);
            const result = existing
              ? await (async () => {
                  formData.set("id", existing.id);
                  return publishCivicLogDraft(formData);
                })()
              : await addCivicLog(formData);
            if (result?.error) {
              setError(result.error);
              return;
            }
            savedRef.current = true;
            onClose();
          }}
          onChange={onDirty}
          className="space-y-3 p-4"
        >
          {!existing && (
            <div>
              <span className="mb-1 block text-xs text-neutral-500">What kind of log is this?</span>
              <div className="grid grid-cols-2 gap-1.5">
                {(Object.keys(LOG_TYPE_LABEL) as CivicLog["logType"][]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      setLogType(t);
                      onDirty();
                    }}
                    className="rounded border px-2 py-1.5 text-left text-xs"
                    style={
                      logType === t
                        ? { borderColor: LOG_TYPE_COLOR[t], backgroundColor: `${LOG_TYPE_COLOR[t]}1a` }
                        : { borderColor: "#d4d4d4" }
                    }
                  >
                    {LOG_TYPE_LABEL[t]}
                  </button>
                ))}
              </div>
            </div>
          )}
          {existing && (
            <p className="text-xs font-medium" style={{ color: activeColor }}>
              {LOG_TYPE_LABEL[existing.logType]}
            </p>
          )}

          <label className="block">
            <span className="mb-1 block text-xs text-neutral-500">When</span>
            <input
              type="date"
              name="occurred_on"
              defaultValue={existing?.occurredOn ?? new Date().toISOString().slice(0, 10)}
              className="input"
            />
          </label>

          {logType === "letter_to_editor" && (
            <>
              <label className="block">
                <span className="mb-1 block text-xs text-neutral-500">Title (optional)</span>
                <input
                  name="title"
                  defaultValue={existing?.title ?? ""}
                  placeholder="Title of the letter or article"
                  className="input"
                />
              </label>
              <label className="flex items-center gap-1.5 text-xs text-neutral-600">
                <input
                  type="checkbox"
                  name="published"
                  defaultChecked={existing?.published ?? false}
                />
                It was published
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-neutral-500">
                  Link to the published letter (optional)
                </span>
                <input
                  name="published_link"
                  defaultValue={existing?.publishedLink ?? ""}
                  placeholder="https://..."
                  className="input"
                />
              </label>
            </>
          )}

          {logType === "community_meeting" && (
            <label className="block">
              <span className="mb-1 block text-xs text-neutral-500">
                Hosted by (optional) — neighborhood group or organization
              </span>
              <input
                name="organization"
                defaultValue={existing?.organization ?? ""}
                className="input"
              />
            </label>
          )}

          {logType === "contacted_official" && (
            <>
              <label className="block">
                <span className="mb-1 block text-xs text-neutral-500">
                  Who did you contact? (optional) — e.g. Councilmember Jones' office
                </span>
                <input
                  name="organization"
                  defaultValue={existing?.organization ?? ""}
                  className="input"
                />
              </label>
              <div>
                <span className="mb-1 block text-xs text-neutral-500">How</span>
                <div className="grid grid-cols-2 gap-1.5">
                  {(["phone", "email", "letter", "in_person"] as const).map((m) => (
                    <label
                      key={m}
                      className="flex items-center gap-1.5 rounded border border-neutral-300 px-2 py-1.5 text-xs has-[:checked]:border-[#DB2777] has-[:checked]:bg-[#DB27771a]"
                    >
                      <input
                        type="radio"
                        name="contact_method"
                        value={m}
                        defaultChecked={existing?.contactMethod === m || (!existing && m === "phone")}
                        className="h-3 w-3"
                      />
                      {CONTACT_METHOD_LABEL[m]}
                    </label>
                  ))}
                </div>
              </div>
            </>
          )}

          {logType === "volunteer_hours" && (
            <>
              <label className="block">
                <span className="mb-1 block text-xs text-neutral-500">Hours</span>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  name="hours"
                  defaultValue={existing?.hours ?? ""}
                  className="input"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-neutral-500">
                  What you did (optional) — e.g. Tutoring, Environmental Conservation, Food security
                </span>
                <VolunteerCategoryField
                  categories={volunteerCategories}
                  defaultValue={existing?.category ?? ""}
                />
              </label>
              {/* Independent of "what you did" above — tutoring someone's
                  kids and tutoring an ESL class for seniors can both just
                  be "Tutoring" now, with who it was for captured here
                  instead of forcing a choice between the two. */}
              <label className="block">
                <span className="mb-1 block text-xs text-neutral-500">Who it was for (optional)</span>
                <PopulationServedField
                  categories={populationCategories}
                  defaultValue={existing?.populationServed ?? ""}
                />
              </label>
            </>
          )}

          <label className="block">
            <span className="mb-1 block text-xs text-neutral-500">Notes (optional)</span>
            <textarea
              name="note"
              rows={2}
              defaultValue={existing?.note ?? ""}
              placeholder="Anything worth remembering about this"
              className="input text-sm"
            />
          </label>

          {error && <p className="text-xs text-duty-red">{error}</p>}

          <div className="flex gap-2">
            <button
              className="rounded px-3 py-1.5 text-sm font-medium text-white"
              style={{ backgroundColor: activeColor }}
            >
              Save
            </button>
            <button
              type="button"
              onClick={saveAsDraftIfDirty}
              className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-50"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
