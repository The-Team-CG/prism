declare type DatabaseTlsOptions = false | { rejectUnauthorized: true; ca?: string };

declare type DatabaseConnectionOptions = {
  source: string;
  purpose: 'runtime' | 'migration';
  hostname: string;
  port: string;
  target: string;
  isLoopback: boolean;
  isPooler: boolean;
  connectionString: string;
  prismaConnectionString: string;
  ssl: DatabaseTlsOptions;
};

declare type DatabaseConnectionInput = {
  purpose?: 'runtime' | 'migration';
  env?: Record<string, string | undefined>;
  cwd?: string;
  required?: boolean;
};

declare class DatabaseConnectionConfigError extends Error {
  code: string;
}

declare const connectionConfig: {
  assertLocalDatabaseUrl(value: string, env: Record<string, string | undefined>, shadow?: boolean): void;
  DatabaseConnectionConfigError: typeof DatabaseConnectionConfigError;
  normalizeDatabaseConnection(
    rawUrl: string,
    options?: Omit<DatabaseConnectionInput, 'required'> & { source?: string },
  ): DatabaseConnectionOptions;
  selectDatabaseConnection(options: DatabaseConnectionInput & { required: false }): DatabaseConnectionOptions | null;
  selectDatabaseConnection(options?: DatabaseConnectionInput & { required?: true }): DatabaseConnectionOptions;
};

export = connectionConfig;
