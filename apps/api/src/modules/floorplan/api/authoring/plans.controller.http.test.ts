import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PrismaService } from '@prism/kernel/database';
import { PrismaService as PrismaServiceToken } from '@prism/kernel/database';
import { AUDIT_WRITER, EventAccessPolicyService, type AuditWriter } from '@prism/kernel/access-control';
import { EventSessionGuard, AuthSessionService } from '@prism/kernel/event-session';
import type { PrismUser } from '@prism/types';
import { FLOORPLAN_EVENT_REFERENCE_READER } from '@prism/contexts/event-lifecycle/floorplan-reference';
import { PlansController } from './plans.controller';
import { PlansService } from '../../application/authoring/plans.service';

const sessionSecret = 'local-plans-http-test-secret-with-sufficient-entropy';
const updatedAt = new Date('2026-05-05T00:00:00.000Z');

function planRow(id: string, clientEmail: string, sourceType: string, status: string) {
  return {
    id,
    name: `Plan ${id}`,
    venue: 'Main Hall',
    width: 1400,
    height: 900,
    gridSize: 20,
    pax: 80,
    ownerId: 'pmcm-user',
    templateId: null,
    eventId: null,
    objects: [],
    guests: [],
    suppliers: [],
    seats: [],
    seatCategories: [],
    updatedAt,
    objectRows: [],
    opsDraft: {
      eventId: `event-${id}`,
      sourceType,
      status,
      event: {
        id: `event-${id}`,
        clientName: 'Ana Reyes',
        clientPortalStatus: 'unlocked',
        archived: false,
        freezeStatus: 'open',
        inquiry: { email: clientEmail },
      },
    },
  };
}

const preference = planRow('client-preference', 'ana.owner@example.test', 'client_preference', 'client_submitted');
const officialDraft = planRow('official-draft', 'ana.owner@example.test', 'pmcm_official', 'draft');
const planRows = new Map([
  [preference.id, preference],
  [officialDraft.id, officialDraft],
]);

const lifecycleEventReferences = {
  findFloorplanEvent: async (eventId: string) => {
    const plan = [...planRows.values()].find((row) => row.opsDraft.eventId === eventId);
    if (!plan) return null;
    return {
      eventId,
      eventName: `Event ${eventId}`,
      clientName: plan.opsDraft.event.clientName,
      clientPortalStatus: plan.opsDraft.event.clientPortalStatus,
      archived: plan.opsDraft.event.archived,
      freezeStatus: plan.opsDraft.event.freezeStatus,
      floorPlanStatus: 'in_review',
      readiness: 'Floorplan awaiting review',
      primaryClientEmail: plan.opsDraft.event.inquiry.email,
      conformeSigned: true,
      ocularVisitStatus: 'completed',
    };
  },
};

const auditWriter: AuditWriter = { write: async () => undefined };
const transaction = {
  floorPlan: {
    findUnique: async ({ where }: { where: { id: string } }) => planRows.get(where.id) ?? null,
    update: async () => ({ ...officialDraft, updatedAt: new Date('2026-05-05T00:01:00.000Z') }),
  },
  $queryRawUnsafe: async () => [],
};

const prismaMock = {
  opsUser: { findUnique: async () => ({ sessionVersion: 0 }) },
  floorPlan: {
    findUnique: async ({ where }: { where: { id: string } }) => planRows.get(where.id) ?? null,
  },
  $queryRawUnsafe: async () => [],
  $transaction: async (callback: (tx: typeof transaction) => Promise<unknown>) => callback(transaction),
};

@Module({
  controllers: [PlansController],
  providers: [
    PlansService,
    EventAccessPolicyService,
    EventSessionGuard,
    AuthSessionService,
    { provide: ConfigService, useValue: { get: (key: string) => (key === 'PRISM_SESSION_SECRET' ? sessionSecret : undefined) } },
    { provide: PrismaServiceToken, useValue: prismaMock as unknown as PrismaService },
    { provide: AUDIT_WRITER, useValue: auditWriter },
    { provide: FLOORPLAN_EVENT_REFERENCE_READER, useValue: lifecycleEventReferences },
  ],
})
class PlansHttpTestModule {}

describe('PlansController authenticated HTTP authorization', () => {
  let app: Awaited<ReturnType<typeof NestFactory.create>>;
  let baseUrl: string;
  let ownerToken: string;
  let otherAnaToken: string;
  let pmcmToken: string;

  beforeAll(async () => {
    const config = { get: (key: string) => (key === 'PRISM_SESSION_SECRET' ? sessionSecret : undefined) };
    const session = new AuthSessionService(config as unknown as ConfigService);
    const user = (id: string, email: string, role: PrismUser['role']): PrismUser => ({
      id,
      email,
      name: 'Ana Reyes',
      role,
      organization: role === 'client' ? 'Client' : 'PMCM',
      approvalStatus: 'approved',
      sessionVersion: 0,
    });
    const issuedAt = new Date();
    ownerToken = session.issueSession(user('client-owner', 'ana.owner@example.test', 'client'), issuedAt).accessToken;
    otherAnaToken = session.issueSession(user('client-other', 'ana.other@example.test', 'client'), issuedAt).accessToken;
    pmcmToken = session.issueSession(user('pmcm-user', 'maxine@pmcm.example.test', 'pmcm-admin'), issuedAt).accessToken;

    app = await NestFactory.create(PlansHttpTestModule, { logger: false });
    app.setGlobalPrefix('api');
    await app.listen(0, '127.0.0.1');
    const address = app.getHttpServer().address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}/api`;
  });

  afterAll(async () => {
    await app.close();
  });

  it('uses verified account identity for same-name client reads, exports, and edits', async () => {
    const ownerRead = await fetch(`${baseUrl}/plans/${preference.id}`, {
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    expect(ownerRead.status).toBe(200);

    const outsiderRead = await fetch(`${baseUrl}/plans/${preference.id}`, {
      headers: { authorization: `Bearer ${otherAnaToken}` },
    });
    expect(outsiderRead.status).toBe(403);

    const outsiderExport = await fetch(`${baseUrl}/plans/${preference.id}/export`, {
      headers: { authorization: `Bearer ${otherAnaToken}` },
    });
    expect(outsiderExport.status).toBe(403);

    const outsiderEdit = await fetch(`${baseUrl}/plans/${preference.id}`, {
      method: 'PUT',
      headers: { authorization: `Bearer ${otherAnaToken}`, 'content-type': 'application/json' },
      body: JSON.stringify({ expectedUpdatedAt: updatedAt.toISOString(), width: 1500 }),
    });
    expect(outsiderEdit.status).toBe(403);
  });

  it('denies the legitimate client edits to an official draft and accepts a verified PMCM edit', async () => {
    const clientEdit = await fetch(`${baseUrl}/plans/${officialDraft.id}`, {
      method: 'PUT',
      headers: { authorization: `Bearer ${ownerToken}`, 'content-type': 'application/json' },
      body: JSON.stringify({ expectedUpdatedAt: updatedAt.toISOString(), width: 1500 }),
    });
    expect(clientEdit.status).toBe(403);

    const pmcmEdit = await fetch(`${baseUrl}/plans/${officialDraft.id}`, {
      method: 'PUT',
      headers: { authorization: `Bearer ${pmcmToken}`, 'content-type': 'application/json' },
      body: JSON.stringify({ expectedUpdatedAt: updatedAt.toISOString(), width: 1500 }),
    });
    expect(pmcmEdit.status).toBe(200);
  });
});
