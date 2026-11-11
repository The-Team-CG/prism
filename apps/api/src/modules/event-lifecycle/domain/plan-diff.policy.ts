import { createHash } from 'node:crypto';
import {
  planningDueDate,
  type PlanItemStatus,
  type PlanningTemplateItemInput,
  type PrismPlanAddition,
  type PrismPlanChange,
  type PrismPlanKept,
  type PrismPlanRemovedFromTemplate,
  type PrismPlanUpdate,
} from '@prism/types';

/**
 * What applying a template version does to an event's plan. Tasks are matched on their template key, so renaming a task in
 * a newer version updates it instead of adding a second one. Work that has begun is never rewritten: a task that is done or
 * skipped, or that someone edited, is kept exactly as it is, and a task the template dropped is left in place.
 */

export interface ExistingPlanItem {
  id: string;
  key: string;
  title: string;
  ownerRole: string;
  dueDate: string;
  notes: string;
  dependsOn: string | null;
  status: PlanItemStatus;
  customized: boolean;
  templateVersion: number;
}

export interface PlannedAddition extends PrismPlanAddition {
  notes: string;
  dependsOn: string | null;
}

export interface PlannedUpdate extends PrismPlanUpdate {
  patch: { title: string; ownerRole: string; dueDate: string; notes: string; dependsOn: string | null };
}

export interface PlanDiff {
  add: PlannedAddition[];
  update: PlannedUpdate[];
  kept: PrismPlanKept[];
  removedFromTemplate: PrismPlanRemovedFromTemplate[];
  unchanged: number;
  /** Tasks identical to the template that only need to be stamped with the version they now follow. */
  restamp: string[];
}

interface Desired {
  title: string;
  ownerRole: string;
  dueDate: string;
  notes: string;
  dependsOn: string | null;
}

const FIELDS: ReadonlyArray<PrismPlanChange['field']> = ['title', 'ownerRole', 'dueDate', 'notes', 'dependsOn'];

function changesBetween(existing: ExistingPlanItem, desired: Desired): PrismPlanChange[] {
  return FIELDS.flatMap((field) => {
    const from = existing[field] ?? '';
    const to = desired[field] ?? '';
    return from === to ? [] : [{ field, from, to }];
  });
}

/** Why a task that differs from the template is left alone, or null when it may be rewritten. */
function protectionOf(existing: ExistingPlanItem): PrismPlanKept['reason'] | null {
  if (existing.status !== 'open') return existing.status;
  return existing.customized ? 'edited' : null;
}

export function diffPlan(input: {
  eventDateKey: string;
  todayKey: string;
  items: readonly PlanningTemplateItemInput[];
  existing: readonly ExistingPlanItem[];
  version: number;
}): PlanDiff {
  const byKey = new Map(input.existing.map((existing) => [existing.key, existing]));
  const diff: PlanDiff = { add: [], update: [], kept: [], removedFromTemplate: [], unchanged: 0, restamp: [] };
  for (const item of input.items) {
    const desired: Desired = {
      title: item.title,
      ownerRole: item.ownerRole,
      dueDate: planningDueDate(input.eventDateKey, item.offsetDays),
      notes: item.notes,
      dependsOn: item.dependsOn,
    };
    const existing = byKey.get(item.key);
    if (!existing) diff.add.push({ key: item.key, ...pick(desired), pastDue: desired.dueDate < input.todayKey, notes: desired.notes, dependsOn: desired.dependsOn });
    else classify(diff, existing, desired, input.version);
  }
  const listed = new Set(input.items.map((item) => item.key));
  diff.removedFromTemplate = input.existing
    .filter((existing) => !listed.has(existing.key))
    .map((existing) => ({ id: existing.id, key: existing.key, title: existing.title, status: existing.status }));
  return diff;
}

function pick(desired: Desired) {
  return { title: desired.title, ownerRole: desired.ownerRole, dueDate: desired.dueDate };
}

function classify(diff: PlanDiff, existing: ExistingPlanItem, desired: Desired, version: number) {
  const changes = changesBetween(existing, desired);
  if (changes.length === 0) {
    diff.unchanged += 1;
    if (existing.templateVersion !== version) diff.restamp.push(existing.id);
    return;
  }
  const reason = protectionOf(existing);
  if (reason) diff.kept.push({ id: existing.id, key: existing.key, title: existing.title, reason, changes });
  else diff.update.push({ id: existing.id, key: existing.key, title: existing.title, changes, patch: desired });
}

/**
 * Binds an apply to the preview that was shown. It covers everything the apply would write and nothing that only drifts
 * with the clock (a date turning past due), so a preview holds until the plan itself changes.
 */
export function planPreviewToken(input: { eventId: string; templateId: string; version: number; eventDateKey: string; diff: PlanDiff }): string {
  const { diff } = input;
  const body = JSON.stringify({
    e: input.eventId,
    t: input.templateId,
    v: input.version,
    d: input.eventDateKey,
    a: diff.add.map(({ pastDue: _pastDue, ...addition }) => addition),
    u: diff.update.map((entry) => [entry.id, entry.patch]),
    k: diff.kept.map((entry) => [entry.id, entry.reason, entry.changes]),
    r: diff.removedFromTemplate.map((entry) => [entry.id, entry.status]),
    s: [...diff.restamp].sort(),
    n: diff.unchanged,
  });
  return createHash('sha256').update(body).digest('hex').slice(0, 32);
}
