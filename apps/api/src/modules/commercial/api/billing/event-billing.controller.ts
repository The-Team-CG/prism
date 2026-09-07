import { Body, Controller, HttpCode, HttpStatus, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { EventAccessPolicyService } from '@prism/kernel/access-control';
import { OpsUserRole } from '@prism/kernel/event-core';
import { EventSessionGuard, VerifiedEventActor } from '@prism/kernel/event-session';
import type { PrismVerifiedEventActor } from '@prism/types';
import {
  ApproveBillingSourceDto,
  CreateBillingSourceDto,
  GenerateBillingStatementDto,
  MarkPaymentDto,
  RecordPaymentDto,
} from './billing.dto';
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
    @Body() dto: CreateBillingSourceDto,
    @VerifiedEventActor() verifiedActor: unknown,
  ) {
    const actor = await this.requireFinanceActor(verifiedActor, 'billing source', eventId);
    return this.billingOperationsService.createBillingSource(eventId, dto, actor);
  }

  @Patch(':eventId/billing-source/:sourceId/approve')
  @UseGuards(EventSessionGuard)
  async approveBillingSource(
    @Param('eventId') eventId: string,
    @Param('sourceId') sourceId: string,
    @Body() dto: ApproveBillingSourceDto,
    @VerifiedEventActor() verifiedActor: unknown,
  ) {
    const actor = await this.requireFinanceActor(verifiedActor, 'billing source approval', eventId);
    return this.billingOperationsService.approveBillingSource(eventId, sourceId, dto, actor);
  }

  @Post(':eventId/billing-statements/generate')
  @UseGuards(EventSessionGuard)
  @HttpCode(HttpStatus.CREATED)
  async generateBillingStatement(
    @Param('eventId') eventId: string,
    @Body() dto: GenerateBillingStatementDto = {},
    @VerifiedEventActor() verifiedActor: unknown,
  ) {
    const actor = await this.requireFinanceActor(verifiedActor, 'billing statement', eventId);
    return this.billingOperationsService.generateBillingStatement(eventId, dto.sourceId, actor);
  }

  @Patch(':eventId/payments/:milestoneId')
  @UseGuards(EventSessionGuard)
  async markPayment(
    @Param('eventId') eventId: string,
    @Param('milestoneId') milestoneId: string,
    @Body() dto: MarkPaymentDto,
    @VerifiedEventActor() verifiedActor: unknown,
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
    @Body() dto: RecordPaymentDto,
    @VerifiedEventActor() verifiedActor: unknown,
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
    @VerifiedEventActor() verifiedActor: unknown,
  ) {
    const actor = await this.requireFinanceActor(verifiedActor, 'billing statement delivery', eventId);
    return this.billingOperationsService.sendBillingStatement(eventId, billingId, actor);
  }

  private async requireFinanceActor(verifiedActor: unknown, resource: string, eventId: string) {
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor as PrismVerifiedEventActor);
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
