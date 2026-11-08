import { describe, expect, it, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { OpsUserRole } from '@prism/kernel/event-core';
import { ExternalCreativeTicketService } from './external-creative-ticket.service';

const pmcm = { id: 'usr_pmcm', role: OpsUserRole.PmcmAdmin, name: 'Maxine', email: 'pmcm@test', explicit: true, verified: true };

function fixture(documents: Array<{ id: string; eventId: string; fileName: string }>) {
  const rows: Array<Record<string, unknown>> = [];
  const prisma = {
    opsExternalCreativeTicket: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => { const row = { status: 'requested', progressNote: '', outputDocumentId: null, outputFileName: null, completedAt: null, completedBy: null, ...data, createdAt: new Date(), updatedAt: new Date() }; rows.push(row); return row; }),
      findFirst: vi.fn(async ({ where }: { where: { id: string; eventId: string } }) => rows.find((row) => row.id === where.id && row.eventId === where.eventId) ?? null),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => Object.assign(rows.find((row) => row.id === where.id)!, data, { updatedAt: new Date() })),
      findMany: vi.fn(async () => rows),
    },
    opsDocument: { findFirst: vi.fn(async ({ where }: { where: { id: string; eventId: string } }) => documents.find((doc) => doc.id === where.id && doc.eventId === where.eventId) ?? null) },
  };
  const events = { findOperationsEvent: vi.fn(async () => ({ id: 'evt_1', archived: false })) };
  return new ExternalCreativeTicketService(prisma as never, { write: vi.fn() } as never, events as never);
}

describe('FR-87 outsourced creative tickets', () => {
  it('tracks an external designer to completion against an output already in this event\'s files', async () => {
    const service = fixture([{ id: 'doc_1', eventId: 'evt_1', fileName: 'stage-backdrop.pdf' }, { id: 'doc_other', eventId: 'evt_2', fileName: 'x.pdf' }]);
    const ticket = await service.create('evt_1', { designerName: 'Lia Studio', deliverable: 'Stage backdrop artwork' }, pmcm);
    await service.update('evt_1', ticket.id, { status: 'in_progress', progressNote: 'First draft shared' }, pmcm);
    await expect(service.complete('evt_1', ticket.id, { outputDocumentId: 'doc_other' }, pmcm)).rejects.toBeInstanceOf(BadRequestException);
    const done = await service.complete('evt_1', ticket.id, { outputDocumentId: 'doc_1' }, pmcm);
    expect(done).toMatchObject({ status: 'completed', outputFileName: 'stage-backdrop.pdf', completedBy: 'Maxine' });
    await expect(service.update('evt_1', ticket.id, { status: 'delivered', progressNote: '' }, pmcm)).rejects.toThrow('already completed');
  });
});
