import type {
  ConfirmSupplierReadinessInput,
  CreateRegistrationPlatformInput,
  PrismBillingWorkspace,
  PrismClientActionCenter,
  PrismClientWorkspace,
  PrismPmcmCommandInbox,
  PrismPmcmCommandInboxQueryInput,
  PrismPmcmDashboardWorkspace,
  PrismPmcmEventWorkspace,
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

  pmcmDashboard: {
    detail(actor?: EventOpsActorQuery): Promise<PrismPmcmDashboardWorkspace>;
  };

  pmcm: {
    commandInbox(query?: PrismPmcmCommandInboxQueryInput): Promise<PrismPmcmCommandInbox>;
    eventWorkspace(
      eventId: string,
      actor?: EventOpsActorQuery,
    ): Promise<PrismPmcmEventWorkspace>;
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
