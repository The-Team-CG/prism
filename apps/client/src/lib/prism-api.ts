import { createInitialPrismSampleState } from "@/mock/prism-sample-state";
import type { Project } from "@/features/floorplan/editor";
import { createEventOpsClient } from "@prism/api-client";
import {
  PRISM_SAMPLE_STATE_STORAGE_KEY,
  PRISM_SESSION_STORAGE_KEYS,
  isPrismAuthenticatedSession,
  parseContract,
  reviewEventProposalSchema,
  type CreatePrismInquiryInput,
  type ReviewEventProposalInput,
} from "@prism/types";

import type {
  SampleRole,
  PrismApprovalRequest,
  PrismAuditLog,
  PrismBillingStatement,
  PrismBriefing,
  PrismComplianceCheck,
  PrismCoordinatorAssignment,
  PrismClientActionCenter,
  PrismClientActionItem,
  PrismClientWorkspace,
  PrismSampleState,
  PrismDocument,
  PrismEvent,
  PrismFileRequirementsMatrix,
  PrismFloorPlanDraft,
  PrismFloorPlanPreference,
  PrismFloorPlanSnapshot,
  PrismInquiry,
  PrismNotificationLog,
  PrismPaymentMilestone,
  PrismPostEventDocument,
  PrismSupplierQuote,
  PrismUser,
  PrismAuthenticatedSession,
  PrivacyConsentInput,
} from "@prism/types";

export type {
  SampleRole,
  PrismApprovalRequest,
  PrismAuditLog,
  PrismBillingStatement,
  PrismBriefing,
  PrismComplianceCheck,
  PrismCoordinatorAssignment,
  PrismClientActionCenter,
  PrismClientActionItem,
  PrismClientWorkspace,
  PrismSampleState,
  PrismDocument,
  PrismEvent,
  PrismFileRequirementsMatrix,
  PrismFloorPlanDraft,
  PrismFloorPlanPreference,
  PrismFloorPlanSnapshot,
  PrismInquiry,
  PrismNotificationLog,
  PrismPaymentMilestone,
  PrismPostEventDocument,
  PrismSupplierQuote,
  PrismUser,
  PrismAuthenticatedSession,
  PrivacyConsentInput,
};

/** Shared inquiry write DTO — owned by `@prism/types` (Zod). */
export type { CreatePrismInquiryInput };

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const USE_REMOTE_API = process.env.NEXT_PUBLIC_Prism_API_MODE !== "local";
const STORAGE_KEY = PRISM_SAMPLE_STATE_STORAGE_KEY;
function storedClientAccessToken() {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(PRISM_SESSION_STORAGE_KEYS.client);
  if (!raw) return null;
  try {
    const session = JSON.parse(raw) as unknown;
    return isPrismAuthenticatedSession(session) ? session.accessToken : null;
  } catch {
    return null;
  }
}

const eventOpsClient = createEventOpsClient({ baseUrl: `${API_URL}/api`, getAuthToken: storedClientAccessToken });
const defaultInquiryInput: CreatePrismInquiryInput = {
  clientName: "Maria Santos",
  companyName: "SampleCorp",
  email: "maria@samplecorp.test",
  eventName: "SampleCorp Leadership Forum",
  eventType: "Leadership Forum",
  eventDate: "2026-06-18",
  clientType: "Corporate",
  source: "P.R.I.S.M Website",
  message: "Need end-to-end planning, registration, staging, and post-event documentation.",
  privacyConsentAccepted: true,
  privacyNoticeVersion: "2026-05-01",
  marketingConsentAccepted: false,
};

function now() {
  return new Date().toISOString();
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function readMockState() {
  if (typeof window === "undefined") return createInitialPrismSampleState();

  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    const initial = createInitialPrismSampleState();
    writeMockState(initial);
    return initial;
  }

  const parsed = JSON.parse(stored) as PrismSampleState;
  parsed.floorPlanDrafts ??= [];
  parsed.supplierQuoteRequests ??= [];
  parsed.coordinators ??= [];
  parsed.coordinatorRoleRequirements ??= [];
  parsed.coordinatorAssignments ??= [];
  parsed.complianceRules ??= [];
  parsed.billingSources ??= [];
  parsed.paymentRecords ??= [];
  parsed.eventInsights ??= [];
  parsed.supplierCategories ??= [];
  parsed.suppliers ??= [];
  parsed.events = parsed.events.map((event) => ({
    ...event,
    floorPlanStatus: event.floorPlanStatus ?? "not_started",
    floorPlanId: event.floorPlanId ?? null,
  }));
  return parsed;
}

function writeMockState(state: PrismSampleState) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }
  return clone(state);
}

