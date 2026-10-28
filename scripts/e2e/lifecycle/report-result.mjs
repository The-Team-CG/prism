export function hasFailedChecks(counts, strict = false) {
  const failures = strict ? ["FAIL", "HARNESS_ERROR", "GAP", "BLOCKED", "REVIEW"] : ["FAIL", "HARNESS_ERROR"];
  return failures.some(status => (counts[status] ?? 0) > 0);
}
