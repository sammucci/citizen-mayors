// Council-roster entries are stored as "Name (Role, District X)" — this
// splits that into a bold primary name and a smaller subtitle underneath,
// instead of showing the whole string as one flat bolded line. Shared by
// the proposal page's decision chain and the admin decision-makers list.
export function splitDecisionMakerLabel(name: string): {
  primary: string;
  subtitle: string | null;
} {
  const match = name.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  if (match) {
    return { primary: match[1].trim(), subtitle: match[2].trim() };
  }
  return { primary: name, subtitle: null };
}
