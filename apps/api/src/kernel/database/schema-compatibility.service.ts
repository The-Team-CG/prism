import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import migrationLedger = require('./migration-ledger-compatibility.cjs');
import type { AppliedMigration, LocalMigration } from './migration-ledger-compatibility.cjs';

interface PrismaMigrationRow {
  migration_name: string;
  checksum: string;
  started_at: Date | null;
  finished_at: Date | null;
  rolled_back_at: Date | null;
}

@Injectable()
export class SchemaCompatibilityService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SchemaCompatibilityService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onApplicationBootstrap(): Promise<void> {
    const mode = (process.env.PRISM_SCHEMA_COMPATIBILITY_MODE ?? 'disabled').trim();
    if (mode === 'disabled') return;
    if (mode !== 'exact') {
      throw new Error(`Unsupported PRISM_SCHEMA_COMPATIBILITY_MODE: ${mode}.`);
    }

    const requiredHead = process.env.PRISM_SCHEMA_REQUIRED_HEAD?.trim();
    if (!requiredHead) {
      throw new Error('PRISM_SCHEMA_REQUIRED_HEAD is required when exact schema compatibility is enabled.');
    }

    const localMigrations = await this.readLocalMigrations();
    const rows = await this.prisma.$queryRaw<PrismaMigrationRow[]>`
      SELECT migration_name, checksum, started_at, finished_at, rolled_back_at
      FROM public."_prisma_migrations"
    `;
    const appliedMigrations: AppliedMigration[] = rows.map((row) => ({
      name: row.migration_name,
      checksum: row.checksum,
      startedAt: row.started_at,
      finishedAt: row.finished_at,
      rolledBackAt: row.rolled_back_at,
    }));

    const head = migrationLedger.assertExactMigrationCompatibility({ localMigrations, appliedMigrations, requiredHead });
    this.logger.log(`Database migration history exactly matches required head ${head}.`);
  }

  private async readLocalMigrations(): Promise<LocalMigration[]> {
    const candidates = [
      resolve(process.cwd(), 'apps/api/prisma/migrations'),
      resolve(process.cwd(), 'prisma/migrations'),
    ];
    let migrationDirectory: string | undefined;
    for (const candidate of candidates) {
      try {
        const entries = await readdir(candidate, { withFileTypes: true });
        if (entries.some((entry) => entry.isDirectory())) {
          migrationDirectory = candidate;
          break;
        }
      } catch {
        // Try the other supported runtime layout, then fail with a clear error.
      }
    }
    if (!migrationDirectory) throw new Error('Could not locate the bundled Prisma migrations directory.');

    const entries = await readdir(migrationDirectory, { withFileTypes: true });
    const migrationDirectories = entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
    const migrations: LocalMigration[] = [];
    for (const name of migrationDirectories) {
      const sql = await readFile(join(migrationDirectory, name, 'migration.sql'));
      migrations.push({ name, checksum: createHash('sha256').update(sql).digest('hex') });
    }
    return migrations;
  }
}
