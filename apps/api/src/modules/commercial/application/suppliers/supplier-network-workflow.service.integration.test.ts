import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '@prism/kernel/database';
import { PrismTransactionRunner } from '@prism/kernel/shared-kernel';
import { WorkflowCommandService, OpsUserRole } from '@prism/kernel/event-core';
import { EventAccessPolicyService, type AuditWriter } from '@prism/kernel/access-control';
import { AuditService, AuditWriterAdapter, PareDispatchOutboxService, SecurityOperationsService } from '@prism/contexts/platform-ops';
import { SupplierNetworkWorkflowService } from './supplier-network-workflow.service';
import { SupplierProfileCommandsService } from './supplier-profile-commands.service';
import type { PareApprovalGovernance } from '@prism/contexts/platform-ops';
import type { SupplierDocumentVault } from '../../contracts/supplier-document-vault.port';

const databaseUrl = process.env.P0_TEST_DATABASE_URL?.trim();

function validateDatabaseUrl(value: string) {
  const parsed = new URL(value);
  if (parsed.hostname !== '127.0.0.1' || parsed.port !== '55437' || parsed.pathname !== '/prism_p0') {
    throw new Error('P0_TEST_DATABASE_URL must target 127.0.0.1:55437/prism_p0');
  }
}

if (databaseUrl) validateDatabaseUrl(databaseUrl);

const databaseSuite = describe.skipIf(!databaseUrl);
let pareCalls = 0;

type Fixture = {
  inquiryId: string;
  eventId: string;
  requestId: string;
  supplierId: string;
  categoryId: string;
};

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((promiseResolve) => { resolve = promiseResolve; });
  return { promise, resolve };
}

const pmcmActor = {
  id: 'p0_w04_pmcm',
  role: OpsUserRole.PmcmAdmin,
  name: 'P0 W04 PMCM',
  email: 'p0-w04-pmcm@example.test',
  explicit: true,
};

async function createFixture(prisma: PrismaService): Promise<Fixture> {
  const prefix = `p0_w04_${randomUUID().replaceAll('-', '')}`;
  const fixture: Fixture = {
    inquiryId: `${prefix}_inquiry`,
    eventId: `${prefix}_event`,
    requestId: `${prefix}_request`,
    supplierId: `${prefix}_supplier`,
    categoryId: `${prefix}_category`,
  };
  const eventDate = new Date('2031-04-18T09:00:00.000Z');

  await prisma.opsSupplierCategory.create({
    data: { id: fixture.categoryId, slug: `${prefix}-category`, name: `${prefix} Category` },
  });
  await prisma.opsSupplier.create({
    data: {
      id: fixture.supplierId,
      categoryId: fixture.categoryId,
      name: `${prefix} Supplier`,
      email: `${prefix}@example.test`,
    },
  });
  await prisma.opsInquiry.create({
    data: {
      id: fixture.inquiryId,
      clientName: `${prefix} Client`,
      email: `${prefix}@client.test`,
      eventName: `${prefix} Inquiry`,
      eventDate,
      clientType: 'corporate',
      normalizedEmail: `${prefix}@client.test`,
    },
  });
  await prisma.opsEvent.create({
    data: {
      id: fixture.eventId,
      inquiryId: fixture.inquiryId,
      clientName: `${prefix} Client`,
      eventName: `${prefix} Event`,
      eventDate,
    },
  });
  await prisma.opsSupplierQuoteRequest.create({
    data: {
      id: fixture.requestId,
      eventId: fixture.eventId,
      supplierId: fixture.supplierId,
      categoryId: fixture.categoryId,
      supplierName: `${prefix} Supplier`,
      category: `${prefix} Category`,
      accessToken: `${prefix}-token`,
      status: 'selected',
      assignmentStatus: 'pending_confirmation',
    },
  });
  return fixture;
}

async function cleanupFixture(prisma: PrismaService, fixture: Fixture) {
  await prisma.opsAuditLog.deleteMany({ where: { eventId: fixture.eventId } });
  await prisma.opsSupplierQuoteRequest.deleteMany({ where: { id: fixture.requestId } });
  await prisma.opsEvent.deleteMany({ where: { id: fixture.eventId } });
  await prisma.opsInquiry.deleteMany({ where: { id: fixture.inquiryId } });
  await prisma.opsSupplier.deleteMany({ where: { id: fixture.supplierId } });
  await prisma.opsSupplierCategory.deleteMany({ where: { id: fixture.categoryId } });
}

