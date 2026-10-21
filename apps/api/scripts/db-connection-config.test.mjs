import assert from 'node:assert/strict';
import { generateKeyPairSync, randomBytes, sign, X509Certificate } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createServer as createNetServer } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { createServer as createTlsServer, connect as connectTls } from 'node:tls';
import test from 'node:test';
import { Pool } from 'pg';
import { normalizeDatabaseConnection, selectDatabaseConnection } from './db-connection-config.mjs';

function selected(url, env = {}) {
  return selectDatabaseConnection({
    purpose: 'runtime',
    env: { DATABASE_URL: url, ...env },
  });
}

function der(tag, contents) {
  const length = contents.length;
  let encodedLength;
  if (length < 0x80) {
    encodedLength = Buffer.from([length]);
  } else {
    const bytes = [];
    let remaining = length;
    while (remaining > 0) {
      bytes.unshift(remaining & 0xff);
      remaining >>>= 8;
    }
    encodedLength = Buffer.from([0x80 | bytes.length, ...bytes]);
  }
  return Buffer.concat([Buffer.from([tag]), encodedLength, contents]);
}

function sequence(...items) {
  return der(0x30, Buffer.concat(items));
}

function oid(value) {
  const arcs = value.split('.').map(Number);
  const encoded = [40 * arcs[0] + arcs[1]];
  for (const arc of arcs.slice(2)) {
    let remaining = arc;
    const bytes = [remaining & 0x7f];
    remaining = Math.floor(remaining / 128);
    while (remaining > 0) {
      bytes.unshift((remaining & 0x7f) | 0x80);
      remaining = Math.floor(remaining / 128);
    }
    encoded.push(...bytes);
  }
  return der(0x06, Buffer.from(encoded));
}

function makeEphemeralTlsCertificate() {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const algorithm = sequence(oid('1.2.840.113549.1.1.11'), der(0x05, Buffer.alloc(0)));
  const name = sequence(
    der(0x31, sequence(oid('2.5.4.3'), der(0x0c, Buffer.from('localhost')))),
  );
  const formatUtc = (date) => {
    const pad = (value) => String(value).padStart(2, '0');
    return [
      String(date.getUTCFullYear()).slice(-2),
      pad(date.getUTCMonth() + 1),
      pad(date.getUTCDate()),
      pad(date.getUTCHours()),
      pad(date.getUTCMinutes()),
      pad(date.getUTCSeconds()),
      'Z',
    ].join('');
  };
  const validity = sequence(
    der(0x17, Buffer.from(formatUtc(new Date(Date.now() - 60_000)))),
    der(0x17, Buffer.from(formatUtc(new Date(Date.now() + 86_400_000)))),
  );
  const extension = (nameOid, value, critical = false) => sequence(
    oid(nameOid),
    ...(critical ? [der(0x01, Buffer.from([0xff]))] : []),
    der(0x04, value),
  );
  const extensions = der(0xa3, sequence(
    extension('2.5.29.19', sequence(der(0x01, Buffer.from([0xff]))), true),
    extension('2.5.29.15', der(0x03, Buffer.from([2, 0xa4])), true),
    extension('2.5.29.37', sequence(oid('1.3.6.1.5.5.7.3.1'))),
    extension('2.5.29.17', sequence(der(0x82, Buffer.from('localhost')))),
  ));
  const serial = randomBytes(16);
  serial[0] &= 0x7f;
  serial[0] |= 0x01;
  const tbsCertificate = sequence(
    der(0xa0, der(0x02, Buffer.from([0x02]))),
    der(0x02, serial),
    algorithm,
    name,
    validity,
    name,
    publicKey.export({ type: 'spki', format: 'der' }),
    extensions,
  );
  const signature = sign('sha256', tbsCertificate, privateKey);
  const certificate = sequence(tbsCertificate, algorithm, der(0x03, Buffer.concat([Buffer.from([0]), signature])));
  return {
    certificatePem: `-----BEGIN CERTIFICATE-----\n${certificate.toString('base64').match(/.{1,64}/g).join('\n')}\n-----END CERTIFICATE-----\n`,
    privateKeyPem: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
  };
}

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject);
      resolve(server.address().port);
    });
  });
}

