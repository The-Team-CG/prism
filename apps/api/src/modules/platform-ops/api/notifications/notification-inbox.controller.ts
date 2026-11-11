import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { EventSessionGuard, VerifiedEventActor } from '@prism/kernel/event-session';
import { zodBody } from '@prism/kernel/shared';
import { acknowledgeNotificationReceiptSchema, type AcknowledgeNotificationReceiptInput, type PrismVerifiedEventActor } from '@prism/types';
import { NotificationInboxService } from '../../application/notifications/notification-inbox.service';
import { NotificationProviderOutcomeService } from '../../application/notifications/notification-provider-outcome.service';
import { requestNotificationAcknowledgmentSchema, type RequestNotificationAcknowledgmentInput } from '@prism/types';

@Controller('notification-inbox')
@UseGuards(EventSessionGuard)
export class NotificationInboxController {
  constructor(private readonly inbox: NotificationInboxService) {}
  @Get('me')
  mine(@VerifiedEventActor() actor: PrismVerifiedEventActor) { return this.inbox.mine(actor); }
  @Post(':deliveryId/deadline')
  deadline(@Param('deliveryId') id: string, @Body(zodBody(requestNotificationAcknowledgmentSchema)) input: RequestNotificationAcknowledgmentInput, @VerifiedEventActor() actor: PrismVerifiedEventActor) {
    return this.inbox.requireAcknowledgment(id, input, actor);
  }
  @Post(':deliveryId/acknowledgment')
  acknowledge(@Param('deliveryId') id: string, @Body(zodBody(acknowledgeNotificationReceiptSchema)) input: AcknowledgeNotificationReceiptInput, @VerifiedEventActor() actor: PrismVerifiedEventActor) {
    return this.inbox.acknowledge(id, input.version, actor);
  }
  @Post(':deliveryId/read')
  read(@Param('deliveryId') id: string, @Body(zodBody(acknowledgeNotificationReceiptSchema)) input: AcknowledgeNotificationReceiptInput, @VerifiedEventActor() actor: PrismVerifiedEventActor) {
    return this.inbox.markRead(id, input.version, actor);
  }
}

@Controller('notification-provider-outcomes')
@UseGuards(EventSessionGuard)
export class NotificationProviderOutcomeController {
  constructor(private readonly outcomes: NotificationProviderOutcomeService) {}
  @Post(':notificationId/:deliveryId/refresh')
  refresh(@Param('notificationId') notificationId: string, @Param('deliveryId') id: string, @VerifiedEventActor() actor: PrismVerifiedEventActor) {
    return this.outcomes.refreshEmail(notificationId, id, actor);
  }
}
