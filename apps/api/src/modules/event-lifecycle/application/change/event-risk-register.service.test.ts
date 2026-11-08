import { describe, expect, it, vi } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { OpsUserRole } from '@prism/kernel/event-core';
import { STANDARD_EVENT_RISKS } from '@prism/types';
import { EventRiskRegisterService } from './event-risk-register.service';

const pmcm = { id: 'usr_pmcm', role: OpsUserRole.PmcmAdmin, name: 'Maxine', email: 'pmcm@test', explicit: true, verified: true };
const client = { id: 'usr_client', role: OpsUserRole.Client, name: 'Ana', email: 'ana@test', explicit: true, verified: true };

function fixture() {
  const rows: Array<Record<string, unknown>> = [];
  const prisma = {
    opsEvent: { findUnique: vi.fn(async () => ({ id: 'evt_1', archived: false })) },
    opsEventRisk: {
      findMany: vi.fn(async () => rows),
      createMany: vi.fn(async ({ data }: { data: Array<Record<string, unknown>> }) => {
        let count = 0;
        for (const item of data) {
          if (rows.some((row) => row.catalogKey === item.catalogKey)) continue;
          rows.push({ ...item, owner: '', status: 'open', createdAt: new Date(), updatedAt: new Date() });
          count += 1;
        }
        return { count };
      }),
    },
  };
  const access = { requireActorRole: vi.fn(async (actor: { role: string }, roles: string[]) => { if (!roles.includes(actor.role)) throw new ForbiddenException('no'); }) };
  const audit = { write: vi.fn(async () => undefined) };
  return { service: new EventRiskRegisterService(prisma as never, access as never, audit as never), rows, audit };
}

describe('FR-07 risk register', () => {
  it('loads the standard risks once, ordered by phase and then score', async () => {
    const f = fixture();
    const first = await f.service.loadStandardRisks('evt_1', pmcm);
    await f.service.loadStandardRisks('evt_1', pmcm);
    expect(f.rows).toHaveLength(STANDARD_EVENT_RISKS.length);
    expect(f.audit.write).toHaveBeenCalledTimes(1);
    expect(first[0]).toMatchObject({ phase: 'planning', catalogKey: 'client_owned_supplier', score: 12 });
    expect(first[first.length - 1]).toMatchObject({ phase: 'post_event' });
  });

  it('keeps the register PMCM-only', async () => {
    await expect(fixture().service.list('evt_1', client)).rejects.toThrow(ForbiddenException);
  });
});
