import { Body, Controller, ForbiddenException, Get, HttpCode, HttpStatus, Logger, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AuditActionType, AuditCategory, OpsUserRole } from '@prism/kernel/event-core';
import { EventSessionGuard, VerifiedEventActor } from '@prism/kernel/event-session';
import type { PrismVerifiedEventActor } from '@prism/types';
import { zodBody, zodQuery } from '@prism/kernel/shared';
import { auditLogFiltersSchema, createPrivacyRequestSchema, reviewPrivacyRequestSchema, executePrivacyRequestSchema, type AuditLogFilters, type CreatePrivacyRequestInput, type ReviewPrivacyRequestInput, type ExecutePrivacyRequestInput } from '@prism/types';
import {
  CreatePrivacyRequestDto,
  ExecutePrivacyRequestDto,
  ExportAuditLogsDto,
  ListAuditLogsDto,
  ReviewPrivacyRequestDto,
  SampleActorDto,
} from './audit-privacy.dto';
import { AuditService } from '../../application/trust/audit.service';
import { PrivacyOperationsService } from '../../application/trust/privacy-operations.service';

type TrustActor = {
  id?: string;
  role: string;
  email?: string;
  name: string;
  clientName?: string;
  supplierId?: string;
  coordinatorId?: string;
};

function resolveActor(input: PrismVerifiedEventActor): TrustActor {
  const role = input.role;
  const name = input.name;
  return {
    id: input.id,
    role,
    email: input.email,
    name,
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
  @UseGuards(EventSessionGuard)
  async listLogs(@Query(zodQuery(auditLogFiltersSchema)) query: AuditLogFilters, @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor) {
    const actor = resolveActor(verifiedActor);
    await this.policy.requireTrustOperator(actor, 'audit logs');
    return this.auditService.listAuditLogs(query);
  }

  @Post('export')
  @UseGuards(EventSessionGuard)
  @HttpCode(HttpStatus.OK)
  async exportLogs(@Body(zodBody(auditLogFiltersSchema)) dto: AuditLogFilters, @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor) {
    const actor = resolveActor(verifiedActor);
    await this.policy.requireTrustOperator(actor, 'audit export');
    return this.auditService.exportAuditLogs(dto);
  }

  @Get('alerts')
  @UseGuards(EventSessionGuard)
  async listAlerts(@VerifiedEventActor() verifiedActor: PrismVerifiedEventActor) {
    const actor = resolveActor(verifiedActor);
    await this.policy.requireTrustOperator(actor, 'security alerts');
    return this.auditService.listSecurityAlerts();
  }

  @Get('integrity')
  @UseGuards(EventSessionGuard)
  async integrity(@VerifiedEventActor() verifiedActor: PrismVerifiedEventActor) {
    const actor = resolveActor(verifiedActor);
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
  @UseGuards(EventSessionGuard)
  async inventory(@Query() query: { eventId?: string }, @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor) {
    const actor = resolveActor(verifiedActor);
    await this.policy.requireTrustOperator(actor, 'privacy inventory', query.eventId);
    return this.privacyOperationsService.getInventory(query);
  }

  @Get('retention-policies')
  @UseGuards(EventSessionGuard)
  async retentionPolicies(@VerifiedEventActor() verifiedActor: PrismVerifiedEventActor) {
    const actor = resolveActor(verifiedActor);
    await this.policy.requireTrustOperator(actor, 'privacy retention policies');
    return this.privacyOperationsService.listRetentionPolicies();
  }

  @Get('requests')
  @UseGuards(EventSessionGuard)
  async requests(@Query() query: { eventId?: string; status?: string }, @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor) {
    const actor = resolveActor(verifiedActor);
    await this.policy.requireTrustOperator(actor, 'privacy requests', query.eventId);
    return this.privacyOperationsService.listRequests(query);
  }

  @Post('requests')
  @UseGuards(EventSessionGuard)
  @HttpCode(HttpStatus.CREATED)
  async createRequest(@Body(zodBody(createPrivacyRequestSchema)) dto: CreatePrivacyRequestInput, @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor) {
    const actor = resolveActor(verifiedActor);
    await this.policy.requireTrustOperator(actor, 'privacy requests', dto.eventId);
    return this.privacyOperationsService.createRequest(dto, { name: actor.name, role: actor.role });
  }

  @Patch('requests/:requestId/review')
  @UseGuards(EventSessionGuard)
  async reviewRequest(@Param('requestId') requestId: string, @Body(zodBody(reviewPrivacyRequestSchema)) dto: ReviewPrivacyRequestInput, @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor) {
    const actor = resolveActor(verifiedActor);
    await this.policy.requireTrustOperator(actor, 'privacy request review');
    return this.privacyOperationsService.reviewRequest(requestId, dto, { name: actor.name, role: actor.role });
  }

  @Post('requests/:requestId/execute')
  @HttpCode(HttpStatus.OK)
  @UseGuards(EventSessionGuard)
  async executeRequest(@Param('requestId') requestId: string, @Body(zodBody(executePrivacyRequestSchema)) dto: ExecutePrivacyRequestInput, @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor) {
    const actor = resolveActor(verifiedActor);
    await this.policy.requireTrustOperator(actor, 'privacy request execution');
    return this.privacyOperationsService.executeRequest(requestId, dto, { name: actor.name, role: actor.role });
  }
}
