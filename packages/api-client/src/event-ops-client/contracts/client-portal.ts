import type {
  AcknowledgeClientDeliverableInput,
  CreateClientFloorPlanAnnotationInput,
  CreateFloorPlanPreferenceInput,
  DecideClientFloorPlanInput,
  EditPublicInquiryInput,
  PrismBriefing,
  PrismClientCloseoutResponse,
  PrismClientCloseoutWorkspace,
  PrismClientFloorPlanReview,
  PrismClientFloorplanSnapshotType,
  PrismClientOcularVisit,
  PrismClientSharedFloorplanEntry,
  PrismConformeExecution,
  PrismFloorPlanDraft,
  PrismInquiryDraft,
  PrismPublicInquiryEdit,
  SaveInquiryDraftInput,
  SignConformeExecutionInput,
  SubmitBriefingInput,
  SubmitClientCloseoutResponseInput,
  SubmitClientOcularVisitInput,
} from "@prism/types";
import type { EventOpsActorQuery } from "./primitives";

/** What the signed-in client does on their own events, and the public inquiry draft and edit links. */
export interface EventOpsClientPortalContract {
  clientPortal: {
    closeout(eventId: string, actor?: EventOpsActorQuery): Promise<PrismClientCloseoutWorkspace>;
    acknowledgeWrapUp(eventId: string, input: AcknowledgeClientDeliverableInput, actor?: EventOpsActorQuery): Promise<unknown>;
    acknowledgeDeliverable(eventId: string, documentId: string, input: AcknowledgeClientDeliverableInput, actor?: EventOpsActorQuery): Promise<unknown>;
    submitCloseoutResponse(eventId: string, input: SubmitClientCloseoutResponseInput, actor?: EventOpsActorQuery): Promise<PrismClientCloseoutResponse>;
    revokeTestimonialConsent(eventId: string, actor?: EventOpsActorQuery): Promise<PrismClientCloseoutResponse>;
    floorplanReview(eventId: string, draftId: string, actor?: EventOpsActorQuery): Promise<PrismClientFloorPlanReview>;
    decideFloorplan(eventId: string, draftId: string, input: DecideClientFloorPlanInput, actor?: EventOpsActorQuery): Promise<unknown>;
    annotateFloorplan(eventId: string, draftId: string, input: CreateClientFloorPlanAnnotationInput, actor?: EventOpsActorQuery): Promise<unknown>;
    submitOcularVisit(eventId: string, input: SubmitClientOcularVisitInput, actor?: EventOpsActorQuery): Promise<PrismClientOcularVisit>;
    submitBriefing(eventId: string, input: SubmitBriefingInput, actor?: EventOpsActorQuery): Promise<PrismBriefing>;
    createFloorplanPreference(eventId: string, input: CreateFloorPlanPreferenceInput, actor?: EventOpsActorQuery): Promise<PrismFloorPlanDraft>;
    /** A submitted or approved floorplan snapshot as the API returns it; the editor maps it to its own project shape. */
    floorplanSnapshot<TSnapshot = unknown>(eventId: string, draftId: string, type: PrismClientFloorplanSnapshotType, actor?: EventOpsActorQuery): Promise<TSnapshot>;
    sharedFloorplans(actor?: EventOpsActorQuery): Promise<PrismClientSharedFloorplanEntry[]>;
    conformeExecutions(actor?: EventOpsActorQuery): Promise<{ executions: PrismConformeExecution[] }>;
    signConforme(input: SignConformeExecutionInput, actor?: EventOpsActorQuery): Promise<PrismConformeExecution>;
    saveInquiryDraft(draftToken: string, input: SaveInquiryDraftInput): Promise<PrismInquiryDraft>;
    inquiryDraft(draftToken: string): Promise<PrismInquiryDraft>;
    discardInquiryDraft(draftToken: string): Promise<void>;
    inquiryEdit(editToken: string): Promise<PrismPublicInquiryEdit>;
    saveInquiryEdit(editToken: string, input: EditPublicInquiryInput): Promise<PrismPublicInquiryEdit>;
  };
}
