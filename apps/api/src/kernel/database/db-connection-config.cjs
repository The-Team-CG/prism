'use strict';

const fs = require('node:fs');
const { isIP } = require('node:net');
const path = require('node:path');

const URL_PRIORITY = Object.freeze({
  runtime: ['DATABASE_URL', 'SUPABASE_DB_URL', 'PRISMA_DATABASE_URL', 'DIRECT_URL'],
  migration: ['DIRECT_URL', 'DATABASE_URL', 'PRISMA_DATABASE_URL', 'SUPABASE_DB_URL'],
});

const PG_SSL_QUERY_PARAMETERS = [
  'ssl',
  'sslmode',
  'sslrootcert',
  'sslcert',
  'sslkey',
  'sslpassword',
  'sslidentity',
];

class DatabaseConnectionConfigError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'DatabaseConnectionConfigError';
    this.code = code;
  }
}

function singleParameter(searchParams, key) {
  const values = [...searchParams.entries()]
    .filter(([name]) => name.toLowerCase() === key.toLowerCase())
    .map(([, value]) => value);
  if (values.length > 1) {
    throw new DatabaseConnectionConfigError(`Database URL contains repeated ${key} settings.`, 'INVALID_SSL_OPTIONS');
  }
  return values[0];
}

function effectiveHostname(url) {
  const override = singleParameter(url.searchParams, 'host');
  if (!override) return url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (override.startsWith('/')) {
    throw new DatabaseConnectionConfigError('Unix socket host overrides are not supported by the shared database policy.', 'UNSUPPORTED_HOST');
  }
  try {
    const parsed = new URL(`postgresql://${override}/`);
    if (!parsed.hostname) throw new Error('missing host');
    return parsed.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  } catch {
    throw new DatabaseConnectionConfigError('Database URL contains an invalid host override.', 'INVALID_DATABASE_URL');
  }
}

function effectivePort(url) {
  const override = singleParameter(url.searchParams, 'port');
  const value = override || url.port || '5432';
  if (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > 65535) {
    throw new DatabaseConnectionConfigError('Database URL contains an invalid port.', 'INVALID_DATABASE_URL');
  }
  return String(Number(value));
}

function isLoopback(hostname) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  return host === 'localhost' || host === '::1' || (isIP(host) === 4 && Number(host.split('.')[0]) === 127);
}

function resolveFilePath(value, cwd, label) {
  if (!value) return undefined;
  const resolved = path.isAbsolute(value) ? path.normalize(value) : path.resolve(cwd, value);
  try {
    if (!fs.statSync(resolved).isFile()) throw new Error('not a file');
    return resolved;
  } catch {
    throw new DatabaseConnectionConfigError(`${label} must point to a readable file.`, 'INVALID_CA_FILE');
  }
}

function readCertificate(file, label) {
  if (!file) return undefined;
  try {
    const contents = fs.readFileSync(file, 'utf8');
    if (!contents.includes('-----BEGIN CERTIFICATE-----')) throw new Error('invalid certificate');
    return contents;
  } catch {
    throw new DatabaseConnectionConfigError(`${label} is not a readable PEM certificate.`, 'INVALID_CA_FILE');
  }
}

function assertLocalDatabaseUrl(value, env, shadow = false) {
  let valid = false;
  try {
    const url = new URL(value);
    const host = env.PRISM_LOCAL_DATABASE_HOST || '127.0.0.1';
    valid = ['postgres:', 'postgresql:'].includes(url.protocol)
      && ['127.0.0.1', 'localhost', '[::1]', 'host.docker.internal'].includes(host)
      && url.hostname === host && Boolean(env.PRISM_LOCAL_DATABASE_PORT)
      && url.port === env.PRISM_LOCAL_DATABASE_PORT
      && url.pathname === (shadow ? '/prism_shadow' : '/postgres')
      && ![...url.searchParams.keys()].some((key) => ['host', 'hostaddr', 'port'].includes(key.toLowerCase()));
  } catch { /* Reject before connecting. */ }
  if (!valid) throw new DatabaseConnectionConfigError('Local development requires the generated local Supabase target. Run start-prism.cmd.', 'INVALID_LOCAL_DATABASE');
}

