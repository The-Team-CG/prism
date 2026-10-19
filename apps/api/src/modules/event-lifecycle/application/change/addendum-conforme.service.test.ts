import { createHash } from 'node:crypto';
import { ConflictException, ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { OpsUserRole } from '@prism/kernel/event-core';
import { EventAccessPolicyService, type AuditWriter, type ResolvedEventOpsActor } from '@prism/kernel/access-control';
import type { PrismaService } from '@prism/kernel/database';
import type { CommercialAddendumImpactWriter } from '@prism/contexts/commercial';
import { issueAddendumConformeSchema, type SignAddendumConformeInput } from '@prism/types';
import { AddendumConformeService } from './addendum-conforme.service';

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
const documentV1 = 'Addendum 1: add stage lighting rig for PHP 5,000.';
const documentV2 = 'Addendum 1 (revised): add stage lighting rig and haze for PHP 5,000.';

const pmcm: ResolvedEventOpsActor = { id: 'usr_pmcm', role: OpsUserRole.PmcmAdmin, name: 'PMCM Admin', email: 'pmcm@pmcm.test', explicit: true, verified: true };
const otherPmcm: ResolvedEventOpsActor = { ...pmcm, id: 'usr_pmcm_2', name: 'Second PMCM' };
const primaryClient: ResolvedEventOpsActor = { id: 'usr_client', role: OpsUserRole.Client, name: 'Ana Reyes', clientName: 'Ana Reyes', email: 'ana@client.test', explicit: true, verified: true };

type Row = Record<string, any>;

function createFixture() {
  const event = { id: 'evt_1', clientName: 'Ana Reyes', clientPortalStatus: 'unlocked', inquiry: { email: 'Ana@Client.test' } };
  const addendum: Row = {
    id: 'addendum_1', eventId: 'evt_1', versionNumber: 1, title: 'Stage lighting', summary: 'Adds lighting rig', status: 'issued',
    financialDelta: 5_000, signatureMethod: 'scanned_document', executedConformeExecutionId: null, executedAt: null,
    comparison: { contract: [], quotes: [{ key: 'quote_1', before: { id: 'quote_1', amount: 20_000 }, after: { id: 'quote_1', amount: 25_000 } }] },
  };
  const executions: Row[] = [];
  const signatures: Row[] = [];
  const impacts: Row[] = [];
  const auditEntries: Row[] = [];
  let clock = 0;
  const withContext = (execution: Row) => ({ ...execution, addendum: { ...addendum }, signatures: signatures.filter((signature) => signature.executionId === execution.id) });

  const tx = {
    $queryRaw: vi.fn(async () => [{ id: addendum.id }]),
    opsEvent: { findUnique: vi.fn(async ({ where }: { where: { id: string } }) => (where.id === event.id ? event : null)) },
    opsAddendum: {
      findFirst: vi.fn(async ({ where }: { where: { id: string; eventId: string } }) => (where.id === addendum.id && where.eventId === addendum.eventId ? { ...addendum } : null)),
      updateMany: vi.fn(async ({ where, data }: { where: Row; data: Row }) => {
        if (where.id !== addendum.id || addendum.executedConformeExecutionId !== null) return { count: 0 };
        Object.assign(addendum, data);
        return { count: 1 };
      }),
    },
    opsAddendumConformeExecution: {
      findUnique: vi.fn(async ({ where }: { where: Row }) => {
        const found = where.id
          ? executions.find((execution) => execution.id === where.id)
          : executions.find((execution) => execution.addendumId === where.addendumId_documentVersion.addendumId && execution.documentVersion === where.addendumId_documentVersion.documentVersion);
        return found ? withContext(found) : null;
      }),
      findFirst: vi.fn(async ({ where }: { where: { addendumId: string } }) => {
        const found = executions.filter((execution) => execution.addendumId === where.addendumId).sort((a, b) => b.documentVersion - a.documentVersion)[0];
        return found ? withContext(found) : null;
      }),
      findMany: vi.fn(async ({ where }: { where: Row }) => executions
        .filter((execution) => !where.status?.in || where.status.in.includes(execution.status))
        .map(withContext)),
      create: vi.fn(async ({ data }: { data: Row }) => {
        const execution = { ...data, createdAt: new Date(Date.UTC(2026, 9, 19, 0, clock++)), completedAt: null };
        executions.push(execution);
        return withContext(execution);
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Row }) => {
        const execution = executions.find((candidate) => candidate.id === where.id)!;
        Object.assign(execution, data);
        return withContext(execution);
      }),
    },
    opsAddendumConformeSignature: {
      create: vi.fn(async ({ data }: { data: Row }) => {
        if (signatures.some((signature) => signature.executionId === data.executionId && signature.actorRole === data.actorRole)) throw new Error('unique violation');
        const signature = { ...data, signedAt: new Date(Date.UTC(2026, 9, 19, 1, clock++)) };
        signatures.push(signature);
        return signature;
      }),
    },
    opsAddendumImpact: { createMany: vi.fn(async ({ data }: { data: Row[] }) => { impacts.push(...data); return { count: data.length }; }) },
  };
  const prisma = { ...tx, $transaction: vi.fn(async (work: (client: typeof tx) => Promise<unknown>) => work(tx)) };
  const audit = { write: vi.fn(async (entry: Row) => { auditEntries.push(entry); }) };
  const access = new EventAccessPolicyService(audit as unknown as AuditWriter);
  const commercial = {
    assertApplicable: vi.fn(async () => undefined),
    apply: vi.fn(async () => [{ targetType: 'billing_source' as const, targetId: 'billing_source_1', beforeValue: { totalAmount: 100_000 }, afterValue: { totalAmount: 105_000 }, deltaAmount: 5_000 }]),
  } satisfies CommercialAddendumImpactWriter;
  const service = new AddendumConformeService(prisma as unknown as PrismaService, access, audit as unknown as AuditWriter, commercial);
  return { service, addendum, executions, signatures, impacts, auditEntries, commercial, prisma };
}