function supplierActor(fixture: Fixture) {
  return {
    id: `${fixture.supplierId}_actor`,
    role: OpsUserRole.Supplier,
    supplierId: fixture.supplierId,
    name: `${fixture.supplierId} Supplier`,
    email: `${fixture.supplierId}@example.test`,
    explicit: true,
  };
}

function createService(
  prisma: PrismaService,
  auditWriter: AuditWriter,
  pareService: PareApprovalGovernance,
  fixture: Fixture,
  afterFirstRequestRead?: () => Promise<void>,
) {
  const access = new EventAccessPolicyService({ write: async () => undefined });
  const workflow = new WorkflowCommandService(new PrismTransactionRunner(prisma));
  const suppliers = {
    listSuppliers: async () => [{
      id: fixture.supplierId,
      name: `${fixture.supplierId} Supplier`,
      email: `${fixture.supplierId}@example.test`,
    }],
    createSupplier: async () => { throw new Error('not exercised'); },
    updateSupplier: async () => { throw new Error('not exercised'); },
    changeSupplierTier: async () => { throw new Error('not exercised'); },
    addSupplierReview: async () => { throw new Error('not exercised'); },
    addReliabilityNote: async () => { throw new Error('not exercised'); },
    promoteSupplier: async () => { throw new Error('not exercised'); },
    addSupplierCertification: async () => { throw new Error('not exercised'); },
  };
  let requestRead = false;
  const requestDelegate = new Proxy(prisma.opsSupplierQuoteRequest, {
    get(target, property, receiver) {
      if (property !== 'findUnique' || !afterFirstRequestRead) return Reflect.get(target, property, receiver);
      return async (...args: Parameters<typeof target.findUnique>) => {
        const result = await target.findUnique(...args);
        if (!requestRead) {
          requestRead = true;
          await afterFirstRequestRead();
        }
        return result;
      };
    },
  });
  const servicePrisma = new Proxy(prisma, {
    get(target, property, receiver) {
      if (property === 'opsSupplierQuoteRequest') return requestDelegate;
      return Reflect.get(target, property, receiver);
    },
  }) as unknown as PrismaService;
  const pareOutbox = new PareDispatchOutboxService(prisma, {} as any);
  return new SupplierNetworkWorkflowService(
    servicePrisma,
    suppliers,
    {} as unknown as SupplierProfileCommandsService,
    auditWriter,
    access,
    workflow,
    pareService,
    { queue: async (input, context) => { pareCalls += 1; return pareOutbox.queue(input, context); } },
    {} as unknown as SupplierDocumentVault,
  );
}

