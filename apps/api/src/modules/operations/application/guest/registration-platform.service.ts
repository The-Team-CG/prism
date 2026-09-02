import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { OpsRegistrationPlatform } from '@prisma/client';
import { PrismaService } from '@prism/kernel/database';
import { randomUUID } from 'node:crypto';
import { AuditActionType, AuditCategory, OpsUserRole, WorkflowCommandService } from '@prism/kernel/event-core';
import { AUDIT_WRITER, writeAudit, type AuditWriter } from '@prism/kernel/access-control';
import type { ResolvedEventOpsActor } from '@prism/kernel/access-control';
import type {
  CreateRegistrationPlatformInput,
  ImportHeadcountInput,
  UpdateRegistrationPlatformInput,
} from '@prism/types';

@Injectable()
export class RegistrationPlatformService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(AUDIT_WRITER) private readonly auditWriter: AuditWriter,
    private readonly workflowCommandService: WorkflowCommandService,
  ) {}

  async getByEventId(eventId: string): Promise<OpsRegistrationPlatform | null> {
    return this.prisma.opsRegistrationPlatform.findUnique({ where: { eventId } });
  }

  async upsert(eventId: string, input: CreateRegistrationPlatformInput, actor: ResolvedEventOpsActor): Promise<OpsRegistrationPlatform> {
    const event = await this.prisma.opsEvent.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event not found');

    let existed = false;

    return this.workflowCommandService.execute<OpsRegistrationPlatform>({
      name: 'registration_platform_upsert',
      validateState: async () => {
        existed = Boolean(await this.prisma.opsRegistrationPlatform.findUnique({ where: { eventId } }));
      },
      write: async () => {
        if (existed) {
          return this.prisma.opsRegistrationPlatform.update({
            where: { eventId },
            data: {
              platformType: input.platformType,
              ...(input.supplierId !== undefined && { supplierId: input.supplierId }),
              ...(input.expectedPaxMin !== undefined && { expectedPaxMin: input.expectedPaxMin }),
              ...(input.expectedPaxMax !== undefined && { expectedPaxMax: input.expectedPaxMax }),
              ...(input.setupNotes !== undefined && { setupNotes: input.setupNotes }),
            },
          });
        }
        return this.prisma.opsRegistrationPlatform.create({
          data: {
            id: `reg_${randomUUID()}`,
            eventId,
            platformType: input.platformType,
            supplierId: input.supplierId ?? null,
            expectedPaxMin: input.expectedPaxMin ?? 0,
            expectedPaxMax: input.expectedPaxMax ?? 0,
            setupNotes: input.setupNotes ?? '',
          },
        });
      },
      sideEffects: async (platform) => {
        await writeAudit(this.auditWriter, eventId, actor.name, `Registration platform configured: ${input.platformType}`, {
          actorRole: actor.role ?? OpsUserRole.PmcmAdmin,
          category: AuditCategory.Events,
          actionType: existed ? AuditActionType.Update : AuditActionType.Create,
          affectedType: 'registration_platform',
          affectedId: platform.id,
          affectedLabel: input.platformType,
          metadata: { platformType: input.platformType, supplierId: input.supplierId },
        });
      },
    });
  }

  async update(eventId: string, input: UpdateRegistrationPlatformInput, actor: ResolvedEventOpsActor): Promise<OpsRegistrationPlatform> {
    const existing = await this.prisma.opsRegistrationPlatform.findUnique({ where: { eventId } });
    if (!existing) throw new NotFoundException('Registration platform not configured for this event');

    return this.workflowCommandService.execute<OpsRegistrationPlatform>({
      name: 'registration_platform_update',
      validateState: async () => {},
      write: () =>
        this.prisma.opsRegistrationPlatform.update({
          where: { eventId },
          data: {
            ...(input.platformType !== undefined && { platformType: input.platformType }),
            ...(input.supplierId !== undefined && { supplierId: input.supplierId }),
            ...(input.expectedPaxMin !== undefined && { expectedPaxMin: input.expectedPaxMin }),
            ...(input.expectedPaxMax !== undefined && { expectedPaxMax: input.expectedPaxMax }),
            ...(input.status !== undefined && {
              status: input.status,
              ...(input.status === 'closed' && { setupConfirmedAt: new Date() }),
            }),
            ...(input.setupNotes !== undefined && { setupNotes: input.setupNotes }),
          },
        }),
      sideEffects: async (platform) => {
        await writeAudit(this.auditWriter, eventId, actor.name, `Registration platform updated: ${platform.platformType}`, {
          actorRole: actor.role ?? OpsUserRole.PmcmAdmin,
          category: AuditCategory.Events,
          actionType: AuditActionType.Update,
          affectedType: 'registration_platform',
          affectedId: platform.id,
          affectedLabel: platform.platformType,
          metadata: input,
        });
      },
    });
  }

  async importHeadcount(eventId: string, input: ImportHeadcountInput, actor: ResolvedEventOpsActor): Promise<OpsRegistrationPlatform> {
    const existing = await this.prisma.opsRegistrationPlatform.findUnique({ where: { eventId } });
    if (!existing) throw new NotFoundException('Registration platform not configured for this event');

    return this.workflowCommandService.execute<OpsRegistrationPlatform>({
      name: 'registration_headcount_import',
      validateState: async () => {
        if (input.importedHeadcount < 0) throw new BadRequestException('Headcount must be non-negative');
      },
      write: () =>
        this.prisma.opsRegistrationPlatform.update({
          where: { eventId },
          data: {
            headcountSource: input.headcountSource,
            importedHeadcount: input.importedHeadcount,
            importedFileName: input.importedFileName ?? null,
            importedAt: new Date(),
          },
        }),
      sideEffects: async (platform) => {
        await writeAudit(this.auditWriter, eventId, actor.name, `Headcount imported: ${input.importedHeadcount} guests from ${input.headcountSource}`, {
          actorRole: actor.role ?? OpsUserRole.PmcmAdmin,
          category: AuditCategory.Events,
          actionType: AuditActionType.Update,
          affectedType: 'registration_platform',
          affectedId: platform.id,
          affectedLabel: input.headcountSource,
          metadata: { importedHeadcount: input.importedHeadcount, source: input.headcountSource },
        });
      },
    });
  }

  mapRegistrationPlatform(platform: OpsRegistrationPlatform) {
    return {
      id: platform.id,
      eventId: platform.eventId,
      platformType: platform.platformType,
      supplierId: platform.supplierId,
      expectedPaxMin: platform.expectedPaxMin,
      expectedPaxMax: platform.expectedPaxMax,
      status: platform.status,
      setupConfirmedAt: platform.setupConfirmedAt?.toISOString() ?? null,
      setupNotes: platform.setupNotes,
      headcountSource: platform.headcountSource,
      importedHeadcount: platform.importedHeadcount,
      importedAt: platform.importedAt?.toISOString() ?? null,
      importedFileName: platform.importedFileName,
      createdAt: platform.createdAt.toISOString(),
      updatedAt: platform.updatedAt.toISOString(),
    };
  }
}