function close(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

test('canonical URL wins over legacy aliases while migrations allow a direct override', () => {
  const env = {
    SUPABASE_DB_URL: 'postgresql://pool:secret@pooler.example.test:6543/prism',
    DATABASE_URL: 'postgresql://runtime:secret@runtime.example.test:5432/prism',
    DIRECT_URL: 'postgresql://direct:secret@db.example.test:5432/prism',
  };

  const runtime = selectDatabaseConnection({ purpose: 'runtime', env });
  const migration = selectDatabaseConnection({ purpose: 'migration', env });

  assert.equal(runtime.source, 'DATABASE_URL');
  assert.equal(runtime.isPooler, false);
  assert.equal(migration.source, 'DIRECT_URL');
  assert.equal(migration.hostname, 'db.example.test');
});

test('hosted connections verify TLS and never expose credentials in diagnostics', () => {
  const connection = selected('postgresql://secret-user:secret-password@db.example.test:5432/prism?sslmode=require');

  assert.deepEqual(connection.ssl, { rejectUnauthorized: true });
  assert.equal(connection.connectionString, 'postgresql://secret-user:secret-password@db.example.test:5432/prism');
  assert.equal(connection.prismaConnectionString, 'postgresql://secret-user:secret-password@db.example.test:5432/prism?sslmode=verify-full');
  assert.equal(connection.target, 'db.example.test:5432');
  assert.doesNotMatch(connection.target, /secret|prism/);
});

test('pooler classification matches complete DNS labels and the effective connection target', () => {
  for (const hostname of ['pooler.supabase.com', 'aws-0.pooler.supabase.com', 'AWS-0.POOLER.SUPABASE.COM']) {
    assert.equal(selected(`postgresql://user:pass@${hostname}:5432/prism`).isPooler, true);
  }
  for (const hostname of ['notpooler.supabase.com', 'pooler.supabase.com.example.test', 'pooler.supabase.comevil.test']) {
    assert.equal(selected(`postgresql://user:pass@${hostname}:5432/prism`).isPooler, false);
  }
  assert.equal(selected('postgresql://user:pass@db.example.test:6543/prism').isPooler, true);
  assert.equal(selected('postgresql://user:pass@db.example.test/prism?host=aws-0.pooler.supabase.com').isPooler, true);
});

test('a configured CA is loaded for pg and represented in the Prisma CLI URL', () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'prism-db-ca-'));
  const caPath = path.join(directory, 'ca.pem');
  const ca = '-----BEGIN CERTIFICATE-----\nunit-test-ca\n-----END CERTIFICATE-----\n';
  writeFileSync(caPath, ca, 'utf8');
  try {
    const connection = selected('postgresql://user:pass@db.example.test/prism', { DB_SSL_CA_FILE: caPath });
    assert.deepEqual(connection.ssl, { rejectUnauthorized: true, ca });
    assert.equal(new URL(connection.prismaConnectionString).searchParams.get('sslrootcert'), caPath);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('loopback databases permit an explicit non-TLS connection', () => {
  const connection = selected('postgresql://user:pass@127.0.0.1:55437/prism_p0', { DB_SSL: 'false' });

  assert.equal(connection.ssl, false);
  assert.equal(new URL(connection.prismaConnectionString).searchParams.get('sslmode'), 'disable');
});

test('strict TLS accepts a trusted CA and rejects an untrusted certificate on a controlled endpoint', async () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'prism-db-tls-endpoint-'));
  const { certificatePem, privateKeyPem } = makeEphemeralTlsCertificate();
  const caPath = path.join(directory, 'server-ca.pem');
  writeFileSync(caPath, certificatePem, 'utf8');
  assert.equal(new X509Certificate(certificatePem).subjectAltName, 'DNS:localhost');

  const server = createTlsServer({ cert: certificatePem, key: privateKeyPem }, (socket) => socket.end());
  server.on('tlsClientError', () => {});
  const port = await listen(server);
  const databaseUrl = `postgresql://user:pass@localhost:${port}/prism`;
  const untrusted = selected(databaseUrl, { DB_SSL: 'true' });
  const trusted = selected(databaseUrl, { DB_SSL: 'true', DB_SSL_CA_FILE: caPath });

  const connect = (ssl) => new Promise((resolve, reject) => {
    const socket = connectTls({ host: '127.0.0.1', port, servername: 'localhost', ...ssl });
    socket.once('secureConnect', () => {
      const authorized = socket.authorized;
      socket.end();
      resolve(authorized);
    });
    socket.once('error', reject);
  });

  try {
    await assert.rejects(connect(untrusted.ssl), (error) =>
      ['DEPTH_ZERO_SELF_SIGNED_CERT', 'SELF_SIGNED_CERT_IN_CHAIN'].includes(error.code),
    );
    assert.equal(await connect(trusted.ssl), true);
  } finally {
    await close(server);
    rmSync(directory, { recursive: true, force: true });
  }
});

