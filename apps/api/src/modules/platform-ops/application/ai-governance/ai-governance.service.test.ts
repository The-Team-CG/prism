import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { OpsUserRole } from '@prism/kernel/event-core';
import { AiGovernanceService } from '@prism/contexts/platform-ops';

const verifiedActor = {
  id: 'user_admin',
  role: OpsUserRole.PmcmAdmin,
  email: 'admin@pmcm.test',
  name: 'Mara Santos',
  explicit: true,
  verified: true,
};

function createService() {
  const aiAuditLogs: any[] = [];
  const aiApprovalRecords: any[] = [];
  const prisma = {
    opsAiAuditLog: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const record = { ...data, createdAt: new Date('2026-06-14T00:00:00.000Z') };
        aiAuditLogs.push(record);
        return record;
      }),
    },
    opsAiApprovalRecord: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const record = { ...data, requestedAt: new Date('2026-06-14T00:00:00.000Z') };
        aiApprovalRecords.push(record);
        return record;
      }),
    },
  };
  return {
    service: new AiGovernanceService(prisma as any),
    prisma,
    aiAuditLogs,
    aiApprovalRecords,
  };
}

describe('AiGovernanceService', () => {
  it('sanitizes AI payloads before audit persistence', () => {
    const { service } = createService();

    const sanitized = service.sanitizePayload({
      clientName: 'Ana Reyes',
      email: 'ana@ayala.test',
      phone: '+63 917 111 2222',
      supplierName: 'SonicLine Technicals',
      totalAmount: 520000,
      notes: 'Client Ana Reyes prefers SonicLine.',
    });

    expect(JSON.stringify(sanitized)).not.toContain('Ana Reyes');
    expect(JSON.stringify(sanitized)).not.toContain('ana@ayala.test');
    expect(JSON.stringify(sanitized)).toContain('Client A');
  });

  it('records blocked AI audit logs when ZDR is not confirmed', async () => {
    const { service, aiAuditLogs, aiApprovalRecords } = createService();

    await expect(
      service.runDryRun({
        featureName: 'PEIL',
        modelVersion: 'claude-sonnet-sample',
        zdrConfirmed: false,
        payload: { clientName: 'Ana Reyes' },
      }, verifiedActor),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(aiAuditLogs).toHaveLength(1);
    expect(aiAuditLogs[0].status).toBe('ZDR_UNCONFIRMED');
    expect(aiApprovalRecords).toHaveLength(0);
  });

  it('rejects dry-run records from an unverified actor before writing audit rows', async () => {
    const { service, prisma } = createService();

    await expect(service.runDryRun({
      featureName: 'PEIL',
      modelVersion: 'claude-sonnet-sample',
      zdrConfirmed: true,
      payload: {},
    }, { ...verifiedActor, verified: false })).rejects.toBeInstanceOf(ForbiddenException);

    expect(prisma.opsAiAuditLog.create).not.toHaveBeenCalled();
    expect(prisma.opsAiApprovalRecord.create).not.toHaveBeenCalled();
  });

  it('creates pending AI audit and approval records when ZDR is confirmed', async () => {
    const { service } = createService();

    const result = await service.runDryRun({
      eventId: 'evt_sample',
      featureName: 'PEIL',
      modelVersion: 'claude-sonnet-sample',
      zdrConfirmed: true,
      payload: { clientName: 'Ana Reyes', supplierName: 'SonicLine Technicals' },
    }, verifiedActor);

    expect(result.audit.status).toBe('pending_human_approval');
    expect(result.audit.zdrConfirmed).toBe(true);
    expect(result.approval.aiAuditLogId).toBe(result.audit.id);
    expect(result.approval.humanApproved).toBe(false);
    expect(result.approval.requestedBy).toBe(verifiedActor.name);
  });
});
