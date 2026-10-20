import { Body, Controller, ForbiddenException, Get, HttpCode, HttpStatus, Logger, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import type { ResolvedEventOpsActor } from '@prism/kernel/access-control';
import { AuditActionType, AuditCategory, OpsUserRole } from '@prism/kernel/event-core';
import { EventSessionGuard, VerifiedEventActor } from '@prism/kernel/event-session';
import type { PrismVerifiedEventActor } from '@prism/types';
import { zodBody, zodQuery } from '@prism/kernel/shared';
import { auditLogFiltersSchema, createPrivacyRequestSchema, reviewPrivacyRequestSchema, executePrivacyRequestSchema, createPrivacyLegalHoldSchema, releasePrivacyLegalHoldSchema, listPrivacyLegalHoldsQuerySchema, type AuditLogFilters, type CreatePrivacyRequestInput, type ReviewPrivacyRequestInput, type ExecutePrivacyRequestInput, type CreatePrivacyLegalHoldInput, type ReleasePrivacyLegalHoldInput, type ListPrivacyLegalHoldsQuery } from '@prism/types';
import { AuditService } from '../../application/trust/audit.service';
import { AuditExportService } from '../../application/trust/audit-export.service';
import { AuditReadService } from '../../application/trust/audit-read.service';
import { PrivacyOperationsService } from '../../application/trust/privacy-operations.service';
import { SecurityOperationsService } from '../../application/trust/security-operations.service';

type TrustActor = ResolvedEventOpsActor;

export function resolveActor(input: PrismVerifiedEventActor): TrustActor {
  const role = input.actorRole;
  const name = input.actorName;
  return {
    id: input.actorId,
    role,
    email: input.actorEmail,
    name,
    explicit: true,
    verified: true,
  };
}

export class TrustRoutePolicy {
  private readonly logger = new Logger(TrustRoutePolicy.name);

  constructor(
    private readonly auditService: AuditService,
    private readonly securityOperationsService: SecurityOperationsService,
  ) {}

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
      if (typeof this.securityOperationsService.recordIntegrityIncident === 'function') {
        try {
          await this.securityOperationsService.recordIntegrityIncident({
            source: 'trust-route.forbidden-access',
            reason: message,
            eventId,
            actor: actor.name,
            metadata: { resource, actorId: actor.id, role: actor.role, email: actor.email },
          });
        } catch (incidentError) {
          const incidentMessage = incidentError instanceof Error ? incidentError.message : String(incidentError);
          this.logger.error(`Audit integrity incident could not be persisted: ${incidentMessage}`);
        }
      }
    }
    throw new ForbiddenException(`${actor.role} cannot access ${resource}`);
  }

  async requirePmcmAdmin(actor: TrustActor, resource: string) {
    if (actor.role === OpsUserRole.PmcmAdmin) return;
    if (actor.role !== OpsUserRole.System) return this.requireTrustOperator(actor, resource);
    await this.auditService.audit(undefined, actor.name, `403 forbidden access: ${resource}`, {
      actorRole: actor.role,
      actorEmail: actor.email,
      actionType: AuditActionType.ForbiddenAccess,
      category: AuditCategory.Access,
      affectedType: 'scoped_write',
      affectedLabel: resource,
      severity: 'warning',
      metadata: { actorId: actor.id, role: actor.role },
    });
    throw new ForbiddenException('Only a PMCM administrator may manage legal holds');
  }
}

@Controller('audit')
export class OpsAuditController {
  private readonly policy: TrustRoutePolicy;

  constructor(
    private readonly auditService: AuditService,
    private readonly auditReadService: AuditReadService,
    private readonly auditExportService: AuditExportService,
    private readonly securityOperationsService: SecurityOperationsService,
  ) {
    this.policy = new TrustRoutePolicy(auditService, securityOperationsService);
  }

