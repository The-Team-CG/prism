/**
 * Renders a database error for logging.
 *
 * PA-309: under the @prisma/adapter-pg driver adapter, `error.message` is a bare
 * code frame with no reason appended, so logging the message alone leaves no
 * recoverable diagnostic. The Prisma error code (P1001, P2024, P1017, ...) and
 * `meta` carry the actual cause and must survive into the log line.
 */
function renderMeta(meta: unknown): string {
  try {
    return JSON.stringify(meta) ?? String(meta);
  } catch {
    // Circular or otherwise unserialisable meta must not cost us the log line.
    return String(meta);
  }
}

export function describeDatabaseError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);

  if (typeof error !== 'object' || error === null) return message;

  const { code, meta } = error as { code?: unknown; meta?: unknown };
  const parts = [message];

  if (typeof code === 'string' && code.length > 0) parts.push(`(code=${code})`);
  if (meta !== undefined && meta !== null) parts.push(`meta=${renderMeta(meta)}`);

  return parts.join(' ');
}
