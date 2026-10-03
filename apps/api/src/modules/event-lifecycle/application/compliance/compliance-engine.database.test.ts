import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { PrismaService } from "@prism/kernel/database";
import { EventAccessPolicyService } from "@prism/kernel/access-control";
import { AuditService, AuditWriterAdapter, SecurityOperationsService } from "@prism/contexts/platform-ops";
import { OpsUserRole, WorkflowCommandService } from "@prism/kernel/event-core";
import { FileRequirementsMatrixService } from "../files/file-requirements-matrix.service";
import { ComplianceWorkflowService } from "./compliance-workflow.service";

const databaseUrl = process.env.P0_TEST_DATABASE_URL;
const operator = { role: OpsUserRole.PmcmAdmin, name: "W24 database test", email: "w24@pmcm.test", explicit: true };

describe.skipIf(!databaseUrl)("compliance engine against PostgreSQL", () => {
  let prisma: PrismaClient;
  let pool: Pool;
  let service: ComplianceWorkflowService;
  let inquiryId: string;
  let eventId: string;

  beforeAll(async () => {
    const url = new URL(databaseUrl!);
    if (url.hostname !== "127.0.0.1" || url.port !== "55437" || url.pathname !== "/prism_p0") throw new Error("P0_TEST_DATABASE_URL must target the isolated 127.0.0.1:55437/prism_p0 database");
    pool = new Pool({ connectionString: databaseUrl, ssl: false, max: 5 });
    prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
    await prisma.$connect();
    const database = prisma as PrismaService;
    const auditService = new AuditService(database);
    const auditWriter = new AuditWriterAdapter(auditService, new SecurityOperationsService(database, auditService));
    service = new ComplianceWorkflowService(database, auditWriter, new EventAccessPolicyService(auditWriter), new WorkflowCommandService(), new FileRequirementsMatrixService(database));
  });

  afterEach(() => {
    // Keep event and inquiry parents because the current cross-schema event cascade also deletes audit evidence.
    inquiryId = ""; eventId = "";
  });

  afterAll(async () => { await prisma?.$disconnect(); await pool?.end(); });

  it("persists a run, explainable checks, and a rule-raised risk", async () => {
    inquiryId = `w24_inq_${randomUUID()}`; eventId = `w24_evt_${randomUUID()}`;
    await prisma.opsInquiry.create({ data: { id: inquiryId, clientName: "W24", email: `${inquiryId}@test.invalid`, eventName: "W24", eventType: "Corporate", eventDate: new Date("2026-10-01"), clientType: "Corporate" } });
    await prisma.opsEvent.create({ data: { id: eventId, inquiryId, clientName: "W24", eventName: "W24", eventDate: new Date("2026-10-01"), status: "planning" } });
    const checks = await service.runCompliance(eventId, { phase: "planning", trigger: "manual" }, operator);
    expect(checks.length).toBeGreaterThan(0);
    expect(checks.every((check) => ["satisfied", "not_satisfied", "not_applicable"].includes(check.evaluationStatus))).toBe(true);
    expect(await prisma.opsComplianceRun.count({ where: { eventId } })).toBe(1);
    expect(await prisma.opsComplianceRisk.count({ where: { eventId, source: "rule" } })).toBeGreaterThan(0);
  });
});
