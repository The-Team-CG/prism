import { Body, Controller, HttpCode, HttpStatus, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { EventAccessPolicyService } from '@prism/kernel/access-control';
import { OpsUserRole } from '@prism/kernel/event-core';
import { EventSessionGuard, VerifiedEventActor } from '@prism/kernel/event-session';
import { zodBody } from '@prism/kernel/shared';
import {
  approveBillingSourceSchema,
  createBillingSourceSchema,
  generateBillingStatementSchema,
  markPaymentSchema,
  recordPaymentSchema,
  requestBillingCorrectionSchema,
  resolveBillingCorrectionSchema,
  createBillingDisputeSchema,
  resolveBillingDisputeSchema,
  createAdditionalBillingSchema,
  waiveAdditionalBillingSchema,
  type ApproveBillingSourceInput,
  type CreateBillingSourceInput,
  type GenerateBillingStatementInput,
  type MarkPaymentInput,
  type PrismVerifiedEventActor,
  type RecordPaymentInput,
  type RequestBillingCorrectionInput,
  type ResolveBillingCorrectionInput,
  type CreateBillingDisputeInput,
  type ResolveBillingDisputeInput,
  type CreateAdditionalBillingInput,
  type WaiveAdditionalBillingInput,
} from '@prism/types';
import { BillingOperationsService } from '../../application/billing/billing-operations.service';

@Controller('events')
export class OpsEventBillingController {
  constructor(
    private readonly billingOperationsService: BillingOperationsService,
    private readonly eventAccessPolicyService: EventAccessPolicyService,
  ) {}

  @Post(':eventId/billing-source')
  @UseGuards(EventSessionGuard)
  @HttpCode(HttpStatus.CREATED)
  async createBillingSource(
    @Param('eventId') eventId: string,
    @Body(zodBody(createBillingSourceSchema)) dto: CreateBillingSourceInput,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    const actor = await this.requireFinanceActor(verifiedActor, 'billing source', eventId);
    return this.billingOperationsService.createBillingSource(eventId, dto, actor);
  }

  @Patch(':eventId/billing-source/:sourceId/approve')
  @UseGuards(EventSessionGuard)
  async approveBillingSource(
    @Param('eventId') eventId: string,
    @Param('sourceId') sourceId: string,
    @Body(zodBody(approveBillingSourceSchema)) dto: ApproveBillingSourceInput,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    const actor = await this.requireFinanceActor(verifiedActor, 'billing source approval', eventId);
    return this.billingOperationsService.approveBillingSource(eventId, sourceId, dto, actor);
  }

  @Post(':eventId/billing-statements/generate')
  @UseGuards(EventSessionGuard)
  @HttpCode(HttpStatus.CREATED)
  async generateBillingStatement(
    @Param('eventId') eventId: string,
    @Body(zodBody(generateBillingStatementSchema)) dto: GenerateBillingStatementInput,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    const actor = await this.requireFinanceActor(verifiedActor, 'billing statement', eventId);
    return dto.idempotencyKey
      ? this.billingOperationsService.generateBillingStatement(eventId, dto.sourceId, actor, dto.idempotencyKey)
      : this.billingOperationsService.generateBillingStatement(eventId, dto.sourceId, actor);
  }

  @Patch(':eventId/payments/:milestoneId')
  @UseGuards(EventSessionGuard)
  async markPayment(
    @Param('eventId') eventId: string,
    @Param('milestoneId') milestoneId: string,
    @Body(zodBody(markPaymentSchema)) dto: MarkPaymentInput,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    const actor = await this.requireFinanceActor(verifiedActor, 'payment milestone', eventId);
    return this.billingOperationsService.markPayment(eventId, milestoneId, dto.status, actor);
  }

  @Post(':eventId/payments/:milestoneId/records')
  @UseGuards(EventSessionGuard)
  @HttpCode(HttpStatus.CREATED)
  async recordPayment(
    @Param('eventId') eventId: string,
    @Param('milestoneId') milestoneId: string,
    @Body(zodBody(recordPaymentSchema)) dto: RecordPaymentInput,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    const actor = await this.requireFinanceActor(verifiedActor, 'payment recording', eventId);
    return this.billingOperationsService.recordPayment(eventId, milestoneId, dto, actor);
  }

  @Post(':eventId/billing-statements/:billingId/send')
  @UseGuards(EventSessionGuard)
  @HttpCode(HttpStatus.OK)
  async sendBillingStatement(
    @Param('eventId') eventId: string,
    @Param('billingId') billingId: string,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    const actor = await this.requireFinanceActor(verifiedActor, 'billing statement delivery', eventId);
    return this.billingOperationsService.sendBillingStatement(eventId, billingId, actor);
  }

  @Post(':eventId/billing-corrections')
  @UseGuards(EventSessionGuard)
  @HttpCode(HttpStatus.CREATED)
  async requestBillingCorrection(@Param('eventId') eventId: string, @Body(zodBody(requestBillingCorrectionSchema)) dto: RequestBillingCorrectionInput, @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor) {
    const actor = await this.requireFinanceActor(verifiedActor, 'billing correction', eventId);
    return this.billingOperationsService.requestBillingCorrection(eventId, dto, actor);
  }

  @Patch(':eventId/billing-corrections/:correctionId')
  @UseGuards(EventSessionGuard)
  async resolveBillingCorrection(@Param('eventId') eventId: string, @Param('correctionId') correctionId: string, @Body(zodBody(resolveBillingCorrectionSchema)) dto: ResolveBillingCorrectionInput, @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor) {
    const actor = await this.requireFinanceActor(verifiedActor, 'billing correction resolution', eventId);
    return this.billingOperationsService.resolveBillingCorrection(eventId, correctionId, dto, actor);
  }

  @Post(':eventId/billing-disputes')
  @UseGuards(EventSessionGuard)
  @HttpCode(HttpStatus.CREATED)
  async createBillingDispute(@Param('eventId') eventId: string, @Body(zodBody(createBillingDisputeSchema)) dto: CreateBillingDisputeInput, @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor) {
    const actor = await this.requireFinanceActor(verifiedActor, 'billing dispute', eventId);
    return this.billingOperationsService.createBillingDispute(eventId, dto, actor);
  }

  @Patch(':eventId/billing-disputes/:disputeId')
  @UseGuards(EventSessionGuard)
  async resolveBillingDispute(@Param('eventId') eventId: string, @Param('disputeId') disputeId: string, @Body(zodBody(resolveBillingDisputeSchema)) dto: ResolveBillingDisputeInput, @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor) {
    const actor = await this.requireFinanceActor(verifiedActor, 'billing dispute resolution', eventId);
    return this.billingOperationsService.resolveBillingDispute(eventId, disputeId, dto, actor);
  }

  @Post(':eventId/additional-billing')
  @UseGuards(EventSessionGuard)
  @HttpCode(HttpStatus.CREATED)
  async createAdditionalBilling(@Param('eventId') eventId: string, @Body(zodBody(createAdditionalBillingSchema)) dto: CreateAdditionalBillingInput, @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor) {
    const actor = await this.requireFinanceActor(verifiedActor, 'additional billing', eventId);
    return this.billingOperationsService.createAdditionalBilling(eventId, dto, actor);
  }

  @Patch(':eventId/additional-billing/:additionalBillingId/waive')
  @UseGuards(EventSessionGuard)
  async waiveAdditionalBilling(@Param('eventId') eventId: string, @Param('additionalBillingId') additionalBillingId: string, @Body(zodBody(waiveAdditionalBillingSchema)) dto: WaiveAdditionalBillingInput, @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor) {
    const actor = await this.requireFinanceActor(verifiedActor, 'additional billing waiver', eventId);
    return this.billingOperationsService.waiveAdditionalBilling(eventId, additionalBillingId, dto, actor);
  }

  private async requireFinanceActor(verifiedActor: PrismVerifiedEventActor, resource: string, eventId: string) {
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
    await this.eventAccessPolicyService.requireActorRole(
      actor,
      [OpsUserRole.PmcmAdmin, OpsUserRole.System],
      resource,
      eventId,
    );
    return {
      name: actor.name,
      role: actor.role,
      email: actor.email,
    };
  }
}
