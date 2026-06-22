import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { OpsSupplierQuoteRequest } from '@prisma/client';
import { PrismaService } from '@prism/database';
import {
  EventAccessPolicyService,
  type ResolvedEventOpsActor,
} from '@prism/modules/access-control';
import {
  AuditActionType,
  AuditCategory,
  isOpsConstantValue,
  OpsUserRole,
  SupplierVerificationStatus,
} from '@prism/modules/event-core';
import { CoordinatorsService } from '@prism/modules/staffing-ops';
import { mapSupplierQuoteRequest, SuppliersService } from '@prism/modules/supplier-ops';
import { AuditService } from '@prism/modules/trust-ops';
import {
  CreateEventDayTaskDto,
  CreateUrgentIssueDto,
  EscalateLiveOpsRecordDto,
  LiveOpsActorDto,
  ReplaceCoordinatorAssignmentDto,
  SupplierEventStatusDto,
  UpdateCoordinatorAttendanceDto,
  UpdateEventDayTaskDto,
  UpdateUrgentIssueDto,
  VerifySupplierStatusDto,
} from '../dto/live-ops.dto';
import {
  mapCoordinatorAssignmentForEventDay,
  mapEventDayTask,
  mapUrgentIssue,
} from '../mappers/live-ops.mappers';
import { LiveOperationsService } from './live-operations.service';

