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
import type { EventOpsActorQuery } from "./primitives";

/** AI advisory, the Canva connection and PARE approvals: the platform tools PMCM works with. */
export interface EventOpsPlatformContract {
  advisory: {
    compliance(input: AiEventRequest, actor?: EventOpsActorQuery): Promise<ComplianceAdvisoryResult>;
    themes(input: AiEventRequest, actor?: EventOpsActorQuery): Promise<ThemeSuggestionResult>;
    eventIntelligence(input: AiEventRequest, actor?: EventOpsActorQuery): Promise<EventIntelligenceResult>;
    eventDayCopilot(input: AiEventRequest, actor?: EventOpsActorQuery): Promise<PrismEventDayCopilot>;
    askAssistant(eventId: string, input: AskOperationsAssistantInput, actor?: EventOpsActorQuery): Promise<OperationsAssistantResult>;
    supplierReliabilityScore(supplierId: string, actor?: EventOpsActorQuery): Promise<PrismSupplierReliabilityScore>;
  };
  canva: {
    status(actor?: EventOpsActorQuery): Promise<PrismCanvaConnection>;
    authorize(actor?: EventOpsActorQuery): Promise<{ url: string }>;
    disconnect(actor?: EventOpsActorQuery): Promise<PrismCanvaConnection>;
    proposalDesign(eventId: string, actor?: EventOpsActorQuery): Promise<PrismCanvaDesign>;
    testimonialDesign(eventId: string, actor?: EventOpsActorQuery): Promise<PrismCanvaDesign>;
  };
  pare: {
    pending(actor?: EventOpsActorQuery): Promise<PAREApprovalRecord[]>;
    approve(approvalRecordId: string, actor?: EventOpsActorQuery): Promise<PAREApprovalRecord>;
    reject(approvalRecordId: string, actor?: EventOpsActorQuery): Promise<PAREApprovalRecord>;
  };
}
