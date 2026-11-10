import type {
  CreateComplianceRuleInput,
  PrismEvent,
  PrismPmcmOcularVisit,
  RecordActualEventEndInput,
  ScheduleOcularVisitInput,
  SetClientEventDayViewInput,
  SetEventModulesInput,
  SetEventPrivacyInput,
  WaiveOcularVisitInput,
  CreateFloorPlanDraftInput,
  PrismCloseGates,
  PrismComplianceCheck,
  PrismComplianceRule,
  PrismEventInsight,
  PrismEventWrapUp,
  PrismFloorPlanDraft,
  ResolveComplianceInput,
  RunComplianceInput,
  StartEventWrapUpInput,
  UpdateEventWrapUpInput,
} from "@prism/types";
import type { EventOpsActorQuery } from "./primitives";

/** Event closure, compliance checks and official floorplan drafts: the PMCM lifecycle commands. */
export interface EventOpsLifecycleContract {
  lifecycle: {
    scheduleOcularVisit(eventId: string, input: ScheduleOcularVisitInput, actor?: EventOpsActorQuery): Promise<PrismPmcmOcularVisit>;
    completeOcularVisit(eventId: string, actor?: EventOpsActorQuery): Promise<PrismPmcmOcularVisit>;
    waiveOcularVisit(eventId: string, input: WaiveOcularVisitInput, actor?: EventOpsActorQuery): Promise<PrismPmcmOcularVisit>;
    setModules(eventId: string, input: SetEventModulesInput, actor?: EventOpsActorQuery): Promise<{ eventId: string; disabledModules: SetEventModulesInput["disabledModules"] }>;
    setPrivacy(eventId: string, input: SetEventPrivacyInput, actor?: EventOpsActorQuery): Promise<{ eventId: string; privacy: SetEventPrivacyInput["privacy"] }>;
    setClientEventDayView(eventId: string, input: SetClientEventDayViewInput, actor?: EventOpsActorQuery): Promise<PrismEvent>;
    archive(eventId: string, overrideReason?: string, actor?: EventOpsActorQuery): Promise<PrismEvent>;
    recordActualEnd(eventId: string, input: RecordActualEventEndInput, actor?: EventOpsActorQuery): Promise<PrismEvent>;
  };
  closure: {
    closeGates(eventId: string, actor?: EventOpsActorQuery): Promise<PrismCloseGates>;
    insights(eventId: string, actor?: EventOpsActorQuery): Promise<PrismEventInsight[]>;
    generateInsights(eventId: string, actor?: EventOpsActorQuery): Promise<PrismEventInsight>;
    wrapUp(eventId: string, actor?: EventOpsActorQuery): Promise<PrismEventWrapUp | null>;
    startWrapUp(eventId: string, input: StartEventWrapUpInput, actor?: EventOpsActorQuery): Promise<PrismEventWrapUp>;
    updateWrapUp(eventId: string, input: UpdateEventWrapUpInput, actor?: EventOpsActorQuery): Promise<PrismEventWrapUp>;
  };
  compliance: {
    createRule(input: CreateComplianceRuleInput, actor?: EventOpsActorQuery): Promise<PrismComplianceRule>;
    resolve(eventId: string, checkId: string, input: ResolveComplianceInput, actor?: EventOpsActorQuery): Promise<PrismComplianceCheck>;
    run(eventId: string, input: RunComplianceInput, actor?: EventOpsActorQuery): Promise<PrismComplianceCheck[]>;
  };
  floorplans: {
    createDraft(eventId: string, input: CreateFloorPlanDraftInput, actor?: EventOpsActorQuery): Promise<PrismFloorPlanDraft>;
    submitDraft(eventId: string, draftId: string, actor?: EventOpsActorQuery): Promise<PrismFloorPlanDraft>;
    approveDraft(eventId: string, draftId: string, actor?: EventOpsActorQuery): Promise<PrismFloorPlanDraft>;
    reopenPreference(eventId: string, draftId: string, actor?: EventOpsActorQuery): Promise<PrismFloorPlanDraft>;
    /** A saved plan as the API returns it; the editor maps it to its own project shape. */
    plan<TPlan = unknown>(planId: string, actor?: EventOpsActorQuery): Promise<TPlan>;
    /** Saves the editor's plan; the API answers with the stored plan. */
    savePlan<TPlan = unknown>(planId: string, body: unknown, actor?: EventOpsActorQuery): Promise<TPlan>;
  };
}
