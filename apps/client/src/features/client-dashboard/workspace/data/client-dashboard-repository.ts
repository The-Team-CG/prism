import {
  PRISM_SESSION_STORAGE_KEYS,
  clearPrismSession,
  readPrismSession,
  type PrismClientActionCenter,
  type PrismClientWorkspace,
  type PrismFloorPlanDraft,
  type PrismFloorPlanSnapshot,
  type CreatePrismInquiryInput,
  type CreateFloorPlanPreferenceInput,
  type PrismClientOcularVisit,
  type SubmitClientOcularVisitInput,
  type SubmitBriefingInput,
  type PrismBriefing,
} from "@prism/types";
import { layoutFromSnapshot, type ClientPlanLayout } from "@/features/floorplan/snapshot-project";
import { clientApi, clientApiRequest } from "@/lib/prism-api";
import type { ClientSession } from "../model/client-dashboard-types";

export type FloorPlanPreferenceInput = CreateFloorPlanPreferenceInput;

export const clientDashboardRepository = {
  readSession(): ClientSession | null {
    return readPrismSession<ClientSession>(PRISM_SESSION_STORAGE_KEYS.client);
  },

  clearSession(): void {
    clearPrismSession(PRISM_SESSION_STORAGE_KEYS.client);
  },

  /** A 401 here only means the token is already dead, so it must not start the expiry redirect. */
  logout(): Promise<void> {
    return clientApiRequest<void>("/auth/logout", {
      method: "POST",
      onUnauthorized: () => undefined,
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
      archivedEvents: first.archivedEvents ?? [],
      documents: pages.flatMap((page) => page.documents),
      briefings: pages.flatMap((page) => page.briefings),
      supplierQuotes: pages.flatMap((page) => page.supplierQuotes),
      coordinatorAssignments: pages.flatMap((page) => page.coordinatorAssignments),
      pmcmContacts: pages.flatMap((page) => page.pmcmContacts ?? []),
      complianceChecks: pages.flatMap((page) => page.complianceChecks),
      billingStatements: pages.flatMap((page) => page.billingStatements),
      billingDisputes: pages.flatMap((page) => page.billingDisputes ?? []),
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
    return clientApi.clientPortal.submitOcularVisit(eventId, input);
  },

  submitBriefing(eventId: string, input: SubmitBriefingInput): Promise<PrismBriefing> {
    return clientApi.clientPortal.submitBriefing(eventId, input);
  },

  createInquiry(input: CreatePrismInquiryInput) {
    return clientApi.inquiries.create(input);
  },

  createFloorPlanPreference(
    eventId: string,
    input: FloorPlanPreferenceInput,
  ): Promise<PrismFloorPlanDraft> {
    return clientApi.clientPortal.createFloorplanPreference(eventId, input);
  },

  async loadFloorPlanSnapshot(
    eventId: string,
    draftId: string,
    type: "submitted" | "approved" = "approved",
  ): Promise<ClientPlanLayout> {
    const plan = await clientApi.clientPortal.floorplanSnapshot<PrismFloorPlanSnapshot>(eventId, draftId, type);
    return layoutFromSnapshot(plan);
  }
};
