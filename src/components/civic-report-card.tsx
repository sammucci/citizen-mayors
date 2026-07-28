"use client";

import { useEffect, useRef, useState } from "react";
import {
  addCivicLog,
  deleteCivicLog,
  publishCivicLogDraft,
  saveDraftCivicLog,
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

export type CivicLog = {
  id: string;
  logType: "letter_to_editor" | "community_meeting" | "volunteer_hours" | "testimony";
  occurredOn: string;
  published: boolean;
  publishedLink: string | null;
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
  categoryColor,
}: {
  stats: CivicStats;
  logs: CivicLog[];
  categoryColor: string;
}) {
  const [modalMode, setModalMode] = useState<null | "new" | CivicLog>(null);
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
        <StatTile label="Proposals made" value={stats.proposalsMade} color="#6C3FD1" />
        <StatTile
          label="Contributed to others'"
          value={stats.contributedToOthers}
          color="#4069D9"
        />
        <StatTile label="Comments made" value={stats.commentsMade} color="#8358D3" />
        <StatTile
          label="People you've talked with"
          value={stats.peopleConversedWith}
          color="#F86767"
        />
        <StatTile
          label="Decision-makers engaged"
          value={stats.decisionMakersEngaged}
          color="#2E8B57"
        />
        <StatTile
          label="Letters written"
          value={stats.lettersWritten}
          sublabel={stats.lettersPublished > 0 ? `${stats.lettersPublished} published` : undefined}
          color="#D97706"
        />
        <StatTile label="Meetings attended" value={stats.meetingsAttended} color="#0EA5A5" />
        <StatTile label="Volunteer hours" value={stats.volunteerHours} color="#C2410C" />
        <StatTile label="Testimony given" value={stats.testimonyGiven} color="#7C3AED" />
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
                    Finish
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
              <li
                key={log.id}
                className="flex items-start justify-between gap-2 rounded-lg border border-neutral-200 bg-white p-2 text-xs"
              >
                <div className="min-w-0">
                  <p className="font-medium text-neutral-700">
                    {LOG_TYPE_LABEL[log.logType]} · {formatDate(log.occurredOn)}
                    {log.logType === "volunteer_hours" && log.hours
                      ? ` · ${log.hours} hrs${log.category ? ` (${log.category})` : ""}`
                      : ""}
                    {log.logType === "letter_to_editor" && log.published ? " · Published" : ""}
                  </p>
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
                <form action={deleteCivicLog}>
                  <input type="hidden" name="id" value={log.id} />
                  <button
                    className="shrink-0 rounded-full border border-neutral-300 px-1.5 text-neutral-500 hover:border-duty-red hover:text-duty-red"
                    title="Remove this log entry"
                  >
                    ✕
                  </button>
                </form>
              </li>
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
    </div>
  );
}

function StatTile({
  label,
  value,
  sublabel,
  color,
}: {
  label: string;
  value: number;
  sublabel?: string;
  color: string;
}) {
  return (
    <div className="rounded-lg p-3" style={{ backgroundColor: `${color}1a` }}>
      <p className="text-2xl font-bold" style={{ color }}>
        {value}
      </p>
      <p className="mt-0.5 text-xs font-medium text-neutral-600">{label}</p>
      {sublabel && <p className="text-[11px] text-neutral-500">{sublabel}</p>}
    </div>
  );
}

// Floating window, same idea as the decision-maker card's pop-out —
// pick a log type, fill in what's relevant to it, save. If you close
// this without saving (backdrop click, Escape, or the ✕) and you'd
// actually typed something, it's auto-saved as a draft instead of just
// disappearing — nothing you started here gets lost by accident.
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

  function saveAsDraftIfDirty() {
    if (savedRef.current) return;
    if (!isDirty() || !formRef.current) {
      onClose();
      return;
    }
    const fd = new FormData(formRef.current);
    fd.set("log_type", logType);
    saveDraftCivicLog(fd);
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
                        ? { borderColor: categoryColor, backgroundColor: `${categoryColor}1a` }
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
            <p className="text-xs text-neutral-500">{LOG_TYPE_LABEL[existing.logType]}</p>
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
              style={{ backgroundColor: categoryColor }}
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
