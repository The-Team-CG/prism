import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  applyWriteExceptions,
  validateDomainPersistence,
  validatePrivateWrites,
  validateWritePolicy,
} from './check-domain-persistence.mjs';

const ownership = [
  {
    model: 'OpsSupplierQuoteRequest',
    currentSchema: 'supplier_ops',
    table: 'quote_requests',
    domain: 'commercial',
    targetSchema: 'commercial',
  },
  {
    model: 'OpsSupplierQuote',
    currentSchema: 'supplier_ops',
    table: 'quotes',
    domain: 'commercial',
    targetSchema: 'commercial',
  },
  {
    model: 'OpsEvent',
    currentSchema: 'event_core',
    table: 'events',
    domain: 'event-lifecycle',
    targetSchema: 'event_lifecycle',
  },
];

const foreignKeys = [
  {
    schema: 'supplier_ops',
    table: 'quotes',
    name: 'quotes_request_id_fkey',
    definition: 'FOREIGN KEY (request_id) REFERENCES supplier_ops.quote_requests(id) ON DELETE RESTRICT',
    columns: ['request_id'],
    sourceDomain: 'commercial',
    targetDomain: 'commercial',
    sameDomain: true,
  },
  {
    schema: 'supplier_ops',
    table: 'quotes',
    name: 'quotes_event_id_fkey',
    definition: 'FOREIGN KEY (event_id) REFERENCES event_core.events(id) ON DELETE CASCADE',
    columns: ['event_id'],
    sourceDomain: 'commercial',
    targetDomain: 'event-lifecycle',
    sameDomain: false,
  },
];

const ownershipManifest = {
  summary: {
    totalTables: ownership.length,
    targetSchemas: 2,
    targetSameDomainFks: 1,
    targetCrossDomainFks: 1,
    domains: [
      { domain: 'commercial', schema: 'commercial' },
      { domain: 'event-lifecycle', schema: 'event_lifecycle' },
    ],
  },
  ownership,
  foreignKeys,
};

const schemaText = `
model OpsSupplierQuoteRequest {
  id String @id
  quotes OpsSupplierQuote[]
  @@map("quote_requests")
  @@schema("supplier_ops")
}

model OpsSupplierQuote {
  id String @id
  requestId String @map("request_id")
  eventId String @map("event_id")
  request OpsSupplierQuoteRequest @relation(fields: [requestId], references: [id])
  event OpsEvent @relation(fields: [eventId], references: [id])
  @@map("quotes")
  @@schema("supplier_ops")
}

model OpsEvent {
  id String @id
  @@map("events")
  @@schema("event_core")
}
`;

