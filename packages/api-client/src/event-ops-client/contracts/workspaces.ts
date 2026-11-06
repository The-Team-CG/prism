import type {
  ConfirmSupplierReadinessInput,
  CreateRegistrationPlatformInput,
  PrismBillingWorkspace,
  PrismClientActionCenter,
  PrismClientWorkspace,
  PrismDecisionLog,
  PrismDecisionLogQueryInput,
  PrismPmcmCommandInbox,
  PrismPmcmCalendar,
  PrismPmcmCommandInboxQueryInput,
  PrismPmcmEventSummaries,
  PrismPmcmFileSummaries,
  PmcmCalendarQuery,
  PrismPmcmEventWorkspace,
  PrismPmcmReference,
  PrismPmcmSupplierReadinessBoard,
  PrismRegistrationPlatform,
  PrismSupplierQuoteRequest,
  PrismSupplierReadinessBoard,
  PrismSupplierWorkspace,
  ImportHeadcountInput,
  UpdateRegistrationPlatformInput,
  UpdateSupplierEventStatusInput,
  UploadContractInput,
} from "@prism/types";
import type { EventOpsActorQuery } from "./primitives";

export interface EventOpsWorkspacesContract {
  clientWorkspace: {
    detail(actor?: EventOpsActorQuery, cursor?: string): Promise<PrismClientWorkspace>;
    actionCenter(actor?: EventOpsActorQuery): Promise<PrismClientActionCenter>;
  };

  billing: {
    list(actor?: EventOpsActorQuery): Promise<PrismBillingWorkspace>;
  };

  pmcm: {
    /** Event switcher, inquiries, directories and rules for PMCM event pages; identity comes from the session token. */
    reference(): Promise<PrismPmcmReference>;
    commandInbox(query?: PrismPmcmCommandInboxQueryInput): Promise<PrismPmcmCommandInbox>;
    /** What each event owes and how many messages the signed-in PMCM admin has not read. */
    eventSummaries(): Promise<PrismPmcmEventSummaries>;
    /** Open and overdue file requirements for the events still in play (a bounded set). */
    fileSummaries(): Promise<PrismPmcmFileSummaries>;
    /** Dated work across events (event days, quote deadlines, payments, ocular visits, supplier schedules) in a window. */
    calendar(query: PmcmCalendarQuery): Promise<PrismPmcmCalendar>;
    /** PMCM-only decision log for one event (FL-019); identity comes from the session token. */
    decisionLog(eventId: string, query?: PrismDecisionLogQueryInput): Promise<PrismDecisionLog>;
    eventWorkspace(
      eventId: string,
      actor?: EventOpsActorQuery,
    ): Promise<PrismPmcmEventWorkspace>;
    /** PMCM-only; identity comes from the session bearer token. */
    supplierReadiness(eventId: string): Promise<PrismPmcmSupplierReadinessBoard>;
    registrationPlatform(
      eventId: string,
      actor?: EventOpsActorQuery,
    ): Promise<PrismRegistrationPlatform | null>;
    upsertRegistrationPlatform(
      eventId: string,
      input: CreateRegistrationPlatformInput,
      actor?: EventOpsActorQuery,
    ): Promise<PrismRegistrationPlatform>;
    updateRegistrationPlatform(
      eventId: string,
      input: UpdateRegistrationPlatformInput,
      actor?: EventOpsActorQuery,
    ): Promise<PrismRegistrationPlatform>;
    importHeadcount(
      eventId: string,
      input: ImportHeadcountInput,
      actor?: EventOpsActorQuery,
    ): Promise<PrismRegistrationPlatform>;
  };

  supplierWorkspace: {
    /** Identity comes from the session bearer token (PA-284); no actor query. */
    detail(): Promise<PrismSupplierWorkspace>;
    /** Identity comes from the session bearer token (PA-284); no actor query. */
    readinessBoard(): Promise<PrismSupplierReadinessBoard>;
    confirmAssignment(
      requestId: string,
      actor?: EventOpsActorQuery,
    ): Promise<PrismSupplierQuoteRequest>;
    confirmReadiness(
      requestId: string,
      input: ConfirmSupplierReadinessInput,
      actor?: EventOpsActorQuery,
    ): Promise<PrismSupplierQuoteRequest>;
    uploadContract(
      requestId: string,
      input: UploadContractInput,
      actor?: EventOpsActorQuery,
    ): Promise<PrismSupplierQuoteRequest>;
    updateEventStatus(
      requestId: string,
      input: UpdateSupplierEventStatusInput,
      actor?: EventOpsActorQuery,
    ): Promise<PrismSupplierQuoteRequest>;
  };
}