function signInput(execution: { id: string; documentVersion: number; documentSha256: string }): SignAddendumConformeInput {
  return { executionId: execution.id, documentVersion: execution.documentVersion, documentSha256: execution.documentSha256, consentAccepted: true };
}

const issue = (content = documentV1, documentVersion = 1) => issueAddendumConformeSchema.parse({ documentVersion, documentContent: content });

describe('AddendumConformeService signing flow', () => {
  it('executes the addendum only after client acknowledgement and PMCM countersignature, tracing billing to the executed version', async () => {
    const { service, addendum, impacts, auditEntries, commercial } = createFixture();

    const issued = await service.issueVersion('evt_1', 'addendum_1', issue(), pmcm);
    expect(issued).toMatchObject({ status: 'awaiting_client', documentVersion: 1, documentSha256: sha256(documentV1), issuedBy: 'PMCM Admin' });

    const acknowledged = await service.acknowledge('evt_1', 'addendum_1', signInput(issued), primaryClient, { ip: '203.0.113.5' });
    expect(acknowledged).toMatchObject({ status: 'awaiting_pmcm', clientAcknowledgedAt: expect.any(String), completedAt: null });
    // Billing is untouched until both parties have signed.
    expect(commercial.apply).not.toHaveBeenCalled();
    expect(addendum.status).toBe('issued');

    const executed = await service.countersign('evt_1', 'addendum_1', signInput(issued), pmcm, {});
    expect(executed.status).toBe('completed');
    expect(executed.signatures.map((signature) => signature.actorRole)).toEqual(['client', 'pmcm']);
    expect(addendum).toMatchObject({ status: 'executed', executedConformeExecutionId: issued.id, signatureMethod: 'in_app_conforme' });
    expect(commercial.apply).toHaveBeenCalledWith(expect.objectContaining({
      eventId: 'evt_1', versionNumber: 1, financialDelta: 5_000,
      quotePriceChanges: [{ quoteId: 'quote_1', amount: 25_000 }],
      executedConforme: { executionId: issued.id, documentVersion: 1, documentSha256: sha256(documentV1) },
    }), expect.objectContaining({ correlationId: issued.id }));
    expect(impacts).toEqual([expect.objectContaining({ targetId: 'billing_source_1', conformeExecutionId: issued.id, conformeDocumentSha256: sha256(documentV1) })]);
    expect(auditEntries.map((entry) => entry.action)).toEqual([
      'Issued addendum conforme for client acknowledgement',
      'Recorded client addendum conforme acknowledgement',
      'Countersigned addendum conforme and executed addendum',
    ]);
  });

  it('supersedes an unsigned version but never replaces a signed one', async () => {
    const { service, executions } = createFixture();
    const first = await service.issueVersion('evt_1', 'addendum_1', issue(), pmcm);

    const second = await service.issueVersion('evt_1', 'addendum_1', issue(documentV2, 2), pmcm);
    expect(executions.find((execution) => execution.id === first.id)?.status).toBe('superseded');
    // The superseded version can no longer be signed.
    await expect(service.acknowledge('evt_1', 'addendum_1', signInput(first), primaryClient, {})).rejects.toThrow('A newer addendum conforme version is available');

    await service.acknowledge('evt_1', 'addendum_1', signInput(second), primaryClient, {});
    await expect(service.issueVersion('evt_1', 'addendum_1', issue(`${documentV2} Extra clause.`, 3), pmcm)).rejects.toThrow('A signed addendum conforme version cannot be replaced');
    await expect(service.issueVersion('evt_1', 'addendum_1', issue(`${documentV2} Extra clause.`, 2), pmcm)).rejects.toThrow('already bound to different content');
    expect(executions.find((execution) => execution.id === second.id)?.status).toBe('awaiting_pmcm');
  });

  it('treats retries of issue, acknowledgement, and countersignature as idempotent', async () => {
    const { service, executions, signatures, commercial } = createFixture();
    const issued = await service.issueVersion('evt_1', 'addendum_1', issue(), pmcm);
    await expect(service.issueVersion('evt_1', 'addendum_1', issue(), pmcm)).resolves.toMatchObject({ id: issued.id });

    await service.acknowledge('evt_1', 'addendum_1', signInput(issued), primaryClient, {});
    await expect(service.acknowledge('evt_1', 'addendum_1', signInput(issued), primaryClient, {})).resolves.toMatchObject({ status: 'awaiting_pmcm' });
    await service.countersign('evt_1', 'addendum_1', signInput(issued), pmcm, {});
    await expect(service.countersign('evt_1', 'addendum_1', signInput(issued), pmcm, {})).resolves.toMatchObject({ status: 'completed' });

    expect(executions).toHaveLength(1);
    expect(signatures).toHaveLength(2);
    expect(commercial.apply).toHaveBeenCalledTimes(1);
    // A different PMCM account cannot take over the recorded countersignature.
    await expect(service.countersign('evt_1', 'addendum_1', signInput(issued), otherPmcm, {})).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('requires the client acknowledgement before PMCM can countersign', async () => {
    const { service, commercial } = createFixture();
    const issued = await service.issueVersion('evt_1', 'addendum_1', issue(), pmcm);

    await expect(service.countersign('evt_1', 'addendum_1', signInput(issued), pmcm, {})).rejects.toThrow('The primary client must acknowledge before PMCM countersigns');
    expect(commercial.apply).not.toHaveBeenCalled();
  });

  it('rejects signatures against a stale hash or tampered stored content', async () => {
    const { service, executions, signatures } = createFixture();
    const issued = await service.issueVersion('evt_1', 'addendum_1', issue(), pmcm);

    await expect(service.acknowledge('evt_1', 'addendum_1', { ...signInput(issued), documentSha256: sha256('something else') }, primaryClient, {}))
      .rejects.toThrow('The displayed addendum conforme version has changed');
    executions[0]!.documentContent = `${documentV1} (edited after issue)`;
    await expect(service.acknowledge('evt_1', 'addendum_1', signInput(issued), primaryClient, {})).rejects.toThrow('Addendum conforme content integrity check failed');
    expect(signatures).toHaveLength(0);
  });
});

describe('AddendumConformeService role boundaries', () => {
  const supplier: ResolvedEventOpsActor = { id: 'usr_supplier', role: OpsUserRole.Supplier, name: 'Sonicline', email: 'ops@sonicline.test', supplierId: 'sup_1', explicit: true, verified: true };
  const coordinator: ResolvedEventOpsActor = { id: 'usr_coord', role: OpsUserRole.Coordinator, name: 'Lead Coordinator', email: 'lead@pmcm.test', eventId: 'evt_1', explicit: true, verified: true };
  const guest: ResolvedEventOpsActor = { id: 'guest_1', role: OpsUserRole.Guest, name: 'Guest', explicit: true, verified: true };
  const nonPrimaryClient: ResolvedEventOpsActor = { ...primaryClient, id: 'usr_client_2', name: 'Ben Cruz', email: 'ben@client.test' };

  it('lets only the primary client acknowledge', async () => {
    const { service, signatures } = createFixture();
    const issued = await service.issueVersion('evt_1', 'addendum_1', issue(), pmcm);

    for (const actor of [nonPrimaryClient, supplier, coordinator, guest, pmcm, { ...primaryClient, verified: false }]) {
      await expect(service.acknowledge('evt_1', 'addendum_1', signInput(issued), actor, {})).rejects.toBeInstanceOf(ForbiddenException);
    }
    expect(signatures).toHaveLength(0);
  });

  it('keeps issue, countersign, and the PMCM register PMCM-only', async () => {
    const { service, executions, signatures } = createFixture();
    const issued = await service.issueVersion('evt_1', 'addendum_1', issue(), pmcm);
    await service.acknowledge('evt_1', 'addendum_1', signInput(issued), primaryClient, {});

    for (const actor of [primaryClient, supplier, coordinator, guest]) {
      await expect(service.issueVersion('evt_1', 'addendum_1', issue(documentV2, 2), actor)).rejects.toBeInstanceOf(ForbiddenException);
      await expect(service.countersign('evt_1', 'addendum_1', signInput(issued), actor, {})).rejects.toBeInstanceOf(ForbiddenException);
      await expect(service.listForPmcm('evt_1', actor)).rejects.toBeInstanceOf(ForbiddenException);
    }
    expect(executions).toHaveLength(1);
    expect(signatures.map((signature) => signature.actorRole)).toEqual(['client']);
  });

  it('serves the client projection without PMCM-only fields and only to the primary client', async () => {
    const { service } = createFixture();
    const first = await service.issueVersion('evt_1', 'addendum_1', issue(), pmcm);
    const current = await service.issueVersion('evt_1', 'addendum_1', issue(documentV2, 2), pmcm);

    const projection = await service.listForClient('evt_1', primaryClient);

    expect(projection.map((item) => item.id)).toEqual([current.id]);
    expect(projection[0]).toEqual({
      id: current.id, addendumId: 'addendum_1', eventId: 'evt_1', addendumVersionNumber: 1, addendumTitle: 'Stage lighting', addendumSummary: 'Adds lighting rig',
      documentVersion: 2, documentContent: documentV2, documentSha256: sha256(documentV2), status: 'awaiting_client', clientAcknowledgedAt: null, completedAt: null,
    });
    const serialized = JSON.stringify(projection);
    expect(serialized).not.toContain('PMCM Admin');
    expect(serialized).not.toContain('financialDelta');
    expect(serialized).not.toContain(first.id);
    for (const actor of [nonPrimaryClient, supplier, coordinator, guest]) {
      await expect(service.listForClient('evt_1', actor)).rejects.toBeInstanceOf(ForbiddenException);
    }
  });

  it('refuses a new version once the addendum is executed', async () => {
    const { service } = createFixture();
    const issued = await service.issueVersion('evt_1', 'addendum_1', issue(), pmcm);
    await service.acknowledge('evt_1', 'addendum_1', signInput(issued), primaryClient, {});
    await service.countersign('evt_1', 'addendum_1', signInput(issued), pmcm, {});

    await expect(service.issueVersion('evt_1', 'addendum_1', issue(documentV2, 2), pmcm)).rejects.toBeInstanceOf(ConflictException);
  });
});
