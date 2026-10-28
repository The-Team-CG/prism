import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const API_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REPO_ROOT = resolve(API_ROOT, '..', '..');
const MIGRATIONS_DIR = 'apps/api/prisma/migrations/';
const EXCEPTIONS_PATH = join(API_ROOT, 'prisma', 'migration-immutability-exceptions.json');

/** A migration that reached the base branch may already be applied somewhere; changing its bytes breaks that database's ledger. */
const normalizeLineEndings = (text) => text.replace(/\r\n/g, '\n');

/**
 * `changes` are `git diff --name-status` rows against the base branch. Only files of migrations that already
 * exist there can violate the rule: a new migration is free to change until it is merged.
 */
export function findMutatedMigrations({ changes, readBase, readHead, exceptions = [] }) {
  const allowed = new Map(exceptions.map((entry) => [entry.migration, entry.reason]));
  const violations = [];
  for (const { status, path } of changes) {
    if (!path.startsWith(MIGRATIONS_DIR) || status === 'A') continue;
    const migration = path.slice(MIGRATIONS_DIR.length).split('/')[0];
    if (!migration || migration === 'migration_lock.toml' || allowed.has(migration)) continue;
    if (status === 'M') {
      const before = readBase(path);
      const after = readHead(path);
      if (before !== null && after !== null && normalizeLineEndings(before) === normalizeLineEndings(after)) continue;
      violations.push({ migration, path, change: 'edited' });
    } else {
      violations.push({ migration, path, change: status === 'D' ? 'deleted' : 'renamed' });
    }
  }
  return violations;
}

function git(args) {
  return execFileSync('git', args, { cwd: REPO_ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
}

function loadExceptions() {
  if (!existsSync(EXCEPTIONS_PATH)) return [];
  const parsed = JSON.parse(readFileSync(EXCEPTIONS_PATH, 'utf8'));
  for (const entry of parsed.exceptions ?? []) {
    if (!entry.migration || !entry.reason?.trim()) throw new Error('Every migration immutability exception needs a migration name and a reason.');
  }
  return parsed.exceptions ?? [];
}

export function runMigrationImmutabilityGuard({ baseRef = process.env.MIGRATION_BASE_REF } = {}) {
  if (!baseRef || /^0+$/.test(baseRef)) {
    console.log('Migration immutability: no base ref to compare with (new branch or local run); skipped.');
    return 0;
  }
  try {
    git(['rev-parse', '--verify', '--quiet', `${baseRef}^{commit}`]);
  } catch {
    console.log(`Migration immutability: base ref ${baseRef} is not available in this checkout; skipped.`);
    return 0;
  }
  const rows = git(['diff', '--name-status', '--no-renames', `${baseRef}...HEAD`, '--', MIGRATIONS_DIR]).split('\n').filter(Boolean);
  const changes = rows.map((row) => { const [status, path] = row.split('\t'); return { status: status[0], path }; });
  const base = git(['merge-base', baseRef, 'HEAD']).trim();
  const read = (ref) => (path) => { try { return git(['show', `${ref}:${path}`]); } catch { return null; } };
  const violations = findMutatedMigrations({ changes, readBase: read(base), readHead: read('HEAD'), exceptions: loadExceptions() });
  if (violations.length === 0) {
    console.log(`Migration immutability: no migration that exists on ${baseRef} was changed.`);
    return 0;
  }
  console.error(`Migration immutability failed: ${violations.length} file(s) of migrations already on ${baseRef} were changed.`);
  for (const v of violations) console.error(`  - ${v.migration}: ${v.change} (${v.path})`);
  console.error('A database that already applied the old file now fails its migration ledger check. Add a new migration instead.');
  console.error('If a change is deliberate and no database has applied the migration, list it with a reason in apps/api/prisma/migration-immutability-exceptions.json.');
  return 1;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  process.exit(runMigrationImmutabilityGuard());
}