describe('domain persistence ownership', () => {
  it('accepts same-domain foreign keys and classifies transitional cross-domain keys', () => {
    const result = validateDomainPersistence({ ownershipManifest, schemaText });

    assert.deepEqual(result.errors, []);
    assert.deepEqual(result.summary, {
      models: 3,
      foreignKeys: 2,
      crossDomainForeignKeys: 1,
    });
  });

  it('rejects a Prisma relation omitted from the physical ownership register', () => {
    const result = validateDomainPersistence({
      ownershipManifest: { ...ownershipManifest, foreignKeys: [foreignKeys[1]] },
      schemaText,
    });

    assert.match(result.errors.join('\n'), /Prisma relation is not classified in the ownership manifest: supplier_ops\.quotes\(request_id\)/);
  });

  it('rejects Prisma models that have no owner and owner rows without a model', () => {
    const result = validateDomainPersistence({
      ownershipManifest,
      schemaText: `${schemaText}\nmodel UnownedRecord {\n  id String @id\n  @@map("mystery_records")\n  @@schema("mystery")\n}\n`,
    });

    assert.match(result.errors.join('\n'), /Prisma model UnownedRecord maps to unowned table mystery\.mystery_records/);
  });

  it('requires each owner to resolve to one unique target schema', () => {
    const invalidManifest = {
      ...ownershipManifest,
      summary: {
        ...ownershipManifest.summary,
        domains: [
          { domain: 'commercial', schema: 'commercial' },
          { domain: 'event-lifecycle', schema: 'commercial' },
        ],
      },
      ownership: ownership.map((entry) => entry.domain === 'event-lifecycle'
        ? { ...entry, targetSchema: 'commercial' }
        : entry),
    };
    const result = validateDomainPersistence({ ownershipManifest: invalidManifest, schemaText });

    assert.match(result.errors.join('\n'), /target schema commercial is assigned to multiple domains/);
  });

  it('requires each manifest table to have exactly one Prisma model', () => {
    const missingModelSchema = schemaText.replace(/model OpsSupplierQuoteRequest \{[\s\S]*?\n\}\n/, '');
    const result = validateDomainPersistence({ ownershipManifest, schemaText: missingModelSchema });

    assert.match(result.errors.join('\n'), /ownership manifest table supplier_ops\.quote_requests has no Prisma model/);
  });

  it('rejects the transitional external relation in final mode even when schemas match the target', () => {
    const targetSchemaText = schemaText
      .replaceAll('supplier_ops', 'commercial')
      .replaceAll('event_core', 'event_lifecycle');
    const result = validateDomainPersistence({ ownershipManifest, schemaText: targetSchemaText, final: true });

    assert.match(result.errors.join('\n'), /final domain schema still contains cross-domain Prisma relation OpsSupplierQuote\.event/);
    assert.match(result.errors.join('\n'), /Prisma relation is not classified in the ownership manifest: commercial\.quotes\(event_id\)/);
  });

  it('allows an owning context to mutate its own Prisma model', () => {
    const findings = validatePrivateWrites({
      ownershipManifest,
      schemaText,
      sourceFiles: {
        'apps/api/src/modules/commercial/application/quotes.service.ts':
          'await this.prisma.opsSupplierQuote.update({ data: { requestId } });',
      },
    });

    assert.deepEqual(findings, []);
  });

  it('rejects a direct Prisma mutation from a non-owning context', () => {
    const findings = validatePrivateWrites({
      ownershipManifest,
      schemaText,
      sourceFiles: {
        'apps/api/src/modules/platform-ops/application/trust/service.ts':
          'await this.prisma.opsSupplierQuote.update({ data: { requestId } });',
      },
    });

    assert.equal(findings.length, 1);
    assert.equal(findings[0].kind, 'Prisma write');
    assert.equal(findings[0].sourceDomain, 'platform-ops');
    assert.equal(findings[0].targetDomain, 'commercial');
  });

  it('rejects nested cross-domain relation writes but permits same-domain relations', () => {
    const findings = validatePrivateWrites({
      ownershipManifest,
      schemaText,
      sourceFiles: {
        'apps/api/src/modules/commercial/application/quotes.service.ts': [
          'await this.prisma.opsSupplierQuote.update({ data: { request: { connect: { id: requestId } } } });',
          'await this.prisma.opsSupplierQuote.update({ data: { event: { connect: { id: eventId } } } });',
        ].join('\n'),
      },
    });

    assert.equal(findings.length, 1);
    assert.equal(findings[0].kind, 'nested Prisma relation write');
    assert.equal(findings[0].model, 'OpsEvent');
    assert.equal(findings[0].sourceDomain, 'commercial');
    assert.equal(findings[0].targetDomain, 'event-lifecycle');
  });

  it('excludes fixture and test sources from production private-write scans', () => {
    const findings = validatePrivateWrites({
      ownershipManifest,
      schemaText,
      sourceFiles: {
        'apps/api/src/fixtures/sample-seed.ts':
          'await this.prisma.opsEvent.update({ data: { name } });',
        'apps/api/src/modules/commercial/application/quotes.service.test.ts':
          'await this.prisma.opsEvent.update({ data: { name } });',
      },
    });

    assert.deepEqual(findings, []);
  });

  it('classifies mutating raw SQL against the owning table and fails closed on dynamic SQL', () => {
    const findings = validatePrivateWrites({
      ownershipManifest,
      schemaText,
      sourceFiles: {
        'apps/api/src/modules/commercial/application/quotes.service.ts': [
          'await this.prisma.$executeRaw`INSERT INTO "event_core"."events" ("id") VALUES (${id}) ON CONFLICT ("id") DO UPDATE SET "id" = EXCLUDED."id"`;',
          'await this.prisma.$queryRaw`SELECT "id" FROM "event_core"."events" FOR UPDATE`;',
          'await this.prisma.$executeRawUnsafe(sql);',
        ].join('\n'),
      },
    });

    assert.equal(findings.length, 2);
    assert.ok(
      findings.some(({ targetDomain, model }) => targetDomain === 'event-lifecycle' && model === 'event_core.events'),
      JSON.stringify(findings),
    );
    assert.ok(findings.some(({ detail }) => detail?.includes('dynamic')));
  });

  it('requires a supported versioned transition policy and removes exceptions for final mode', () => {
    assert.deepEqual(validateWritePolicy({ policyVersion: 1, transitionalWrites: [] }), []);
    assert.match(
      validateWritePolicy({ policyVersion: 2, transitionalWrites: [] }).join('\n'),
      /supported policyVersion 1/,
    );
    assert.match(
      validateWritePolicy({ policyVersion: 1, transitionalWrites: [{}] }, { final: true }).join('\n'),
      /remove all transitional write exceptions/,
    );
  });

  it('uses exact counted exceptions and reports stale exception entries', () => {
    const finding = {
      file: 'apps/api/src/modules/platform-ops/application/trust/service.ts',
      kind: 'Prisma write',
      model: 'OpsSupplierQuote',
      operation: 'update',
      sourceDomain: 'platform-ops',
      targetDomain: 'commercial',
    };
    const exception = {
      ...finding,
      count: 1,
      reason: 'Temporary migration boundary.',
      replacesBy: 'Task 18',
      expiresBy: 'PR21',
    };

    assert.deepEqual(applyWriteExceptions([finding], [exception]), { errors: [], unapproved: [] });
    assert.match(applyWriteExceptions([], [exception]).errors.join('\n'), /expected 1 more matching write/);
    assert.match(
      applyWriteExceptions([finding], [{ ...exception, expiresBy: undefined }]).errors.join('\n'),
      /expiry milestone/,
    );
  });
});