function addAudit(state: PrismSampleState, eventId: string | undefined, actor: string, action: string) {
  state.auditLogs.unshift({
    id: `aud_${crypto.randomUUID()}`,
    eventId,
    actor,
    actorRole: actor,
    actorEmail: undefined,
    action,
    actionType: "sample_action",
    category: "client_portal",
    ipAddress: "local-sample",
    device: "browser",
    severity: "info",
    immutableHash: `local_${crypto.randomUUID()}`,
    createdAt: now(),
  });
}

function addNotification(state: PrismSampleState, eventId: string | undefined, recipient: string, message: string, channel: "email" | "viber" = "email") {
  state.notificationLogs.unshift({
    id: `not_${crypto.randomUUID()}`,
    eventId,
    channel,
    recipient,
    message,
    status: "sent",
    attempts: 1,
    correlationId: null,
    failureReason: null,
    sentAt: now(),
    failedAt: null,
    acknowledgedAt: null,
    createdAt: now(),
  });
}

function updateMockState<T>(mutate: (state: PrismSampleState) => T): T {
  const state = readMockState();
  const result = mutate(state);
  writeMockState(state);
  return clone(result);
}

function firstEvent(state: PrismSampleState) {
  const event = state.events[0];
  if (!event) throw new Error("No sample event found");
  return event;
}

function firstInquiry(state: PrismSampleState) {
  const inquiry = state.inquiries[0];
  if (!inquiry) throw new Error("No sample inquiry found");
  return inquiry;
}

interface ApiFloorPlan {
  id: string;
  name: string;
  venue: string;
  width: number;
  height: number;
  gridSize: number;
  pax: number;
  objects?: Project["objects"];
  guests?: Project["guests"];
  suppliers?: Project["suppliers"];
  updatedAt?: string;
}

type CreateFloorPlanDraftInput = {
  name: string;
  sourceType: "blank" | "template" | "client_preference";
  venue?: string;
  width?: number;
  height?: number;
  gridSize?: number;
  pax?: number;
  objects?: Project["objects"];
  guests?: Project["guests"];
  suppliers?: Project["suppliers"];
};

function defaultProjectFromDraft(draft: PrismFloorPlanDraft, event?: PrismEvent): Project {
  const nowTs = Date.now();
  return {
    id: draft.floorPlanId,
    name: draft.name,
    venue: event?.eventName ?? "Event venue",
    widthM: 30,
    heightM: 20,
    pax: 120,
    objects: [],
    guests: [],
    suppliers: [],
    createdAt: nowTs,
    updatedAt: nowTs,
  };
}

function apiPlanToProject(plan: ApiFloorPlan): Project {
  const updatedAt = plan.updatedAt ? new Date(plan.updatedAt).getTime() : Date.now();
  return {
    id: plan.id,
    name: plan.name,
    venue: plan.venue,
    widthM: plan.width,
    heightM: plan.height,
    pax: plan.pax,
    objects: Array.isArray(plan.objects) ? plan.objects : [],
    guests: Array.isArray(plan.guests) ? plan.guests : [],
    suppliers: Array.isArray(plan.suppliers) ? plan.suppliers : [],
    createdAt: updatedAt,
    updatedAt,
  };
}

function ensureLocalEventForConforme(state: PrismSampleState, inquiryId: string) {
  const existing = state.events.find((item) => item.inquiryId === inquiryId);
  if (existing) return existing;

  const inquiry = state.inquiries.find((item) => item.id === inquiryId) ?? firstInquiry(state);
  const event: PrismEvent = {
    id: `evt_${crypto.randomUUID()}`,
    inquiryId: inquiry.id,
    clientName: inquiry.clientName,
    eventName: inquiry.eventName,
    eventDate: inquiry.eventDate,
    status: "briefing",
    clientPortalStatus: "unlocked",
    readiness: "Client briefing open",
    archived: false,
    floorPlanStatus: "not_started",
    floorPlanId: null,
  };
  state.events.unshift(event);
  state.postEventDocuments.push(
    { id: `ped_${crypto.randomUUID()}`, eventId: event.id, title: "Completion report", status: "pending" },
    { id: `ped_${crypto.randomUUID()}`, eventId: event.id, title: "Photo and video turnover", status: "pending" },
  );
  return event;
}

const API_OFFLINE_MESSAGE = "P.R.I.S.M API is offline. Start `prism-api` on port 4000, then try again.";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const accessToken = storedClientAccessToken();
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...init?.headers,
      },
    });
  } catch (err) {
    if (err instanceof TypeError) throw new Error(API_OFFLINE_MESSAGE);
    throw err;
  }

  if (!response.ok) {
    const text = await response.text();
    let message = text;
    try {
      const body = JSON.parse(text) as { message?: string | string[] };
      message = Array.isArray(body.message) ? body.message.join("; ") : body.message || text;
    } catch {
      message = text;
    }
    throw new Error(message || `Request failed: ${response.status}`);
  }

  const body = (await response.json()) as { data?: T };
  return body.data as T;
}

