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
import { NOTIFICATION_OUTBOX_WRITER } from '@prism/contexts/platform-ops';
import { ScopeChangeRequestController } from './scope-change-request.controller';
import { EventRiskAssessmentController } from './event-risk-assessment.controller';
import { ScopeChangeRequestService } from '../../application/change/scope-change-request.service';
import { EventRiskAssessmentService } from '../../application/change/event-risk-assessment.service';

const sessionSecret = 'local-scope-change-risk-http-test-secret-with-entropy';
const eventId = 'evt_1';

// Accounts the session guard re-reads; the role and email must match the tokens signed below.
const accounts: Record<string, { email: string; role: string }> = {
  'client-owner': { email: 'ana.owner@example.test', role: 'client' },
  'client-other': { email: 'ana.other@example.test', role: 'client' },
  'supplier-1': { email: 'supplier@example.test', role: 'supplier' },
  'guest-1': { email: 'guest@example.test', role: 'guest' },
  'coordinator-1': { email: 'coordinator@example.test', role: 'coordinator' },
  'pmcm-user': { email: 'maxine@pmcm.example.test', role: 'pmcm-admin' },
};

type Row = Record<string, any>;

function seededRequest(id: string): Row {
  const now = new Date('2026-10-18T09:00:00.000Z');
  return {
    id, eventId, requestedByRole: 'client', requestedBy: 'Ana Reyes', requestedById: 'client-owner', title: `Request ${id}`, description: 'Move the cocktail hour outside',
    category: 'schedule', status: 'submitted', decisionReason: null, clientResponse: null, billingImpact: false, supplierImpact: false, coordinatorImpact: false,
    floorplanImpact: false, impactReviewedAt: null, freezeExceptionId: null, addendumId: null, reviewedBy: null, decidedBy: null, submittedAt: now, reviewStartedAt: null,
    decidedAt: null, withdrawnAt: null, createdAt: now, updatedAt: now,
  };
}

const scopeRows = new Map<string, Row>([
  ['scope_change_review', seededRequest('scope_change_review')],
  ['scope_change_withdraw', seededRequest('scope_change_withdraw')],
]);

function matches(row: Row, where: Row = {}) {
  return Object.entries(where).every(([key, condition]) => {
    if (condition && typeof condition === 'object' && 'in' in condition) return (condition.in as unknown[]).includes(row[key]);
    return row[key] === condition;
  });
}

// Minimal in-memory tables: enough for the happy paths to reach the same reads and conditional writes the services make.
const riskAssessments = new Map<string, Row>();
const riskHistory: Row[] = [];

const prismaMock = {
  opsUser: {
    findUnique: async ({ where }: { where: { id: string } }) => {
      const account = accounts[where.id];
      return account ? { sessionVersion: 0, approvalStatus: 'approved', lockedUntil: null, permanentLockout: false, ...account } : null;
    },
  },
  opsEvent: {
    findUnique: async () => ({
      id: eventId, eventName: 'Launch Gala', clientName: 'Ana Reyes', clientPortalStatus: 'unlocked', archived: false, freezeStatus: 'open',
      inquiry: { email: 'ana.owner@example.test' },
    }),
  },
  opsComplianceRisk: { findMany: async () => [] },
  opsScopeChangeRequest: {
    create: async ({ data }: { data: Row }) => { const row: Row = { ...seededRequest(data.id), ...data, submittedAt: new Date(), updatedAt: new Date() }; scopeRows.set(row.id, row); return row; },
    findFirst: async ({ where }: { where: Row }) => [...scopeRows.values()].find((row) => matches(row, where)) ?? null,
    findMany: async ({ where }: { where: Row }) => [...scopeRows.values()].filter((row) => matches(row, where)),
    findUniqueOrThrow: async ({ where }: { where: Row }) => scopeRows.get(where.id)!,
    updateMany: async ({ where, data }: { where: Row; data: Row }) => {
      const hits = [...scopeRows.values()].filter((row) => matches(row, where));
      for (const row of hits) Object.assign(row, data, { updatedAt: new Date() });
      return { count: hits.length };
    },
  },
  opsEventRiskAssessment: {
    findUnique: async ({ where }: { where: { eventId: string } }) => {
      const row = [...riskAssessments.values()].find((item) => item.eventId === where.eventId);
      return row ? { ...row, history: riskHistory.filter((entry) => entry.assessmentId === row.id) } : null;
    },
    create: async ({ data }: { data: Row }) => { riskAssessments.set(data.id, { ...data }); return data; },
    updateMany: async () => ({ count: 1 }),
  },
  opsEventRiskAssessmentHistory: { create: async ({ data }: { data: Row }) => { riskHistory.push(data); return data; } },
  $transaction: async (callback: (tx: unknown) => Promise<unknown>) => callback(prismaMock),
};

