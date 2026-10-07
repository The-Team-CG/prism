import * as connectionConfig from './db-connection-config.cjs';

type DatabaseEnvironment = Record<string, string | undefined>;

/** URL selection and local/TLS policy live in the shared CJS database module. */
export function resolveDatabaseUrl(env: DatabaseEnvironment, mode: 'runtime' | 'migration' = 'runtime'): string {
  return connectionConfig.selectDatabaseConnection({ env, purpose: mode, required: false })?.connectionString ?? '';
}

export const assertLocalDatabaseUrl = connectionConfig.assertLocalDatabaseUrl;
