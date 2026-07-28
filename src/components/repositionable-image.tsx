"use client";

import { useRef, useState } from "react";
import { updateProposalImagePosition } from "@/app/proposals/actions";

// Cover images use object-cover, which crops to fill the box — fine
// most of the time, but it can slice off exactly the part of the photo
// that matters. This lets the owner drag directly on the image to set
// a focal point (stored as an x/y percentage, fed back in as
// object-position), instead of being stuck with a dead-center crop.
// Pointer events (not the site's usual HTML5 drag-and-drop) on purpose —
// they unify mouse and touch, so dragging works on phones here even
// though it doesn't yet for reordering the decision chain.
export function RepositionableImage({
  proposalId,
  src,
  alt,
  className,
  initialX,
  initialY,
  isOwner,
  children,
}: {
  proposalId: string;
  src: string;
  alt: string;
  className: string;
  initialX: number;
  initialY: number;
  isOwner: boolean;
  children?: React.ReactNode;
}) {
  const [pos, setPos] = useState({ x: initialX, y: initialY });
  const [repositioning, setRepositioning] = useState(false);
  const [saving, setSaving] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  function pointFromClient(clientX: number, clientY: number) {
    const el = containerRef.current;
    if (!el) return pos;
    const rect = el.getBoundingClientRect();
    const x = Math.round(Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100)));
    const y = Math.round(Math.min(100, Math.max(0, ((clientY - rect.top) / rect.height) * 100)));
    return { x, y };
  }

  async function persist(next: { x: number; y: number }) {
    setSaving(true);
    const fd = new FormData();
    fd.set("proposal_id", proposalId);
    fd.set("x", String(next.x));
    fd.set("y", String(next.y));
    await updateProposalImagePosition(fd);
    setSaving(false);
  }

  return (
    <div ref={containerRef} className="relative">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        className={className}
        style={{ objectPosition: `${pos.x}% ${pos.y}%`, touchAction: repositioning ? "none" : undefined }}
        draggable={false}
        onPointerDown={(e) => {
          if (!repositioning) return;
          dragging.current = true;
          setPos(pointFromClient(e.clientX, e.clientY));
        }}
        onPointerMove={(e) => {
          if (!repositioning || !dragging.current) return;
          setPos(pointFromClient(e.clientX, e.clientY));
        }}
        onPointerUp={(e) => {
          if (!repositioning || !dragging.current) return;
          dragging.current = false;
          const next = pointFromClient(e.clientX, e.clientY);
          setPos(next);
          persist(next);
        }}
      />

      {repositioning && (
        <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center pt-2">
          <p className="rounded bg-black/70 px-2 py-1 text-xs text-white">
            {saving ? "Saving…" : "Click or drag to set what stays visible"}
          </p>
        </div>
      )}

      {isOwner && (
        <button
          type="button"
          onClick={() => setRepositioning(!repositioning)}
          className="absolute bottom-2 left-2 rounded bg-black/55 px-2 py-1 text-xs text-white underline decoration-white/70 hover:bg-black/70"
        >
          {repositioning ? "Done" : "Reposition image"}
        </button>
      )}

      {children}
    </div>
  );
}