test('loopback plaintext policy reaches a controlled Postgres endpoint without an SSL request', async () => {
  let startupCode;
  const server = createNetServer((socket) => {
    socket.once('data', (data) => {
      if (data.length >= 8) startupCode = data.readInt32BE(4);
      socket.destroy();
    });
  });
  const port = await listen(server);
  const connection = selected(`postgresql://user:pass@127.0.0.1:${port}/prism`, { DB_SSL: 'false' });
  const pool = new Pool({
    connectionString: connection.connectionString,
    ssl: connection.ssl,
    connectionTimeoutMillis: 1_000,
    max: 1,
  });

  try {
    await assert.rejects(pool.connect());
    assert.equal(startupCode, 196608);
  } finally {
    await pool.end();
    await close(server);
  }
});

test('remote SSL disable and conflicting URL/environment settings fail closed', () => {
  assert.throws(
    () => selected('postgresql://user:pass@db.example.test/prism', { DB_SSL: 'false' }),
    /TLS can be disabled only for a loopback database target/,
  );
  assert.throws(
    () => selected('postgresql://user:pass@db.example.test/prism?sslmode=disable'),
    /TLS can be disabled only for a loopback database target/,
  );
  assert.throws(
    () => selected('postgresql://user:pass@db.example.test/prism?sslmode=disable', { DB_SSL: 'true' }),
    /DB_SSL=true conflicts/,
  );
  assert.throws(
    () => selected('postgresql://user:pass@db.example.test/prism?sslmode=no-verify'),
    /Unverified database TLS is not supported/,
  );
  assert.throws(
    () => selected('postgresql://user:pass@db.example.test/prism?sslaccept=accept_invalid_certs'),
    /Unverified database TLS is not supported/,
  );
  assert.throws(
    () => selected('postgresql://user:pass@127.0.0.1:55437/prism_p0?host=db.example.test', { DB_SSL: 'false' }),
    /TLS can be disabled only for a loopback database target/,
  );
});

test('URL SSL options cannot replace the returned pg SSL policy', () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'prism-db-url-ca-'));
  const caPath = path.join(directory, 'root.pem');
  writeFileSync(caPath, '-----BEGIN CERTIFICATE-----\nurl-ca\n-----END CERTIFICATE-----\n', 'utf8');
  try {
    const connection = normalizeDatabaseConnection(
      `postgresql://user:pass@db.example.test/prism?sslmode=require&sslrootcert=${encodeURIComponent(caPath)}`,
      { env: {}, cwd: process.cwd() },
    );

    assert.equal(new URL(connection.connectionString).searchParams.has('sslmode'), false);
    assert.equal(new URL(connection.connectionString).searchParams.has('sslrootcert'), false);
    assert.equal(connection.ssl.rejectUnauthorized, true);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('malformed database URLs report source without echoing secrets', () => {
  assert.throws(
    () => selectDatabaseConnection({ purpose: 'runtime', env: { DATABASE_URL: 'postgresql://alice:secret@[' } }),
    (error) => {
      assert.match(error.message, /DATABASE_URL value is not a valid PostgreSQL URL/);
      assert.doesNotMatch(error.message, /alice|secret/);
      return true;
    },
  );
});

test('missing optional URL is accepted by offline Prisma config only', () => {
  assert.equal(selectDatabaseConnection({ purpose: 'migration', env: {}, required: false }), null);
  assert.throws(() => selectDatabaseConnection({ purpose: 'migration', env: {} }), /Set DATABASE_URL/);
});
