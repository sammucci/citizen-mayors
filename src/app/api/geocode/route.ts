import { NextRequest, NextResponse } from "next/server";
import { geocodeAddress } from "@/lib/geocode-address";

// Backs the live "here's what this will show as" preview on the address
// field, both on the new-proposal form and the edit form — same
// geocodeAddress() call that actually runs at save time (see
// proposals/actions.ts), so the preview can never drift from what
// actually gets stored. This route used to proxy Nominatim for a
// different purpose (neighborhood-name suggestions), but that field
// moved to a fixed local list a while back and stopped calling this at
// all — repurposed rather than left as dead code.
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 4) {
    return NextResponse.json({ label: null });
  }

  const result = await geocodeAddress(q);
  return NextResponse.json({ label: result?.label ?? null });
}
