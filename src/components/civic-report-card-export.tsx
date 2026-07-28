"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { CivicDetailItem, CivicLog, CivicStats } from "@/components/civic-report-card";

function formatDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// Export flow for the civic report card — a checklist of what to
// include (stat tiles are always in; proposals made and comments made
// are each optional, per Samantha's ask), a live preview that reflects
// those choices, and three ways out: PNG, JPG (both via html2canvas —
// a free, client-side, MIT-licensed library, no server round-trip and
// no new paid service), and "Save as PDF," which just uses the
// browser's own print-to-PDF rather than a new PDF-generation
// dependency. The preview is rendered through a portal directly under
// <body> (not wherever this component happens to sit in the tree) so
// the print-only CSS in globals.css can reliably hide everything else
// on the page and print just this card.
export function CivicReportCardExport({
  displayName,
  stats,
  proposals,
  comments,
  logs,
  onClose,
}: {
  displayName: string;
  stats: CivicStats;
  proposals: CivicDetailItem[];
  comments: CivicDetailItem[];
  logs: CivicLog[];
  onClose: () => void;
}) {
  // The report has no built-in start date (your account might, but not
  // every stat on it does — comments and proposals aren't logged
  // entries), so the most honest "date range" is the span of your own
  // logged activity: earliest to latest occurred_on among published
  // logs. Falls back to just "Generated on X" if nothing's logged yet.
  const logDates = logs.map((l) => l.occurredOn).filter(Boolean).sort();
  const dateRangeText =
    logDates.length > 0
      ? logDates[0] === logDates[logDates.length - 1]
        ? formatDate(logDates[0])
        : `${formatDate(logDates[0])} – ${formatDate(logDates[logDates.length - 1])}`
      : null;

  const [mounted, setMounted] = useState(false);
  const [includeProposals, setIncludeProposals] = useState(true);
  const [includeComments, setIncludeComments] = useState(true);
  const [working, setWorking] = useState<null | "png" | "jpg">(null);
  const [error, setError] = useState<string | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  // createPortal needs document.body, which doesn't exist during
  // server-side rendering — the standard fix is to only portal after
  // mounting on the client.
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function downloadImage(format: "png" | "jpg") {
    if (!previewRef.current) return;
    setWorking(format);
    setError(null);
    try {
      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(previewRef.current, {
        backgroundColor: "#ffffff",
        scale: 2,
      });
      const mime = format === "png" ? "image/png" : "image/jpeg";
      const dataUrl = canvas.toDataURL(mime, 0.92);
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = `civic-report-card.${format}`;
      link.click();
    } catch (err) {
      console.error("civic report card export failed", err);
      setError("Couldn't generate that image. Try again.");
    } finally {
      setWorking(null);
    }
  }

  function printAsPdf() {
    document.body.classList.add("civic-export-printing");
    const cleanup = () => {
      document.body.classList.remove("civic-export-printing");
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup);
    // Give the browser a tick to apply the print class before opening
    // the print dialog.
    setTimeout(() => window.print(), 50);
  }

  if (!mounted) return null;

  return createPortal(
    <div id="civic-export-print-root">
      <div
        className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4 print:static print:bg-white print:p-0"
        onClick={onClose}
      >
        <div
          className="w-full max-w-lg rounded-lg bg-white shadow-xl print:max-w-none print:rounded-none print:shadow-none"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between gap-2 border-b border-neutral-100 p-4 print:hidden">
            <h3 className="text-base font-semibold">Export your civic report card</h3>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-neutral-300 px-2 py-0.5 text-sm text-neutral-600"
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          <div className="space-y-3 p-4 print:hidden">
            <p className="text-xs text-neutral-500">What should the export include?</p>
            <label className="flex items-center gap-2 text-sm text-neutral-700">
              <input
                type="checkbox"
                checked={includeProposals}
                onChange={(e) => setIncludeProposals(e.target.checked)}
              />
              Proposals made
            </label>
            <label className="flex items-center gap-2 text-sm text-neutral-700">
              <input
                type="checkbox"
                checked={includeComments}
                onChange={(e) => setIncludeComments(e.target.checked)}
              />
              Comments made
            </label>
            <p className="text-[11px] text-neutral-400">
              Your stat tiles are always included. Only published activity ever shows up here — no
              drafts, no demographic info.
            </p>
          </div>

          {/* This is the part that actually gets captured to an image or
              printed — everything above (the checklist, the header) is
              hidden in print via `print:hidden`. */}
          <div className="max-h-[50vh] overflow-y-auto border-t border-neutral-100 p-4 print:max-h-none print:overflow-visible print:border-0">
            <div ref={previewRef} className="rounded-lg bg-white p-5">
              <h2 className="text-lg font-bold text-neutral-900">{displayName}'s civic report card</h2>
              <p className="mt-0.5 text-xs text-neutral-500">
                Generated {new Date().toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}
                {dateRangeText ? ` · Covers ${dateRangeText}` : ""}
              </p>

              <div className="mt-4 grid grid-cols-3 gap-2.5">
                <ExportTile label="Proposals made" value={stats.proposalsMade} color="#6C3FD1" />
                <ExportTile label="Contributions to others" value={stats.contributedToOthers} color="#4069D9" />
                <ExportTile label="Comments made" value={stats.commentsMade} color="#8358D3" />
                <ExportTile label="People talked with" value={stats.peopleConversedWith} color="#F86767" />
                <ExportTile label="Decision-makers engaged" value={stats.decisionMakersEngaged} color="#2E8B57" />
                <ExportTile
                  label="Letters written"
                  value={stats.lettersWritten}
                  sublabel={stats.lettersPublished > 0 ? `${stats.lettersPublished} published` : undefined}
                  color="#D97706"
                />
                <ExportTile label="Meetings attended" value={stats.meetingsAttended} color="#0EA5A5" />
                <ExportTile label="Volunteer hours" value={stats.volunteerHours} color="#C2410C" />
                <ExportTile label="Testimony given" value={stats.testimonyGiven} color="#7C3AED" />
              </div>

              {includeProposals && (
                <div className="mt-4">
                  <p className="text-xs font-semibold text-neutral-600">Proposals made</p>
                  {proposals.length === 0 ? (
                    <p className="mt-1 text-xs text-neutral-400">None yet.</p>
                  ) : (
                    <ul className="mt-1.5 list-disc space-y-0.5 pl-4 text-xs text-neutral-700">
                      {proposals.map((p, i) => (
                        <li key={i}>
                          {p.label}
                          {p.sublabel ? ` — ${p.sublabel}` : ""}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {includeComments && (
                <div className="mt-4">
                  <p className="text-xs font-semibold text-neutral-600">Comments made</p>
                  {comments.length === 0 ? (
                    <p className="mt-1 text-xs text-neutral-400">None yet.</p>
                  ) : (
                    <ul className="mt-1.5 list-disc space-y-0.5 pl-4 text-xs text-neutral-700">
                      {comments.map((c, i) => (
                        <li key={i}>
                          {c.label}
                          {c.sublabel ? ` — ${c.sublabel}` : ""}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2 border-t border-neutral-100 p-4 print:hidden">
            <button
              type="button"
              disabled={working !== null}
              onClick={() => downloadImage("png")}
              className="rounded bg-duty-purple px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
            >
              {working === "png" ? "Working…" : "Download PNG"}
            </button>
            <button
              type="button"
              disabled={working !== null}
              onClick={() => downloadImage("jpg")}
              className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
            >
              {working === "jpg" ? "Working…" : "Download JPG"}
            </button>
            <button
              type="button"
              onClick={printAsPdf}
              className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50"
            >
              Save as PDF
            </button>
            <button
              type="button"
              onClick={onClose}
              className="ml-auto rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-50"
            >
              Cancel
            </button>
          </div>
          {error && <p className="px-4 pb-3 text-xs text-duty-red print:hidden">{error}</p>}
        </div>
      </div>
    </div>,
    document.body
  );
}

function ExportTile({
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
    <div className="rounded-lg p-2.5" style={{ backgroundColor: `${color}1a` }}>
      <p className="text-xl font-bold" style={{ color }}>
        {value}
      </p>
      <p className="mt-0.5 text-[11px] font-medium text-neutral-600">{label}</p>
      {sublabel && <p className="text-[10px] text-neutral-500">{sublabel}</p>}
    </div>
  );
}
