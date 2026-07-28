"use client";

import { useEffect, useRef, useState } from "react";
import {
  addCivicLog,
  deleteCivicLog,
  publishCivicLogDraft,
  saveDraftCivicLog,
  updateDraftCivicLog,
} from "@/app/civic-log/actions";

export type CivicStats = {
  proposalsMade: number;
  contributedToOthers: number;
  commentsMade: number;
  peopleConversedWith: number;
  decisionMakersEngaged: number;
  lettersWritten: number;
  lettersPublished: number;
  meetingsAttended: number;
  volunteerHours: number;
  testimonyGiven: number;
};

export type CivicDetailItem = { label: string; href?: string; sublabel?: string };
export type CivicDetails = {
  proposalsMade: CivicDetailItem[];
  contributedToOthers: CivicDetailItem[];
  commentsMade: CivicDetailItem[];
  peopleConversedWith: CivicDetailItem[];
  decisionMakersEngaged: CivicDetailItem[];
};

export type CivicLog = {
  id: string;
  logType: "letter_to_editor" | "community_meeting" | "volunteer_hours" | "testimony";
  occurredOn: string;
  title: string | null;
  published: boolean;
  publishedLink: string | null;
  organization: string | null;
  hours: number | null;
  category: string | null;
  note: string | null;
  status: "draft" | "published";
};

const LOG_TYPE_LABEL: Record<CivicLog["logType"], string> = {
  letter_to_editor: "Letter to the editor",
  community_meeting: "Community meeting",
  volunteer_hours: "Volunteer hours",
  testimony: "Gave testimony",
};

