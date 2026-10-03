import 'dotenv/config';
import { defineConfig } from 'prisma/config';
import connectionConfig = require('./src/kernel/database/db-connection-config.cjs');

const database = connectionConfig.selectDatabaseConnection({ purpose: 'migration', required: false });
const shadowDatabaseUrl = process.env.SHADOW_DATABASE_URL?.trim();
const shadowDatabase = shadowDatabaseUrl
  ? connectionConfig.normalizeDatabaseConnection(shadowDatabaseUrl, {
      purpose: 'migration',
      source: 'SHADOW_DATABASE_URL',
    })
  : undefined;

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  ...(database
    ? {
        datasource: {
          url: database.prismaConnectionString,
          ...(shadowDatabase ? { shadowDatabaseUrl: shadowDatabase.prismaConnectionString } : {}),
        },
      }
    : {}),
});
