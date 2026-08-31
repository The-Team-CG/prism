import { Body, Controller, HttpCode, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common';
import { EventAccessPolicyService } from '@prism/modules/access-control';
import { OpsUserRole } from '@prism/modules/event-core';
import {
  ApproveBillingSourceDto,
  BillingActorDto,
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
  @HttpCode(HttpStatus.CREATED)
  async createBillingSource(
    @Param('eventId') eventId: string,
    @Body() dto: CreateBillingSourceDto,
    @Query() actorInput: BillingActorDto,
  ) {
    const actor = await this.requireFinanceActor(actorInput, 'billing source', eventId);
    return this.billingOperationsService.createBillingSource(eventId, dto, actor);
  }

  @Patch(':eventId/billing-source/:sourceId/approve')
  async approveBillingSource(
    @Param('eventId') eventId: string,
    @Param('sourceId') sourceId: string,
    @Body() dto: ApproveBillingSourceDto,
    @Query() actorInput: BillingActorDto,
  ) {
    const actor = await this.requireFinanceActor(actorInput, 'billing source approval', eventId);
    return this.billingOperationsService.approveBillingSource(eventId, sourceId, dto, actor);
  }

  @Post(':eventId/billing-statements/generate')
  @HttpCode(HttpStatus.CREATED)
  async generateBillingStatement(
    @Param('eventId') eventId: string,
    @Body() dto: GenerateBillingStatementDto = {},
    @Query() actorInput: BillingActorDto,
  ) {
    const actor = await this.requireFinanceActor(actorInput, 'billing statement', eventId);
    return this.billingOperationsService.generateBillingStatement(eventId, dto.sourceId, actor);
  }

  @Patch(':eventId/payments/:milestoneId')
  async markPayment(
    @Param('eventId') eventId: string,
    @Param('milestoneId') milestoneId: string,
    @Body() dto: MarkPaymentDto,
    @Query() actorInput: BillingActorDto,
  ) {
    const actor = await this.requireFinanceActor(actorInput, 'payment milestone', eventId);
    return this.billingOperationsService.markPayment(eventId, milestoneId, dto.status, actor);
  }

  @Post(':eventId/payments/:milestoneId/records')
  @HttpCode(HttpStatus.CREATED)
  async recordPayment(
    @Param('eventId') eventId: string,
    @Param('milestoneId') milestoneId: string,
    @Body() dto: RecordPaymentDto,
    @Query() actorInput: BillingActorDto,
  ) {
    const actor = await this.requireFinanceActor(actorInput, 'payment recording', eventId);
    return this.billingOperationsService.recordPayment(eventId, milestoneId, dto, actor);
  }

  @Post(':eventId/billing-statements/:billingId/send')
  @HttpCode(HttpStatus.OK)
  async sendBillingStatement(
    @Param('eventId') eventId: string,
    @Param('billingId') billingId: string,
    @Query() actorInput: BillingActorDto,
  ) {
    const actor = await this.requireFinanceActor(actorInput, 'billing statement delivery', eventId);
    return this.billingOperationsService.sendBillingStatement(eventId, billingId, actor);
  }

  private async requireFinanceActor(actorInput: BillingActorDto = {}, resource: string, eventId: string) {
    const actor = this.eventAccessPolicyService.resolveActor(actorInput);
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
