import { describe, expect, it } from 'vitest';
import { PAREService } from './pare.service';

function createParePrisma() {
  const event = {
    id: 'evt_sample',
    clientName: 'Ana Reyes',
    eventName: 'Ayala Summit',
    eventDate: new Date('2026-06-18T00:00:00.000Z'),
  };
  const category = {
    id: 'supcat_technicals',
    name: 'Technicals',
  };
  const withdrawnSupplier = {
    id: 'sup_sonicline',
    categoryId: category.id,
    name: 'SonicLine Technicals',
    tier: 'tier_1',
    serviceInclusions: 'Audio, lights, LED wall',
    performanceNotes: 'Strong for keynote programs.',
  };
  const replacementSupplier = {
    id: 'sup_avbackup',
    categoryId: category.id,
    name: 'AV Backup Crew',
    tier: 'tier_1',
    serviceInclusions: 'Backup lights and sound',
    performanceNotes: 'Available for overflow work.',
  };
  const quoteRequest = {
    id: 'qr_selected',
    eventId: event.id,
    supplierId: withdrawnSupplier.id,
    supplierName: withdrawnSupplier.name,
    categoryId: category.id,
    category: category.name,
    accessToken: 'token-selected',
    status: 'selected',
    assignmentStatus: 'confirmed',
    confidentialBid: true,
    message: 'Selected technicals supplier.',
    createdAt: new Date('2026-05-01T00:00:00.000Z'),
  };
  const state = {
    auditLogs: [] as any[],
    approvalRecords: [] as any[],
  };

  const prisma = {
    opsSupplierQuoteRequest: {
      findUnique: async ({ where }: { where: { id?: string } }) =>
        where.id === quoteRequest.id
          ? {
              ...quoteRequest,
              event,
              supplier: withdrawnSupplier,
              categoryRef: category,
            }
          : null,
    },
    opsSupplierQuote: {
      findMany: async () => [],
    },
    opsBriefing: {
      findMany: async () => [],
    },
    opsSupplierCategory: {
      findFirst: async ({ where }: { where: { name?: string } }) =>
        where.name === category.name ? category : null,
    },
    opsSupplier: {
      findMany: async () => [
        {
          ...replacementSupplier,
          reviews: [],
          reliabilityNotes: [],
          certifications: [],
          quoteRequests: [],
          quotes: [],
        },
      ],
    },
    opsAiAuditLog: {
      create: async ({ data }: { data: any }) => {
        const row = { ...data, createdAt: data.createdAt ?? new Date('2026-05-07T00:00:00.000Z') };
        state.auditLogs.push(row);
        return row;
      },
      findUnique: async ({ where }: { where: { id: string } }) =>
        state.auditLogs.find((record) => record.id === where.id) ?? null,
      update: async ({ where, data }: { where: { id: string }; data: any }) => {
        const index = state.auditLogs.findIndex((record) => record.id === where.id);
        if (index === -1) throw new Error('audit not found');
        state.auditLogs[index] = { ...state.auditLogs[index], ...data };
        return state.auditLogs[index];
      },
    },
    opsAiApprovalRecord: {
      create: async ({ data }: { data: any }) => {
        const row = { ...data, requestedAt: data.requestedAt ?? new Date('2026-05-07T00:00:00.000Z') };
        state.approvalRecords.push(row);
        return row;
      },
      findMany: async ({ where }: { where?: { featureName?: string; status?: string; eventId?: string } } = {}) =>
        state.approvalRecords.filter((record) => {
          if (where?.featureName && record.featureName !== where.featureName) return false;
          if (where?.status && record.status !== where.status) return false;
          if (where?.eventId && record.eventId !== where.eventId) return false;
          return true;
        }),
      findUnique: async ({ where }: { where: { id: string } }) =>
        state.approvalRecords.find((record) => record.id === where.id) ?? null,
      update: async ({ where, data }: { where: { id: string }; data: any }) => {
        const index = state.approvalRecords.findIndex((record) => record.id === where.id);
        if (index === -1) throw new Error('approval not found');
        state.approvalRecords[index] = { ...state.approvalRecords[index], ...data };
        return state.approvalRecords[index];
      },
    },
  };

  return { prisma, state, quoteRequest };
}

describe('PAREService', () => {
  it('returns a hydrated pending approval response even when replacement candidates have no quotes yet', async () => {
    const { prisma, quoteRequest } = createParePrisma();
    const service = new PAREService(prisma);

    await service.handleEmergencyTrigger(quoteRequest.id);
    const pending = await service.getPendingApprovals('evt_sample');

    expect(pending).toHaveLength(1);
    expect(pending[0]).toMatchObject({
      eventId: 'evt_sample',
      requestId: quoteRequest.id,
      status: 'pending',
      pareResult: {
        eventId: 'evt_sample',
        withdrawnSupplier: {
          id: 'sup_sonicline',
          name: 'SonicLine Technicals',
          category: 'Technicals',
          quotedAmount: 0,
        },
        budgetAnalysis: {
          feasible: true,
          selectedCandidate: {
            supplierId: 'sup_avbackup',
            supplierName: 'AV Backup Crew',
            quotedAmount: 0,
          },
        },
        mode: 'mock',
      },
    });
    expect(
      pending[0].pareResult.riskAssessment.factors.some((factor) => factor.includes('No quote on file')),
    ).toBe(true);
    expect(pending[0].pareResult.budgetAnalysis.summary).toContain('has no quote on file');
  });

  it('returns the same hydrated PARE response after approval', async () => {
    const { prisma, quoteRequest } = createParePrisma();
    const service = new PAREService(prisma);

    const pending = await service.handleEmergencyTrigger(quoteRequest.id);
    const approved = await service.approveRecommendation(pending.id, 'Ms. Mys');

    expect(approved).toMatchObject({
      id: pending.id,
      status: 'approved',
      reviewedBy: 'Ms. Mys',
      pareResult: {
        budgetAnalysis: {
          selectedCandidate: {
            supplierName: 'AV Backup Crew',
          },
        },
      },
    });
  });
});