function clientActorQuery(session: Pick<PrismUser, "name" | "email">) {
  return new URLSearchParams({
    actorRole: "client",
    actorName: session.name,
    actorEmail: session.email,
    clientName: session.name,
  }).toString();
}

function withClientActor(path: string, session?: Pick<PrismUser, "name" | "email">) {
  const actor = clientActorQuery(session ?? { name: "Ana Reyes", email: "ana@ayala.test" });
  return `${path}${path.includes("?") ? "&" : "?"}${actor}`;
}

function localClientActionCenter(session: Pick<PrismUser, "name" | "email">): PrismClientActionCenter {
  const state = readMockState();
  const events = state.events.filter(
    (event) => event.clientName === session.name && event.clientPortalStatus === "unlocked" && !event.archived,
  );
  const items: PrismClientActionItem[] = [];

  for (const event of events) {
    const briefing = state.briefings.find((item) => item.eventId === event.id);
    if (!briefing) {
      items.push({
        id: `briefing:${event.id}`,
        kind: "briefing",
        priority: "attention",
        label: "Complete event briefing",
        description: `Share venue, guest count, budget, and service requirements for ${event.eventName}.`,
        status: "missing",
        eventId: event.id,
        eventName: event.eventName,
        dueAt: event.eventDate,
        href: `/dashboard/events/${event.id}/briefing`,
      });
    }

    if (event.floorPlanStatus === "in_review") {
      items.push({
        id: `floorplan:review:${event.id}`,
        kind: "floorplan",
        priority: "attention",
        label: "Review official floorplan",
        description: `PMCM submitted the official layout for ${event.eventName}.`,
        status: event.floorPlanStatus,
        eventId: event.id,
        eventName: event.eventName,
        href: `/dashboard/events/${event.id}/floorplan`,
      });
    } else if (event.floorPlanStatus === "not_started") {
      items.push({
        id: `floorplan:preferences:${event.id}`,
        kind: "floorplan",
        priority: "info",
        label: "Submit layout preferences",
        description: `Share layout requirements before PMCM prepares the official floorplan for ${event.eventName}.`,
        status: event.floorPlanStatus,
        eventId: event.id,
        eventName: event.eventName,
        href: `/dashboard/events/${event.id}/floorplan`,
      });
    }

    state.paymentMilestones
      .filter((payment) => payment.eventId === event.id && payment.status !== "paid")
      .forEach((payment) => {
        items.push({
          id: `billing:${payment.id}`,
          kind: "billing",
          priority: new Date(payment.dueDate).getTime() < Date.now() ? "critical" : "warning",
          label: new Date(payment.dueDate).getTime() < Date.now() ? "Payment overdue" : "Payment pending",
          description: `${payment.label} has ${payment.amount.toLocaleString("en-PH")} PHP remaining.`,
          status: payment.status,
          eventId: event.id,
          eventName: event.eventName,
          dueAt: payment.dueDate,
          href: `/dashboard/events/${event.id}/billing`,
        });
      });

    state.documents
      .filter((document) => document.eventId === event.id && /needs|pending|requested|rejected/i.test(document.status))
      .forEach((document) => {
        items.push({
          id: `document:${document.id}`,
          kind: "document",
          priority: document.status === "rejected" ? "warning" : "attention",
          label: "Document needs attention",
          description: `${document.fileName} is ${document.status.replaceAll("_", " ")}.`,
          status: document.status,
          eventId: event.id,
          eventName: event.eventName,
          href: `/dashboard/events/${event.id}/documents`,
        });
      });
  }

  const severityOrder = { critical: 0, warning: 1, attention: 2, info: 3 };
  items.sort((left, right) => severityOrder[left.priority] - severityOrder[right.priority]);

  return {
    generatedAt: now(),
    counts: {
      critical: items.filter((item) => item.priority === "critical").length,
      warning: items.filter((item) => item.priority === "warning").length,
      attention: items.filter((item) => item.priority === "attention").length,
      info: items.filter((item) => item.priority === "info").length,
    },
    items,
  };
}

