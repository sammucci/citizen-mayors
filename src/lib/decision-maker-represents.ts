// A decision-maker whose name IS the seat ("Councilmember, District 3")
// already says who it represents right there in the title — Samantha's
// catch: leaving "who they represent" as an editable field on top of
// that meant anyone could set District 3's seat to say it represents
// District 5, with nothing stopping it or even flagging the mismatch.
// For seats where the answer is unambiguous from the name itself, it's
// derived here instead of stored as a separate editable opinion — this
// runs both in the editor (to hide the picker for these) and in the
// server action (to override anything submitted for these, so a mismatch
// can't be introduced via a direct API call either, not just via the UI).
//
// Anything that doesn't match one of these patterns (custom-added
// decision-makers, boards, departments used as a decision-maker) keeps
// the manual picker exactly as before — there's no name to derive it
// from for those.
export type RepresentsInference = { scope: "district" | "citywide"; district: number | null };

export function inferRepresents(decisionMakerName: string): RepresentsInference | null {
  const name = decisionMakerName.trim();

  const districtSeat = name.match(/^(?:councilmember|council president),\s*district\s*(\d+)$/i);
  if (districtSeat) {
    return { scope: "district", district: Number(districtSeat[1]) };
  }

  if (/^councilmember at-large/i.test(name)) {
    return { scope: "citywide", district: null };
  }

  if (/^mayor of philadelphia$/i.test(name)) {
    return { scope: "citywide", district: null };
  }

  return null;
}
