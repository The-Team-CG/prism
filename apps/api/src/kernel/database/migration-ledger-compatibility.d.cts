export interface LocalMigration {
  name: string;
  checksum: string;
  checksumVariants?: readonly string[];
}

export interface AppliedMigration {
  name: string;
  checksum: string;
  startedAt: Date | string | null;
  finishedAt: Date | string | null;
  rolledBackAt: Date | string | null;
}

export interface KnownMigrationPrefix {
  appliedHead: string;
  pendingMigrations: LocalMigration[];
}

export function assertKnownMigrationPrefix(input: {
  localMigrations: readonly LocalMigration[];
  appliedMigrations: readonly AppliedMigration[];
}): KnownMigrationPrefix;

/** Returns the latest local migration name when every shipped migration is applied, finished and checksum-identical. */
export function assertLocalMigrationsApplied(input: {
  localMigrations: readonly LocalMigration[];
  appliedMigrations: readonly AppliedMigration[];
}): string;

export function migrationChecksumVariants(sql: string | Uint8Array, name?: string): [string, ...string[]];
export function historicalMigrationChecksums(name: string, currentChecksums: readonly string[]): string[];