export const prismApi = {
  clientState: async (session: Pick<PrismUser, "name" | "email">): Promise<PrismClientWorkspace> => {
    if (!USE_REMOTE_API) return readMockState();

    return eventOpsClient.clientWorkspace.detail({
      actorRole: "client",
      actorName: session.name,
      actorEmail: session.email,
      clientName: session.name,
    });
  },
  clientActionCenter: async (session: Pick<PrismUser, "name" | "email">): Promise<PrismClientActionCenter> => {
    if (!USE_REMOTE_API) return localClientActionCenter(session);

    return eventOpsClient.clientWorkspace.actionCenter({
      actorRole: "client",
      actorName: session.name,
      actorEmail: session.email,
      clientName: session.name,
    });
  },
  reset: () => {
    if (USE_REMOTE_API) return eventOpsClient.sample.reset();

    const state = createInitialPrismSampleState();
    writeMockState(state);
    return Promise.resolve(state);
  },
  login: (input: { email: string; password: string }) =>
    USE_REMOTE_API
      ? request<PrismAuthenticatedSession>("/api/auth/login", {
          method: "POST",
          body: JSON.stringify(input),
        })
      : Promise.resolve(updateMockState((state) => {
        const user = state.users.find(
          (candidate) => {
            const candidateWithPassword = candidate as PrismUser & { password?: string };
            return (
              candidate.email.toLowerCase() === input.email.trim().toLowerCase() &&
              (candidateWithPassword.password
                ? candidateWithPassword.password === input.password
                : input.password.length > 0)
            );
          },
        );
        if (!user) throw new Error("Invalid mock credentials");
        if (user.approvalStatus !== "approved") throw new Error("This account is waiting for admin approval");
        return { ...user, signedInAt: now() };
      })),
  requestApproval: (email: string, consent: PrivacyConsentInput = { privacyConsentAccepted: true, privacyNoticeVersion: "2026-05-01" }) =>
    USE_REMOTE_API
      ? request<PrismApprovalRequest>("/api/auth/approval-requests", {
          method: "POST",
          body: JSON.stringify({ email, ...consent }),
        })
      : Promise.resolve(updateMockState((state) => {
          if (!consent.privacyConsentAccepted) throw new Error("Privacy consent is required before requesting approval");
          const user = state.users.find((candidate) => candidate.email.toLowerCase() === email.trim().toLowerCase());
          if (!user) throw new Error("User not found");
          return {
            id: `approval_${user.id}`,
            userId: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            organization: user.organization,
            status: "pending",
            privacyConsentAccepted: consent.privacyConsentAccepted,
            privacyNoticeVersion: consent.privacyNoticeVersion ?? "2026-05-01",
            marketingConsentAccepted: consent.marketingConsentAccepted ?? false,
            requestedAt: now(),
          };
        })),
  createInquiry: (input: CreatePrismInquiryInput = defaultInquiryInput) =>
    USE_REMOTE_API
      ? eventOpsClient.inquiries.create(input)
      : Promise.resolve(updateMockState((state) => {
        if (!input.privacyConsentAccepted) throw new Error("Privacy consent is required before submitting an inquiry");
        const inquiry: PrismInquiry = {
          id: `inq_${crypto.randomUUID()}`,
          ...input,
          companyName: input.companyName ?? "",
          eventType: input.eventType ?? input.clientType,
          source: input.source ?? "Website",
          status: "new",
          createdAt: now(),
        };
        state.inquiries.unshift(inquiry);
        addAudit(state, undefined, "PMCM Admin", "Created new inquiry");
        addNotification(state, undefined, inquiry.email, "Inquiry received");
        return inquiry;
      })),
  acceptInquiry: (inquiryId: string) =>
    USE_REMOTE_API
      ? request<PrismInquiry>(`/api/inquiries/${inquiryId}/status`, {
          method: "PATCH",
          body: JSON.stringify({ status: "accepted" }),
        })
      : Promise.resolve(updateMockState((state) => {
        const inquiry = state.inquiries.find((item) => item.id === inquiryId) ?? firstInquiry(state);
        inquiry.status = "accepted";
        inquiry.acceptedAt = now();
        inquiry.conformeSentAt = inquiry.acceptedAt;
        addAudit(state, undefined, "PMCM Admin", "Accepted inquiry; awaiting signed conforme");
        addNotification(state, undefined, inquiry.email, "Inquiry accepted; signed conforme required");
        return inquiry;
      })),
  uploadConforme: (inquiryId: string) =>
    USE_REMOTE_API
      ? request<PrismDocument>(`/api/inquiries/${inquiryId}/conforme`, {
          method: "POST",
          body: JSON.stringify({ type: "signed_conforme", fileName: "signed-conforme.pdf" }),
        })
      : Promise.resolve(updateMockState((state) => {
        const event = ensureLocalEventForConforme(state, inquiryId);
        event.clientPortalStatus = "unlocked";
        event.readiness = "Client briefing open";
        event.status = "briefing";
        const inquiry = state.inquiries.find((item) => item.id === inquiryId);
        if (inquiry) {
          inquiry.conformeSignedAt = now();
          inquiry.portalActivatedAt = inquiry.conformeSignedAt;
          inquiry.portalInvitationStatus = "sent";
        }
        const document: PrismDocument = {
          id: `doc_${crypto.randomUUID()}`,
          eventId: event.id,
          type: "signed_conforme",
          fileName: "signed-conforme.pdf",
          status: "approved",
          uploadedAt: now(),
        };
        state.documents.unshift(document);
        state.billingStatements.unshift({
          id: `bill_${crypto.randomUUID()}`,
          eventId: event.id,
          number: `BS-${String(state.billingStatements.length + 1).padStart(4, "0")}`,
          clientName: event.clientName,
          clientContact: inquiry?.email ?? "",
          eventName: event.eventName,
          eventDate: event.eventDate,
          lineItems: [{ label: "Event services", amount: 520000 }],
          paymentSchedule: [
            { label: "Reservation fee", percentage: 30, amount: 156000, dueDate: "2026-05-01" },
            { label: "Final payment", percentage: 70, amount: 364000, dueDate: "2026-06-10" },
          ],
          paymentMethods: [{ label: "Bank Transfer", details: "PMCM sample account" }],
          totalAmount: 520000,
          pdfUrl: "#",
          storageKey: `billing/${event.id}.pdf`,
          status: "issued",
          generatedAt: now(),
        });
        state.paymentMilestones.push(
          {
            id: `pay_${crypto.randomUUID()}`,
            eventId: event.id,
            label: "Reservation fee",
            percentage: 30,
            amount: 156000,
            amountPaid: 0,
            remainingBalance: 156000,
            dueDate: "2026-05-01",
            status: "pending",
            history: [],
          },
          {
            id: `pay_${crypto.randomUUID()}`,
            eventId: event.id,
            label: "Final payment",
            percentage: 70,
            amount: 364000,
            amountPaid: 0,
            remainingBalance: 364000,
            dueDate: "2026-06-10",
            status: "pending",
            history: [],
          },
        );
        addAudit(state, event.id, "Client", "Uploaded signed conforme");
        addNotification(state, event.id, event.clientName, "Client portal unlocked");
        return document;
      })),
  events: () =>
    USE_REMOTE_API
      ? eventOpsClient.events.list()
      : Promise.resolve(updateMockState((state) =>
        state.events.map((event) => ({
          ...event,
          floorPlanDrafts: state.floorPlanDrafts.filter((draft) => draft.eventId === event.id),
          activeFloorPlanDraftId: state.floorPlanDrafts.find((draft) => draft.eventId === event.id && draft.isActive)?.id,
        })),
      )),
  eventDetail: (eventId: string) =>
    USE_REMOTE_API
      ? eventOpsClient.events.detail(eventId)
      : Promise.resolve(updateMockState((state) => {
        const event = state.events.find((item) => item.id === eventId) ?? firstEvent(state);
        const drafts = state.floorPlanDrafts.filter((draft) => draft.eventId === event.id);
        return {
          ...event,
          floorPlanDrafts: drafts,
          activeFloorPlanDraftId: drafts.find((draft) => draft.isActive)?.id,
        };
      })),
  fileRequirements: (eventId: string, session: Pick<PrismUser, "name" | "email">) =>
    USE_REMOTE_API
      ? eventOpsClient.events.fileRequirements(eventId, {
          actorRole: "client",
          actorName: session.name,
          actorEmail: session.email,
          clientName: session.name,
        })
      : Promise.resolve<PrismFileRequirementsMatrix>({
          eventId,
          items: [],
        }),
  createFloorPlanPreference: (
    eventId: string,
    input: { name: string; venue?: string; width?: number; height?: number; gridSize?: number; objects?: Project["objects"] } & PrismFloorPlanPreference,
    session?: Pick<PrismUser, "name" | "email">,
  ) =>
    USE_REMOTE_API
      ? request<PrismFloorPlanDraft>(withClientActor(`/api/events/${eventId}/floorplan-preferences`, session), {
          method: "POST",
          body: JSON.stringify(input),
        })
      : Promise.resolve(updateMockState((state) => {
        const event = state.events.find((item) => item.id === eventId) ?? firstEvent(state);
        const draft: PrismFloorPlanDraft = {
          id: `fpd_${crypto.randomUUID()}`,
          eventId,
          floorPlanId: `plan_${crypto.randomUUID()}`,
          name: input.name,
          status: "client_submitted",
          isActive: false,
          sourceType: "client_preference",
          createdByRole: "client",
          clientPreference: {
            seatingStyle: input.seatingStyle,
            stagePreference: input.stagePreference,
            flowNotes: input.flowNotes,
            guestCount: input.guestCount,
            constraints: input.constraints,
            notes: input.notes ?? "",
          },
          submittedAt: now(),
          createdAt: now(),
          updatedAt: now(),
        };
        state.floorPlanDrafts.unshift(draft);
        event.floorPlanStatus = "client_submitted";
        event.readiness = "Client layout preference received";
        addAudit(state, eventId, "Client", `Submitted layout preference: ${input.name}`);
        addNotification(state, eventId, "PMCM Admin", `Client submitted a layout preference: ${input.name}`);
        return draft;
      })),
  createFloorPlanDraft: (eventId: string, input: CreateFloorPlanDraftInput) =>
    USE_REMOTE_API
      ? request<PrismFloorPlanDraft>(`/api/events/${eventId}/floorplans`, {
          method: "POST",
          body: JSON.stringify(input),
        })
      : Promise.resolve(updateMockState((state) => {
        const event = state.events.find((item) => item.id === eventId) ?? firstEvent(state);
        const draft: PrismFloorPlanDraft = {
          id: `fpd_${crypto.randomUUID()}`,
          eventId,
          floorPlanId: `plan_${crypto.randomUUID()}`,
          name: input.name,
          status: "pmcm_draft",
          isActive: false,
          sourceType: input.sourceType,
          createdByRole: "pmcm-admin",
          createdAt: now(),
          updatedAt: now(),
        };
        state.floorPlanDrafts.unshift(draft);
        event.floorPlanStatus = event.floorPlanStatus === "approved" ? "approved" : "pmcm_draft";
        event.readiness = event.floorPlanStatus === "approved" ? event.readiness : "Floorplan draft in progress";
        addAudit(state, eventId, "PMCM Admin", `Created floorplan draft: ${input.name}`);
        return draft;
      })),
  submitFloorPlanDraft: (eventId: string, draftId: string) =>
    USE_REMOTE_API
      ? request<PrismFloorPlanDraft>(`/api/events/${eventId}/floorplans/${draftId}/submit`, { method: "POST" })
      : Promise.resolve(updateMockState((state) => {
        const event = state.events.find((item) => item.id === eventId) ?? firstEvent(state);
        const draft = state.floorPlanDrafts.find((item) => item.id === draftId && item.eventId === eventId);
        if (!draft) throw new Error("Floorplan draft not found");
        draft.status = "in_review";
        draft.submittedAt = draft.submittedAt ?? now();
        draft.updatedAt = now();
        event.floorPlanStatus = "in_review";
        event.floorPlanId = draft.floorPlanId;
        event.readiness = "Floorplan awaiting review";
        addAudit(state, eventId, "PMCM Admin", `Submitted floorplan draft for review: ${draft.name}`);
        return draft;
      })),
  approveFloorPlanDraft: (eventId: string, draftId: string) =>
    USE_REMOTE_API
      ? request<PrismFloorPlanDraft>(`/api/events/${eventId}/floorplans/${draftId}/approve`, { method: "POST" })
      : Promise.resolve(updateMockState((state) => {
        const event = state.events.find((item) => item.id === eventId) ?? firstEvent(state);
        const draft = state.floorPlanDrafts.find((item) => item.id === draftId && item.eventId === eventId);
        if (!draft) throw new Error("Floorplan draft not found");
        state.floorPlanDrafts.forEach((item) => {
          if (item.eventId === eventId) item.isActive = false;
        });
        draft.status = "approved";
        draft.isActive = true;
        draft.submittedAt = draft.submittedAt ?? now();
        draft.reviewedAt = now();
        draft.approvedAt = now();
        draft.updatedAt = now();
        event.floorPlanStatus = "approved";
        event.floorPlanId = draft.floorPlanId;
        event.activeFloorPlanDraftId = draft.id;
        event.readiness = "Floorplan approved";
        addAudit(state, eventId, "PMCM Admin", `Approved floorplan draft: ${draft.name}`);
        return draft;
      })),
  loadFloorPlanSnapshot: (eventId: string, draftId: string, type: "submitted" | "approved" = "approved", session?: Pick<PrismUser, "name" | "email">) =>
    USE_REMOTE_API
      ? request<ApiFloorPlan>(withClientActor(`/api/events/${eventId}/floorplans/${draftId}/snapshot?type=${type}`, session)).then((plan) => apiPlanToProject(plan))
      : Promise.reject(new Error(API_OFFLINE_MESSAGE)),
  loadPlan: (planId: string, session?: Pick<PrismUser, "name" | "email">) =>
    USE_REMOTE_API
      ? request<ApiFloorPlan>(withClientActor(`/api/plans/${planId}`, session)).then((plan) => apiPlanToProject(plan))
      : Promise.reject(new Error(API_OFFLINE_MESSAGE)),
  savePlan: (project: Project, session?: Pick<PrismUser, "name" | "email">) =>
    USE_REMOTE_API
      ? request<ApiFloorPlan>(withClientActor(`/api/plans/${project.id}`, session), {
          method: "PUT",
          body: JSON.stringify({
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
          }),
        }).then((plan) => apiPlanToProject(plan))
      : Promise.reject(new Error(API_OFFLINE_MESSAGE)),
  submitBriefing: (eventId: string) =>
    USE_REMOTE_API
      ? request<PrismBriefing>(`/api/events/${eventId}/briefing`, {
          method: "POST",
          body: JSON.stringify({
            venue: "Shangri-La Grand Ballroom",
            guestCount: 240,
            budgetRange: "PHP 450,000 - 520,000",
            serviceRequirements: ["Digital Registration", "Stage and Technicals", "Documentation"],
            notes: "Client prefers a polished technology summit setup with clear ingress flow.",
          }),
        })
      : Promise.resolve(updateMockState((state) => {
        const event = state.events.find((item) => item.id === eventId) ?? firstEvent(state);
        event.readiness = "Supplier quotes pending";
        const briefing: PrismBriefing = {
          eventId,
          venue: "Shangri-La Grand Ballroom",
          guestCount: 240,
          budgetRange: "PHP 450,000 - 520,000",
          serviceRequirements: ["Digital Registration", "Stage and Technicals", "Documentation"],
          notes: "Client prefers a polished technology summit setup with clear ingress flow.",
          submittedAt: now(),
        };
        state.briefings = state.briefings.filter((item) => item.eventId !== eventId);
        state.briefings.unshift(briefing);
        addAudit(state, event.id, "Client", "Submitted client briefing");
        addNotification(state, event.id, "PMCM Admin", "Client briefing submitted");
        return briefing;
      })),
  addSupplierQuote: (eventId: string) =>
    USE_REMOTE_API
      ? request<PrismSupplierQuote>(`/api/events/${eventId}/supplier-quotes`, {
          method: "POST",
          body: JSON.stringify({
            supplierName: "BrightStage Technicals",
            category: "Technicals",
            amount: 165000,
            status: "received",
          }),
        })
      : Promise.resolve(updateMockState((state) => {
        const quote: PrismSupplierQuote = {
          id: `quote_${crypto.randomUUID()}`,
          eventId,
          supplierName: "BrightStage Technicals",
          category: "Technicals",
          amount: 165000,
          inclusions: ["Stage lights", "Audio system", "Technical crew"],
          paymentTerms: "50% reservation, 50% before ingress",
          notes: "Local sample quote",
          outsideAcceptableRange: false,
          status: "received",
          createdAt: now(),
        };
        state.supplierQuotes.unshift(quote);
        addAudit(state, eventId, "Supplier", "Submitted supplier quote");
        addNotification(state, eventId, "PMCM Admin", "Supplier quote received");
        return quote;
      })),
  runCompliance: (eventId: string) =>
    USE_REMOTE_API
      ? request<PrismComplianceCheck[]>(`/api/events/${eventId}/compliance`, { method: "POST" })
      : Promise.resolve(updateMockState((state) => {
        const existing = state.complianceChecks.filter((item) => item.eventId !== eventId);
        const checks: PrismComplianceCheck[] = [
          {
            id: `chk_${crypto.randomUUID()}`,
            eventId,
            layer: "Must-Fix",
            title: "Supplier contract confirmation",
            status: "open",
            note: "Attach final signed supplier quotation before event lock.",
          },
          {
            id: `chk_${crypto.randomUUID()}`,
            eventId,
            layer: "Should-Fix",
            title: "Ingress timing alignment",
            status: "open",
            note: "Confirm guest arrival window with registration vendor.",
          },
        ];
        state.complianceChecks = [...checks, ...existing];
        addAudit(state, eventId, "PMCM Admin", "Ran compliance checks");
        return checks;
      })),
  resolveCompliance: (eventId: string, checkId: string) =>
    USE_REMOTE_API
      ? request<PrismComplianceCheck>(`/api/events/${eventId}/compliance/${checkId}`, {
          method: "PATCH",
          body: JSON.stringify({ resolved: true, note: "Supplier contract confirmation attached." }),
        })
      : Promise.resolve(updateMockState((state) => {
        const check = state.complianceChecks.find((item) => item.id === checkId);
        if (!check) throw new Error("Compliance check not found");
        check.status = "resolved";
        check.note = "Supplier contract confirmation attached.";
        addAudit(state, eventId, "PMCM Admin", "Resolved compliance item");
        return check;
      })),
  assignCoordinator: (eventId: string) =>
    USE_REMOTE_API
      ? request<PrismCoordinatorAssignment>(`/api/events/${eventId}/coordinators`, {
          method: "POST",
          body: JSON.stringify({ coordinatorName: "Marco Santos", role: "Floor Director" }),
        })
      : Promise.resolve(updateMockState((state) => {
        const assignment: PrismCoordinatorAssignment = {
          id: `coord_${crypto.randomUUID()}`,
          eventId,
          coordinatorName: "Marco Santos",
          role: "Floor Director",
          status: "pending_acknowledgement",
          doubleBookingWarning: state.coordinatorAssignments.some((item) => item.coordinatorName === "Marco Santos" && item.status !== "acknowledged"),
        };
        state.coordinatorAssignments.unshift(assignment);
        addAudit(state, eventId, "PMCM Admin", "Assigned coordinator");
        addNotification(state, eventId, assignment.coordinatorName, "Coordinator assignment issued", "viber");
        return assignment;
      })),
  acknowledgeCoordinator: (eventId: string, assignmentId: string) =>
    USE_REMOTE_API
      ? request<PrismCoordinatorAssignment>(`/api/events/${eventId}/coordinators/${assignmentId}/acknowledge`, {
          method: "PATCH",
        })
      : Promise.resolve(updateMockState((state) => {
        const assignment = state.coordinatorAssignments.find((item) => item.id === assignmentId);
        if (!assignment) throw new Error("Coordinator assignment not found");
        assignment.status = "acknowledged";
        addAudit(state, eventId, assignment.coordinatorName, "Acknowledged coordinator assignment");
        return assignment;
      })),
  markPaymentReceived: (eventId: string, milestoneId: string) =>
    USE_REMOTE_API
      ? request<PrismPaymentMilestone>(`/api/events/${eventId}/payments/${milestoneId}`, {
          method: "PATCH",
          body: JSON.stringify({ status: "paid" }),
        })
      : Promise.resolve(updateMockState((state) => {
        const payment = state.paymentMilestones.find((item) => item.id === milestoneId);
        if (!payment) throw new Error("Payment milestone not found");
        payment.status = "paid";
        addAudit(state, eventId, "PMCM Admin", `Marked ${payment.label} as paid`);
        addNotification(state, eventId, "Finance", `${payment.label} received`);
        return payment;
      })),
  completePostEventDocument: (eventId: string, documentId: string) =>
    USE_REMOTE_API
      ? request<PrismPostEventDocument>(`/api/events/${eventId}/post-event-documents/${documentId}/complete`, {
          method: "PATCH",
        })
      : Promise.resolve(updateMockState((state) => {
        const document = state.postEventDocuments.find((item) => item.id === documentId);
        if (!document) throw new Error("Post-event document not found");
        document.status = "submitted";
        addAudit(state, eventId, "PMCM Admin", `Completed ${document.title}`);
        return document;
      })),
  archiveEvent: (eventId: string) =>
    USE_REMOTE_API
      ? request<PrismEvent>(`/api/events/${eventId}/archive`, { method: "POST" })
      : Promise.resolve(updateMockState((state) => {
        const event = state.events.find((item) => item.id === eventId) ?? firstEvent(state);
        event.archived = true;
        event.status = "archived";
        event.readiness = "Closed";
        addAudit(state, eventId, "PMCM Admin", "Archived event");
        addNotification(state, eventId, event.clientName, "Event workspace archived");
        return event;
      })),
  reviewEventProposal: (eventId: string, input: ReviewEventProposalInput) => {
    const parsed = parseContract(reviewEventProposalSchema, input, "Proposal review");
    if (USE_REMOTE_API) {
      return eventOpsClient.events.reviewProposal(eventId, parsed);
    }
    return Promise.resolve(
      updateMockState((state) => {
        const event = state.events.find((item) => item.id === eventId) ?? firstEvent(state);
        if ((event.proposalClientStatus ?? "pending") === "approved") {
          throw new Error("Proposal is already approved");
        }
        if (parsed.action === "approve") {
          event.proposalClientStatus = "approved";
        } else {
          const count = event.proposalRevisionCount ?? 0;
          if (count >= 3) throw new Error("Proposal revision cap of 3 has been reached");
          event.proposalClientStatus = "revision_requested";
          event.proposalRevisionCount = count + 1;
        }
        event.proposalReviewedAt = now();
        event.proposalReviewedBy = "Ana Reyes";
        return event;
      }),
    );
  },
  communicationThreads: (eventId: string) => eventOpsClient.communication.listThreads(eventId),
  sendCommunicationMessage: (threadId: string, body: string, idempotencyKey: string) => eventOpsClient.communication.sendMessage(threadId, { body, idempotencyKey }),
};
