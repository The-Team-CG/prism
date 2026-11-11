import { InternalServerErrorException } from '@nestjs/common';
import type { OpsEventPlanItem, OpsPlanningTemplate, OpsPlanningTemplateVersion } from '@prisma/client';
import {
  planningTemplateItemSchema,
  type PlanItemStatus,
  type PlanningTemplateItemInput,
  type PrismEventPlanItem,
  type PrismPlanningTemplate,
  type PrismPlanningTemplateSummary,
  type PrismPlanningTemplateVersion,
} from '@prism/types';
import type { ExistingPlanItem } from '../../domain/plan-diff.policy';

const STATUSES: readonly PlanItemStatus[] = ['open', 'done', 'skipped'];

export function planItemStatus(value: string): PlanItemStatus {
  return STATUSES.find((status) => status === value) ?? 'open';
}

/** The tasks of a stored version. Written only through the contract, so an unreadable row is a fault, not user input. */
export function templateItemsOf(version: Pick<OpsPlanningTemplateVersion, 'items' | 'version'>): PlanningTemplateItemInput[] {
  const parsed = planningTemplateItemSchema.array().safeParse(version.items);
  if (!parsed.success) throw new InternalServerErrorException(`Planning template version ${version.version} is unreadable`);
  return parsed.data;
}

/** Date columns come back as UTC midnight; the calendar day is what was stored. */
export function dateKeyOf(date: Date): string {
  return date.toISOString().slice(0, 10);
}

type TemplateWithLatest = OpsPlanningTemplate & { versions: OpsPlanningTemplateVersion[] };

export function mapTemplateSummary(template: TemplateWithLatest): PrismPlanningTemplateSummary {
  const current = template.versions.find((version) => version.version === template.currentVersion);
  return {
    id: template.id,
    name: template.name,
    description: template.description,
    currentVersion: template.currentVersion,
    itemCount: current ? templateItemsOf(current).length : 0,
    archived: template.archivedAt !== null,
    updatedAt: template.updatedAt.toISOString(),
  };
}

export function mapTemplateVersion(version: OpsPlanningTemplateVersion): PrismPlanningTemplateVersion {
  return {
    version: version.version,
    changeNote: version.changeNote,
    publishedBy: version.publishedBy,
    publishedAt: version.publishedAt.toISOString(),
    items: templateItemsOf(version),
  };
}

export function mapTemplate(template: TemplateWithLatest): PrismPlanningTemplate {
  const ordered = [...template.versions].sort((left, right) => right.version - left.version);
  return { ...mapTemplateSummary({ ...template, versions: ordered }), versions: ordered.map(mapTemplateVersion) };
}

export function toExistingPlanItem(item: OpsEventPlanItem): ExistingPlanItem {
  return {
    id: item.id,
    key: item.itemKey,
    title: item.title,
    ownerRole: item.ownerRole,
    dueDate: dateKeyOf(item.dueDate),
    notes: item.notes,
    dependsOn: item.dependsOn,
    status: planItemStatus(item.status),
    customized: item.customized,
    templateVersion: item.templateVersion,
  };
}

export const planItemRef = (item: Pick<OpsEventPlanItem, 'templateId' | 'itemKey'>) => `${item.templateId}:${item.itemKey}`;

/** A task as the plan shows it. `todayKey` decides overdue; `byRef` (this event's tasks by template and key) decides what it waits for. */
export function mapPlanItem(
  item: OpsEventPlanItem,
  context: { templateName: string; todayKey: string; byRef: Map<string, OpsEventPlanItem> },
): PrismEventPlanItem {
  const status = planItemStatus(item.status);
  const dependency = item.dependsOn ? context.byRef.get(planItemRef({ templateId: item.templateId, itemKey: item.dependsOn })) : undefined;
  const dueDate = dateKeyOf(item.dueDate);
  return {
    id: item.id,
    eventId: item.eventId,
    templateId: item.templateId,
    templateName: context.templateName,
    templateVersion: item.templateVersion,
    key: item.itemKey,
    title: item.title,
    ownerRole: item.ownerRole,
    ownerName: item.ownerName,
    dueDate,
    status,
    completedAt: item.completedAt?.toISOString() ?? null,
    completedBy: item.completedBy,
    notes: item.notes,
    dependsOn: item.dependsOn,
    dependsOnTitle: dependency?.title ?? null,
    waiting: dependency ? planItemStatus(dependency.status) === 'open' : false,
    customized: item.customized,
    overdue: status === 'open' && dueDate < context.todayKey,
  };
}