@Module({
  controllers: [ScopeChangeRequestController, EventRiskAssessmentController],
  providers: [
    ScopeChangeRequestService,
    EventRiskAssessmentService,
    EventAccessPolicyService,
    EventSessionGuard,
    AuthSessionService,
    { provide: ConfigService, useValue: { get: (key: string) => (key === 'PRISM_SESSION_SECRET' ? sessionSecret : undefined) } },
    { provide: PrismaServiceToken, useValue: prismaMock as unknown as PrismaService },
    { provide: AUDIT_WRITER, useValue: { write: async () => undefined } as AuditWriter },
    { provide: NOTIFICATION_OUTBOX_WRITER, useValue: { write: async () => undefined } },
  ],
})
class ScopeChangeRiskHttpTestModule {}

describe('scope change and risk routes, authenticated HTTP authorization', () => {
  let app: Awaited<ReturnType<typeof NestFactory.create>>;
  let baseUrl: string;
  const tokens: Record<string, string> = {};

  beforeAll(async () => {
    const session = new AuthSessionService({ get: (key: string) => (key === 'PRISM_SESSION_SECRET' ? sessionSecret : undefined) } as unknown as ConfigService);
    const issuedAt = new Date();
    for (const [id, account] of Object.entries(accounts)) {
      const user: PrismUser = {
        id,
        email: account.email,
        name: id,
        role: account.role as PrismUser['role'],
        organization: 'Test',
        approvalStatus: 'approved',
        sessionVersion: 0,
      };
      tokens[id] = session.issueSession(user, issuedAt).accessToken;
    }

    app = await NestFactory.create(ScopeChangeRiskHttpTestModule, { logger: false });
    app.setGlobalPrefix('api');
    await app.listen(0, '127.0.0.1');
    const address = app.getHttpServer().address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}/api`;
  });

  afterAll(async () => {
    await app.close();
  });

  const submitBody = { title: 'Add a sunset slot', description: 'Move the cocktail hour outside', category: 'schedule' };
  const rejectBody = { decision: 'reject', decisionReason: 'Venue cannot take the extra hour' };
  const riskBody = { level: 'high', summary: 'Venue access is uncertain', expectedRevision: 0 };

  // Each row: the caller, the route, and the expected status. Happy paths are the first row of each route group.
  const cases: Array<{ label: string; actor: string; method: 'GET' | 'POST' | 'PATCH'; path: string; body?: unknown; status: number }> = [
    { label: 'client submits a scope change for their own event', actor: 'client-owner', method: 'POST', path: '/scope-changes', body: submitBody, status: 201 },
    { label: 'non-primary client cannot submit to another client event', actor: 'client-other', method: 'POST', path: '/scope-changes', body: submitBody, status: 403 },
    { label: 'supplier cannot submit a scope change', actor: 'supplier-1', method: 'POST', path: '/scope-changes', body: submitBody, status: 403 },
    { label: 'guest cannot submit a scope change', actor: 'guest-1', method: 'POST', path: '/scope-changes', body: submitBody, status: 403 },
    { label: 'client withdraws their own submitted request', actor: 'client-owner', method: 'POST', path: '/scope-changes/scope_change_withdraw/withdraw', status: 201 },
    { label: 'non-primary client cannot withdraw', actor: 'client-other', method: 'POST', path: '/scope-changes/scope_change_review/withdraw', status: 403 },
    { label: 'supplier cannot withdraw', actor: 'supplier-1', method: 'POST', path: '/scope-changes/scope_change_review/withdraw', status: 403 },
    { label: 'guest cannot withdraw', actor: 'guest-1', method: 'POST', path: '/scope-changes/scope_change_review/withdraw', status: 403 },
    { label: 'PMCM starts review of a submitted request', actor: 'pmcm-user', method: 'PATCH', path: '/scope-changes/scope_change_review', body: { decision: 'start_review' }, status: 200 },
    { label: 'client cannot start a review', actor: 'client-owner', method: 'PATCH', path: '/scope-changes/scope_change_review', body: { decision: 'start_review' }, status: 403 },
    { label: 'client cannot approve a scope change', actor: 'client-owner', method: 'PATCH', path: '/scope-changes/scope_change_review', body: { decision: 'approve', impacts: { billing: false, supplier: false, coordinator: false, floorplan: false }, impactReviewAcknowledged: true }, status: 403 },
    { label: 'client cannot reject a scope change', actor: 'client-owner', method: 'PATCH', path: '/scope-changes/scope_change_review', body: rejectBody, status: 403 },
    { label: 'coordinator cannot reject a scope change', actor: 'coordinator-1', method: 'PATCH', path: '/scope-changes/scope_change_review', body: rejectBody, status: 403 },
    { label: 'client cannot read the PMCM scope change register', actor: 'client-owner', method: 'GET', path: '/scope-changes', status: 403 },
    { label: 'PMCM reads the risk level and history', actor: 'pmcm-user', method: 'GET', path: '/risk-assessment', status: 200 },
    { label: 'client cannot read the risk level', actor: 'client-owner', method: 'GET', path: '/risk-assessment', status: 403 },
    { label: 'supplier cannot read the risk level', actor: 'supplier-1', method: 'GET', path: '/risk-assessment', status: 403 },
    { label: 'guest cannot read the risk level', actor: 'guest-1', method: 'GET', path: '/risk-assessment', status: 403 },
    { label: 'coordinator cannot read the risk level', actor: 'coordinator-1', method: 'GET', path: '/risk-assessment', status: 403 },
    { label: 'PMCM records the risk level', actor: 'pmcm-user', method: 'POST', path: '/risk-assessment', body: riskBody, status: 201 },
    { label: 'client cannot record the risk level', actor: 'client-owner', method: 'POST', path: '/risk-assessment', body: riskBody, status: 403 },
    { label: 'supplier cannot record the risk level', actor: 'supplier-1', method: 'POST', path: '/risk-assessment', body: riskBody, status: 403 },
    { label: 'guest cannot record the risk level', actor: 'guest-1', method: 'POST', path: '/risk-assessment', body: riskBody, status: 403 },
    { label: 'coordinator cannot record the risk level', actor: 'coordinator-1', method: 'POST', path: '/risk-assessment', body: riskBody, status: 403 },
  ];

  it('returns the expected status for every caller and route in the scope change and risk table', async () => {
    const results: string[] = [];
    for (const testCase of cases) {
      const response = await fetch(`${baseUrl}/events/${eventId}${testCase.path}`, {
        method: testCase.method,
        headers: { authorization: `Bearer ${tokens[testCase.actor]}`, ...(testCase.body ? { 'content-type': 'application/json' } : {}) },
        body: testCase.body ? JSON.stringify(testCase.body) : undefined,
      });
      if (response.status !== testCase.status) results.push(`${testCase.label}: expected ${testCase.status}, got ${response.status}`);
    }
    expect(results).toEqual([]);
  });
});
