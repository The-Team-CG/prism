import type {
  CreateAccreditationRequirementInput,
  CreateEventRiskInput,
  CreateLogisticsBookingInput,
  PrismAccreditationRequirement,
  PrismApprovedClientAccount,
  PrismEventClientAccess,
  PrismEventRisk,
  PrismLogisticsBooking,
  UpdateAccreditationRequirementInput,
  UpdateEventRiskInput,
  StartEventDayResult,
  ClientTestimonialModerationInput,
  CreateComplianceRiskInput,
  UpdateComplianceRiskInput,
  PrismArchiveComparisonRow,
  PrismCancellationSummary,
  PrismClientCloseoutResponse,
  PrismComplianceRisk,
  PrismComplianceRun,
  PrismDefenseReadiness,
  PrismEventDayStatusFeed,
  PrismFloorPlanSnapshotVersion,
  PrismLogisticsCompletion,
  PrismPostEventDocument,
  PrismVenueConfirmationTask,
  RecordLogisticsCompletionInput,
  ResolveVenueConfirmationInput,
  CreateComplianceRuleInput,
  UpdateComplianceRuleInput,
  PrismEvent,
  PrismPmcmOcularVisit,
  RecordActualEventEndInput,
  ScheduleOcularVisitInput,
  SetClientEventDayViewInput,
  SetEventModulesInput,
  SetEventPrivacyInput,
  SetEventCoverInput,
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

/** Event closure, compliance checks and official floorplan drafts: the PMCM lifecycle commands. */
export interface EventOpsLifecycleContract {
  lifecycle: {
    scheduleOcularVisit(eventId: string, input: ScheduleOcularVisitInput): Promise<PrismPmcmOcularVisit>;
    completeOcularVisit(eventId: string): Promise<PrismPmcmOcularVisit>;
    waiveOcularVisit(eventId: string, input: WaiveOcularVisitInput): Promise<PrismPmcmOcularVisit>;
    setModules(eventId: string, input: SetEventModulesInput): Promise<{ eventId: string; disabledModules: SetEventModulesInput["disabledModules"] }>;
    setPrivacy(eventId: string, input: SetEventPrivacyInput): Promise<{ eventId: string; privacy: SetEventPrivacyInput["privacy"] }>;
    /** PMCM picks an image from the event's files as its cover, or null for the generated cover. */
    setCover(eventId: string, input: SetEventCoverInput): Promise<{ eventId: string; coverObjectId: string | null }>;
    setClientEventDayView(eventId: string, input: SetClientEventDayViewInput): Promise<PrismEvent>;
    archive(eventId: string, overrideReason?: string): Promise<PrismEvent>;
    recordActualEnd(eventId: string, input: RecordActualEventEndInput): Promise<PrismEvent>;
    /** Starts the event day; the API takes an empty body. */
    startEventDay(eventId: string): Promise<StartEventDayResult>;
    defenseReadiness(eventId: string): Promise<PrismDefenseReadiness>;
    eventDayStatusFeed(eventId: string): Promise<PrismEventDayStatusFeed>;
    cancellationSummary(eventId: string): Promise<PrismCancellationSummary>;
    venueConfirmations(eventId: string): Promise<PrismVenueConfirmationTask[]>;
    resolveVenueConfirmation(eventId: string, taskId: string, input: ResolveVenueConfirmationInput): Promise<PrismVenueConfirmationTask>;
  };
  risks: {
    list(eventId: string): Promise<PrismEventRisk[]>;
    loadStandard(eventId: string): Promise<PrismEventRisk[]>;
    create(eventId: string, input: CreateEventRiskInput): Promise<PrismEventRisk>;
    update(eventId: string, riskId: string, input: UpdateEventRiskInput): Promise<PrismEventRisk>;
  };
  closure: {
    closeGates(eventId: string): Promise<PrismCloseGates>;
    insights(eventId: string): Promise<PrismEventInsight[]>;
    generateInsights(eventId: string): Promise<PrismEventInsight>;
    wrapUp(eventId: string): Promise<PrismEventWrapUp | null>;
    startWrapUp(eventId: string, input: StartEventWrapUpInput): Promise<PrismEventWrapUp>;
    updateWrapUp(eventId: string, input: UpdateEventWrapUpInput): Promise<PrismEventWrapUp>;
    logisticsBookings(eventId: string): Promise<PrismLogisticsBooking[]>;
    createLogisticsBooking(eventId: string, input: CreateLogisticsBookingInput): Promise<PrismLogisticsBooking>;
    /** Compares archived events side by side; the ids travel as one comma-separated query value. */
    compareArchived(eventIds: string[]): Promise<PrismArchiveComparisonRow[]>;
    completePostEventDocument(eventId: string, documentId: string): Promise<PrismPostEventDocument>;
    logisticsCompletion(eventId: string): Promise<PrismLogisticsCompletion | null>;
    recordLogisticsCompletion(eventId: string, input: RecordLogisticsCompletionInput): Promise<PrismLogisticsCompletion>;
    clientCloseoutModeration(eventId: string): Promise<(PrismClientCloseoutResponse & { actorEmail?: string | null }) | null>;
    moderateClientCloseout(eventId: string, input: ClientTestimonialModerationInput): Promise<PrismClientCloseoutResponse>;
  };
  compliance: {
    /** PMCM's own rules and the built-in checks (the built-ins carry createdAt 1970-01-01). */
    listRules(): Promise<PrismComplianceRule[]>;
    createRule(input: CreateComplianceRuleInput): Promise<PrismComplianceRule>;
    updateRule(ruleId: string, input: UpdateComplianceRuleInput): Promise<PrismComplianceRule>;
    resolve(eventId: string, checkId: string, input: ResolveComplianceInput): Promise<PrismComplianceCheck>;
    run(eventId: string, input: RunComplianceInput): Promise<PrismComplianceCheck[]>;
    runs(eventId: string): Promise<PrismComplianceRun[]>;
    risks(eventId: string): Promise<PrismComplianceRisk[]>;
    createRisk(eventId: string, input: CreateComplianceRiskInput): Promise<PrismComplianceRisk>;
    updateRisk(eventId: string, riskId: string, input: UpdateComplianceRiskInput): Promise<PrismComplianceRisk>;
    accreditationRequirements(eventId: string): Promise<PrismAccreditationRequirement[]>;
    createAccreditationRequirement(eventId: string, input: CreateAccreditationRequirementInput): Promise<PrismAccreditationRequirement>;
    updateAccreditationRequirement(eventId: string, requirementId: string, input: UpdateAccreditationRequirementInput): Promise<PrismAccreditationRequirement>;
  };
  floorplans: {
    createDraft(eventId: string, input: CreateFloorPlanDraftInput): Promise<PrismFloorPlanDraft>;
    submitDraft(eventId: string, draftId: string): Promise<PrismFloorPlanDraft>;
    approveDraft(eventId: string, draftId: string): Promise<PrismFloorPlanDraft>;
    reopenPreference(eventId: string, draftId: string): Promise<PrismFloorPlanDraft>;
    history(eventId: string, draftId: string): Promise<PrismFloorPlanSnapshotVersion[]>;
    clientAccess(eventId: string): Promise<PrismEventClientAccess>;
    searchClientCandidates(eventId: string, query: string): Promise<PrismApprovedClientAccount[]>;
    grantClientAccess(eventId: string, userId: string): Promise<PrismEventClientAccess>;
    revokeClientAccess(eventId: string, userId: string): Promise<PrismEventClientAccess>;
    /** A saved plan as the API returns it; the editor maps it to its own project shape. */
    plan<TPlan = unknown>(planId: string): Promise<TPlan>;
    /** Saves the editor's plan; the API answers with the stored plan. */
    savePlan<TPlan = unknown>(planId: string, body: unknown): Promise<TPlan>;
  };
}
