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

/** What the signed-in client does on their own events, and the public inquiry draft and edit links. */
export interface EventOpsClientPortalContract {
  clientPortal: {
    closeout(eventId: string): Promise<PrismClientCloseoutWorkspace>;
    acknowledgeWrapUp(eventId: string, input: AcknowledgeClientDeliverableInput): Promise<unknown>;
    acknowledgeDeliverable(eventId: string, documentId: string, input: AcknowledgeClientDeliverableInput): Promise<unknown>;
    submitCloseoutResponse(eventId: string, input: SubmitClientCloseoutResponseInput): Promise<PrismClientCloseoutResponse>;
    revokeTestimonialConsent(eventId: string): Promise<PrismClientCloseoutResponse>;
    floorplanReview(eventId: string, draftId: string): Promise<PrismClientFloorPlanReview>;
    decideFloorplan(eventId: string, draftId: string, input: DecideClientFloorPlanInput): Promise<unknown>;
    annotateFloorplan(eventId: string, draftId: string, input: CreateClientFloorPlanAnnotationInput): Promise<unknown>;
    submitOcularVisit(eventId: string, input: SubmitClientOcularVisitInput): Promise<PrismClientOcularVisit>;
    submitBriefing(eventId: string, input: SubmitBriefingInput): Promise<PrismBriefing>;
    createFloorplanPreference(eventId: string, input: CreateFloorPlanPreferenceInput): Promise<PrismFloorPlanDraft>;
    /** A submitted or approved floorplan snapshot as the API returns it; the editor maps it to its own project shape. */
    floorplanSnapshot<TSnapshot = unknown>(eventId: string, draftId: string, type: PrismClientFloorplanSnapshotType): Promise<TSnapshot>;
    sharedFloorplans(): Promise<PrismClientSharedFloorplanEntry[]>;
    conformeExecutions(): Promise<{ executions: PrismConformeExecution[] }>;
    signConforme(input: SignConformeExecutionInput): Promise<PrismConformeExecution>;
    saveInquiryDraft(draftToken: string, input: SaveInquiryDraftInput): Promise<PrismInquiryDraft>;
    inquiryDraft(draftToken: string): Promise<PrismInquiryDraft>;
    discardInquiryDraft(draftToken: string): Promise<void>;
    inquiryEdit(editToken: string): Promise<PrismPublicInquiryEdit>;
    saveInquiryEdit(editToken: string, input: EditPublicInquiryInput): Promise<PrismPublicInquiryEdit>;
  };
}
