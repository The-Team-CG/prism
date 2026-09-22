import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

export const toPrismaJson = (value: unknown): Prisma.InputJsonValue => value as Prisma.InputJsonValue;

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    const runtimeCandidates = [
      process.env.SUPABASE_DB_URL,
      process.env.DATABASE_URL,
      process.env.PRISMA_DATABASE_URL,
      process.env.DIRECT_URL,
    ]
      .map((value) => (typeof value === 'string' ? value.trim() : ''))
      .filter((value) => value.length > 0);

    const connectionString = runtimeCandidates[0];

    if (!connectionString) {
      throw new Error('DIRECT_URL, PRISMA_DATABASE_URL, SUPABASE_DB_URL, or DATABASE_URL must be configured');
    }

    // PA-307: report the host and port actually in use. Deliberately NOT a pooler
    // mode: nothing here can observe session vs transaction mode, and printing an
    // inferred one would be a guess dressed as a fact.
    let target = 'an unparseable connection string';
    try {
      const parsed = new URL(connectionString);
      target = `${parsed.hostname}:${parsed.port || '(default)'}`;
    } catch {
      // Pool/Prisma will surface a clearer error for an invalid URL.
    }
    console.log(`Prisma connecting to ${target}.`);

    const pool = new Pool({
      connectionString,
      ssl:
        process.env.DB_SSL === 'false'
          ? false
          : { rejectUnauthorized: false },
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
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
