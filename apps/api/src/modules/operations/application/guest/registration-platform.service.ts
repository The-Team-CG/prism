import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { OpsRegistrationPlatform } from '@prisma/client';
import { PrismaService } from '@prism/kernel/database';
import { randomUUID } from 'node:crypto';
import { AuditActionType, AuditCategory, WorkflowCommandService } from '@prism/kernel/event-core';
import { AUDIT_WRITER, writeAudit, type AuditWriter } from '@prism/kernel/access-control';
import type { ResolvedEventOpsActor } from '@prism/kernel/access-control';
import type {
  CreateRegistrationPlatformInput,
  ImportHeadcountInput,
  PrismRegistrationPlatform,
  UpdateRegistrationPlatformInput,
} from '@prism/types';
import type { RegistrationPlatformReader } from '../../contracts/registration-platform-reader.port';
import type { PrismTransactionContext } from '@prism/kernel/shared-kernel';

@Injectable()
export class RegistrationPlatformService implements RegistrationPlatformReader {
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
        const current = await this.prisma.opsRegistrationPlatform.findUnique({ where: { eventId } });
        existed = Boolean(current);
        await this.validateAssignedSupplier(this.prisma, eventId, input.supplierId !== undefined ? input.supplierId : current?.supplierId);
        if (input.expectedPaxMin !== undefined && input.expectedPaxMax !== undefined && input.expectedPaxMin > input.expectedPaxMax) {
          throw new BadRequestException('Minimum expected headcount cannot exceed maximum');
        }
      },
      sideEffectMode: 'same_tx',
      validateStateInTransaction: async (transactionContext) => {
        await this.lockEvent(transactionContext, eventId);
        const current = await transactionContext.prisma.opsRegistrationPlatform.findUnique({ where: { eventId } });
        existed = Boolean(current);
        await this.validateAssignedSupplier(transactionContext.prisma, eventId, input.supplierId !== undefined ? input.supplierId : current?.supplierId);
        const min = input.expectedPaxMin ?? current?.expectedPaxMin ?? 0;
        const max = input.expectedPaxMax ?? current?.expectedPaxMax ?? 0;
        if (min > max) throw new BadRequestException('Minimum expected headcount cannot exceed maximum');
      },
      write: async (transactionContext) => {
        const db = this.transaction(transactionContext).prisma;
        if (existed) {
          return db.opsRegistrationPlatform.update({
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
        return db.opsRegistrationPlatform.create({
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
      sideEffects: async (platform, transactionContext) => {
        await writeAudit(this.auditWriter, eventId, actor.name, `Registration platform configured: ${input.platformType}`, {
          actorRole: actor.role,
          category: AuditCategory.Events,
          actionType: existed ? AuditActionType.Update : AuditActionType.Create,
          affectedType: 'registration_platform',
          affectedId: platform.id,
          affectedLabel: input.platformType,
          metadata: { platformType: input.platformType, supplierId: input.supplierId },
        }, transactionContext);
      },
    });
  }

  async update(eventId: string, input: UpdateRegistrationPlatformInput, actor: ResolvedEventOpsActor): Promise<OpsRegistrationPlatform> {
    const existing = await this.prisma.opsRegistrationPlatform.findUnique({ where: { eventId } });
    if (!existing) throw new NotFoundException('Registration platform not configured for this event');

    return this.workflowCommandService.execute<OpsRegistrationPlatform>({
      name: 'registration_platform_update',
      sideEffectMode: 'same_tx',
      validateState: async () => {
        await this.validateAssignedSupplier(this.prisma, eventId, input.supplierId !== undefined ? input.supplierId : existing.supplierId);
        const effectiveMin = input.expectedPaxMin ?? existing.expectedPaxMin;
        const effectiveMax = input.expectedPaxMax ?? existing.expectedPaxMax;
        if (effectiveMin > effectiveMax) {
          throw new BadRequestException('Minimum expected headcount cannot exceed maximum');
        }
        if (input.status && !isAllowedTransition(existing.status, input.status)) {
          throw new BadRequestException(`Invalid registration platform transition: ${existing.status} to ${input.status}`);
        }
        if (input.status === 'live' && !(input.supplierId ?? existing.supplierId)) {
          throw new BadRequestException('A selected Digital Registration supplier is required before going live');
        }
      },
      validateStateInTransaction: async (transactionContext) => {
        await this.lockEvent(transactionContext, eventId);
        const current = await transactionContext.prisma.opsRegistrationPlatform.findUnique({ where: { eventId } });
        if (!current || current.status !== existing.status) throw new ConflictException('Registration platform changed; retry the command');
        await this.validateAssignedSupplier(transactionContext.prisma, eventId, input.supplierId !== undefined ? input.supplierId : current.supplierId);
        const min = input.expectedPaxMin ?? current.expectedPaxMin;
        const max = input.expectedPaxMax ?? current.expectedPaxMax;
        if (min > max) throw new BadRequestException('Minimum expected headcount cannot exceed maximum');
      },
      write: (transactionContext) => {
        const db = this.transaction(transactionContext).prisma;
        const data = {
          ...(input.platformType !== undefined && { platformType: input.platformType }),
          ...(input.supplierId !== undefined && { supplierId: input.supplierId }),
          ...(input.expectedPaxMin !== undefined && { expectedPaxMin: input.expectedPaxMin }),
          ...(input.expectedPaxMax !== undefined && { expectedPaxMax: input.expectedPaxMax }),
          ...(input.status !== undefined && {
            status: input.status,
            ...(input.status === 'live' && !existing.setupConfirmedAt && { setupConfirmedAt: new Date() }),
          }),
          ...(input.setupNotes !== undefined && { setupNotes: input.setupNotes }),
        };
        return db.opsRegistrationPlatform.updateMany({ where: { eventId, status: existing.status }, data }).then(async (result: { count: number }) => {
          if (result.count !== 1) throw new ConflictException('Registration platform changed; retry the command');
          const updated = await db.opsRegistrationPlatform.findUnique({ where: { eventId } });
          if (!updated) throw new NotFoundException('Registration platform not found after update');
          return updated;
        });
      },
      sideEffects: async (platform, transactionContext) => {
        await writeAudit(this.auditWriter, eventId, actor.name, `Registration platform updated: ${platform.platformType}`, {
          actorRole: actor.role,
          category: AuditCategory.Events,
          actionType: AuditActionType.Update,
          affectedType: 'registration_platform',
          affectedId: platform.id,
          affectedLabel: platform.platformType,
          metadata: input,
        }, transactionContext);
      },
    });
  }

  async importHeadcount(eventId: string, input: ImportHeadcountInput, actor: ResolvedEventOpsActor): Promise<OpsRegistrationPlatform> {
    const [existing, event] = await Promise.all([
      this.prisma.opsRegistrationPlatform.findUnique({ where: { eventId } }),
      this.prisma.opsEvent.findUnique({ where: { id: eventId }, select: { id: true, status: true, archived: true, actualEndedAt: true } }),
    ]);
    if (!existing) throw new NotFoundException('Registration platform not configured for this event');
    if (!event) throw new NotFoundException('Event not found');
    if (existing.status !== 'closed') {
      throw new BadRequestException('Import headcount after the registration platform is closed');
    }
    if (!event.actualEndedAt) {
      throw new BadRequestException('Import headcount after the actual event end is recorded');
    }

    return this.workflowCommandService.execute<OpsRegistrationPlatform>({
      name: 'registration_headcount_import',
      sideEffectMode: 'same_tx',
      validateState: async () => {
        if (input.importedHeadcount < 0) throw new BadRequestException('Headcount must be non-negative');
      },
      validateStateInTransaction: async (context) => {
        await this.lockEvent(context, eventId);
        const current = await context.prisma.opsRegistrationPlatform.findUnique({ where: { eventId } });
        const currentEvent = await context.prisma.opsEvent.findUnique({ where: { id: eventId }, select: { actualEndedAt: true } });
        if (!current || current.status !== 'closed' || !currentEvent?.actualEndedAt) throw new ConflictException('Platform or event state changed; refresh before importing');
        await this.validateAssignedSupplier(context.prisma, eventId, current.supplierId);
      },
      write: (context) =>
        this.transaction(context).prisma.opsRegistrationPlatform.update({
          where: { eventId },
          data: {
            headcountSource: input.headcountSource,
            importedHeadcount: input.importedHeadcount,
            importedFileName: input.importedFileName ?? null,
            importedAt: new Date(),
          },
        }),
      sideEffects: async (platform, transactionContext) => {
        await writeAudit(this.auditWriter, eventId, actor.name, `Headcount imported: ${input.importedHeadcount} guests from ${input.headcountSource}`, {
          actorRole: actor.role,
          category: AuditCategory.Events,
          actionType: AuditActionType.Update,
          affectedType: 'registration_platform',
          affectedId: platform.id,
          affectedLabel: input.headcountSource,
          metadata: { importedHeadcount: input.importedHeadcount, source: input.headcountSource },
        }, transactionContext);
      },
    });
  }

  private transaction(context?: PrismTransactionContext): PrismTransactionContext {
    if (!context) throw new ConflictException('Transactional registration context is unavailable');
    return context;
  }

  private async lockEvent(context: PrismTransactionContext, eventId: string) {
    // QUERY_AUDIT_RAW_SQL: parameterized row lock serializes event registration commands with lifecycle changes.
    await context.prisma.$queryRaw`SELECT id FROM event_core.events WHERE id = ${eventId} FOR UPDATE`;
  }

  private async validateAssignedSupplier(db: Pick<PrismaService, 'opsSupplier' | 'opsSupplierQuoteRequest'>, eventId: string, supplierId?: string | null): Promise<void> {
    if (!supplierId) throw new BadRequestException('A selected Digital Registration supplier is required');
    const supplier = await db.opsSupplier.findUnique({
      where: { id: supplierId },
      include: { category: true },
    });
    const categoryLabel = supplier?.category?.name ?? supplier?.category?.slug ?? '';
    const normalizedCategory = categoryLabel.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!supplier || !['digitalregistration', 'registration'].includes(normalizedCategory)) {
      throw new BadRequestException('Supplier must belong to the Digital Registration category');
    }
    const assignment = await db.opsSupplierQuoteRequest.findFirst({
      where: {
        eventId,
        supplierId,
        status: 'selected',
      },
    });
    if (!assignment) {
      throw new BadRequestException('Supplier must be selected for Digital Registration on this event');
    }
  }

  mapRegistrationPlatform(platform: OpsRegistrationPlatform): PrismRegistrationPlatform {
    return {
      id: platform.id,
      eventId: platform.eventId,
      platformType: platform.platformType as PrismRegistrationPlatform["platformType"],
      supplierId: platform.supplierId,
      expectedPaxMin: platform.expectedPaxMin,
      expectedPaxMax: platform.expectedPaxMax,
      status: platform.status as PrismRegistrationPlatform["status"],
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

const ALLOWED_TRANSITIONS: Record<string, readonly string[]> = {
  not_started: ['not_started', 'configuring'],
  configuring: ['configuring', 'live'],
  live: ['live', 'closed'],
  closed: ['closed'],
};

function isAllowedTransition(current: string, next: string): boolean {
  return ALLOWED_TRANSITIONS[current]?.includes(next) ?? false;
}
