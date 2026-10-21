import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, UseGuards, BadRequestException } from '@nestjs/common';
import { EventSessionGuard, VerifiedEventActor } from '@prism/kernel/event-session';
import { zodBody, zodQuery } from '@prism/kernel/shared';
import type { PrismVerifiedEventActor } from '@prism/types';
import {
  dismissPrivacyRetentionReviewItemSchema,
  executePrivacyRetentionReviewItemSchema,
  listPrivacyRetentionReviewItemsQuerySchema,
  privacyRetentionCategorySchema,
  updatePrivacyRetentionPolicySchema,
  type DismissPrivacyRetentionReviewItemInput,
  type ExecutePrivacyRetentionReviewItemInput,
  type ListPrivacyRetentionReviewItemsQuery,
  type PrivacyRetentionCategory,
  type UpdatePrivacyRetentionPolicyInput,
} from '@prism/types';
import { AuditService } from '../../application/trust/audit.service';
import { SecurityOperationsService } from '../../application/trust/security-operations.service';
import { PrivacyRetentionService } from '../../application/retention/privacy-retention.service';
import { resolveActor, TrustRoutePolicy } from './audit-privacy.controller';

function parseRetentionCategory(value: string): PrivacyRetentionCategory {
  const parsed = privacyRetentionCategorySchema.safeParse(value);
  if (!parsed.success) throw new BadRequestException('Unsupported privacy retention category');
  return parsed.data;
}

/** Privacy retention policies and the review queue. The sweep itself is scheduled, not exposed as a route. */
@Controller('privacy')
export class OpsPrivacyRetentionController {
  private readonly policy: TrustRoutePolicy;

  constructor(
    private readonly privacyRetentionService: PrivacyRetentionService,
    auditService: AuditService,
    securityOperationsService: SecurityOperationsService,
  ) {
    this.policy = new TrustRoutePolicy(auditService, securityOperationsService);
  }

  @Get('retention-policies')
  @UseGuards(EventSessionGuard)
  async retentionPolicies(@VerifiedEventActor() verifiedActor: PrismVerifiedEventActor) {
    const actor = resolveActor(verifiedActor);
    await this.policy.requireTrustOperator(actor, 'privacy retention policies');
    return this.privacyRetentionService.listPolicies();
  }

  @Patch('retention-policies/:category')
  @UseGuards(EventSessionGuard)
  async updateRetentionPolicy(
    @Param('category') category: string,
    @Body(zodBody(updatePrivacyRetentionPolicySchema)) dto: UpdatePrivacyRetentionPolicyInput,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    const actor = resolveActor(verifiedActor);
    await this.policy.requirePmcmAdmin(actor, 'privacy retention policy changes');
    return this.privacyRetentionService.updatePolicy(parseRetentionCategory(category), dto, actor);
  }

  @Get('retention-review-items')
  @UseGuards(EventSessionGuard)
  async retentionReviewItems(
    @Query(zodQuery(listPrivacyRetentionReviewItemsQuerySchema)) query: ListPrivacyRetentionReviewItemsQuery,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    const actor = resolveActor(verifiedActor);
    await this.policy.requireTrustOperator(actor, 'privacy retention review queue', query.eventId);
    return this.privacyRetentionService.listReviewItems(query);
  }

  @Post('retention-review-items/:itemId/execute')
  @HttpCode(HttpStatus.OK)
  @UseGuards(EventSessionGuard)
  async executeRetentionReviewItem(
    @Param('itemId') itemId: string,
    @Body(zodBody(executePrivacyRetentionReviewItemSchema)) dto: ExecutePrivacyRetentionReviewItemInput,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    const actor = resolveActor(verifiedActor);
    await this.policy.requireTrustOperator(actor, 'privacy retention review execution');
    return this.privacyRetentionService.executeReviewItem(itemId, dto, actor);
  }

  @Post('retention-review-items/:itemId/dismiss')
  @HttpCode(HttpStatus.OK)
  @UseGuards(EventSessionGuard)
  async dismissRetentionReviewItem(
    @Param('itemId') itemId: string,
    @Body(zodBody(dismissPrivacyRetentionReviewItemSchema)) dto: DismissPrivacyRetentionReviewItemInput,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    const actor = resolveActor(verifiedActor);
    await this.policy.requireTrustOperator(actor, 'privacy retention review dismissal');
    return this.privacyRetentionService.dismissReviewItem(itemId, dto, actor);
  }
}
