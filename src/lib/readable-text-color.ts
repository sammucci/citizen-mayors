// Picks white or dark-grey text for a given background color, based on
// its relative luminance, instead of always assuming white. Category
// colors are editable data (see supabase/schema.sql), and pale ones —
// the yellow especially — fail contrast with white text. Rather than
// hardcode "yellow gets dark text," this works for any background,
// including whatever colors get added later.
export function readableTextColor(hex: string): string {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.substring(0, 2), 16) / 255;
  const g = parseInt(clean.substring(2, 4), 16) / 255;
  const b = parseInt(clean.substring(4, 6), 16) / 255;

  // Standard relative luminance (WCAG). Each channel is gamma-corrected
  // before weighting — sRGB isn't linear, so skipping this step biases
  // the result toward misjudging mid-tones.
  const toLinear = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const luminance = 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);

  // White text needs the background fairly dark to stay readable;
  // above this luminance threshold, dark grey reads better than white.
  return luminance > 0.55 ? "#262626" : "#ffffff";
}
