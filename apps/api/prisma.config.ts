import 'dotenv/config';
import { defineConfig } from 'prisma/config';

const candidates = [
  process.env.PRISMA_DATABASE_URL,
  process.env.DIRECT_URL,
  process.env.SUPABASE_DB_URL,
  process.env.DATABASE_URL,
];

const prismaDbUrl =
  candidates
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .find((value) => value.length > 0) ?? '';

const shadowDbUrl = process.env.SHADOW_DATABASE_URL ?? '';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  ...(prismaDbUrl
    ? {
        datasource: {
          url: prismaDbUrl,
          ...(shadowDbUrl ? { shadowDatabaseUrl: shadowDbUrl } : {}),
        },
      }
    : {}),
});
