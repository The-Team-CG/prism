import type {
  ApplyEventPlanInput,
  CreatePlanningTemplateInput,
  DateChangeImpactQuery,
  PreviewEventPlanInput,
  PrismDateChangeImpact,
  PrismEventPlanItem,
  PrismPlanApplyResult,
  PrismPlanPreview,
  PrismPlanningTemplate,
  PrismPlanningTemplateSummary,
  PublishPlanningTemplateVersionInput,
  SyncEventPlanInput,
  UpdateEventPlanItemInput,
} from "@prism/types";
import type { EventOpsReadInit } from "./primitives";

/** Planning templates (PMCM's reusable task lists) and the plan each event builds from them. PMCM admin and system only. */
export interface EventOpsPlanningContract {
  planning: {
    listTemplates(init?: EventOpsReadInit): Promise<PrismPlanningTemplateSummary[]>;
    template(templateId: string, init?: EventOpsReadInit): Promise<PrismPlanningTemplate>;
    createTemplate(input: CreatePlanningTemplateInput): Promise<PrismPlanningTemplate>;
    publishTemplateVersion(templateId: string, input: PublishPlanningTemplateVersionInput): Promise<PrismPlanningTemplate>;
    archiveTemplate(templateId: string): Promise<PrismPlanningTemplate>;
    restoreTemplate(templateId: string): Promise<PrismPlanningTemplate>;
    eventPlan(eventId: string, init?: EventOpsReadInit): Promise<PrismEventPlanItem[]>;
    /** Changes nothing: what applying a template version would add, update, keep and leave. */
    previewPlan(eventId: string, input: PreviewEventPlanInput): Promise<PrismPlanPreview>;
    /** Applies exactly the previewed plan; refused when the plan changed since the preview. */
    applyPlan(eventId: string, input: ApplyEventPlanInput): Promise<PrismPlanApplyResult>;
    updatePlanItem(eventId: string, itemId: string, input: UpdateEventPlanItemInput): Promise<PrismEventPlanItem>;
    /** Read only: what moving the event date touches. Without a date, what the date the event has now touches. */
    dateChangeImpact(eventId: string, query: DateChangeImpactQuery, init?: EventOpsReadInit): Promise<PrismDateChangeImpact>;
    /** Moves the plan's open tasks to follow the event date, applying exactly the previewed plans or none. */
    syncPlan(eventId: string, input: SyncEventPlanInput): Promise<PrismPlanApplyResult>;
  };
}
