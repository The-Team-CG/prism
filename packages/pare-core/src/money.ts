/**
 * Peso formatting used in every human-facing PARE string.
 *
 * The grouping locale is pinned rather than left to the host default, because
 * the same string is now produced by the API and by separately deployed agent
 * apps whose hosts we do not control.
 */
export function formatPeso(amount: number): string {
  return `₱${amount.toLocaleString("en-US")}`;
}
