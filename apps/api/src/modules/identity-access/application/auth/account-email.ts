/**
 * Accounts are identified by one canonical email: trimmed and lower-cased. Every account lookup and every write
 * of an account or approval-request email goes through this helper so case variants never become distinct
 * identities. The database enforces the same form with CHECK constraints on identity_access.users and
 * identity_access.approval_requests.
 */
export function canonicalAccountEmail(value: string): string {
  return value.trim().toLowerCase();
}
