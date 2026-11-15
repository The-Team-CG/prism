/** Pure finance domain rules (no React / I/O). */

export function parseRecordPaymentAmount(raw: string): number {
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}