function makeConnection(rawUrl, { source, purpose, env, cwd }) {
  const localDevelopment = env.PRISM_LOCAL_DEV === '1';
  if (localDevelopment) {
    const shadow = source === 'SHADOW_DATABASE_URL';
    assertLocalDatabaseUrl(rawUrl, env, shadow);
    const runtime = URL_PRIORITY.runtime.map((key) => env[key]?.trim()).find(Boolean);
    if (purpose === 'migration' && !shadow && runtime !== rawUrl) throw new DatabaseConnectionConfigError('Local runtime and migration targets must match.', 'INVALID_LOCAL_DATABASE');
    if (env.SHADOW_DATABASE_URL?.trim()) assertLocalDatabaseUrl(env.SHADOW_DATABASE_URL.trim(), env, true);
  }
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new DatabaseConnectionConfigError(`The selected ${source} value is not a valid PostgreSQL URL.`, 'INVALID_DATABASE_URL');
  }

  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname) {
    throw new DatabaseConnectionConfigError(`The selected ${source} value must use a PostgreSQL URL with a host.`, 'INVALID_DATABASE_URL');
  }

  const hostname = effectiveHostname(url);
  const port = effectivePort(url);
  const loopback = isLoopback(hostname);
  const rawDbSsl = typeof env.DB_SSL === 'string' ? env.DB_SSL.trim().toLowerCase() : '';
  if (rawDbSsl && rawDbSsl !== 'true' && rawDbSsl !== 'false') {
    throw new DatabaseConnectionConfigError('DB_SSL must be either true or false.', 'INVALID_SSL_OPTIONS');
  }

  const sslMode = singleParameter(url.searchParams, 'sslmode')?.toLowerCase();
  const sslFlag = singleParameter(url.searchParams, 'ssl')?.toLowerCase();
  const sslAccept = singleParameter(url.searchParams, 'sslaccept')?.toLowerCase();
  const allowedSslModes = new Set(['disable', 'allow', 'prefer', 'require', 'verify-ca', 'verify-full']);
  if (sslMode && !allowedSslModes.has(sslMode) && sslMode !== 'no-verify') {
    throw new DatabaseConnectionConfigError('Database URL contains an unsupported sslmode.', 'INVALID_SSL_OPTIONS');
  }
  if (sslMode === 'no-verify' || sslFlag === 'no-verify') {
    throw new DatabaseConnectionConfigError('Unverified database TLS is not supported.', 'INSECURE_SSL_OPTIONS');
  }
  if (sslAccept && !['strict', 'accept_invalid_certs'].includes(sslAccept)) {
    throw new DatabaseConnectionConfigError('Database URL contains an unsupported sslaccept setting.', 'INVALID_SSL_OPTIONS');
  }
  if (sslAccept === 'accept_invalid_certs') {
    throw new DatabaseConnectionConfigError('Unverified database TLS is not supported.', 'INSECURE_SSL_OPTIONS');
  }
  if (sslFlag && !['true', '1', 'false', '0'].includes(sslFlag)) {
    throw new DatabaseConnectionConfigError('Database URL contains an unsupported ssl setting.', 'INVALID_SSL_OPTIONS');
  }

  const urlRequestsTls = (sslMode && sslMode !== 'disable') || sslFlag === 'true' || sslFlag === '1';
  const urlDisablesTls = sslMode === 'disable' || sslFlag === 'false' || sslFlag === '0';
  if (urlRequestsTls && urlDisablesTls) {
    throw new DatabaseConnectionConfigError('Database URL contains conflicting TLS settings.', 'INVALID_SSL_OPTIONS');
  }
  if (rawDbSsl === 'true' && urlDisablesTls) {
    throw new DatabaseConnectionConfigError('DB_SSL=true conflicts with a database URL that disables TLS.', 'INVALID_SSL_OPTIONS');
  }
  if (rawDbSsl === 'false' && urlRequestsTls) {
    throw new DatabaseConnectionConfigError('DB_SSL=false conflicts with a database URL that enables TLS.', 'INVALID_SSL_OPTIONS');
  }
  if (!loopback && !localDevelopment && (rawDbSsl === 'false' || urlDisablesTls)) {
    throw new DatabaseConnectionConfigError('TLS can be disabled only for a loopback database target.', 'INSECURE_SSL_OPTIONS');
  }

  const urlCaPath = singleParameter(url.searchParams, 'sslrootcert');
  const envCaPath = typeof env.DB_SSL_CA_FILE === 'string' ? env.DB_SSL_CA_FILE.trim() : '';
  const resolvedUrlCa = resolveFilePath(urlCaPath, cwd, 'Database URL sslrootcert');
  const resolvedEnvCa = resolveFilePath(envCaPath, cwd, 'DB_SSL_CA_FILE');
  if (resolvedUrlCa && resolvedEnvCa && resolvedUrlCa !== resolvedEnvCa) {
    throw new DatabaseConnectionConfigError('DB_SSL_CA_FILE conflicts with database URL sslrootcert.', 'INVALID_SSL_OPTIONS');
  }
  const caFile = resolvedEnvCa || resolvedUrlCa;
  const useTls = rawDbSsl === 'true' || (rawDbSsl !== 'false' && !urlDisablesTls && (Boolean(urlRequestsTls) || !loopback));
  if (!useTls && caFile) {
    throw new DatabaseConnectionConfigError('A CA file cannot be configured while database TLS is disabled.', 'INVALID_SSL_OPTIONS');
  }

  // Client-identity TLS is not configured by this application; fail clearly rather than
  // allowing pg's URL parser to replace the centrally verified SSL options.
  if (['sslcert', 'sslkey', 'sslpassword', 'sslidentity'].some((key) => url.searchParams.has(key))) {
    throw new DatabaseConnectionConfigError('Client-certificate URL settings are not supported by the shared database policy.', 'UNSUPPORTED_SSL_OPTIONS');
  }

  const ssl = useTls
    ? {
        rejectUnauthorized: true,
        ...(caFile ? { ca: readCertificate(caFile, 'Database CA file') } : {}),
      }
    : false;

  const connectionUrl = new URL(url.href);
  for (const key of [...connectionUrl.searchParams.keys()]) {
    if (PG_SSL_QUERY_PARAMETERS.includes(key.toLowerCase()) || key.toLowerCase() === 'sslaccept') {
      connectionUrl.searchParams.delete(key);
    }
  }

  const prismaUrl = new URL(connectionUrl.href);
  prismaUrl.searchParams.set('sslmode', useTls ? 'verify-full' : 'disable');
  if (caFile) prismaUrl.searchParams.set('sslrootcert', caFile);

  const target = `${hostname}:${port}`;
  const isPooler = hostname.includes('pooler.supabase.com') || port === '6543';

  return {
    source,
    purpose,
    hostname,
    port,
    target,
    isLoopback: loopback,
    isPooler,
    connectionString: connectionUrl.href,
    prismaConnectionString: prismaUrl.href,
    ssl,
  };
}

