const path = require('node:path');

function normalizePath(value) {
  return String(value || '').replace(/\\/g, '/').replace(/\/+/g, '/').replace(/\/$/, '').toLowerCase();
}

function hasWorktreeSegment(value) {
  return /(^|\/)\.worktrees(?:\/|$)/i.test(normalizePath(value));
}

function containsPathAtBoundary(haystack, candidate) {
  const normalizedHaystack = normalizePath(haystack);
  const normalizedCandidate = normalizePath(candidate);
  if (!normalizedCandidate) return false;
  return normalizedHaystack.includes(`${normalizedCandidate}/`);
}

/**
 * Proves that a process belongs to the checkout that launched the guard.
 * A false result is deliberately conservative: callers must not kill it unless
 * their explicitly documented command-line-unavailable fallback applies.
 */
function isOwnedByThisCheckout({ commandLine, executablePath } = {}, ownerRoot) {
  const owner = normalizePath(path.resolve(String(ownerRoot || '.')));
  const combined = normalizePath([commandLine, executablePath].filter(Boolean).join(' '));
  if (!owner || !combined) return false;

  const primary = !hasWorktreeSegment(owner);
  if (primary && hasWorktreeSegment(combined)) return false;
  return containsPathAtBoundary(combined, owner);
}

module.exports = {
  hasWorktreeSegment,
  isOwnedByThisCheckout,
  normalizePath,
};
