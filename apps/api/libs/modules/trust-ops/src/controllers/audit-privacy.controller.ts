import { Body, Controller, ForbiddenException, Get, HttpCode, HttpStatus, Logger, Param, Patch, Post, Query } from '@nestjs/common';
import { AuditActionType, AuditCategory, OpsUserRole } from '@prism/modules/event-core';
import {
  CreatePrivacyRequestDto,
  ExecutePrivacyRequestDto,
  ExportAuditLogsDto,
  ListAuditLogsDto,
  ReviewPrivacyRequestDto,
  SampleActorDto,
} from '../dto/audit-privacy.dto';
import { AuditService } from '../services/audit.service';
import { PrivacyOperationsService } from '../services/privacy-operations.service';

type TrustActor = {
  id?: string;
  role: string;
  email?: string;
  name: string;
  clientName?: string;
  supplierId?: string;
  coordinatorId?: string;
};

function resolveActor(input: SampleActorDto = {}): TrustActor {
  const requestedRole = (input.actorRole ?? OpsUserRole.PmcmAdmin).trim().toLowerCase();
  const knownRoles = Object.values(OpsUserRole) as string[];
  const role = knownRoles.includes(requestedRole) ? requestedRole : OpsUserRole.Unknown;
  const name = input.actorName ?? input.clientName ?? (role === OpsUserRole.PmcmAdmin ? 'PMCM Admin' : role);
  return {
    id: input.actorId,
    role,
    email: input.actorEmail,
    name,
    clientName: input.clientName,
    supplierId: input.supplierId,
    coordinatorId: input.coordinatorId,
  };
}

class TrustRoutePolicy {
  private readonly logger = new Logger(TrustRoutePolicy.name);

  constructor(private readonly auditService: AuditService) {}

  async requireTrustOperator(actor: TrustActor, resource: string, eventId?: string) {
    if (actor.role === OpsUserRole.PmcmAdmin || actor.role === OpsUserRole.System) return;
    try {
      await this.auditService.audit(eventId, actor.name, `403 forbidden access: ${resource}`, {
        actorRole: actor.role,
        actorEmail: actor.email,
        actionType: AuditActionType.ForbiddenAccess,
        category: AuditCategory.Access,
        affectedType: 'scoped_read',
        affectedLabel: resource,
        severity: 'warning',
        metadata: {
          actorId: actor.id,
          role: actor.role,
          clientName: actor.clientName,
          supplierId: actor.supplierId,
          coordinatorId: actor.coordinatorId,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Forbidden access audit log could not be recorded: ${message}`);
    }
    throw new ForbiddenException(`${actor.role} cannot access ${resource}`);
  }
}

@Controller('audit')
export class OpsAuditController {
  private readonly policy: TrustRoutePolicy;

  constructor(private readonly auditService: AuditService) {
    this.policy = new TrustRoutePolicy(auditService);
  }

  @Get('logs')
  async listLogs(@Query() query: ListAuditLogsDto) {
    const actor = resolveActor(query);
    await this.policy.requireTrustOperator(actor, 'audit logs');
    return this.auditService.listAuditLogs(query);
  }

  @Post('export')
  @HttpCode(HttpStatus.OK)
  async exportLogs(@Body() dto: ExportAuditLogsDto) {
    const actor = resolveActor(dto);
    await this.policy.requireTrustOperator(actor, 'audit export');
    return this.auditService.exportAuditLogs(dto);
  }

  @Get('alerts')
  async listAlerts(@Query() actorInput: SampleActorDto) {
    const actor = resolveActor(actorInput);
    await this.policy.requireTrustOperator(actor, 'security alerts');
    return this.auditService.listSecurityAlerts();
  }

  @Get('integrity')
  async integrity(@Query() actorInput: SampleActorDto) {
    const actor = resolveActor(actorInput);
    await this.policy.requireTrustOperator(actor, 'audit integrity');
    return this.auditService.verifyIntegrity();
  }
}

@Controller('privacy')
export class OpsPrivacyController {
  private readonly policy: TrustRoutePolicy;

  constructor(
    private readonly privacyOperationsService: PrivacyOperationsService,
    auditService: AuditService,
  ) {
    this.policy = new TrustRoutePolicy(auditService);
  }

  @Get('inventory')
  async inventory(@Query() query: SampleActorDto & { eventId?: string }) {
    const actor = resolveActor(query);
    await this.policy.requireTrustOperator(actor, 'privacy inventory', query.eventId);
    return this.privacyOperationsService.getInventory(query);
  }

  @Get('retention-policies')
  async retentionPolicies(@Query() actorInput: SampleActorDto) {
    const actor = resolveActor(actorInput);
    await this.policy.requireTrustOperator(actor, 'privacy retention policies');
    return this.privacyOperationsService.listRetentionPolicies();
  }

  @Get('requests')
  async requests(@Query() query: SampleActorDto & { eventId?: string; status?: string }) {
    const actor = resolveActor(query);
    await this.policy.requireTrustOperator(actor, 'privacy requests', query.eventId);
    return this.privacyOperationsService.listRequests(query);
  }

  @Post('requests')
  @HttpCode(HttpStatus.CREATED)
  async createRequest(@Body() dto: CreatePrivacyRequestDto, @Query() actorInput: SampleActorDto) {
    const actor = resolveActor(actorInput);
    await this.policy.requireTrustOperator(actor, 'privacy requests', dto.eventId);
    return this.privacyOperationsService.createRequest(dto, { name: actor.name, role: actor.role });
  }

  @Patch('requests/:requestId/review')
  async reviewRequest(@Param('requestId') requestId: string, @Body() dto: ReviewPrivacyRequestDto, @Query() actorInput: SampleActorDto) {
    const actor = resolveActor(actorInput);
    await this.policy.requireTrustOperator(actor, 'privacy request review');
    return this.privacyOperationsService.reviewRequest(requestId, dto, { name: actor.name, role: actor.role });
  }

  @Post('requests/:requestId/execute')
  @HttpCode(HttpStatus.OK)
  async executeRequest(@Param('requestId') requestId: string, @Body() dto: ExecutePrivacyRequestDto, @Query() actorInput: SampleActorDto) {
    const actor = resolveActor(actorInput);
    await this.policy.requireTrustOperator(actor, 'privacy request execution');
    return this.privacyOperationsService.executeRequest(requestId, dto, { name: actor.name, role: actor.role });
  }
}
