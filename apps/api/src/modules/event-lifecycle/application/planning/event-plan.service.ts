import { randomUUID } from 'node:crypto';
import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { OpsEventPlanItem, Prisma } from '@prisma/client';
import { AUDIT_WRITER, writeAudit, type AuditWriter } from '@prism/kernel/access-control';
import { PrismaService } from '@prism/kernel/database';
import { AuditActionType, AuditCategory } from '@prism/kernel/event-core';
import {
  planningEventDateKey,
  prismCalendarDateKey,
  type ApplyEventPlanInput,
  type PreviewEventPlanInput,
  type PrismEventPlanItem,
  type PrismPlanApplyResult,
  type PrismPlanPreview,
  type UpdateEventPlanItemInput,
} from '@prism/types';
import { diffPlan, planPreviewToken, type PlanDiff } from '../../domain/plan-diff.policy';
import { dateKeyOf, mapPlanItem, planItemRef, templateItemsOf, toExistingPlanItem } from './planning.mappers';
import type { PlanningActor } from './planning-templates.service';

const MAX_PLAN_ITEMS = 1000;

type Tx = Prisma.TransactionClient;

const dateOnly = (key: string) => new Date(`${key}T00:00:00.000Z`);

const definedOnly = <T extends Record<string, unknown>>(record: T): Partial<T> =>
  Object.fromEntries(Object.entries(record).filter(([, value]) => value !== undefined)) as Partial<T>;

/** Whether an edit changes what the template would have said, so a later reapply must leave the task alone. */
function changesTheTask(item: OpsEventPlanItem, input: UpdateEventPlanItemInput): boolean {
  const reworded = (['title', 'ownerRole', 'notes'] as const).some((field) => input[field] !== undefined && input[field] !== item[field]);
  return reworded || (input.dueDate !== undefined && input.dueDate !== dateKeyOf(item.dueDate));
}

function completionFor(status: UpdateEventPlanItemInput['status'], actor: PlanningActor) {
  const done = status === 'done';
  return { status, completedAt: done ? new Date() : null, completedBy: done ? actor.name : null };
}

interface Prepared {
  eventDateKey: string;
  templateName: string;
  version: number;
  diff: PlanDiff;
}

/**
 * An event's plan: the dated, owned tasks that came from planning templates. Applying a template is two steps, a preview
 * that changes nothing and an apply that must present that preview's token. Work that has begun is never rewritten and
 * nothing is deleted, so a template can be applied again whenever it changes.
 */