// Each log type's color matches its stat tile below, so the "+ Add a
// log" flow and the report card read as one connected system instead
// of the modal feeling like a generic, unrelated form.
const LOG_TYPE_COLOR: Record<CivicLog["logType"], string> = {
  letter_to_editor: "#D97706",
  community_meeting: "#0EA5A5",
  volunteer_hours: "#C2410C",
  testimony: "#7C3AED",
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
  stats,
  logs,
  details,
  categoryColor,
}: {
  stats: CivicStats;
  logs: CivicLog[];
  details: CivicDetails;
  categoryColor: string;
}) {
  const [modalMode, setModalMode] = useState<null | "new" | CivicLog>(null);
  const [detailKey, setDetailKey] = useState<ClickableStatKey | null>(null);
  const dirtyRef = useRef(false);

  const drafts = logs.filter((l) => l.status === "draft");
  const published = logs.filter((l) => l.status === "published");

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Your civic report card</h2>
          <p className="mt-0.5 text-xs text-neutral-500">
            A year-in-review of what you've actually done — shareable, so far.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setModalMode("new")}
          className="shrink-0 rounded-full bg-duty-purple px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
        >
          + Add a log
        </button>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        <StatTile
          label="Proposals made"
          value={stats.proposalsMade}
          color="#6C3FD1"
          onClick={() => setDetailKey("proposalsMade")}
        />
        <StatTile
          label="Contributed to others'"
          value={stats.contributedToOthers}
          color="#4069D9"
          onClick={() => setDetailKey("contributedToOthers")}
        />
        <StatTile
          label="Comments made"
          value={stats.commentsMade}
          color="#8358D3"
          onClick={() => setDetailKey("commentsMade")}
        />
        <StatTile
          label="People you've talked with"
          value={stats.peopleConversedWith}
          color="#F86767"
          onClick={() => setDetailKey("peopleConversedWith")}
        />
        <StatTile
          label="Decision-makers engaged"
          value={stats.decisionMakersEngaged}
          color="#2E8B57"
          onClick={() => setDetailKey("decisionMakersEngaged")}
        />
        <StatTile
          label="Letters written"
          value={stats.lettersWritten}
          sublabel={stats.lettersPublished > 0 ? `${stats.lettersPublished} published` : undefined}
          color={LOG_TYPE_COLOR.letter_to_editor}
          onClick={() => setDetailKey("lettersWritten")}
        />
        <StatTile
          label="Meetings attended"
          value={stats.meetingsAttended}
          color={LOG_TYPE_COLOR.community_meeting}
          onClick={() => setDetailKey("meetingsAttended")}
        />
        <StatTile
          label="Volunteer hours"
          value={stats.volunteerHours}
          color={LOG_TYPE_COLOR.volunteer_hours}
          onClick={() => setDetailKey("volunteerHours")}
        />
        <StatTile
          label="Testimony given"
          value={stats.testimonyGiven}
          color={LOG_TYPE_COLOR.testimony}
          onClick={() => setDetailKey("testimonyGiven")}
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
            View your full log ({published.length})
          </summary>
          <ul className="mt-2 space-y-1.5">
            {published.map((log) => (
              <LogRow key={log.id} log={log} />
            ))}
          </ul>
        </details>
      )}

      {modalMode && (
        <AddLogModal
          existing={modalMode === "new" ? null : modalMode}
          categoryColor={categoryColor}
          onDirty={() => {
            dirtyRef.current = true;
          }}
          onClose={() => {
            dirtyRef.current = false;
            setModalMode(null);
          }}
          isDirty={() => dirtyRef.current}
        />
      )}

      {detailKey && (
        <DetailModal
          title={STAT_TITLES[detailKey]}
          onClose={() => setDetailKey(null)}
        >
          {detailKey === "lettersWritten" || detailKey === "meetingsAttended" ||
          detailKey === "volunteerHours" || detailKey === "testimonyGiven" ? (
            <LogTypeDetailList
              logs={published.filter((l) => l.logType === STAT_TO_LOG_TYPE[detailKey])}
            />
          ) : (
            <PlainDetailList items={details[detailKey]} />
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
  lettersWritten: "Letters to the editor",
  meetingsAttended: "Community meetings",
  volunteerHours: "Volunteer hours",
  testimonyGiven: "Testimony given",
};

const STAT_TO_LOG_TYPE: Partial<Record<ClickableStatKey, CivicLog["logType"]>> = {
  lettersWritten: "letter_to_editor",
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

function LogTypeDetailList({ logs }: { logs: CivicLog[] }) {
  if (logs.length === 0) {
    return <p className="text-sm text-neutral-500">Nothing logged yet.</p>;
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
            {log.organization ? ` · Hosted by ${log.organization}` : ""}
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

function LogRow({ log }: { log: CivicLog }) {
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
        </p>
        {log.organization && <p className="mt-0.5 text-neutral-500">Hosted by {log.organization}</p>}
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
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="shrink-0 rounded-full border border-neutral-300 px-1.5 text-neutral-500 hover:border-duty-red hover:text-duty-red"
          title="Remove this log entry"
        >
          ✕
        </button>
      )}
    </li>
  );
}

function StatTile({
  label,
  value,
  sublabel,
  color,
  onClick,
}: {
  label: string;
  value: number;
  sublabel?: string;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg p-3 text-left transition hover:-translate-y-0.5 hover:shadow-sm"
      style={{ backgroundColor: `${color}1a` }}
    >
      <p className="text-2xl font-bold" style={{ color }}>
        {value}
      </p>
      <p className="mt-0.5 text-xs font-medium text-neutral-600">{label}</p>
      {sublabel && <p className="text-[11px] text-neutral-500">{sublabel}</p>}
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
  categoryColor,
  onDirty,
  onClose,
  isDirty,
}: {
  existing: CivicLog | null;
  categoryColor: string;
  onDirty: () => void;
  onClose: () => void;
  isDirty: () => boolean;
}) {
  const [logType, setLogType] = useState<CivicLog["logType"]>(existing?.logType ?? "community_meeting");
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
                  Category (optional) — e.g. Environment, Youth, Food security
                </span>
                <input
                  name="category"
                  defaultValue={existing?.category ?? ""}
                  className="input"
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
