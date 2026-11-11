import { randomUUID } from 'node:crypto';
import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AUDIT_WRITER, writeAudit, type AuditWriter } from '@prism/kernel/access-control';
import { PrismaService } from '@prism/kernel/database';
import { AuditActionType, AuditCategory } from '@prism/kernel/event-core';
import type {
  CreatePlanningTemplateInput,
  PlanningTemplateItemInput,
  PrismPlanningTemplate,
  PrismPlanningTemplateSummary,
  PublishPlanningTemplateVersionInput,
} from '@prism/types';
import { mapTemplate, mapTemplateSummary, templateItemsOf } from './planning.mappers';

export interface PlanningActor {
  id?: string;
  name: string;
  role: string;
  email?: string;
}

const MAX_TEMPLATES = 200;
const MAX_VERSIONS = 100;

/** The tasks as the list stores them, so two versions with the same tasks compare equal however they were typed. */
function fingerprint(items: readonly PlanningTemplateItemInput[]): string {
  return JSON.stringify(items.map((item) => [item.key, item.title, item.ownerRole, item.offsetDays, item.dependsOn, item.notes]));
}

/**
 * Planning templates and their versions. A published version never changes: an edit publishes the next one, so an event
 * can always say which version of which template its tasks came from. Tasks, dates and owners only.
 */
@Injectable()
export class PlanningTemplatesService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(AUDIT_WRITER) private readonly auditWriter: AuditWriter,
  ) {}

  async list(): Promise<PrismPlanningTemplateSummary[]> {
    const templates = await this.prisma.opsPlanningTemplate.findMany({
      orderBy: { name: 'asc' },
      include: { versions: { orderBy: { version: 'desc' }, take: 1 } },
      // QUERY_AUDIT_ALLOW_BOUNDED_TAKE: PMCM keeps a short list of planning templates; the cap is far above any real catalogue.
      take: MAX_TEMPLATES,
    });
    return templates.map(mapTemplateSummary);
  }

  async get(templateId: string): Promise<PrismPlanningTemplate> {
    const template = await this.prisma.opsPlanningTemplate.findUnique({
      where: { id: templateId },
      include: { versions: { orderBy: { version: 'desc' }, take: MAX_VERSIONS } },
    });
    if (!template) throw new NotFoundException('Planning template not found');
    return mapTemplate(template);
  }

  async create(input: CreatePlanningTemplateInput, actor: PlanningActor): Promise<PrismPlanningTemplate> {
    const templateId = `ptpl_${randomUUID()}`;
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.opsPlanningTemplate.create({ data: { id: templateId, name: input.name, description: input.description, createdBy: actor.name } });
        await tx.opsPlanningTemplateVersion.create({
          data: { id: `ptv_${randomUUID()}`, templateId, version: 1, changeNote: 'First version', items: input.items, publishedBy: actor.name },
        });
        await this.audit(tx, actor, templateId, `Created planning template ${input.name}`, AuditActionType.Create, { itemCount: input.items.length });
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('A planning template with that name already exists');
      }
      throw error;
    }
    return this.get(templateId);
  }

  /** Publishes the next version. Earlier versions, and events already following them, are untouched. */
  async publishVersion(templateId: string, input: PublishPlanningTemplateVersionInput, actor: PlanningActor): Promise<PrismPlanningTemplate> {
    await this.prisma.$transaction(async (tx) => {
      await this.lockTemplate(tx, templateId);
      const template = await tx.opsPlanningTemplate.findUnique({ where: { id: templateId } });
      if (!template) throw new NotFoundException('Planning template not found');
      if (template.archivedAt) throw new ConflictException('This template is archived. Restore it before publishing a new version');
      const current = await tx.opsPlanningTemplateVersion.findUnique({ where: { templateId_version: { templateId, version: template.currentVersion } } });
      if (current && fingerprint(templateItemsOf(current)) === fingerprint(input.items)) {
        throw new ConflictException(`Nothing changed since version ${template.currentVersion}`);
      }
      const version = template.currentVersion + 1;
      await tx.opsPlanningTemplateVersion.create({
        data: { id: `ptv_${randomUUID()}`, templateId, version, changeNote: input.changeNote, items: input.items, publishedBy: actor.name },
      });
      await tx.opsPlanningTemplate.update({ where: { id: templateId }, data: { currentVersion: version } });
      await this.audit(tx, actor, templateId, `Published version ${version} of planning template ${template.name}`, AuditActionType.Update, {
        version,
        itemCount: input.items.length,
      });
    });
    return this.get(templateId);
  }

  /** An archived template cannot be applied to more events. Plans already built from it keep working. */
  async setArchived(templateId: string, archived: boolean, actor: PlanningActor): Promise<PrismPlanningTemplate> {
    await this.prisma.$transaction(async (tx) => {
      await this.lockTemplate(tx, templateId);
      const template = await tx.opsPlanningTemplate.findUnique({ where: { id: templateId } });
      if (!template) throw new NotFoundException('Planning template not found');
      if ((template.archivedAt !== null) === archived) {
        throw new ConflictException(archived ? 'This template is already archived' : 'This template is not archived');
      }
      await tx.opsPlanningTemplate.update({ where: { id: templateId }, data: { archivedAt: archived ? new Date() : null } });
      await this.audit(tx, actor, templateId, `${archived ? 'Archived' : 'Restored'} planning template ${template.name}`, AuditActionType.Update, { archived });
    });
    return this.get(templateId);
  }

  /** Serializes publishing and archiving of one template, so two editors cannot both publish the same next version. */
  private async lockTemplate(tx: Prisma.TransactionClient, templateId: string) {
    // QUERY_AUDIT_RAW_SQL: row lock on one planning template; Prisma has no delegate for SELECT ... FOR UPDATE.
    await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM event_lifecycle.planning_templates WHERE id = ${templateId} FOR UPDATE`;
  }

  private audit(tx: Prisma.TransactionClient, actor: PlanningActor, templateId: string, action: string, actionType: string, metadata: Record<string, unknown>) {
    return writeAudit(
      this.auditWriter,
      undefined,
      actor.name,
      action,
      {
        actorRole: actor.role,
        actorEmail: actor.email,
        category: AuditCategory.Events,
        actionType,
        affectedType: 'planning_template',
        affectedId: templateId,
        affectedLabel: 'Planning template',
        metadata: { actorId: actor.id ?? null, ...metadata },
      },
      { prisma: tx, correlationId: templateId },
    );
  }
}
