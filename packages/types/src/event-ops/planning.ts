import type { PlanItemStatus, PlanningTemplateItemInput } from "../schemas/planning-inputs.js";

/** One task of a published template version. */
export type PrismPlanningTemplateItem = PlanningTemplateItemInput;

export interface PrismPlanningTemplateVersion {
  version: number;
  changeNote: string;
  publishedBy: string;
  publishedAt: string;
  items: PrismPlanningTemplateItem[];
}

export interface PrismPlanningTemplateSummary {
  id: string;
  name: string;
  description: string;
  currentVersion: number;
  itemCount: number;
  archived: boolean;
  updatedAt: string;
}

/** A template with every version it was ever published as, newest first. */
export interface PrismPlanningTemplate extends PrismPlanningTemplateSummary {
  versions: PrismPlanningTemplateVersion[];
}

/** One task on an event's plan: where it came from, who owns it, when it falls, and whether anyone has changed it. */
export interface PrismEventPlanItem {
  id: string;
  eventId: string;
  templateId: string;
  templateName: string;
  templateVersion: number;
  key: string;
  title: string;
  ownerRole: string;
  ownerName: string;
  dueDate: string;
  status: PlanItemStatus;
  completedAt: string | null;
  completedBy: string | null;
  notes: string;
  dependsOn: string | null;
  dependsOnTitle: string | null;
  /** The task it waits for is not done or skipped yet. Informational: PMCM may still finish this one. */
  waiting: boolean;
  /** Someone changed its title, owner role, date or notes, so applying a newer version will not rewrite it. */
  customized: boolean;
  overdue: boolean;
}

export type PrismPlanChangeField = "title" | "ownerRole" | "dueDate" | "notes" | "dependsOn";

export interface PrismPlanChange {
  field: PrismPlanChangeField;
  from: string;
  to: string;
}

export interface PrismPlanAddition {
  key: string;
  title: string;
  ownerRole: string;
  dueDate: string;
  /** The due date is already behind today: it is added anyway, flagged so nobody is surprised. */
  pastDue: boolean;
}

export interface PrismPlanUpdate {
  id: string;
  key: string;
  title: string;
  changes: PrismPlanChange[];
}

/** Why an existing task is left as it is although the template now says something else. */
export type PrismPlanKeptReason = "done" | "skipped" | "edited";

export interface PrismPlanKept {
  id: string;
  key: string;
  title: string;
  reason: PrismPlanKeptReason;
  changes: PrismPlanChange[];
}

/** A task already on the plan that the chosen template version no longer lists. It is never deleted. */
export interface PrismPlanRemovedFromTemplate {
  id: string;
  key: string;
  title: string;
  status: PlanItemStatus;
}

/** What applying a template version would do to one event. Nothing changes until it is applied with the token. */
export interface PrismPlanPreview {
  eventId: string;
  templateId: string;
  templateName: string;
  version: number;
  eventDate: string;
  previewToken: string;
  add: PrismPlanAddition[];
  update: PrismPlanUpdate[];
  kept: PrismPlanKept[];
  removedFromTemplate: PrismPlanRemovedFromTemplate[];
  unchanged: number;
}

export interface PrismPlanApplyResult {
  added: number;
  updated: number;
  kept: number;
  items: PrismEventPlanItem[];
}