@Injectable()
export class EventLiveOpsCommandService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventAccessPolicyService: EventAccessPolicyService,
    private readonly liveOperationsService: LiveOperationsService,
    private readonly coordinatorsService: CoordinatorsService,
    private readonly suppliersService: SuppliersService,
    private readonly auditService: AuditService,
  ) {}

  async createEventDayTask(eventId: string, input: CreateEventDayTaskDto, actorInput: LiveOpsActorDto = {}) {
    const { actor } = await this.requireEventDayWriteActor(eventId, actorInput, 'event-day tasks');
    const task = await this.liveOperationsService.createEventDayTask(eventId, input, actor);
    return mapEventDayTask(task, this.liveOperationsService.computeSlaStatus.bind(this.liveOperationsService));
  }

  async updateEventDayTask(
    eventId: string,
    taskId: string,
    input: UpdateEventDayTaskDto,
    actorInput: LiveOpsActorDto = {},
  ) {
    const { actor } = await this.requireEventDayWriteActor(eventId, actorInput, 'event-day tasks');
    const task = await this.liveOperationsService.updateEventDayTask(eventId, taskId, input, actor);
    return mapEventDayTask(task, this.liveOperationsService.computeSlaStatus.bind(this.liveOperationsService));
  }

  async escalateEventDayTask(
    eventId: string,
    taskId: string,
    input: EscalateLiveOpsRecordDto,
    actorInput: LiveOpsActorDto = {},
  ) {
    const { actor } = await this.requireEventDayWriteActor(eventId, actorInput, 'event-day task escalation');
    const task = await this.liveOperationsService.escalateEventDayTask(eventId, taskId, input, actor);
    return mapEventDayTask(task, this.liveOperationsService.computeSlaStatus.bind(this.liveOperationsService));
  }

  async createUrgentIssue(eventId: string, input: CreateUrgentIssueDto, actorInput: LiveOpsActorDto = {}) {
    const { actor } = await this.requireEventDayWriteActor(eventId, actorInput, 'urgent issues');
    const issue = await this.liveOperationsService.createUrgentIssue(eventId, input, actor);
    return mapUrgentIssue(issue, this.liveOperationsService.computeSlaStatus.bind(this.liveOperationsService));
  }

  async updateUrgentIssue(
    eventId: string,
    issueId: string,
    input: UpdateUrgentIssueDto,
    actorInput: LiveOpsActorDto = {},
  ) {
    const { actor } = await this.requireEventDayWriteActor(eventId, actorInput, 'urgent issues');
    const issue = await this.liveOperationsService.updateUrgentIssue(eventId, issueId, input, actor);
    return mapUrgentIssue(issue, this.liveOperationsService.computeSlaStatus.bind(this.liveOperationsService));
  }

  async escalateUrgentIssue(
    eventId: string,
    issueId: string,
    input: EscalateLiveOpsRecordDto,
    actorInput: LiveOpsActorDto = {},
  ) {
    const { actor } = await this.requireEventDayWriteActor(eventId, actorInput, 'urgent issue escalation');
    const issue = await this.liveOperationsService.escalateUrgentIssue(eventId, issueId, input, actor);
    return mapUrgentIssue(issue, this.liveOperationsService.computeSlaStatus.bind(this.liveOperationsService));
  }

  async updateCoordinatorAttendance(
    eventId: string,
    assignmentId: string,
    input: UpdateCoordinatorAttendanceDto,
    actorInput: LiveOpsActorDto = {},
  ) {
    const { actor } = await this.requireEventDayWriteActor(eventId, actorInput, 'coordinator attendance');
    const assignment = await this.liveOperationsService.updateCoordinatorAttendance(eventId, assignmentId, input, actor);
    return mapCoordinatorAssignmentForEventDay(
      assignment,
      this.coordinatorsService.mapCoordinatorAssignment.bind(this.coordinatorsService),
    );
  }

  async replaceCoordinatorAssignment(
    eventId: string,
    assignmentId: string,
    input: ReplaceCoordinatorAssignmentDto,
    actorInput: LiveOpsActorDto = {},
  ) {
    const actor = this.eventAccessPolicyService.resolveActor(actorInput);
    await this.eventAccessPolicyService.requireActorRole(
      actor,
      [OpsUserRole.PmcmAdmin, OpsUserRole.System],
      'coordinator replacement',
      eventId,
    );
    const { replacedAssignment, replacementAssignment } =
      await this.liveOperationsService.replaceCoordinatorAssignment(eventId, assignmentId, input, actor);

    return {
      replacedAssignment: mapCoordinatorAssignmentForEventDay(
        replacedAssignment,
        this.coordinatorsService.mapCoordinatorAssignment.bind(this.coordinatorsService),
      ),
      replacementAssignment: mapCoordinatorAssignmentForEventDay(
        replacementAssignment,
        this.coordinatorsService.mapCoordinatorAssignment.bind(this.coordinatorsService),
      ),
    };
  }

  async verifySupplierEventStatus(
    eventId: string,
    requestId: string,
    input: VerifySupplierStatusDto,
    actorInput: LiveOpsActorDto = {},
  ) {
    const { actor } = await this.requireEventDayWriteActor(eventId, actorInput, 'supplier setup verification');
    const requestedStatus = input.verificationStatus?.trim();
    if (!isOpsConstantValue(SupplierVerificationStatus, requestedStatus)) {
      throw new BadRequestException('Unsupported supplier verification status');
    }
    const request = await this.prisma.opsSupplierQuoteRequest.findUnique({ where: { id: requestId } });
    if (request?.eventId !== eventId) throw new NotFoundException('Supplier quote request not found');
    const verifiedBy = actor.name;
    const updated = await this.prisma.opsSupplierQuoteRequest.update({
      where: { id: requestId },
      data: {
        eventDayVerificationStatus: requestedStatus,
        eventDayVerifiedAt: new Date(),
        eventDayVerifiedBy: verifiedBy,
        eventDayVerificationNotes: input.notes?.trim() ?? '',
      },
    });

    const metadata = { verificationStatus: requestedStatus, verifiedBy, notes: input.notes ?? '' };
    await Promise.all([
      this.liveOperationsService.recordEventDayLog(
        eventId,
        'supplier_status_verified',
        actor,
        `Marked supplier setup ${requestedStatus}: ${updated.supplierName}`,
        'supplier_quote_request',
        updated.id,
        metadata,
      ),
      this.auditService.audit(eventId, actor.name, `Marked supplier setup ${requestedStatus}: ${updated.supplierName}`, {
        actorRole: actor.role,
        actorEmail: actor.email,
        actionType: AuditActionType.Update,
        category: AuditCategory.Suppliers,
        affectedType: 'supplier_quote_request',
        affectedId: updated.id,
        affectedLabel: updated.supplierName,
        metadata,
      }),
    ]);

    return mapSupplierQuoteRequest(updated);
  }

  async updateSupplierEventStatus(
    requestId: string,
    input: SupplierEventStatusDto,
    actorInput: LiveOpsActorDto = {},
  ) {
    const actor = this.eventAccessPolicyService.resolveActor(actorInput);
    await this.eventAccessPolicyService.requireActorRole(actor, [OpsUserRole.Supplier], 'supplier event-day status');
    const allowed = ['arrived', 'set_up_ready', 'done_leaving'];
    if (!allowed.includes(input.status)) throw new BadRequestException('Unsupported supplier event-day status');

    const request = await this.requireSupplierQuoteRequestForActor(requestId, actor);
    const updated = await this.prisma.opsSupplierQuoteRequest.update({
      where: { id: request.id },
      data: {
        eventDayStatus: input.status,
        eventDayStatusAt: new Date(),
        eventDayNotes: input.notes?.trim() ?? '',
        statusPhotoFileName: input.photo?.fileName?.trim() || null,
      },
    });

    await Promise.all([
      this.liveOperationsService.recordEventDayLog(
        request.eventId,
        'supplier_status_updated',
        actor,
        `Supplier status update: ${input.status}`,
        'supplier_quote_request',
        request.id,
        { status: input.status, notes: input.notes ?? '', photoFileName: input.photo?.fileName ?? null },
      ),
      this.auditService.audit(request.eventId, actor.name, `Supplier status update: ${input.status}`, {
        actorRole: actor.role,
        actorEmail: actor.email,
        actionType: AuditActionType.Update,
        category: AuditCategory.Suppliers,
        affectedType: 'supplier_quote_request',
        affectedId: request.id,
        affectedLabel: request.supplierName,
        metadata: { status: input.status, notes: input.notes ?? '', photoFileName: input.photo?.fileName ?? null },
      }),
    ]);

    return mapSupplierQuoteRequest(updated);
  }

  private async requireEventDayWriteActor(eventId: string, actorInput: LiveOpsActorDto, resource: string) {
    const actor = this.eventAccessPolicyService.resolveActor(actorInput);
    await this.eventAccessPolicyService.requireActorRole(
      actor,
      [OpsUserRole.PmcmAdmin, OpsUserRole.System, OpsUserRole.Coordinator],
      resource,
      eventId,
    );
    await this.requireEvent(eventId);
    const assignment =
      actor.role === OpsUserRole.Coordinator
        ? await this.requireCoordinatorAssignmentForEvent(eventId, actor)
        : null;
    return { actor, assignment };
  }

  private async requireEvent(eventId: string) {
    const event = await this.prisma.opsEvent.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event not found');
    return event;
  }

  private async requireCoordinatorAssignmentForEvent(eventId: string, actor: ResolvedEventOpsActor) {
    const assignment = await this.coordinatorsService.findAssignmentForEventActor(eventId, actor);
    if (!assignment) {
      await this.eventAccessPolicyService.recordForbiddenAccess(actor, 'assigned event-day operations', eventId);
      throw new ForbiddenException('Coordinator is not assigned to this event');
    }
    return assignment;
  }

  private async requireSupplierQuoteRequestForActor(requestId: string, actor: ResolvedEventOpsActor) {
    const suppliers = await this.suppliersService.listSuppliers();
    const supplier = suppliers.find(
      (item) =>
        this.eventAccessPolicyService.sameText(actor.supplierId, item.id) ||
        this.eventAccessPolicyService.sameText(actor.email, item.email) ||
        this.eventAccessPolicyService.sameText(actor.name, item.name),
    );
    if (!supplier) throw new NotFoundException('Supplier profile not found for actor');

    const request = await this.prisma.opsSupplierQuoteRequest.findUnique({ where: { id: requestId } });
    if (!request || request.supplierId !== supplier.id) {
      await this.eventAccessPolicyService.recordForbiddenAccess(actor, 'supplier event-day status', request?.eventId);
      throw new ForbiddenException('Supplier cannot update this quote request');
    }
    return request as OpsSupplierQuoteRequest;
  }
}