function normalizeDatabaseConnection(rawUrl, options = {}) {
  if (typeof rawUrl !== 'string' || !rawUrl.trim()) {
    throw new DatabaseConnectionConfigError('A PostgreSQL URL is required.', 'DATABASE_URL_MISSING');
  }
  const env = options.env || process.env;
  return makeConnection(rawUrl.trim(), {
    source: options.source || 'database URL',
    purpose: options.purpose || 'runtime',
    env,
    cwd: options.cwd || process.cwd(),
  });
}

function selectDatabaseConnection(options = {}) {
  const purpose = options.purpose || 'runtime';
  const env = options.env || process.env;
  const cwd = options.cwd || process.cwd();
  const priority = URL_PRIORITY[purpose];
  if (!priority) throw new DatabaseConnectionConfigError('Database connection purpose must be runtime or migration.', 'INVALID_PURPOSE');

  for (const source of priority) {
    const value = typeof env[source] === 'string' ? env[source].trim() : '';
    if (value) return makeConnection(value, { source, purpose, env, cwd });
  }

  if (env.PRISM_LOCAL_DEV === '1') assertLocalDatabaseUrl('', env);
  if (options.required === false) return null;
  throw new DatabaseConnectionConfigError(
    'Set DATABASE_URL for runtime and Prisma; DIRECT_URL is an optional migration override.',
    'DATABASE_URL_MISSING',
  );
}

module.exports = {
  assertLocalDatabaseUrl,
  DatabaseConnectionConfigError,
  normalizeDatabaseConnection,
  selectDatabaseConnection,
};