  @Get('logs')
  @UseGuards(EventSessionGuard)
  async listLogs(@Query(zodQuery(auditLogFiltersSchema)) query: AuditLogFilters, @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor) {
    const actor = resolveActor(verifiedActor);
    await this.policy.requireTrustOperator(actor, 'audit logs');
    return this.auditReadService.listAuditLogs(query);
  }

  @Post('export')
  @UseGuards(EventSessionGuard)
  @HttpCode(HttpStatus.OK)
  async exportLogs(@Body(zodBody(auditLogFiltersSchema)) dto: AuditLogFilters, @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor) {
    const actor = resolveActor(verifiedActor);
    await this.policy.requireTrustOperator(actor, 'audit export');
    return this.auditExportService.exportAuditLogs(dto, verifiedActor);
  }

  @Get('alerts')
  @UseGuards(EventSessionGuard)
  async listAlerts(@VerifiedEventActor() verifiedActor: PrismVerifiedEventActor) {
    const actor = resolveActor(verifiedActor);
    await this.policy.requireTrustOperator(actor, 'security alerts');
    return this.securityOperationsService.listSecurityAlerts();
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
    securityOperationsService: SecurityOperationsService,
  ) {
    this.policy = new TrustRoutePolicy(auditService, securityOperationsService);
  }

  @Get('inventory')
  @UseGuards(EventSessionGuard)
  async inventory(@Query() query: { eventId?: string }, @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor) {
    const actor = resolveActor(verifiedActor);
    await this.policy.requireTrustOperator(actor, 'privacy inventory', query.eventId);
    return this.privacyOperationsService.getInventory(query);
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
    return this.privacyOperationsService.createRequest(dto, actor);
  }

  @Patch('requests/:requestId/review')
  @UseGuards(EventSessionGuard)
  async reviewRequest(@Param('requestId') requestId: string, @Body(zodBody(reviewPrivacyRequestSchema)) dto: ReviewPrivacyRequestInput, @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor) {
    const actor = resolveActor(verifiedActor);
    await this.policy.requireTrustOperator(actor, 'privacy request review');
    return this.privacyOperationsService.reviewRequest(requestId, dto, actor);
  }

  @Post('requests/:requestId/execute')
  @HttpCode(HttpStatus.OK)
  @UseGuards(EventSessionGuard)
  async executeRequest(@Param('requestId') requestId: string, @Body(zodBody(executePrivacyRequestSchema)) dto: ExecutePrivacyRequestInput, @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor) {
    const actor = resolveActor(verifiedActor);
    await this.policy.requireTrustOperator(actor, 'privacy request execution');
    return this.privacyOperationsService.executeRequest(requestId, dto, actor);
  }

  @Post('legal-holds')
  @UseGuards(EventSessionGuard)
  @HttpCode(HttpStatus.CREATED)
  async createLegalHold(@Body(zodBody(createPrivacyLegalHoldSchema)) dto: CreatePrivacyLegalHoldInput, @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor) {
    const actor = resolveActor(verifiedActor);
    await this.policy.requirePmcmAdmin(actor, 'privacy legal hold placement');
    return this.privacyOperationsService.createLegalHold(dto, actor);
  }

  @Get('legal-holds')
  @UseGuards(EventSessionGuard)
  async legalHolds(@Query(zodQuery(listPrivacyLegalHoldsQuerySchema)) query: ListPrivacyLegalHoldsQuery, @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor) {
    const actor = resolveActor(verifiedActor);
    await this.policy.requirePmcmAdmin(actor, 'privacy legal hold inventory');
    return this.privacyOperationsService.listLegalHolds(query);
  }

  @Post('legal-holds/:holdId/release')
  @UseGuards(EventSessionGuard)
  async releaseLegalHold(@Param('holdId') holdId: string, @Body(zodBody(releasePrivacyLegalHoldSchema)) dto: ReleasePrivacyLegalHoldInput, @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor) {
    const actor = resolveActor(verifiedActor);
    await this.policy.requirePmcmAdmin(actor, 'privacy legal hold release');
    return this.privacyOperationsService.releaseLegalHold(holdId, dto, actor);
  }
}
