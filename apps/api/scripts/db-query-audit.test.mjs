import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

import { auditSourceFile } from './db-query-audit.mjs';

const rootPath = fileURLToPath(new URL('../../../', import.meta.url));

describe('database query audit', () => {
  it('ignores SQL examples in comments, strings, and non-Prisma objects', () => {
    const failures = auditSourceFile(`
      // prisma.opsEvent.findMany();
      const example = "prisma.opsEvent.findMany({ skip: 10 })";
      const local = { opsEvent: { findMany() {} } };
      local.opsEvent.findMany();
      const state = new Map();
      for (const key of keys) state.delete(key);
    `, 'examples.ts');

    assert.deepEqual(failures, []);
  });

  it('requires a non-empty where or limit for findMany and does not treat select or cursor as a bound', () => {
    const failures = auditSourceFile(`
      await this.prisma.opsEvent.findMany({
        select: { id: true },
      });
      await tx.opsEvent.findMany({ where: {} });
      await tx.opsEvent.findMany({ where: eventId ? { id: eventId } : {} });
      await tx.opsEvent.findMany({ cursor: { id: eventId } });
      const emptyWhere = {};
      await tx.opsEvent.findMany({ where: emptyWhere });
      await tx.opsEvent.findMany({ where: maybeEmpty });
      await tx.opsEvent.findMany({ where: { id: undefined } });
      const absent = undefined;
      await tx.opsEvent.findMany({ where: { id: absent } });
      await tx.opsEvent.findMany({ where: { absent } });
      await tx.opsEvent.findMany({ take: undefined });
      await tx.opsEvent.findMany({ take: eventId ? 25 : undefined });
      const noLimit = undefined;
      await tx.opsEvent.findMany({ take: noLimit });
      const take = undefined;
      await tx.opsEvent.findMany({ take });
      const optionalId: string | undefined = getId();
      await tx.opsEvent.findMany({ where: { id: optionalId } });
      const optionalTake: number | undefined = getLimit();
      await tx.opsEvent.findMany({ take: optionalTake });
      type OptionalId = string | undefined;
      const aliasedOptionalId: OptionalId = getId();
      await tx.opsEvent.findMany({ where: { id: aliasedOptionalId } });
      await tx.opsEvent.findMany({ take: 25 });
      await tx.opsEvent.findMany({ where: { id: eventId } });
      await this.db.opsEvent.findMany({});
      function list(id?: string) { return tx.opsEvent.findMany({ where: { id } }); }
      function page(take?: number) { return tx.opsEvent.findMany({ take }); }
      function getOptionalLimit(): number | undefined { return undefined; }
      await tx.opsEvent.findMany({ take: getOptionalLimit() });
      function getOptionalId(): string | undefined { return undefined; }
      await tx.opsEvent.findMany({ where: { id: getOptionalId() } });
      await tx.opsEvent.findMany({ where: { id: filters?.id } });
      await tx.opsEvent.findMany({ where: { id: filters?.['id'] } });
      await tx.opsEvent.findMany({ take: options?.limit });
      await tx.opsEvent.findMany({ take: getOptionalLimit?.() });
    `, 'queries.ts');

    assert.equal(failures.length, 25);
    assert.match(failures[0], /queries\.ts:2 findMany lacks a non-empty where, take/);
    assert.match(failures[1], /queries\.ts:5 findMany lacks a non-empty where, take/);
    assert.match(failures[2], /queries\.ts:6 findMany lacks a non-empty where, take/);
    assert.match(failures[6], /queries\.ts:11 findMany lacks a non-empty where, take/);
    assert.match(failures[7], /queries\.ts:13 findMany lacks a non-empty where, take/);
    assert.match(failures[8], /queries\.ts:14 findMany lacks a non-empty where, take/);
    assert.match(failures[9], /queries\.ts:15 findMany lacks a non-empty where, take/);
    assert.match(failures[10], /queries\.ts:16 findMany lacks a non-empty where, take/);
    assert.match(failures[11], /queries\.ts:18 findMany lacks a non-empty where, take/);
    assert.match(failures[12], /queries\.ts:20 findMany lacks a non-empty where, take/);
    assert.match(failures[13], /queries\.ts:22 findMany lacks a non-empty where, take/);
    assert.match(failures[14], /queries\.ts:24 findMany lacks a non-empty where, take/);
    assert.match(failures[15], /queries\.ts:27 findMany lacks a non-empty where, take/);
    assert.match(failures[16], /queries\.ts:30 findMany lacks a non-empty where, take/);
    assert.match(failures[17], /queries\.ts:31 findMany lacks a non-empty where, take/);
    assert.match(failures[18], /queries\.ts:32 findMany lacks a non-empty where, take/);
    assert.match(failures[19], /queries\.ts:34 findMany lacks a non-empty where, take/);
    assert.match(failures[20], /queries\.ts:36 findMany lacks a non-empty where, take/);
    assert.match(failures[21], /queries\.ts:37 findMany lacks a non-empty where, take/);
    assert.match(failures[22], /queries\.ts:38 findMany lacks a non-empty where, take/);
    assert.match(failures[23], /queries\.ts:39 findMany lacks a non-empty where, take/);
    assert.match(failures[24], /queries\.ts:40 findMany lacks a non-empty where, take/);
  });

  it('rejects empty logical filters that leave Prisma findMany unscoped', () => {
    const failures = auditSourceFile(`
      await tx.opsEvent.findMany({ where: { AND: [] } });
      await tx.opsEvent.findMany({ where: { NOT: [] } });
      const clauses = [];
      await tx.opsEvent.findMany({ where: { AND: clauses } });
      await tx.opsEvent.findMany({ where: { OR: [{ id: eventId }, {}] } });
      await tx.opsEvent.findMany({ where: { OR: [] } });
      await tx.opsEvent.findMany({ where: { AND: [{ id: eventId }, {}] } });
      await tx.opsEvent.findMany({ where: { NOT: [{ OR: [] }] } });
      await tx.opsEvent.findMany({ where: { NOT: [{ AND: [] }] } });
      await tx.opsEvent.findMany({ where: { OR: [{ NOT: [] }, { id: eventId }] } });
      await tx.opsEvent.findMany({ where: { AND: [{ OR: [] }, { id: eventId }] } });
      await tx.opsEvent.findMany({ where: { id: { notIn: [] } } });
      await tx.opsEvent.findMany({ where: { id: { not: { in: [] } } } });
      await tx.opsEvent.findMany({ where: { id: { in: [] } } });
      await tx.opsEvent.findMany({ where: { id: { notIn: ['excluded'] } } });
    `, 'logical.ts');

    assert.equal(failures.length, 8);
    assert.match(failures[0], /logical\.ts:2 findMany lacks a non-empty where, take/);
    assert.match(failures[1], /logical\.ts:3 findMany lacks a non-empty where, take/);
    assert.match(failures[2], /logical\.ts:5 findMany lacks a non-empty where, take/);
    assert.match(failures[3], /logical\.ts:6 findMany lacks a non-empty where, take/);
    assert.match(failures[4], /logical\.ts:9 findMany lacks a non-empty where, take/);
    assert.match(failures[5], /logical\.ts:11 findMany lacks a non-empty where, take/);
    assert.match(failures[6], /logical\.ts:13 findMany lacks a non-empty where, take/);
    assert.match(failures[7], /logical\.ts:14 findMany lacks a non-empty where, take/);
  });
  it('flags Prisma offset pagination and ignores unrelated skip properties', () => {
    const failures = auditSourceFile(`
      const options = { skip: 10 };
      await this.prisma.opsEvent.findMany({ where: { archived: false }, skip: 10 });
    `, 'offset.ts');

    assert.equal(failures.length, 1);
    assert.match(failures[0], /offset\.ts:3 offset pagination/);
  });

  it('requires reasons for raw SQL calls, unsafe calls, and tagged templates', () => {
    const failures = auditSourceFile(`
      await this.prisma.$queryRaw\`SELECT 1\`;
      await tx.$executeRawUnsafe('DELETE FROM demo');
      await tx.$executeRawUnsafe('QUERY_AUDIT_RAW_SQL');
      // QUERY_AUDIT_RAW_SQL: atomic reservation statement
      await tx.$executeRaw\`UPDATE budget SET remaining = remaining - 1\`;
    `, 'raw.ts');

    assert.equal(failures.length, 3);
    assert.deepEqual(auditSourceFile('await tx.$queryRaw`SELECT 1`; // QUERY_AUDIT_RAW_SQL: bounded', 'inline.ts'), []);
    assert.match(failures[0], /raw\.ts:2 raw SQL/);
    assert.match(failures[1], /raw\.ts:3 raw SQL/);
    assert.match(failures[2], /raw\.ts:4 raw SQL/);
  });

  it('associates query audit reasons with one query in a multi-query statement', () => {
    const failures = auditSourceFile(`
      await Promise.all([
        // QUERY_AUDIT_ALLOW_UNBOUNDED: reviewed global read
        tx.opsEvent.findMany({}),
        tx.opsEvent.findMany({}),
      ]);
      await Promise.all([
        // QUERY_AUDIT_RAW_SQL: reviewed advisory lock
        tx.$queryRaw\`SELECT 1\`,
        tx.$queryRaw\`SELECT 2\`,
      ]);
      await Promise.all([
        // QUERY_AUDIT_ALLOW_OFFSET: bounded compatibility page
        tx.opsEvent.findMany({ where: { id: firstId }, skip: 1 }),
        tx.opsEvent.findMany({ where: { id: secondId }, skip: 2 }),
      ]);
    `, 'marker-siblings.ts');

    assert.equal(failures.length, 3);
    assert.match(failures[0], /findMany lacks a non-empty where/);
    assert.match(failures[1], /raw SQL requires/);
    assert.match(failures[2], /offset pagination requires/);
  });

  it('requires a reason when a loop performs Prisma writes', () => {
    const failures = auditSourceFile(`
      for (const event of events) {
        await tx.opsEvent.update({ where: { id: event.id }, data: { archived: true } });
      }
      // QUERY_AUDIT_ALLOW_BOUNDED_LOOP: fixed list of at most two fixture suppliers
      for (const supplier of fixtureSuppliers) {
        await tx.opsSupplierQuoteRequest.create({ data: supplier });
      }
    `, 'loops.ts');

    assert.equal(failures.length, 1);
    assert.match(failures[0], /loops\.ts:2 Prisma call inside loop/);
    assert.deepEqual(auditSourceFile('for (const item of items) { // QUERY_AUDIT_ALLOW_BOUNDED_LOOP: finite fixture set\n  await tx.opsThing.create({ data: item });\n}', 'inline-loop.ts'), []);

    const nestedFailures = auditSourceFile(`
      for (const event of events) {
        // QUERY_AUDIT_ALLOW_BOUNDED_LOOP: only the inner loop is fixed-size.
        for (const item of [1, 2]) {
          await tx.opsThing.create({ data: { event, item } });
        }
      }
    `, 'nested-loops.ts');
    assert.equal(nestedFailures.length, 1);
    assert.match(nestedFailures[0], /nested-loops\.ts:2 Prisma call inside loop/);

    const outerMarkerFailures = auditSourceFile(`
      // QUERY_AUDIT_ALLOW_BOUNDED_LOOP: outer work is explicitly reviewed.
      for (const event of events) {
        for (const item of event.items) {
          await tx.opsThing.create({ data: { event, item } });
        }
      }
    `, 'outer-loop-marker.ts');
    assert.equal(outerMarkerFailures.length, 1);
    assert.match(outerMarkerFailures[0], /outer-loop-marker\.ts:4 Prisma call inside loop/);
    const callbackFailures = auditSourceFile(`
      await Promise.all(events.map(async (event) => {
        await tx.opsEvent.update({ where: { id: event.id }, data: { archived: true } });
      }));
      events.forEach(async (event) => {
        await tx.opsEvent.create({ data: event });
      });
    `, 'callback-loops.ts');
    assert.equal(callbackFailures.length, 2);
    assert.match(callbackFailures[0], /callback-loops\.ts:2 Prisma call inside loop/);
    assert.match(callbackFailures[1], /callback-loops\.ts:5 Prisma call inside loop/);

    const callbackReferenceFailures = auditSourceFile(`
      function updateOne(event) {
        return persistOne(event);
      }
      function persistOne(event) {
        return tx.opsEvent.update({ where: { id: event.id }, data: { archived: true } });
      }
      const createOne = (event) => tx.opsEvent.create({ data: event });
      events.forEach(updateOne);
      events.map(createOne);
    `, 'callback-references.ts');
    assert.equal(callbackReferenceFailures.length, 2);
    assert.match(callbackReferenceFailures[0], /callback-references.ts:9 Prisma call inside loop/);
    assert.match(callbackReferenceFailures[1], /callback-references.ts:10 Prisma call inside loop/);

    const importedHandler = ts.createSourceFile(
      'apps/api/scripts/handlers.ts',
      'function persist(event) { return tx.opsEvent.create({ data: event }); }\n' +
        'export function persistOne(event) { return persist(event); }',
      ts.ScriptTarget.Latest,
      true,
    );
    const importedFailures = auditSourceFile(`
      import { persistOne as persistImported } from './handlers';
      events.forEach(persistImported);
    `, 'apps/api/scripts/callback-imports.ts', new Map([
      [resolve(rootPath, 'apps/api/scripts/handlers.ts'), importedHandler],
    ]));
    assert.equal(importedFailures.length, 1);
    assert.match(importedFailures[0], /callback-imports\.ts:3 Prisma call inside loop/);

    const forwardedCallbackFailures = auditSourceFile(`
      function visitWithCallback(value, callback) { return callback(value); }
      function persistCandidate(candidate) { return tx.opsEvent.create({ data: candidate }); }
      function deferCallback(callback) { pendingCallbacks.push(callback); }
      function ignoreCallback(callback) { return undefined; }
      events.map((event) => visitWithCallback(event, (candidate) => tx.opsEvent.create({ data: candidate })));
      events.map((event) => visitWithCallback(event, persistCandidate));
      events.forEach((event) => deferCallback((candidate) => tx.opsEvent.create({ data: candidate })));
      events.map((event) => ignoreCallback((candidate) => tx.opsEvent.create({ data: candidate })));
    `, 'forwarded-callbacks.ts');
    assert.equal(forwardedCallbackFailures.length, 2);
    assert.match(forwardedCallbackFailures[0], /forwarded-callbacks\.ts:6 Prisma call inside loop/);
    assert.match(forwardedCallbackFailures[1], /forwarded-callbacks\.ts:7 Prisma call inside loop/);

    assert.deepEqual(auditSourceFile(`
      values.filter(Boolean).map(mapImportedValue);
    `, 'non-database-callback-references.ts'), []);

  });
});