@Injectable()
export class EventPlanService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(AUDIT_WRITER) private readonly auditWriter: AuditWriter,
  ) {}

  async listItems(eventId: string): Promise<PrismEventPlanItem[]> {
    await this.requireEvent(this.prisma, eventId);
    return this.itemsOf(this.prisma, eventId);
  }

  async preview(eventId: string, input: PreviewEventPlanInput): Promise<PrismPlanPreview> {
    const event = await this.requireEvent(this.prisma, eventId);
    const prepared = await this.prepare(this.prisma, eventId, event.eventDate, input.templateId, input.version);
    return this.toPreview(eventId, input.templateId, prepared);
  }

  async apply(eventId: string, input: ApplyEventPlanInput, actor: PlanningActor): Promise<PrismPlanApplyResult> {
    return this.prisma.$transaction(async (tx) => {
      // QUERY_AUDIT_RAW_SQL: row lock on one event so two applies of its plan run one after the other; Prisma has no delegate for FOR UPDATE.
      await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM event_lifecycle.events WHERE id = ${eventId} FOR UPDATE`;
      const event = await this.requireEvent(tx, eventId);
      this.requireOpen(event);
      const prepared = await this.prepare(tx, eventId, event.eventDate, input.templateId, input.version);
      const current = this.toPreview(eventId, input.templateId, prepared);
      if (current.previewToken !== input.previewToken) {
        throw new ConflictException('The plan changed since you previewed it. Preview it again before applying');
      }
      await this.write(tx, eventId, input.templateId, prepared);
      const { diff } = prepared;
      await this.audit(tx, actor, eventId, `Applied planning template ${prepared.templateName} v${prepared.version}`, AuditActionType.Update, {
        templateId: input.templateId,
        version: prepared.version,
        added: diff.add.length,
        updated: diff.update.length,
        kept: diff.kept.length,
        removedFromTemplate: diff.removedFromTemplate.length,
      });
      return { added: diff.add.length, updated: diff.update.length, kept: diff.kept.length, items: await this.itemsOf(tx, eventId) };
    });
  }

  async updateItem(eventId: string, itemId: string, input: UpdateEventPlanItemInput, actor: PlanningActor): Promise<PrismEventPlanItem> {
    await this.prisma.$transaction(async (tx) => {
      const event = await this.requireEvent(tx, eventId);
      this.requireOpen(event);
      const item = await tx.opsEventPlanItem.findFirst({ where: { id: itemId, eventId } });
      if (!item) throw new NotFoundException('Plan task not found');
      const data = this.editData(item, input, actor);
      await tx.opsEventPlanItem.update({ where: { id: itemId }, data });
      await this.audit(tx, actor, eventId, `Updated plan task ${item.title}`, AuditActionType.Update, { itemId, key: item.itemKey, fields: Object.keys(input) });
    });
    const items = await this.itemsOf(this.prisma, eventId);
    const updated = items.find((item) => item.id === itemId);
    if (!updated) throw new NotFoundException('Plan task not found');
    return updated;
  }

  /** What an edit writes. Changing the words, owner role, date or notes keeps a later reapply from rewriting the task. */
  private editData(item: OpsEventPlanItem, input: UpdateEventPlanItemInput, actor: PlanningActor): Prisma.OpsEventPlanItemUpdateInput {
    const { status, dueDate, ...text } = input;
    return {
      ...definedOnly(text),
      ...(dueDate === undefined ? {} : { dueDate: dateOnly(dueDate) }),
      ...(changesTheTask(item, input) ? { customized: true } : {}),
      ...(status !== undefined && status !== item.status ? completionFor(status, actor) : {}),
    };
  }

  private requireOpen(event: { archived: boolean }) {
    if (event.archived) throw new ConflictException('This event is archived, so its plan can no longer change');
  }

  private async requireEvent(db: PrismaService | Tx, eventId: string) {
    const event = await db.opsEvent.findUnique({ where: { id: eventId }, select: { id: true, eventDate: true, archived: true } });
    if (!event) throw new NotFoundException('Event not found');
    return event;
  }

  private async prepare(db: PrismaService | Tx, eventId: string, eventDate: Date, templateId: string, requestedVersion?: number): Promise<Prepared> {
    const template = await db.opsPlanningTemplate.findUnique({ where: { id: templateId } });
    if (!template) throw new NotFoundException('Planning template not found');
    if (template.archivedAt) throw new ConflictException('This template is archived and cannot be applied to more events');
    const version = requestedVersion ?? template.currentVersion;
    const stored = await db.opsPlanningTemplateVersion.findUnique({ where: { templateId_version: { templateId, version } } });
    if (!stored) throw new NotFoundException(`Version ${version} of this template does not exist`);
    const existing = await db.opsEventPlanItem.findMany({
      where: { eventId, templateId },
      // QUERY_AUDIT_ALLOW_BOUNDED_TAKE: one event's tasks from one template, capped at the template task limit with headroom.
      take: MAX_PLAN_ITEMS,
    });
    const eventDateKey = planningEventDateKey(eventDate);
    const diff = diffPlan({
      eventDateKey,
      todayKey: prismCalendarDateKey(),
      items: templateItemsOf(stored),
      existing: existing.map(toExistingPlanItem),
      version,
    });
    return { eventDateKey, templateName: template.name, version, diff };
  }

  private toPreview(eventId: string, templateId: string, prepared: Prepared): PrismPlanPreview {
    const { diff } = prepared;
    return {
      eventId,
      templateId,
      templateName: prepared.templateName,
      version: prepared.version,
      eventDate: prepared.eventDateKey,
      previewToken: planPreviewToken({ eventId, templateId, version: prepared.version, eventDateKey: prepared.eventDateKey, diff }),
      add: diff.add.map(({ key, title, ownerRole, dueDate, pastDue }) => ({ key, title, ownerRole, dueDate, pastDue })),
      update: diff.update.map(({ id, key, title, changes }) => ({ id, key, title, changes })),
      kept: diff.kept,
      removedFromTemplate: diff.removedFromTemplate,
      unchanged: diff.unchanged,
    };
  }

  private async write(tx: Tx, eventId: string, templateId: string, prepared: Prepared): Promise<void> {
    const { diff, version } = prepared;
    if (diff.add.length > 0) {
      await tx.opsEventPlanItem.createMany({
        data: diff.add.map((addition) => ({
          id: `plan_${randomUUID()}`,
          eventId,
          templateId,
          templateVersion: version,
          itemKey: addition.key,
          title: addition.title,
          ownerRole: addition.ownerRole,
          dueDate: dateOnly(addition.dueDate),
          notes: addition.notes,
          dependsOn: addition.dependsOn,
        })),
      });
    }
    // QUERY_AUDIT_ALLOW_BOUNDED_LOOP: one update per changed task; a plan holds at most the template task limit.
    for (const entry of diff.update) {
      await tx.opsEventPlanItem.update({
        where: { id: entry.id },
        data: { ...entry.patch, dueDate: dateOnly(entry.patch.dueDate), templateVersion: version },
      });
    }
    if (diff.restamp.length > 0) await tx.opsEventPlanItem.updateMany({ where: { id: { in: diff.restamp } }, data: { templateVersion: version } });
  }

  private async itemsOf(db: PrismaService | Tx, eventId: string): Promise<PrismEventPlanItem[]> {
    const rows = await db.opsEventPlanItem.findMany({
      where: { eventId },
      orderBy: [{ dueDate: 'asc' }, { itemKey: 'asc' }],
      // QUERY_AUDIT_ALLOW_BOUNDED_TAKE: one event's plan; templates cap at 200 tasks and an event uses a few templates.
      take: MAX_PLAN_ITEMS,
    });
    const templateIds = [...new Set(rows.map((row) => row.templateId))];
    const templates = templateIds.length === 0 ? [] : await db.opsPlanningTemplate.findMany({ where: { id: { in: templateIds } }, select: { id: true, name: true } });
    const names = new Map(templates.map((template) => [template.id, template.name]));
    const todayKey = prismCalendarDateKey();
    const byRef = new Map(rows.map((row) => [planItemRef(row), row]));
    return rows.map((row) => mapPlanItem(row, { templateName: names.get(row.templateId) ?? 'Template', todayKey, byRef }));
  }

  private audit(tx: Tx, actor: PlanningActor, eventId: string, action: string, actionType: string, metadata: Record<string, unknown>) {
    return writeAudit(
      this.auditWriter,
      eventId,
      actor.name,
      action,
      {
        actorRole: actor.role,
        actorEmail: actor.email,
        category: AuditCategory.Events,
        actionType,
        affectedType: 'event_plan',
        affectedId: eventId,
        affectedLabel: 'Event plan',
        metadata: { actorId: actor.id ?? null, ...metadata },
      },
      { prisma: tx, correlationId: eventId },
    );
  }
}
