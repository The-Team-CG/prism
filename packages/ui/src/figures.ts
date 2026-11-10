/**
 * True for a figure that reports nothing: zero, a zero amount ("₱0") or a dash.
 * Stat cells draw these in grey so the numbers that carry news stand out.
 */
export function isZeroFigure(value: unknown): boolean {
  if (value === 0) return true;
  if (typeof value !== "string") return false;
  const text = value.trim();
  return text === "" || text === "—" || text === "-" || /^[^\d-]*0+([.,]0+)?$/.test(text);
}
