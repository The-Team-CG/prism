import type {
  AiEventRequest,
  AskOperationsAssistantInput,
  ComplianceAdvisoryResult,
  EventIntelligenceResult,
  OperationsAssistantResult,
  PAREApprovalRecord,
  PrismCanvaConnection,
  PrismCanvaDesign,
  PrismEventDayCopilot,
  PrismSupplierReliabilityScore,
  ThemeSuggestionResult,
} from "@prism/types";

/** AI advisory, the Canva connection and PARE approvals: the platform tools PMCM works with. */
export interface EventOpsPlatformContract {
  advisory: {
    compliance(input: AiEventRequest): Promise<ComplianceAdvisoryResult>;
    themes(input: AiEventRequest): Promise<ThemeSuggestionResult>;
    eventIntelligence(input: AiEventRequest): Promise<EventIntelligenceResult>;
    eventDayCopilot(input: AiEventRequest): Promise<PrismEventDayCopilot>;
    askAssistant(eventId: string, input: AskOperationsAssistantInput): Promise<OperationsAssistantResult>;
    supplierReliabilityScore(supplierId: string): Promise<PrismSupplierReliabilityScore>;
  };
  canva: {
    status(): Promise<PrismCanvaConnection>;
    authorize(): Promise<{ url: string }>;
    disconnect(): Promise<PrismCanvaConnection>;
    proposalDesign(eventId: string): Promise<PrismCanvaDesign>;
    testimonialDesign(eventId: string): Promise<PrismCanvaDesign>;
  };
  pare: {
    pending(): Promise<PAREApprovalRecord[]>;
    approve(approvalRecordId: string): Promise<PAREApprovalRecord>;
    reject(approvalRecordId: string): Promise<PAREApprovalRecord>;
  };
}
