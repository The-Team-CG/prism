import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import connectionConfig = require('./db-connection-config.cjs');
import { retryOnSerializationConflict } from './serialization-retry';

export const toPrismaJson = (value: unknown): Prisma.InputJsonValue => value as Prisma.InputJsonValue;

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  /** `$transaction` without the serialization retry, for callers and tests that must see the conflict itself. */
  readonly transactionOnce: PrismaClient['$transaction'];

  constructor() {
    const database = connectionConfig.selectDatabaseConnection({ purpose: 'runtime' });
    console.log(`Prisma connecting to ${database.target} via ${database.source}.`);

    const pool = new Pool({
      connectionString: database.connectionString,
      ssl: database.ssl,
      // PA-307, values agreed with Anthony.
      // max: 5 halves pg's default ceiling of 10 (pg-pool/index.js:89). This is a
      // real behavioural change, not a restatement.
      // idleTimeoutMillis restates the installed default (pg-pool/index.js:98-100);
      // explicit so a version bump cannot change it silently.
      // connectionTimeoutMillis is the other real change - pg arms no timer when it
      // is unset (pg-pool/index.js:206), so a checkout against an unreachable
      // database waits forever. 30s sits above the slowest observed successful
      // connect (18.7s), so it bounds the wait without cutting off a slow success.
      max: 5,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 30_000,
    });

    const adapter = new PrismaPg(pool);
    super({ adapter });

    // Interactive transactions run again when Postgres aborts them with a serialization conflict. The batch form
    // holds promises that already started, so it is passed through unchanged.
    const transaction = this.$transaction.bind(this);
    this.transactionOnce = transaction;
    const withRetry = ((...args: Parameters<typeof transaction>) =>
      typeof args[0] === 'function' ? retryOnSerializationConflict(() => transaction(...args)) : transaction(...args)) as typeof transaction;
    Object.defineProperty(this, '$transaction', { value: withRetry });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
