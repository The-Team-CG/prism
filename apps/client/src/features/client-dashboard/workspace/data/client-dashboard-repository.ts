import {
  PRISM_LEGACY_SESSION_STORAGE_KEYS,
  PRISM_SESSION_STORAGE_KEYS,
  clearPrismSession,
  readPrismSession,
  type PrismClientActionCenter,
  type PrismClientWorkspace,
  type PrismFloorPlanDraft,
  type CreatePrismInquiryInput,
  type CreateFloorPlanPreferenceInput,
  type CreateFloorPlanRevisionCommentInput,
  type PrismFloorPlanSnapshot,
  type PrismClientOcularVisit,
  type SubmitClientOcularVisitInput,
} from "@prism/types";
import { clientApi, clientApiRequest } from "@/lib/prism-api";
import type { Project } from "@/features/floorplan/editor";
import type { ClientSession } from "../model/client-dashboard-types";

export type FloorPlanPreferenceInput = CreateFloorPlanPreferenceInput;

type ApiFloorPlanSnapshot = Omit<PrismFloorPlanSnapshot, "objects" | "guests" | "suppliers"> &
  Pick<Project, "objects" | "guests" | "suppliers">;

function toProject(plan: ApiFloorPlanSnapshot): Project {
  const timestamp = plan.updatedAt ? new Date(plan.updatedAt).getTime() : Date.now();
  return {
    id: plan.id,
    name: plan.name,
    venue: plan.venue,
    widthM: plan.width,
    heightM: plan.height,
    pax: plan.pax,
    objects: plan.objects ?? [],
    guests: plan.guests ?? [],
    suppliers: plan.suppliers ?? [],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export const clientDashboardRepository = {
  readSession(): ClientSession | null {
    return readPrismSession<ClientSession>(PRISM_SESSION_STORAGE_KEYS.client, {
      legacyKeys: [PRISM_LEGACY_SESSION_STORAGE_KEYS.clientMockAuth],
    });
  },

  clearSession(): void {
    clearPrismSession(PRISM_SESSION_STORAGE_KEYS.client, {
      legacyKeys: [PRISM_LEGACY_SESSION_STORAGE_KEYS.clientMockAuth],
    });
  },

  async loadWorkspace(): Promise<PrismClientWorkspace> {
    const pages: PrismClientWorkspace[] = [];
    const seenCursors = new Set<string>();
    let cursor: string | undefined;
    do {
      const page = await clientApi.clientWorkspace.detail({}, cursor);
      pages.push(page);
      if (!page.pagination.hasMore) break;
      const nextCursor = page.pagination.nextCursor;
      if (!nextCursor || seenCursors.has(nextCursor)) throw new Error('Client workspace pagination did not advance');
      seenCursors.add(nextCursor);
      cursor = nextCursor;
    } while (cursor);

    const first = pages[0];
    if (!first) throw new Error('Client workspace returned no page');
    return {
      ...first,
      users: pages.flatMap((page) => page.users),
      inquiries: pages.flatMap((page) => page.inquiries),
      events: pages.flatMap((page) => page.events),
      documents: pages.flatMap((page) => page.documents),
      briefings: pages.flatMap((page) => page.briefings),
      supplierQuotes: pages.flatMap((page) => page.supplierQuotes),
      coordinatorAssignments: pages.flatMap((page) => page.coordinatorAssignments),
      complianceChecks: pages.flatMap((page) => page.complianceChecks),
      billingStatements: pages.flatMap((page) => page.billingStatements),
      paymentMilestones: pages.flatMap((page) => page.paymentMilestones),
      postEventDocuments: pages.flatMap((page) => page.postEventDocuments),
      floorPlanDrafts: pages.flatMap((page) => page.floorPlanDrafts),
      auditLogs: pages.flatMap((page) => page.auditLogs),
      notificationLogs: pages.flatMap((page) => page.notificationLogs),
      clientEventTimelines: pages.flatMap((page) => page.clientEventTimelines),
      ocularVisits: pages.flatMap((page) => page.ocularVisits ?? []),
      pagination: {
        nextCursor: null,
        hasMore: false,
        totalCount: first.pagination.totalCount,
      },
    };
  },

  loadActionCenter(): Promise<PrismClientActionCenter> {
    return clientApi.clientWorkspace.actionCenter();
  },

  submitOcularVisit(
    eventId: string,
    input: SubmitClientOcularVisitInput,
  ): Promise<PrismClientOcularVisit> {
    return clientApiRequest<PrismClientOcularVisit>(
      `/events/${eventId}/ocular-visit`,
      { method: "POST", body: input },
    );
  },

  createInquiry(input: CreatePrismInquiryInput) {
    return clientApi.inquiries.create(input);
  },

  createFloorPlanPreference(
    eventId: string,
    input: FloorPlanPreferenceInput,
  ): Promise<PrismFloorPlanDraft> {
    return clientApiRequest<PrismFloorPlanDraft>(
      `/events/${eventId}/floorplan-preferences`,
      { method: "POST", body: input },
    );
  },

  async loadFloorPlanSnapshot(
    eventId: string,
    draftId: string,
    type: "submitted" | "approved" = "approved",
  ): Promise<Project> {
    const plan = await clientApiRequest<ApiFloorPlanSnapshot>(
      `/events/${eventId}/floorplans/${draftId}/snapshot?type=${type}`,
    );
    return toProject(plan);
  },

  submitFloorPlanRevisionComment(
    eventId: string,
    draftId: string,
    input: CreateFloorPlanRevisionCommentInput,
  ): Promise<PrismFloorPlanDraft> {
    return clientApi.events.reviewFloorPlanDraft(eventId, draftId, input);
  },

  async loadPlan(planId: string): Promise<Project> {
    const plan = await clientApiRequest<ApiFloorPlanSnapshot>(`/plans/${planId}`);
    return toProject(plan);
  },

  async savePlan(project: Project): Promise<Project> {
    const plan = await clientApiRequest<ApiFloorPlanSnapshot>(
      `/plans/${project.id}`,
      {
        method: "PUT",
        body: {
          venue: project.venue,
          width: Math.max(1, Math.round(project.widthM)),
          height: Math.max(1, Math.round(project.heightM)),
          gridSize: 1,
          pax: Math.max(0, Math.round(project.pax)),
          objects: project.objects,
          guests: project.guests,
          suppliers: project.suppliers,
          seats: [],
          seatCategories: [],
        },
      },
    );
    return toProject(plan);
  },
};