databaseSuite('SupplierNetworkWorkflowService PostgreSQL transition invariants', () => {
  let prisma: PrismaService;
  let auditWriter: AuditWriter;
  const pareService: PareApprovalGovernance = {
    getPendingApprovals: async () => [],
    approveRecommendation: async () => ({ id: 'p0_w04_pare_stub' }) as never,
    rejectRecommendation: async () => ({ id: 'p0_w04_pare_stub' }) as never,
  };

  beforeAll(async () => {
    if (!databaseUrl) return;
    for (const variable of ['SUPABASE_DB_URL', 'DATABASE_URL', 'PRISMA_DATABASE_URL', 'DIRECT_URL']) {
      process.env[variable] = databaseUrl;
    }
    process.env.DB_SSL = 'false';
    prisma = new PrismaService();
    await prisma.$connect();
    const auditService = new AuditService(prisma);
    auditWriter = new AuditWriterAdapter(auditService, new SecurityOperationsService(prisma, auditService));
  });

  afterAll(async () => {
    if (prisma) await prisma.$disconnect();
  });

  it('allows exactly one legal transition when confirmation races withdrawal', async () => {
    const fixture = await createFixture(prisma);
    pareCalls = 0;
    try {
      const service = createService(prisma, auditWriter, pareService, fixture);
      const outcomes = await Promise.allSettled([
        service.confirmSupplierAssignment(fixture.requestId, supplierActor(fixture)),
        service.withdrawSupplier(fixture.requestId, 'Supplier unavailable', pmcmActor),
      ]);
      expect(outcomes.filter((outcome) => outcome.status === 'fulfilled')).toHaveLength(1);
      expect(outcomes.filter((outcome) => outcome.status === 'rejected')).toHaveLength(1);

      const request = await prisma.opsSupplierQuoteRequest.findUnique({ where: { id: fixture.requestId } });
      expect(['confirmed', 'withdrawn']).toContain(request?.assignmentStatus);
      const transitionAudits = await prisma.opsAuditLog.findMany({
        where: { eventId: fixture.eventId, affectedId: fixture.requestId, actor: { not: 'PARE Engine' } },
      });
      expect(transitionAudits).toHaveLength(1);
      expect(pareCalls).toBe(request?.assignmentStatus === 'withdrawn' ? 1 : 0);
    } finally {
      await cleanupFixture(prisma, fixture);
    }
  });

  it('rolls back confirmation when its audit fails', async () => {
    const fixture = await createFixture(prisma);
    try {
      const failingAudit: AuditWriter = { write: async () => { throw new Error('audit unavailable'); } };
      const service = createService(prisma, failingAudit, pareService, fixture);
      await expect(service.confirmSupplierAssignment(fixture.requestId, supplierActor(fixture))).rejects.toThrow('audit unavailable');
      const request = await prisma.opsSupplierQuoteRequest.findUnique({ where: { id: fixture.requestId } });
      expect(request?.assignmentStatus).toBe('pending_confirmation');
      await expect(prisma.opsAuditLog.count({ where: { eventId: fixture.eventId, affectedId: fixture.requestId } })).resolves.toBe(0);
    } finally {
      await cleanupFixture(prisma, fixture);
    }
  });

  it('rolls back withdrawal when its audit fails and does not dispatch PARE', async () => {
    const fixture = await createFixture(prisma);
    const previousPareCalls = pareCalls;
    try {
      const failingAudit: AuditWriter = { write: async () => { throw new Error('audit unavailable'); } };
      const service = createService(prisma, failingAudit, pareService, fixture);
      await expect(service.withdrawSupplier(fixture.requestId, 'Supplier unavailable', pmcmActor)).rejects.toThrow('audit unavailable');
      const request = await prisma.opsSupplierQuoteRequest.findUnique({ where: { id: fixture.requestId } });
      expect(request?.assignmentStatus).toBe('pending_confirmation');
      expect(pareCalls).toBe(previousPareCalls);
      await expect(prisma.opsPareDispatch.count({ where: { requestId: fixture.requestId } })).resolves.toBe(0);
    } finally {
      await cleanupFixture(prisma, fixture);
    }
  });

  it('allows a confirmed selected supplier to be withdrawn for emergency replacement', async () => {
    const fixture = await createFixture(prisma);
    try {
      await prisma.opsSupplierQuoteRequest.update({
        where: { id: fixture.requestId },
        data: { assignmentStatus: 'confirmed' },
      });
      const service = createService(prisma, auditWriter, pareService, fixture);
      const withdrawn = await service.withdrawSupplier(fixture.requestId, 'Confirmed supplier cancelled', pmcmActor);
      expect(withdrawn.assignmentStatus).toBe('withdrawn');
      await expect(prisma.opsPareDispatch.count({ where: { requestId: fixture.requestId } })).resolves.toBe(1);
    } finally {
      await cleanupFixture(prisma, fixture);
    }
  });

  it('rejects a supplier ownership change after authorization but before the locked write', async () => {
    const fixture = await createFixture(prisma);
    const gate = deferred<void>();
    const observed = deferred<void>();
    try {
      const service = createService(prisma, auditWriter, pareService, fixture, async () => {
        observed.resolve();
        await gate.promise;
      });
      const confirmation = service.confirmSupplierAssignment(fixture.requestId, supplierActor(fixture));
      await observed.promise;
      await prisma.opsSupplierQuoteRequest.update({
        where: { id: fixture.requestId },
        data: { supplierId: null },
      });
      gate.resolve();
      await expect(confirmation).rejects.toThrow('Supplier assignment changed before confirmation');
      const request = await prisma.opsSupplierQuoteRequest.findUnique({ where: { id: fixture.requestId } });
      expect(request?.assignmentStatus).toBe('pending_confirmation');
    } finally {
      await cleanupFixture(prisma, fixture);
    }
  });

  it('rejects a repeated withdrawal without another transition audit or PARE dispatch', async () => {
    const fixture = await createFixture(prisma);
    pareCalls = 0;
    try {
      const service = createService(prisma, auditWriter, pareService, fixture);
      await service.withdrawSupplier(fixture.requestId, 'Supplier unavailable', pmcmActor);
      await new Promise((resolve) => setTimeout(resolve, 25));
      await expect(service.withdrawSupplier(fixture.requestId, 'Retry', pmcmActor)).rejects.toThrow(
        'Only a selected supplier assignment can be withdrawn',
      );
      const transitionAudits = await prisma.opsAuditLog.findMany({
        where: { eventId: fixture.eventId, affectedId: fixture.requestId, actor: { not: 'PARE Engine' } },
      });
      expect(transitionAudits).toHaveLength(1);
      expect(pareCalls).toBe(1);
    } finally {
      await cleanupFixture(prisma, fixture);
    }
  });
});
