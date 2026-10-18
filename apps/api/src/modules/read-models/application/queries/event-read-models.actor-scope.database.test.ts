import "reflect-metadata";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PrismaService } from "@prism/kernel/database";
import { EventAccessPolicyService } from "@prism/kernel/access-control";
import { OpsUserRole } from "@prism/kernel/event-core";
import { EventReadModelQueries } from "./event-read-models.queries";
import { EventReadModelsService } from "../services/event-read-models.service";
import { EventClosureService } from "@prism/contexts/event-lifecycle";

const databaseUrl = process.env.P0_TEST_DATABASE_URL?.trim();
if (databaseUrl) {
  const parsed = new URL(databaseUrl);
  if (
    parsed.hostname !== "127.0.0.1" ||
    parsed.port !== "55437" ||
    parsed.pathname !== "/prism_p0"
  ) {
    throw new Error(
      "P0_TEST_DATABASE_URL must target 127.0.0.1:55437/prism_p0",
    );
  }
}

const databaseSuite = describe.skipIf(!databaseUrl);

databaseSuite("actor-scoped event reads PostgreSQL behavior", () => {
  let prisma: PrismaService;

  beforeAll(async () => {
    if (!databaseUrl) return;
    for (const variable of [
      "SUPABASE_DB_URL",
      "DATABASE_URL",
      "PRISMA_DATABASE_URL",
      "DIRECT_URL",
    ])
      process.env[variable] = databaseUrl;
    process.env.DB_SSL = "false";
    prisma = new PrismaService();
    await prisma.$connect();
  });

  afterAll(async () => {
    if (prisma) await prisma.$disconnect();
  });

  it("keeps client, supplier, coordinator and archived reads eligible across unrelated event volume", async () => {
    const prefix = `p0_w04_${randomUUID().replaceAll("-", "")}`;
    const eventDate = new Date("2031-03-17T09:00:00.000Z");
    const clientEmail = `${prefix}.client@example.test`;
    const supplierEmail = `${prefix}.supplier@example.test`;
    const coordinatorEmail = `${prefix}.coordinator@example.test`;
    const unrelatedInquiryIds = Array.from(
      { length: 501 },
      (_, index) => `${prefix}_unrelated_inquiry_${index}`,
    );
    const unrelatedEventIds = Array.from(
      { length: 501 },
      (_, index) => `${prefix}_unrelated_event_${index}`,
    );
    const clientInquiryId = `${prefix}_client_inquiry`;
    const supplierInquiryId = `${prefix}_supplier_inquiry`;
    const coordinatorInquiryId = `${prefix}_coordinator_inquiry`;
    const clientEventId = `${prefix}_client_event`;
    const archivedClientEventId = `${prefix}_client_archived_event`;
    const supplierEventId = `${prefix}_supplier_event`;
    const supplierUnassignedEventId = `${prefix}_supplier_unassigned_event`;
    const supplierArchivedEventId = `${prefix}_supplier_archived_event`;
    const coordinatorEventId = `${prefix}_coordinator_event`;
    const coordinatorUnassignedEventId = `${prefix}_coordinator_unassigned_event`;
    const coordinatorCancelledEventId = `${prefix}_coordinator_cancelled_event`;
    const coordinatorDeclinedEventId = `${prefix}_coordinator_declined_event`;
    const supplierCategoryId = `${prefix}_supplier_category`;
    const supplierId = `${prefix}_supplier`;
    const coordinatorId = `${prefix}_coordinator`;
    const actorName = `${prefix} Client`;

    const inquiryIds = [
      ...unrelatedInquiryIds,
      clientInquiryId,
      supplierInquiryId,
      coordinatorInquiryId,
    ];
    const emailForInquiry = (id: string) =>
      id === clientInquiryId
        ? clientEmail
        : id === supplierInquiryId
          ? supplierEmail
          : id === coordinatorInquiryId
            ? coordinatorEmail
            : `${id}@example.test`;
    try {
      await prisma.opsInquiry.createMany({
        data: inquiryIds.map((id) => ({
          id,
          clientName:
            id === clientInquiryId ? actorName : `${prefix} unrelated`,
          email: emailForInquiry(id),
          eventName: `${prefix} Inquiry`,
          eventDate,
          clientType: "corporate",
          normalizedEmail: emailForInquiry(id).toLowerCase(),
        })),
      });
      await prisma.opsEvent.createMany({
        data: [
          ...unrelatedEventIds.map((id, index) => ({
            id,
            inquiryId: unrelatedInquiryIds[index],
            clientName: `${prefix} unrelated`,
            eventName: `Unrelated ${index}`,
            eventDate: new Date(Date.UTC(2030, 0, 1 + (index % 28))),
          })),
          {
            id: clientEventId,
            inquiryId: clientInquiryId,
            clientName: actorName,
            eventName: "Client event behind global volume",
            eventDate: new Date("2040-01-01T00:00:00.000Z"),
            clientPortalStatus: "unlocked",
          },
          {
            id: archivedClientEventId,
            inquiryId: clientInquiryId,
            clientName: actorName,
            eventName: "Archived client event",
            eventDate: new Date("2041-01-01T00:00:00.000Z"),
            clientPortalStatus: "unlocked",
            archived: true,
            archivedAt: new Date("2042-01-01T00:00:00.000Z"),
          },
          {
            id: supplierEventId,
            inquiryId: supplierInquiryId,
            clientName: `${prefix} Supplier Client`,
            eventName: "Assigned supplier event",
            eventDate,
          },
          {
            id: supplierUnassignedEventId,
            inquiryId: supplierInquiryId,
            clientName: `${prefix} Supplier Client`,
            eventName: "Unassigned supplier event",
            eventDate,
          },
          {
            id: supplierArchivedEventId,
            inquiryId: supplierInquiryId,
            clientName: `${prefix} Supplier Client`,
            eventName: "Archived supplier event",
            eventDate,
            archived: true,
          },
          {
            id: coordinatorEventId,
            inquiryId: coordinatorInquiryId,
            clientName: `${prefix} Coordinator Client`,
            eventName: "Assigned coordinator event",
            eventDate,
          },
          {
            id: coordinatorUnassignedEventId,
            inquiryId: coordinatorInquiryId,
            clientName: `${prefix} Coordinator Client`,
            eventName: "Unassigned coordinator event",
            eventDate,
          },
          {
            id: coordinatorCancelledEventId,
            inquiryId: coordinatorInquiryId,
            clientName: `${prefix} Coordinator Client`,
            eventName: "Cancelled coordinator event",
            eventDate,
          },
          {
            id: coordinatorDeclinedEventId,
            inquiryId: coordinatorInquiryId,
            clientName: `${prefix} Coordinator Client`,
            eventName: "Declined coordinator event",
            eventDate,
          },
        ],
      });
      await prisma.opsSupplierCategory.create({
        data: {
          id: supplierCategoryId,
          slug: supplierCategoryId,
          name: "P0 supplier category",
        },
      });
      await prisma.opsSupplier.create({
        data: {
          id: supplierId,
          categoryId: supplierCategoryId,
          name: "P0 supplier",
          email: supplierEmail,
        },
      });
      await prisma.opsSupplierQuoteRequest.createMany({
        data: [supplierEventId, supplierArchivedEventId].map((id) => ({
          id: `${prefix}_request_${id}`,
          eventId: id,
          supplierId,
          supplierName: "P0 supplier",
          category: "P0 category",
          accessToken: `${prefix}_token_${id}`,
        })),
      });
      await prisma.opsCoordinator.create({
        data: {
          id: coordinatorId,
          name: "P0 coordinator",
          email: coordinatorEmail,
        },
      });
      await prisma.opsCoordinatorAssignment.createMany({
        data: [
          {
            id: `${prefix}_assignment_active`,
            eventId: coordinatorEventId,
            coordinatorId,
            coordinatorName: "P0 coordinator",
            role: "Lead",
          },
          {
            id: `${prefix}_assignment_cancelled`,
            eventId: coordinatorCancelledEventId,
            coordinatorId,
            coordinatorName: "P0 coordinator",
            role: "Lead",
            status: "cancelled",
          },
          {
            id: `${prefix}_assignment_declined`,
            eventId: coordinatorDeclinedEventId,
            coordinatorId,
            coordinatorName: "P0 coordinator",
            role: "Lead",
            status: "declined",
          },
        ],
      });

      const queries = new EventReadModelQueries(prisma);
      const policy = new EventAccessPolicyService({ write: vi.fn() } as never);
      const service = new EventReadModelsService(
        queries,
        policy,
        {} as never,
        {} as never,
        { listClientSnapshotEntries: vi.fn().mockResolvedValue([]) } as never,
        { listActiveSharedEvents: vi.fn().mockResolvedValue([]) } as never,
      );
      const clientActor = policy.resolveActor({
        actorRole: OpsUserRole.Client,
        actorName,
        actorEmail: clientEmail,
      });
      const workspace = await service.clientWorkspace(clientActor, {
        mapEvent: (event) => event,
        mapDocument: (row) => row,
        mapBriefing: (row) => row,
        mapBillingStatement: (row) => row,
        mapPaymentMilestone: (row) => row,
        mapFloorPlanDraft: (row) => row,
        mapAuditLog: (row) => row,
      });
      const actionCenter = await service.clientActionCenter(clientActor);
      const supplierPage = await queries.visibleEvents({
        role: OpsUserRole.Supplier,
        name: "P0 supplier",
        email: supplierEmail,
        explicit: true,
      });
      const coordinatorPage = await queries.visibleEvents({
        role: OpsUserRole.Coordinator,
        name: "P0 coordinator",
        email: coordinatorEmail,
        explicit: true,
      });

      expect(
        workspace.events.some(
          (event) => (event as { id: string }).id === clientEventId,
        ),
      ).toBe(true);
      expect(
        workspace.events.some(
          (event) => (event as { id: string }).id === archivedClientEventId,
        ),
      ).toBe(false);
      expect(
        workspace.archivedEvents?.some(
          (event) => (event as { id: string }).id === archivedClientEventId,
        ),
      ).toBe(true);
      expect(
        actionCenter.items.some((item) => item.eventId === clientEventId),
      ).toBe(true);
      expect(
        actionCenter.items.some(
          (item) => item.eventId === archivedClientEventId,
        ),
      ).toBe(false);
      expect(supplierPage.items.map((event) => event.id)).toEqual([
        supplierEventId,
      ]);
      expect(coordinatorPage.items.map((event) => event.id)).toEqual([
        coordinatorEventId,
      ]);

      const archiveService = new EventClosureService(
        prisma,
        {} as never,
        {} as never,
        {} as never,
        policy,
        {} as never,
        {} as never,
        {} as never,
        {} as never,
      );
      const archivedHits = await archiveService.searchArchive(
        {},
        policy.resolveActor({ actorRole: OpsUserRole.PmcmAdmin }),
      );
      expect(archivedHits.map((hit) => hit.id)).toContain(
        archivedClientEventId,
      );
    } finally {
      await prisma.opsSupplierQuoteRequest.deleteMany({
        where: { id: { startsWith: prefix } },
      });
      await prisma.opsCoordinatorAssignment.deleteMany({
        where: { id: { startsWith: prefix } },
      });
      await prisma.opsEvent.deleteMany({
        where: { id: { startsWith: prefix } },
      });
      await prisma.opsInquiry.deleteMany({
        where: { id: { startsWith: prefix } },
      });
      await prisma.opsSupplier.deleteMany({ where: { id: supplierId } });
      await prisma.opsSupplierCategory.deleteMany({
        where: { id: supplierCategoryId },
      });
      await prisma.opsCoordinator.deleteMany({ where: { id: coordinatorId } });
    }
  });
});
