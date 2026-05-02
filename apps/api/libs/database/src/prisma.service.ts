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

    const connectionString =
      runtimeCandidates.find((value) => {
        try {
          return new URL(value).hostname.includes('pooler.supabase.com');
        } catch {
          return false;
        }
      }) ?? runtimeCandidates[0];

    if (!connectionString) {
      throw new Error('DIRECT_URL, PRISMA_DATABASE_URL, SUPABASE_DB_URL, or DATABASE_URL must be configured');
    }

    let isPooler = false;
    try {
      isPooler = new URL(connectionString).hostname.includes('pooler.supabase.com');
    } catch {
      // Leave isPooler false; Pool/Prisma will surface a clearer error for invalid URLs.
    }

    if (isPooler) {
      console.warn(
        'Prisma is connecting through a Supabase pooler host. Prefer the direct host for Prisma operations.',
      );
    }

    const pool = new Pool({
      connectionString,
      ssl:
        process.env.DB_SSL === 'false'
          ? false
          : { rejectUnauthorized: false },
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
