"use client";

import { createContext, useContext, type Dispatch, type FormEvent, type ReactNode, type SetStateAction } from "react";
import type { PrismBillingStatement, PrismBriefing, PrismClientActionCenter, PrismClientWorkspace, PrismDocument, PrismEvent, PrismFloorPlanDraft, PrismPaymentMilestone, PrismAuditLog, PrismNotificationLog } from "@prism/types";
import type { FloorPlanTemplate, Project } from "@/features/floorplan/editor";
import type { ClientDashboardRoute, ClientPortalView, ClientSession, DetailTab } from "./model/client-dashboard-types";
import type { ClientDashboardAction } from "./model/client-dashboard-view-rules";

export type PreferenceForm = {
  name: string;
  seatingStyle: string;
  stagePreference: string;
  flowNotes: string;
  guestCount: number;
  constraints: string;
  notes: string;
};

export type ClientRequestForm = {
  eventName: string;
  eventDate: string;
  eventType: string;
  clientType: string;
  venueCity: string;
  budgetRange: string;
  message: string;
};

/** Minimal router surface used by client dashboard pages */
export type ClientWorkspaceRouter = {
  push: (href: string) => void;
  prefetch: (href: string) => void;
  replace: (href: string) => void;
};

export type ClientWorkspaceValue = {
  router: ClientWorkspaceRouter;
  route: ClientDashboardRoute;
  portalView?: ClientPortalView;
  session: ClientSession;
  state: PrismClientWorkspace | null;
  actionCenter: PrismClientActionCenter | null;
  error: string | null;
  notice: string | null;
  busy: string | null;
  setError: (v: string | null) => void;
  setNotice: (v: string | null) => void;
  setBusy: (v: string | null) => void;
  refresh: () => Promise<void>;
  events: PrismEvent[];
  selectedEvent: PrismEvent | undefined;
  selectedEventId: string | null;
  setSelectedEventId: (id: string | null) => void;
  eventDrafts: PrismFloorPlanDraft[];
  officialDraft: PrismFloorPlanDraft | undefined;
  preferenceDrafts: PrismFloorPlanDraft[];
  audit: PrismAuditLog[];
  billing: PrismBillingStatement | undefined;
  briefing: PrismBriefing | undefined;
  documents: PrismDocument[];
  payments: PrismPaymentMilestone[];
  clientActions: ClientDashboardAction[];
  nextAction: ClientDashboardAction | undefined;
  form: PreferenceForm;
  setForm: Dispatch<SetStateAction<PreferenceForm>>;
  requestForm: ClientRequestForm;
  setRequestForm: Dispatch<SetStateAction<ClientRequestForm>>;
  eventSearch: string;
  setEventSearch: (v: string) => void;
  officialProject: Project | null;
  floorPlanTemplates: FloorPlanTemplate[];
  notifications: PrismNotificationLog[];
  navigateToEventRoute: (next: DetailTab | ClientDashboardRoute, nextEventId?: string) => void;
  runClientAction: (action: ClientDashboardAction) => void;
  openFloorplanEditor: (draft: PrismFloorPlanDraft, readOnly?: boolean) => Promise<void>;
  createEditorDraft: (template: FloorPlanTemplate) => Promise<void>;
  submitPreference: (ev: FormEvent<HTMLFormElement>) => Promise<void>;
  submitNewEventRequest: (ev: FormEvent<HTMLFormElement>) => Promise<void>;
  signOut: () => void;
  /** Event-scoped chrome (header + subnav) when an event is selected */
  eventHeader: ReactNode;
  isEventScopedView: boolean;
};

const ClientWorkspaceContext = createContext<ClientWorkspaceValue | null>(null);

export function ClientWorkspaceProvider({
  value,
  children,
}: {
  value: ClientWorkspaceValue;
  children: ReactNode;
}) {
  return (
    <ClientWorkspaceContext.Provider value={value}>{children}</ClientWorkspaceContext.Provider>
  );
}

export function useClientWorkspace(): ClientWorkspaceValue {
  const ctx = useContext(ClientWorkspaceContext);
  if (!ctx) {
    throw new Error("useClientWorkspace must be used within ClientWorkspaceProvider");
  }
  return ctx;
}
