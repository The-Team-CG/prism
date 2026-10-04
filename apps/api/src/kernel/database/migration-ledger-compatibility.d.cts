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
  requiredHead: string;
}): KnownMigrationPrefix;

export function assertExactMigrationCompatibility(input: {
  localMigrations: readonly LocalMigration[];
  appliedMigrations: readonly AppliedMigration[];
  requiredHead: string;
}): string;

export function migrationChecksumVariants(sql: string | Uint8Array): [string, ...string[]];
